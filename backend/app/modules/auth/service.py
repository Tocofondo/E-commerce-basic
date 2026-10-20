"""Lógica de negocio de auth. Sin dependencias de FastAPI (Request/Response):
recibe una Session y datos ya validados, así se puede testear o reusar desde
otro módulo sin pasar por HTTP.
"""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.modules.auth.models import User
from app.modules.auth.schemas import UserCreate, UserRole, UserUpdate, normalize_email

logger = logging.getLogger(__name__)

# Hash de una contraseña cualquiera, para gastar lo mismo que un login real
# cuando el email no existe (ver `authenticate_user`).
_DUMMY_HASH = hash_password("timing-equalizer")


class EmailAlreadyRegisteredError(Exception):
    pass


def get_user_by_email(db: Session, email: str) -> User | None:
    # Normaliza también acá (no solo en los schemas): el login llega como
    # form (`OAuth2PasswordRequestForm.username`) y el `sub` de los JWT
    # viejos puede tener mayúsculas.
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def create_user(db: Session, user_in: UserCreate, role: UserRole = "customer") -> User:
    """Crea un usuario. `role` no es parte de `UserCreate` a propósito: el
    endpoint público de registro nunca lo recibe del cliente. Solo código de
    servidor (ej. el seed) puede pasar role="admin".
    """
    if get_user_by_email(db, user_in.email) is not None:
        raise EmailAlreadyRegisteredError(user_in.email)

    user = User(
        email=user_in.email,
        phone=user_in.phone,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        # Dos registros simultáneos con el mismo email pasan los dos el
        # chequeo de arriba; el UNIQUE de la DB frena al segundo.
        db.rollback()
        raise EmailAlreadyRegisteredError(user_in.email) from exc
    db.refresh(user)
    logger.info("Usuario creado: %s (role=%s)", user.email, user.role)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None:
        # Mismo costo (bcrypt) exista o no la cuenta: si no, el tiempo de
        # respuesta delata qué emails están registrados.
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def set_password(db: Session, user: User, new_password: str) -> None:
    user.hashed_password = hash_password(new_password)
    db.add(user)
    db.commit()
    logger.info("Contraseña actualizada: %s", user.email)


def update_profile(db: Session, user: User, data: UserUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "phone" and value is None:
            continue  # la columna es NOT NULL: null = no tocar
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
