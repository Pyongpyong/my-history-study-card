from __future__ import annotations

import os
from pathlib import Path
import sqlite3

from sqlalchemy import create_engine, event, text, inspect
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv, find_dotenv

from .utils import json_dumps, safe_json_loads

_dotenv_path = find_dotenv()
if _dotenv_path:
    load_dotenv(_dotenv_path)

DB_PATH = Path(__file__).resolve().parent / "app.db"

def _build_sqlite_engine() -> tuple[str, dict | None]:
    return f"sqlite:///{DB_PATH}", {"check_same_thread": False}


def _create_mysql_database_if_needed(base_url: URL, database: str) -> None:
    tmp_engine = create_engine(base_url, future=True, pool_pre_ping=True)
    with tmp_engine.connect() as conn:
        safe_db = database.replace("`", "``")
        conn.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS `{safe_db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        )
    tmp_engine.dispose()


def _build_mysql_engine() -> tuple[URL, dict | None]:
    host = os.getenv("MYSQL_HOST")
    user = os.getenv("MYSQL_USER")
    password = os.getenv("MYSQL_PASS")
    database = os.getenv("MYSQL_DB")
    port = os.getenv("MYSQL_PORT", "3306")

    if not all([host, user, database]):
        raise ValueError("MYSQL_HOST, MYSQL_USER, and MYSQL_DB must be set to use MySQL.")

    base_url = URL.create(
        "mysql+pymysql",
        username=user,
        password=password or "",
        host=host,
        port=int(port) if port else None,
        database=None,
        query={"charset": "utf8mb4"},
    )

    _create_mysql_database_if_needed(base_url, database)
    return base_url.set(database=database), None


def _get_engine() -> tuple[create_engine, bool]:
    if os.getenv("MYSQL_HOST"):
        url, connect_args = _build_mysql_engine()
        engine = create_engine(url, echo=False, future=True, pool_pre_ping=True)
        return engine, False

    sqlite_url, connect_args = _build_sqlite_engine()
    engine = create_engine(
        sqlite_url,
        echo=False,
        future=True,
        connect_args=connect_args or {},
    )
    return engine, True


engine, is_sqlite = _get_engine()


if is_sqlite:

    @event.listens_for(engine, "connect")
    def enable_sqlite_fk(dbapi_connection, connection_record):  # pragma: no cover - simple hook
        if isinstance(dbapi_connection, sqlite3.Connection):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_content_extensions()


def _ensure_content_extensions() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "contents" not in inspector.get_table_names():
            return
        existing_columns = {column["name"] for column in inspector.get_columns("contents")}
        if "tags" in existing_columns:
            _migrate_content_tags_to_keywords(connection)
            _drop_content_tags_column(connection)
            existing_columns.discard("tags")
        if "keywords" not in existing_columns:
            connection.execute(text("ALTER TABLE contents ADD COLUMN keywords TEXT NOT NULL DEFAULT '[]'"))
            connection.execute(text("UPDATE contents SET keywords = '[]' WHERE keywords IS NULL"))
        if "timeline" not in existing_columns:
            connection.execute(text("ALTER TABLE contents ADD COLUMN timeline TEXT"))
        if "category" not in existing_columns:
            connection.execute(text("ALTER TABLE contents ADD COLUMN category TEXT"))
        else:
            connection.execute(text(
                "UPDATE contents SET category = '[]' WHERE category IS NULL"
            ))
        if "eras" not in existing_columns:
            connection.execute(text("ALTER TABLE contents ADD COLUMN eras TEXT"))
        connection.execute(text("UPDATE contents SET eras = '[]' WHERE eras IS NULL"))


def _migrate_content_tags_to_keywords(connection) -> None:
    rows = connection.execute(text("SELECT id, tags, keywords FROM contents")).mappings().all()
    for row in rows:
        existing_keywords = safe_json_loads(row.get("keywords"), [])
        legacy_tags = safe_json_loads(row.get("tags"), [])
        if not legacy_tags:
            continue
        combined: list[str] = []
        for value in existing_keywords + legacy_tags:
            if isinstance(value, str):
                candidate = value.strip()
                if candidate and candidate not in combined:
                    combined.append(candidate)
        if combined and combined != existing_keywords:
            connection.execute(
                text("UPDATE contents SET keywords = :keywords WHERE id = :id"),
                {"keywords": json_dumps(combined), "id": row["id"]},
            )


def _drop_content_tags_column(connection) -> None:
    try:
        connection.execute(text("ALTER TABLE contents DROP COLUMN tags"))
    except Exception:
        if engine.dialect.name != "sqlite":
            raise
        _rebuild_sqlite_contents_without_tags(connection)


def _rebuild_sqlite_contents_without_tags(connection) -> None:
    connection.execute(text("ALTER TABLE contents RENAME TO contents_backup"))
    from .models import Content  # Imported lazily to avoid circular imports

    Content.__table__.create(bind=connection)

    columns = [
        "id",
        "title",
        "body",
        "keywords",
        "timeline",
        "chronology",
        "category",
        "eras",
        "visibility",
        "owner_id",
        "created_at",
        "updated_at",
    ]
    column_list = ", ".join(columns)
    connection.execute(
        text(
            f"INSERT INTO contents ({column_list}) SELECT {column_list} FROM contents_backup"
        )
    )
    connection.execute(text("DROP TABLE contents_backup"))
