"""Lógica de negocio de products. Sin dependencias de FastAPI (Request/
Response), salvo `UploadFile` que es solo un contenedor de datos (nombre +
stream) sin tocar Request/Response.
"""

import logging
import shutil
import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.products.models import Product, ProductImage
from app.modules.products.schemas import ProductCreate, ProductUpdate

logger = logging.getLogger(__name__)

# Extensión de disco por content-type aceptado — nunca se confía en el
# filename que manda el cliente (evita path traversal / extensiones falsas).
ALLOWED_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_BYTES = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
# Límite a nivel aplicación (no hay CHECK/trigger en la DB): se valida acá
# antes de escribir nada a disco.
MAX_IMAGES_PER_PRODUCT = 4


class ProductNotFoundError(Exception):
    pass


class ProductImageNotFoundError(Exception):
    pass


class InvalidImageError(Exception):
    """Archivo rechazado por tipo no soportado, vacío o demasiado grande."""

    pass


def list_products(db: Session) -> list[Product]:
    return list(db.scalars(select(Product).order_by(Product.id)))


def get_product(db: Session, product_id: int) -> Product | None:
    return db.get(Product, product_id)


def _apply(product: Product, data: ProductCreate | ProductUpdate) -> None:
    product.name = data.name
    product.description = data.description
    product.category = data.category
    product.price = data.price
    product.original_price = data.original_price
    product.stock = data.stock
    product.rating = data.rating
    product.review_count = data.review_count
    product.badge_label = data.badge.label if data.badge else None
    product.badge_variant = data.badge.variant if data.badge else None


def create_product(db: Session, data: ProductCreate) -> Product:
    product = Product()
    _apply(product, data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, data: ProductUpdate) -> Product:
    product = get_product(db, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)
    _apply(product, data)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> None:
    product = get_product(db, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)
    db.delete(product)
    db.commit()

    # La cascada de la FK ya borró las filas `product_images`; falta borrar
    # los archivos del producto en disco (no los maneja la DB).
    product_dir = settings.STATIC_DIR / "products" / str(product_id)
    shutil.rmtree(product_dir, ignore_errors=True)


def _validate_image(file: UploadFile) -> tuple[bytes, str]:
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if ext is None:
        allowed = ", ".join(sorted(ALLOWED_IMAGE_TYPES))
        raise InvalidImageError(
            f"Tipo de archivo no soportado ({file.content_type or 'desconocido'}). "
            f"Formatos permitidos: {allowed}."
        )

    content = file.file.read()
    if not content:
        raise InvalidImageError(f"El archivo '{file.filename}' está vacío.")
    if len(content) > MAX_IMAGE_BYTES:
        raise InvalidImageError(
            f"El archivo '{file.filename}' supera el tamaño máximo permitido "
            f"({settings.MAX_IMAGE_SIZE_MB}MB)."
        )
    return content, ext


def add_product_images(
    db: Session, product_id: int, files: list[UploadFile]
) -> list[ProductImage]:
    """Valida (tipo + tamaño) y guarda en disco cada archivo, y crea su fila
    en `product_images`. Todo o nada: si un archivo no pasa la validación no
    se persiste ni se escribe ningún archivo de esta tanda.
    """
    product = get_product(db, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)

    total_after = len(product.images) + len(files)
    if total_after > MAX_IMAGES_PER_PRODUCT:
        raise InvalidImageError(
            f"Un producto admite hasta {MAX_IMAGES_PER_PRODUCT} imágenes "
            f"(ya tiene {len(product.images)}, se intentaron subir {len(files)})."
        )

    # Validar la tanda completa antes de tocar disco/DB.
    validated = [(file, *_validate_image(file)) for file in files]

    product_dir = settings.STATIC_DIR / "products" / str(product_id)
    product_dir.mkdir(parents=True, exist_ok=True)

    next_position = len(product.images)
    created: list[ProductImage] = []
    for file, content, ext in validated:
        image_id = uuid.uuid4()
        filename = f"{image_id}{ext}"
        (product_dir / filename).write_bytes(content)

        image = ProductImage(
            id=image_id,
            product_id=product_id,
            filename=filename,
            content_type=file.content_type,
            position=next_position,
        )
        db.add(image)
        created.append(image)
        next_position += 1

    db.commit()
    for image in created:
        db.refresh(image)
    return created


def delete_product_image(db: Session, product_id: int, image_id: uuid.UUID) -> None:
    image = db.get(ProductImage, image_id)
    if image is None or image.product_id != product_id:
        raise ProductImageNotFoundError(image_id)

    file_path = settings.STATIC_DIR / "products" / str(product_id) / image.filename
    db.delete(image)
    db.commit()

    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        logger.warning("No se pudo borrar el archivo de imagen en disco: %s", file_path)
