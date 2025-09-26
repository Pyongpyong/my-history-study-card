from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from ..db import get_db, SessionLocal
from .. import crud, schemas
from ..models import User

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def get_optional_user(
    db: Session = Depends(get_db),
    api_key: Optional[str] = Security(api_key_header),
) -> Optional[User]:
    if not api_key:
        return None
    user = crud.get_user_by_api_key(db, api_key)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return user

def get_current_user(user: Optional[User] = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

@router.post("/submit", response_model=Dict[str, Any])
async def submit_quiz_answer(
    quiz_data: schemas.QuizSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    퀴즈 답변을 제출하고 결과를 반환합니다.
    정답인 경우 즉시 포인트를 지급합니다.
    """
    return crud.submit_quiz_answer(
        session=db,
        user_id=current_user.id,
        quiz_id=quiz_data.quiz_id,
        is_correct=quiz_data.is_correct
    )
