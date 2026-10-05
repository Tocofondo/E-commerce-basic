"""Crea (o promueve) un usuario admin desde la consola.

No hay endpoint público que cree admins (ver modules/auth): en producción el
primer admin se crea con este script, corriendo dentro del contenedor del
backend. Pide los datos por consola y la contraseña sin mostrarla.

Uso:
    python -m app.core.db.create_admin
    # en el servidor (ver DEPLOY.md):
    docker compose exec backend uv run python -m app.core.db.create_admin

Si el email ya existe, en vez de crear otra cuenta pregunta si se promueve a
admin la existente (su contraseña no se toca).
"""

import getpass
import sys

from pydantic import ValidationError

from app.core.db.session import SessionLocal
from app.core.logging import setup_logging
from app.modules.auth.schemas import UserCreate
from app.modules.auth.service import create_user, get_user_by_email


def main() -> int:
    email = input("Email del admin: ").strip()
    db = SessionLocal()
    try:
        existing = get_user_by_email(db, email)
        if existing is not None:
            if existing.role == "admin":
                print(f"{email} ya es admin, no hay nada que hacer.")
                return 0
            answer = input(f"{email} ya existe como cliente. ¿Promoverlo a admin? [s/N]: ")
            if answer.strip().lower() != "s":
                print("Cancelado.")
                return 1
            existing.role = "admin"
            db.commit()
            print(f"{email} ahora es admin.")
            return 0

        full_name = input("Nombre completo (opcional): ").strip() or None
        phone = input("Teléfono: ").strip()
        password = getpass.getpass("Contraseña (mínimo 8 caracteres): ")
        if password != getpass.getpass("Repetir contraseña: "):
            print("Las contraseñas no coinciden.")
            return 1

        try:
            user_in = UserCreate(email=email, phone=phone, password=password, full_name=full_name)
        except ValidationError as exc:
            print(f"Datos inválidos:\n{exc}")
            return 1

        create_user(db, user_in, role="admin")
        print(f"Admin creado: {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    setup_logging()
    sys.exit(main())
