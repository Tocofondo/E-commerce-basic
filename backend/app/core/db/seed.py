"""Seed de datos de desarrollo: usuarios de prueba.

Idempotente: se puede correr las veces que sea, si el usuario ya existe no
lo toca (no pisa la contraseña de alguien que ya la cambió).

Uso:
    python -m app.core.db.seed
"""

import logging

from app.core.logging import setup_logging
from app.core.db.session import SessionLocal
from app.modules.auth.schemas import UserCreate, UserRole
from app.modules.auth.service import create_user, get_user_by_email

logger = logging.getLogger(__name__)

# Mismas cuentas demo que tenía el mock del frontend (admin@demo.com / admin,
# cliente@demo.com / cliente), para no romper la experiencia de "probar ya".
SEED_USERS: list[tuple[UserCreate, UserRole]] = [
    (
        UserCreate(email="admin@demo.com", password="admin1234", full_name="Admin Demo"),
        "admin",
    ),
    (
        UserCreate(email="cliente@demo.com", password="cliente1234", full_name="Cliente Demo"),
        "customer",
    ),
]


def run_seed() -> None:
    db = SessionLocal()
    try:
        for user_in, role in SEED_USERS:
            if get_user_by_email(db, user_in.email) is not None:
                logger.info("Ya existe, no se toca: %s", user_in.email)
                continue
            create_user(db, user_in, role=role)
    finally:
        db.close()


if __name__ == "__main__":
    setup_logging()
    run_seed()
