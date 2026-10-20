"""Schemas Pydantic de entrada/salida del módulo auth."""

import uuid
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.core.phone import ArPhone

# Los roles vivos de la app. Agregar uno nuevo acá + migrar los datos existentes
# (no hay enum nativo de Postgres que alterar).
UserRole = Literal["customer", "admin"]


def normalize_email(email: str) -> str:
    """Emails siempre en minúsculas: `EmailStr` solo baja el dominio, no la
    parte local, y `Juan@x.com` / `juan@x.com` son la misma casilla en la
    práctica. La tabla `users` además lo exige con un CHECK."""
    return email.strip().lower()


# EmailStr normalizado: usar este tipo en todo schema que reciba un email.
NormalizedEmail = Annotated[EmailStr, AfterValidator(normalize_email)]


class UserCreate(BaseModel):
    email: NormalizedEmail
    phone: ArPhone
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    # Sin campo `role`: el registro público siempre crea "customer".
    # Un admin se crea por seed/consola, no por este endpoint.


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    phone: str
    full_name: str | None
    role: UserRole
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None
    scope: str | None = None
    # Huella de la contraseña al emitir el token (ver core/security.py).
    pwd: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: NormalizedEmail


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    """Edición del propio perfil: solo lo que viene en el body."""

    full_name: str | None = Field(default=None, max_length=255)
    phone: ArPhone | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
