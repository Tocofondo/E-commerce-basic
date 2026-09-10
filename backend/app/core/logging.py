"""Configuración de logging de la aplicación.

`setup_logging()` se llama una vez al arrancar la app (ver app/main.py).
El resto del código simplemente hace `logging.getLogger(__name__)`.
"""

import logging
import sys

from app.core.config import settings

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging() -> None:
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    # Evita handlers duplicados si setup_logging() se llama más de una vez
    # (por ejemplo, con el reload de uvicorn).
    if root.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT))
    root.addHandler(handler)

    # Librerías ruidosas en nivel INFO, salvo que se pida DEBUG explícitamente.
    if level > logging.DEBUG:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
