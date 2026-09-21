"""Modelos del catálogo: `Product` y sus `ProductImage`."""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UUID, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.db.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(
            "badge_variant IS NULL OR badge_variant IN "
            "('sale', 'new', 'out-of-stock', 'featured', 'neutral')",
            name="ck_products_badge_variant",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    original_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Guardados planos (no una tabla aparte): un producto tiene a lo sumo un
    # badge. `badge_variant` restringido por check constraint a los valores
    # que entiende <ds-badge> en el frontend.
    badge_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    badge_variant: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Un producto puede tener muchas imágenes; cada imagen pertenece a un
    # solo producto (ver ProductImage). Ordenadas por `position` para que la
    # galería del frontend sea estable.
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.position",
    )

    @property
    def in_stock(self) -> bool:
        """Derivado de `stock`, no se persiste (evita que quede desincronizado)."""
        return self.stock > 0

    @property
    def badge(self) -> dict[str, str] | None:
        if not self.badge_label or not self.badge_variant:
            return None
        return {"label": self.badge_label, "variant": self.badge_variant}


class ProductImage(Base):
    __tablename__ = "product_images"

    # UUID como PK: id no adivinable/enumerable por URL pública (a diferencia
    # de un serial), y sirve directo como nombre de archivo en disco.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nombre generado al subir ("<id><ext>"), nunca el filename original del
    # cliente (evita path traversal / colisiones). Ver products/service.py.
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    product: Mapped["Product"] = relationship(back_populates="images")

    @property
    def url(self) -> str:
        return (
            f"{settings.BACKEND_PUBLIC_URL}{settings.STATIC_URL_PREFIX}"
            f"/products/{self.product_id}/{self.filename}"
        )
