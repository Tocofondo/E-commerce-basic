"""Modelo de usuario."""

import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db.base import Base
from app.modules.auth.schemas import UserRole

# Sin 0/O/1/I para que se pueda dictar sin confundir.
_REFERRAL_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def new_referral_code() -> str:
    # 32^8 ≈ 10^12 combinaciones: un choque es improbable y, si pasa, lo
    # frena el UNIQUE de la columna.
    return "".join(secrets.choice(_REFERRAL_ALPHABET) for _ in range(8))


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('customer', 'admin')", name="ck_users_role"),
        # Los emails se guardan normalizados (ver auth/schemas.normalize_email):
        # así el índice único de `email` ya es case-insensitive.
        CheckConstraint("email = lower(email)", name="ck_users_email_lowercase"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # String simple (no enum nativo de Postgres) para que agregar un rol nuevo
    # sea solo un cambio de código + migración de datos, no un ALTER TYPE.
    role: Mapped[UserRole] = mapped_column(String(20), default="customer", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Programa de referidos (ver modules/promotions): código propio para
    # invitar (`/register?ref=<code>`), quién lo invitó a él y cuándo ese
    # que lo invitó ya cobró el premio (una sola vez por invitado).
    referral_code: Mapped[str] = mapped_column(
        String(16), unique=True, nullable=False, default=new_referral_code
    )
    referred_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    referral_rewarded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
