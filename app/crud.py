from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from .models import Content, Highlight, Quiz, Reward, StudySession, User, VisibilityEnum
from .schemas import (
    CardUnion,
    ContentOut,
    ContentUpdate,
    Chronology,
    ImportPayload,
    EraEntry,
    TimelineEntry,
    PageMeta,
    QuizOut,
    RewardCreate,
    RewardOut,
    RewardUpdate,
    RewardAssignPayload,
    StudySessionCreate,
    StudySessionOut,
)
from .utils import (
    json_dumps,
    json_loads,
    parse_timeline_entry,
    safe_json_loads,
    ensure_list_of_strings,
)


def _serialize_timeline(entries: list[TimelineEntry]) -> str | None:
    if not entries:
        return None
    payload = [entry.model_dump(exclude_none=True) for entry in entries if entry.title]
    return json_dumps(payload) if payload else None


def _deserialize_timeline(raw: str | None) -> list[TimelineEntry]:
    if not raw:
        return []
    try:
        data = json_loads(raw)
    except Exception:
        return []
    entries: list[TimelineEntry] = []
    for item in data:
        if isinstance(item, dict):
            title = str(item.get("title", "")).strip()
            description = str(item.get("description", "")).strip()
            if not title and description:
                title, description = description, ""
            if title:
                entries.append(TimelineEntry(title=title, description=description))
        elif isinstance(item, str):
            entry_dict = parse_timeline_entry(item)
            if entry_dict["title"]:
                entries.append(TimelineEntry(**entry_dict))
    return entries


def _serialize_eras(entries: list[EraEntry]) -> str | None:
    payload = [entry.model_dump(exclude_none=True) for entry in entries if entry.period]
    return json_dumps(payload)


def _deserialize_eras(raw: str | None) -> list[EraEntry]:
    if not raw:
        return []
    data = safe_json_loads(raw, [])
    entries: list[EraEntry] = []
    for item in data:
        if isinstance(item, dict):
            try:
                entries.append(EraEntry.model_validate(item))
            except Exception:
                continue
    return entries


def _serialize_categories(categories: list[str]) -> str:
    normalized = [item.strip() for item in categories if item and item.strip()]
    unique: list[str] = []
    for item in normalized:
        if item not in unique:
            unique.append(item)
    return json_dumps(unique)


def _deserialize_categories(raw: str | None) -> list[str]:
    if not raw:
        return []
    data = safe_json_loads(raw, None)
    if data is None:
        data = raw
    return ensure_list_of_strings(data)


def _normalize_visibility(raw_value: Optional[str | VisibilityEnum], default: VisibilityEnum = VisibilityEnum.PUBLIC) -> VisibilityEnum:
    if raw_value is None:
        return default
    if isinstance(raw_value, VisibilityEnum):
        return raw_value
    candidate = str(raw_value).strip().upper()
    try:
        return VisibilityEnum(candidate)
    except ValueError as exc:  # pragma: no cover - validation handled upstream
        raise ValueError(f"Invalid visibility value: {raw_value}") from exc


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
        owner_id=reward.owner_id,
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
        owner_id=study.owner_id,
    )


def _prune_quizzes_from_sessions(session: Session, quiz_ids_to_remove: set[int], owner_id: int) -> None:
    if not quiz_ids_to_remove:
        return
    studies = session.execute(select(StudySession).where(StudySession.owner_id == owner_id)).scalars().all()
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


def _update_quiz_in_sessions(session: Session, quiz_id: int, card_dict: dict, owner_id: int) -> None:
    card_dict = dict(card_dict)
    studies = session.execute(select(StudySession).where(StudySession.owner_id == owner_id)).scalars().all()
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


def create_content_with_related(
    session: Session,
    payload: ImportPayload,
    owner: Optional[User] = None,
) -> Tuple[int, list[int], list[int]]:
    default_visibility = VisibilityEnum.PRIVATE if owner is not None else VisibilityEnum.PUBLIC
    content_visibility = _normalize_visibility(getattr(payload, "visibility", None), default_visibility)
    keywords = list(payload.keywords)
    extra_tags = getattr(payload, "tags", [])
    for tag in extra_tags:
        if tag not in keywords:
            keywords.append(tag)

    content = Content(
        title=payload.title.strip(),
        body=payload.content.strip(),
        keywords=json_dumps(keywords),
        chronology=json_dumps(payload.chronology.model_dump(exclude_none=True))
        if payload.chronology is not None
        else None,
        timeline=_serialize_timeline(payload.timeline),
        category=_serialize_categories(payload.categories),
        eras=_serialize_eras(payload.eras),
        visibility=content_visibility,
        owner_id=owner.id if owner is not None else None,
    )
    session.add(content)
    session.flush()

    highlight_models = [Highlight(content_id=content.id, text=text.strip()) for text in payload.highlights]
    if highlight_models:
        session.add_all(highlight_models)

    quiz_models = []
    for card in payload.cards:
        card_dict = card.model_dump(mode="json", exclude_none=True)
        quiz_visibility = _normalize_visibility(card_dict.pop("visibility", None), content_visibility)
        quiz_models.append(
            Quiz(
                content_id=content.id,
                type=card_dict.get("type"),
                payload=json_dumps(card_dict),
                visibility=quiz_visibility,
                owner_id=owner.id if owner is not None else None,
            )
        )
    if quiz_models:
        session.add_all(quiz_models)

    session.flush()
    highlight_ids = [highlight.id for highlight in highlight_models]
    quiz_ids = [quiz.id for quiz in quiz_models]

    session.commit()
    return content.id, highlight_ids, quiz_ids


def get_content(
    session: Session,
    content_id: int,
    requester: Optional[User] = None,
) -> Optional[ContentOut]:
    stmt = (
        select(Content)
        .options(selectinload(Content.highlights))
        .where(Content.id == content_id)
    )
    content = session.execute(stmt).scalar_one_or_none()
    if content is None:
        return None
    is_admin = bool(requester and requester.is_admin)
    if content.visibility == VisibilityEnum.PRIVATE and not is_admin and (requester is None or content.owner_id != requester.id):
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
        keywords=json_loads(content.keywords) if content.keywords else [],
        chronology=chronology_obj,
        timeline=_deserialize_timeline(content.timeline),
        categories=_deserialize_categories(content.category),
        eras=_deserialize_eras(content.eras),
        created_at=content.created_at,
        visibility=content.visibility.value,
        owner_id=content.owner_id,
    )


def update_content(
    session: Session,
    content_id: int,
    updates: ContentUpdate,
    requester: User,
) -> Optional[ContentOut]:
    content = session.execute(
        select(Content)
        .options(selectinload(Content.highlights))
        .where(Content.id == content_id)
    ).scalar_one_or_none()
    if content is None:
        return None
    is_admin = bool(requester.is_admin)
    if content.owner_id is None:
        content.owner_id = requester.id
    elif content.owner_id != requester.id and not is_admin:
        return None
    data = updates.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        content.title = data["title"].strip()
    if "content" in data and data["content"] is not None:
        content.body = data["content"].strip()
    if "keywords" in data and data["keywords"] is not None:
        content.keywords = json_dumps([keyword.strip() for keyword in data["keywords"] if keyword and keyword.strip()])
    if "chronology" in data:
        chronology_value = data["chronology"]
        if chronology_value is None:
            content.chronology = None
        else:
            if isinstance(chronology_value, dict):
                chronology_value = Chronology.model_validate(chronology_value)
            content.chronology = json_dumps(chronology_value.model_dump(exclude_none=True))
    if "timeline" in data:
        timeline_value = data["timeline"]
        if timeline_value is None:
            content.timeline = None
        else:
            entries: list[TimelineEntry] = []
            for item in timeline_value:
                if isinstance(item, TimelineEntry):
                    entries.append(item)
                elif isinstance(item, dict):
                    entries.append(TimelineEntry.model_validate(item))
                else:
                    entry_dict = parse_timeline_entry(str(item))
                    if entry_dict["title"]:
                        entries.append(TimelineEntry(**entry_dict))
            content.timeline = _serialize_timeline(entries)
    if "category" in data and data["category"] is not None:
        single_category = [item.strip() for item in ensure_list_of_strings(data["category"]) if item.strip()]
        content.category = _serialize_categories(single_category)
    if "categories" in data and data["categories"] is not None:
        content.category = _serialize_categories(data["categories"])
    if "eras" in data:
        eras_value = data["eras"]
        if eras_value is None:
            content.eras = None
        else:
            entries: list[EraEntry] = []
            for item in eras_value:
                if isinstance(item, EraEntry):
                    entries.append(item)
                elif isinstance(item, dict):
                    entries.append(EraEntry.model_validate(item))
            content.eras = _serialize_eras(entries)
    if "visibility" in data and data["visibility"] is not None:
        content.visibility = _normalize_visibility(data["visibility"], content.visibility)
    if "highlights" in data and data["highlights"] is not None:
        existing = session.execute(select(Highlight).where(Highlight.content_id == content_id)).scalars().all()
        for highlight in existing:
            session.delete(highlight)
        new_highlights = [text.strip() for text in data["highlights"] if text and text.strip()]
        if new_highlights:
            session.add_all([Highlight(content_id=content_id, text=text) for text in new_highlights])
    session.commit()
    session.refresh(content)
    return get_content(session, content_id, requester)


def list_contents(
    session: Session,
    q: Optional[str],
    page: int,
    size: int,
    order: str,
    requester: Optional[User],
) -> Tuple[list[ContentOut], int]:
    conditions = []
    is_admin = bool(requester and requester.is_admin)
    if q:
        pattern = f"%{q.lower()}%"
        conditions.append(or_(func.lower(Content.title).like(pattern), func.lower(Content.body).like(pattern)))

    if not is_admin:
        if requester is None:
            conditions.append(Content.visibility == VisibilityEnum.PUBLIC)
        else:
            conditions.append(or_(Content.visibility == VisibilityEnum.PUBLIC, Content.owner_id == requester.id))

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
                keywords=json_loads(item.keywords) if item.keywords else [],
                chronology=chronology_obj,
                timeline=_deserialize_timeline(item.timeline),
                categories=_deserialize_categories(item.category),
                eras=_deserialize_eras(item.eras),
                created_at=item.created_at,
                visibility=item.visibility.value,
                owner_id=item.owner_id,
            )
        )
    return results, int(total)


def export_contents(session: Session, requester: Optional[User]) -> list[dict]:
    stmt = select(Content).options(selectinload(Content.highlights), selectinload(Content.quizzes))
    if requester is None:
        stmt = stmt.where(Content.visibility == VisibilityEnum.PUBLIC)
    else:
        stmt = stmt.where(or_(Content.visibility == VisibilityEnum.PUBLIC, Content.owner_id == requester.id))
    contents = session.execute(stmt).scalars().all()
    exported = []
    for item in contents:
        chronology = json_loads(item.chronology) if item.chronology else None
        exported.append(
            {
                "title": item.title,
                "content": item.body,
                "highlights": [highlight.text for highlight in item.highlights],
                "keywords": json_loads(item.keywords) if item.keywords else [],
                "chronology": chronology,
                "timeline": [entry.model_dump(exclude_none=True) for entry in _deserialize_timeline(item.timeline)],
                "categories": _deserialize_categories(item.category),
                "eras": [entry.model_dump(exclude_none=True) for entry in _deserialize_eras(item.eras)],
                "visibility": item.visibility.value,
                "cards": [json_loads(quiz.payload) | {"visibility": quiz.visibility.value} for quiz in item.quizzes],
            }
        )
    return exported


def list_quizzes_by_content(
    session: Session,
    content_id: int,
    page: int,
    size: int,
    requester: Optional[User],
) -> Tuple[list[QuizOut], int]:
    content = session.get(Content, content_id)
    if content is None:
        return [], 0
    is_owner = requester is not None and content.owner_id == requester.id
    is_admin = bool(requester and requester.is_admin)
    if content.visibility == VisibilityEnum.PRIVATE and not (is_owner or is_admin):
        return [], 0

    conditions = [Quiz.content_id == content_id]
    if not (is_owner or is_admin):
        conditions.append(Quiz.visibility == VisibilityEnum.PUBLIC)

    count_stmt = select(func.count()).select_from(Quiz)
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = session.scalar(count_stmt) or 0

    stmt = select(Quiz)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(Quiz.created_at.desc()).offset((page - 1) * size).limit(size)

    items = session.execute(stmt).scalars().all()
    results = [
        QuizOut(
            id=item.id,
            content_id=item.content_id,
            type=item.type,  # type: ignore[arg-type]
            payload=json_loads(item.payload),
            created_at=item.created_at,
            visibility=item.visibility.value,
            owner_id=item.owner_id,
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
    requester: Optional[User],
) -> Tuple[list[QuizOut], int]:
    is_admin = bool(requester and requester.is_admin)
    conditions = []
    if content_id is not None:
        content = session.get(Content, content_id)
        if content is None:
            return [], 0
        if not is_admin and content.visibility == VisibilityEnum.PRIVATE and (
            requester is None or content.owner_id != requester.id
        ):
            if requester is None:
                return [], 0
            conditions.append(or_(Quiz.owner_id == requester.id, Quiz.visibility == VisibilityEnum.PUBLIC))
        conditions.append(Quiz.content_id == content_id)

    if quiz_type is not None:
        conditions.append(Quiz.type == quiz_type)

    base_count = select(func.count()).select_from(Quiz).join(Content, Quiz.content_id == Content.id)
    base_query = select(Quiz).join(Content, Quiz.content_id == Content.id)

    if not is_admin:
        if requester is None:
            quiz_visibility_clause = Quiz.visibility == VisibilityEnum.PUBLIC
            content_visibility_clause = or_(Content.visibility == VisibilityEnum.PUBLIC, Quiz.visibility == VisibilityEnum.PUBLIC)
        else:
            quiz_visibility_clause = or_(Quiz.visibility == VisibilityEnum.PUBLIC, Quiz.owner_id == requester.id)
            content_visibility_clause = or_(
                Content.visibility == VisibilityEnum.PUBLIC,
                Content.owner_id == requester.id,
                Quiz.owner_id == requester.id,
                Quiz.visibility == VisibilityEnum.PUBLIC,
            )
        base_count = base_count.where(quiz_visibility_clause, content_visibility_clause)
        base_query = base_query.where(quiz_visibility_clause, content_visibility_clause)

    if conditions:
        base_count = base_count.where(*conditions)
        base_query = base_query.where(*conditions)

    count_stmt = base_count
    total = session.scalar(count_stmt) or 0

    stmt = base_query.order_by(Quiz.created_at.desc()).offset((page - 1) * size).limit(size)
    items = session.execute(stmt).scalars().all()
    results = [
        QuizOut(
            id=item.id,
            content_id=item.content_id,
            type=item.type,  # type: ignore[arg-type]
            payload=json_loads(item.payload),
            created_at=item.created_at,
            visibility=item.visibility.value,
            owner_id=item.owner_id,
        )
        for item in items
    ]
    return results, int(total)


def get_quiz(session: Session, quiz_id: int, requester: Optional[User]) -> Optional[QuizOut]:
    quiz = session.execute(
        select(Quiz)
        .options(selectinload(Quiz.content))
        .where(Quiz.id == quiz_id)
    ).scalar_one_or_none()
    if quiz is None:
        return None
    content = quiz.content
    content_owner_id = content.owner_id if content is not None else None
    is_owner = requester is not None and (
        quiz.owner_id == requester.id or (content_owner_id is not None and content_owner_id == requester.id)
    )
    is_admin = bool(requester and requester.is_admin)
    if quiz.visibility == VisibilityEnum.PRIVATE and not (is_owner or is_admin):
        return None
    if (
        content is not None
        and content.visibility == VisibilityEnum.PRIVATE
        and not (is_owner or is_admin or quiz.visibility == VisibilityEnum.PUBLIC)
    ):
        return None
    return QuizOut(
        id=quiz.id,
        content_id=quiz.content_id,
        type=quiz.type,  # type: ignore[arg-type]
        payload=json_loads(quiz.payload),
        created_at=quiz.created_at,
        visibility=quiz.visibility.value,
        owner_id=quiz.owner_id,
    )


def create_quiz_for_content(
    session: Session,
    content_id: int,
    card: CardUnion,
    requester: User,
) -> Optional[QuizOut]:
    content = session.get(Content, content_id)
    if content is None or content.owner_id != requester.id:
        return None
    card_dict = card.model_dump(mode="json", exclude_none=True)
    quiz_visibility = _normalize_visibility(card_dict.pop("visibility", None), content.visibility)
    quiz = Quiz(
        content_id=content_id,
        type=card_dict.get("type"),
        payload=json_dumps(card_dict),
        visibility=quiz_visibility,
        owner_id=requester.id,
    )
    session.add(quiz)
    session.commit()
    session.refresh(quiz)
    return QuizOut(
        id=quiz.id,
        content_id=quiz.content_id,
        type=quiz.type,  # type: ignore[arg-type]
        payload=card_dict,
        created_at=quiz.created_at,
        visibility=quiz.visibility.value,
        owner_id=quiz.owner_id,
    )


def delete_content(session: Session, content_id: int, requester: User) -> bool:
    content = session.get(Content, content_id)
    if content is None or content.owner_id != requester.id:
        return False
    quiz_ids_to_remove = {quiz.id for quiz in content.quizzes}
    _prune_quizzes_from_sessions(session, quiz_ids_to_remove, requester.id)
    session.delete(content)
    session.commit()
    return True


def _user_can_access_quiz(quiz: Quiz, owner: User) -> bool:
    content = quiz.content
    if quiz.owner_id == owner.id:
        return True
    if content is not None and content.owner_id == owner.id:
        return True
    if quiz.visibility == VisibilityEnum.PUBLIC and (content is None or content.visibility == VisibilityEnum.PUBLIC):
        return True
    return False


def create_study_session(
    session: Session,
    payload: StudySessionCreate,
    owner: User,
) -> Optional[StudySessionOut]:
    normalized_cards = _normalize_cards(payload.cards)
    tags = _extract_tags_from_cards(normalized_cards)
    quizzes = (
        session.execute(
            select(Quiz)
            .options(selectinload(Quiz.content))
            .where(Quiz.id.in_(payload.quiz_ids))
        )
        .scalars()
        .all()
    )
    if len(quizzes) != len(set(payload.quiz_ids)):
        return None
    for quiz in quizzes:
        if not _user_can_access_quiz(quiz, owner):
            return None
    study = StudySession(
        title=payload.title.strip(),
        quiz_ids=json_dumps(payload.quiz_ids),
        card_payloads=json_dumps(normalized_cards),
        tags=json_dumps(tags),
        owner_id=owner.id,
    )
    session.add(study)
    session.commit()
    session.refresh(study)
    return _study_session_to_out(study)


def get_study_session(session: Session, session_id: int, owner: User) -> Optional[StudySessionOut]:
    study = session.execute(
        select(StudySession)
        .options(selectinload(StudySession.rewards))
        .where(StudySession.id == session_id, StudySession.owner_id == owner.id)
    ).scalar_one_or_none()
    if study is None:
        return None
    return _study_session_to_out(study)


def list_study_sessions(session: Session, page: int, size: int, owner: User) -> tuple[list[StudySessionOut], int]:
    count_stmt = select(func.count()).select_from(StudySession).where(StudySession.owner_id == owner.id)
    total = session.scalar(count_stmt) or 0
    stmt = (
        select(StudySession)
        .options(selectinload(StudySession.rewards))
        .where(StudySession.owner_id == owner.id)
        .order_by(StudySession.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    items = session.execute(stmt).scalars().all()
    results = [_study_session_to_out(item) for item in items]
    return results, int(total)


def update_study_session(
    session: Session,
    session_id: int,
    updates: dict,
    owner: User,
) -> Optional[StudySessionOut]:
    study = session.get(StudySession, session_id)
    if study is None or study.owner_id != owner.id:
        return None
    if "title" in updates and updates["title"] is not None:
        study.title = updates["title"].strip()
    if "quiz_ids" in updates and updates["quiz_ids"] is not None:
        new_quiz_ids = updates["quiz_ids"]
        quizzes = (
            session.execute(
                select(Quiz)
                .options(selectinload(Quiz.content))
                .where(Quiz.id.in_(new_quiz_ids))
            )
            .scalars()
            .all()
        )
        if len(quizzes) != len(set(new_quiz_ids)):
            return None
        for quiz in quizzes:
            if not _user_can_access_quiz(quiz, owner):
                return None
        study.quiz_ids = json_dumps(new_quiz_ids)
        if "cards" not in updates or updates["cards"] is None:
            existing_cards = _normalize_cards(json_loads(study.card_payloads))
            filtered_cards = [card for card in existing_cards if card.get("id") in new_quiz_ids]
            study.card_payloads = json_dumps(filtered_cards)
            study.tags = json_dumps(_extract_tags_from_cards(filtered_cards))
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


def delete_study_session(session: Session, session_id: int, owner: User) -> bool:
    study = session.get(StudySession, session_id)
    if study is None or study.owner_id != owner.id:
        return False
    session.delete(study)
    session.commit()
    return True


def create_reward(session: Session, payload: RewardCreate, owner: User) -> RewardOut:
    reward = Reward(
        title=payload.title.strip(),
        duration=payload.duration.strip(),
        valid_until=payload.valid_until,
        owner_id=owner.id,
    )
    session.add(reward)
    session.commit()
    session.refresh(reward)
    return _reward_to_out(reward)


def list_rewards(session: Session, owner: User) -> list[RewardOut]:
    stmt = select(Reward).where(Reward.owner_id == owner.id).order_by(Reward.created_at.desc())
    rewards = session.execute(stmt).scalars().all()
    return [_reward_to_out(item) for item in rewards]


def update_reward(session: Session, reward_id: int, updates: RewardUpdate, owner: User) -> Optional[RewardOut]:
    reward = session.get(Reward, reward_id)
    if reward is None or reward.owner_id != owner.id:
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


def add_reward_to_session(
    session: Session,
    session_id: int,
    payload: RewardAssignPayload,
    owner: User,
) -> Optional[StudySessionOut]:
    study = session.execute(
        select(StudySession)
        .options(selectinload(StudySession.rewards))
        .where(StudySession.id == session_id, StudySession.owner_id == owner.id)
    ).scalar_one_or_none()
    if study is None:
        return None
    reward = session.get(Reward, payload.reward_id)
    if reward is None or reward.owner_id != owner.id:
        return None
    if reward not in study.rewards:
        study.rewards.append(reward)
        session.commit()
        session.refresh(study)
    return _study_session_to_out(study)


def delete_reward(session: Session, reward_id: int, owner: User) -> bool:
    reward = session.get(Reward, reward_id)
    if reward is None or reward.owner_id != owner.id:
        return False
    for study in list(reward.sessions):
        if study.owner_id != owner.id:
            continue
        if reward in study.rewards:
            study.rewards.remove(reward)
    session.delete(reward)
    session.commit()
    return True


def delete_quiz(session: Session, quiz_id: int, requester: User) -> bool:
    quiz = session.get(Quiz, quiz_id)
    if quiz is None or quiz.owner_id != requester.id:
        return False
    _prune_quizzes_from_sessions(session, {quiz_id}, requester.id)
    session.delete(quiz)
    session.commit()
    return True


def update_quiz(session: Session, quiz_id: int, card: CardUnion, requester: User) -> Optional[QuizOut]:
    quiz = session.get(Quiz, quiz_id)
    if quiz is None or quiz.owner_id != requester.id:
        return None
    card_dict = card.model_dump(mode="json", exclude_none=True)
    visibility = _normalize_visibility(card_dict.pop("visibility", None), quiz.visibility)
    quiz.type = card_dict.get("type")
    quiz.payload = json_dumps(card_dict)
    quiz.visibility = visibility
    _update_quiz_in_sessions(session, quiz_id, card_dict, requester.id)
    session.commit()
    session.refresh(quiz)
    return QuizOut(
        id=quiz.id,
        content_id=quiz.content_id,
        type=quiz.type,  # type: ignore[arg-type]
        payload=card_dict,
        created_at=quiz.created_at,
        visibility=quiz.visibility.value,
        owner_id=quiz.owner_id,
    )


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    normalized = email.strip().lower()
    return session.execute(select(User).where(func.lower(User.email) == normalized)).scalar_one_or_none()


def get_user_by_api_key(session: Session, api_key: str) -> Optional[User]:
    return session.execute(select(User).where(User.api_key == api_key)).scalar_one_or_none()


def create_user(session: Session, email: str, password_hash: str, api_key: str, *, is_admin: bool = False) -> User:
    user = User(
        email=email.strip().lower(),
        password_hash=password_hash,
        api_key=api_key,
        is_admin=is_admin,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def update_user_credentials(session: Session, user: User, password_hash: str, api_key: str) -> User:
    user.password_hash = password_hash
    user.api_key = api_key
    session.commit()
    session.refresh(user)
    return user


def delete_user(session: Session, user: User) -> None:
    session.delete(user)
    session.commit()
