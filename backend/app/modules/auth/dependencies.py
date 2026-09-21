"""Dependencias de FastAPI relacionadas a auth (sesión de DB + usuario actual).

Otros módulos importan `get_current_user` de acá para proteger sus propios
endpoints, sin tener que reimplementar la validación del token.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.core.db.session import get_db
from app.modules.auth.models import User
from app.modules.auth.schemas import TokenPayload
from app.modules.auth.service import get_user_by_email

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No se pudo validar las credenciales",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    token_data = TokenPayload(**payload)
    if token_data.sub is None:
        raise credentials_exception

    user = get_user_by_email(db, token_data.sub)
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario inactivo")
    return current_user


def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Para endpoints de admin (CRUD de products, gestión de orders, etc.)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return current_user
