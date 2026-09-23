"""Utilidades criptográficas: hashing de contraseñas y JWT.

No depende de SQLAlchemy ni de ningún modelo: recibe/devuelve tipos simples
para que cualquier módulo (no solo auth) pueda usarlo.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = settings.JWT_ALGORITHM


# --- Contraseñas ---


def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError:
        # Hash corrupto/formato inválido: nunca autenticar.
        return False


# --- JWT ---


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Devuelve el payload del token, o None si es inválido/expiró."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


# --- Reset de contraseña ---
# Token JWT de un solo propósito (`scope="password_reset"`), vida corta y sin
# estado en DB: reusa la misma clave/algoritmo que el access token pero un
# reset token nunca sirve para autenticarse (lo filtra el `scope`) y un
# access token nunca sirve para resetear la contraseña.

PASSWORD_RESET_EXPIRE_MINUTES = 30


def create_password_reset_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire, "scope": "password_reset"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_password_reset_token(token: str) -> str | None:
    """Devuelve el email (subject) si el token es válido y tiene el scope
    correcto, o None si es inválido/expiró/es un token de otro tipo."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("scope") != "password_reset":
        return None
    return payload.get("sub")
