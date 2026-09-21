"""Lógica de negocio de orders. Sin dependencias de FastAPI (Request/
Response): recibe una Session y datos ya validados.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.orders.models import Order, OrderItem
from app.modules.orders.schemas import OrderCreate, OrderStatus
from app.modules.products.models import Product


class OrderNotFoundError(Exception):
    pass


class ProductNotFoundError(Exception):
    pass


class InsufficientStockError(Exception):
    def __init__(self, product_id: int, available: int):
        self.product_id = product_id
        self.available = available
        super().__init__(f"Stock insuficiente para el producto {product_id} (disponible: {available})")


def create_order(db: Session, user_id: uuid.UUID, order_in: OrderCreate) -> Order:
    """Crea el pedido y descuenta stock. Todo en una sola transacción: si
    algún producto no existe o no alcanza el stock, no se persiste nada.
    """
    items: list[OrderItem] = []
    total = 0.0
    for item_in in order_in.items:
        product = db.get(Product, item_in.product_id)
        if product is None:
            raise ProductNotFoundError(item_in.product_id)
        if product.stock < item_in.qty:
            raise InsufficientStockError(product.id, product.stock)

        product.stock -= item_in.qty
        total += product.price * item_in.qty
        # Snapshot: si el producto no tiene imágenes cargadas, el pedido
        # queda con string vacío (el frontend ya maneja `image` ausente).
        product_image = product.images[0].url if product.images else ""
        items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                product_image=product_image,
                unit_price=product.price,
                qty=item_in.qty,
            )
        )

    order = Order(
        user_id=user_id,
        status="pendiente",
        total=total,
        shipping_full_name=order_in.shipping.full_name,
        shipping_phone=order_in.shipping.phone,
        shipping_address=order_in.shipping.address,
        shipping_city=order_in.shipping.city,
        shipping_postal_code=order_in.shipping.postal_code,
        items=items,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def list_orders_by_user(db: Session, user_id: uuid.UUID) -> list[Order]:
    return list(
        db.scalars(select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc()))
    )


def list_all_orders(db: Session) -> list[Order]:
    return list(db.scalars(select(Order).order_by(Order.created_at.desc())))


def update_order_status(db: Session, order_id: int, status: OrderStatus) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise OrderNotFoundError(order_id)
    order.status = status
    db.commit()
    db.refresh(order)
    return order
