from __future__ import annotations

import json
from typing import Tuple

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


def json_dumps(data: object) -> str:
    return json.dumps(data, ensure_ascii=False)


def json_loads(data: str) -> dict:
    return json.loads(data)


def paginate(session: Session, stmt: Select, page: int, size: int) -> Tuple[list, int]:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = session.scalar(total_stmt) or 0
    items = session.execute(stmt.limit(size).offset((page - 1) * size)).scalars().all()
    return items, int(total)
