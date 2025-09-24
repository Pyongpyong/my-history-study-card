from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

from openai import AsyncOpenAI, BadRequestError
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..settings import Settings, get_settings
from . import prompts
from app.llm.schemas import get_schema

logger = logging.getLogger(__name__)


@dataclass
class LLMResult:
    data: Dict[str, Any]
    tokens_in: int
    tokens_out: int
    latency_ms: int


_client: Optional[AsyncOpenAI] = None

CARDS_SCHEMA_PAYLOAD: Dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "cards_schema",
        "schema": {
            "type": "object",
            "properties": {
                "cards": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "question": {"type": "string"},
                            "prompt": {"type": "string"},
                            "text": {"type": "string"},
                            "statement": {"type": "string"},
                            "options": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "answer_index": {"type": "integer"},
                            "answer": {"type": ["string", "boolean", "number", "null"]},
                            "answer_order": {
                                "type": "array",
                                "items": {"type": "integer"},
                            },
                            "pairs": {
                                "type": "array",
                                "items": {
                                    "anyOf": [
                                        {
                                            "type": "array",
                                            "items": {"type": ["integer", "number"]},
                                        },
                                        {"type": "object"},
                                    ]
                                },
                            },
                            "clozes": {"type": "object"},
                            "items": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                            "rubric": {"type": "object"},
                            "explain": {"type": "string"},
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                        },
                        "required": ["type"],
                        "additionalProperties": True,
                    },
                }
            },
            "required": ["cards"],
            "additionalProperties": True,
        },
    },
}

EXTRACT_SCHEMA_PAYLOAD: Dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "facts_schema",
        "schema": {
            "type": "object",
            "properties": {
                "entities": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "facts": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "timeline": {
                    "type": "array",
                    "items": {"type": "object"},
                },
                "triples": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "subject": {"type": "string"},
                            "predicate": {"type": "string"},
                            "object": {"type": "string"},
                        },
                        "required": ["subject", "predicate", "object"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["facts"],
            "additionalProperties": True,
        },
    },
}

TYPE_TO_MAX_OUT = {
    "MCQ": 260,
    "SHORT": 180,
    "OX": 160,
    "CLOZE": 220,
    "ORDER": 220,
    "MATCH": 240,
}

TYPE_TO_TEMP = {
    "MCQ": 0.35,
    "SHORT": 0.2,
    "OX": 0.2,
    "CLOZE": 0.3,
    "ORDER": 0.3,
    "MATCH": 0.35,
}


def _settings() -> Settings:
    return get_settings()


def override_client(client: Optional[AsyncOpenAI]) -> None:
    global _client
    _client = client


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is not None:
        return _client
    settings = _settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    _client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=settings.request_timeout_sec)
    return _client


async def _call_responses(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_output_tokens: int,
    response_schema: Optional[Dict[str, Any]] = None,
    use_schema: bool = True,
) -> LLMResult:
    client = _get_client()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    start = time.perf_counter()
    response: Any = None
    use_responses = hasattr(client, "responses")
    if isinstance(max_output_tokens, int) and max_output_tokens > 0:
        effective_cap = max_output_tokens * 2
    else:
        effective_cap = 1024
    schema_payload = response_schema if response_schema is not None else CARDS_SCHEMA_PAYLOAD
    apply_schema = use_schema and schema_payload is not None
    raw_text: str = ""
    payload: Dict[str, Any] = {}
    schema_name = None
    if apply_schema and isinstance(schema_payload, dict):
        schema_name = (
            schema_payload.get("json_schema", {}) if isinstance(schema_payload.get("json_schema"), dict) else {}
        )
        if isinstance(schema_name, dict):
            schema_name = schema_name.get("name")
    user_preview = ""
    if messages:
        try:
            user_preview = str(messages[-1].get("content", ""))[:200]
        except Exception:  # pragma: no cover - defensive
            user_preview = ""
    logger.debug(
        "LLM request model=%s temp=%s cap=%s schema=%s user_preview=%s",
        model,
        temperature,
        effective_cap,
        schema_name,
        user_preview,
    )

    async for attempt in AsyncRetrying(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(1),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    ):
        with attempt:
            if use_responses:
                kwargs = {
                    "model": model,
                    "temperature": temperature,
                    "max_output_tokens": effective_cap,
                    "input": messages,
                }
                if apply_schema:
                    kwargs["response_format"] = schema_payload
                response = await client.responses.create(**kwargs)
            else:  # pragma: no cover - legacy fallback
                base_kwargs: Dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                }
                if apply_schema:
                    base_kwargs["response_format"] = schema_payload
                call_kwargs = base_kwargs.copy()
                if temperature is not None:
                    call_kwargs["temperature"] = temperature
                logger.info("chat.completions fallback: model=%s cap=%s", model, effective_cap)

                async def _call_with_max_tokens(kwargs: Dict[str, Any]) -> Any:
                    return await client.chat.completions.create(
                        **{**kwargs, "max_tokens": effective_cap}
                    )

                async def _call_with_completion_cap(kwargs: Dict[str, Any]) -> Any:
                    extra_body = dict(kwargs.get("extra_body", {}))
                    extra_body["max_completion_tokens"] = effective_cap
                    capped_kwargs = {**kwargs, "extra_body": extra_body}
                    return await client.chat.completions.create(**capped_kwargs)

                try:
                    response = await _call_with_max_tokens(call_kwargs)
                except BadRequestError as exc:
                    message = str(getattr(exc, "message", exc))
                    if "temperature" in message and "Only the default" in message:
                        call_kwargs.pop("temperature", None)
                        response = await _call_with_max_tokens(call_kwargs)
                    elif "max_tokens" in message and "Unsupported parameter" in message:
                        logger.info(
                            "chat.completions fallback switching to extra_body cap: model=%s cap=%s",
                            model,
                            effective_cap,
                        )
                        try:
                            response = await _call_with_completion_cap(call_kwargs)
                        except BadRequestError as exc2:
                            message2 = str(getattr(exc2, "message", exc2))
                            if "temperature" in message2 and "Only the default" in message2:
                                call_kwargs.pop("temperature", None)
                                response = await _call_with_completion_cap(call_kwargs)
                            else:
                                raise
                    else:
                        raise
            raw_repr = repr(response)
            logger.debug("LLM raw response preview=%s", raw_repr[:500])
            try:
                raw_text = _extract_text(response)
            except RuntimeError as extract_error:
                logger.error(
                    "LLM response text extraction failed: %s; response snapshot=%s",
                    extract_error,
                    raw_repr[:800],
                )
                raise
            logger.debug("LLM raw text length=%s", len(raw_text))
            payload = _safe_json_loads(raw_text)
            if not payload:
                raise ValueError("LLM JSON output invalid or empty")
    latency_ms = int((time.perf_counter() - start) * 1000)
    if response is None:
        raise RuntimeError("OpenAI response is None")
    if not payload:
        raise RuntimeError("LLM JSON payload empty or invalid")
    if not payload:
        raise RuntimeError("LLM JSON payload empty or invalid")
    usage = getattr(response, "usage", None)
    tokens_in = 0
    tokens_out = 0
    if usage is not None:
        tokens_in = getattr(usage, "input_tokens", getattr(usage, "prompt_tokens", 0)) or 0
        tokens_out = getattr(usage, "output_tokens", getattr(usage, "completion_tokens", 0)) or 0

    logger.info(
        "LLM call model=%s input_tokens=%s output_tokens=%s latency_ms=%s",
        model,
        tokens_in,
        tokens_out,
        latency_ms,
    )
    return LLMResult(payload, tokens_in, tokens_out, latency_ms)


def _extract_text(response: Any) -> str:
    def _coerce_text(candidate: Any, depth: int = 0) -> Optional[str]:
        if depth > 5:
            return None
        if candidate is None:
            return None
        if isinstance(candidate, str):
            text = candidate.strip()
            return text or None
        if isinstance(candidate, (list, tuple)):
            for item in candidate:
                text = _coerce_text(item, depth + 1)
                if text:
                    return text
            return None
        if isinstance(candidate, dict):
            for key in ("value", "text", "content", "message"):
                if key in candidate:
                    text = _coerce_text(candidate[key], depth + 1)
                    if text:
                        return text
            return None
        for attr in ("value", "text", "content", "message"):
            if hasattr(candidate, attr):
                text = _coerce_text(getattr(candidate, attr), depth + 1)
                if text:
                    return text
        return None

    # Prefer the unified convenience attribute exposed by Responses API
    text = _coerce_text(getattr(response, "output_text", None))
    if text:
        return text
    if hasattr(response, "output"):
        text = _coerce_text(getattr(response, "output"))
        if text:
            return text
    if hasattr(response, "choices"):
        text = _coerce_text(getattr(response, "choices"))
        if text:
            return text
    text = _coerce_text(getattr(response, "data", None))
    if text:
        return text
    if isinstance(response, dict):
        text = _coerce_text(response)
        if text:
            return text
    raise RuntimeError("OpenAI response had no text content")


def _safe_json_loads(raw: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        snippet = _extract_json_object(raw)
        if snippet is not None:
            try:
                parsed = json.loads(snippet)
                if isinstance(parsed, dict):
                    logger.warning("Recovered JSON payload after scanning")
                    return parsed
            except json.JSONDecodeError:
                pass
        trimmed = raw.strip()
        for idx in range(len(trimmed) - 1, -1, -1):
            if trimmed[idx] == '}':
                candidate = trimmed[: idx + 1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict):
                        logger.warning("Recovered JSON payload after truncating tail")
                        return parsed
                except json.JSONDecodeError:
                    continue
        logger.warning("Failed to decode LLM JSON output: %s", raw)
    return {}



def _extract_json_object(raw: str) -> Optional[str]:
    start_index: Optional[int] = None
    depth = 0
    in_string = False
    escape = False
    for idx, ch in enumerate(raw):
        if escape:
            escape = False
            continue
        if ch == "\\":
            if in_string:
                escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            if depth == 0:
                start_index = idx
            depth += 1
        elif ch == "}":
            if depth:
                depth -= 1
                if depth == 0 and start_index is not None:
                    return raw[start_index : idx + 1]
    return None

# --- Extraction payload normalization helpers ---------------------------------

def _as_list(x):
    if isinstance(x, list):
        return x
    if x is None:
        return []
    if isinstance(x, dict):
        return [x]
    if isinstance(x, str):
        return [x]
    return []


def _normalize_extract_payload(payload: Any, fallback_highlights: list[str]) -> Dict[str, Any]:
    """Coerce diverse LLM outputs into {entities:[], facts:[], timeline:[]} shape.
    - Accepts list/str for facts and wraps into objects {type, statement}.
    - Ensures entities is a list of non-empty strings; falls back to highlights.
    - Ensures timeline is a list (or empty list).
    """
    out: Dict[str, Any]
    if isinstance(payload, dict):
        out = dict(payload)
    elif isinstance(payload, list):
        out = {"facts": payload}
    elif isinstance(payload, str):
        out = {"facts": [payload]}
    else:
        out = {}

    # entities
    ents = out.get("entities")
    if not isinstance(ents, list):
        ents = []
    ents = [e.strip() for e in ents if isinstance(e, str) and e.strip()]
    if not ents and isinstance(fallback_highlights, list):
        ents = [h.strip() for h in fallback_highlights if isinstance(h, str) and h.strip()][:5]

    # facts
    raw_facts = out.get("facts")
    if not isinstance(raw_facts, list):
        raw_facts = []
    norm_facts: list[Dict[str, Any]] = []
    for f in raw_facts:
        if isinstance(f, dict):
            stmt = f.get("statement")
            if isinstance(stmt, str) and stmt.strip():
                norm_facts.append({
                    "type": f.get("type", "fact"),
                    "statement": stmt.strip(),
                })
        elif isinstance(f, str) and f.strip():
            norm_facts.append({"type": "fact", "statement": f.strip()})

    # timeline (optional)
    timeline = out.get("timeline")
    if not isinstance(timeline, list):
        timeline = []

    return {"entities": ents, "facts": norm_facts, "timeline": timeline}


def _build_fallback_facts(highlights: list[str], content: str, limit: int = 3) -> list[Dict[str, Any]]:
    statements: list[str] = []
    for item in highlights:
        if isinstance(item, str):
            text = item.strip()
            if text and text not in statements:
                statements.append(text)
        if len(statements) >= limit:
            break
    if not statements and isinstance(content, str):
        snippet = content.strip()
        if snippet:
            first_line = snippet.splitlines()[0].strip()
            if first_line:
                statements.append(first_line[:140])
    return [{"type": "fact", "statement": s} for s in statements[:limit]]


async def aextract_facts(content: str, highlights: list[str]) -> LLMResult:
    user_prompt = prompts.USER_EXTRACTION(content, highlights)
    settings = _settings()
    try:
        result = await _call_responses(
            model=settings.extract_model,
            system_prompt=prompts.SYSTEM_EXTRACTION,
            user_prompt=user_prompt,
            temperature=settings.temp_extract,
            max_output_tokens=settings.max_out_extract,
            response_schema=EXTRACT_SCHEMA_PAYLOAD,
        )
        norm = _normalize_extract_payload(result.data, highlights)
        if not norm.get("facts"):
            fallback_facts = _build_fallback_facts(highlights, content)
            if fallback_facts:
                logger.warning(
                    "extract produced no facts; falling back to highlights/content. payload=%s",
                    result.data,
                )
                norm["facts"] = fallback_facts
            else:
                raise ValueError("normalized extract facts empty")
        result.data = norm
        return result
    except Exception as primary_error:
        logger.warning("extract schema call failed without retry: %s", primary_error)
        raise RuntimeError("extract_failed") from primary_error


async def agenerate_one(facts: dict, card_type: str, difficulty: str = "medium") -> Dict[str, Any]:
    """Generate exactly one card of the requested type.
    For CLOZE, provide explicit candidates from facts/entities to prevent placeholders (e.g., '정답1').
    """
    schema = get_schema(card_type)
    settings = _settings()

    # Compact facts JSON string for the prompt
    facts_repr = json.dumps(facts or {}, ensure_ascii=False)

    # Per-type caps/temperature
    max_out = min(settings.max_out_generate, TYPE_TO_MAX_OUT.get(card_type.upper(), 260))
    temperature = TYPE_TO_TEMP.get(card_type.upper(), 0.3)

    # If ORDER and timeline is available, build deterministically from timeline to avoid LLM drift
    if str(card_type).upper() == "ORDER":
        try:
            tl = facts.get("timeline") or []
            # keep only entries that have numeric year and text label
            clean = []
            for t in tl:
                if isinstance(t, dict) and isinstance(t.get("year"), (int, float)) and t.get("label"):
                    y = int(t["year"])  # coerce
                    lbl = str(t["label"]).strip()
                    if lbl:
                        clean.append({"year": y, "label": lbl})
            if len(clean) >= 3:
                # sort by year ascending, pick up to 4
                clean.sort(key=lambda x: (x["year"], x["label"]))
                picked = clean[:4]
                items = [e["label"][:24] for e in picked]  # trim overly long labels
                answer_order = list(range(len(items)))
                card = {
                    "type": "ORDER",
                    "items": items,
                    "answer_order": answer_order,
                    "explain": "연대순(오름차순)으로 배열한 타임라인 기반 문제.",
                }
                data = {"cards": [card]}
                usage_dict = {"input_tokens": 0, "prompt_tokens": 0, "output_tokens": 0, "completion_tokens": 0}
                return {"data": data, "usage": usage_dict, "tokens_in": 0, "tokens_out": 0, "latency_ms": 0}
        except Exception:
            # fall through to LLM path if anything goes wrong
            pass

    # If MATCH and triples are available, build deterministically from triples to avoid poor LLM matches
    if str(card_type).upper() == "MATCH":
        try:
            triples = facts.get("triples") or []
            norm_triples = []
            for t in triples:
                if not isinstance(t, dict):
                    continue
                s = t.get("subject")
                p = t.get("predicate")
                o = t.get("object")
                if isinstance(s, str) and s.strip() and isinstance(p, str) and p.strip() and isinstance(o, str) and o.strip():
                    norm_triples.append((s.strip(), p.strip(), o.strip()))
            if len(norm_triples) >= 3:
                # Build left/right lists and index pairs with de-duplication
                left: list[str] = []
                right: list[str] = []
                li: dict[str, int] = {}
                ri: dict[str, int] = {}
                pairs: list[list[int]] = []

                for s, p, o in norm_triples:
                    # Right label as "predicate: object" for clarity
                    r_label = f"{p}: {o}"
                    if s not in li:
                        li[s] = len(left)
                        left.append(s)
                    if r_label not in ri:
                        ri[r_label] = len(right)
                        right.append(r_label)
                    pairs.append([li[s], ri[r_label]])
                    # cap to small sizes for UI and token economy
                    if len(left) >= 4 and len(right) >= 4:
                        break
                if len(pairs) >= 3:
                    # Trim to maximum of 4 per side and align pairs to trimmed indices
                    left_map = {v: i for i, v in enumerate(left[:4])}
                    right_map = {v: i for i, v in enumerate(right[:4])}
                    trimmed_pairs = []
                    for l_idx, r_idx in pairs:
                        l_val = left[l_idx]
                        r_val = right[r_idx]
                        if l_val in left_map and r_val in right_map:
                            trimmed_pairs.append([left_map[l_val], right_map[r_val]])
                        if len(trimmed_pairs) >= 4:
                            break
                    if len(trimmed_pairs) >= 3:
                        explain_parts = []
                        for s, p, o in norm_triples[:3]:
                            explain_parts.append(f"{s} — {p}: {o}")
                        explain = "추출된 관계(triples)를 반영한 매칭입니다: " + "; ".join(explain_parts) + "."
                        card = {
                            "type": "MATCH",
                            "left": left[:4],
                            "right": right[:4],
                            "pairs": trimmed_pairs,
                            "explain": explain,
                        }
                        data = {"cards": [card]}
                        usage_dict = {"input_tokens": 0, "prompt_tokens": 0, "output_tokens": 0, "completion_tokens": 0}
                        return {"data": data, "usage": usage_dict, "tokens_in": 0, "tokens_out": 0, "latency_ms": 0}
        except Exception:
            # fall through to LLM path if anything goes wrong
            pass

    # Build a small candidate list for CLOZE from facts.statements + entities
    user_prompt = prompts.USER_GENERATION_MIN(facts_repr, card_type, difficulty)
    if str(card_type).upper() == "CLOZE":
        stmts = []
        try:
            stmts = [
                f.get("statement")
                for f in (facts.get("facts") or [])
                if isinstance(f, dict) and isinstance(f.get("statement"), str) and f.get("statement").strip()
            ]
        except Exception:
            stmts = []
        ents = [e for e in (facts.get("entities") or []) if isinstance(e, str) and e.strip()]
        # de-dup & shrink
        seen = set()
        candidates: list[str] = []
        for v in stmts + ents:
            if v not in seen:
                seen.add(v)
                candidates.append(v)
            if len(candidates) >= 10:
                break
        if candidates:
            joined = ", ".join(candidates)
            # Strong guardrails: only use listed candidates; never invent placeholders.
            user_prompt += (
                "\n\n[CLOZE candidates] " + joined +
                "\n규칙: 위 후보들에서만 정답을 고른다. '정답1', 'xxx', 'placeholder' 같은 임의 값 금지." 
            )

    result = await _call_responses(
        model=settings.generate_model,
        system_prompt=prompts.SYSTEM_GENERATION_MIN,
        user_prompt=user_prompt,
        temperature=temperature,
        max_output_tokens=max_out,
        response_schema=schema,
    )

    logger.info(
        "LLM single generation type=%s input_tokens=%s output_tokens=%s latency_ms=%s",
        card_type,
        result.tokens_in,
        result.tokens_out,
        result.latency_ms,
    )

    usage_dict = {
        "input_tokens": result.tokens_in,
        "prompt_tokens": result.tokens_in,
        "output_tokens": result.tokens_out,
        "completion_tokens": result.tokens_out,
    }

    return {
        "data": result.data,
        "usage": usage_dict,
        "tokens_in": result.tokens_in,
        "tokens_out": result.tokens_out,
        "latency_ms": result.latency_ms,
    }


async def agenerate_cards(facts: dict, types: list[str], difficulty: str = "medium") -> LLMResult:
    facts_repr = json.dumps(facts, ensure_ascii=False)
    user_prompt = prompts.USER_GENERATION(facts_repr, types, difficulty)
    settings = _settings()
    return await _call_responses(
        model=settings.generate_model,
        system_prompt=prompts.SYSTEM_GENERATION,
        user_prompt=user_prompt,
        temperature=settings.temp_generate,
        max_output_tokens=settings.max_out_generate,
    )


async def afix_cards(cards: dict, errors: list[dict]) -> LLMResult:
    cards_repr = json.dumps(cards, ensure_ascii=False)
    user_prompt = prompts.USER_FIX(cards_repr, errors)
    settings = _settings()
    return await _call_responses(
        model=settings.fix_model,
        system_prompt=prompts.SYSTEM_FIX,
        user_prompt=user_prompt,
        temperature=settings.temp_fix,
        max_output_tokens=settings.max_out_fix,
    )
