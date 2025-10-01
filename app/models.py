from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class LearningHelper(Base):
    __tablename__ = "learning_helpers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    level_requirement: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_idle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_correct: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_incorrect: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    users: Mapped[list["User"]] = relationship("User", back_populates="selected_helper")
    sessions: Mapped[list["StudySession"]] = relationship("StudySession", back_populates="helper")


class VisibilityEnum(str, Enum):
    PUBLIC = "PUBLIC"
    PRIVATE = "PRIVATE"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    selected_helper_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("learning_helpers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    contents: Mapped[list["Content"]] = relationship("Content", back_populates="owner")
    quizzes: Mapped[list["Quiz"]] = relationship("Quiz", back_populates="owner")
    study_sessions: Mapped[list["StudySession"]] = relationship("StudySession", back_populates="owner")
    rewards: Mapped[list["Reward"]] = relationship("Reward", back_populates="owner")
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt", 
        back_populates="user",
        cascade="all, delete-orphan"
    )
    selected_helper: Mapped[Optional[LearningHelper]] = relationship("LearningHelper", back_populates="users")


class Content(Base):
    __tablename__ = "contents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    keywords: Mapped[str] = mapped_column(Text, nullable=False, default=lambda: "[]")
    timeline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(Text, nullable=False, default=lambda: "[]")
    eras: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    visibility: Mapped[VisibilityEnum] = mapped_column(
        SqlEnum(VisibilityEnum, name="content_visibility_enum"),
        nullable=False,
        server_default=VisibilityEnum.PUBLIC.value,
        default=VisibilityEnum.PUBLIC,
    )
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    quizzes: Mapped[list["Quiz"]] = relationship(
        "Quiz", back_populates="content", cascade="all, delete-orphan", passive_deletes=True
    )
    owner: Mapped[Optional[User]] = relationship("User", back_populates="contents")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("contents.id", ondelete="CASCADE"), index=True, nullable=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    visibility: Mapped[VisibilityEnum] = mapped_column(
        SqlEnum(VisibilityEnum, name="quiz_visibility_enum"),
        nullable=False,
        server_default=VisibilityEnum.PUBLIC.value,
        default=VisibilityEnum.PUBLIC,
    )
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    content: Mapped[Optional[Content]] = relationship("Content", back_populates="quizzes")
    owner: Mapped[Optional[User]] = relationship("User", back_populates="quizzes")
    tag_links: Mapped[list["QuizTag"]] = relationship(
        "QuizTag",
        back_populates="quiz",
        cascade="all, delete-orphan",
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt", 
        back_populates="quiz",
        cascade="all, delete-orphan"
    )


class CardDeck(Base):
    __tablename__ = "card_decks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    front_image: Mapped[str] = mapped_column(String(255), nullable=False)
    back_image: Mapped[str] = mapped_column(String(255), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sessions: Mapped[list["StudySession"]] = relationship("StudySession", back_populates="card_deck")


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    quiz_ids: Mapped[str] = mapped_column(Text, nullable=False)
    card_payloads: Mapped[str] = mapped_column(Text, nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tags: Mapped[str] = mapped_column(Text, nullable=False, default=lambda: "[]")
    answers: Mapped[str] = mapped_column(Text, nullable=False, default='{}')
    helper_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("learning_helpers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    card_deck_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("card_decks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")

    rewards: Mapped[list["Reward"]] = relationship(
        "Reward",
        secondary="study_session_rewards",
        back_populates="sessions",
    )
    owner: Mapped["User"] = relationship("User", back_populates="study_sessions")
    helper: Mapped[Optional[LearningHelper]] = relationship("LearningHelper", back_populates="sessions")
    card_deck: Mapped[Optional[CardDeck]] = relationship("CardDeck", back_populates="sessions")


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    duration: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")

    sessions: Mapped[list["StudySession"]] = relationship(
        "StudySession",
        secondary="study_session_rewards",
        back_populates="rewards",
    )
    owner: Mapped["User"] = relationship("User", back_populates="rewards")


class StudySessionReward(Base):
    __tablename__ = "study_session_rewards"

    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    reward_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rewards.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quiz_id: Mapped[int] = mapped_column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    points_awarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="quiz_attempts")
    quiz: Mapped["Quiz"] = relationship("Quiz", back_populates="attempts")


class QuizTag(Base):
    __tablename__ = "quiz_tags"
    __table_args__ = (
        Index("idx_quiz_tags_tag", "tag"),
    )

    quiz_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True
    )
    tag: Mapped[str] = mapped_column(String(255), primary_key=True)

    quiz: Mapped[Quiz] = relationship("Quiz", back_populates="tag_links")


class CardStyle(Base):
    __tablename__ = "card_styles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    card_type: Mapped[str] = mapped_column(String(20), nullable=False, default="ALL", server_default="'ALL'")  # MCQ, SHORT, OX, CLOZE, ORDER, MATCH, ALL
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    
    # 앞면 레이아웃 설정
    front_layout: Mapped[str] = mapped_column(String(20), nullable=False, default="top", server_default="'top'")  # top, center, bottom, split
    
    # 앞면 문제 영역 스타일
    front_title_size: Mapped[str] = mapped_column(String(50), nullable=False, default="text-lg", server_default="'text-lg'")
    front_title_color: Mapped[str] = mapped_column(String(50), nullable=False, default="text-primary-600", server_default="'text-primary-600'")
    front_title_align: Mapped[str] = mapped_column(String(50), nullable=False, default="text-center", server_default="'text-center'")
    front_title_margin_top: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    front_title_margin_bottom: Mapped[str] = mapped_column(String(20), nullable=False, default="16", server_default="'16'")
    front_title_margin_left: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    front_title_margin_right: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    front_title_background_color: Mapped[str] = mapped_column(String(50), nullable=False, default="bg-white", server_default="'bg-white'")
    front_title_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="none", server_default="'none'")
    front_title_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    
    # 앞면 답변 영역 스타일
    front_content_size: Mapped[str] = mapped_column(String(50), nullable=False, default="text-sm", server_default="'text-sm'")
    front_content_color: Mapped[str] = mapped_column(String(50), nullable=False, default="text-slate-900", server_default="'text-slate-900'")
    front_content_align: Mapped[str] = mapped_column(String(50), nullable=False, default="text-left", server_default="'text-left'")
    front_content_margin_top: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    front_content_margin_bottom: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    front_content_margin_left: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    front_content_margin_right: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")

    # MCQ 카드 전용
    mcq_option_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    mcq_option_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="none", server_default="'none'")
    mcq_option_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    mcq_option_gap: Mapped[str] = mapped_column(String(20), nullable=False, default="8", server_default="'8'")

    # SHORT 카드 전용
    short_input_height: Mapped[str] = mapped_column(String(30), nullable=False, default="h-12", server_default="'h-12'")
    short_input_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    short_input_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-slate-300", server_default="'border-slate-300'")
    short_input_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    short_button_size: Mapped[str] = mapped_column(String(50), nullable=False, default="px-4 py-2", server_default="'px-4 py-2'")
    short_button_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-primary-600 text-white", server_default="'bg-primary-600 text-white'")
    short_button_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")

    # OX 카드 전용
    ox_button_o_size: Mapped[str] = mapped_column(String(100), nullable=False, default="h-20 w-20 text-xl", server_default="'h-20 w-20 text-xl'")
    ox_button_o_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-emerald-700 text-white", server_default="'bg-emerald-700 text-white'")
    ox_button_o_radius: Mapped[str] = mapped_column(String(50), nullable=False, default="rounded-full", server_default="'rounded-full'")
    ox_button_o_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="none", server_default="'none'")
    ox_button_o_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    ox_button_x_size: Mapped[str] = mapped_column(String(100), nullable=False, default="h-20 w-20 text-xl", server_default="'h-20 w-20 text-xl'")
    ox_button_x_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-rose-700 text-white", server_default="'bg-rose-700 text-white'")
    ox_button_x_radius: Mapped[str] = mapped_column(String(50), nullable=False, default="rounded-full", server_default="'rounded-full'")
    ox_button_x_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="none", server_default="'none'")
    ox_button_x_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    ox_button_gap: Mapped[str] = mapped_column(String(20), nullable=False, default="24", server_default="'24'")

    # CLOZE 카드 전용
    cloze_text_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-base", server_default="'text-base'")
    cloze_text_align: Mapped[str] = mapped_column(String(30), nullable=False, default="justify-center", server_default="'justify-center'")
    cloze_text_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-transparent", server_default="'bg-transparent'")
    cloze_text_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="none", server_default="'none'")
    cloze_text_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    cloze_input_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-base", server_default="'text-base'")
    cloze_input_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-transparent", server_default="'bg-transparent'")
    cloze_input_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-primary-500", server_default="'border-primary-500'")
    cloze_input_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border-b", server_default="'border-b'")
    cloze_input_underline_color: Mapped[str] = mapped_column(String(50), nullable=False, default="focus:border-primary-500", server_default="'focus:border-primary-500'")
    cloze_button_size: Mapped[str] = mapped_column(String(50), nullable=False, default="px-4 py-2", server_default="'px-4 py-2'")
    cloze_button_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-primary-600 text-white", server_default="'bg-primary-600 text-white'")
    cloze_button_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")

    # ORDER 카드 전용
    order_item_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    order_item_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-slate-300", server_default="'border-slate-300'")
    order_item_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    order_item_gap: Mapped[str] = mapped_column(String(20), nullable=False, default="8", server_default="'8'")
    order_button_size: Mapped[str] = mapped_column(String(50), nullable=False, default="px-4 py-2", server_default="'px-4 py-2'")
    order_button_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-primary-600 text-white", server_default="'bg-primary-600 text-white'")
    order_button_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")
    order_guide_align: Mapped[str] = mapped_column(String(30), nullable=False, default="text-left", server_default="'text-left'")
    order_guide_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-xs", server_default="'text-xs'")
    order_guide_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-transparent", server_default="'bg-transparent'")
    order_guide_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="none", server_default="'none'")
    order_guide_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")

    # MATCH 카드 전용
    match_item_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    match_item_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-slate-200", server_default="'border-slate-200'")
    match_item_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    match_item_1_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    match_item_1_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-slate-200", server_default="'border-slate-200'")
    match_item_1_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    match_item_1_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")
    match_item_1_text_align: Mapped[str] = mapped_column(String(30), nullable=False, default="text-left", server_default="'text-left'")
    match_item_2_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    match_item_2_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-slate-200", server_default="'border-slate-200'")
    match_item_2_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    match_item_2_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")
    match_item_2_text_align: Mapped[str] = mapped_column(String(30), nullable=False, default="text-left", server_default="'text-left'")
    match_item_3_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    match_item_3_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-slate-200", server_default="'border-slate-200'")
    match_item_3_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    match_item_3_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")
    match_item_3_text_align: Mapped[str] = mapped_column(String(30), nullable=False, default="text-left", server_default="'text-left'")
    match_item_4_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-white", server_default="'bg-white'")
    match_item_4_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="border-slate-200", server_default="'border-slate-200'")
    match_item_4_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")
    match_item_4_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")
    match_item_4_text_align: Mapped[str] = mapped_column(String(30), nullable=False, default="text-left", server_default="'text-left'")
    match_item_gap: Mapped[str] = mapped_column(String(20), nullable=False, default="8", server_default="'8'")
    match_line_color: Mapped[str] = mapped_column(String(50), nullable=False, default="default", server_default="'default'")
    match_button_size: Mapped[str] = mapped_column(String(50), nullable=False, default="px-4 py-2", server_default="'px-4 py-2'")
    match_button_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-primary-600 text-white", server_default="'bg-primary-600 text-white'")
    match_button_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-sm", server_default="'text-sm'")
    match_guide_align: Mapped[str] = mapped_column(String(30), nullable=False, default="text-left", server_default="'text-left'")
    match_guide_font_size: Mapped[str] = mapped_column(String(30), nullable=False, default="text-xs", server_default="'text-xs'")
    match_guide_background_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-transparent", server_default="'bg-transparent'")
    match_guide_border_color: Mapped[str] = mapped_column(String(50), nullable=False, default="none", server_default="'none'")
    match_guide_border_width: Mapped[str] = mapped_column(String(30), nullable=False, default="border", server_default="'border'")

    # 뒷면 스타일 설정
    back_layout: Mapped[str] = mapped_column(String(20), nullable=False, default="center", server_default="'center'")  # top, center, bottom, split
    
    back_title_size: Mapped[str] = mapped_column(String(50), nullable=False, default="text-lg", server_default="'text-lg'")
    back_title_color: Mapped[str] = mapped_column(String(50), nullable=False, default="text-primary-600", server_default="'text-primary-600'")
    back_title_align: Mapped[str] = mapped_column(String(50), nullable=False, default="text-center", server_default="'text-center'")
    back_title_position: Mapped[str] = mapped_column(String(100), nullable=False, default="mb-4", server_default="'mb-4'")
    back_title_margin_top: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_title_margin_bottom: Mapped[str] = mapped_column(String(20), nullable=False, default="16", server_default="'16'")
    back_title_margin_left: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_title_margin_right: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    
    back_content_size: Mapped[str] = mapped_column(String(50), nullable=False, default="text-sm", server_default="'text-sm'")
    back_content_color: Mapped[str] = mapped_column(String(50), nullable=False, default="text-slate-700", server_default="'text-slate-700'")
    back_content_align: Mapped[str] = mapped_column(String(50), nullable=False, default="text-left", server_default="'text-left'")
    back_content_position: Mapped[str] = mapped_column(String(100), nullable=False, default="mb-4", server_default="'mb-4'")
    back_content_margin_top: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_content_margin_bottom: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_content_margin_left: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_content_margin_right: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    
    back_button_size: Mapped[str] = mapped_column(String(50), nullable=False, default="px-4 py-2", server_default="'px-4 py-2'")
    back_button_color: Mapped[str] = mapped_column(String(100), nullable=False, default="bg-primary-600 text-white", server_default="'bg-primary-600 text-white'")
    back_button_position: Mapped[str] = mapped_column(String(100), nullable=False, default="mt-auto", server_default="'mt-auto'")
    back_button_align: Mapped[str] = mapped_column(String(50), nullable=False, default="text-center", server_default="'text-center'")
    back_button_margin_top: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_button_margin_bottom: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_button_margin_left: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    back_button_margin_right: Mapped[str] = mapped_column(String(20), nullable=False, default="0", server_default="'0'")
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
