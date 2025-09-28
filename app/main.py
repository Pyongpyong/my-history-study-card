from __future__ import annotations

import json
import mimetypes
import os
import uuid
from pathlib import Path
from typing import List, Optional, Tuple, Union

from fastapi import Body, Depends, FastAPI, File, Form, HTTPException, Query, Response, Security, UploadFile, status
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import APIKeyHeader
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from .routers import quiz as quiz_router

from .crud import (
    add_reward_to_session,
    create_card_deck,
    create_content_with_related,
    create_learning_helper,
    create_quiz_for_content,
    create_reward,
    create_study_session,
    create_user,
    delete_card_deck,
    delete_content,
    delete_quiz,
    delete_reward,
    delete_study_session,
    delete_user,
    export_contents,
    get_card_deck,
    get_content,
    get_default_card_deck,
    get_learning_helper,
    get_quiz,
    get_study_session,
    get_user_by_api_key,
    get_user_by_email,
    helper_to_out,
    helper_to_public,
    list_card_decks,
    list_contents,
    list_learning_helpers,
    list_quizzes,
    list_quizzes_by_content,
    list_rewards,
    list_study_sessions,
    list_public_study_sessions,
    get_public_study_session,
    resolve_helper_for_user,
    set_user_helper,
    update_card_deck,
    update_content,
    update_helper_variant,
    update_learning_helper,
    update_quiz,
    update_reward,
    update_study_session,
    update_user_credentials,
)
from .db import SessionLocal, init_db
from .models import User, StudySession
from .schemas import (
    AdminUserCreate,
    CardDeckCreate,
    CardDeckListOut,
    CardDeckOut,
    CardDeckUpdate,
    CardUnion,
    ContentListOut,
    ContentOut,
    ContentUpdate,
    ImportPayload,
    ImportResponse,
    LearningHelperCreate,
    LearningHelperListOut,
    LearningHelperOut,
    LearningHelperPublic,
    LearningHelperUpdate,
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
    UserDeleteRequest,
    UserHelperUpdate,
    UserLogin,
    UserPasswordUpdate,
    UserProfile,
)
from .security import generate_api_key, generate_password_hash, verify_password
from .routers.ai import router as ai_router
from .routers.assets import router as assets_router
from .validators import validate_payload
from .oci_storage import OciStorageConfigError, build_object_name, get_bucket_name, upload_object, fetch_object
from oci.exceptions import ServiceError

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
        is_max_level=user.level >= 10,  # Assuming level 10 is max
        selected_helper_id=user.selected_helper_id,
        selected_helper=helper_to_public(user.selected_helper),
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


@app.get("/helpers", response_model=LearningHelperListOut)
def list_helpers_endpoint(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> LearningHelperListOut:
    return LearningHelperListOut(items=list_learning_helpers(db, current_user))


@app.get("/helpers/{helper_id}", response_model=LearningHelperOut)
def get_helper_endpoint(
    helper_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> LearningHelperOut:
    helper = get_learning_helper(db, helper_id)
    if helper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helper not found")
    return helper_to_out(helper, current_user)


@app.post("/helpers", response_model=LearningHelperPublic, status_code=status.HTTP_201_CREATED)
def create_helper_endpoint(
    payload: LearningHelperCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> LearningHelperPublic:
    try:
        return create_learning_helper(db, payload)
    except ValueError as exc:
        if str(exc) == "LEVEL_EXISTS":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Helper level already exists")
        raise


@app.patch("/helpers/{helper_id}", response_model=LearningHelperPublic)
def update_helper_endpoint(
    helper_id: int,
    payload: LearningHelperUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> LearningHelperPublic:
    helper = get_learning_helper(db, helper_id)
    if helper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helper not found")
    try:
        return update_learning_helper(db, helper, payload)
    except ValueError as exc:
        if str(exc) == "LEVEL_EXISTS":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Helper level already exists")
        raise


@app.post("/helpers/{helper_id}/upload", response_model=LearningHelperPublic)
async def upload_helper_image_endpoint(
    helper_id: int,
    variant: str = Form(..., description="idle/correct/incorrect"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> LearningHelperPublic:
    helper = get_learning_helper(db, helper_id)
    if helper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helper not found")

    normalized_variant = variant.strip().lower()
    if normalized_variant not in {"idle", "correct", "incorrect"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid variant")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    suffix = Path(file.filename or "").suffix.lower()
    allowed_suffixes = {".png", ".jpg", ".jpeg", ".avif", ".webp"}
    if suffix not in allowed_suffixes:
        suffix = ".png"

    content_type = file.content_type or mimetypes.types_map.get(suffix, "image/png")
    if content_type is None:
        content_type = "application/octet-stream"

    raw_object_name = f"helpers/helper_{helper.level_requirement:02d}_{normalized_variant}_{uuid.uuid4().hex}{suffix}"

    try:
        bucket = get_bucket_name()
        upload_object(bucket, build_object_name(raw_object_name), data, content_type=content_type)
    except OciStorageConfigError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to upload helper image to OCI") from exc

    return update_helper_variant(db, helper, normalized_variant, raw_object_name)


@app.delete("/helpers/{helper_id}")
def delete_helper_endpoint(
    helper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """학습 도우미를 삭제합니다. (관리자 전용)"""
    from .crud import get_learning_helper, delete_learning_helper
    
    helper = get_learning_helper(db, helper_id)
    if not helper:
        raise HTTPException(status_code=404, detail="학습 도우미를 찾을 수 없습니다.")
    
    try:
        delete_learning_helper(db, helper_id)
        return {"message": "학습 도우미가 성공적으로 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"학습 도우미 삭제 실패: {str(e)}")


@app.get("/helpers/{helper_id}/image/{variant}")
def get_helper_image_endpoint(
    helper_id: int,
    variant: str,
    db: Session = Depends(get_db),
) -> Response:
    helper = get_learning_helper(db, helper_id)
    if helper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helper not found")

    variant_field_map = {
        "idle": "image_idle",
        "correct": "image_correct",
        "incorrect": "image_incorrect",
    }
    normalized_variant = variant.strip().lower()
    field_name = variant_field_map.get(normalized_variant)
    if field_name is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    object_name = getattr(helper, field_name, None)
    if not object_name:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    try:
        bucket = get_bucket_name()
        response = fetch_object(bucket, build_object_name(object_name))
    except OciStorageConfigError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ServiceError as exc:
        if exc.status == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found") from exc
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch image from OCI") from exc

    content_type = response.headers.get("Content-Type", "image/avif")
    content_length = response.headers.get("Content-Length")

    if hasattr(response.data, "content") and response.data.content is not None:
        headers = {"Cache-Control": "public, max-age=3600"}
        if content_length:
            headers["Content-Length"] = content_length
        return Response(content=response.data.content, media_type=content_type, headers=headers)

    stream = response.data.raw
    headers = {"Cache-Control": "public, max-age=3600"}
    if content_length:
        headers["Content-Length"] = content_length
    return StreamingResponse(stream, media_type=content_type, headers=headers)


@app.patch("/users/me/helper", response_model=UserProfile)
def set_user_helper_endpoint(
    payload: UserHelperUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfile:
    helper = get_learning_helper(db, payload.helper_id)
    if helper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helper not found")
    if current_user.level < helper.level_requirement:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Helper locked for current level")
    set_user_helper(db, current_user, helper)
    return _user_to_profile(current_user)


@app.post("/study-sessions", response_model=StudySessionOut, status_code=status.HTTP_201_CREATED)
def create_study_session_endpoint(
    payload: StudySessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySessionOut:
    # 관리자가 아닌 사용자가 공개 학습을 생성하려고 하면 거부
    if payload.is_public and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only administrators can create public study sessions"
        )
    
    try:
        resolve_helper_for_user(db, current_user, payload.helper_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helper not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Helper locked for current level")
    result = create_study_session(db, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create study session with provided data")
    return result


@app.post("/admin/public-study-sessions", response_model=StudySessionOut, status_code=status.HTTP_201_CREATED)
def create_public_study_session_endpoint(
    payload: StudySessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> StudySessionOut:
    """관리자가 공개 학습 세션을 생성합니다."""
    # 관리자는 모든 헬퍼에 접근 가능하므로 헬퍼 검증을 건너뜁니다
    # 공개 학습으로 강제 설정
    payload.is_public = True
    result = create_study_session(db, payload, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create public study session with provided data")
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


@app.get("/public/study-sessions", response_model=StudySessionListOut)
def list_public_study_sessions_endpoint(
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
) -> StudySessionListOut:
    """공개 학습 세션 목록을 조회합니다 (로그인 불필요)"""
    page = max(page, 1)
    size = max(min(size, 100), 1)
    items, total = list_public_study_sessions(db, page, size)
    meta = PageMeta(page=page, size=size, total=total)
    return StudySessionListOut(items=items, meta=meta)


@app.get("/admin/study-sessions", response_model=StudySessionListOut)
def admin_list_study_sessions_endpoint(
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> StudySessionListOut:
    """관리자가 모든 학습 세션을 조회합니다"""
    
    page = max(page, 1)
    size = max(min(size, 100), 1)
    offset = (page - 1) * size
    
    # 모든 학습 세션 조회 (소유자 제한 없음)
    query = (
        select(StudySession)
        .options(
            selectinload(StudySession.helper),
            selectinload(StudySession.card_deck),
            selectinload(StudySession.rewards)
        )
        .order_by(StudySession.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    
    studies = db.execute(query).scalars().all()
    
    # 총 개수 조회
    count_query = select(func.count(StudySession.id))
    total = db.execute(count_query).scalar() or 0
    
    from .crud import _study_session_to_out
    results = [_study_session_to_out(study) for study in studies]
    meta = PageMeta(page=page, size=size, total=total)
    return StudySessionListOut(items=results, meta=meta)


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


@app.get("/public/study-sessions/{session_id}", response_model=StudySessionOut)
def get_public_study_session_endpoint(
    session_id: int,
    db: Session = Depends(get_db),
) -> StudySessionOut:
    """공개 학습 세션을 조회합니다 (로그인 불필요)"""
    result = get_public_study_session(db, session_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public study session not found")
    return result


@app.patch("/study-sessions/{session_id}", response_model=StudySessionOut)
def update_study_session_endpoint(
    session_id: int,
    updates: StudySessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySessionOut:
    data = updates.model_dump(exclude_unset=True)
    if "helper_id" in data:
        try:
            resolve_helper_for_user(db, current_user, data.get("helper_id"))
        except ValueError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helper not found")
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Helper locked for current level")
    result = update_study_session(db, session_id, data, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    return result


@app.patch("/admin/study-sessions/{session_id}", response_model=StudySessionOut)
def admin_update_study_session_endpoint(
    session_id: int,
    updates: StudySessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> StudySessionOut:
    """관리자가 모든 학습 세션을 업데이트할 수 있습니다 (공개/비공개 전환 포함)"""
    data = updates.model_dump(exclude_unset=True)
    
    # 관리자는 소유자 확인 없이 모든 학습 세션을 수정할 수 있도록 특별한 로직 필요
    study = db.execute(select(StudySession).where(StudySession.id == session_id)).scalar_one_or_none()
    if study is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study session not found")
    
    # 관리자는 헬퍼 제한 없이 업데이트 가능
    result = update_study_session(db, session_id, data, study.owner)
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


@app.post("/quizzes", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def create_quiz_endpoint(
    payload: CardUnion,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizOut:
    from .crud import create_quiz
    result = create_quiz(db, payload, current_user)
    return result

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


# Card Deck endpoints
@app.post("/card-decks", response_model=CardDeckOut)
def create_card_deck_endpoint(
    card_deck_data: CardDeckCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """카드덱을 생성합니다. (관리자 전용)"""
    try:
        card_deck = create_card_deck(db, card_deck_data.model_dump())
        return card_deck
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"카드덱 생성 실패: {str(e)}")


@app.get("/card-decks", response_model=CardDeckListOut)
def list_card_decks_endpoint(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """카드덱 목록을 조회합니다."""
    skip = (page - 1) * size
    items, total = list_card_decks(db, skip=skip, limit=size)
    
    return CardDeckListOut(
        items=items,
        meta=PageMeta(
            page=page,
            size=size,
            total=total,
            pages=(total + size - 1) // size,
        ),
    )


@app.get("/card-decks/default", response_model=CardDeckOut)
def get_default_card_deck_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """기본 카드덱을 조회합니다."""
    card_deck = get_default_card_deck(db)
    if not card_deck:
        raise HTTPException(status_code=404, detail="기본 카드덱을 찾을 수 없습니다")
    return card_deck


@app.get("/card-decks/{card_deck_id}", response_model=CardDeckOut)
def get_card_deck_endpoint(
    card_deck_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """특정 카드덱을 조회합니다."""
    card_deck = get_card_deck(db, card_deck_id)
    if not card_deck:
        raise HTTPException(status_code=404, detail="카드덱을 찾을 수 없습니다")
    return card_deck


@app.put("/card-decks/{card_deck_id}", response_model=CardDeckOut)
def update_card_deck_endpoint(
    card_deck_id: int,
    update_data: CardDeckUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """카드덱을 수정합니다. (관리자 전용)"""
    card_deck = update_card_deck(
        db, card_deck_id, update_data.model_dump(exclude_unset=True)
    )
    if not card_deck:
        raise HTTPException(status_code=404, detail="카드덱을 찾을 수 없습니다")
    return card_deck


@app.delete("/card-decks/{card_deck_id}")
def delete_card_deck_endpoint(
    card_deck_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """카드덱을 삭제합니다. (관리자 전용)"""
    success = delete_card_deck(db, card_deck_id)
    if not success:
        raise HTTPException(
            status_code=400, 
            detail="카드덱을 삭제할 수 없습니다. 기본 카드덱이거나 존재하지 않는 카드덱입니다."
        )
    return {"message": "카드덱이 성공적으로 삭제되었습니다"}


@app.post("/upload-card-deck-image")
async def upload_card_deck_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin),
):
    """카드덱 이미지를 업로드합니다. (관리자 전용)"""
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")
    
    # 파일 확장자 확인
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.avif'}
    file_extension = Path(file.filename or '').suffix.lower()
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")
    
    try:
        # 고유한 파일명 생성
        unique_filename = f"card_deck_{uuid.uuid4().hex}{file_extension}"
        
        # OCI 버킷에 업로드
        bucket = get_bucket_name()
        object_name = build_object_name(unique_filename)
        
        # 파일 내용 읽기
        file_content = await file.read()
        
        # OCI에 업로드
        upload_object(bucket, object_name, file_content, content_type=file.content_type)
        
        return {"filename": unique_filename}
        
    except OciStorageConfigError as exc:
        raise HTTPException(status_code=500, detail=f"스토리지 설정 오류: {str(exc)}") from exc
    except ServiceError as exc:
        raise HTTPException(status_code=502, detail=f"파일 업로드 실패: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"업로드 중 오류가 발생했습니다: {str(exc)}") from exc


# Include routers
app.include_router(quiz_router.router)

_mount_frontend()
