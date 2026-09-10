"""Base declarativa de SQLAlchemy.

Todos los modelos heredan de `Base`. A propósito NO importa los modelos acá
(evita imports circulares, ya que cada `models.py` importa `Base` desde este
módulo). Para Alembic, ver `alembic/env.py` -> `app.db.base_metadata`.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
