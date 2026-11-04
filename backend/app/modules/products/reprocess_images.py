"""Pasa las imágenes subidas antes del procesamiento (archivo original, sin
miniatura) al formato actual: WEBP grande + miniatura, sin metadatos.

    uv run python -m app.modules.products.reprocess_images
    docker compose exec backend uv run python -m app.modules.products.reprocess_images

Idempotente: solo toca las filas con `thumb_filename` NULL. El archivo
original se borra salvo que algún pedido lo use de snapshot.
"""

import logging

from sqlalchemy import select

from app.core.db.session import SessionLocal
from app.core.logging import setup_logging
from app.modules.orders.models import OrderItem
from app.modules.products.images import CONTENT_TYPE, EXTENSION, ImageProcessingError, process_image
from app.modules.products.models import ProductImage
from app.modules.products.service import product_image_dir

logger = logging.getLogger(__name__)


def main() -> None:
    setup_logging()
    done = skipped = 0
    with SessionLocal() as db:
        pending = db.scalars(select(ProductImage).where(ProductImage.thumb_filename.is_(None)))
        for image in list(pending):
            product_dir = product_image_dir(image.product_id)
            source = product_dir / image.filename
            if not source.is_file():
                logger.warning("Falta el archivo %s (imagen %s): se saltea", source, image.id)
                skipped += 1
                continue
            content = source.read_bytes()
            original_size = len(content)
            try:
                result = process_image(content, image.filename)
            except ImageProcessingError as exc:
                logger.warning("No se pudo procesar %s: %s", source, exc)
                skipped += 1
                continue

            old_path = image.path
            # Nombres distintos del original: si ya era `<id>.webp`, no pisarlo
            # (algún pedido puede apuntar a él).
            full_name = f"{image.id}-full{EXTENSION}"
            thumb_name = f"{image.id}-thumb{EXTENSION}"
            (product_dir / full_name).write_bytes(result.full)
            (product_dir / thumb_name).write_bytes(result.thumb)

            image.filename = full_name
            image.thumb_filename = thumb_name
            image.content_type = CONTENT_TYPE
            image.width = result.width
            image.height = result.height
            db.commit()

            in_orders = db.scalar(
                select(OrderItem.id).where(OrderItem.product_image == old_path).limit(1)
            )
            if in_orders is None:
                source.unlink(missing_ok=True)
            done += 1
            logger.info(
                "Imagen %s: %d KB -> %d KB (+ miniatura de %d KB)",
                image.id,
                original_size // 1024,
                len(result.full) // 1024,
                len(result.thumb) // 1024,
            )

    print(f"Reprocesadas: {done}. Salteadas: {skipped}.")


if __name__ == "__main__":
    main()
