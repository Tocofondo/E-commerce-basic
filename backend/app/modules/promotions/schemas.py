"""Schemas del módulo promotions: promociones automáticas, cupones y
referidos. Alias en camelCase como el resto de la API.

Tipos de promoción (`kind`):
- `product`: descuento por línea del carrito. Alcance opcional (un producto
  o una categoría; sin ninguno, todo el catálogo) y `min_qty` = unidades
  mínimas *del mismo producto* (1 = sin mínimo). "Llevando 10 del mismo, 15%"
  es `min_qty=10`; "20% en Verano" es `category="Verano"`.
- `order`: descuento al total cuando el subtotal (ya con los descuentos por
  producto) llega a `min_amount`.
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

from app.core.money import Money

PromotionKind = Literal["product", "order"]
CouponOrigin = Literal["admin", "referral"]

# Como `Money`: Decimal en Python, número en el JSON.
Percent = Annotated[
    Decimal,
    Field(gt=0, le=100, max_digits=5, decimal_places=2),
    PlainSerializer(float, return_type=float, when_used="json"),
]


def normalize_code(value: str) -> str:
    return value.strip().upper()


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class PromotionBase(_Camel):
    name: str = Field(min_length=1, max_length=120)
    kind: PromotionKind
    percent: Percent
    product_id: int | None = None
    category: str | None = Field(default=None, max_length=100)
    min_qty: int = Field(default=1, ge=1)
    min_amount: Money | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True

    @field_validator("category")
    @classmethod
    def _blank_category_is_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def _consistent(self) -> "PromotionBase":
        if self.product_id is not None and self.category is not None:
            raise ValueError("Elegí un producto o una categoría, no los dos")
        if self.kind == "order":
            if self.min_amount is None:
                raise ValueError("Una promoción por monto necesita el monto mínimo")
            if self.product_id is not None or self.category is not None or self.min_qty != 1:
                raise ValueError(
                    "Una promoción por monto se aplica al total, sin producto ni cantidad"
                )
        elif self.min_amount is not None:
            raise ValueError("El monto mínimo es solo para promociones por monto")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("La fecha de fin tiene que ser posterior a la de inicio")
        return self


class PromotionWrite(PromotionBase):
    pass


class PromotionRead(PromotionBase):
    id: int
    # Para mostrar en el admin sin otra consulta.
    product_name: str | None = None
    created_at: datetime


class CouponBase(_Camel):
    percent: Percent
    min_amount: Money | None = None
    # None = sin límite de usos.
    max_uses: int | None = Field(default=None, ge=1)
    expires_at: datetime | None = None
    is_active: bool = True


class CouponWrite(CouponBase):
    code: str = Field(min_length=3, max_length=40, pattern=r"^\s*[A-Za-z0-9_-]+\s*$")

    @field_validator("code")
    @classmethod
    def _upper(cls, value: str) -> str:
        return normalize_code(value)


class CouponRead(CouponBase):
    id: int
    code: str
    uses: int
    origin: CouponOrigin
    # Cupón personal (premio de referido): solo lo usa esa cuenta.
    owner_email: str | None = None
    created_at: datetime


class MyCouponRead(_Camel):
    """Cupón personal disponible, como lo ve su dueño."""

    code: str
    percent: Percent
    min_amount: Money | None
    expires_at: datetime | None


class ReferralStats(_Camel):
    code: str
    # Cuentas creadas con tu link / las que ya te dieron el premio.
    invited: int
    rewarded: int
    reward_percent: Percent


class AppliedDiscount(_Camel):
    """Una línea del desglose de descuentos (se guarda en el pedido)."""

    label: str
    amount: Money
