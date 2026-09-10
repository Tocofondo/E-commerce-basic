"""Conexión a la base de datos: engine, sesiones y dependencia de FastAPI."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: una sesión por request, cerrada al final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
