from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

# JSON utilities
json_loads = json.loads

from .models import (
    CardDeck,
    Content,
    Highlight,
    LearningHelper,
    Quiz,
    QuizAttempt,
    QuizTag,
    Reward,
    StudySession,
    User,
    VisibilityEnum,
)
from .schemas import (
    CardUnion,
    ContentOut,
    ContentUpdate,
    ImportPayload,
    EraEntry,
    TimelineEntry,
    PageMeta,
    QuizOut,
    RewardCreate,
    RewardOut,
    RewardUpdate,
    RewardAssignPayload,
    HelperVariants,
    LearningHelperCreate,
    LearningHelperOut,
    LearningHelperPublic,
    LearningHelperUpdate,
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


def _helper_variant_url(helper: LearningHelper, variant: str) -> str:
    base_path = f"/helpers/{helper.id}/image/{variant}"
    updated_at = getattr(helper, "updated_at", None)
    if not updated_at:
        return base_path
    try:
        version = int(updated_at.timestamp())
    except AttributeError:
        return base_path
    return f"{base_path}?v={version}"


def _build_helper_variants(helper: LearningHelper) -> HelperVariants:
    return HelperVariants(
        idle=_helper_variant_url(helper, "idle") if helper.image_idle else None,
        correct=_helper_variant_url(helper, "correct") if helper.image_correct else None,
        incorrect=_helper_variant_url(helper, "incorrect") if helper.image_incorrect else None,
    )


def helper_to_public(helper: Optional[LearningHelper]) -> Optional[LearningHelperPublic]:
    if helper is None:
        return None
    return LearningHelperPublic(
        id=helper.id,
        name=helper.name,
        level_requirement=helper.level_requirement,
        description=helper.description,
        variants=_build_helper_variants(helper),
        created_at=helper.created_at,
        updated_at=helper.updated_at,
    )


def helper_to_out(helper: LearningHelper, user: Optional[User]) -> LearningHelperOut:
    return LearningHelperOut(
        **helper_to_public(helper).model_dump(),
        unlocked=True if user is None else user.level >= helper.level_requirement,
    )


def list_learning_helpers(session: Session, user: Optional[User]) -> list[LearningHelperOut]:
    helpers = (
        session.execute(select(LearningHelper).order_by(LearningHelper.level_requirement.asc()))
        .scalars()
        .all()
    )
    return [helper_to_out(helper, user) for helper in helpers]


def get_learning_helper(session: Session, helper_id: int) -> Optional[LearningHelper]:
    return session.get(LearningHelper, helper_id)


def get_helper_by_level(session: Session, level_requirement: int) -> Optional[LearningHelper]:
    return (
        session.execute(
            select(LearningHelper).where(LearningHelper.level_requirement == level_requirement)
        ).scalar_one_or_none()
    )


def get_default_learning_helper(session: Session) -> Optional[LearningHelper]:
    return (
        session.execute(
            select(LearningHelper).order_by(LearningHelper.level_requirement.asc()).limit(1)
        ).scalar_one_or_none()
    )


def create_learning_helper(session: Session, payload: LearningHelperCreate) -> LearningHelperPublic:
    existing = get_helper_by_level(session, payload.level_requirement)
    if existing is not None:
        raise ValueError("LEVEL_EXISTS")
    helper = LearningHelper(
        name=payload.name.strip(),
        level_requirement=payload.level_requirement,
        description=payload.description.strip() if payload.description else None,
    )
    session.add(helper)
    session.commit()
    session.refresh(helper)
    return helper_to_public(helper)


def update_learning_helper(
    session: Session,
    helper: LearningHelper,
    payload: LearningHelperUpdate,
) -> LearningHelperPublic:
    if payload.name is not None:
        helper.name = payload.name.strip()
    if payload.description is not None:
        helper.description = payload.description.strip() if payload.description else None
    if payload.level_requirement is not None and payload.level_requirement != helper.level_requirement:
        existing = get_helper_by_level(session, payload.level_requirement)
        if existing is not None and existing.id != helper.id:
            raise ValueError("LEVEL_EXISTS")
        helper.level_requirement = payload.level_requirement
    session.commit()
    session.refresh(helper)
    return helper_to_public(helper)


def update_helper_variant(
    session: Session,
    helper: LearningHelper,
    variant: str,
    object_name: str,
) -> LearningHelperPublic:
    normalized_variant = variant.lower().strip()
    variant_field_map = {
        "idle": "image_idle",
        "correct": "image_correct",
        "incorrect": "image_incorrect",
    }
    if normalized_variant not in variant_field_map:
        raise ValueError("INVALID_VARIANT")
    setattr(helper, variant_field_map[normalized_variant], object_name)
    session.commit()
    session.refresh(helper)
    return helper_to_public(helper)


def delete_learning_helper(session: Session, helper_id: int) -> bool:
    """학습 도우미를 삭제합니다."""
    helper = get_learning_helper(session, helper_id)
    if not helper:
        return False
    
    # 사용자들이 이 학습 도우미를 선택하고 있다면 기본 학습 도우미로 변경
    users_with_helper = session.execute(
        select(User).where(User.selected_helper_id == helper_id)
    ).scalars().all()
    
    default_helper = get_default_learning_helper(session)
    for user in users_with_helper:
        if default_helper and default_helper.id != helper_id:
            user.selected_helper_id = default_helper.id
        else:
            user.selected_helper_id = None
    
    session.delete(helper)
    session.commit()
    return True


def set_user_helper(session: Session, user: User, helper: LearningHelper) -> User:
    if user.level < helper.level_requirement:
        raise PermissionError("LOCKED_HELPER")
    user.selected_helper_id = helper.id
    session.commit()
    session.refresh(user)
    return user


def resolve_helper_for_user(
    session: Session,
    user: User,
    requested_helper_id: Optional[int],
) -> Optional[LearningHelper]:
    if requested_helper_id is not None:
        helper = get_learning_helper(session, requested_helper_id)
        if helper is None:
            raise ValueError("HELPER_NOT_FOUND")
        if user.level < helper.level_requirement:
            raise PermissionError("LOCKED_HELPER")
        return helper

    if user.selected_helper_id:
        helper = get_learning_helper(session, user.selected_helper_id)
        if helper is not None and user.level >= helper.level_requirement:
            return helper

    helper = get_default_learning_helper(session)
    if helper is not None and user.level >= helper.level_requirement:
        return helper

    return helper



def _quiz_tags_for_card(card_dict: dict, taxonomy=None) -> list[str]:
    raw_tags = card_dict.get("tags") if isinstance(card_dict.get("tags"), list) else []
    normalized_tags: list[str] = []
    for tag in raw_tags:
        if not isinstance(tag, str):
            continue
        label = tag.strip()
        if label and label not in normalized_tags:
            normalized_tags.append(label)
    return normalized_tags


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


def _card_deck_to_out(card_deck: Optional[CardDeck]) -> Optional[dict]:
    """카드덱을 출력 형태로 변환합니다."""
    if not card_deck:
        return None
    return {
        "id": card_deck.id,
        "name": card_deck.name,
        "description": card_deck.description,
        "front_image": card_deck.front_image,
        "back_image": card_deck.back_image,
        "is_default": card_deck.is_default,
        "created_at": card_deck.created_at,
        "updated_at": card_deck.updated_at,
    }


def _study_session_to_out(study: StudySession) -> StudySessionOut:
    cards = _normalize_cards(json_loads(study.card_payloads))
    try:
        tags = json_loads(study.tags) if hasattr(study, "tags") and study.tags else []
    except Exception:
        tags = []
    if not tags:
        tags = _extract_tags_from_cards(cards)
    try:
        answers = json_loads(study.answers) if getattr(study, "answers", None) else {}
    except Exception:
        answers = {}
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
        answers={str(key): bool(value) for key, value in answers.items() if isinstance(value, bool)},
        tags=tags,
        rewards=[_reward_to_out(reward) for reward in getattr(study, "rewards", [])],
        owner_id=study.owner_id,
        helper_id=study.helper_id,
        helper=helper_to_public(getattr(study, "helper", None)),
        card_deck_id=study.card_deck_id,
        card_deck=_card_deck_to_out(getattr(study, "card_deck", None)),
    )


def _upsert_quiz_attempt(session: Session, user: User, quiz_id: int, is_correct: bool) -> tuple[int, QuizAttempt]:
    """Create or update a quiz attempt in place and return awarded points along with the attempt."""
    attempt = (
        session.execute(
            select(QuizAttempt).where(
                QuizAttempt.user_id == user.id,
                QuizAttempt.quiz_id == quiz_id,
            )
        ).scalar_one_or_none()
    )

    previous_awarded = attempt.points_awarded if attempt else False

    if attempt is None:
        attempt = QuizAttempt(
            user_id=user.id,
            quiz_id=quiz_id,
            attempts=1,
            correct=1 if is_correct else 0,
            points_awarded=is_correct,
        )
        session.add(attempt)
    else:
        attempt.attempts = (attempt.attempts or 0) + 1
        if is_correct:
            attempt.correct = (attempt.correct or 0) + 1
        attempt.points_awarded = (attempt.correct or 0) > 0

    session.flush()

    total_awarded = (
        session.execute(
            select(func.count())
            .select_from(QuizAttempt)
            .where(
                QuizAttempt.user_id == user.id,
                QuizAttempt.points_awarded.is_(True),
            )
        ).scalar()
        or 0
    )
    user.points = total_awarded

    points_earned = 1 if attempt.points_awarded and not previous_awarded else 0
    return points_earned, attempt


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

    quiz_models: list[tuple[Quiz, list[str]]] = []
    for card in payload.cards:
        card_dict = card.model_dump(mode="json", exclude_none=True)
        card_tags = _quiz_tags_for_card(card_dict, None)
        card_dict["tags"] = card_tags
        quiz_visibility = _normalize_visibility(card_dict.pop("visibility", None), content_visibility)
        quiz_model = Quiz(
            content_id=content.id,
            type=card_dict.get("type"),
            payload=json_dumps(card_dict),
            visibility=quiz_visibility,
            owner_id=owner.id if owner is not None else None,
        )
        session.add(quiz_model)
        quiz_models.append((quiz_model, card_tags))

    session.flush()
    if quiz_models:
        tag_models: list[QuizTag] = []
        for quiz_model, tags in quiz_models:
            for tag in tags:
                tag_models.append(QuizTag(quiz_id=quiz_model.id, tag=tag))
        if tag_models:
            session.add_all(tag_models)

    session.flush()
    highlight_ids = [highlight.id for highlight in highlight_models]
    quiz_ids = [quiz.id for quiz, _ in quiz_models]

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
    return ContentOut(
        id=content.id,
        title=content.title,
        content=content.body,
        highlights=[highlight.text for highlight in content.highlights],
        keywords=json_loads(content.keywords) if content.keywords else [],
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
            content.start_year = None
            content.end_year = None
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
        results.append(
            ContentOut(
                id=item.id,
                title=item.title,
                content=item.body,
                highlights=[highlight.text for highlight in item.highlights],
                keywords=json_loads(item.keywords) if item.keywords else [],
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
        card_payloads: list[dict] = []
        tag_set: set[str] = set()
        for quiz in item.quizzes:
            payload = json_loads(quiz.payload)
            if isinstance(payload, dict):
                tags = payload.get("tags") or []
                if isinstance(tags, list):
                    for tag in tags:
                        if isinstance(tag, str) and tag.strip():
                            tag_set.add(tag.strip())
                payload.setdefault("type", quiz.type)
                payload["visibility"] = quiz.visibility.value
                payload.pop("id", None)
                payload.pop("content_id", None)
                payload.pop("owner_id", None)
                payload.pop("created_at", None)
                card_payloads.append(payload)
        exported.append(
            {
                "title": item.title,
                "content": item.body,
                "highlights": [highlight.text for highlight in item.highlights],
                "tags": sorted(tag_set),
                "keywords": json_loads(item.keywords) if item.keywords else [],
                "timeline": [entry.model_dump(exclude_none=True) for entry in _deserialize_timeline(item.timeline)],
                "categories": _deserialize_categories(item.category),
                "eras": [entry.model_dump(exclude_none=True) for entry in _deserialize_eras(item.eras)],
                "visibility": item.visibility.value,
                "cards": card_payloads,
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
    card_tags = _quiz_tags_for_card(card_dict, None)
    card_dict["tags"] = card_tags
    quiz_visibility = _normalize_visibility(card_dict.pop("visibility", None), content.visibility)
    quiz = Quiz(
        content_id=content_id,
        type=card_dict.get("type"),
        payload=json_dumps(card_dict),
        visibility=quiz_visibility,
        owner_id=requester.id,
    )
    session.add(quiz)
    session.flush()
    if card_tags:
        session.add_all([QuizTag(quiz_id=quiz.id, tag=tag) for tag in card_tags])
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
    try:
        helper = resolve_helper_for_user(session, owner, payload.helper_id)
    except (ValueError, PermissionError):
        return None

    if helper is None:
        return None

    # 카드덱 처리
    card_deck_id = payload.card_deck_id
    if card_deck_id:
        card_deck = session.get(CardDeck, card_deck_id)
        if not card_deck:
            # 지정된 카드덱이 없으면 기본 카드덱 사용
            card_deck = get_default_card_deck(session)
            card_deck_id = card_deck.id if card_deck else None
    else:
        # 카드덱이 지정되지 않으면 기본 카드덱 사용
        card_deck = get_default_card_deck(session)
        card_deck_id = card_deck.id if card_deck else None

    study = StudySession(
        title=payload.title.strip(),
        quiz_ids=json_dumps(payload.quiz_ids),
        card_payloads=json_dumps(normalized_cards),
        tags=json_dumps(tags),
        owner_id=owner.id,
        helper_id=helper.id,
        card_deck_id=card_deck_id,
    )
    session.add(study)
    session.commit()
    session.refresh(study)
    return _study_session_to_out(study)


def get_study_session(session: Session, session_id: int, owner: User) -> Optional[StudySessionOut]:
    study = session.execute(
        select(StudySession)
        .options(selectinload(StudySession.rewards), selectinload(StudySession.helper), selectinload(StudySession.card_deck))
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
        .options(selectinload(StudySession.rewards), selectinload(StudySession.helper), selectinload(StudySession.card_deck))
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
    print(f"[DEBUG] Updating study session {session_id} with updates: {updates}")
    study = session.get(StudySession, session_id)
    if study is None:
        print(f"[ERROR] Study session {session_id} not found")
        return None
    if study.owner_id != owner.id:
        print(f"[ERROR] User {owner.id} is not the owner of study session {session_id}")
        return None
    print(f"[DEBUG] Found study session: {study.id}, owner: {study.owner_id}")
        
    # Track previous completion state for future use if needed
    
    if "helper_id" in updates:
        try:
            helper = resolve_helper_for_user(session, owner, updates.get("helper_id"))
        except (ValueError, PermissionError) as exc:
            print(f"[ERROR] Helper update failed: {exc}")
            return None
        if helper is None:
            print("[ERROR] Could not resolve helper for study session")
            return None
        study.helper_id = helper.id

    if "card_deck_id" in updates:
        card_deck_id = updates.get("card_deck_id")
        if card_deck_id:
            card_deck = session.get(CardDeck, card_deck_id)
            if not card_deck:
                print(f"[ERROR] Card deck {card_deck_id} not found")
                return None
            study.card_deck_id = card_deck_id
        else:
            # 카드덱을 제거하거나 기본 카드덱으로 설정
            default_deck = get_default_card_deck(session)
            study.card_deck_id = default_deck.id if default_deck else None

    if "title" in updates and updates["title"] is not None:
        study.title = updates["title"].strip()
        
    if "quiz_ids" in updates and updates["quiz_ids"] is not None:
        try:
            new_quiz_ids = updates["quiz_ids"]
            print(f"[DEBUG] Processing quiz_ids update: {new_quiz_ids}")
            if not isinstance(new_quiz_ids, (list, tuple)):
                print(f"[ERROR] quiz_ids must be a list, got {type(new_quiz_ids)}")
                return None
            
            # Convert to set to remove duplicates
            new_quiz_ids = list(dict.fromkeys(new_quiz_ids))  # Preserve order while removing duplicates
            
            # Fetch the quizzes to verify they exist and the user has access
            print(f"[DEBUG] Fetching quizzes with IDs: {new_quiz_ids}")
            quizzes = (
                session.execute(
                    select(Quiz)
                    .options(selectinload(Quiz.content))
                    .where(Quiz.id.in_(new_quiz_ids))
                )
                .scalars()
                .all()
            )
            print(f"[DEBUG] Found {len(quizzes)} quizzes")
            
            # Check if all quiz IDs exist and user has access
            if len(quizzes) != len(set(new_quiz_ids)):
                print(f"[ERROR] Mismatch in quiz count. Expected {len(set(new_quiz_ids))}, found {len(quizzes)}")
                return None
                
            for quiz in quizzes:
                if not _user_can_access_quiz(quiz, owner):
                    print(f"[ERROR] User {owner.id} doesn't have access to quiz {quiz.id}")
                    return None
                    
            # Update the quiz_ids in the study session
            print(f"[DEBUG] Updating study session with new quiz_ids: {new_quiz_ids}")
            study.quiz_ids = json_dumps(new_quiz_ids)
            
            # If cards are not provided, update them based on the new quiz_ids
            if "cards" not in updates or updates["cards"] is None:
                print("[DEBUG] Cards not provided in update, generating from quiz_ids")
                # Get existing cards and filter only those that are in the new quiz_ids
                existing_cards = _normalize_cards(json_loads(study.card_payloads or '[]'))
                print(f"[DEBUG] Found {len(existing_cards)} existing cards")
                
                existing_card_ids = {str(card.get('id')) for card in existing_cards}
                
                # Keep existing cards that are still in the new quiz_ids
                filtered_cards = [
                    card for card in existing_cards 
                    if str(card.get('id')) in map(str, new_quiz_ids)
                ]
                print(f"[DEBUG] After filtering, {len(filtered_cards)} cards remain")
                
                # Find new quizzes that don't have cards yet
                new_quiz_ids_set = set(map(str, new_quiz_ids))
                missing_quiz_ids = new_quiz_ids_set - existing_card_ids
                print(f"[DEBUG] Need to create cards for quiz IDs: {missing_quiz_ids}")
                
                if missing_quiz_ids:
                    # Fetch the missing quizzes to create card data
                    missing_quizzes = (
                        session.execute(
                            select(Quiz)
                            .where(Quiz.id.in_(list(map(int, missing_quiz_ids))))
                        )
                        .scalars()
                        .all()
                    )
                    print(f"[DEBUG] Fetched {len(missing_quizzes)} missing quizzes")
                    
                    # Create card data for the missing quizzes
                    for quiz in missing_quizzes:
                        card_data = {
                            'id': quiz.id,
                            'type': quiz.type,
                            'question': quiz.question,
                            'answer': quiz.answer,
                            'options': quiz.options,
                            'explanation': quiz.explanation,
                            'attempts': 0,
                            'correct': 0
                        }
                        filtered_cards.append(card_data)
                    
                    print(f"[DEBUG] Added {len(missing_quizzes)} new cards, total cards now: {len(filtered_cards)}")
                
                # Update the study session with the combined cards
                study.card_payloads = json_dumps(filtered_cards)
                study.tags = json_dumps(_extract_tags_from_cards(filtered_cards))
                print("[DEBUG] Updated study session with new cards and tags")
            
        except Exception as e:
            print(f"[ERROR] Error processing quiz_ids update: {str(e)}")
            return None
            
    if "cards" in updates and updates["cards"] is not None:
        try:
            print("[DEBUG] Processing cards update")
            normalized = _normalize_cards(updates["cards"])
            study.card_payloads = json_dumps(normalized)
            study.tags = json_dumps(_extract_tags_from_cards(normalized))
            print("[DEBUG] Updated study session with new cards and tags")
        except Exception as e:
            print(f"[ERROR] Error processing cards update: {str(e)}")
            return None
            
    if "score" in updates:
        study.score = updates["score"]
        score_updated = True
    if "total" in updates:
        study.total = updates["total"]
        score_updated = True

    # Check if we're marking as completed
    if "completed_at" in updates:
        study.completed_at = updates["completed_at"]
    
    # Handle answers update if provided
    if 'answers' in updates and updates['answers'] is not None:
        current_answers = updates['answers']
        if not isinstance(current_answers, dict):
            print(f"[ERROR] Invalid answers format, expected dict, got {type(current_answers)}")
            return None
            
        # Get previous answers, defaulting to empty dict if None or empty string
        previous_answers = {}
        if study.answers and study.answers.strip():
            try:
                previous_answers = json_loads(study.answers)
            except json.JSONDecodeError:
                print(f"[WARNING] Failed to parse previous answers, using empty dict")
                previous_answers = {}
        
        # Update with new answers (preserving any existing answers not in the update)
        updated_answers = {**previous_answers, **current_answers}
        study.answers = json_dumps(updated_answers)
        
        # Process each answer to calculate points and save attempts
        for question_id, is_correct in current_answers.items():
            # Skip if not a boolean (invalid answer format)
            if not isinstance(is_correct, bool):
                print(f"[ERROR] Invalid answer format for question {question_id}, expected boolean")
                continue
                
            # Convert question_id to int if it's a string
            try:
                quiz_id = int(question_id)
            except (ValueError, TypeError):
                print(f"[ERROR] Invalid question_id: {question_id}")
                continue
                
            try:
                points_gained, attempt = _upsert_quiz_attempt(session, owner, quiz_id, is_correct)
                print(
                    f"[QUIZ_ATTEMPT] User {owner.id} answered quiz {quiz_id} "
                    f"({'correctly' if is_correct else 'incorrectly'}). "
                    f"attempts={attempt.attempts}, correct={attempt.correct}, points_awarded={attempt.points_awarded}, "
                    f"gained={points_gained}"
                )
            except Exception as e:
                print(f"[ERROR] Failed to save quiz attempt: {str(e)}")
    
    try:
        print("[DEBUG] Committing changes to database...")
        session.commit()
        print("[DEBUG] Changes committed successfully")
        session.refresh(study)
        print(f"[DEBUG] Study session after refresh: id={study.id}, quiz_ids={study.quiz_ids}")
        result = _study_session_to_out(study)
        print(f"[DEBUG] Returning updated study session: {result}")
        return result
    except Exception as e:
        print(f"[ERROR] Failed to commit changes: {str(e)}")
        session.rollback()
        raise


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
    card_tags = _quiz_tags_for_card(card_dict, None)
    card_dict["tags"] = card_tags
    visibility = _normalize_visibility(card_dict.pop("visibility", None), quiz.visibility)
    quiz.type = card_dict.get("type")
    quiz.payload = json_dumps(card_dict)
    quiz.visibility = visibility
    quiz.tag_links = [QuizTag(quiz_id=quiz_id, tag=tag) for tag in card_tags]
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
    user = session.execute(select(User).where(func.lower(User.email) == normalized)).scalar_one_or_none()
    if user:
        from .user_levels import get_user_stats
        user_stats = get_user_stats(user)
        user.points = user_stats["points"]
        user.level = user_stats["level"]
    return user


def get_user_by_api_key(session: Session, api_key: str) -> Optional[User]:
    user = session.execute(select(User).where(User.api_key == api_key)).scalar_one_or_none()
    if user:
        from .user_levels import get_user_stats
        user_stats = get_user_stats(user)
        user.points = user_stats["points"]
        user.level = user_stats["level"]
    return user


def create_user(session: Session, email: str, password_hash: str, api_key: str, *, is_admin: bool = False) -> User:
    user = User(
        email=email.strip().lower(),
        password_hash=password_hash,
        api_key=api_key,
        is_admin=is_admin,
    )
    default_helper = get_default_learning_helper(session)
    if default_helper is not None:
        user.selected_helper_id = default_helper.id
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


def submit_quiz_answer(
    session: Session,
    user_id: int,
    quiz_id: int,
    is_correct: bool,
) -> Dict[str, Any]:
    """
    퀴즈 답변을 제출하고, 정답인 경우 포인트를 지급합니다.
    이미 포인트를 받은 퀴즈는 중복 지급하지 않습니다.
    
    Returns:
        Dict[str, Any]: {
            "success": bool,          # 요청 성공 여부
            "is_correct": bool,       # 정답 여부
            "points_earned": int,     # 이번에 획득한 포인트
            "total_points": int,      # 현재 총 포인트
            "message": str           # 결과 메시지
        }
    """
    user: Optional[User] = None
    try:
        user = session.get(User, user_id)
        if not user:
            return {
                "success": False,
                "is_correct": False,
                "points_earned": 0,
                "total_points": 0,
                "message": "사용자 정보를 찾을 수 없습니다.",
            }

        quiz = session.get(Quiz, quiz_id)
        if not quiz:
            return {
                "success": False,
                "is_correct": False,
                "points_earned": 0,
                "total_points": user.points or 0,
                "message": "퀴즈를 찾을 수 없습니다.",
            }

        points_earned, attempt = _upsert_quiz_attempt(session, user, quiz_id, is_correct)

        if is_correct:
            if points_earned:
                message = "정답입니다! 1점을 획득하셨습니다."
            else:
                message = "정답이지만 이미 포인트를 획득한 퀴즈입니다."
        else:
            message = "오답입니다. 다음 기회에 다시 도전해보세요!"

        session.commit()

        return {
            "success": True,
            "is_correct": is_correct,
            "points_earned": points_earned,
            "total_points": user.points or 0,
            "message": message,
        }

    except Exception as exc:  # pragma: no cover - defensive
        session.rollback()
        print(f"Error in submit_quiz_answer: {exc}")
        return {
            "success": False,
            "is_correct": False,
            "points_earned": 0,
            "total_points": user.points or 0 if user else 0,
            "message": f"퀴즈 제출 중 오류가 발생했습니다: {exc}",
        }


# Card Deck CRUD Functions
def create_card_deck(session: Session, card_deck_data: dict) -> CardDeck:
    """카드덱을 생성합니다."""
    # 기본 카드덱으로 설정하는 경우, 다른 기본 카드덱들의 is_default를 False로 변경
    if card_deck_data.get("is_default", False):
        session.query(CardDeck).filter(CardDeck.is_default == True).update({"is_default": False})
    
    card_deck = CardDeck(**card_deck_data)
    session.add(card_deck)
    session.commit()
    session.refresh(card_deck)
    return card_deck


def get_card_deck(session: Session, card_deck_id: int) -> Optional[CardDeck]:
    """ID로 카드덱을 조회합니다."""
    return session.get(CardDeck, card_deck_id)


def get_default_card_deck(session: Session) -> Optional[CardDeck]:
    """기본 카드덱을 조회합니다."""
    return session.query(CardDeck).filter(CardDeck.is_default == True).first()


def list_card_decks(
    session: Session,
    skip: int = 0,
    limit: int = 100,
) -> Tuple[List[CardDeck], int]:
    """카드덱 목록을 조회합니다."""
    query = session.query(CardDeck).order_by(CardDeck.is_default.desc(), CardDeck.created_at.desc())
    
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    
    return items, total


def update_card_deck(session: Session, card_deck_id: int, update_data: dict) -> Optional[CardDeck]:
    """카드덱을 수정합니다."""
    card_deck = session.get(CardDeck, card_deck_id)
    if not card_deck:
        return None
    
    # 기본 카드덱으로 설정하는 경우, 다른 기본 카드덱들의 is_default를 False로 변경
    if update_data.get("is_default", False):
        session.query(CardDeck).filter(CardDeck.id != card_deck_id, CardDeck.is_default == True).update({"is_default": False})
    
    for key, value in update_data.items():
        if value is not None:
            setattr(card_deck, key, value)
    
    session.commit()
    session.refresh(card_deck)
    return card_deck


def delete_card_deck(session: Session, card_deck_id: int) -> bool:
    """카드덱을 삭제합니다."""
    card_deck = session.get(CardDeck, card_deck_id)
    if not card_deck:
        return False
    
    # 기본 카드덱은 삭제할 수 없습니다
    if card_deck.is_default:
        return False
    
    session.delete(card_deck)
    session.commit()
    return True
