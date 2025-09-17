from __future__ import annotations

import os
from pathlib import Path
import sqlite3

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv, find_dotenv

_dotenv_path = find_dotenv()
if _dotenv_path:
    load_dotenv(_dotenv_path)

def _build_sqlite_engine() -> tuple[str, dict | None]:
    base_dir = Path(__file__).resolve().parent
    db_path = base_dir / "app.db"
    return f"sqlite:///{db_path}", {"check_same_thread": False}


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
