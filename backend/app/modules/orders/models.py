"""Modelos de pedidos: `Order` + sus `OrderItem`.

`OrderItem` guarda un snapshot del producto (nombre, imagen, precio unitario)
al momento de la compra, para que un pedido ya hecho no cambie si el admin
edita o borra el producto después.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db.base import Base
from app.modules.orders.schemas import OrderStatus


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')",
            name="ck_orders_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(String(20), default="pendiente", nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    # Datos de envío aplanados (no una tabla aparte): un pedido tiene un solo
    # destino y no se reusa entre pedidos.
    shipping_full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    shipping_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    shipping_address: Mapped[str] = mapped_column(String(255), nullable=False)
    shipping_city: Mapped[str] = mapped_column(String(100), nullable=False)
    shipping_postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )

    @property
    def shipping(self) -> dict[str, str]:
        return {
            "full_name": self.shipping_full_name,
            "phone": self.shipping_phone,
            "address": self.shipping_address,
            "city": self.shipping_city,
            "postal_code": self.shipping_postal_code,
        }


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nullable + SET NULL: si se borra el producto, el pedido conserva el
    # snapshot (nombre/imagen/precio) aunque pierda el link al catálogo.
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_image: Mapped[str] = mapped_column(String(1000), nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
