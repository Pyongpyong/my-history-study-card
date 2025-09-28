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

    highlights: Mapped[list["Highlight"]] = relationship(
        "Highlight", back_populates="content", cascade="all, delete-orphan", passive_deletes=True
    )
    quizzes: Mapped[list["Quiz"]] = relationship(
        "Quiz", back_populates="content", cascade="all, delete-orphan", passive_deletes=True
    )
    owner: Mapped[Optional[User]] = relationship("User", back_populates="contents")


class Highlight(Base):
    __tablename__ = "highlights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content_id: Mapped[int] = mapped_column(Integer, ForeignKey("contents.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    content: Mapped[Content] = relationship("Content", back_populates="highlights")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    content_id: Mapped[int] = mapped_column(Integer, ForeignKey("contents.id", ondelete="CASCADE"), index=True)
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

    content: Mapped[Content] = relationship("Content", back_populates="quizzes")
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
