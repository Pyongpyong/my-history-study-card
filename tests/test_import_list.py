import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import DB_PATH
from app.main import app

SAMPLE_PAYLOAD = {
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


def test_import_and_list(client: TestClient):
    register = client.post(
        "/users",
        json={"email": "tester@example.com", "password": "secret123"},
    )
    assert register.status_code == 201
    auth = register.json()
    api_key = auth["api_key"]
    headers = {"X-API-Key": api_key}

    payload = {**SAMPLE_PAYLOAD, "visibility": "PUBLIC"}

    response = client.post("/import/json", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    content_id = data["content_id"]
    assert data["counts"] == {"highlights": 5, "quizzes": 6, "cards": 6}

    list_response = client.get("/contents")
    assert list_response.status_code == 200
    list_data = list_response.json()
    assert list_data["meta"]["total"] >= 1
    assert any("세종대왕" in item["title"] for item in list_data["items"])

    detail_response = client.get(f"/contents/{content_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["title"] == SAMPLE_PAYLOAD["title"]
    assert len(detail["highlights"]) == 5
    assert detail["visibility"] == "PUBLIC"
    assert detail["owner_id"] == auth["user"]["id"]

    quizzes_response = client.get(f"/contents/{content_id}/quizzes")
    assert quizzes_response.status_code == 200
    quizzes = quizzes_response.json()
    assert quizzes["meta"]["total"] == 6
    assert len(quizzes["items"]) == 6
    mcq = next((item for item in quizzes["items"] if item["type"] == "MCQ"), None)
    assert mcq is not None
    assert mcq["payload"]["question"].startswith("훈민정음")

    filtered = client.get("/quizzes", params={"type": "MCQ"})
    assert filtered.status_code == 200
    filtered_data = filtered.json()
    assert filtered_data["meta"]["total"] >= 1
    assert all(item["type"] == "MCQ" for item in filtered_data["items"])

    delete_response = client.delete(f"/contents/{content_id}", headers=headers)
    assert delete_response.status_code == 204

    missing = client.get(f"/contents/{content_id}")
    assert missing.status_code == 404


def test_private_content_requires_auth(client: TestClient):
    owner_resp = client.post(
        "/users",
        json={"email": "owner@example.com", "password": "secret123"},
    )
    assert owner_resp.status_code == 201
    owner_auth = owner_resp.json()
    owner_headers = {"X-API-Key": owner_auth["api_key"]}

    payload = {
        **SAMPLE_PAYLOAD,
        "title": "비공개 콘텐츠",
        "visibility": "PRIVATE",
    }

    create_resp = client.post("/import/json", json=payload, headers=owner_headers)
    assert create_resp.status_code == 201
    created = create_resp.json()
    content_id = created["content_id"]

    public_list = client.get("/contents")
    assert public_list.status_code == 200
    assert all(item["id"] != content_id for item in public_list.json()["items"])

    unauthorized_detail = client.get(f"/contents/{content_id}")
    assert unauthorized_detail.status_code == 404

    unauthorized_quizzes = client.get(f"/contents/{content_id}/quizzes")
    assert unauthorized_quizzes.status_code == 404

    owner_detail = client.get(f"/contents/{content_id}", headers=owner_headers)
    assert owner_detail.status_code == 200
    assert owner_detail.json()["visibility"] == "PRIVATE"

    other_resp = client.post(
        "/users",
        json={"email": "other@example.com", "password": "secret123"},
    )
    assert other_resp.status_code == 201
    other_headers = {"X-API-Key": other_resp.json()["api_key"]}

    forbidden_detail = client.get(f"/contents/{content_id}", headers=other_headers)
    assert forbidden_detail.status_code == 404

    delete_forbidden = client.delete(f"/contents/{content_id}", headers=other_headers)
    assert delete_forbidden.status_code == 404

    owner_delete = client.delete(f"/contents/{content_id}", headers=owner_headers)
    assert owner_delete.status_code == 204
