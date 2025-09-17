from __future__ import annotations

from fastapi import HTTPException, status

from .schemas import ImportPayload


def validate_payload(payload: ImportPayload) -> ImportPayload:
    missing = [highlight for highlight in payload.highlights if highlight not in payload.content]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "highlight_not_found",
                "missing": missing,
            },
        )
    return payload
