from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional, Tuple, Union

from fastapi import Body, Depends, FastAPI, File, HTTPException, Response, Security, UploadFile, status
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.orm import Session

from .routers import quiz as quiz_router

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
    create_user,
    delete_user,
    get_user_by_api_key,
    get_user_by_email,
    update_user_credentials,
)
from .db import SessionLocal, init_db
from .models import User
from .schemas import (
    AdminUserCreate,
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
    UserAuthResponse,
    UserCreate,
    UserLogin,
    UserProfile,
    UserPasswordUpdate,
    UserDeleteRequest,
)
from .security import generate_api_key, generate_password_hash, verify_password
from .routers.ai import router as ai_router
from .routers.assets import router as assets_router
from .validators import validate_payload

app = FastAPI(title="Flashcard Storage Service", version="0.1.0")

app.include_router(ai_router)
app.include_router(assets_router)

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_optional_user(
    db: Session = Depends(get_db),
    api_key: Optional[str] = Security(api_key_header),
) -> Optional[User]:
    if not api_key:
        return None
    user = get_user_by_api_key(db, api_key)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return user


def get_current_user(user: Optional[User] = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


def _user_to_profile(user: User) -> UserProfile:
    from .user_levels import get_user_stats
    
    user_stats = get_user_stats(user)
    return UserProfile(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        is_admin=bool(user.is_admin),
        points=user.points,
        level=user.level,
        points_to_next_level=user_stats.get('points_to_next_level', 0),
        is_max_level=user.level >= 10  # Assuming level 10 is max
    )

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


def _ensure_default_admin() -> None:
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    if not email or not password:
        return
    with SessionLocal() as session:
        existing = get_user_by_email(session, email)
        if existing is None:
            password_hash = generate_password_hash(password)
            api_key = generate_api_key()
            create_user(session, email, password_hash, api_key, is_admin=True)
            return
        changed = False
        if not existing.is_admin:
            existing.is_admin = True
            changed = True
        if not verify_password(password, existing.password_hash):
            existing.password_hash = generate_password_hash(password)
            changed = True
        if changed:
            existing.api_key = generate_api_key()
            session.commit()
            session.refresh(existing)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    _ensure_default_admin()


def _spa_index_path() -> Path | None:
    raw_path = os.getenv("FRONTEND_DIST", "frontend/dist")
    if not raw_path:
        return None
    candidate = Path(raw_path).resolve() / "index.html"
    if candidate.exists():
        return candidate
    return None


@app.middleware("http")
async def spa_fallback(request, call_next):
    accept = request.headers.get("accept", "")
    is_html_request = request.method == "GET" and "text/html" in accept
    is_api_docs = request.url.path.startswith("/docs") or request.url.path.startswith("/redoc")
    has_extension = "." in request.url.path.split("/")[-1]

    if is_html_request and not is_api_docs and not has_extension:
        index_path = _spa_index_path()
        if index_path is not None:
            return HTMLResponse(index_path.read_text(encoding="utf-8"))
    return await call_next(request)


@app.post("/import/json", response_model=ImportResponse, status_code=status.HTTP_201_CREATED)
@app.post(
    "/import/json",
    response_model=Union[ImportResponse, List[ImportResponse]],
    status_code=status.HTTP_201_CREATED,
)
def import_json(
    payload: Union[ImportPayload, List[ImportPayload]] = Body(...),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> Union[ImportResponse, List[ImportResponse]]:
    return _process_payload(payload, db, user)


@app.post(
    "/import/json-file",
    response_model=Union[ImportResponse, List[ImportResponse]],
    status_code=status.HTTP_201_CREATED,
)
async def import_json_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
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
    return _process_payload(payload, db, user)


def _process_payload(
    payload: Union[ImportPayload, List[ImportPayload]],
    db: Session,
    owner: Optional[User],
) -> Union[ImportResponse, List[ImportResponse]]:
    def process(item: ImportPayload) -> ImportResponse:
        validate_payload(item)
        content_id, highlight_ids, quiz_ids = create_content_with_related(db, item, owner)
        return ImportResponse(
            content_id=content_id,
            highlight_ids=highlight_ids,
            quiz_ids=quiz_ids,
            counts={
                "highlights": len(highlight_ids),
                "quizzes": len(quiz_ids),
                "cards": len(quiz_ids),
            },
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
    user: Optional[User] = Depends(get_optional_user),
) -> ContentListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    items, total = list_contents(db, q, page, size, order, user)
    meta = PageMeta(page=page, size=size, total=total)
    return ContentListOut(items=items, meta=meta)


@app.get("/contents/export", response_class=Response)
def export_contents_endpoint(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> Response:
    data = export_contents(db, user)
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=contents.json"},
    )


@app.get("/contents/{content_id}", response_model=ContentOut)
def get_content_endpoint(
    content_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> ContentOut:
    item = get_content(db, content_id, user)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return item


@app.patch("/contents/{content_id}", response_model=ContentOut)
def update_content_endpoint(
    content_id: int,
    payload: ContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ContentOut:
    result = update_content(db, content_id, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return result


@app.get("/contents/{content_id}/quizzes", response_model=QuizListOut)
def list_content_quizzes(
    content_id: int,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> QuizListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    if get_content(db, content_id, user) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    items, total = list_quizzes_by_content(db, content_id, page, size, user)
    meta = PageMeta(page=page, size=size, total=total)
    return QuizListOut(items=items, meta=meta)


@app.get("/contents/{content_id}/cards")
def list_content_cards(
    content_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> dict:
    if get_content(db, content_id, user) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    items, _ = list_quizzes_by_content(db, content_id, page=1, size=500, requester=user)
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
    user: Optional[User] = Depends(get_optional_user),
) -> QuizListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    quiz_type = None
    if type is not None:
        quiz_type = type.upper()
        valid_types = {"MCQ", "SHORT", "OX", "CLOZE", "ORDER", "MATCH"}
        if quiz_type not in valid_types:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid quiz type")
    items, total = list_quizzes(db, content_id, quiz_type, page, size, user)
    meta = PageMeta(page=page, size=size, total=total)
    return QuizListOut(items=items, meta=meta)


@app.delete("/contents/{content_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_content_endpoint(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    deleted = delete_content(db, content_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/study-sessions", response_model=StudySessionOut, status_code=status.HTTP_201_CREATED)
def create_study_session_endpoint(
    payload: StudySessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySessionOut:
    result = create_study_session(db, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create study session with provided quizzes")
    return result


@app.get("/study-sessions", response_model=StudySessionListOut)
def list_study_sessions_endpoint(
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySessionListOut:
    page = max(page, 1)
    size = max(min(size, 100), 1)
    items, total = list_study_sessions(db, page, size, current_user)
    meta = PageMeta(page=page, size=size, total=total)
    return StudySessionListOut(items=items, meta=meta)


@app.get("/study-sessions/{session_id}", response_model=StudySessionOut)
def get_study_session_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySessionOut:
    result = get_study_session(db, session_id, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    return result


@app.patch("/study-sessions/{session_id}", response_model=StudySessionOut)
def update_study_session_endpoint(
    session_id: int,
    updates: StudySessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySessionOut:
    result = update_study_session(db, session_id, updates.model_dump(exclude_unset=True), current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    return result


@app.delete("/study-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_study_session_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    deleted = delete_study_session(db, session_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/rewards", response_model=RewardListOut)
def list_rewards_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RewardListOut:
    return RewardListOut(items=list_rewards(db, current_user))


@app.post("/rewards", response_model=RewardOut, status_code=status.HTTP_201_CREATED)
def create_reward_endpoint(
    payload: RewardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RewardOut:
    return create_reward(db, payload, current_user)


@app.post("/contents/{content_id}/quizzes", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_content_quiz_endpoint(
    content_id: int,
    payload: CardUnion,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizOut:
    result = create_quiz_for_content(db, content_id, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content not found")
    return result


@app.get("/quizzes/{quiz_id}", response_model=QuizOut)
def get_quiz_endpoint(
    quiz_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> QuizOut:
    result = get_quiz(db, quiz_id, user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return result


@app.patch("/quizzes/{quiz_id}", response_model=QuizOut)
def update_quiz_endpoint(
    quiz_id: int,
    payload: CardUnion,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizOut:
    result = update_quiz(db, quiz_id, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return result


@app.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_quiz_endpoint(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    deleted = delete_quiz(db, quiz_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.patch("/rewards/{reward_id}", response_model=RewardOut)
def update_reward_endpoint(
    reward_id: int,
    payload: RewardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RewardOut:
    result = update_reward(db, reward_id, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
    return result


@app.post("/study-sessions/{session_id}/rewards", response_model=StudySessionOut)
def add_reward_to_study_session_endpoint(
    session_id: int,
    payload: RewardAssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySessionOut:
    result = add_reward_to_session(db, session_id, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session or reward not found")
    return result


@app.delete("/rewards/{reward_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_reward_endpoint(
    reward_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    deleted = delete_reward(db, reward_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/users", response_model=UserAuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserAuthResponse:
    existing = get_user_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    password_hash = generate_password_hash(payload.password)
    api_key = generate_api_key()
    user = create_user(db, payload.email, password_hash, api_key)
    return UserAuthResponse(user=_user_to_profile(user), api_key=user.api_key)


@app.post("/auth/login", response_model=UserAuthResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)) -> UserAuthResponse:
    user = get_user_by_email(db, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return UserAuthResponse(user=_user_to_profile(user), api_key=user.api_key)


@app.get("/users/me", response_model=UserProfile)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserProfile:
    return _user_to_profile(current_user)


@app.get("/admin/users", response_model=list[UserProfile])
def list_users(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)) -> list[UserProfile]:
    _ = current_admin  # silence unused warning
    users = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
    return [_user_to_profile(user) for user in users]


@app.post("/admin/users", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserProfile:
    _ = current_admin
    existing = get_user_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    password_hash = generate_password_hash(payload.password)
    api_key = generate_api_key()
    user = create_user(db, payload.email, password_hash, api_key, is_admin=payload.is_admin)
    return _user_to_profile(user)


@app.post("/users/me/password", response_model=UserAuthResponse)
def change_password(
    payload: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserAuthResponse:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="현재 비밀번호가 올바르지 않습니다.")
    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="새 비밀번호가 기존 비밀번호와 같습니다.")
    password_hash = generate_password_hash(payload.new_password)
    api_key = generate_api_key()
    updated = update_user_credentials(db, current_user, password_hash, api_key)
    return UserAuthResponse(user=_user_to_profile(updated), api_key=updated.api_key)


@app.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_current_user(
    payload: UserDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="비밀번호가 올바르지 않습니다.")
    delete_user(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Include routers
app.include_router(quiz_router.router)

_mount_frontend()
