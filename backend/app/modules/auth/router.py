"""Endpoints HTTP de auth: registro, login y usuario actual."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.email import send_password_reset_email
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
)
from app.core.db.session import get_db
from app.modules.auth.dependencies import get_current_active_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserRead,
)
from app.modules.auth.service import (
    EmailAlreadyRegisteredError,
    authenticate_user,
    create_user,
    get_user_by_email,
    set_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> User:
    try:
        return create_user(db, user_in)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        ) from exc


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    # OAuth2PasswordRequestForm usa "username": acá el username es el email.
    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=user.email)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> dict:
    user = get_user_by_email(db, body.email)
    if user is not None:
        token = create_password_reset_token(user.email)
        send_password_reset_email(user.email, token)
    else:
        logger.info("Forgot-password para email no registrado: %s", body.email)
    # Mismo mensaje exista o no el email: no se revela si una cuenta existe.
    return {"detail": "Si el email está registrado, te enviamos un link para restablecer tu contraseña."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    email = decode_password_reset_token(body.token)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El link de reseteo es inválido o expiró",
        )
    user = get_user_by_email(db, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El link de reseteo es inválido o expiró",
        )
    set_password(db, user, body.new_password)
    return {"detail": "Contraseña actualizada"}
