import json

import pytest
from fastapi.testclient import TestClient

from sqlalchemy import select

from app.db import DB_PATH, SessionLocal
from app.llm.client import LLMResult
from app.main import app
from app.models import Content, QuizTag
from app.routers import ai as ai_router
from app.settings import get_settings


class _UsageStub(dict):
    def __init__(self, input_tokens: int, output_tokens: int) -> None:
        super().__init__(input_tokens=input_tokens, output_tokens=output_tokens)
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.prompt_tokens = input_tokens
        self.completion_tokens = output_tokens


class _LLMStub:
    def __init__(self) -> None:
        self.extract_calls = 0
        self.generate_calls = 0
        self.fix_calls = 0
        self.extract_result = LLMResult(
            data={
                "entities": ["세종대왕"],
                "facts": [{"type": "person", "name": "세종"}],
                "timeline": [{"year": 1443, "label": "훈민정음 반포"}],
            },
            tokens_in=10,
            tokens_out=20,
            latency_ms=50,
        )
        self.generate_payload = {
            "data": {
                "cards": [
                    {
                        "type": "MCQ",
                        "question": "훈민정음을 창제한 왕은 누구인가?",
                        "options": ["세종", "태종", "정조", "광해군"],
                        "answer_index": 0,
                        "explain": "본문 근거.",
                        "tags": ["훈민정음", "세종"],
                    }
                ]
            },
            "usage": _UsageStub(30, 40),
            "tokens_in": 30,
            "tokens_out": 40,
            "latency_ms": 60,
        }
        self.generate_queue: list[dict] = []
        self.fix_queue: list[LLMResult] = []

    @property
    def generate_default(self) -> dict:
        return self.generate_payload

    async def extract(self, content: str, highlights: list[str]) -> LLMResult:
        self.extract_calls += 1
        return self.extract_result

    async def generate_one(self, facts: dict, card_type: str, difficulty: str):
        self.generate_calls += 1
        if self.generate_queue:
            return self.generate_queue.pop(0)
        return self.generate_payload

    async def fix(self, cards: dict, errors: list[dict]) -> LLMResult:
        self.fix_calls += 1
        if not self.fix_queue:
            raise AssertionError("unexpected fix invocation")
        return self.fix_queue.pop(0)

    async def generate_cards(self, facts: dict, types: list[str], difficulty: str) -> LLMResult:
        self.generate_calls += 1
        if self.generate_queue:
            payload = self.generate_queue.pop(0)
            if isinstance(payload, dict):
                return LLMResult(
                    data=payload.get("data", {}),
                    tokens_in=payload.get("tokens_in", 0),
                    tokens_out=payload.get("tokens_out", 0),
                    latency_ms=payload.get("latency_ms", 0),
                )
            return payload
        return LLMResult(
            data=self.generate_payload.get("data", {}),
            tokens_in=self.generate_payload.get("tokens_in", 0),
            tokens_out=self.generate_payload.get("tokens_out", 0),
            latency_ms=self.generate_payload.get("latency_ms", 0),
        )


@pytest.fixture(autouse=True)
def reset_state(monkeypatch, tmp_path):
    if DB_PATH.exists():
        DB_PATH.unlink()
    cache_dir = tmp_path / "cache"
    monkeypatch.setenv("AI_CACHE_DIR", str(cache_dir))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("AI_RATE_LIMIT_QUOTA", "100")
    get_settings.cache_clear()
    ai_router._RATE_LIMIT_STATE.clear()
    yield
    get_settings.cache_clear()
    ai_router._RATE_LIMIT_STATE.clear()
    if DB_PATH.exists():
        DB_PATH.unlink()


@pytest.fixture
def client(monkeypatch):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def llm_stub(monkeypatch) -> _LLMStub:
    from app.llm import client as llm_client

    stub = _LLMStub()
    monkeypatch.setattr(llm_client, "aextract_facts", stub.extract)
    monkeypatch.setattr(llm_client, "agenerate_one", stub.generate_one)
    monkeypatch.setattr(llm_client, "agenerate_cards", stub.generate_cards)
    monkeypatch.setattr(llm_client, "afix_cards", stub.fix)
    return stub


def test_generate_endpoint_returns_cards_and_meta(client: TestClient, llm_stub: _LLMStub):
    payload = {
        "content": "세종대왕은 훈민정음을 창제하였다.",
        "highlights": ["세종대왕", "훈민정음"],
        "types": ["MCQ", "SHORT"],
        "difficulty": "medium",
    }

    response = client.post("/ai/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["cards"]) == 1
    assert data["meta"]["cached"] is False
    assert data["meta"]["tokens_in"] == llm_stub.extract_result.tokens_in + llm_stub.generate_default["tokens_in"]
    assert llm_stub.extract_calls == 1
    assert llm_stub.generate_calls == 1

    second = client.post("/ai/generate", json=payload)
    assert second.status_code == 200
    cached = second.json()
    assert cached["meta"]["cached"] is True
    assert cached["meta"]["tokens_in"] == 0
    assert llm_stub.extract_calls == 1  # cache hit avoided new call

    third = client.post("/ai/generate", json={**payload, "no_cache": True})
    assert third.status_code == 200
    fresh = third.json()
    assert fresh["meta"]["cached"] is False
    assert fresh["meta"]["tokens_in"] == llm_stub.extract_result.tokens_in + llm_stub.generate_default["tokens_in"]
    assert llm_stub.extract_calls == 2
    assert llm_stub.generate_calls == 2


def test_generate_and_import_creates_records(client: TestClient, llm_stub: _LLMStub):
    request_payload = {
        "title": "세종대왕",
        "content": "세종대왕은 조선의 네 번째 왕으로 훈민정음을 창제하였다.",
        "highlights": ["세종대왕", "훈민정음"],
        "tags": ["조선", "세종"],
        "taxonomy": {
            "era": "조선",
            "sub_era": "세종", 
            "topic": ["훈민정음"],
            "entity": ["세종대왕"],
        },
        "chronology": {
            "start": {"year": 1418, "precision": "year"},
            "end": {"year": 1450, "precision": "year"},
            "events": [{"year": 1443, "label": "훈민정음 창제"}],
        },
        "types": ["MCQ", "SHORT", "OX"],
        "difficulty": "easy",
        "visibility": "PUBLIC",
        "upsert": False,
    }

    response = client.post("/ai/generate-and-import", json=request_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["generated_count"] == 1
    assert data["counts"]["quizzes"] == 1
    assert data["meta"]["cached"] is False
    content_id = data["content_id"]

    session = SessionLocal()
    try:
        content = session.get(Content, content_id)
        assert content is not None
        assert content.era == "조선"
        assert content.sub_era == "세종"
        assert content.start_year == 1418
        assert content.end_year == 1450
        taxonomy = json.loads(content.taxonomy)
        assert taxonomy["topic"] == ["훈민정음"]

        quiz_tag_rows = session.execute(
            select(QuizTag).where(QuizTag.quiz_id.in_(data["quiz_ids"]))
        ).scalars().all()
        assert len(quiz_tag_rows) >= len(data["quiz_ids"])
    finally:
        session.close()


def test_generate_uses_fix_to_correct_invalid_cards(client: TestClient, llm_stub: _LLMStub):
    invalid_mcq = {
        "data": {
            "cards": [
                {
                    "type": "MCQ",
                    "question": "훈민정음 창제 시기는?",
                    "options": ["1443", "1443", "1446", "1448"],
                    "answer_index": 0,
                    "explain": "타임라인 근거.",
                },
                {
                    "type": "SHORT",
                    "prompt": "훈민정음을 창제한 왕은?",
                    "answer": "세종대왕",
                    "rubric": {"aliases": ["세종"]},
                    "explain": "본문 근거.",
                },
            ]
        },
        "usage": _UsageStub(5, 5),
        "tokens_in": 5,
        "tokens_out": 5,
        "latency_ms": 5,
    }
    fixed_mcq = LLMResult(
        data={
            "cards": [
                {
                    "type": "MCQ",
                    "question": "훈민정음 창제 시기는?",
                    "options": ["1443", "1444", "1445", "1446"],
                    "answer_index": 0,
                    "explain": "타임라인 근거.",
                },
                {
                    "type": "SHORT",
                    "prompt": "훈민정음을 창제한 왕은?",
                    "answer": "세종대왕",
                    "rubric": {"aliases": ["세종"]},
                    "explain": "본문 근거.",
                },
            ]
        },
        tokens_in=6,
        tokens_out=6,
        latency_ms=6,
    )

    llm_stub.generate_queue = [invalid_mcq]
    llm_stub.fix_queue = [fixed_mcq]

    response = client.post(
        "/ai/generate",
        json={
            "content": "1443년에 세종대왕은 훈민정음을 창제하였다.",
            "highlights": ["1443", "세종대왕"],
            "types": ["MCQ", "SHORT"],
            "difficulty": "medium",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["cards"]) == 1
    assert llm_stub.fix_calls in (0, 1)
    options = data["cards"][0]["options"]
    assert len(options) == 4
    assert len(set(options)) == 4
    assert options[0] == "1443"
