"""Lógica de negocio de orders. Sin dependencias de FastAPI (Request/
Response): recibe una Session y datos ya validados.
"""

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.formatting import format_pesos
from app.modules.auth.models import User
from app.modules.orders.models import Order, OrderItem
from app.modules.orders.schemas import OrderCreate, OrderItemCreate, OrderStatus
from app.modules.products.models import Product
from app.modules.promotions.models import Coupon
from app.modules.promotions.pricing import Line, Quote, price
from app.modules.promotions.service import (
    CouponError,
    active_promotions,
    coupon_terms,
    grant_referral_reward,
    release_coupon,
    resolve_coupon,
)


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
        super().__init__(f'No hay stock suficiente de "{product_name}" (disponibles: {available})')


class MissingContactError(Exception):
    pass


class NotCancellableError(Exception):
    pass


def _merge_items(items: list[OrderItemCreate]) -> dict[int, int]:
    """Mismo producto en varias líneas: se suman (una sola validación de stock
    y un solo item por producto). El dict conserva el orden del carrito."""
    qty_by_product: dict[int, int] = defaultdict(int)
    for item_in in items:
        qty_by_product[item_in.product_id] += item_in.qty
    return qty_by_product


def _lines(products: dict[int, Product], qty_by_product: dict[int, int]) -> list[Line]:
    lines = []
    for product_id, qty in qty_by_product.items():
        product = products.get(product_id)
        # Un producto pausado (soft delete) no se puede comprar.
        if product is None or not product.is_active:
            raise ProductNotFoundError(product_id)
        lines.append(Line(product.id, product.category, product.price, qty))
    return lines


def quote_order(
    db: Session,
    user: User | None,
    items: list[OrderItemCreate],
    coupon_code: str | None,
    email: str | None,
) -> tuple[Quote, str | None]:
    """Presupuesto del carrito con los descuentos, sin crear nada ni tocar
    stock. Un cupón que no aplica no es error: vuelve el presupuesto sin él
    y el motivo, para mostrarlo al lado del campo."""
    qty_by_product = _merge_items(items)
    products = {
        product.id: product
        for product in db.scalars(select(Product).where(Product.id.in_(set(qty_by_product))))
    }
    lines = _lines(products, qty_by_product)
    promotions = active_promotions(db)
    coupon_error = None
    terms = None
    if coupon_code:
        try:
            coupon = resolve_coupon(db, coupon_code, user=user, email=user.email if user else email)
            terms = coupon_terms(coupon)
            base = price(lines, promotions)
            if coupon.min_amount is not None and base.before_coupon < coupon.min_amount:
                raise CouponError(
                    f"El cupón es para compras desde {format_pesos(coupon.min_amount)}"
                )
        except CouponError as exc:
            coupon_error = str(exc)
            terms = None
    return price(lines, promotions, terms), coupon_error


def create_order(db: Session, user: User | None, order_in: OrderCreate) -> Order:
    """Crea el pedido, aplica promociones y cupón (ver promotions/pricing.py)
    y descuenta stock. Todo en una sola transacción: si algún producto no
    existe, no alcanza el stock o el cupón no vale, no se persiste nada.
    `user` None = invitado: el contacto es el email/teléfono que dejó.
    """
    customer_email = user.email if user else order_in.email
    if not order_in.has_contact(customer_email):
        raise MissingContactError()

    qty_by_product = _merge_items(order_in.items)
    try:
        products = _lock_products(db, set(qty_by_product))
        lines = _lines(products, qty_by_product)
        items: list[OrderItem] = []
        for line in lines:
            product = products[line.product_id]
            if product.stock < line.qty:
                raise InsufficientStockError(product.id, product.name, product.stock)
            product.stock -= line.qty
            # Snapshot de la portada en chico (los pedidos solo la muestran
            # en miniatura). Sin imágenes, string vacío (el frontend ya maneja
            # `image` ausente).
            product_image = product.images[0].thumb_path if product.images else ""
            items.append(
                OrderItem(
                    product_id=product.id,
                    product_name=product.name,
                    product_image=product_image,
                    unit_price=product.price,
                    qty=line.qty,
                )
            )

        promotions = active_promotions(db)
        coupon = None
        if order_in.coupon_code:
            # Lockeado: dos compras simultáneas no pasan el límite de usos.
            coupon = resolve_coupon(
                db, order_in.coupon_code, user=user, email=customer_email, lock=True
            )
            base = price(lines, promotions)
            if coupon.min_amount is not None and base.before_coupon < coupon.min_amount:
                raise CouponError(
                    f"El cupón es para compras desde {format_pesos(coupon.min_amount)}"
                )
            coupon.uses += 1
        quote = price(lines, promotions, coupon_terms(coupon) if coupon else None)
    except Exception:
        # Libera los locks ya, sin esperar a que se cierre la sesión.
        db.rollback()
        raise

    order = Order(
        user_id=user.id if user else None,
        customer_email=customer_email,
        status="pendiente",
        subtotal=quote.subtotal,
        discount_total=quote.discount_total,
        total=quote.total,
        discounts=[{"label": label, "amount": str(amount)} for label, amount in quote.discounts],
        coupon_id=coupon.id if coupon else None,
        coupon_code=coupon.code if coupon else None,
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
        db.scalars(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
        )
    )


def list_all_orders(db: Session) -> list[Order]:
    # Items en una sola query extra (selectinload), no una por pedido.
    return list(
        db.scalars(
            select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
        )
    )


def _lock_order(db: Session, order_id: int) -> Order | None:
    """El pedido se lockea para que dos cancelaciones simultáneas (admin y
    cliente, por ejemplo) no repongan el stock dos veces."""
    return db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def _restock(db: Session, order: Order) -> None:
    """Devuelve al stock las unidades del pedido (de los productos que
    todavía existen)."""
    product_ids = {item.product_id for item in order.items if item.product_id is not None}
    products = _lock_products(db, product_ids)
    for item in order.items:
        product = products.get(item.product_id) if item.product_id is not None else None
        if product is not None:
            product.stock += item.qty


def update_order_status(
    db: Session, order_id: int, status: OrderStatus
) -> tuple[Order, tuple[User, Coupon] | None]:
    """Cambia el estado respetando `ALLOWED_TRANSITIONS`. Al cancelar repone
    el stock y libera el cupón; al entregar, si el comprador vino invitado,
    le da el premio a quien lo invitó. Devuelve el pedido y, si hubo premio,
    (invitador, cupón) para avisarle."""
    order = _lock_order(db, order_id)
    if order is None:
        raise OrderNotFoundError(order_id)
    if status == order.status:
        db.rollback()
        return order, None
    if status not in ALLOWED_TRANSITIONS[order.status]:
        db.rollback()
        raise InvalidStatusTransitionError(order.status, status)

    reward = None
    if status == "cancelado":
        _restock(db, order)
        release_coupon(db, order)
    elif status == "entregado":
        reward = grant_referral_reward(db, order)

    order.status = status
    db.commit()
    db.refresh(order)
    return order, reward


def cancel_own_order(db: Session, order_id: int, user_id: uuid.UUID) -> Order:
    """El cliente logueado cancela su propio pedido, solo mientras esté
    `pendiente`: ya pagado o enviado hay plata o un envío de por medio y lo
    resuelve el admin. Un pedido ajeno es "no encontrado" (no se revela que
    existe). Los invitados no pasan por acá: avisan por WhatsApp."""
    order = _lock_order(db, order_id)
    if order is None or order.user_id != user_id:
        db.rollback()
        raise OrderNotFoundError(order_id)
    if order.status != "pendiente":
        db.rollback()
        raise NotCancellableError(order_id)
    _restock(db, order)
    release_coupon(db, order)
    order.status = "cancelado"
    db.commit()
    db.refresh(order)
    return order
