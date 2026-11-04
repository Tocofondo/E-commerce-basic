"""Modelos de promociones y cupones (ver schemas.py para los tipos)."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db.base import Base
from app.core.money import MONEY_COLUMN
from app.modules.auth.models import User
from app.modules.products.models import Product
from app.modules.promotions.schemas import CouponOrigin, PromotionKind

PERCENT_COLUMN = Numeric(5, 2)


class Promotion(Base):
    __tablename__ = "promotions"
    __table_args__ = (
        CheckConstraint("kind IN ('product', 'order')", name="ck_promotions_kind"),
        CheckConstraint("percent > 0 AND percent <= 100", name="ck_promotions_percent"),
        CheckConstraint("min_qty >= 1", name="ck_promotions_min_qty"),
        CheckConstraint(
            "product_id IS NULL OR category IS NULL", name="ck_promotions_single_scope"
        ),
        CheckConstraint(
            "(kind = 'order') = (min_amount IS NOT NULL)", name="ck_promotions_min_amount"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[PromotionKind] = mapped_column(String(20), nullable=False)
    percent: Mapped[Decimal] = mapped_column(PERCENT_COLUMN, nullable=False)
    # Alcance de las promos `product` (ninguno = todo el catálogo). Los
    # productos no se borran (soft delete), pero por las dudas CASCADE.
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=True
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    min_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    min_amount: Mapped[Decimal | None] = mapped_column(MONEY_COLUMN, nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    product: Mapped[Product | None] = relationship()

    @property
    def product_name(self) -> str | None:
        return self.product.name if self.product else None


class Coupon(Base):
    __tablename__ = "coupons"
    __table_args__ = (
        CheckConstraint("code = upper(code)", name="ck_coupons_code_upper"),
        CheckConstraint("percent > 0 AND percent <= 100", name="ck_coupons_percent"),
        CheckConstraint("origin IN ('admin', 'referral')", name="ck_coupons_origin"),
        CheckConstraint("uses >= 0", name="ck_coupons_uses"),
        CheckConstraint("max_uses IS NULL OR uses <= max_uses", name="ck_coupons_max_uses"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    percent: Mapped[Decimal] = mapped_column(PERCENT_COLUMN, nullable=False)
    min_amount: Mapped[Decimal | None] = mapped_column(MONEY_COLUMN, nullable=True)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Pedidos no cancelados que lo usan (cancelar lo libera).
    uses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    origin: Mapped[CouponOrigin] = mapped_column(String(20), nullable=False, default="admin")
    # Cupón personal: solo lo puede usar esta cuenta (premios de referidos).
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner: Mapped[User | None] = relationship()

    @property
    def owner_email(self) -> str | None:
        return self.owner.email if self.owner else None
