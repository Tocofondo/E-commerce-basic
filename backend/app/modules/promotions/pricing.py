"""Cálculo de descuentos de un carrito. Funciones puras (sin DB ni FastAPI):
reciben las líneas, las promociones vigentes y el cupón, y devuelven el
desglose. Lo usan tanto el presupuesto (`POST /orders/quote`) como la
creación del pedido, así lo que ve el cliente es lo que se cobra.

Reglas, en orden:
1. Por cada línea, la *mejor* promo `product` que le aplique (no se suman
   entre sí): alcance (todo / categoría / producto) y `min_qty` unidades de
   ese producto.
2. Sobre el subtotal ya descontado, la mejor promo `order` cuyo
   `min_amount` se alcance.
3. Sobre lo que quede, el cupón (si hay).
Cada paso redondea a centavos. El total nunca baja de 0.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol

CENT = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _percent_of(amount: Decimal, percent: Decimal) -> Decimal:
    return _money(amount * percent / 100)


class PromotionLike(Protocol):
    id: int
    name: str
    kind: str
    percent: Decimal
    product_id: int | None
    category: str | None
    min_qty: int
    min_amount: Decimal | None


@dataclass(frozen=True)
class Line:
    product_id: int
    category: str
    unit_price: Decimal
    qty: int

    @property
    def amount(self) -> Decimal:
        return self.unit_price * self.qty


@dataclass(frozen=True)
class CouponTerms:
    code: str
    percent: Decimal


@dataclass
class Quote:
    subtotal: Decimal
    # (texto, monto) en el orden en que se aplicaron.
    discounts: list[tuple[str, Decimal]] = field(default_factory=list)
    # Subtotal con los descuentos automáticos, antes del cupón: contra esto
    # se valida el `min_amount` del cupón.
    before_coupon: Decimal = Decimal("0")

    @property
    def discount_total(self) -> Decimal:
        return sum((amount for _, amount in self.discounts), Decimal("0"))

    @property
    def total(self) -> Decimal:
        return max(self.subtotal - self.discount_total, Decimal("0"))


def _applies(promo: PromotionLike, line: Line) -> bool:
    if promo.kind != "product" or line.qty < promo.min_qty:
        return False
    if promo.product_id is not None:
        return promo.product_id == line.product_id
    if promo.category is not None:
        return promo.category.casefold() == line.category.casefold()
    return True


def _percent_label(percent: Decimal) -> str:
    return f"{percent.normalize():f}%"


def price(
    lines: list[Line], promotions: list[PromotionLike], coupon: CouponTerms | None = None
) -> Quote:
    subtotal = _money(sum((line.amount for line in lines), Decimal("0")))
    quote = Quote(subtotal=subtotal)

    # 1. Mejor promo por línea; el desglose agrupa por promo.
    by_promo: dict[int, Decimal] = defaultdict(Decimal)
    names: dict[int, str] = {}
    for line in lines:
        candidates = [promo for promo in promotions if _applies(promo, line)]
        if not candidates:
            continue
        best = max(candidates, key=lambda promo: (promo.percent, -promo.id))
        by_promo[best.id] += _percent_of(line.amount, best.percent)
        names[best.id] = f"{best.name} ({_percent_label(best.percent)})"
    for promo_id, amount in by_promo.items():
        if amount > 0:
            quote.discounts.append((names[promo_id], amount))

    # 2. Mejor promo por monto mínimo, sobre lo ya descontado.
    after_lines = subtotal - quote.discount_total
    reached = [
        promo
        for promo in promotions
        if promo.kind == "order"
        and promo.min_amount is not None
        and after_lines >= promo.min_amount
    ]
    if reached:
        best = max(reached, key=lambda promo: (promo.percent, -promo.id))
        amount = _percent_of(after_lines, best.percent)
        if amount > 0:
            quote.discounts.append((f"{best.name} ({_percent_label(best.percent)})", amount))

    quote.before_coupon = max(subtotal - quote.discount_total, Decimal("0"))

    # 3. Cupón.
    if coupon is not None:
        amount = _percent_of(quote.before_coupon, coupon.percent)
        if amount > 0:
            quote.discounts.append(
                (f"Cupón {coupon.code} ({_percent_label(coupon.percent)})", amount)
            )
    return quote
