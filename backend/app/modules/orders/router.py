"""Endpoints HTTP de orders: el cliente crea pedidos y ve los propios; el
admin ve todos y actualiza su estado.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.db.session import get_db
from app.core.email import build_order_cancelled_email, build_order_emails, send_email_safe
from app.modules.auth.dependencies import (
    get_current_active_user,
    get_current_admin_user,
    get_optional_active_user,
)
from app.modules.auth.models import User
from app.modules.orders.models import Order
from app.modules.orders.schemas import OrderCreate, OrderRead, OrderStatusUpdate
from app.modules.orders.service import (
    InsufficientStockError,
    InvalidStatusTransitionError,
    MissingContactError,
    NotCancellableError,
    OrderNotFoundError,
    ProductNotFoundError,
    cancel_own_order,
    create_order,
    list_all_orders,
    list_orders_by_user,
    update_order_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["orders"])

# Invitados: público, descuenta stock y manda mails. Sin límite alguien podría
# "reservar" todo el stock con pedidos falsos.
GUEST_IP_LIMIT = (10, 3600)


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create(
    request: Request,
    order_in: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_active_user),
) -> Order:
    if current_user is None:
        rate_limit.hit(f"guest-order:ip:{rate_limit.client_ip(request)}", *GUEST_IP_LIMIT)
    try:
        order = create_order(db, current_user, order_in)
    except MissingContactError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Dejanos un email o un teléfono para contactarte",
        ) from exc
    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uno de los productos del pedido ya no existe en el catálogo",
        ) from exc
    except InsufficientStockError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    logger.info(
        "Pedido #%s creado por %s",
        order.id,
        current_user.email if current_user else "invitado",
    )
    # Confirmación al cliente (si dejó email) + aviso al admin, después de responder.
    for to_email, subject, body in build_order_emails(order, registered=current_user is not None):
        background_tasks.add_task(send_email_safe, to_email, subject, body)
    return order


@router.get("/me", response_model=list[OrderRead])
def list_mine(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[Order]:
    return list_orders_by_user(db, current_user.id)


@router.post("/{order_id}/cancel", response_model=OrderRead)
def cancel_mine(
    order_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Order:
    try:
        order = cancel_own_order(db, order_id, current_user.id)
    except OrderNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado"
        ) from exc
    except NotCancellableError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este pedido ya no se puede cancelar desde la web: escribinos por WhatsApp",
        ) from exc
    logger.info("Pedido #%s cancelado por %s", order.id, current_user.email)
    # Sin push: el admin se entera por mail (si hay ORDER_NOTIFY_EMAIL).
    if email := build_order_cancelled_email(order):
        background_tasks.add_task(send_email_safe, *email)
    return order


@router.get("", response_model=list[OrderRead])
def list_all(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> list[Order]:
    return list_all_orders(db)


@router.patch("/{order_id}/status", response_model=OrderRead)
def update_status(
    order_id: int,
    status_in: OrderStatusUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Order:
    try:
        return update_order_status(db, order_id, status_in.status)
    except OrderNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado"
        ) from exc
    except InvalidStatusTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
