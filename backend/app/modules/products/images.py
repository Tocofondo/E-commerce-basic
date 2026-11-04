"""Procesamiento de imágenes de producto con Pillow. Sin DB ni FastAPI: recibe
bytes y devuelve bytes, así se testea y se reusa (subida y reproceso).

Cada imagen subida se re-codifica en dos WEBP:
- `full`: lado mayor hasta FULL_MAX_SIDE, para el detalle del producto.
- `thumb`: lado mayor hasta THUMB_MAX_SIDE, para cards, carrito y admin.

Re-codificar (en vez de guardar el archivo tal cual) además:
- valida de verdad que sea una imagen (se decodifica entera, no alcanza con
  que los primeros bytes parezcan un PNG);
- aplica la orientación EXIF (las fotos del celu vienen "acostadas" con un
  flag de rotación que no todos los navegadores respetan);
- descarta los metadatos (EXIF con GPS de dónde se sacó la foto, modelo de
  celular, etc.), que si no quedarían públicos;
- baja el peso: una foto de celu de 5MB queda en ~200KB / ~40KB.
"""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

FULL_MAX_SIDE = 1600
THUMB_MAX_SIDE = 640
FULL_QUALITY = 82
THUMB_QUALITY = 78

# Formatos que Pillow tiene que detectar (por contenido, no por el
# content-type que declara el cliente). MPO = JPEG multi-imagen de algunas
# cámaras/celulares.
ACCEPTED_FORMATS = {"JPEG", "MPO", "PNG", "WEBP", "GIF"}
ACCEPTED_LABEL = "JPG, PNG, WEBP o GIF"

# Tope de píxeles para no decodificar una "bomba" (un PNG chico que se
# expande a gigas en memoria). 50 MP cubre cualquier foto de celular.
MAX_PIXELS = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

CONTENT_TYPE = "image/webp"
EXTENSION = ".webp"


class ImageProcessingError(Exception):
    """El archivo no es una imagen válida/soportada. El mensaje va al cliente."""


@dataclass(frozen=True)
class ProcessedImage:
    full: bytes
    thumb: bytes
    width: int
    height: int


def _encode(image: Image.Image, max_side: int, quality: int) -> tuple[bytes, int, int]:
    copy = image.copy()
    # `thumbnail` solo achica (nunca agranda) y mantiene la proporción.
    copy.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    # Sin `exif=`/`icc_profile=`: el WEBP sale sin metadatos.
    copy.save(buffer, "WEBP", quality=quality, method=4)
    return buffer.getvalue(), copy.width, copy.height


def process_image(content: bytes, filename: str = "imagen") -> ProcessedImage:
    try:
        with Image.open(io.BytesIO(content)) as source:
            if source.format not in ACCEPTED_FORMATS:
                raise ImageProcessingError(
                    f"'{filename}' no es un formato soportado ({source.format or 'desconocido'}). "
                    f"Formatos permitidos: {ACCEPTED_LABEL}."
                )
            if source.width * source.height > MAX_PIXELS:
                raise ImageProcessingError(f"'{filename}' tiene demasiados píxeles.")
            # Un GIF animado queda con su primer cuadro.
            source.seek(0)
            source.load()
            image = ImageOps.exif_transpose(source)
    except ImageProcessingError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ImageProcessingError(f"'{filename}' no es una imagen válida.") from exc

    # WEBP admite RGB o RGBA: paletas (GIF/PNG-8), CMYK, escala de grises,
    # 16 bits, etc. se pasan a uno de esos, conservando la transparencia.
    has_alpha = image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )
    image = image.convert("RGBA" if has_alpha else "RGB")

    full, width, height = _encode(image, FULL_MAX_SIDE, FULL_QUALITY)
    thumb, _, _ = _encode(image, THUMB_MAX_SIDE, THUMB_QUALITY)
    return ProcessedImage(full=full, thumb=thumb, width=width, height=height)
