from __future__ import annotations

import asyncio
import time
from typing import List, Optional, Dict, Union

from fastapi import APIRouter, Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field, TypeAdapter, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..crud import create_content_with_related, delete_content, get_user_by_api_key
from ..db import SessionLocal
from ..models import Content, User
from ..schemas import CardType, CardUnion, ImportPayload, ImportResponse
from ..services.generate import GenerationError, generate_cards
from ..settings import get_settings
from ..validators import validate_payload


router = APIRouter(prefix="/ai", tags=["ai"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

DEFAULT_TYPES: List[CardType] = ["MCQ", "SHORT", "OX", "CLOZE", "ORDER", "MATCH"]
FOCUS_MODES = {"highlight", "timeline"}
DIFFICULTIES = {"easy", "medium", "hard"}
CARD_LIST_ADAPTER = TypeAdapter(list[CardUnion])  # type: ignore[arg-type]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_optional_user(
    db: Session = Depends(get_db),
    api_key: Optional[str] = Security(api_key_header),
) -> Optional[User]:
    if not api_key:
        return None
    user = get_user_by_api_key(db, api_key)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return user


class GenerateRequest(BaseModel):
    content: str
    highlights: List[str] = Field(default_factory=list)
    types: List[CardType] = Field(default_factory=list)
    difficulty: str = "medium"
    no_cache: bool = False
    focus_mode: str = "highlight"
    timeline: Optional[List[Dict[str, Union[int, str]]]] = Field(default=None)

    @field_validator("difficulty")
    @classmethod
    def check_difficulty(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in DIFFICULTIES:
            raise ValueError("difficulty must be one of easy, medium, hard")
        return normalized

    @field_validator("focus_mode")
    @classmethod
    def check_focus_mode(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in FOCUS_MODES:
            raise ValueError("focus_mode must be one of highlight, timeline")
        return normalized

    @model_validator(mode="after")
    def ensure_types(self) -> "GenerateRequest":
        if not self.types:
            self.types = DEFAULT_TYPES.copy()
        else:
            deduped: List[CardType] = []
            for item in self.types:
                if item not in deduped:
                    deduped.append(item)
            self.types = deduped
        return self


class GenerateAndImportRequest(ImportPayload):
    types: List[CardType] = Field(default_factory=list)
    difficulty: str = "medium"
    upsert: bool = False
    no_cache: bool = False
    focus_mode: str = "highlight"

    @field_validator("difficulty")
    @classmethod
    def check_difficulty(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in DIFFICULTIES:
            raise ValueError("difficulty must be one of easy, medium, hard")
        return normalized

    @field_validator("focus_mode")
    @classmethod
    def check_focus_mode(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in FOCUS_MODES:
            raise ValueError("focus_mode must be one of highlight, timeline")
        return normalized

    @model_validator(mode="after")
    def ensure_types(self) -> "GenerateAndImportRequest":
        if not self.types:
            self.types = DEFAULT_TYPES.copy()
        else:
            deduped: List[CardType] = []
            for item in self.types:
                if item not in deduped:
                    deduped.append(item)
            self.types = deduped
        return self


_RATE_LIMIT_STATE: dict[str, List[float]] = {}
_RATE_LIMIT_LOCK = asyncio.Lock()


async def _enforce_rate_limit(key: str) -> None:
    settings = get_settings()
    window = settings.rate_limit_window_seconds
    quota = settings.rate_limit_quota
    now = time.time()
    async with _RATE_LIMIT_LOCK:
        entries = _RATE_LIMIT_STATE.setdefault(key, [])
        entries[:] = [stamp for stamp in entries if now - stamp < window]
        if len(entries) >= quota:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
        entries.append(now)


def _rate_limit_key(request: Request, user: Optional[User]) -> str:
    if user is not None:
        return f"user:{user.id}"
    host = request.client.host if request.client else "anonymous"
    return f"ip:{host}"


@router.get("/health")
async def health_check() -> dict[str, str]:
    settings = get_settings()
    status_value = "ok" if settings.openai_api_key else "missing_api_key"
    return {
        "status": status_value,
        "extract_model": settings.extract_model,
        "generate_model": settings.generate_model,
        "fix_model": settings.fix_model,
    }


@router.post("/generate")
async def generate_endpoint(
    payload: GenerateRequest,
    request: Request,
    user: Optional[User] = Depends(get_optional_user),
) -> dict[str, object]:
    await _enforce_rate_limit(_rate_limit_key(request, user))
    try:
        result_payload, meta = await generate_cards(
            payload.content,
            payload.highlights,
            list(payload.types),
            payload.difficulty,
            force_refresh=payload.no_cache,
            focus_mode=payload.focus_mode,
            timeline=payload.timeline,
        )
    except GenerationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"errors": exc.errors}) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    result_payload["meta"] = {
        **result_payload.get("meta", {}),
        "cached": meta.cached,
        "tokens_in": meta.tokens_in,
        "tokens_out": meta.tokens_out,
        "latency_ms": meta.latency_ms,
    }
    return result_payload


@router.post("/generate-and-import")
async def generate_and_import_endpoint(
    payload: GenerateAndImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> dict[str, object]:
    await _enforce_rate_limit(_rate_limit_key(request, user))
    try:
        result_payload, meta = await generate_cards(
            payload.content,
            payload.highlights,
            list(payload.types),
            payload.difficulty,
            force_refresh=payload.no_cache,
            focus_mode=payload.focus_mode,
            timeline=payload.timeline,
        )
    except GenerationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"errors": exc.errors}) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    cards_data = result_payload.get("cards", [])
    cards_models = CARD_LIST_ADAPTER.validate_python(cards_data)

    import_payload = ImportPayload(
        title=payload.title,
        content=payload.content,
        highlights=payload.highlights,
        tags=payload.tags,
        taxonomy=payload.taxonomy,
        chronology=payload.chronology,
        cards=cards_models,
        visibility=payload.visibility,
    )
    validate_payload(import_payload)

    if payload.upsert:
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required for upsert")
        stmt = select(Content).where(Content.title == import_payload.title.strip(), Content.owner_id == user.id)
        existing = db.execute(stmt).scalar_one_or_none()
        if existing is not None:
            delete_content(db, existing.id, user)

    content_id, highlight_ids, quiz_ids = create_content_with_related(db, import_payload, user)
    import_response = ImportResponse(
        content_id=content_id,
        highlight_ids=highlight_ids,
        quiz_ids=quiz_ids,
        counts={
            "highlights": len(highlight_ids),
            "quizzes": len(quiz_ids),
            "cards": len(quiz_ids),
        },
    )

    response_payload = {
        **import_response.model_dump(),
        "generated_count": len(cards_data),
        "cards": cards_data,
        "facts": result_payload.get("facts", {}),
        "meta": {
            **result_payload.get("meta", {}),
            "cached": meta.cached,
            "tokens_in": meta.tokens_in,
            "tokens_out": meta.tokens_out,
            "latency_ms": meta.latency_ms,
        },
    }
    return response_payload
