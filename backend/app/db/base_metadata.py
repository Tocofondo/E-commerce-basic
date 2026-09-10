"""Importa todos los modelos de la app para poblar `Base.metadata`.

Se usa desde Alembic (autogenerate) y desde tests que necesiten crear el
schema completo (`Base.metadata.create_all`). No lo importe el código de la
app en sí (routers/servicios) para evitar imports circulares: cada módulo ya
importa `Base` directo de `app.db.base`.
"""

from app.db.base import Base

# Importar acá cada modelo nuevo que se agregue en app/modules/*/models.py
from app.modules.auth.models import User  # noqa: F401

__all__ = ["Base"]
