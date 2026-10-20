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


def test_order_requires_login(client, make_product):
    product = make_product()
    assert client.post(f"{API}/orders", json=order_body((product.id, 1))).status_code == 401


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
