from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from .models import Content, Highlight, Quiz, Reward, StudySession
from .schemas import (
    CardUnion,
    ContentOut,
    ContentUpdate,
    Chronology,
    ImportPayload,
    PageMeta,
    QuizOut,
    RewardCreate,
    RewardOut,
    RewardUpdate,
    RewardAssignPayload,
    StudySessionCreate,
    StudySessionOut,
)
from .utils import json_dumps, json_loads


def _normalize_cards(raw_cards: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for item in raw_cards:
        card = dict(item)
        if "attempts" not in card or card["attempts"] is None:
            card["attempts"] = 0
        if "correct" not in card or card["correct"] is None:
            card["correct"] = 0
        normalized.append(card)
    return normalized


def _extract_tags_from_cards(cards: list[dict]) -> list[str]:
    tags: list[str] = []
    for card in cards:
        for tag in card.get("tags", []) or []:
            if not isinstance(tag, str):
                continue
            label = tag.strip()
            if label and label not in tags:
                tags.append(label)
    return tags


def _reward_to_out(reward: Reward) -> RewardOut:
    return RewardOut(
        id=reward.id,
        title=reward.title,
        duration=reward.duration,
        created_at=reward.created_at,
        valid_until=reward.valid_until,
        used=reward.used,
    )


def _study_session_to_out(study: StudySession) -> StudySessionOut:
    cards = _normalize_cards(json_loads(study.card_payloads))
    try:
        tags = json_loads(study.tags) if hasattr(study, "tags") and study.tags else []
    except Exception:
        tags = []
    if not tags:
        tags = _extract_tags_from_cards(cards)
    return StudySessionOut(
        id=study.id,
        title=study.title,
        quiz_ids=json_loads(study.quiz_ids),
        cards=cards,
        created_at=study.created_at,
        updated_at=study.updated_at,
        score=study.score,
        total=study.total,
        completed_at=study.completed_at,
        tags=tags,
        rewards=[_reward_to_out(reward) for reward in getattr(study, "rewards", [])],
    )


def _prune_quizzes_from_sessions(session: Session, quiz_ids_to_remove: set[int]) -> None:
    if not quiz_ids_to_remove:
        return
    studies = session.execute(select(StudySession)).scalars().all()
    for study in studies:
        original_ids: list[int] = json_loads(study.quiz_ids)
        if not any(qid in quiz_ids_to_remove for qid in original_ids):
            continue
        remaining_ids = [qid for qid in original_ids if qid not in quiz_ids_to_remove]
        cards = _normalize_cards(json_loads(study.card_payloads))
        remaining_cards = [card for card in cards if card.get("id") not in quiz_ids_to_remove]
        if remaining_ids:
            normalized_cards = _normalize_cards(remaining_cards)
            study.quiz_ids = json_dumps(remaining_ids)
            study.card_payloads = json_dumps(normalized_cards)
            study.tags = json_dumps(_extract_tags_from_cards(normalized_cards))
            if study.total is not None:
                study.total = min(study.total, len(normalized_cards))
            if study.score is not None:
                study.score = min(study.score, len(normalized_cards))
        else:
            session.delete(study)


def _update_quiz_in_sessions(session: Session, quiz_id: int, card_dict: dict) -> None:
    card_dict = dict(card_dict)
    studies = session.execute(select(StudySession)).scalars().all()
    for study in studies:
        cards = json_loads(study.card_payloads)
        changed = False
        for idx, card in enumerate(cards):
            if card.get("id") != quiz_id:
                continue
            updated_card = {
                **card_dict,
                "id": quiz_id,
                "type": card_dict.get("type"),
                "attempts": card.get("attempts", 0),
                "correct": card.get("correct", 0),
            }
            cards[idx] = updated_card
            changed = True
        if changed:
            normalized_cards = _normalize_cards(cards)
            study.card_payloads = json_dumps(normalized_cards)
            study.tags = json_dumps(_extract_tags_from_cards(normalized_cards))


def create_content_with_related(session: Session, payload: ImportPayload) -> Tuple[int, list[int], list[int]]:
    content = Content(
        title=payload.title.strip(),
        body=payload.content.strip(),
        tags=json_dumps(payload.tags),
        chronology=json_dumps(payload.chronology.model_dump(exclude_none=True))
        if payload.chronology is not None
        else None,
    )
    session.add(content)
    session.flush()

    highlight_models = [Highlight(content_id=content.id, text=text.strip()) for text in payload.highlights]
    if highlight_models:
        session.add_all(highlight_models)

    quiz_models = []
    for card in payload.cards:
        card_dict = card.model_dump(mode="json", exclude_none=True)
        quiz_models.append(Quiz(content_id=content.id, type=card_dict.get("type"), payload=json_dumps(card_dict)))
    if quiz_models:
        session.add_all(quiz_models)

    session.flush()
    highlight_ids = [highlight.id for highlight in highlight_models]
    quiz_ids = [quiz.id for quiz in quiz_models]

    session.commit()
    return content.id, highlight_ids, quiz_ids


def get_content(session: Session, content_id: int) -> Optional[ContentOut]:
    stmt = (
        select(Content)
        .options(selectinload(Content.highlights))
        .where(Content.id == content_id)
    )
    content = session.execute(stmt).scalar_one_or_none()
    if content is None:
        return None
    chronology = json_loads(content.chronology) if content.chronology else None
    chronology_obj: Optional[Chronology] = None
    if chronology is not None:
        chronology_obj = Chronology.model_validate(chronology)
    return ContentOut(
        id=content.id,
        title=content.title,
        content=content.body,
        highlights=[highlight.text for highlight in content.highlights],
        tags=json_loads(content.tags) if content.tags else [],
        chronology=chronology_obj,
        created_at=content.created_at,
    )


def update_content(session: Session, content_id: int, updates: ContentUpdate) -> Optional[ContentOut]:
    content = session.execute(
        select(Content)
        .options(selectinload(Content.highlights))
        .where(Content.id == content_id)
    ).scalar_one_or_none()
    if content is None:
        return None
    data = updates.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        content.title = data["title"].strip()
    if "content" in data and data["content"] is not None:
        content.body = data["content"].strip()
    if "tags" in data and data["tags"] is not None:
        content.tags = json_dumps([tag.strip() for tag in data["tags"] if tag and tag.strip()])
    if "chronology" in data:
        chronology_value = data["chronology"]
        content.chronology = (
            json_dumps(chronology_value.model_dump(exclude_none=True)) if chronology_value is not None else None
        )
    if "highlights" in data and data["highlights"] is not None:
        existing = session.execute(select(Highlight).where(Highlight.content_id == content_id)).scalars().all()
        for highlight in existing:
            session.delete(highlight)
        new_highlights = [text.strip() for text in data["highlights"] if text and text.strip()]
        if new_highlights:
            session.add_all([Highlight(content_id=content_id, text=text) for text in new_highlights])
    session.commit()
    session.refresh(content)
    return get_content(session, content_id)


def list_contents(
    session: Session,
    q: Optional[str],
    page: int,
    size: int,
    order: str,
) -> Tuple[list[ContentOut], int]:
    conditions = []
    if q:
        pattern = f"%{q.lower()}%"
        conditions.append(or_(func.lower(Content.title).like(pattern), func.lower(Content.body).like(pattern)))

    stmt_conditions = conditions[:] if conditions else []

    ordering = {
        "created_desc": Content.created_at.desc(),
        "created_asc": Content.created_at.asc(),
        "title_asc": Content.title.asc(),
        "title_desc": Content.title.desc(),
    }.get(order, Content.created_at.desc())

    count_stmt = select(func.count()).select_from(Content)
    if stmt_conditions:
        count_stmt = count_stmt.where(*stmt_conditions)
    total = session.scalar(count_stmt) or 0

    stmt: Select = select(Content).options(selectinload(Content.highlights))
    if stmt_conditions:
        stmt = stmt.where(*stmt_conditions)
    stmt = stmt.order_by(ordering).offset((page - 1) * size).limit(size)

    items = session.execute(stmt).scalars().all()
    results = []
    for item in items:
        chronology_data = json_loads(item.chronology) if item.chronology else None
        chronology_obj = Chronology.model_validate(chronology_data) if chronology_data is not None else None
        results.append(
            ContentOut(
                id=item.id,
                title=item.title,
                content=item.body,
                highlights=[highlight.text for highlight in item.highlights],
                tags=json_loads(item.tags) if item.tags else [],
                chronology=chronology_obj,
                created_at=item.created_at,
            )
        )
    return results, int(total)


def export_contents(session: Session) -> list[dict]:
    stmt = select(Content).options(selectinload(Content.highlights), selectinload(Content.quizzes))
    contents = session.execute(stmt).scalars().all()
    exported = []
    for item in contents:
        chronology = json_loads(item.chronology) if item.chronology else None
        exported.append(
            {
                "title": item.title,
                "content": item.body,
                "highlights": [highlight.text for highlight in item.highlights],
                "tags": json_loads(item.tags) if item.tags else [],
                "chronology": chronology,
                "cards": [json_loads(quiz.payload) for quiz in item.quizzes],
            }
        )
    return exported


def list_quizzes_by_content(session: Session, content_id: int, page: int, size: int) -> Tuple[list[QuizOut], int]:
    count_stmt = select(func.count()).select_from(Quiz).where(Quiz.content_id == content_id)
    total = session.scalar(count_stmt) or 0
    stmt = (
        select(Quiz)
        .where(Quiz.content_id == content_id)
        .order_by(Quiz.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = session.execute(stmt).scalars().all()
    results = [
        QuizOut(
            id=item.id,
            content_id=item.content_id,
            type=item.type,  # type: ignore[arg-type]
            payload=json_loads(item.payload),
            created_at=item.created_at,
        )
        for item in items
    ]
    return results, int(total)


def list_quizzes(
    session: Session,
    content_id: Optional[int],
    quiz_type: Optional[str],
    page: int,
    size: int,
) -> Tuple[list[QuizOut], int]:
    stmt_conditions = []
    if content_id is not None:
        stmt_conditions.append(Quiz.content_id == content_id)
    if quiz_type is not None:
        stmt_conditions.append(Quiz.type == quiz_type)

    count_stmt = select(func.count()).select_from(Quiz)
    if stmt_conditions:
        count_stmt = count_stmt.where(*stmt_conditions)
    total = session.scalar(count_stmt) or 0

    stmt = select(Quiz)
    if stmt_conditions:
        stmt = stmt.where(*stmt_conditions)
    stmt = stmt.order_by(Quiz.created_at.desc()).offset((page - 1) * size).limit(size)
    items = session.execute(stmt).scalars().all()
    results = [
        QuizOut(
            id=item.id,
            content_id=item.content_id,
            type=item.type,  # type: ignore[arg-type]
            payload=json_loads(item.payload),
            created_at=item.created_at,
        )
        for item in items
    ]
    return results, int(total)


def get_quiz(session: Session, quiz_id: int) -> Optional[QuizOut]:
    quiz = session.get(Quiz, quiz_id)
    if quiz is None:
        return None
    return QuizOut(
        id=quiz.id,
        content_id=quiz.content_id,
        type=quiz.type,  # type: ignore[arg-type]
        payload=json_loads(quiz.payload),
        created_at=quiz.created_at,
    )


def create_quiz_for_content(session: Session, content_id: int, card: CardUnion) -> Optional[QuizOut]:
    content = session.get(Content, content_id)
    if content is None:
        return None
    card_dict = card.model_dump(mode="json", exclude_none=True)
    quiz = Quiz(content_id=content_id, type=card_dict.get("type"), payload=json_dumps(card_dict))
    session.add(quiz)
    session.commit()
    session.refresh(quiz)
    return QuizOut(
        id=quiz.id,
        content_id=quiz.content_id,
        type=quiz.type,  # type: ignore[arg-type]
        payload=card_dict,
        created_at=quiz.created_at,
    )


def delete_content(session: Session, content_id: int) -> bool:
    content = session.get(Content, content_id)
    if content is None:
        return False
    quiz_ids_to_remove = {quiz.id for quiz in content.quizzes}
    _prune_quizzes_from_sessions(session, quiz_ids_to_remove)
    session.delete(content)
    session.commit()
    return True


def create_study_session(session: Session, payload: StudySessionCreate) -> StudySessionOut:
    normalized_cards = _normalize_cards(payload.cards)
    tags = _extract_tags_from_cards(normalized_cards)
    study = StudySession(
        title=payload.title.strip(),
        quiz_ids=json_dumps(payload.quiz_ids),
        card_payloads=json_dumps(normalized_cards),
        tags=json_dumps(tags),
    )
    session.add(study)
    session.commit()
    session.refresh(study)
    return _study_session_to_out(study)


def get_study_session(session: Session, session_id: int) -> Optional[StudySessionOut]:
    study = session.execute(
        select(StudySession)
        .options(selectinload(StudySession.rewards))
        .where(StudySession.id == session_id)
    ).scalar_one_or_none()
    if study is None:
        return None
    return _study_session_to_out(study)


def list_study_sessions(session: Session, page: int, size: int) -> tuple[list[StudySessionOut], int]:
    count_stmt = select(func.count()).select_from(StudySession)
    total = session.scalar(count_stmt) or 0
    stmt = (
        select(StudySession)
        .options(selectinload(StudySession.rewards))
        .order_by(StudySession.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = session.execute(stmt).scalars().all()
    results = [_study_session_to_out(item) for item in items]
    return results, int(total)


def update_study_session(session: Session, session_id: int, updates: dict) -> Optional[StudySessionOut]:
    study = session.get(StudySession, session_id)
    if study is None:
        return None
    if "title" in updates:
        study.title = updates["title"].strip()
    if "quiz_ids" in updates and updates["quiz_ids"] is not None:
        study.quiz_ids = json_dumps(updates["quiz_ids"])
    if "cards" in updates and updates["cards"] is not None:
        normalized = _normalize_cards(updates["cards"])
        study.card_payloads = json_dumps(normalized)
        study.tags = json_dumps(_extract_tags_from_cards(normalized))
    if "score" in updates:
        study.score = updates["score"]
    if "total" in updates:
        study.total = updates["total"]
    if "completed_at" in updates:
        study.completed_at = updates["completed_at"]
    session.commit()
    session.refresh(study)
    return _study_session_to_out(study)


def delete_study_session(session: Session, session_id: int) -> bool:
    study = session.get(StudySession, session_id)
    if study is None:
        return False
    session.delete(study)
    session.commit()
    return True


def create_reward(session: Session, payload: RewardCreate) -> RewardOut:
    reward = Reward(
        title=payload.title.strip(),
        duration=payload.duration.strip(),
        valid_until=payload.valid_until,
    )
    session.add(reward)
    session.commit()
    session.refresh(reward)
    return _reward_to_out(reward)


def list_rewards(session: Session) -> list[RewardOut]:
    stmt = select(Reward).order_by(Reward.created_at.desc())
    rewards = session.execute(stmt).scalars().all()
    return [_reward_to_out(item) for item in rewards]


def update_reward(session: Session, reward_id: int, updates: RewardUpdate) -> Optional[RewardOut]:
    reward = session.get(Reward, reward_id)
    if reward is None:
        return None
    data = updates.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        reward.title = data["title"].strip()
    if "duration" in data and data["duration"] is not None:
        reward.duration = data["duration"].strip()
    if "valid_until" in data:
        reward.valid_until = data["valid_until"]
    if "used" in data:
        reward.used = bool(data["used"])
    session.commit()
    session.refresh(reward)
    return _reward_to_out(reward)


def add_reward_to_session(session: Session, session_id: int, payload: RewardAssignPayload) -> Optional[StudySessionOut]:
    study = session.execute(
        select(StudySession)
        .options(selectinload(StudySession.rewards))
        .where(StudySession.id == session_id)
    ).scalar_one_or_none()
    if study is None:
        return None
    reward = session.get(Reward, payload.reward_id)
    if reward is None:
        return None
    if reward not in study.rewards:
        study.rewards.append(reward)
        session.commit()
        session.refresh(study)
    return _study_session_to_out(study)


def delete_reward(session: Session, reward_id: int) -> bool:
    reward = session.get(Reward, reward_id)
    if reward is None:
        return False
    for study in list(reward.sessions):
        if reward in study.rewards:
            study.rewards.remove(reward)
    session.delete(reward)
    session.commit()
    return True


def delete_quiz(session: Session, quiz_id: int) -> bool:
    quiz = session.get(Quiz, quiz_id)
    if quiz is None:
        return False
    _prune_quizzes_from_sessions(session, {quiz_id})
    session.delete(quiz)
    session.commit()
    return True


def update_quiz(session: Session, quiz_id: int, card: CardUnion) -> Optional[QuizOut]:
    quiz = session.get(Quiz, quiz_id)
    if quiz is None:
        return None
    card_dict = card.model_dump(mode="json", exclude_none=True)
    quiz.type = card_dict.get("type")
    quiz.payload = json_dumps(card_dict)
    _update_quiz_in_sessions(session, quiz_id, card_dict)
    session.commit()
    session.refresh(quiz)
    return QuizOut(
        id=quiz.id,
        content_id=quiz.content_id,
        type=quiz.type,  # type: ignore[arg-type]
        payload=card_dict,
        created_at=quiz.created_at,
    )
