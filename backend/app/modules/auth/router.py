"""Endpoints HTTP de auth: registro, login y usuario actual."""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.email import send_password_reset_email
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    password_fingerprint,
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
    normalize_email,
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

# Límites de intentos (ver core/rate_limit.py). Generosos por IP porque
# muchos clientes móviles comparten IP pública (CGNAT); más estrictos por
# email, que es lo que se ataca de verdad.
LOGIN_IP_LIMIT = (20, 60)  # 20 intentos por minuto por IP
LOGIN_EMAIL_FAILURES_LIMIT = (5, 300)  # 5 contraseñas mal en 5 min por email
REGISTER_IP_LIMIT = (10, 3600)
FORGOT_IP_LIMIT = (10, 3600)
FORGOT_EMAIL_LIMIT = (3, 3600)


def _send_password_reset_email_safe(email: str, token: str) -> None:
    """Corre después de responder (BackgroundTasks): si el SMTP falla, la
    respuesta ya salió igual que para un email inexistente, así que no se
    filtra si la cuenta existe; solo queda en el log."""
    try:
        send_password_reset_email(email, token)
    except Exception:
        logger.exception("No se pudo enviar el email de reseteo a %s", email)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)) -> User:
    rate_limit.hit(f"register:ip:{rate_limit.client_ip(request)}", *REGISTER_IP_LIMIT)
    try:
        return create_user(db, user_in)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        ) from exc


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    # OAuth2PasswordRequestForm usa "username": acá el username es el email.
    email_key = f"login:email:{normalize_email(form_data.username)}"
    rate_limit.hit(f"login:ip:{rate_limit.client_ip(request)}", *LOGIN_IP_LIMIT)
    rate_limit.ensure_not_limited(email_key, *LOGIN_EMAIL_FAILURES_LIMIT)

    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        # Por email solo cuentan los fallidos: el dueño de la cuenta que
        # entra bien no gasta intentos.
        rate_limit.record(email_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        subject=user.email, fingerprint=password_fingerprint(user.hashed_password)
    )
    return Token(access_token=access_token)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_active_user)) -> User:
    return current_user


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    # Sin esto, cualquiera podría usar el form para mandarle mails en masa
    # a una casilla ajena desde nuestro SMTP.
    rate_limit.hit(f"forgot:ip:{rate_limit.client_ip(request)}", *FORGOT_IP_LIMIT)
    rate_limit.hit(f"forgot:email:{body.email}", *FORGOT_EMAIL_LIMIT)

    user = get_user_by_email(db, body.email)
    if user is not None:
        token = create_password_reset_token(
            user.email, fingerprint=password_fingerprint(user.hashed_password)
        )
        background_tasks.add_task(_send_password_reset_email_safe, user.email, token)
    else:
        logger.info("Forgot-password para email no registrado: %s", body.email)
    # Mismo mensaje exista o no el email: no se revela si una cuenta existe.
    return {"detail": "Si el email está registrado, te enviamos un link para restablecer tu contraseña."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    invalid_link = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="El link de reseteo es inválido o expiró",
    )
    payload = decode_password_reset_token(body.token)
    if payload is None or payload.get("sub") is None:
        raise invalid_link
    user = get_user_by_email(db, payload["sub"])
    if user is None:
        raise invalid_link
    # La huella cambia al cambiar la contraseña: el link sirve una sola vez
    # (y uno pedido antes de otro cambio tampoco vale).
    if payload.get("pwd") != password_fingerprint(user.hashed_password):
        raise invalid_link
    set_password(db, user, body.new_password)
    return {"detail": "Contraseña actualizada"}
