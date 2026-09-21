"""Endpoints HTTP de orders: el cliente crea pedidos y ve los propios; el
admin ve todos y actualiza su estado.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.modules.auth.dependencies import get_current_active_user, get_current_admin_user
from app.modules.auth.models import User
from app.modules.orders.models import Order
from app.modules.orders.schemas import OrderCreate, OrderRead, OrderStatusUpdate
from app.modules.orders.service import (
    InsufficientStockError,
    OrderNotFoundError,
    ProductNotFoundError,
    create_order,
    list_all_orders,
    list_orders_by_user,
    update_order_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create(
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Order:
    try:
        order = create_order(db, current_user.id, order_in)
    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto {exc} no encontrado",
        ) from exc
    except InsufficientStockError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    logger.info("Pedido #%s creado por %s", order.id, current_user.email)
    return order


@router.get("/me", response_model=list[OrderRead])
def list_mine(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[Order]:
    return list_orders_by_user(db, current_user.id)


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
