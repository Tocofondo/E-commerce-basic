from decimal import Decimal

from app.modules.promotions.pricing import CouponTerms, Line, price
from tests.conftest import API, PASSWORD, SHIPPING, auth_headers, order_body

# --- Cálculo (funciones puras) ---


class _Promo:
    def __init__(
        self,
        id,
        percent,
        kind="product",
        min_qty=1,
        product_id=None,
        category=None,
        min_amount=None,
        name="Promo",
    ):
        self.id = id
        self.name = name
        self.kind = kind
        self.percent = Decimal(percent)
        self.min_qty = min_qty
        self.product_id = product_id
        self.category = category
        self.min_amount = Decimal(min_amount) if min_amount is not None else None


def _line(product_id=1, price_="1000", qty=1, category="Verano"):
    return Line(product_id, category, Decimal(price_), qty)


def test_quantity_promo_counts_units_of_the_same_product():
    promo = _Promo(1, "15", min_qty=10)
    # 10 del mismo: aplica. 6 + 4 de dos productos distintos: no.
    assert price([_line(qty=10)], [promo]).total == Decimal("8500.00")
    assert price([_line(1, qty=6), _line(2, qty=4)], [promo]).discount_total == 0


def test_best_line_promo_wins_without_stacking():
    promos = [_Promo(1, "10", category="verano"), _Promo(2, "25", product_id=1)]
    quote = price([_line(1), _line(2)], promos)
    # Producto 1: 25% (no 35%). Producto 2: 10% por categoría (case-insensitive).
    assert quote.discount_total == Decimal("350.00")


def test_order_promo_uses_subtotal_after_line_discounts():
    promos = [_Promo(1, "50", product_id=1), _Promo(2, "10", kind="order", min_amount="1000")]
    # 2000 - 500 = 1500 >= 1000 -> 10% de 1500.
    quote = price([_line(1), _line(2)], promos)
    assert [amount for _, amount in quote.discounts] == [Decimal("500.00"), Decimal("150.00")]
    # Con 1 solo producto: 1000 - 500 = 500 < 1000, no llega.
    assert price([_line(1)], promos).discount_total == Decimal("500.00")


def test_coupon_applies_last_and_rounds_to_cents():
    quote = price([_line(price_="999.99")], [], CouponTerms("HOLA", Decimal("33.33")))
    assert quote.discounts == [("Cupón HOLA (33.33%)", Decimal("333.30"))]
    assert quote.total == Decimal("666.69")


# --- API ---


def _create_promo(client, admin, **data):
    body = {"name": "Promo", "kind": "product", "percent": 10, **data}
    res = client.post(f"{API}/promotions", json=body, headers=auth_headers(admin))
    assert res.status_code == 201, res.text
    return res.json()


def _create_coupon(client, admin, **data):
    body = {"code": "verano10", "percent": 10, **data}
    res = client.post(f"{API}/promotions/coupons", json=body, headers=auth_headers(admin))
    assert res.status_code == 201, res.text
    return res.json()


def _place(client, user, *items, coupon=None, guest_email=None):
    body = order_body(*items)
    if coupon:
        body["couponCode"] = coupon
    if guest_email:
        body["email"] = guest_email
    headers = auth_headers(user) if user else {}
    return client.post(f"{API}/orders", json=body, headers=headers)


def test_promotions_crud_is_admin_only(client, customer):
    body = {"name": "x", "kind": "product", "percent": 10}
    assert (
        client.post(f"{API}/promotions", json=body, headers=auth_headers(customer)).status_code
        == 403
    )
    assert (
        client.get(f"{API}/promotions/coupons", headers=auth_headers(customer)).status_code == 403
    )


def test_invalid_promotion_is_422(client, admin):
    for body in (
        {"name": "x", "kind": "order", "percent": 10},  # sin monto mínimo
        {"name": "x", "kind": "product", "percent": 150},
        {"name": "x", "kind": "product", "percent": 10, "productId": 1, "category": "Verano"},
    ):
        res = client.post(f"{API}/promotions", json=body, headers=auth_headers(admin))
        assert res.status_code == 422, body


def test_order_applies_quantity_promo_and_stores_breakdown(client, admin, customer, make_product):
    product = make_product(price=1000, stock=20)
    _create_promo(client, admin, name="Llevando 10", percent=15, minQty=10, productId=product.id)

    order = _place(client, customer, (product.id, 10)).json()
    assert order["subtotal"] == 10000
    assert order["discountTotal"] == 1500
    assert order["total"] == 8500
    assert order["discounts"] == [{"label": "Llevando 10 (15%)", "amount": 1500}]


def test_quote_matches_order_and_reports_coupon_errors(client, admin, customer, make_product):
    product = make_product(price=1000, stock=20)
    _create_promo(client, admin, kind="order", percent=10, minAmount=5000, name="Gran compra")
    _create_coupon(client, admin, code="MIN", percent=5, minAmount=100000)

    body = {"items": [{"productId": product.id, "qty": 6}], "couponCode": "min"}
    quote = client.post(f"{API}/orders/quote", json=body).json()
    assert quote["total"] == 5400
    assert "desde $ 100.000" in quote["couponError"]

    # Con cupón inválido el pedido no se crea (en el presupuesto solo avisa).
    res = _place(client, customer, (product.id, 6), coupon="MIN")
    assert res.status_code == 400


def test_expired_or_paused_promotions_do_not_apply(client, admin, customer, make_product):
    product = make_product(stock=5)
    _create_promo(client, admin, percent=50, endsAt="2020-01-01T00:00:00Z")
    _create_promo(client, admin, percent=40, isActive=False)
    _create_promo(client, admin, percent=30, startsAt="2999-01-01T00:00:00Z")
    assert _place(client, customer, (product.id, 1)).json()["discountTotal"] == 0
    assert client.get(f"{API}/promotions/active").json() == []


def test_coupon_once_per_buyer_and_released_on_cancel(client, db, admin, customer, make_product):
    product = make_product(stock=10)
    coupon = _create_coupon(client, admin, code="UNAVEZ", percent=20)

    first = _place(client, customer, (product.id, 1), coupon="unavez")
    assert first.status_code == 201
    assert first.json()["couponCode"] == "UNAVEZ"
    assert first.json()["total"] == 800
    again = _place(client, customer, (product.id, 1), coupon="UNAVEZ")
    assert again.status_code == 400
    assert "Ya usaste" in again.json()["detail"]

    # Cancelar libera el cupón: se puede volver a usar.
    client.post(f"{API}/orders/{first.json()['id']}/cancel", headers=auth_headers(customer))
    assert _place(client, customer, (product.id, 1), coupon="UNAVEZ").status_code == 201
    coupons = client.get(f"{API}/promotions/coupons", headers=auth_headers(admin)).json()
    assert [c["uses"] for c in coupons if c["id"] == coupon["id"]] == [1]


def test_coupon_max_uses_and_guest_email(client, admin, make_product):
    product = make_product(stock=10)
    _create_coupon(client, admin, code="DOS", percent=10, maxUses=2)
    assert (
        _place(client, None, (product.id, 1), coupon="DOS", guest_email="a@x.com").status_code
        == 201
    )
    # Mismo invitado (mismo email): ya lo usó.
    assert (
        _place(client, None, (product.id, 1), coupon="DOS", guest_email="a@x.com").status_code
        == 400
    )
    assert (
        _place(client, None, (product.id, 1), coupon="DOS", guest_email="b@x.com").status_code
        == 201
    )
    res = _place(client, None, (product.id, 1), coupon="DOS", guest_email="c@x.com")
    assert res.status_code == 400
    assert "máximo" in res.json()["detail"]


def test_duplicate_coupon_code_is_409(client, admin):
    _create_coupon(client, admin, code="HOLA")
    res = client.post(
        f"{API}/promotions/coupons",
        json={"code": "hola", "percent": 5},
        headers=auth_headers(admin),
    )
    assert res.status_code == 409


# --- Referidos ---


def _deliver(client, admin, order_id):
    for status in ("pagado", "enviado", "entregado"):
        res = client.patch(
            f"{API}/orders/{order_id}/status", json={"status": status}, headers=auth_headers(admin)
        )
        assert res.status_code == 200


def test_register_with_referral_code(client, customer):
    body = {
        "email": "invitado@ejemplo.com",
        "phone": "3415551234",
        "password": PASSWORD,
        "referral_code": customer.referral_code.lower(),
    }
    assert client.post(f"{API}/auth/register", json=body).status_code == 201
    stats = client.get(f"{API}/promotions/referrals/me", headers=auth_headers(customer)).json()
    assert stats == {
        "code": customer.referral_code,
        "invited": 1,
        "rewarded": 0,
        "rewardPercent": 10,
    }


def test_unknown_referral_code_does_not_block_signup(client):
    body = {
        "email": "x@ejemplo.com",
        "phone": "3415551234",
        "password": PASSWORD,
        "referral_code": "NOEXISTE",
    }
    assert client.post(f"{API}/auth/register", json=body).status_code == 201


def test_referrer_earns_personal_coupon_when_first_order_is_delivered(
    client, admin, make_user, make_product, sent_emails
):
    product = make_product(price=1000, stock=20)
    referrer = make_user()
    invited = make_user(referral_code=referrer.referral_code)

    first_id = _place(client, invited, (product.id, 1)).json()["id"]
    assert client.get(f"{API}/promotions/coupons/me", headers=auth_headers(referrer)).json() == []
    sent_emails.clear()
    _deliver(client, admin, first_id)

    coupons = client.get(f"{API}/promotions/coupons/me", headers=auth_headers(referrer)).json()
    assert len(coupons) == 1
    code = coupons[0]["code"]
    assert coupons[0]["percent"] == 10
    assert any(mail.to == referrer.email and code in mail.body for mail in sent_emails)

    # Un premio por invitado: su segundo pedido entregado no da otro.
    second_id = _place(client, invited, (product.id, 1)).json()["id"]
    _deliver(client, admin, second_id)
    assert (
        len(client.get(f"{API}/promotions/coupons/me", headers=auth_headers(referrer)).json()) == 1
    )

    # Personal: otro no lo puede usar, ni el dueño sin loguearse.
    assert _place(client, invited, (product.id, 1), coupon=code).status_code == 400
    guest = _place(client, None, (product.id, 1), coupon=code, guest_email="z@x.com")
    assert "personal" in guest.json()["detail"]
    # El dueño sí, una vez.
    used = _place(client, referrer, (product.id, 1), coupon=code)
    assert used.status_code == 201
    assert used.json()["total"] == 900
    assert client.get(f"{API}/promotions/coupons/me", headers=auth_headers(referrer)).json() == []


def test_cancelled_order_gives_no_referral_reward(client, admin, make_user, make_product):
    product = make_product(stock=5)
    referrer = make_user()
    invited = make_user(referral_code=referrer.referral_code)
    order_id = _place(client, invited, (product.id, 1)).json()["id"]
    client.patch(
        f"{API}/orders/{order_id}/status", json={"status": "cancelado"}, headers=auth_headers(admin)
    )
    assert client.get(f"{API}/promotions/coupons/me", headers=auth_headers(referrer)).json() == []


def test_me_includes_referral_code(client, customer):
    me = client.get(f"{API}/auth/me", headers=auth_headers(customer)).json()
    assert me["referral_code"] == customer.referral_code
    assert SHIPPING  # usado por order_body
