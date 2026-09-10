"""Schemas Pydantic de entrada/salida del módulo auth."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# Los roles vivos de la app. Agregar uno nuevo acá + migrar los datos existentes
# (no hay enum nativo de Postgres que alterar).
UserRole = Literal["customer", "admin"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    # Sin campo `role`: el registro público siempre crea "customer".
    # Un admin se crea por seed/consola, no por este endpoint.


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role: UserRole
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None
