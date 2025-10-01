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


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_content_extensions()
    _ensure_card_deck_extensions()
    _ensure_card_style_extensions()


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


def _ensure_card_deck_extensions() -> None:
    """카드덱 테이블 확장 및 기본 데이터 생성"""
    with engine.begin() as connection:
        inspector = inspect(connection)
        
        # 카드덱 테이블이 존재하는지 확인
        if "card_decks" not in inspector.get_table_names():
            return
            
        # 기본 카드덱이 있는지 확인
        result = connection.execute(text("SELECT COUNT(*) as count FROM card_decks WHERE is_default = 1")).fetchone()
        if result and result.count == 0:
            # 기본 카드덱 생성 - MySQL과 SQLite 호환
            is_mysql = connection.dialect.name == 'mysql'
            now_func = "NOW()" if is_mysql else "datetime('now')"
            
            connection.execute(text(f"""
                INSERT INTO card_decks (name, description, front_image, back_image, is_default, created_at, updated_at)
                VALUES (
                    '기본 카드덱',
                    '기본 카드 앞뒤면 이미지',
                    'card_frame_front.png',
                    'card_frame_back.png',
                    1,
                    {now_func},
                    {now_func}
                )
            """))
            
        # study_sessions 테이블에 card_deck_id 컬럼이 있는지 확인
        study_sessions_columns = {column["name"] for column in inspector.get_columns("study_sessions")}
        if "card_deck_id" not in study_sessions_columns:
            connection.execute(text("ALTER TABLE study_sessions ADD COLUMN card_deck_id INTEGER"))
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_study_sessions_card_deck_id 
                ON study_sessions(card_deck_id)
            """))
            
            # 기존 학습 세션들에 기본 카드덱 할당
            default_deck_result = connection.execute(text("SELECT id FROM card_decks WHERE is_default = 1 LIMIT 1")).fetchone()
            if default_deck_result:
                connection.execute(text(f"""
                    UPDATE study_sessions 
                    SET card_deck_id = {default_deck_result.id} 
                    WHERE card_deck_id IS NULL
                """))
        
        # study_sessions 테이블에 is_public 컬럼이 있는지 확인
        if "is_public" not in study_sessions_columns:
            # MySQL과 SQLite 호환 방식으로 컬럼 추가
            is_mysql = connection.dialect.name == 'mysql'
            if is_mysql:
                connection.execute(text("ALTER TABLE study_sessions ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE"))
            else:
                connection.execute(text("ALTER TABLE study_sessions ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0"))
            
            # 기존 학습 세션들은 모두 비공개로 설정
            connection.execute(text("UPDATE study_sessions SET is_public = 0 WHERE is_public IS NULL"))
        
        # quizzes 테이블의 content_id를 nullable로 변경 (독립 퀴즈 지원)
        quizzes_columns = {column["name"] for column in inspector.get_columns("quizzes")}
        if "quizzes" in inspector.get_table_names():
            # SQLite는 ALTER COLUMN을 지원하지 않으므로 테이블 재생성이 필요할 수 있음
            # 하지만 기존 데이터가 있으므로 새로운 독립 퀴즈만 content_id가 NULL이 되도록 함
            # MySQL의 경우 ALTER COLUMN 사용
            if connection.dialect.name == 'mysql':
                try:
                    connection.execute(text("ALTER TABLE quizzes MODIFY COLUMN content_id INTEGER NULL"))
                except Exception as e:
                    print(f"Quiz content_id 마이그레이션 실패 (MySQL): {e}")
            # SQLite의 경우 기존 데이터는 그대로 두고 새로운 퀴즈만 NULL 허용
            # (SQLite는 컬럼 수정이 제한적이므로 애플리케이션 레벨에서 처리)


def _ensure_card_style_extensions() -> None:
    """카드 스타일 테이블 확장 및 기본 데이터 생성"""
    with engine.begin() as connection:
        inspector = inspect(connection)
        
        # 카드 스타일 테이블이 존재하는지 확인
        if "card_styles" not in inspector.get_table_names():
            return
            
        # 새로운 컬럼들 확인 및 추가
        card_styles_columns = {column["name"] for column in inspector.get_columns("card_styles")}
        is_mysql = connection.dialect.name == 'mysql'
        
        # card_type 컬럼 추가
        if "card_type" not in card_styles_columns:
            if is_mysql:
                connection.execute(text("ALTER TABLE card_styles ADD COLUMN card_type VARCHAR(20) NOT NULL DEFAULT 'ALL'"))
            else:
                connection.execute(text("ALTER TABLE card_styles ADD COLUMN card_type TEXT NOT NULL DEFAULT 'ALL'"))
            connection.execute(text("UPDATE card_styles SET card_type = 'ALL' WHERE card_type IS NULL"))
        
        # front_layout 컬럼 추가
        if "front_layout" not in card_styles_columns:
            if is_mysql:
                connection.execute(text("ALTER TABLE card_styles ADD COLUMN front_layout VARCHAR(20) NOT NULL DEFAULT 'top'"))
            else:
                connection.execute(text("ALTER TABLE card_styles ADD COLUMN front_layout TEXT NOT NULL DEFAULT 'top'"))
            connection.execute(text("UPDATE card_styles SET front_layout = 'top' WHERE front_layout IS NULL"))
        
        # 앞면 마진 컬럼들 추가
        front_margin_columns = [
            'front_title_margin_top', 'front_title_margin_bottom', 'front_title_margin_left', 'front_title_margin_right',
            'front_content_margin_top', 'front_content_margin_bottom', 'front_content_margin_left', 'front_content_margin_right'
        ]
        
        for column in front_margin_columns:
            if column not in card_styles_columns:
                if is_mysql:
                    default_value = '16' if 'title' in column and 'bottom' in column else '0'
                    connection.execute(text(f"ALTER TABLE card_styles ADD COLUMN {column} VARCHAR(20) NOT NULL DEFAULT '{default_value}'"))
                else:
                    default_value = '16' if 'title' in column and 'bottom' in column else '0'
                    connection.execute(text(f"ALTER TABLE card_styles ADD COLUMN {column} TEXT NOT NULL DEFAULT '{default_value}'"))
                connection.execute(text(f"UPDATE card_styles SET {column} = '{default_value}' WHERE {column} IS NULL"))
        
        # 뒷면 레이아웃 컬럼 추가
        if "back_layout" not in card_styles_columns:
            if is_mysql:
                connection.execute(text("ALTER TABLE card_styles ADD COLUMN back_layout VARCHAR(20) NOT NULL DEFAULT 'center'"))
            else:
                connection.execute(text("ALTER TABLE card_styles ADD COLUMN back_layout TEXT NOT NULL DEFAULT 'center'"))
            connection.execute(text("UPDATE card_styles SET back_layout = 'center' WHERE back_layout IS NULL"))
        
        # 뒷면 마진 컬럼들 추가
        back_margin_columns = [
            'back_title_margin_top', 'back_title_margin_bottom', 'back_title_margin_left', 'back_title_margin_right',
            'back_content_margin_top', 'back_content_margin_bottom', 'back_content_margin_left', 'back_content_margin_right',
            'back_button_margin_top', 'back_button_margin_bottom', 'back_button_margin_left', 'back_button_margin_right'
        ]
        
        for column in back_margin_columns:
            if column not in card_styles_columns:
                if is_mysql:
                    default_value = '16' if 'title' in column and 'bottom' in column else '0'
                    connection.execute(text(f"ALTER TABLE card_styles ADD COLUMN {column} VARCHAR(20) NOT NULL DEFAULT '{default_value}'"))
                else:
                    default_value = '16' if 'title' in column and 'bottom' in column else '0'
                    connection.execute(text(f"ALTER TABLE card_styles ADD COLUMN {column} TEXT NOT NULL DEFAULT '{default_value}'"))
                connection.execute(text(f"UPDATE card_styles SET {column} = '{default_value}' WHERE {column} IS NULL"))
            
        # 기본 카드 스타일이 있는지 확인
        result = connection.execute(text("SELECT COUNT(*) as count FROM card_styles WHERE is_default = 1 AND card_type = 'ALL'")).fetchone()
        if result and result.count == 0:
            # 기본 카드 스타일 생성 - MySQL과 SQLite 호환
            is_mysql = connection.dialect.name == 'mysql'
            now_func = "NOW()" if is_mysql else "datetime('now')"
            
            connection.execute(text(f"""
                INSERT INTO card_styles (
                    name, description, card_type, is_default,
                    front_title_size, front_title_color, front_title_align, front_title_position,
                    front_content_size, front_content_color, front_content_align, front_content_position,
                    front_button_size, front_button_color, front_button_position, front_button_align,
                    back_title_size, back_title_color, back_title_align, back_title_position,
                    back_content_size, back_content_color, back_content_align, back_content_position,
                    back_button_size, back_button_color, back_button_position, back_button_align,
                    created_at, updated_at
                )
                VALUES (
                    '기본 스타일 (전체)',
                    '모든 카드 유형에 적용되는 기본 스타일',
                    'ALL',
                    1,
                    'text-lg', 'text-primary-600', 'text-center', 'mb-4',
                    'text-sm', 'text-slate-900', 'text-left', 'mb-4',
                    'px-4 py-2', 'bg-primary-600 text-white', 'mt-auto', 'text-center',
                    'text-lg', 'text-primary-600', 'text-center', 'mb-4',
                    'text-sm', 'text-slate-700', 'text-left', 'mb-4',
                    'px-4 py-2', 'bg-primary-600 text-white', 'mt-auto', 'text-center',
                    {now_func},
                    {now_func}
                )
            """))
