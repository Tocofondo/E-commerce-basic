"""Schemas Pydantic de entrada/salida del módulo orders.

Alias en camelCase para coincidir con `Order`/`ShippingInfo` de Angular
(frontend/src/app/core/models/order.model.ts).
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.core.money import Money
from app.core.phone import ArPhone
from app.core.urls import public_url
from app.modules.auth.schemas import NormalizedEmail

# Mismos valores que `OrderStatus` en el frontend.
OrderStatus = Literal["pendiente", "pagado", "enviado", "entregado", "cancelado"]


class ShippingInfo(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    full_name: str = Field(min_length=1, max_length=255)
    # Opcional: alcanza con email o teléfono (ver OrderCreate).
    phone: ArPhone | None = None
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)


class OrderItemCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    product_id: int
    qty: int = Field(gt=0)


class OrderCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    # `userId` no es parte de este schema a propósito: el pedido se crea para
    # el usuario autenticado (ver router.py) o como invitado, nunca para otro.
    items: list[OrderItemCreate] = Field(min_length=1)
    shipping: ShippingInfo
    # Solo cuenta para invitados: logueado se usa el email de la cuenta.
    email: NormalizedEmail | None = None

    def has_contact(self, account_email: str | None) -> bool:
        return bool(account_email or self.email or self.shipping.phone)


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderItemRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    product_id: int | None
    product_name: str
    product_image: str
    unit_price: Money
    qty: int

    @field_validator("product_image")
    @classmethod
    def _absolute_image_url(cls, value: str) -> str:
        return public_url(value)


class OrderRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: int
    # None = compra como invitado.
    user_id: uuid.UUID | None
    # Para que el admin pueda escribirle al cliente (ver Order.customer_email).
    customer_email: str | None = None
    status: OrderStatus
    total: Money
    created_at: datetime
    items: list[OrderItemRead]
    shipping: ShippingInfo
