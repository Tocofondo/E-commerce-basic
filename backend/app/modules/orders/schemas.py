"""Schemas Pydantic de entrada/salida del módulo orders.

Alias en camelCase para coincidir con `Order`/`ShippingInfo` de Angular
(frontend/src/app/core/models/order.model.ts).
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Mismos valores que `OrderStatus` en el frontend.
OrderStatus = Literal["pendiente", "pagado", "enviado", "entregado", "cancelado"]


class ShippingInfo(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    full_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)


class OrderItemCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    product_id: int
    qty: int = Field(gt=0)


class OrderCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    # `userId` no es parte de este schema a propósito: el pedido siempre se
    # crea para el usuario autenticado (ver router.py), nunca para otro.
    items: list[OrderItemCreate] = Field(min_length=1)
    shipping: ShippingInfo


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderItemRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    product_id: int | None
    product_name: str
    product_image: str
    unit_price: float
    qty: int


class OrderRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: int
    user_id: uuid.UUID
    status: OrderStatus
    total: float
    created_at: datetime
    items: list[OrderItemRead]
    shipping: ShippingInfo
