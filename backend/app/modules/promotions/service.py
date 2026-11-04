"""Lógica de negocio de promotions. Sin dependencias de FastAPI.

- CRUD de promociones y cupones (admin).
- `resolve_coupon`: valida un código para un comprador concreto.
- `active_promotions`: las vigentes ahora (para el cálculo y la tienda).
- Referidos: `grant_referral_reward` cuando se entrega el primer pedido de
  un invitado, `referral_stats` para el perfil.
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.modules.auth.models import User
from app.modules.orders.models import Order
from app.modules.promotions.models import Coupon, Promotion
from app.modules.promotions.pricing import CouponTerms
from app.modules.promotions.schemas import CouponWrite, PromotionWrite, normalize_code

logger = logging.getLogger(__name__)


class PromotionNotFoundError(Exception):
    pass


class CouponNotFoundError(Exception):
    pass


class CouponCodeTakenError(Exception):
    pass


class InvalidPromotionError(Exception):
    pass


class CouponError(Exception):
    """El cupón no se puede usar en esta compra. El mensaje va al cliente."""


def _now() -> datetime:
    return datetime.now(UTC)


# --- Promociones ---


def active_promotions(db: Session) -> list[Promotion]:
    now = _now()
    return list(
        db.scalars(
            select(Promotion)
            .options(selectinload(Promotion.product))
            .where(
                Promotion.is_active,
                or_(Promotion.starts_at.is_(None), Promotion.starts_at <= now),
                or_(Promotion.ends_at.is_(None), Promotion.ends_at > now),
            )
            .order_by(Promotion.id)
        )
    )


def list_promotions(db: Session) -> list[Promotion]:
    return list(
        db.scalars(
            select(Promotion).options(selectinload(Promotion.product)).order_by(Promotion.id.desc())
        )
    )


def _check_product(db: Session, data: PromotionWrite) -> None:
    from app.modules.products.models import Product

    if data.product_id is not None and db.get(Product, data.product_id) is None:
        raise InvalidPromotionError("El producto elegido no existe")


def create_promotion(db: Session, data: PromotionWrite) -> Promotion:
    _check_product(db, data)
    promotion = Promotion(**data.model_dump())
    db.add(promotion)
    db.commit()
    db.refresh(promotion)
    return promotion


def update_promotion(db: Session, promotion_id: int, data: PromotionWrite) -> Promotion:
    """Reemplazo completo (el form del admin manda todos los campos)."""
    promotion = db.get(Promotion, promotion_id)
    if promotion is None:
        raise PromotionNotFoundError(promotion_id)
    _check_product(db, data)
    for key, value in data.model_dump().items():
        setattr(promotion, key, value)
    db.commit()
    db.refresh(promotion)
    return promotion


def delete_promotion(db: Session, promotion_id: int) -> None:
    """Borrado real: los pedidos guardan su propio desglose (snapshot)."""
    promotion = db.get(Promotion, promotion_id)
    if promotion is None:
        raise PromotionNotFoundError(promotion_id)
    db.delete(promotion)
    db.commit()


# --- Cupones ---


def list_coupons(db: Session) -> list[Coupon]:
    return list(
        db.scalars(select(Coupon).options(selectinload(Coupon.owner)).order_by(Coupon.id.desc()))
    )


def _code_taken(db: Session, code: str, exclude_id: int | None = None) -> bool:
    query = select(Coupon.id).where(Coupon.code == code)
    if exclude_id is not None:
        query = query.where(Coupon.id != exclude_id)
    return db.scalar(query) is not None


def create_coupon(db: Session, data: CouponWrite) -> Coupon:
    if _code_taken(db, data.code):
        raise CouponCodeTakenError(data.code)
    coupon = Coupon(**data.model_dump(), origin="admin")
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


def update_coupon(db: Session, coupon_id: int, data: CouponWrite) -> Coupon:
    coupon = db.get(Coupon, coupon_id)
    if coupon is None:
        raise CouponNotFoundError(coupon_id)
    if _code_taken(db, data.code, exclude_id=coupon_id):
        raise CouponCodeTakenError(data.code)
    if data.max_uses is not None and data.max_uses < coupon.uses:
        raise InvalidPromotionError(
            f"Ya se usó {coupon.uses} veces: el límite no puede ser menor a eso"
        )
    for key, value in data.model_dump().items():
        setattr(coupon, key, value)
    db.commit()
    db.refresh(coupon)
    return coupon


def delete_coupon(db: Session, coupon_id: int) -> None:
    """Borrado real: los pedidos conservan `coupon_code` (el FK queda NULL)."""
    coupon = db.get(Coupon, coupon_id)
    if coupon is None:
        raise CouponNotFoundError(coupon_id)
    db.delete(coupon)
    db.commit()


def my_coupons(db: Session, user: User) -> list[Coupon]:
    """Cupones personales que el usuario todavía puede usar."""
    now = _now()
    return list(
        db.scalars(
            select(Coupon)
            .where(
                Coupon.owner_id == user.id,
                Coupon.is_active,
                or_(Coupon.expires_at.is_(None), Coupon.expires_at > now),
                or_(Coupon.max_uses.is_(None), Coupon.uses < Coupon.max_uses),
            )
            .order_by(Coupon.created_at)
        )
    )


def resolve_coupon(
    db: Session,
    code: str,
    *,
    user: User | None,
    email: str | None,
    lock: bool = False,
) -> Coupon:
    """Valida que el comprador pueda usar `code` ahora (sin mirar el monto
    mínimo, que depende del carrito: ver orders/service.py). `lock=True` al
    crear el pedido: `SELECT ... FOR UPDATE` para que dos compras simultáneas
    no pasen el límite de usos."""
    query = select(Coupon).where(Coupon.code == normalize_code(code))
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    coupon = db.scalar(query)
    if coupon is None or not coupon.is_active:
        raise CouponError("El cupón no existe o ya no está vigente")
    if coupon.expires_at is not None and coupon.expires_at <= _now():
        raise CouponError("El cupón está vencido")
    if coupon.max_uses is not None and coupon.uses >= coupon.max_uses:
        raise CouponError("El cupón ya se usó el máximo de veces")
    if coupon.owner_id is not None and (user is None or user.id != coupon.owner_id):
        # Personal: no se revela a quién pertenece.
        raise CouponError(
            "Este cupón es personal: ingresá con la cuenta que lo recibió"
            if user is None
            else "Este cupón es de otra cuenta"
        )
    # Una vez por comprador (cuenta o, para invitados, email de contacto).
    buyer = []
    if user is not None:
        buyer.append(Order.user_id == user.id)
    if email:
        buyer.append(Order.customer_email == email)
    if buyer:
        used = db.scalar(
            select(Order.id)
            .where(Order.coupon_id == coupon.id, Order.status != "cancelado", or_(*buyer))
            .limit(1)
        )
        if used is not None:
            raise CouponError("Ya usaste este cupón en otro pedido")
    return coupon


def coupon_terms(coupon: Coupon) -> CouponTerms:
    return CouponTerms(code=coupon.code, percent=coupon.percent)


def release_coupon(db: Session, order: Order) -> None:
    """Al cancelar un pedido, el cupón vuelve a estar disponible. No hace
    commit: va en la misma transacción que la cancelación."""
    if order.coupon_id is None:
        return
    coupon = db.scalar(
        select(Coupon)
        .where(Coupon.id == order.coupon_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if coupon is not None and coupon.uses > 0:
        coupon.uses -= 1


# --- Referidos ---


def find_referrer(db: Session, code: str | None) -> User | None:
    if not code:
        return None
    return db.scalar(select(User).where(User.referral_code == normalize_code(code), User.is_active))


def _new_reward_code(db: Session) -> str:
    while True:
        code = "REF-" + secrets.token_hex(4).upper()
        if not _code_taken(db, code):
            return code


def grant_referral_reward(db: Session, order: Order) -> tuple[User, Coupon] | None:
    """Si `order` (recién entregado) es de alguien que vino invitado y su
    invitador todavía no cobró el premio por él, le crea un cupón personal.
    Un premio por invitado, sin importar cuántos pedidos haga. No hace
    commit: va en la misma transacción que el cambio de estado. Devuelve
    (invitador, cupón) para avisarle por mail."""
    if order.user_id is None:
        return None
    buyer = db.scalar(
        select(User)
        .where(User.id == order.user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if buyer is None or buyer.referred_by_id is None or buyer.referral_rewarded_at is not None:
        return None
    referrer = db.get(User, buyer.referred_by_id)
    if referrer is None or not referrer.is_active:
        return None

    coupon = Coupon(
        code=_new_reward_code(db),
        percent=settings.REFERRAL_REWARD_PERCENT,
        max_uses=1,
        expires_at=_now() + timedelta(days=settings.REFERRAL_REWARD_DAYS),
        origin="referral",
        owner_id=referrer.id,
    )
    db.add(coupon)
    buyer.referral_rewarded_at = _now()
    logger.info(
        "Premio de referido %s para %s (invitó a %s)", coupon.code, referrer.email, buyer.email
    )
    return referrer, coupon


def referral_stats(db: Session, user: User) -> dict:
    invited = db.scalar(select(func.count()).where(User.referred_by_id == user.id)) or 0
    rewarded = (
        db.scalar(
            select(func.count()).where(
                User.referred_by_id == user.id, User.referral_rewarded_at.is_not(None)
            )
        )
        or 0
    )
    return {
        "code": user.referral_code,
        "invited": invited,
        "rewarded": rewarded,
        "reward_percent": settings.REFERRAL_REWARD_PERCENT,
    }
