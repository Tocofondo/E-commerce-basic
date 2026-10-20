"""Schemas del botón de arrepentimiento (Res. 424/2020 de la Secretaría de
Comercio Interior): cualquiera puede pedir revocar una compra dentro de los
10 días, sin tener que loguearse, y recibe un código de trámite.

Alias en camelCase como el resto de la API.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.core.phone import ArPhone
from app.modules.auth.schemas import NormalizedEmail

WithdrawalStatus = Literal["pendiente", "resuelta"]


class WithdrawalCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    full_name: str = Field(min_length=1, max_length=255)
    email: NormalizedEmail
    phone: ArPhone
    # Texto libre: el cliente puede escribir "#12", "12" o no acordarse.
    order_number: str = Field(min_length=1, max_length=50)
    reason: str = Field(default="", max_length=2000)


class WithdrawalStatusUpdate(BaseModel):
    status: WithdrawalStatus


class WithdrawalCreated(BaseModel):
    """Lo que ve quien hace el pedido: solo el código, nada de otros trámites."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    code: str
    created_at: datetime


class WithdrawalRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: int
    code: str
    full_name: str
    email: str
    phone: str
    order_number: str
    reason: str
    status: WithdrawalStatus
    created_at: datetime
