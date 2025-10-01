from __future__ import annotations

from fastapi import HTTPException, status

from .schemas import ImportPayload


def validate_payload(payload: ImportPayload) -> ImportPayload:
    # highlights 필드가 제거되었으므로 검증 로직 제거
    return payload
