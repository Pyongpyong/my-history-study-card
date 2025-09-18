from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

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


class ChronologyEvent(BaseModel):
    year: int
    label: str

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("event label must not be empty")
        return value.strip()


class Chronology(BaseModel):
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    events: List[ChronologyEvent] = Field(default_factory=list)

    @field_validator("events")
    @classmethod
    def validate_events(cls, value: List[ChronologyEvent]) -> List[ChronologyEvent]:
        return value

    @field_validator("end_year")
    @classmethod
    def validate_year_range(cls, value: Optional[int], info: Field) -> Optional[int]:
        start_year = info.data.get("start_year")
        if value is not None and start_year is not None and value < start_year:
            raise ValueError("end_year must be greater than or equal to start_year")
        return value


class ImportPayload(BaseModel):
    title: str
    content: str
    highlights: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    chronology: Optional[Chronology] = None
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
    tags: List[str]
    chronology: Optional[Chronology]
    created_at: datetime
    visibility: VisibilityType
    owner_id: Optional[int]


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    highlights: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    chronology: Optional[Chronology] = None
    visibility: Optional[VisibilityType] = None


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
    tags: List[str]
    rewards: List[RewardOut]
    owner_id: int


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


class UserDeleteRequest(BaseModel):
    password: str


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
