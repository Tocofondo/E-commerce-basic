"""Endpoints de promotions: promociones vigentes (público), CRUD de
promociones y cupones (admin), y cupones/referidos del cliente logueado."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db.session import get_db
from app.modules.auth.dependencies import get_current_active_user, get_current_admin_user
from app.modules.auth.models import User
from app.modules.promotions.models import Coupon, Promotion
from app.modules.promotions.schemas import (
    CouponRead,
    CouponWrite,
    MyCouponRead,
    PromotionRead,
    PromotionWrite,
    ReferralStats,
)
from app.modules.promotions.service import (
    CouponCodeTakenError,
    CouponNotFoundError,
    InvalidPromotionError,
    PromotionNotFoundError,
    active_promotions,
    create_coupon,
    create_promotion,
    delete_coupon,
    delete_promotion,
    list_coupons,
    list_promotions,
    my_coupons,
    referral_stats,
    update_coupon,
    update_promotion,
)

router = APIRouter(prefix="/promotions", tags=["promotions"])

_PROMOTION_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Promoción no encontrada"
)
_COUPON_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="Cupón no encontrado"
)


def _code_taken(exc: CouponCodeTakenError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT, detail=f"Ya existe un cupón con el código {exc}"
    )


def _invalid(exc: InvalidPromotionError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# --- Público ---


@router.get("/active", response_model=list[PromotionRead])
def list_active(db: Session = Depends(get_db)) -> list[Promotion]:
    """Para que la tienda muestre "llevando 10, 15% off" en cada producto."""
    return active_promotions(db)


# --- Cliente logueado ---


@router.get("/coupons/me", response_model=list[MyCouponRead])
def list_my_coupons(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
) -> list[Coupon]:
    return my_coupons(db, current_user)


@router.get("/referrals/me", response_model=ReferralStats)
def my_referrals(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)
) -> dict:
    return referral_stats(db, current_user)


# --- Admin: promociones ---


@router.get("", response_model=list[PromotionRead])
def list_all(
    db: Session = Depends(get_db), _admin: User = Depends(get_current_admin_user)
) -> list[Promotion]:
    return list_promotions(db)


@router.post("", response_model=PromotionRead, status_code=status.HTTP_201_CREATED)
def create(
    body: PromotionWrite,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Promotion:
    try:
        return create_promotion(db, body)
    except InvalidPromotionError as exc:
        raise _invalid(exc) from exc


@router.put("/{promotion_id}", response_model=PromotionRead)
def update(
    promotion_id: int,
    body: PromotionWrite,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Promotion:
    try:
        return update_promotion(db, promotion_id, body)
    except PromotionNotFoundError as exc:
        raise _PROMOTION_NOT_FOUND from exc
    except InvalidPromotionError as exc:
        raise _invalid(exc) from exc


@router.delete("/{promotion_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    promotion_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> None:
    try:
        delete_promotion(db, promotion_id)
    except PromotionNotFoundError as exc:
        raise _PROMOTION_NOT_FOUND from exc


# --- Admin: cupones ---


@router.get("/coupons", response_model=list[CouponRead])
def list_all_coupons(
    db: Session = Depends(get_db), _admin: User = Depends(get_current_admin_user)
) -> list[Coupon]:
    return list_coupons(db)


@router.post("/coupons", response_model=CouponRead, status_code=status.HTTP_201_CREATED)
def create_one_coupon(
    body: CouponWrite,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Coupon:
    try:
        return create_coupon(db, body)
    except CouponCodeTakenError as exc:
        raise _code_taken(exc) from exc


@router.put("/coupons/{coupon_id}", response_model=CouponRead)
def update_one_coupon(
    coupon_id: int,
    body: CouponWrite,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> Coupon:
    try:
        return update_coupon(db, coupon_id, body)
    except CouponNotFoundError as exc:
        raise _COUPON_NOT_FOUND from exc
    except CouponCodeTakenError as exc:
        raise _code_taken(exc) from exc
    except InvalidPromotionError as exc:
        raise _invalid(exc) from exc


@router.delete("/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_one_coupon(
    coupon_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
) -> None:
    try:
        delete_coupon(db, coupon_id)
    except CouponNotFoundError as exc:
        raise _COUPON_NOT_FOUND from exc
