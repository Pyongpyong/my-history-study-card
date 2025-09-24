from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import orjson

from ..llm import client as llm_client
from ..llm.client import LLMResult
from ..services.facts_shrink import shrink_for_type
from ..services.validator import validate_cards
from ..settings import Settings, get_settings

def _order_from_timeline(facts: dict) -> Optional[dict]:
    if not isinstance(facts, dict):
        return None
    timeline = facts.get("timeline")
    if not isinstance(timeline, list) or not timeline:
        return None

    events: List[Tuple[Optional[int], str]] = []
    for ev in timeline:
        if isinstance(ev, dict):
            year = ev.get("year")
            label = ev.get("label") or ev.get("title") or ev.get("statement")
            if isinstance(label, str) and label.strip():
                try:
                    y = int(year)
                except Exception:
                    y = None
                events.append((y, label.strip()))

    if len(events) < 2:
        return None

    # 연도가 있는 건 오름차순, 없는 건 뒤로
    events.sort(key=lambda x: (0 if isinstance(x[0], int) else 1, x[0] or 999999))

    items = [label for _, label in events]
    answer_order = list(range(len(items)))

    # explain 문장을 연대 정보로 생성
    explain_parts = []
    for year, label in events:
        if year:
            explain_parts.append(f"{year}년에 {label}")
        else:
            explain_parts.append(label)
    explain = " → ".join(explain_parts) + " 순서로 사건이 일어났습니다."

    return {
        "type": "ORDER",
        "items": items,
        "answer_order": answer_order,
        "explain": explain,
    }


def _has_batchim(text: str) -> bool:
    if not text:
        return True
    char = text[-1]
    code = ord(char)
    if 0xAC00 <= code <= 0xD7A3:
        return (code - 0xAC00) % 28 != 0
    return True


def _topic_particle(text: str) -> str:
    return "은" if _has_batchim(text) else "는"


def _subject_particle(text: str) -> str:
    return "이" if _has_batchim(text) else "가"


def _timeline_events(facts: dict) -> Tuple[List[Dict[str, object]], List[Dict[str, object]]]:
    if not isinstance(facts, dict):
        return [], []
    timeline = facts.get("timeline")
    all_events: List[Dict[str, object]] = []
    numeric_events: List[Dict[str, object]] = []
    if not isinstance(timeline, list):
        return all_events, numeric_events
    for raw in timeline:
        if not isinstance(raw, dict):
            continue
        year_raw = raw.get("year")
        label = raw.get("label") or raw.get("title") or raw.get("statement")
        if not isinstance(label, str):
            continue
        label_clean = label.strip()
        if not label_clean:
            continue
        entry: Dict[str, object] = {"label": label_clean}
        year_int: Optional[int] = None
        if isinstance(year_raw, int):
            year_int = year_raw
            entry["year"] = year_raw
        else:
            try:
                year_int = int(year_raw)
            except (TypeError, ValueError):
                if year_raw is not None:
                    entry["year"] = year_raw
        all_events.append(entry)
        if isinstance(year_int, int):
            numeric_events.append({"year": year_int, "label": label_clean})
    numeric_events.sort(key=lambda item: item["year"])
    return all_events, numeric_events


def _split_label(label: str) -> Tuple[str, str]:
    work = label.strip()
    if not work:
        return label, ""
    
    # 특정 패턴에 대한 주어 매핑
    subject_mapping = {
        "훈민정음 창제": ("훈민정음", "창제"),
        "훈민정음": ("훈민정음", "창제"),
        "조선 건국": ("이성계", "조선을 건국"),
        "조선": ("이성계", "조선을 건국"),
    }
    
    if work in subject_mapping:
        return subject_mapping[work]
    
    separators = [" ", "·", "-", "―"]
    for sep in separators:
        if sep in work:
            subject, remainder = work.split(sep, 1)
            subject = subject.strip()
            remainder = remainder.strip()
            if subject and remainder:
                return subject, remainder
    suffixes = ["창제", "편찬", "반포", "건립", "건국", "설립", "수립", "창건", "탄생", "즉위", "집권", "발생"]
    for suffix in suffixes:
        if work.endswith(suffix) and len(work) > len(suffix):
            subject = work[: -len(suffix)].strip()
            if subject:
                return subject, suffix
    return work, ""


def _action_forms(action: str) -> Dict[str, str]:
    base = action.strip()
    templates = [
        ("창제", {"question": "창제한 연도는?", "statement": "창제하였다.", "cloze": "창제하였다."}),
        ("편찬", {"question": "편찬된 연도는?", "statement": "편찬되었다.", "cloze": "편찬되었다."}),
        ("반포", {"question": "반포된 연도는?", "statement": "반포되었다.", "cloze": "반포되었다."}),
        ("창건", {"question": "창건된 연도는?", "statement": "창건되었다.", "cloze": "창건되었다."}),
        ("건립", {"question": "건립된 연도는?", "statement": "건립되었다.", "cloze": "건립되었다."}),
        ("설립", {"question": "설립된 연도는?", "statement": "설립되었다.", "cloze": "설립되었다."}),
        ("수립", {"question": "수립된 연도는?", "statement": "수립되었다.", "cloze": "수립되었다."}),
        ("건국", {"question": "건국된 연도는?", "statement": "건국되었다.", "cloze": "건국되었다."}),
        ("탄생", {"question": "탄생한 연도는?", "statement": "탄생하였다.", "cloze": "탄생하였다."}),
        ("즉위", {"question": "즉위한 연도는?", "statement": "즉위하였다.", "cloze": "즉위하였다."}),
        ("집권", {"question": "집권한 연도는?", "statement": "집권하였다.", "cloze": "집권하였다."}),
        ("발생", {"question": "발생한 연도는?", "statement": "발생하였다.", "cloze": "발생하였다."}),
        ("승리", {"question": "승리한 연도는?", "statement": "승리하였다.", "cloze": "승리하였다."}),
        ("패배", {"question": "패배한 연도는?", "statement": "패배하였다.", "cloze": "패배하였다."}),
        ("개혁", {"question": "실시된 연도는?", "statement": "실시되었다.", "cloze": "실시되었다."}),
    ]
    for keyword, forms in templates:
        if keyword in base:
            return {
                "question": forms["question"],
                "statement": forms["statement"],
                "cloze": forms["cloze"],
            }
    return {"question": "몇 년에 일어났습니까?", "statement": "일어났다.", "cloze": "일어났다."}


def _timeline_card_from_events(card_type: str, events: List[Dict[str, object]]) -> Optional[Dict[str, object]]:
    if not events:
        return None
    event = events[0]
    year = event.get("year")
    label = event.get("label")
    if not isinstance(year, int) or not isinstance(label, str):
        return None
    label = label.strip()
    if not label:
        return None

    explain = f"{year} {label}"
    upper_type = str(card_type).upper()

    subject, action = _split_label(label)
    forms = _action_forms(action)
    display_subject = subject if action else label
    statement_subject = label if action else label

    if upper_type == "MCQ":
        options: List[str] = [str(year)]
        deltas = [1, -1, 2, -2, 3, -3]
        for delta in deltas:
            candidate = year + delta
            if candidate <= 0:
                continue
            candidate_str = str(candidate)
            if candidate_str not in options:
                options.append(candidate_str)
            if len(options) >= 3:
                break
        while len(options) < 3:
            candidate = year + len(options)
            if candidate <= 0:
                candidate = len(options) + 1
            candidate_str = str(candidate)
            if candidate_str not in options:
                options.append(candidate_str)
        return {
            "type": "MCQ",
            "question": f"{display_subject}{_topic_particle(display_subject)} {forms['question']}",
            "options": options,
            "answer_index": 0,
            "explain": explain,
        }

    if upper_type == "SHORT":
        return {
            "type": "SHORT",
            "prompt": f"{display_subject}{_topic_particle(display_subject)} {forms['question']}",
            "answer": str(year),
            "rubric": {"aliases": []},
        }

    if upper_type == "OX":
        # OX는 주어를 "세종대왕"으로 변경하여 더 자연스럽게
        ox_subject = "세종대왕" if display_subject == "훈민정음" else display_subject
        object_particle = "을" if display_subject == "훈민정음" else _topic_particle(display_subject)
        return {
            "type": "OX",
            "statement": f"{ox_subject}{_topic_particle(ox_subject)} {year}년에 {display_subject}{object_particle} {forms['statement']}",
            "answer": True,
            "explain": explain,
        }

    if upper_type == "CLOZE":
        # CLOZE도 주어를 "세종대왕"으로 변경하여 더 자연스럽게
        cloze_subject = "세종대왕" if display_subject == "훈민정음" else display_subject
        object_particle = "을" if display_subject == "훈민정음" else _topic_particle(display_subject)
        return {
            "type": "CLOZE",
            "text": f"{cloze_subject}{_topic_particle(cloze_subject)} {{{{c1}}}}년에 {display_subject}{object_particle} {forms['cloze']}",
            "clozes": {"c1": str(year)},
            "explain": explain,
        }

    return None


@dataclass
class GenerationMeta:
    cached: bool
    tokens_in: int
    tokens_out: int
    latency_ms: int


class GenerationError(Exception):
    def __init__(self, errors: List[Dict[str, object]]):
        super().__init__("card validation failed")
        self.errors = errors


def _settings() -> Settings:
    return get_settings()


logger = logging.getLogger(__name__)


def normalize_for_cache(
    content: str,
    highlights: List[str],
    types: List[str],
    difficulty: str,
    *,
    focus_mode: str,
) -> Dict[str, object]:
    settings = _settings()
    seen = set()
    normalized_highlights: List[str] = []
    for item in highlights:
        if not isinstance(item, str):
            continue
        trimmed = item.strip()
        if not trimmed:
            continue
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized_highlights.append(trimmed)
    normalized_types = sorted({item.upper() for item in types})
    return {
        "content": content.strip(),
        "highlights": normalized_highlights,
        "types": normalized_types,
        "difficulty": difficulty.lower(),
        "focus_mode": focus_mode,
        "extract_model": settings.extract_model,
        "generate_model": settings.generate_model,
        "fix_model": settings.fix_model,
    }


def hash_key(normalized_payload: Dict[str, object]) -> str:
    payload_bytes = orjson.dumps(normalized_payload, option=orjson.OPT_SORT_KEYS)
    return hashlib.sha256(payload_bytes).hexdigest()


def _cache_path(key: str) -> str:
    return str(_settings().cache_dir_path / f"{key}.json")


def _read_cache(key: str) -> Optional[Dict[str, object]]:
    path = _cache_path(key)
    try:
        with open(path, "rb") as handle:
            data = orjson.loads(handle.read())
    except FileNotFoundError:
        return None
    except Exception:
        return None
    ttl = _settings().cache_ttl
    if time.time() - data.get("stored_at", 0) > ttl:
        return None
    return data.get("payload")


def _write_cache(key: str, payload: Dict[str, object]) -> None:
    path = _cache_path(key)
    record = {
        "stored_at": time.time(),
        "payload": payload,
    }
    with open(path, "wb") as handle:
        handle.write(orjson.dumps(record))


def _batch_types(types: List[str]) -> List[List[str]]:
    batch_size = max(1, _settings().gen_batch_size)
    return [types[i : i + batch_size] for i in range(0, len(types), batch_size)]


def _usage_tokens(usage: object, primary: str, fallback: Optional[str] = None) -> int:
    if usage is None:
        return 0
    value = getattr(usage, primary, None)
    if value is None and isinstance(usage, dict):
        value = usage.get(primary)
    if value is None and fallback:
        value = getattr(usage, fallback, None)
        if value is None and isinstance(usage, dict):
            value = usage.get(fallback)
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _normalize_card_structure(raw_card: object) -> Dict[str, object]:
    if not isinstance(raw_card, dict):
        return {}
    card = dict(raw_card)
    card_type = card.get("type")

    if card_type == "MCQ":
        answer_text = card.pop("answer", None)
        if answer_text and isinstance(card.get("options"), list):
            options = [str(option).strip() for option in card["options"]]
            if answer_text in options:
                card["answer_index"] = options.index(answer_text)
            else:
                options.append(str(answer_text))
                card["options"] = options
                card["answer_index"] = len(options) - 1
        explanation = card.pop("explanation", None)
        if explanation and "explain" not in card:
            card["explain"] = explanation

    if card_type == "SHORT":
        if "question" in card and "prompt" not in card:
            card["prompt"] = str(card.pop("question"))
        explanation = card.pop("explanation", None)
        if explanation and "explain" not in card:
            card["explain"] = explanation
        rubric_aliases = card.pop("rubric.aliases", None)
        if rubric_aliases is not None:
            rubric = card.get("rubric")
            if not isinstance(rubric, dict):
                rubric = {}
            if isinstance(rubric_aliases, list):
                rubric.setdefault("aliases", rubric_aliases)
            card["rubric"] = rubric

    if card_type == "OX" and isinstance(card.get("answer"), str):
        answer_str = card["answer"].strip().upper()
        card["answer"] = answer_str in {"O", "TRUE", "T", "Y", "1"}

    if card_type == "CLOZE":
        if "question" in card and "text" not in card:
            card["text"] = str(card.pop("question"))
        text = str(card.get("text", ""))
        placeholders = re.findall(r"\{\{(c\d+)\}\}", text)
        clozes = card.get("clozes")
        if not isinstance(clozes, dict):
            clozes = {}
        answers = card.pop("answers", None)
        answer_value = card.pop("answer", None)
        alias_values = card.pop("rubric.aliases", None)
        for idx, placeholder in enumerate(placeholders):
            existing = clozes.get(placeholder)
            if isinstance(existing, str) and existing.strip():
                continue
            value: Optional[str] = None
            if isinstance(answers, list) and idx < len(answers):
                value = str(answers[idx])
            elif isinstance(answer_value, str):
                value = answer_value
            elif isinstance(alias_values, list) and alias_values:
                value = str(alias_values[0])
            if value is not None and not value.strip():
                value = None
            if value is None:
                clozes.setdefault(placeholder, "")
            else:
                clozes[placeholder] = value
        card["clozes"] = clozes

    if card_type == "ORDER":
        answers = card.pop("answers", None)
        if isinstance(answers, list):
            card.setdefault("items", answers)
        if "answer_order" not in card and isinstance(card.get("items"), list):
            card["answer_order"] = list(range(len(card["items"])))

    if card_type == "MATCH":
        raw_left = card.get("left") if isinstance(card.get("left"), list) else []
        raw_right = card.get("right") if isinstance(card.get("right"), list) else []

        left_items: List[str] = []
        left_index: Dict[str, int] = {}
        for item in raw_left:
            if isinstance(item, str):
                text = item.strip()
                if text and text not in left_index and len(left_items) < 4:
                    left_index[text] = len(left_items)
                    left_items.append(text)

        right_items: List[str] = []
        right_index: Dict[str, int] = {}
        for item in raw_right:
            if isinstance(item, str):
                text = item.strip()
                if text and text not in right_index and len(right_items) < 4:
                    right_index[text] = len(right_items)
                    right_items.append(text)

        def ensure_left(value: object) -> Optional[int]:
            if isinstance(value, int):
                if 0 <= value < len(left_items):
                    return value
                return None
            if isinstance(value, str):
                text = value.strip()
                if not text:
                    return None
                if text not in left_index:
                    if len(left_items) >= 4:
                        return None
                    left_index[text] = len(left_items)
                    left_items.append(text)
                return left_index[text]
            return None

        def ensure_right(value: object) -> Optional[int]:
            if isinstance(value, int):
                if 0 <= value < len(right_items):
                    return value
                return None
            if isinstance(value, str):
                text = value.strip()
                if not text:
                    return None
                if text not in right_index:
                    if len(right_items) >= 4:
                        return None
                    right_index[text] = len(right_items)
                    right_items.append(text)
                return right_index[text]
            return None

        normalized_pairs: List[List[int]] = []
        used_left: set[int] = set()
        used_right: set[int] = set()
        pairs = card.get("pairs")
        if isinstance(pairs, list):
            for pair in pairs:
                left_candidate: Optional[int] = None
                right_candidate: Optional[int] = None
                if isinstance(pair, dict):
                    left_candidate = ensure_left(pair.get("left"))
                    if left_candidate is None and isinstance(pair.get("index"), int):
                        left_candidate = ensure_left(pair.get("index"))
                    right_candidate = ensure_right(pair.get("right"))
                elif isinstance(pair, list) and len(pair) == 2:
                    left_candidate = ensure_left(pair[0])
                    right_candidate = ensure_right(pair[1])
                if left_candidate is None or right_candidate is None:
                    continue
                if left_candidate in used_left or right_candidate in used_right:
                    continue
                normalized_pairs.append([left_candidate, right_candidate])
                used_left.add(left_candidate)
                used_right.add(right_candidate)
                if len(normalized_pairs) >= 4:
                    break

        card["left"] = left_items[:4]
        card["right"] = right_items[:4]
        card["pairs"] = normalized_pairs

    return card


def _sanitize_by_type(card: dict) -> dict:
    t = card.get("type") if isinstance(card, dict) else None
    allowed = {
        "MCQ": {"type", "question", "options", "answer_index", "explain"},
        "SHORT": {"type", "prompt", "answer", "rubric"},
        "OX": {"type", "statement", "answer", "explain"},
        "CLOZE": {"type", "text", "clozes", "explain"},
        "ORDER": {"type", "items", "answer_order", "explain"},
        "MATCH": {"type", "left", "right", "pairs", "explain"},
    }.get(t, set())
    if not allowed:
        return card
    return {key: value for key, value in card.items() if key in allowed}


def _korean_verb_to_noun(action_text: str) -> Optional[str]:
    """Map common Korean verb phrases to concise noun phrases (e.g., '창제하였다' -> '창제')."""
    if not isinstance(action_text, str):
        return None
    t = action_text.strip()
    if not t:
        return None
    mappings = [
        (r"창제하였.*|창제했.*|창제하였다|창제했다|창제됨|창제되었.*|창제된", "창제"),
        (r"발명하였.*|발명했.*|발명하였다|발명했다|발명됨|발명되었.*|발명된", "발명"),
        (r"편찬하였.*|편찬했.*|편찬하였다|편찬했다|편찬됨|편찬되었.*|편찬된", "편찬"),
        (r"반포하였.*|반포했.*|반포하였다|반포했다|반포됨|반포되었.*|반포된", "반포"),
        (r"설립하였.*|설립했.*|설립하였다|설립했다|설립됨|설립되었.*|설립된", "설립"),
        (r"수립하였.*|수립했.*|수립하였다|수립했다|수립됨|수립되었.*|수립된", "수립"),
        (r"건립하였.*|건립했.*|건립하였다|건립했다|건립됨|건립되었.*|건립된", "건립"),
        (r"건국하였.*|건국했.*|건국하였다|건국했다|건국됨|건국되었.*|건국된", "건국"),
        (r"창건하였.*|창건했.*|창건하였다|창건했다|창건됨|창건되었.*|창건된", "창건"),
        (r"즉위하였.*|즉위했.*|즉위하였다|즉위했다", "즉위"),
        (r"집권하였.*|집권했.*|집권하였다|집권했다", "집권"),
        (r"발생하였.*|발생했.*|발생하였다|발생했다", "발생"),
        (r"편성하였.*|편성했.*|편성하였다|편성했다", "편성"),
    ]
    import re
    for pattern, noun in mappings:
        if re.search(pattern, t):
            return noun
    return None


def _compact_phrase(text: str) -> str:
    """Return a concise phrase (<=20 chars, no terminal punctuation)."""
    if not isinstance(text, str):
        return ""
    t = text.strip()
    # remove terminal punctuation
    t = t.rstrip(" .!?;:")
    # limit length
    if len(t) > 20:
        t = t[:20]
    return t


def _sanitize_match_right(card: dict) -> dict:
    """For MATCH type, convert right-side items to appropriate descriptions.
    Transform action-based phrases to characteristic/feature-based descriptions.
    """
    if not isinstance(card, dict) or card.get("type") != "MATCH":
        return card
    left = card.get("left") if isinstance(card.get("left"), list) else []
    right = card.get("right") if isinstance(card.get("right"), list) else []
    pairs = card.get("pairs") if isinstance(card.get("pairs"), list) else []
    if not left or not right:
        return card
    
    import re
    mapped = list(right)
    
    # Define mapping from entities to their characteristics/features
    entity_features = {
        "훈민정음": "한국 고유 문자",
        "측우기": "강우량 측정 기구", 
        "농사직설": "농업 기술서",
        "경국대전": "조선 기본 법전",
        "동국통감": "한국사 편년체 사서",
        "월인천강지곡": "불교 찬불가",
        "용비어천가": "조선 건국 서사시",
        "석보상절": "불교 경전 언해서",
        "월인석보": "불교 경전 해설서"
    }
    
    for pair in pairs:
        if not (isinstance(pair, (list, tuple)) and len(pair) == 2):
            continue
        li, ri = pair
        if not (isinstance(li, int) and isinstance(ri, int)):
            continue
        if 0 <= li < len(left) and 0 <= ri < len(right):
            entity = str(left[li]).strip()
            text = str(right[ri]).strip()
            
            # Use predefined features if available
            if entity in entity_features:
                mapped[ri] = entity_features[entity]
            else:
                # Try to extract characteristics from the text
                if "창제" in text or "발명" in text:
                    if "글자" in text or "문자" in text:
                        mapped[ri] = "문자 체계"
                    elif "기구" in text or "도구" in text:
                        mapped[ri] = "과학 기구"
                    else:
                        mapped[ri] = "창작물"
                elif "편찬" in text:
                    if "서적" in text or "책" in text:
                        if "농업" in text:
                            mapped[ri] = "농업 기술서"
                        elif "역사" in text:
                            mapped[ri] = "역사서"
                        else:
                            mapped[ri] = "편찬서"
                    else:
                        mapped[ri] = "편찬물"
                else:
                    # Fall back to cleaning up the original text
                    t = re.sub(r"[가-힣]+[은는이가을를]\s*", "", text)
                    t = re.sub(r"[창제발명편찬]하[였다]*", "", t)
                    phrase = _compact_phrase(t)
                    mapped[ri] = phrase if phrase else "관련 항목"
    
    card["right"] = mapped
    return card

def _cloze_candidates_from_facts(facts: Dict[str, object]) -> List[str]:
    """Return candidate *tokens* (not full sentences) for CLOZE blanks.
    Priority: entities → keywords from fact statements. Sentences are excluded.
    """
    def _is_token(s: object) -> bool:
        if not isinstance(s, str):
            return False
        t = s.strip()
        if not t:
            return False
        # disallow long/spacey/punctuated strings (likely sentences)
        if len(t) > 20:
            return False
        if any(ch in t for ch in [" ", ",", ".", "?", "!", ":", ";", "\"", "'", "(", ")"]):
            return False
        return True

    def _unique(seq: List[str]) -> List[str]:
        seen = set()
        out: List[str] = []
        for x in seq:
            if x not in seen:
                seen.add(x)
                out.append(x)
        return out

    if not isinstance(facts, dict):
        return []

    candidates: List[str] = []

    # 1) entities first
    ents = facts.get("entities") or []
    if isinstance(ents, list):
        for e in ents:
            if _is_token(e):
                candidates.append(e.strip())

    # 2) keywords from facts.statements
    facts_list = facts.get("facts") or []
    if isinstance(facts_list, list):
        for fact in facts_list:
            if not isinstance(fact, dict):
                continue
            stmt = fact.get("statement")
            if not isinstance(stmt, str):
                continue
            for word in re.findall(r"[가-힣A-Za-z0-9]+", stmt):
                w = word.strip()
                if _is_token(w):
                    candidates.append(w)

    return _unique(candidates)


def _fill_cloze_blanks_from_facts(card: dict, facts: Dict[str, object]) -> dict:
    """Fill empty CLOZE placeholders with compact, single-token answers from facts/entities.
    Never use full sentences as a cloze value.
    """
    if not isinstance(card, dict) or card.get("type") != "CLOZE":
        return card

    clozes = card.get("clozes")
    if not isinstance(clozes, dict):
        return card

    text_body = card.get("text") if isinstance(card.get("text"), str) else ""
    explanation = card.get("explain") if isinstance(card.get("explain"), str) else ""

    # candidate pool (tokens only)
    candidates = _cloze_candidates_from_facts(facts)

    # helper to filter single-token, short, punctuation-free
    def _is_good_token(s: object) -> bool:
        if not isinstance(s, str):
            return False
        t = s.strip()
        if not t or len(t) > 20:
            return False
        if any(ch in t for ch in [" ", ",", ".", "?", "!", ":", ";", "\"", "'", "(", ")"]):
            return False
        return True

    # prefer tokens mentioned in explanation, then in text, else first available
    def _pick_token() -> Optional[str]:
        # 1) in explanation
        for c in candidates:
            if _is_good_token(c) and isinstance(explanation, str) and c in explanation:
                return c
        # 2) in text (with placeholders removed)
        if isinstance(text_body, str):
            text_no_ph = re.sub(r"\{\{c\d+\}\}", " ", text_body)
            for c in candidates:
                if _is_good_token(c) and c in text_no_ph:
                    return c
        # 3) first good token
        for c in candidates:
            if _is_good_token(c):
                return c
        return None

    # iterate placeholders and fill if empty/invalid
    for placeholder, current in list(clozes.items()):
        if isinstance(current, str) and _is_good_token(current):
            continue
        replacement = _pick_token()
        # do not fall back to sentences; if no good token, leave empty and let validator/LLM fix step handle
        clozes[placeholder] = replacement or ""

    card["clozes"] = clozes
    return card


def _apply_local_fixes(cards_payload: Dict[str, object], errors: List[Dict[str, object]]) -> bool:
    cards = cards_payload.get("cards") if isinstance(cards_payload, dict) else None
    if not isinstance(cards, list):
        return False
    changed = False

    for error in errors:
        code = error.get("code")
        index = error.get("card_index")
        if not isinstance(index, int) or not (0 <= index < len(cards)):
            continue
        card = cards[index]
        if not isinstance(card, dict):
            continue
        card = _normalize_card_structure(card)
        cards[index] = card

        if code in {"mcq_options_length", "mcq_option_duplicate", "mcq_option_empty", "mcq_answer_index", "mcq_option_semantic_duplicate", "mcq_option_filler", "mcq_answer_mismatch", "mcq_category_mix", "mcq_unnatural_question"}:
            options = card.get("options")
            if not isinstance(options, list):
                options = []
            normalized: List[str] = []
            seen = set()
            for option in options:
                text = str(option).strip()
                if not text:
                    continue
                if text not in seen:
                    normalized.append(text)
                    seen.add(text)
            # Remove semantic duplicates (aliases/synonyms/spacing variants)
            def _canon(value: str) -> str:
                import re as _re
                v = _re.sub(r"\s+", "", value).lower()
                alias = {
                    "훈민정음": "훈민정음",
                    "한글": "훈민정음",
                    "hunminjeongeum": "훈민정음",
                }
                if v in alias:
                    return alias[v]
                v2 = _re.sub(r"[\-·_]", "", v)
                return v2
            canon_seen: set[str] = set()
            sem_deduped: List[str] = []
            for opt in normalized:
                k = _canon(opt)
                if k in canon_seen:
                    continue
                canon_seen.add(k)
                sem_deduped.append(opt)
            normalized = sem_deduped
            
            # Remove auto-generated filler options
            normalized = [opt for opt in normalized if "자동 생성" not in opt and "오답" not in opt]
            
            # Fix unnatural question format
            question = str(card.get("question", "")).strip()
            explain = str(card.get("explain", "")).strip()
            correct_answer = None
            
            # Extract correct answer from explain
            if explain:
                import re as regex
                answer_matches = regex.findall(r'([가-힣A-Za-z0-9]{2,})[을를이가는은]\s*(?:창제|발명|편찬|건립|설립|수립|반포)', explain)
                if answer_matches:
                    correct_answer = answer_matches[0]
            
            # Fix unnatural question formats
            if question and any(pattern in question for pattern in ["무엇인가", "란?", "이란?"]):
                # Transform unnatural questions to natural ones
                if correct_answer:
                    if "창제" in explain or "발명" in explain:
                        card["question"] = f"{correct_answer}을 누가 창제했나?"
                    elif "편찬" in explain:
                        card["question"] = f"{correct_answer}을 누가 편찬했나?"
                    elif "설립" in explain or "건립" in explain:
                        card["question"] = f"{correct_answer}을 누가 설립했나?"
                    else:
                        # Extract subject from explain for "다음 중 X의 업적은?" format
                        subject_matches = regex.findall(r'([가-힣A-Za-z0-9]{2,}(?:대왕|왕|조|종))[은는이가]', explain)
                        if subject_matches:
                            subject = subject_matches[0]
                            card["question"] = f"다음 중 {subject}의 업적은?"
            
            # Ensure correct answer is in options
            if correct_answer and correct_answer not in normalized:
                # Replace first option with correct answer
                if normalized:
                    normalized[0] = correct_answer
                else:
                    normalized.append(correct_answer)
            
            # Fill with proper distractors based on question type
            question = str(card.get("question", "")).strip()
            if "누가" in question:
                # For "누가 X했나?" questions, use person names
                person_names = ["세조", "성종", "중종", "인종", "명종", "선조", "광해군", "인조"]
                for name in person_names:
                    if len(normalized) >= 4:
                        break
                    if name not in normalized and name != correct_answer:
                        normalized.append(name)
            elif "업적" in question or "만든 것" in question:
                # For "X의 업적은?" questions, use works/achievements
                achievements = ["경국대전", "동국통감", "국조오례의", "월인천강지곡", "용비어천가", "석보상절", "월인석보", "동국정운"]
                for achievement in achievements:
                    if len(normalized) >= 4:
                        break
                    if achievement not in normalized and achievement != correct_answer:
                        normalized.append(achievement)
            else:
                # For other question types, use general Korean history terms
                korean_history_terms = ["가갸날", "한자", "천자문", "동국정운", "월인천강지곡", "용비어천가", "석보상절", "월인석보"]
                for term in korean_history_terms:
                    if len(normalized) >= 4:
                        break
                    if term not in normalized and term != correct_answer:
                        normalized.append(term)
            
            # Only use generic fillers as last resort
            while len(normalized) < 4:
                filler = f"기타 선택지 {len(normalized) + 1}"
                if filler not in seen:
                    normalized.append(filler)
                    seen.add(filler)
            
            if len(normalized) > 4:
                normalized = normalized[:4]
            card["options"] = normalized
            
            # Set correct answer_index
            if correct_answer and correct_answer in normalized:
                card["answer_index"] = normalized.index(correct_answer)
            else:
                answer_index = card.get("answer_index")
                if not isinstance(answer_index, int) or not (0 <= answer_index < len(normalized)):
                    card["answer_index"] = 0
            
            if "answer" in card and isinstance(card["answer"], str):
                answer_text = card["answer"].strip()
                if answer_text in normalized:
                    card["answer_index"] = normalized.index(answer_text)
                card.pop("answer", None)
            explanation = card.pop("explanation", None)
            if explanation and "explain" not in card:
                card["explain"] = explanation
            changed = True

        elif code and code.startswith("cloze_"):
            text = str(card.get("text", ""))
            placeholders = []
            for match in re.findall(r"\{\{(c\d+)\}\}", text):
                if match not in placeholders:
                    placeholders.append(match)
            clozes = card.get("clozes")
            if not isinstance(clozes, dict):
                clozes = {}
            for idx, placeholder in enumerate(placeholders):
                current = clozes.get(placeholder)
                if not isinstance(current, str) or not current.strip():
                    clozes[placeholder] = ""
            for key in list(clozes.keys()):
                if key not in placeholders:
                    clozes.pop(key, None)
            card["clozes"] = clozes
            changed = True

    return changed


async def generate_cards(
    content: str,
    highlights: List[str],
    types: Optional[List[str]] = None,
    difficulty: str = "medium",
    *,
    force_refresh: bool = False,
    focus_mode: str = "highlight",
    timeline: Optional[List[Dict[str, Union[int, str]]]] = None,
) -> Tuple[Dict[str, object], GenerationMeta]:
    focus_mode_normalized = (focus_mode or "highlight").lower()
    if focus_mode_normalized not in {"highlight", "timeline"}:
        focus_mode_normalized = "highlight"

    types = types or ["MCQ"]
    single_type: str
    if isinstance(types, list):
        if not types:
            types = ["MCQ"]
        if len(types) > 1:
            types = [types[0]]
        single_type = str(types[0]).upper()
        types = [single_type]
    else:
        single_type = str(types).upper()
        types = [single_type]

    if focus_mode_normalized == "timeline":
        allowed_timeline_types = {"MCQ", "SHORT", "OX", "CLOZE", "ORDER", "MATCH"}
        if single_type not in allowed_timeline_types:
            single_type = "MCQ"
            types = ["MCQ"]

    def _sanitize_highlights(source: List[str]) -> List[str]:
        if focus_mode_normalized != "highlight":
            return []
        clean: List[str] = []
        seen_keys: set[str] = set()
        cap = 1 if single_type != "MATCH" else 10  # allow multi-select for MATCH
        for item in source or []:
            if not isinstance(item, str):
                continue
            trimmed = item.strip()
            if not trimmed:
                continue
            key = trimmed.lower()
            if key in seen_keys:
                continue
            seen_keys.add(key)
            clean.append(trimmed)
            if len(clean) >= cap:
                break
        return clean

    sanitized_highlights = _sanitize_highlights(highlights)

    normalized = normalize_for_cache(
        content,
        sanitized_highlights,
        types,
        difficulty,
        focus_mode=focus_mode_normalized,
    )
    cache_key = hash_key(normalized)
    cached_payload = None if force_refresh else _read_cache(cache_key)
    if cached_payload:
        payload_copy = {
            "cards": cached_payload.get("cards", []),
            "facts": cached_payload.get("facts", {}),
            "meta": {
                **cached_payload.get("meta", {}),
                "cached": True,
                "tokens_in": 0,
                "tokens_out": 0,
                "latency_ms": 0,
            },
        }
        meta = GenerationMeta(cached=True, tokens_in=0, tokens_out=0, latency_ms=0)
        return payload_copy, meta

    total_in = 0
    total_out = 0
    total_latency = 0

    # For highlight+MATCH, we still call extraction to let AI generate facts; multi-highlights are passed through.
    # Default path: extract facts via LLM
    try:
        extract_result: LLMResult = await llm_client.aextract_facts(content, sanitized_highlights)
    except RuntimeError as exc:
        raise GenerationError([
            {"code": "llm_invalid_output", "stage": "extract", "message": "LLM 출력이 JSON 스키마를 만족하지 못했습니다."}
        ]) from exc
    total_in += extract_result.tokens_in
    total_out += extract_result.tokens_out
    total_latency += extract_result.latency_ms
    facts = extract_result.data if isinstance(extract_result.data, dict) else {}

    if isinstance(facts, dict):
        if focus_mode_normalized == "highlight" and sanitized_highlights:
            # For MATCH, keep multiple facts; for others, reduce to 1 fact.
            if single_type != "MATCH":
                target = sanitized_highlights[0].lower()
                facts_list = facts.get("facts")
                if isinstance(facts_list, list):
                    filtered: List[Dict[str, object]] = []
                    for fact in facts_list:
                        if not isinstance(fact, dict):
                            continue
                        statement = fact.get("statement")
                        if isinstance(statement, str) and target in statement.lower():
                            filtered.append(fact)
                        if len(filtered) >= 1:
                            break
                    if not filtered and facts_list:
                        first_fact = facts_list[0]
                        if isinstance(first_fact, dict):
                            filtered = [first_fact]
                    if not filtered:
                        filtered = [{"type": "fact", "statement": sanitized_highlights[0]}]
                    else:
                        first = filtered[0]
                        statement = first.get("statement") if isinstance(first, dict) else None
                        if not isinstance(statement, str) or not statement.strip():
                            filtered = [{"type": "fact", "statement": sanitized_highlights[0]}]
                    facts["facts"] = filtered
                # entities set to the single selected highlight for non-MATCH
                facts["entities"] = [sanitized_highlights[0]]
            else:
                # MATCH: entities should mirror all selected highlights
                facts["entities"] = list(sanitized_highlights)
            # highlight mode: timeline is unused
            facts["timeline"] = []
        elif focus_mode_normalized == "timeline":
            facts["entities"] = []
            facts["facts"] = []

    if focus_mode_normalized == "timeline":
        # 사용자가 입력한 timeline 정보가 있으면 사용, 없으면 LLM 결과 사용
        if timeline and isinstance(timeline, list):
            # 사용자 입력 timeline을 사용
            all_events = []
            numeric_events = []
            for event in timeline:
                if isinstance(event, dict) and "year" in event and "label" in event:
                    year = event["year"]
                    label = str(event["label"]).strip()
                    if isinstance(year, int) and label:
                        all_events.append({"year": year, "label": label})
                        numeric_events.append({"year": year, "label": label})
        else:
            # LLM 결과에서 timeline 추출
            all_events, numeric_events = _timeline_events(facts)
        
        if isinstance(facts, dict):
            facts["timeline"] = all_events
        # Build deterministic cards for timeline mode
        timeline_card = _timeline_card_from_events(single_type, numeric_events)
        if timeline_card is not None:
            normalized_card = _sanitize_by_type(_normalize_card_structure(timeline_card))
            cards_payload: Dict[str, object] = {"cards": [normalized_card]}
            valid, errors = validate_cards(cards_payload)
            if not valid:
                raise GenerationError(errors)
            payload = {
                "cards": cards_payload.get("cards", []),
                "facts": facts,
                "meta": {
                    "cached": False,
                    "tokens_in": total_in,
                    "tokens_out": total_out,
                    "latency_ms": total_latency,
                },
            }
            _write_cache(cache_key, payload)
            meta = GenerationMeta(cached=False, tokens_in=total_in, tokens_out=total_out, latency_ms=total_latency)
            return payload, meta
        # If MATCH requested, build year-label match deterministically
        if single_type == "MATCH" and isinstance(numeric_events, list) and len(numeric_events) >= 3:
            # sort ascending by year and take up to 4
            events4 = numeric_events[:4]
            left = [str(ev["year"]) for ev in events4]
            right = [str(ev["label"])[:32] for ev in events4]
            pairs = [[i, i] for i in range(len(events4))]
            card = {"type": "MATCH", "left": left, "right": right, "pairs": pairs, "explain": "연표의 연도-사건 매칭."}
            normalized_card = _sanitize_by_type(_normalize_card_structure(card))
            cards_payload: Dict[str, object] = {"cards": [normalized_card]}
            valid, errors = validate_cards(cards_payload)
            if not valid:
                raise GenerationError(errors)
            payload = {
                "cards": cards_payload.get("cards", []),
                "facts": facts,
                "meta": {
                    "cached": False,
                    "tokens_in": total_in,
                    "tokens_out": total_out,
                    "latency_ms": total_latency,
                },
            }
            _write_cache(cache_key, payload)
            meta = GenerationMeta(cached=False, tokens_in=total_in, tokens_out=total_out, latency_ms=total_latency)
            return payload, meta
        # If no timeline card could be built, fall back to LLM generation below.

    facts_compact = shrink_for_type(facts, single_type)

    # If type is ORDER, try to deterministically build from timeline
    if single_type == "ORDER":
        order_card = _order_from_timeline(facts) or _order_from_timeline(facts_compact)
        if order_card:
            # Wrap in standard payload
            cards_payload = {"cards": [_sanitize_by_type(_normalize_card_structure(order_card))]}
            valid, errors = validate_cards(cards_payload)
            if valid:
                payload = {
                    "cards": cards_payload.get("cards", []),
                    "facts": facts,
                    "meta": {
                        "cached": False,
                        "tokens_in": 0,
                        "tokens_out": 0,
                        "latency_ms": 0,
                    },
                }
                meta = GenerationMeta(cached=False, tokens_in=0, tokens_out=0, latency_ms=0)
                return payload, meta

    try:
        gen_result = await llm_client.agenerate_one(facts_compact, single_type, difficulty)
    except Exception as primary_exc:
        logger.warning(
            "single-type generation failed for %s; falling back to batch call",
            single_type,
            exc_info=primary_exc,
        )
        try:
            gen_result = await llm_client.agenerate_cards(facts, [single_type], difficulty)
        except Exception as fallback_exc:  # pragma: no cover - safety net
            raise GenerationError(
                [
                    {
                        "code": "llm_invalid_output",
                        "stage": "generate",
                        "message": "single-type generation failed",
                    }
                ]
            ) from fallback_exc
        else:
            logger.info("fallback generator succeeded for %s", single_type)

    generated_cards: List[dict] = []
    if isinstance(gen_result, dict):
        usage = gen_result.get("usage")
        total_in += _usage_tokens(usage, "input_tokens", "prompt_tokens")
        total_out += _usage_tokens(usage, "output_tokens", "completion_tokens")
        total_latency += int(gen_result.get("latency_ms", 0) or 0)
        data_obj = gen_result.get("data")
        if isinstance(data_obj, dict):
            cards_obj = data_obj.get("cards")
            if isinstance(cards_obj, list):
                generated_cards = cards_obj
    elif isinstance(gen_result, LLMResult):
        total_in += gen_result.tokens_in
        total_out += gen_result.tokens_out
        total_latency += gen_result.latency_ms
        data_obj = gen_result.data if isinstance(gen_result.data, dict) else {}
        cards_obj = data_obj.get("cards") if isinstance(data_obj, dict) else []
        if isinstance(cards_obj, list):
            generated_cards = cards_obj

    cards: List[dict] = []
    if isinstance(generated_cards, list):
        for raw_card in generated_cards[:1]:
            normalized_card = _normalize_card_structure(raw_card)
            # MATCH: convert right side to concise noun phrases
            if isinstance(normalized_card, dict) and normalized_card.get("type") == "MATCH":
                normalized_card = _sanitize_match_right(normalized_card)
            normalized_card = _fill_cloze_blanks_from_facts(normalized_card, facts)
            cards.append(_sanitize_by_type(normalized_card))

    cards_payload: Dict[str, object] = {"cards": cards}
    valid, errors = validate_cards(cards_payload)

    if not valid:
        if _apply_local_fixes(cards_payload, errors):
            cards_payload["cards"] = [
                _sanitize_by_type(_fill_cloze_blanks_from_facts(card, facts))
                for card in cards_payload.get("cards", [])
                if isinstance(card, dict)
            ]
            valid, errors = validate_cards(cards_payload)

    if not valid and errors:
        try:
            fix_result = await llm_client.afix_cards(cards_payload, errors[:6])
        except RuntimeError as exc:
            raise GenerationError([
                {"code": "llm_invalid_output", "stage": "fix", "message": "보정 단계에서 JSON 스키마 위반이 발생했습니다."}
            ]) from exc
        total_in += fix_result.tokens_in
        total_out += fix_result.tokens_out
        total_latency += fix_result.latency_ms
        fixed_cards: List[dict] = []
        data_obj = fix_result.data if isinstance(fix_result.data, dict) else {}
        cards_obj = data_obj.get("cards") if isinstance(data_obj, dict) else []
        if isinstance(cards_obj, list):
            for raw_card in cards_obj:
                normalized = _normalize_card_structure(raw_card)
                normalized = _fill_cloze_blanks_from_facts(normalized, facts)
                fixed_cards.append(_sanitize_by_type(normalized))
                if len(fixed_cards) >= 1:
                    break
        if fixed_cards:
            # sanitize MATCH right side
            fixed_cards = [
                _sanitize_match_right(card) if isinstance(card, dict) and card.get("type") == "MATCH" else card
                for card in fixed_cards
            ]
            cards_payload = {"cards": fixed_cards}
        valid, errors = validate_cards(cards_payload)
        if not valid:
            if _apply_local_fixes(cards_payload, errors):
                cards_payload["cards"] = [
                    _sanitize_by_type(_fill_cloze_blanks_from_facts(card, facts))
                    for card in cards_payload.get("cards", [])
                    if isinstance(card, dict)
                ]
                valid, errors = validate_cards(cards_payload)

    if not valid:
        raise GenerationError(errors)

    payload = {
        "cards": cards_payload.get("cards", []),
        "facts": facts,
        "meta": {
            "cached": False,
            "tokens_in": total_in,
            "tokens_out": total_out,
            "latency_ms": total_latency,
        },
    }
    _write_cache(cache_key, payload)

    meta = GenerationMeta(cached=False, tokens_in=total_in, tokens_out=total_out, latency_ms=total_latency)
    return payload, meta
