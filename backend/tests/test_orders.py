from decimal import Decimal

from sqlalchemy import select

from app.modules.orders.models import OrderItem
from app.modules.products.models import Product
from tests.conftest import API, auth_headers, order_body


def _place(client, user, *items):
    return client.post(f"{API}/orders", json=order_body(*items), headers=auth_headers(user))


def _stock(db, product_id):
    db.expire_all()
    return db.get(Product, product_id).stock


def test_order_decrements_stock_and_totals_in_decimal(client, db, customer, make_product):
    product = make_product(price="0.10", stock=5)
    res = _place(client, customer, (product.id, 3))
    assert res.status_code == 201
    order = res.json()
    # Con float esto daba 0.30000000000000004.
    assert order["total"] == 0.3
    assert order["status"] == "pendiente"
    assert order["customerEmail"] == customer.email
    # El teléfono de envío queda normalizado.
    assert order["shipping"]["phone"] == "5493415551234"
    assert _stock(db, product.id) == 2


def test_same_product_in_several_lines_is_merged(client, db, customer, make_product):
    product = make_product(stock=5)
    res = _place(client, customer, (product.id, 2), (product.id, 3))
    assert res.status_code == 201
    assert [item["qty"] for item in res.json()["items"]] == [5]
    assert _stock(db, product.id) == 0


def test_insufficient_stock_is_400(client, customer, make_product):
    product = make_product(name="Parlante", stock=1)
    res = _place(client, customer, (product.id, 2))
    assert res.status_code == 400
    assert "Parlante" in res.json()["detail"]


def test_order_is_all_or_nothing(client, db, customer, make_product):
    enough = make_product(stock=5)
    short = make_product(stock=1)
    res = _place(client, customer, (enough.id, 2), (short.id, 2))
    assert res.status_code == 400
    assert _stock(db, enough.id) == 5
    assert client.get(f"{API}/orders/me", headers=auth_headers(customer)).json() == []


def test_unknown_product_is_404(client, customer):
    assert _place(client, customer, (999, 1)).status_code == 404


def test_guest_can_order_with_email_only(client, db, admin, make_product, sent_emails):
    product = make_product(stock=5)
    body = order_body((product.id, 2))
    body["shipping"]["phone"] = None
    body["email"] = "Invitado@Ejemplo.com"
    res = client.post(f"{API}/orders", json=body)
    assert res.status_code == 201
    order = res.json()
    assert order["userId"] is None
    assert order["customerEmail"] == "invitado@ejemplo.com"
    assert order["shipping"]["phone"] is None
    assert _stock(db, product.id) == 3

    confirmation = next(mail for mail in sent_emails if mail.to == "invitado@ejemplo.com")
    # Sin cuenta no hay "mis pedidos": para cancelar, WhatsApp.
    assert "mis-pedidos" not in confirmation.body
    assert "WhatsApp" in confirmation.body

    # El admin lo ve junto con los demás.
    listed = client.get(f"{API}/orders", headers=auth_headers(admin)).json()
    assert [o["id"] for o in listed] == [order["id"]]


def test_guest_can_order_with_phone_only(client, make_product, sent_emails):
    product = make_product()
    res = client.post(f"{API}/orders", json=order_body((product.id, 1)))
    assert res.status_code == 201
    assert res.json()["customerEmail"] is None
    assert res.json()["shipping"]["phone"] == "5493415551234"
    # Solo el aviso al admin: el cliente no dejó email.
    assert [mail.to for mail in sent_emails] == ["avisos@ejemplo.com"]


def test_guest_without_contact_is_422(client, db, make_product):
    product = make_product(stock=5)
    body = order_body((product.id, 1))
    body["shipping"]["phone"] = None
    assert client.post(f"{API}/orders", json=body).status_code == 422
    assert _stock(db, product.id) == 5


def test_logged_in_order_uses_account_email(client, customer, make_product):
    product = make_product()
    body = order_body((product.id, 1))
    body["shipping"]["phone"] = None
    body["email"] = "otro@ejemplo.com"
    res = client.post(f"{API}/orders", json=body, headers=auth_headers(customer))
    assert res.status_code == 201
    assert res.json()["customerEmail"] == customer.email
    assert res.json()["userId"] == str(customer.id)


def test_invalid_token_is_401_not_guest(client, make_product):
    product = make_product()
    res = client.post(
        f"{API}/orders",
        json=order_body((product.id, 1)),
        headers={"Authorization": "Bearer basura"},
    )
    assert res.status_code == 401


def test_guest_orders_are_rate_limited(client, make_product, monkeypatch):
    from app.core import rate_limit
    from app.core.config import settings
    from app.modules.orders import router as orders_router

    rate_limit.limiter.reset()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(orders_router, "GUEST_IP_LIMIT", (2, 3600))
    product = make_product(stock=10)
    codes = [
        client.post(f"{API}/orders", json=order_body((product.id, 1))).status_code for _ in range(3)
    ]
    assert codes == [201, 201, 429]
    rate_limit.limiter.reset()


def test_invalid_shipping_phone_is_422(client, customer, make_product):
    product = make_product()
    body = order_body((product.id, 1))
    body["shipping"]["phone"] = "15-1234"
    res = client.post(f"{API}/orders", json=body, headers=auth_headers(customer))
    assert res.status_code == 422


def test_cancel_restocks_and_is_final(client, db, admin, customer, make_product):
    product = make_product(stock=5)
    order_id = _place(client, customer, (product.id, 2)).json()["id"]
    url = f"{API}/orders/{order_id}/status"

    res = client.patch(url, json={"status": "cancelado"}, headers=auth_headers(admin))
    assert res.status_code == 200
    assert _stock(db, product.id) == 5

    # Final: no se puede reabrir (volvería a vender stock ya repuesto).
    res = client.patch(url, json={"status": "pendiente"}, headers=auth_headers(admin))
    assert res.status_code == 400


def test_invalid_status_transition_is_400(client, admin, customer, make_product):
    product = make_product()
    order_id = _place(client, customer, (product.id, 1)).json()["id"]
    res = client.patch(
        f"{API}/orders/{order_id}/status", json={"status": "entregado"}, headers=auth_headers(admin)
    )
    assert res.status_code == 400


def test_customer_only_sees_own_orders(client, make_user, make_product):
    product = make_product(stock=5)
    alice, bob = make_user(), make_user()
    _place(client, alice, (product.id, 1))
    assert client.get(f"{API}/orders/me", headers=auth_headers(bob)).json() == []
    assert len(client.get(f"{API}/orders/me", headers=auth_headers(alice)).json()) == 1


def test_order_item_stores_relative_image_path(client, db, admin, customer, make_product):
    product = make_product()
    client.post(
        f"{API}/products/{product.id}/images",
        files=[("files", ("foto.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 8, "image/png"))],
        headers=auth_headers(admin),
    )
    res = _place(client, customer, (product.id, 1))
    stored = db.scalar(select(OrderItem.product_image))
    assert stored.startswith(f"/static/products/{product.id}/")
    assert res.json()["items"][0]["productImage"] == f"http://api.test{stored}"
    assert db.scalar(select(OrderItem.unit_price)) == Decimal("1000.00")


def test_new_order_emails_customer_and_admin(client, customer, make_product, sent_emails):
    product = make_product(name="Botella", price=12500)
    order_id = _place(client, customer, (product.id, 2)).json()["id"]

    assert {mail.to for mail in sent_emails} == {customer.email, "avisos@ejemplo.com"}
    confirmation = next(mail for mail in sent_emails if mail.to == customer.email)
    assert f"#{order_id}" in confirmation.subject
    assert "2x Botella" in confirmation.body
    assert "$ 25.000" in confirmation.body


def _cancel(client, user, order_id):
    return client.post(f"{API}/orders/{order_id}/cancel", headers=auth_headers(user))


def test_customer_cancels_own_pending_order(client, db, customer, make_product, sent_emails):
    product = make_product(stock=5)
    order_id = _place(client, customer, (product.id, 2)).json()["id"]
    sent_emails.clear()

    res = _cancel(client, customer, order_id)
    assert res.status_code == 200
    assert res.json()["status"] == "cancelado"
    assert _stock(db, product.id) == 5
    assert [mail.to for mail in sent_emails] == ["avisos@ejemplo.com"]

    # Ya cancelado: no repone dos veces.
    assert _cancel(client, customer, order_id).status_code == 400
    assert _stock(db, product.id) == 5


def test_customer_cannot_cancel_after_paid(client, db, admin, customer, make_product):
    product = make_product(stock=5)
    order_id = _place(client, customer, (product.id, 1)).json()["id"]
    client.patch(
        f"{API}/orders/{order_id}/status", json={"status": "pagado"}, headers=auth_headers(admin)
    )
    assert _cancel(client, customer, order_id).status_code == 400
    assert _stock(db, product.id) == 4


def test_customer_cannot_cancel_someone_elses_order(client, db, make_user, make_product):
    product = make_product(stock=5)
    alice, bob = make_user(), make_user()
    order_id = _place(client, alice, (product.id, 1)).json()["id"]
    assert _cancel(client, bob, order_id).status_code == 404
    assert _stock(db, product.id) == 4


def test_cancel_requires_login(client, make_product):
    product = make_product()
    order_id = client.post(f"{API}/orders", json=order_body((product.id, 1))).json()["id"]
    assert client.post(f"{API}/orders/{order_id}/cancel").status_code == 401
