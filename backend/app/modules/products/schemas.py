"""Schemas Pydantic de entrada/salida del módulo products.

Los alias en camelCase hacen que el JSON coincida 1:1 con la interfaz
`Product` de Angular (frontend/src/app/core/models/product.model.ts), así el
servicio del frontend no tiene que mapear campos manualmente.
"""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator
from pydantic.alias_generators import to_camel

BadgeVariant = Literal["sale", "new", "out-of-stock", "featured", "neutral"]


class BadgeInfo(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    label: str
    variant: BadgeVariant


class ProductImageRead(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    url: str
    position: int


class ProductBase(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    category: str = Field(min_length=1, max_length=100)
    price: float = Field(ge=0)
    original_price: float | None = Field(default=None, ge=0)
    stock: int = Field(ge=0)
    rating: float | None = Field(default=None, ge=0, le=5)
    review_count: int | None = Field(default=None, ge=0)
    # Sin campo `inStock`: se calcula server-side a partir de `stock`
    # (ver `Product.in_stock` en models.py), no es un dato que se persista.
    badge: BadgeInfo | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    """Actualización parcial: solo se tocan los campos que vienen en el body
    (ver `update_product`). Un campo ausente queda como estaba; `null`
    explícito lo borra (ej. `"badge": null` saca el badge)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    price: float | None = Field(default=None, ge=0)
    original_price: float | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    rating: float | None = Field(default=None, ge=0, le=5)
    review_count: int | None = Field(default=None, ge=0)
    badge: BadgeInfo | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "ProductUpdate":
        # Estos pueden faltar, pero no venir en null (la columna es NOT NULL).
        for field in ("name", "description", "category", "price", "stock"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"'{to_camel(field)}' no puede ser null")
        return self


class ProductRead(ProductBase):
    id: int
    in_stock: bool
    images: list[ProductImageRead] = []

    # Compat con el frontend (interfaz `Product extends ProductCard`, que
    # sigue pidiendo `image: string` para las cards): la primera imagen de
    # la galería, o "" si el producto todavía no tiene ninguna.
    @computed_field  # type: ignore[prop-decorator]
    @property
    def image(self) -> str:
        return self.images[0].url if self.images else ""
