"""Lógica de negocio de products. Sin dependencias de FastAPI (Request/
Response), salvo `UploadFile` que es solo un contenedor de datos (nombre +
stream) sin tocar Request/Response.
"""

import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.modules.orders.models import OrderItem
from app.modules.products.images import (
    CONTENT_TYPE,
    EXTENSION,
    ImageProcessingError,
    ProcessedImage,
    process_image,
)
from app.modules.products.models import Product, ProductImage
from app.modules.products.schemas import ProductCreate, ProductUpdate

logger = logging.getLogger(__name__)

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


def list_products(db: Session, include_inactive: bool = False) -> list[Product]:
    """Catálogo público: solo productos activos. El admin pide también los
    pausados (`include_inactive`). Las imágenes se traen en una sola query
    extra (selectinload) en vez de una por producto."""
    query = select(Product).options(selectinload(Product.images)).order_by(Product.id)
    if not include_inactive:
        query = query.where(Product.is_active)
    return list(db.scalars(query))


def get_product(db: Session, product_id: int) -> Product | None:
    return db.get(Product, product_id)


def _apply(product: Product, data: ProductCreate) -> None:
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
    """Actualización parcial: solo los campos presentes en el body. Antes era
    un reemplazo completo y el form del admin (que no manda badge/rating/
    reviewCount) los borraba al editar cualquier otra cosa."""
    product = get_product(db, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)

    changes = data.model_dump(exclude_unset=True, exclude={"badge"})
    for field, value in changes.items():
        setattr(product, field, value)
    if "badge" in data.model_fields_set:
        product.badge_label = data.badge.label if data.badge else None
        product.badge_variant = data.badge.variant if data.badge else None

    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> Product:
    """Soft delete: pausa el producto (deja de verse y de poder comprarse).
    No se borran la fila ni los archivos: los pedidos viejos guardan la ruta
    de su imagen y se romperían. Se reactiva con PATCH `isActive: true`."""
    product = get_product(db, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)
    product.is_active = False
    db.commit()
    db.refresh(product)
    return product


def _read_upload(file: UploadFile) -> bytes:
    """Lee el archivo cortando apenas pasa el máximo (no lo carga entero si
    es enorme). El tipo no se mira acá: lo decide Pillow por el contenido
    (ver images.py), el content-type del cliente no prueba nada."""
    content = file.file.read(MAX_IMAGE_BYTES + 1)
    if not content:
        raise InvalidImageError(f"El archivo '{file.filename}' está vacío.")
    if len(content) > MAX_IMAGE_BYTES:
        raise InvalidImageError(
            f"El archivo '{file.filename}' supera el tamaño máximo permitido "
            f"({settings.MAX_IMAGE_SIZE_MB}MB)."
        )
    return content


def product_image_dir(product_id: int) -> Path:
    return settings.STATIC_DIR / "products" / str(product_id)


def add_product_images(db: Session, product_id: int, files: list[UploadFile]) -> list[ProductImage]:
    """Valida, procesa (WEBP grande + miniatura, ver images.py) y guarda en
    disco cada archivo, y crea su fila en `product_images`. Todo o nada: si
    un archivo no pasa, no se persiste ni queda escrito ningún archivo de
    esta tanda.
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

    # Procesar la tanda completa antes de tocar disco/DB.
    processed: list[ProcessedImage] = []
    for file in files:
        try:
            processed.append(process_image(_read_upload(file), file.filename or "imagen"))
        except ImageProcessingError as exc:
            raise InvalidImageError(str(exc)) from exc

    product_dir = product_image_dir(product_id)
    product_dir.mkdir(parents=True, exist_ok=True)

    # Después del máximo actual, no `len(images)`: si se borró una imagen,
    # la cantidad ya no coincide con las posiciones y quedaban dos empatadas
    # (orden de la galería y portada al azar).
    next_position = max((image.position for image in product.images), default=-1) + 1
    created: list[ProductImage] = []
    written: list[Path] = []
    try:
        for result in processed:
            image_id = uuid.uuid4()
            filename = f"{image_id}{EXTENSION}"
            thumb_filename = f"{image_id}-thumb{EXTENSION}"
            for name, data in ((filename, result.full), (thumb_filename, result.thumb)):
                (product_dir / name).write_bytes(data)
                written.append(product_dir / name)

            image = ProductImage(
                id=image_id,
                product_id=product_id,
                filename=filename,
                thumb_filename=thumb_filename,
                content_type=CONTENT_TYPE,
                width=result.width,
                height=result.height,
                position=next_position,
            )
            db.add(image)
            created.append(image)
            next_position += 1
        db.commit()
    except Exception:
        # Sin esto, un error de disco o de DB a mitad de camino dejaba
        # archivos huérfanos que nadie referencia.
        db.rollback()
        for path in written:
            path.unlink(missing_ok=True)
        raise

    for image in created:
        db.refresh(image)
    return created


def reorder_product_images(db: Session, product_id: int, image_ids: list[uuid.UUID]) -> Product:
    """Reasigna `position` 0..n según `image_ids`, que tiene que ser
    exactamente el conjunto de imágenes del producto (sin faltantes ni
    repetidos). El primero queda de portada."""
    product = get_product(db, product_id)
    if product is None:
        raise ProductNotFoundError(product_id)
    by_id = {image.id: image for image in product.images}
    if len(image_ids) != len(by_id) or set(image_ids) != set(by_id):
        raise InvalidImageError(
            "El orden tiene que incluir todas las imágenes del producto, una vez cada una."
        )
    for position, image_id in enumerate(image_ids):
        by_id[image_id].position = position
    db.commit()
    db.expire(product, ["images"])
    db.refresh(product)
    return product


def delete_product_image(db: Session, product_id: int, image_id: uuid.UUID) -> None:
    image = db.get(ProductImage, image_id)
    if image is None or image.product_id != product_id:
        raise ProductImageNotFoundError(image_id)

    product_dir = product_image_dir(product_id)
    names = {image.filename, image.thumb_filename or image.filename}
    # Si algún pedido la tiene como snapshot (la grande en pedidos viejos, la
    # miniatura en los nuevos), los archivos se quedan en disco (solo se saca
    # de la galería): si no, el pedido mostraría una imagen rota.
    in_orders = db.scalar(
        select(OrderItem.id)
        .where(OrderItem.product_image.in_([image.path, image.thumb_path]))
        .limit(1)
    )
    db.delete(image)
    db.commit()

    if in_orders is not None:
        return
    for name in names:
        try:
            (product_dir / name).unlink(missing_ok=True)
        except OSError:
            logger.warning(
                "No se pudo borrar el archivo de imagen en disco: %s", product_dir / name
            )
