import io
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import DB_PATH
from app.main import app


@pytest.fixture(autouse=True)
def reset_db():
    if DB_PATH.exists():
        DB_PATH.unlink()
    yield
    if DB_PATH.exists():
        DB_PATH.unlink()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


EXAMPLE_PAYLOAD = {
    "title": "세종대왕",
    "content": "세종대왕은 조선의 네 번째 왕으로, 훈민정음을 창제하여 백성이 쉽게 글을 배울 수 있도록 했다. 집현전 학자들의 도움으로 측우기와 같은 과학 기술도 발전시켰다. 그의 치세는 조선 전성기의 기반을 마련했다.",
    "highlights": ["세종대왕", "조선", "훈민정음", "집현전", "측우기"],
    "cards": [
        {
            "type": "MCQ",
            "question": "훈민정음을 창제하여 백성이 글을 쉽게 배우게 한 왕은 누구인가?",
            "options": ["세종대왕", "태종", "정조", "광해군"],
            "answer_index": 0,
            "explain": "첫 번째 문장에 세종대왕이 훈민정음을 창제했다고 명시됨.",
        },
        {
            "type": "SHORT",
            "prompt": "조선의 네 번째 왕으로 훈민정음을 창제한 인물은?",
            "answer": "세종대왕",
            "rubric": {"aliases": ["세종", "세종 대왕"]},
            "explain": "첫 번째 문장 근거.",
        },
        {
            "type": "OX",
            "statement": "세종대왕은 조선의 네 번째 왕이다.",
            "answer": True,
            "explain": "첫 번째 문장 근거.",
        },
        {
            "type": "CLOZE",
            "text": "세종대왕은 조선의 {{c1}} 번째 왕으로, {{c2}}을 창제하였다.",
            "clozes": {"c1": "네", "c2": "훈민정음"},
            "explain": "첫 번째 문장 근거.",
        },
        {
            "type": "ORDER",
            "items": ["훈민정음 창제", "과학 기술 발전", "조선 전성기 기반 마련"],
            "answer_order": [0, 1, 2],
            "explain": "문장 흐름 순서 사용.",
        },
        {
            "type": "MATCH",
            "left": ["세종대왕", "집현전 학자들", "조선 전성기"],
            "right": ["훈민정음 창제", "과학 기술 발전", "기반 마련"],
            "pairs": [[0, 0], [1, 1], [2, 2]],
            "explain": "각 명사구의 직접 대응.",
        },
    ],
}


def test_import_json(client: TestClient):
    response = client.post("/import/json", json=EXAMPLE_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["counts"] == {"highlights": 5, "quizzes": 6, "cards": 6}
    assert isinstance(data["content_id"], int)
    assert len(data["highlight_ids"]) == 5
    assert len(data["quiz_ids"]) == 6

    summary = client.get(f"/contents/{data['content_id']}")
    assert summary.status_code == 200
    summary_payload = summary.json()
    assert summary_payload["title"] == EXAMPLE_PAYLOAD["title"]
    assert len(summary_payload["highlights"]) == 5
    assert summary_payload["visibility"] == "PUBLIC"
    assert summary_payload["owner_id"] is None

    cards_response = client.get(f"/contents/{data['content_id']}/cards")
    assert cards_response.status_code == 200
    cards_payload = cards_response.json()
    assert len(cards_payload["cards"]) == 6


def test_import_json_file(client: TestClient):
    buffer = io.BytesIO(json.dumps(EXAMPLE_PAYLOAD, ensure_ascii=False).encode("utf-8"))
    files = {"file": ("payload.json", buffer, "application/json")}
    response = client.post("/import/json-file", files=files)
    assert response.status_code == 201
    data = response.json()
    assert data["counts"] == {"highlights": 5, "quizzes": 6, "cards": 6}
    assert isinstance(data["content_id"], int)

    # Clean up by deleting content
    delete_res = client.delete(f"/contents/{data['content_id']}")
    assert delete_res.status_code == 204

    missing = client.get(f"/contents/{data['content_id']}")
    assert missing.status_code == 404
