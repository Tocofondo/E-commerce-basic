"""URLs públicas de archivos servidos por el backend (imágenes de producto).

En la DB se guardan rutas relativas (`/static/products/3/<uuid>.jpg`) y la
URL absoluta se arma al responder con `BACKEND_PUBLIC_URL`. Así, si cambia el
dominio (de `http://IP` a `https://mitienda.com.ar`), los productos y los
pedidos viejos siguen apuntando a la imagen correcta.
"""

from app.core.config import settings


def public_url(path: str) -> str:
    """`/static/...` → `<BACKEND_PUBLIC_URL>/static/...`. Deja tal cual un
    string vacío o una URL que ya es absoluta (datos previos a la migración)."""
    if not path or path.startswith(("http://", "https://")):
        return path
    return f"{settings.BACKEND_PUBLIC_URL.rstrip('/')}{path}"
