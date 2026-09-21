"""Punto de entrada de la app FastAPI."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.DEBUG,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # Imágenes de producto subidas por el admin (ver app/modules/products).
    # El directorio se crea si no existe (repo lo trae vacío/gitignoreado).
    settings.STATIC_DIR.mkdir(parents=True, exist_ok=True)
    app.mount(
        settings.STATIC_URL_PREFIX,
        StaticFiles(directory=settings.STATIC_DIR),
        name="static",
    )

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()

logger.info("%s iniciada (environment=%s)", settings.APP_NAME, settings.ENVIRONMENT)

if __name__ == "__main__":
    # Alternativa a `uv run uvicorn app.main:app --reload`. Hay que
    # invocarlo como módulo (`uv run python -m app.main`), no como script
    # suelto (`uv run app/main.py`) — corrido como script, Python agrega
    # `app/` al sys.path en vez de `backend/` y los imports absolutos de
    # arriba (`from app.api...`) no encuentran el paquete `app`.
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
