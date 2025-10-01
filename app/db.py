from __future__ import annotations

import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv, find_dotenv

_dotenv_path = find_dotenv()
if _dotenv_path:
    load_dotenv(_dotenv_path)


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


def _build_mysql_engine() -> URL:
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
    return base_url.set(database=database)


url = _build_mysql_engine()
engine = create_engine(url, echo=False, future=True, pool_pre_ping=True)

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
    _insert_default_card_deck()
    _insert_default_card_style()
    _insert_default_learning_helper()


def _insert_default_card_deck() -> None:
    """기본 카드덱 생성"""
    with engine.begin() as connection:
        result = connection.execute(text("SELECT COUNT(*) as count FROM card_decks WHERE is_default = 1")).fetchone()
        if result and result.count == 0:
            connection.execute(text("""
                INSERT INTO card_decks (name, description, front_image, back_image, is_default, created_at, updated_at)
                VALUES (
                    '기본 카드덱',
                    '기본 카드 앞뒤면 이미지',
                    'card_frame_front.png',
                    'card_frame_back.png',
                    1,
                    NOW(),
                    NOW()
                )
            """))


def _insert_default_card_style() -> None:
    """기본 카드 스타일 생성"""
    with engine.begin() as connection:
        result = connection.execute(text("SELECT COUNT(*) as count FROM card_styles WHERE is_default = 1 AND card_type = 'ALL'")).fetchone()
        if result and result.count == 0:
            connection.execute(text("""
                INSERT INTO card_styles (
                    name, description, card_type, is_default,
                    front_layout, back_layout,
                    front_title_size, front_title_color, front_title_align,
                    front_title_margin_top, front_title_margin_bottom, front_title_margin_left, front_title_margin_right,
                    front_title_background_color, front_title_border_color, front_title_border_width,
                    front_content_size, front_content_color, front_content_align,
                    front_content_margin_top, front_content_margin_bottom, front_content_margin_left, front_content_margin_right,
                    mcq_option_background_color, mcq_option_border_color, mcq_option_border_width, mcq_option_gap,
                    short_input_height, short_input_background_color, short_input_border_color, short_input_border_width,
                    ox_button_o_size, ox_button_o_background_color, ox_button_o_radius, ox_button_o_border_color, ox_button_o_border_width,
                    ox_button_x_size, ox_button_x_background_color, ox_button_x_radius, ox_button_x_border_color, ox_button_x_border_width, ox_button_gap,
                    cloze_input_font_size, cloze_input_background_color, cloze_input_border_color, cloze_input_border_width, cloze_input_underline_color,
                    cloze_button_size, cloze_button_color, cloze_button_font_size,
                    order_item_background_color, order_item_border_color, order_item_border_width, order_item_gap,
                    order_button_size, order_button_color, order_button_font_size,
                    order_guide_align, order_guide_font_size, order_guide_background_color, order_guide_border_color, order_guide_border_width,
                    match_item_background_color, match_item_border_color, match_item_border_width, match_item_gap, match_line_color,
                    match_button_size, match_button_color, match_button_font_size,
                    match_guide_align, match_guide_font_size, match_guide_background_color, match_guide_border_color, match_guide_border_width,
                    back_title_size, back_title_color, back_title_align, back_title_position,
                    back_title_margin_top, back_title_margin_bottom, back_title_margin_left, back_title_margin_right,
                    back_content_size, back_content_color, back_content_align, back_content_position,
                    back_content_margin_top, back_content_margin_bottom, back_content_margin_left, back_content_margin_right,
                    back_button_size, back_button_color, back_button_position, back_button_align,
                    back_button_margin_top, back_button_margin_bottom, back_button_margin_left, back_button_margin_right,
                    created_at, updated_at
                )
                VALUES (
                    '기본 스타일 (전체)',
                    '모든 카드 유형에 적용되는 기본 스타일',
                    'ALL',
                    1,
                    'top', 'center',
                    'text-lg', 'text-primary-600', 'text-center',
                    '0', '16', '0', '0',
                    'bg-white', 'none', 'border',
                    'text-sm', 'text-slate-900', 'text-left',
                    '0', '0', '0', '0',
                    'bg-white', 'none', 'border', '8',
                    'h-12', 'bg-white', 'border-slate-300', 'border',
                    'h-20 w-20 text-xl', 'bg-emerald-700 text-white', 'rounded-full', 'none', 'border',
                    'h-20 w-20 text-xl', 'bg-rose-700 text-white', 'rounded-full', 'none', 'border', '24',
                    'text-base', 'bg-transparent', 'border-primary-500', 'border-b', 'focus:border-primary-500',
                    'px-4 py-2', 'bg-primary-600 text-white', 'text-sm',
                    'bg-white', 'border-slate-300', 'border', '8',
                    'px-4 py-2', 'bg-primary-600 text-white', 'text-sm',
                    'text-left', 'text-xs', 'bg-transparent', 'none', 'border',
                    'bg-white', 'border-slate-200', 'border', '8', 'default',
                    'px-4 py-2', 'bg-primary-600 text-white', 'text-sm',
                    'text-left', 'text-xs', 'bg-transparent', 'none', 'border',
                    'text-lg', 'text-primary-600', 'text-center', 'mb-4',
                    '0', '16', '0', '0',
                    'text-sm', 'text-slate-700', 'text-left', 'mb-4',
                    '0', '0', '0', '0',
                    'px-4 py-2', 'bg-primary-600 text-white', 'mt-auto', 'text-center',
                    '0', '0', '0', '0',
                    NOW(),
                    NOW()
                )
            """))


def _insert_default_learning_helper() -> None:
    """기본 학습 도우미 생성"""
    with engine.begin() as connection:
        result = connection.execute(text("SELECT COUNT(*) as count FROM learning_helpers WHERE level_requirement = 1")).fetchone()
        if result and result.count == 0:
            connection.execute(text("""
                INSERT INTO learning_helpers (name, level_requirement, image_idle, image_correct, image_incorrect, created_at, updated_at)
                VALUES (
                    'Level 1 학습도우미',
                    1,
                    'teacher_01.avif',
                    'teacher_01_o.avif',
                    'teacher_01_x.avif',
                    NOW(),
                    NOW()
                )
            """))
