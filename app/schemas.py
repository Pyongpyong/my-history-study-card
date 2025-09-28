from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .utils import parse_timeline_entry

CardType = Literal["MCQ", "SHORT", "OX", "CLOZE", "ORDER", "MATCH"]
VisibilityType = Literal["PUBLIC", "PRIVATE"]


class CardBase(BaseModel):
    type: CardType
    explain: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="allow")

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: List[str]) -> List[str]:
        normalized = []
        for item in value:
            if not item or not item.strip():
                raise ValueError("tags entries must be non-empty strings")
            candidate = item.strip()
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized


class MCQCard(CardBase):
    type: Literal["MCQ"]
    question: str
    options: List[str]
    answer_index: int

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("question must not be empty")
        return value

    @field_validator("options")
    @classmethod
    def validate_options(cls, value: List[str]) -> List[str]:
        if not (2 <= len(value) <= 6):
            raise ValueError("options must contain between 2 and 6 entries")
        normalized = [option.strip() for option in value]
        if any(not option for option in normalized):
            raise ValueError("options must be non-empty strings")
        if len(set(normalized)) != len(normalized):
            raise ValueError("options must be unique")
        return value

    @field_validator("answer_index")
    @classmethod
    def validate_answer_index(cls, value: int, info: Field) -> int:
        options = info.data.get("options")
        if options is not None and not (0 <= value < len(options)):
            raise ValueError("answer_index must reference an option")
        return value


class ShortCard(CardBase):
    type: Literal["SHORT"]
    prompt: str
    answer: str

    @field_validator("prompt", "answer")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("value must not be empty")
        return value


class OXCard(CardBase):
    type: Literal["OX"]
    statement: str
    answer: bool

    @field_validator("statement")
    @classmethod
    def validate_statement(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("statement must not be empty")
        return value


class ClozeCard(CardBase):
    type: Literal["CLOZE"]
    text: str
    clozes: Dict[str, str]

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("text must not be empty")
        return value

    @field_validator("clozes")
    @classmethod
    def validate_clozes(cls, value: Dict[str, str], info: Field) -> Dict[str, str]:
        text = info.data.get("text", "")
        placeholders = set()
        cursor = 0
        while True:
            start = text.find("{{", cursor)
            if start == -1:
                break
            end = text.find("}}", start)
            if end == -1:
                break
            placeholders.add(text[start + 2 : end])
            cursor = end + 2
        for placeholder in placeholders:
            if placeholder and placeholder not in value:
                raise ValueError(f"missing cloze value for '{placeholder}'")
        return value


class OrderCard(CardBase):
    type: Literal["ORDER"]
    items: List[str]
    answer_order: List[int]

    @field_validator("items")
    @classmethod
    def validate_items(cls, value: List[str]) -> List[str]:
        if len(value) < 1:
            raise ValueError("items must contain at least one entry")
        if any(not item.strip() for item in value):
            raise ValueError("items must be non-empty strings")
        return value

    @field_validator("answer_order")
    @classmethod
    def validate_order(cls, value: List[int], info: Field) -> List[int]:
        items = info.data.get("items") or []
        if sorted(value) != list(range(len(items))):
            raise ValueError("answer_order must be a permutation of item indices")
        return value


class MatchCard(CardBase):
    type: Literal["MATCH"]
    left: List[str]
    right: List[str]
    pairs: List[List[int]]

    @field_validator("left", "right")
    @classmethod
    def validate_sides(cls, value: List[str]) -> List[str]:
        if not value:
            raise ValueError("left/right must contain at least one entry")
        if any(not item.strip() for item in value):
            raise ValueError("left/right entries must be non-empty strings")
        return value

    @field_validator("pairs")
    @classmethod
    def validate_pairs(cls, value: List[List[int]], info: Field) -> List[List[int]]:
        left = info.data.get("left") or []
        right = info.data.get("right") or []
        for pair in value:
            if len(pair) != 2:
                raise ValueError("each pair must contain two indices")
            l_idx, r_idx = pair
            if not (0 <= l_idx < len(left)):
                raise ValueError("left index out of range")
            if not (0 <= r_idx < len(right)):
                raise ValueError("right index out of range")
        return value


CardUnion = Union[MCQCard, ShortCard, OXCard, ClozeCard, OrderCard, MatchCard]


class Taxonomy(BaseModel):
    era: Optional[str] = None
    sub_era: Optional[str] = None
    topic: List[str] = Field(default_factory=list)
    entity: List[str] = Field(default_factory=list)
    region: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)

    @field_validator("topic", "entity", "region", "keywords")
    @classmethod
    def _normalize_taxonomy(cls, value: List[str]) -> List[str]:
        normalized: List[str] = []
        for item in value:
            if not item or not item.strip():
                raise ValueError("taxonomy entries must be non-empty strings")
            candidate = item.strip()
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized




class TimelineEntry(BaseModel):
    title: str
    description: str = ""

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("timeline title must not be empty")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        return value.strip()


class EraEntry(BaseModel):
    period: str
    detail: str = ""

    @field_validator("period")
    @classmethod
    def validate_period(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("period must not be empty")
        return cleaned

    @field_validator("detail")
    @classmethod
    def validate_detail(cls, value: str) -> str:
        return value.strip()


class ImportPayload(BaseModel):
    title: str
    content: str
    highlights: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    timeline: List[TimelineEntry] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    eras: List[EraEntry] = Field(default_factory=list)
    category: Optional[str] = None
    cards: List[CardUnion] = Field(default_factory=list)
    visibility: Optional[VisibilityType] = Field(default=None)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("title", "content")
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("field must not be empty")
        return value

    @field_validator("highlights")
    @classmethod
    def validate_highlights(cls, value: List[str]) -> List[str]:
        if not (0 <= len(value) <= 200):
            raise ValueError("highlights must contain between 0 and 200 entries")
        for item in value:
            if not item or not item.strip():
                raise ValueError("highlight entries must be non-empty strings")
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: List[str]) -> List[str]:
        normalized = []
        for item in value:
            if not item or not item.strip():
                raise ValueError("tags entries must be non-empty strings")
            candidate = item.strip()
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, value: List[str]) -> List[str]:
        normalized = []
        for item in value:
            if not item or not item.strip():
                raise ValueError("keywords entries must be non-empty strings")
            candidate = item.strip()
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized

    @field_validator("timeline", mode="before")
    @classmethod
    def parse_timeline(cls, value):
        if value is None:
            return []
        if isinstance(value, list):
            parsed: List[TimelineEntry] = []
            for item in value:
                if isinstance(item, TimelineEntry):
                    parsed.append(item)
                elif isinstance(item, dict):
                    parsed.append(TimelineEntry.model_validate(item))
                else:
                    entry = parse_timeline_entry(str(item))
                    if entry["title"]:
                        parsed.append(TimelineEntry(**entry))
            return parsed
        if isinstance(value, str):
            lines = [line.strip() for line in value.splitlines() if line.strip()]
            results: List[TimelineEntry] = []
            for line in lines:
                entry = parse_timeline_entry(line)
                if entry["title"]:
                    results.append(TimelineEntry(**entry))
            return results
        return value

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, value: List[str]) -> List[str]:
        normalized = []
        for item in value:
            if not item or not item.strip():
                raise ValueError("categories entries must be non-empty strings")
            candidate = item.strip()
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized

    @model_validator(mode="after")
    def merge_category(cls, data: "ImportPayload") -> "ImportPayload":
        if data.category and not data.categories:
            candidate = data.category.strip()
            if candidate:
                data.categories = [candidate]
        return data

    @model_validator(mode="after")
    def merge_legacy_tags(cls, data: "ImportPayload") -> "ImportPayload":
        if data.tags:
            for tag in data.tags:
                if tag not in data.keywords:
                    data.keywords.append(tag)
            data.tags = []
        return data

    @field_validator("eras", mode="before")
    @classmethod
    def parse_eras(cls, value):
        if value is None:
            return []
        if isinstance(value, list):
            results: List[EraEntry] = []
            for item in value:
                if isinstance(item, dict):
                    results.append(EraEntry.model_validate(item))
                elif isinstance(item, str):
                    normalized = item.strip()
                    if normalized:
                        results.append(EraEntry(period=normalized))
            return results
        if isinstance(value, str):
            normalized = value.strip()
            return [EraEntry(period=normalized)] if normalized else []
        return []


class ImportResponse(BaseModel):
    content_id: int
    highlight_ids: List[int]
    quiz_ids: List[int]
    counts: Dict[str, int]


class PageMeta(BaseModel):
    page: int = 1
    size: int = 20
    total: int


class ContentOut(BaseModel):
    id: int
    title: str
    content: str
    highlights: List[str]
    keywords: List[str]
    timeline: List[TimelineEntry]
    categories: List[str]
    eras: List[EraEntry]
    created_at: datetime
    visibility: VisibilityType
    owner_id: Optional[int]


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    highlights: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    timeline: Optional[List[TimelineEntry]] = None
    category: Optional[str] = None
    categories: Optional[List[str]] = None
    eras: Optional[List[EraEntry]] = None
    visibility: Optional[VisibilityType] = None

    @field_validator("timeline", mode="before")
    @classmethod
    def parse_update_timeline(cls, value):
        if value is None:
            return None
        if isinstance(value, list):
            parsed: List[TimelineEntry] = []
            for item in value:
                if isinstance(item, TimelineEntry):
                    parsed.append(item)
                elif isinstance(item, dict):
                    parsed.append(TimelineEntry.model_validate(item))
                else:
                    entry = parse_timeline_entry(str(item))
                    if entry["title"]:
                        parsed.append(TimelineEntry(**entry))
            return parsed
        if isinstance(value, str):
            lines = [line.strip() for line in value.splitlines() if line.strip()]
            results: List[TimelineEntry] = []
            for line in lines:
                entry = parse_timeline_entry(line)
                if entry["title"]:
                    results.append(TimelineEntry(**entry))
            return results
        return value

    @field_validator("eras", mode="before")
    @classmethod
    def parse_update_eras(cls, value):
        if value is None:
            return None
        if isinstance(value, list):
            results: List[EraEntry] = []
            for item in value:
                if isinstance(item, dict):
                    results.append(EraEntry.model_validate(item))
            return results
        if isinstance(value, str):
            normalized = value.strip()
            return [EraEntry(period=normalized)] if normalized else []
        return []

    @field_validator("categories")
    @classmethod
    def validate_update_categories(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        normalized = []
        for item in value:
            if not item or not item.strip():
                raise ValueError("categories entries must be non-empty strings")
            candidate = item.strip()
            if candidate not in normalized:
                normalized.append(candidate)
        return normalized

    @model_validator(mode="after")
    def merge_update_category(cls, data: "ContentUpdate") -> "ContentUpdate":
        if data.category and not data.categories:
            candidate = data.category.strip()
            if candidate:
                data.categories = [candidate]
        return data


class ContentListOut(BaseModel):
    items: List[ContentOut]
    meta: PageMeta


class QuizOut(BaseModel):
    id: int
    content_id: int
    type: CardType
    payload: Dict[str, object]
    created_at: datetime
    visibility: VisibilityType
    owner_id: Optional[int]


class QuizListOut(BaseModel):
    items: List[QuizOut]
    meta: PageMeta


class HelperVariants(BaseModel):
    idle: Optional[str] = None
    correct: Optional[str] = None
    incorrect: Optional[str] = None


class LearningHelperBase(BaseModel):
    name: str
    level_requirement: int = Field(ge=1)
    description: Optional[str] = None


class LearningHelperPublic(LearningHelperBase):
    id: int
    variants: HelperVariants
    created_at: datetime
    updated_at: datetime


class LearningHelperOut(LearningHelperPublic):
    unlocked: bool


class LearningHelperCreate(LearningHelperBase):
    pass


class LearningHelperUpdate(BaseModel):
    name: Optional[str] = None
    level_requirement: Optional[int] = Field(default=None, ge=1)
    description: Optional[str] = None


class LearningHelperListOut(BaseModel):
    items: List[LearningHelperOut]


class RewardCreate(BaseModel):
    title: str
    duration: str
    valid_until: Optional[datetime] = None

    @field_validator("title", "duration")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("값을 입력해주세요")
        return value.strip()


class RewardUpdate(BaseModel):
    title: Optional[str] = None
    duration: Optional[str] = None
    valid_until: Optional[datetime] = None
    used: Optional[bool] = None


class RewardOut(BaseModel):
    id: int
    title: str
    duration: str
    created_at: datetime
    valid_until: Optional[datetime]
    used: bool
    owner_id: int


class RewardListOut(BaseModel):
    items: List[RewardOut]


class RewardAssignPayload(BaseModel):
    reward_id: int


class StudySessionCreate(BaseModel):
    title: str
    quiz_ids: List[int]
    cards: List[Dict[str, object]]
    helper_id: Optional[int] = None
    card_deck_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("title must not be empty")
        return value


class StudySessionOut(BaseModel):
    id: int
    title: str
    quiz_ids: List[int]
    cards: List[Dict[str, object]]
    created_at: datetime
    updated_at: datetime
    score: Optional[int]
    total: Optional[int]
    completed_at: Optional[datetime]
    answers: Dict[str, bool] = Field(default_factory=dict)
    tags: List[str]
    rewards: List[RewardOut]
    owner_id: int
    helper_id: Optional[int]
    helper: Optional[LearningHelperPublic]
    card_deck_id: Optional[int]
    card_deck: Optional[CardDeckOut]


class StudySessionListOut(BaseModel):
    items: List[StudySessionOut]
    meta: PageMeta


class StudySessionUpdate(BaseModel):
    title: Optional[str] = None
    quiz_ids: Optional[List[int]] = None
    cards: Optional[List[Dict[str, object]]] = None
    score: Optional[int] = None
    total: Optional[int] = None
    completed_at: Optional[datetime] = None
    answers: Optional[Dict[str, bool]] = None
    helper_id: Optional[int] = None
    card_deck_id: Optional[int] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.strip()) < 6:
            raise ValueError("password must be at least 6 characters")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime
    is_admin: bool
    points: int = 0
    level: int = 1
    points_to_next_level: int = 100
    is_max_level: bool = False
    selected_helper_id: Optional[int] = None
    selected_helper: Optional[LearningHelperPublic] = None


class UserAuthResponse(BaseModel):
    user: UserProfile
    api_key: str


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value.strip()) < 6:
            raise ValueError("password must be at least 6 characters")
        return value


class UserHelperUpdate(BaseModel):
    helper_id: int


class UserDeleteRequest(BaseModel):
    password: str


class QuizSubmit(BaseModel):
    """퀴즈 제출 요청 스키마"""
    quiz_id: int
    is_correct: bool


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str
    is_admin: bool = True

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.strip()) < 6:
            raise ValueError("password must be at least 6 characters")
        return value


# Card Deck Schemas
class CardDeckBase(BaseModel):
    name: str
    description: Optional[str] = None
    front_image: str
    back_image: str
    is_default: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name must not be empty")
        return value.strip()

    @field_validator("front_image", "back_image")
    @classmethod
    def validate_image(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("image path must not be empty")
        return value.strip()


class CardDeckCreate(CardDeckBase):
    pass


class CardDeckUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    front_image: Optional[str] = None
    back_image: Optional[str] = None
    is_default: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and (not value or not value.strip()):
            raise ValueError("name must not be empty")
        return value.strip() if value else None

    @field_validator("front_image", "back_image")
    @classmethod
    def validate_image(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and (not value or not value.strip()):
            raise ValueError("image path must not be empty")
        return value.strip() if value else None


class CardDeckOut(CardDeckBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CardDeckListOut(BaseModel):
    items: List[CardDeckOut]
    meta: PageMeta
