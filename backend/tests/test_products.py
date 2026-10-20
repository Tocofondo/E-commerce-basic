from pathlib import Path

from app.core.config import settings
from tests.conftest import API, auth_headers, order_body

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def _upload(client, admin, product_id, content=PNG, content_type="image/png"):
    return client.post(
        f"{API}/products/{product_id}/images",
        files=[("files", ("foto.png", content, content_type))],
        headers=auth_headers(admin),
    )


def test_public_catalog_serializes_money_as_numbers(client, make_product):
    make_product(price="18999.99", original_price=24999)
    product = client.get(f"{API}/products").json()[0]
    assert product["price"] == 18999.99
    assert product["originalPrice"] == 24999
    assert product["isActive"] is True


def test_price_with_more_than_two_decimals_is_rejected(client, admin):
    res = client.post(
        f"{API}/products",
        json={"name": "X", "category": "Y", "price": 10.123, "stock": 1},
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_customer_cannot_create_products(client, customer):
    res = client.post(
        f"{API}/products",
        json={"name": "X", "category": "Y", "price": 10, "stock": 1},
        headers=auth_headers(customer),
    )
    assert res.status_code == 403


def test_partial_update_keeps_badge_and_rating(client, admin, make_product):
    product = make_product(badge={"label": "Oferta", "variant": "sale"}, rating=4.5)
    res = client.patch(
        f"{API}/products/{product.id}", json={"stock": 9}, headers=auth_headers(admin)
    )
    assert res.status_code == 200
    body = res.json()
    assert body["stock"] == 9
    assert body["badge"] == {"label": "Oferta", "variant": "sale"}
    assert body["rating"] == 4.5


def test_update_can_clear_badge_with_null(client, admin, make_product):
    product = make_product(badge={"label": "Oferta", "variant": "sale"})
    res = client.patch(
        f"{API}/products/{product.id}", json={"badge": None}, headers=auth_headers(admin)
    )
    assert res.json()["badge"] is None


def test_delete_pauses_product(client, admin, customer, make_product):
    product = make_product()
    res = client.delete(f"{API}/products/{product.id}", headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json()["isActive"] is False

    # Fuera del catálogo público y no se puede comprar...
    assert client.get(f"{API}/products").json() == []
    assert client.get(f"{API}/products/{product.id}").status_code == 404
    res = client.post(
        f"{API}/orders", json=order_body((product.id, 1)), headers=auth_headers(customer)
    )
    assert res.status_code == 404

    # ...pero el admin lo sigue viendo y lo puede reactivar.
    all_products = client.get(f"{API}/products/all", headers=auth_headers(admin)).json()
    assert [p["id"] for p in all_products] == [product.id]
    res = client.patch(
        f"{API}/products/{product.id}", json={"isActive": True}, headers=auth_headers(admin)
    )
    assert res.json()["isActive"] is True
    assert len(client.get(f"{API}/products").json()) == 1


def test_products_all_is_admin_only(client, customer):
    assert client.get(f"{API}/products/all", headers=auth_headers(customer)).status_code == 403


def test_upload_image_returns_absolute_url(client, admin, make_product):
    product = make_product()
    res = _upload(client, admin, product.id)
    assert res.status_code == 201
    url = res.json()[0]["url"]
    assert url.startswith(f"http://api.test/static/products/{product.id}/")


def test_upload_rejects_fake_image(client, admin, make_product):
    product = make_product()
    res = _upload(client, admin, product.id, content=b"<?php echo 1; ?>")
    assert res.status_code == 400
    assert "no es una imagen" in res.json()["detail"]


def test_upload_rejects_unsupported_type(client, admin, make_product):
    product = make_product()
    res = _upload(client, admin, product.id, content=b"%PDF-1.4", content_type="application/pdf")
    assert res.status_code == 400


def test_deleting_image_used_by_an_order_keeps_the_file(client, admin, customer, make_product):
    product = make_product()
    image = _upload(client, admin, product.id).json()[0]
    client.post(f"{API}/orders", json=order_body((product.id, 1)), headers=auth_headers(customer))

    res = client.delete(
        f"{API}/products/{product.id}/images/{image['id']}", headers=auth_headers(admin)
    )
    assert res.status_code == 204
    files = list((Path(settings.STATIC_DIR) / "products" / str(product.id)).iterdir())
    assert len(files) == 1

    order = client.get(f"{API}/orders/me", headers=auth_headers(customer)).json()[0]
    assert order["items"][0]["productImage"] == image["url"]
