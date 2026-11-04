import io
from pathlib import Path

from PIL import Image

from app.core.config import settings
from tests.conftest import API, auth_headers, image_bytes, order_body


def _upload(client, admin, product_id, content=None, content_type="image/png"):
    return client.post(
        f"{API}/products/{product_id}/images",
        files=[("files", ("foto.png", content or image_bytes(), content_type))],
        headers=auth_headers(admin),
    )


def _files(product_id):
    return sorted(
        p.name for p in (Path(settings.STATIC_DIR) / "products" / str(product_id)).iterdir()
    )


def _fetch_image(client, url):
    res = client.get(url.removeprefix("http://api.test"))
    assert res.status_code == 200
    return res, Image.open(io.BytesIO(res.content))


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


def test_upload_rejects_truncated_image_with_valid_header(client, admin, make_product):
    # Antes alcanzaba con que los primeros bytes fueran de PNG.
    product = make_product()
    res = _upload(client, admin, product.id, content=b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)
    assert res.status_code == 400
    assert not (Path(settings.STATIC_DIR) / "products" / str(product.id)).exists() or not _files(
        product.id
    )


def test_upload_converts_to_webp_with_thumbnail(client, admin, make_product):
    product = make_product()
    res = _upload(client, admin, product.id, content=image_bytes("JPEG", (3000, 1500)))
    assert res.status_code == 201
    image = res.json()[0]
    assert image["url"].endswith(".webp")
    assert image["thumbUrl"].endswith("-thumb.webp")
    assert (image["width"], image["height"]) == (1600, 800)

    response, full = _fetch_image(client, image["url"])
    assert full.format == "WEBP" and full.size == (1600, 800)
    # Nombre único por subida: se puede cachear para siempre.
    assert "immutable" in response.headers["cache-control"]
    _, thumb = _fetch_image(client, image["thumbUrl"])
    assert max(thumb.size) == 640

    listed = client.get(f"{API}/products/{product.id}").json()
    assert listed["image"] == image["url"]
    assert listed["thumb"] == image["thumbUrl"]


def test_small_images_are_not_upscaled(client, admin, make_product):
    product = make_product()
    image = _upload(client, admin, product.id, content=image_bytes(size=(300, 200))).json()[0]
    assert (image["width"], image["height"]) == (300, 200)


def test_upload_applies_exif_rotation_and_strips_metadata(client, admin, make_product):
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: rotar 90° (foto de celu "parada")
    exif[0x010F] = "MarcaDeCelular"  # Make
    product = make_product()
    content = image_bytes("JPEG", (400, 200), exif=exif.tobytes())
    image = _upload(client, admin, product.id, content=content, content_type="image/jpeg").json()[0]

    assert (image["width"], image["height"]) == (200, 400)
    response, full = _fetch_image(client, image["url"])
    assert not full.getexif()
    assert b"MarcaDeCelular" not in response.content


def test_upload_ignores_client_content_type(client, admin, make_product):
    # El tipo lo decide el contenido: un JPEG declarado como PNG pasa igual.
    product = make_product()
    res = _upload(client, admin, product.id, content=image_bytes("JPEG"), content_type="image/png")
    assert res.status_code == 201


def test_upload_batch_is_all_or_nothing(client, admin, make_product):
    product = make_product()
    res = client.post(
        f"{API}/products/{product.id}/images",
        files=[
            ("files", ("buena.png", image_bytes(), "image/png")),
            ("files", ("mala.png", b"no soy una imagen", "image/png")),
        ],
        headers=auth_headers(admin),
    )
    assert res.status_code == 400
    assert "mala.png" in res.json()["detail"]
    assert client.get(f"{API}/products/{product.id}").json()["images"] == []


def test_reorder_images_changes_cover(client, admin, make_product):
    product = make_product()
    first, second, third = (_upload(client, admin, product.id).json()[0] for _ in range(3))
    res = client.put(
        f"{API}/products/{product.id}/images/order",
        json={"imageIds": [third["id"], first["id"], second["id"]]},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert [img["id"] for img in body["images"]] == [third["id"], first["id"], second["id"]]
    assert [img["position"] for img in body["images"]] == [0, 1, 2]
    assert body["image"] == third["url"]


def test_reorder_requires_every_image_once(client, admin, make_product):
    product = make_product()
    first, second = (_upload(client, admin, product.id).json()[0] for _ in range(2))
    url = f"{API}/products/{product.id}/images/order"
    for ids in ([first["id"]], [first["id"], first["id"]]):
        res = client.put(url, json={"imageIds": ids}, headers=auth_headers(admin))
        assert res.status_code == 400


def test_reorder_is_admin_only(client, customer, make_product):
    product = make_product()
    res = client.put(
        f"{API}/products/{product.id}/images/order",
        json={"imageIds": ["00000000-0000-0000-0000-000000000000"]},
        headers=auth_headers(customer),
    )
    assert res.status_code == 403


def test_deleting_image_removes_both_files(client, admin, make_product):
    product = make_product()
    image = _upload(client, admin, product.id).json()[0]
    assert len(_files(product.id)) == 2
    client.delete(f"{API}/products/{product.id}/images/{image['id']}", headers=auth_headers(admin))
    assert _files(product.id) == []


def test_deleting_image_used_by_an_order_keeps_the_file(client, admin, customer, make_product):
    product = make_product()
    image = _upload(client, admin, product.id).json()[0]
    client.post(f"{API}/orders", json=order_body((product.id, 1)), headers=auth_headers(customer))

    res = client.delete(
        f"{API}/products/{product.id}/images/{image['id']}", headers=auth_headers(admin)
    )
    assert res.status_code == 204
    assert len(_files(product.id)) == 2

    order = client.get(f"{API}/orders/me", headers=auth_headers(customer)).json()[0]
    assert order["items"][0]["productImage"] == image["thumbUrl"]


def test_upload_after_delete_gets_a_free_position(client, admin, make_product):
    product = make_product()
    first, _second = (_upload(client, admin, product.id).json()[0] for _ in range(2))
    client.delete(f"{API}/products/{product.id}/images/{first['id']}", headers=auth_headers(admin))

    new = _upload(client, admin, product.id).json()[0]

    images = client.get(f"{API}/products/{product.id}").json()["images"]
    positions = [img["position"] for img in images]
    assert len(set(positions)) == len(positions) == 2
    assert new["position"] == max(positions)


def test_reprocess_converts_legacy_images(client, db, admin, customer, make_product):
    from app.modules.products import reprocess_images
    from app.modules.products.models import ProductImage

    product = make_product()
    product_dir = Path(settings.STATIC_DIR) / "products" / str(product.id)
    product_dir.mkdir(parents=True)
    # Imagen subida antes del procesamiento: JPEG tal cual, sin miniatura.
    legacy = ProductImage(
        product_id=product.id, filename="vieja.jpg", content_type="image/jpeg", position=0
    )
    db.add(legacy)
    db.commit()
    (product_dir / "vieja.jpg").write_bytes(image_bytes("JPEG", (2400, 1200)))
    # Un pedido viejo apunta al archivo original: tiene que sobrevivir.
    client.post(f"{API}/orders", json=order_body((product.id, 1)), headers=auth_headers(customer))

    reprocess_images.main()
    reprocess_images.main()  # idempotente

    db.expire_all()
    image = db.get(ProductImage, legacy.id)
    assert image.filename.endswith("-full.webp")
    assert image.thumb_filename.endswith("-thumb.webp")
    assert (image.width, image.height) == (1600, 800)
    assert "vieja.jpg" in _files(product.id)
    assert len(_files(product.id)) == 3
