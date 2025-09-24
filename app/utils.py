from __future__ import annotations

import json
from typing import Tuple


def _strip_leading_markers(text: str) -> str:
    normalized = text.lstrip()
    while normalized and normalized[0] in {"•", "-", "*", "●", "▪"}:
        normalized = normalized[1:].lstrip()
    return normalized


def parse_timeline_entry(raw: str) -> dict[str, str]:
    normalized = _strip_leading_markers(str(raw)).strip()
    separators = [" – ", " — ", " - ", " — ", "–", "—", "-"]
    title = normalized
    description = ""
    for sep in separators:
        if sep in normalized:
            parts = normalized.split(sep, 1)
            left = parts[0].strip()
            right = parts[1].strip()
            if left or right:
                title = left if left else right
                description = right if left else ""
            break
    title = title.strip()
    description = description.strip()
    if not title and description:
        title, description = description, ""
    return {"title": title, "description": description}

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


def json_dumps(data: object) -> str:
    return json.dumps(data, ensure_ascii=False)


def json_loads(data: str) -> dict:
    return json.loads(data)


def safe_json_loads(data: str | None, default):
    if not data:
        return default
    try:
        return json.loads(data)
    except Exception:
        return default


def ensure_list_of_strings(value: object) -> list[str]:
    results: list[str] = []
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                candidate = item.strip()
                if candidate and candidate not in results:
                    results.append(candidate)
    elif isinstance(value, str):
        candidate = value.strip()
        if candidate:
            results.append(candidate)
    return results


def paginate(session: Session, stmt: Select, page: int, size: int) -> Tuple[list, int]:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = session.scalar(total_stmt) or 0
    items = session.execute(stmt.limit(size).offset((page - 1) * size)).scalars().all()
    return items, int(total)
