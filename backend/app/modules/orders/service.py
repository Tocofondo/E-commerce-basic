"""Lógica de negocio de orders. Sin dependencias de FastAPI (Request/
Response): recibe una Session y datos ya validados.
"""

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.orders.models import Order, OrderItem
from app.modules.orders.schemas import OrderCreate, OrderStatus
from app.modules.products.models import Product


class OrderNotFoundError(Exception):
    pass


class ProductNotFoundError(Exception):
    pass


class InvalidStatusTransitionError(Exception):
    def __init__(self, current: OrderStatus, new: OrderStatus):
        self.current = current
        self.new = new
        super().__init__(f"No se puede pasar un pedido de '{current}' a '{new}'")


# Transiciones válidas de estado. `cancelado` y `entregado` son finales:
# reabrir un cancelado implicaría volver a descontar stock que quizás ya se
# vendió. Mismo mapa en el frontend (admin-orders.page.ts) para ofrecer
# solo las opciones válidas.
ALLOWED_TRANSITIONS: dict[OrderStatus, frozenset[OrderStatus]] = {
    "pendiente": frozenset({"pagado", "cancelado"}),
    "pagado": frozenset({"enviado", "cancelado"}),
    "enviado": frozenset({"entregado", "cancelado"}),
    "entregado": frozenset(),
    "cancelado": frozenset(),
}


def _lock_products(db: Session, product_ids: set[int]) -> dict[int, Product]:
    """`SELECT ... FOR UPDATE` de los productos, en orden de id (orden fijo
    para que dos transacciones no se bloqueen mutuamente). Mientras dure la
    transacción nadie más puede leer-y-descontar ese stock: sin esto, dos
    pedidos simultáneos por la última unidad pasaban los dos la validación.
    `populate_existing` pisa cualquier copia vieja que ya hubiera en la
    sesión con lo que devuelve la DB bajo el lock."""
    rows = db.scalars(
        select(Product)
        .where(Product.id.in_(product_ids))
        .order_by(Product.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return {product.id: product for product in rows}


class InsufficientStockError(Exception):
    def __init__(self, product_id: int, product_name: str, available: int):
        self.product_id = product_id
        self.available = available
        # El mensaje llega tal cual al cliente (detail del 400): con el nombre
        # sabe qué ajustar en el carrito.
        super().__init__(
            f"No hay stock suficiente de \"{product_name}\" (disponibles: {available})"
        )


def create_order(db: Session, user_id: uuid.UUID, order_in: OrderCreate) -> Order:
    """Crea el pedido y descuenta stock. Todo en una sola transacción: si
    algún producto no existe o no alcanza el stock, no se persiste nada.
    """
    # Mismo producto en varias líneas: se suman (una sola validación de stock
    # y un solo item por producto). El dict conserva el orden del carrito.
    qty_by_product: dict[int, int] = defaultdict(int)
    for item_in in order_in.items:
        qty_by_product[item_in.product_id] += item_in.qty

    try:
        products = _lock_products(db, set(qty_by_product))
        items: list[OrderItem] = []
        total = 0.0
        for product_id, qty in qty_by_product.items():
            product = products.get(product_id)
            if product is None:
                raise ProductNotFoundError(product_id)
            if product.stock < qty:
                raise InsufficientStockError(product.id, product.name, product.stock)

            product.stock -= qty
            total += product.price * qty
            # Snapshot: si el producto no tiene imágenes cargadas, el pedido
            # queda con string vacío (el frontend ya maneja `image` ausente).
            product_image = product.images[0].url if product.images else ""
            items.append(
                OrderItem(
                    product_id=product.id,
                    product_name=product.name,
                    product_image=product_image,
                    unit_price=product.price,
                    qty=qty,
                )
            )
    except Exception:
        # Libera los locks ya, sin esperar a que se cierre la sesión.
        db.rollback()
        raise

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
    """Cambia el estado respetando `ALLOWED_TRANSITIONS`. Al cancelar
    devuelve al stock las unidades del pedido (de los productos que todavía
    existen). El pedido se lockea para que dos cancelaciones simultáneas no
    repongan el stock dos veces."""
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if order is None:
        raise OrderNotFoundError(order_id)
    if status == order.status:
        db.rollback()
        return order
    if status not in ALLOWED_TRANSITIONS[order.status]:
        db.rollback()
        raise InvalidStatusTransitionError(order.status, status)

    if status == "cancelado":
        product_ids = {item.product_id for item in order.items if item.product_id is not None}
        products = _lock_products(db, product_ids)
        for item in order.items:
            product = products.get(item.product_id) if item.product_id is not None else None
            if product is not None:
                product.stock += item.qty

    order.status = status
    db.commit()
    db.refresh(order)
    return order
