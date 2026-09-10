"""Lógica de negocio de auth. Sin dependencias de FastAPI (Request/Response):
recibe una Session y datos ya validados, así se puede testear o reusar desde
otro módulo sin pasar por HTTP.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.modules.auth.models import User
from app.modules.auth.schemas import UserCreate

logger = logging.getLogger(__name__)


class EmailAlreadyRegisteredError(Exception):
    pass


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def create_user(db: Session, user_in: UserCreate) -> User:
    if get_user_by_email(db, user_in.email) is not None:
        raise EmailAlreadyRegisteredError(user_in.email)

    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Usuario registrado: %s", user.email)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user
