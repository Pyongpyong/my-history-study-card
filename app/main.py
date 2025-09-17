from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional, Tuple, Union

from fastapi import Body, Depends, FastAPI, File, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .crud import (
    add_reward_to_session,
    create_content_with_related,
    create_quiz_for_content,
    create_reward,
    create_study_session,
    delete_content,
    delete_quiz,
    delete_reward,
    delete_study_session,
    export_contents,
    get_content,
    get_quiz,
    get_study_session,
    list_contents,
    list_quizzes,
    list_quizzes_by_content,
    list_rewards,
    list_study_sessions,
    update_content,
    update_quiz,
    update_reward,
    update_study_session,
)
from .db import SessionLocal, init_db
from .schemas import (
    CardUnion,
    ContentListOut,
    ContentOut,
    ContentUpdate,
    ImportPayload,
    ImportResponse,
    PageMeta,
    QuizListOut,
    QuizOut,
    RewardAssignPayload,
    RewardCreate,
    RewardListOut,
    RewardOut,
    RewardUpdate,
    StudySessionCreate,
    StudySessionListOut,
    StudySessionOut,
    StudySessionUpdate,
)
from .validators import validate_payload

app = FastAPI(title="Flashcard Storage Service", version="0.1.0")

def _cors_config() -> Tuple[List[str], Optional[str]]:
    raw_origins = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173")
    origin_regex = os.getenv("CORS_ALLOW_ORIGIN_REGEX", "").strip() or None
    origins = [item.strip() for item in raw_origins.split(",") if item.strip()]
    if any(origin in {"*", "*:*"} for origin in origins):
        origins = []
        origin_regex = origin_regex or r".*"
    if not origins:
        origins = ["http://localhost:5173"] if origin_regex is None else []
    return origins, origin_regex


cors_origins, cors_origin_regex = _cors_config()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _mount_frontend() -> None:
    raw_path = os.getenv("FRONTEND_DIST", "frontend/dist")
    if not raw_path:
        return
    dist_path = Path(raw_path).resolve()
    if not dist_path.exists() or not dist_path.is_dir():
        return
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="frontend")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.post("/import/json", response_model=ImportResponse, status_code=status.HTTP_201_CREATED)
@app.post(
    "/import/json",
    response_model=Union[ImportResponse, List[ImportResponse]],
    status_code=status.HTTP_201_CREATED,
)
def import_json(
    payload: Union[ImportPayload, List[ImportPayload]] = Body(...),
    db: Session = Depends(get_db),
) -> Union[ImportResponse, List[ImportResponse]]:
    return _process_payload(payload, db)


@app.post(
    "/import/json-file",
    response_model=Union[ImportResponse, List[ImportResponse]],
    status_code=status.HTTP_201_CREATED,
)
async def import_json_file(
    file: UploadFile = File(...), db: Session = Depends(get_db)
) -> Union[ImportResponse, List[ImportResponse]]:
    if file.content_type not in ("application/json", "text/json", "application/octet-stream"):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file type")
    try:
        data = json.loads((await file.read()).decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload") from exc
    payload: Union[ImportPayload, List[ImportPayload]]
    if isinstance(data, list):
        payload = [ImportPayload.model_validate(item) for item in data]
    else:
        payload = ImportPayload.model_validate(data)
    return _process_payload(payload, db)


def _process_payload(
    payload: Union[ImportPayload, List[ImportPayload]], db: Session
) -> Union[ImportResponse, List[ImportResponse]]:
    def process(item: ImportPayload) -> ImportResponse:
        validate_payload(item)
        content_id, highlight_ids, quiz_ids = create_content_with_related(db, item)
        return ImportResponse(
            content_id=content_id,
            highlight_ids=highlight_ids,
            quiz_ids=quiz_ids,
            counts={"highlights": len(highlight_ids), "cards": len(quiz_ids)},
        )

    if isinstance(payload, list):
        return [process(item) for item in payload]
    return process(payload)


@app.get("/contents", response_model=ContentListOut)
def list_contents_endpoint(
    q: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    order: str = "created_desc",
    db: Session = Depends(get_db),
) -> ContentListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    items, total = list_contents(db, q, page, size, order)
    meta = PageMeta(page=page, size=size, total=total)
    return ContentListOut(items=items, meta=meta)


@app.get("/contents/export", response_class=Response)
def export_contents_endpoint(db: Session = Depends(get_db)) -> Response:
    data = export_contents(db)
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=contents.json"},
    )


@app.get("/contents/{content_id}", response_model=ContentOut)
def get_content_endpoint(content_id: int, db: Session = Depends(get_db)) -> ContentOut:
    item = get_content(db, content_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return item


@app.patch("/contents/{content_id}", response_model=ContentOut)
def update_content_endpoint(
    content_id: int, payload: ContentUpdate, db: Session = Depends(get_db)
) -> ContentOut:
    result = update_content(db, content_id, payload)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return result


@app.get("/contents/{content_id}/quizzes", response_model=QuizListOut)
def list_content_quizzes(
    content_id: int,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
) -> QuizListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    items, total = list_quizzes_by_content(db, content_id, page, size)
    meta = PageMeta(page=page, size=size, total=total)
    return QuizListOut(items=items, meta=meta)


@app.get("/contents/{content_id}/cards")
def list_content_cards(content_id: int, db: Session = Depends(get_db)) -> dict:
    items, _ = list_quizzes_by_content(db, content_id, page=1, size=500)
    cards = [
        {
          **item.payload,
          "id": item.id,
          "type": item.type,
          "content_id": item.content_id,
          "created_at": item.created_at,
        }
        for item in items
    ]
    return {"cards": cards}


@app.get("/quizzes", response_model=QuizListOut)
def list_quizzes_endpoint(
    content_id: Optional[int] = None,
    type: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
) -> QuizListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    quiz_type = None
    if type is not None:
        quiz_type = type.upper()
        valid_types = {"MCQ", "SHORT", "OX", "CLOZE", "ORDER", "MATCH"}
        if quiz_type not in valid_types:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid quiz type")
    items, total = list_quizzes(db, content_id, quiz_type, page, size)
    meta = PageMeta(page=page, size=size, total=total)
    return QuizListOut(items=items, meta=meta)


@app.delete("/contents/{content_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_content_endpoint(content_id: int, db: Session = Depends(get_db)) -> Response:
    deleted = delete_content(db, content_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/study-sessions", response_model=StudySessionOut, status_code=status.HTTP_201_CREATED)
def create_study_session_endpoint(payload: StudySessionCreate, db: Session = Depends(get_db)) -> StudySessionOut:
    return create_study_session(db, payload)


@app.get("/study-sessions", response_model=StudySessionListOut)
def list_study_sessions_endpoint(page: int = 1, size: int = 50, db: Session = Depends(get_db)) -> StudySessionListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    items, total = list_study_sessions(db, page, size)
    meta = PageMeta(page=page, size=size, total=total)
    return StudySessionListOut(items=items, meta=meta)


@app.get("/study-sessions/{session_id}", response_model=StudySessionOut)
def get_study_session_endpoint(session_id: int, db: Session = Depends(get_db)) -> StudySessionOut:
    result = get_study_session(db, session_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    return result


@app.patch("/study-sessions/{session_id}", response_model=StudySessionOut)
def update_study_session_endpoint(
    session_id: int, updates: StudySessionUpdate, db: Session = Depends(get_db)
) -> StudySessionOut:
    result = update_study_session(db, session_id, updates.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    return result


@app.delete("/study-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_study_session_endpoint(session_id: int, db: Session = Depends(get_db)) -> Response:
    deleted = delete_study_session(db, session_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/rewards", response_model=RewardListOut)
def list_rewards_endpoint(db: Session = Depends(get_db)) -> RewardListOut:
    return RewardListOut(items=list_rewards(db))


@app.post("/rewards", response_model=RewardOut, status_code=status.HTTP_201_CREATED)
def create_reward_endpoint(payload: RewardCreate, db: Session = Depends(get_db)) -> RewardOut:
    return create_reward(db, payload)


@app.post("/contents/{content_id}/quizzes", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_content_quiz_endpoint(
    content_id: int, payload: CardUnion, db: Session = Depends(get_db)
) -> QuizOut:
    result = create_quiz_for_content(db, content_id, payload)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return result


@app.get("/quizzes/{quiz_id}", response_model=QuizOut)
def get_quiz_endpoint(quiz_id: int, db: Session = Depends(get_db)) -> QuizOut:
    result = get_quiz(db, quiz_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return result


@app.patch("/quizzes/{quiz_id}", response_model=QuizOut)
def update_quiz_endpoint(quiz_id: int, payload: CardUnion, db: Session = Depends(get_db)) -> QuizOut:
    result = update_quiz(db, quiz_id, payload)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return result


@app.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_quiz_endpoint(quiz_id: int, db: Session = Depends(get_db)) -> Response:
    deleted = delete_quiz(db, quiz_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.patch("/rewards/{reward_id}", response_model=RewardOut)
def update_reward_endpoint(reward_id: int, payload: RewardUpdate, db: Session = Depends(get_db)) -> RewardOut:
    result = update_reward(db, reward_id, payload)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
    return result


@app.post("/study-sessions/{session_id}/rewards", response_model=StudySessionOut)
def add_reward_to_study_session_endpoint(
    session_id: int,
    payload: RewardAssignPayload,
    db: Session = Depends(get_db),
) -> StudySessionOut:
    result = add_reward_to_session(db, session_id, payload)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session or reward not found")
    return result


@app.delete("/rewards/{reward_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_reward_endpoint(reward_id: int, db: Session = Depends(get_db)) -> Response:
    deleted = delete_reward(db, reward_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


_mount_frontend()
