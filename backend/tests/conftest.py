"""Fixtures de los tests: base Postgres de test, cliente HTTP y helpers.

La base es real (Postgres, no SQLite): los tests dependen de cosas propias
de Postgres como `SELECT ... FOR UPDATE`, `numeric` y los CHECK. Por defecto
usa `ecommerce_test` en el mismo servidor que el `.env` (la crea si no
existe); en CI la define `DATABASE_URL`.

El schema se arma con `alembic upgrade head` sobre una base vacía, así los
tests también prueban que las migraciones corran.
"""

import os
import shutil
import tempfile
from collections.abc import Callable, Iterator
from dataclasses import dataclass

# Antes de importar `app`: `settings` se lee una sola vez al importarlo.
os.environ.setdefault("POSTGRES_DB", "ecommerce_test")
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["SMTP_HOST"] = ""
os.environ["ORDER_NOTIFY_EMAIL"] = "avisos@ejemplo.com"
os.environ["BACKEND_PUBLIC_URL"] = "http://api.test"
os.environ["STATIC_DIR"] = tempfile.mkdtemp(prefix="ecommerce-static-")

import psycopg  # noqa: E402
import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import make_url, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from alembic import command  # noqa: E402
from app.core import email  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.db.session import SessionLocal, engine  # noqa: E402
from app.core.security import create_access_token, password_fingerprint  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.auth.models import User  # noqa: E402
from app.modules.auth.schemas import UserCreate, UserRole  # noqa: E402
from app.modules.auth.service import create_user  # noqa: E402
from app.modules.products.models import Product  # noqa: E402
from app.modules.products.schemas import ProductCreate  # noqa: E402
from app.modules.products.service import create_product  # noqa: E402

API = settings.API_V1_PREFIX
PASSWORD = "clave-segura-123"


def _ensure_database() -> None:
    url = make_url(settings.DATABASE_URL)
    admin_dsn = url.set(drivername="postgresql", database="postgres").render_as_string(
        hide_password=False
    )
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (url.database,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{url.database}"')


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    # El fixture borra el schema entero: nunca contra una base que no sea de
    # test (ej. si el .env define DATABASE_URL apuntando a la de desarrollo).
    database_name = make_url(settings.DATABASE_URL).database or ""
    if not database_name.endswith("_test"):
        pytest.exit(
            f"Los tests borran la base '{database_name}': usá una que termine en _test "
            "(POSTGRES_DB o DATABASE_URL).",
            returncode=1,
        )
    _ensure_database()
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    command.upgrade(Config("alembic.ini"), "head")
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def clean_tables() -> Iterator[None]:
    yield
    # Los ids vuelven a 1 (RESTART IDENTITY): sin esto, las imágenes de un
    # test quedarían en la carpeta del "mismo" producto del siguiente.
    shutil.rmtree(settings.STATIC_DIR / "products", ignore_errors=True)
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE users, products, product_images, orders, order_items, "
                "withdrawal_requests RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db() -> Iterator[Session]:
    session = SessionLocal()
    yield session
    session.close()


@dataclass
class SentEmail:
    to: str
    subject: str
    body: str


@pytest.fixture
def sent_emails(monkeypatch: pytest.MonkeyPatch) -> list[SentEmail]:
    """Mails "enviados" durante el test (no sale nada por SMTP)."""
    sent: list[SentEmail] = []
    monkeypatch.setattr(
        email, "_send", lambda to, subject, body: sent.append(SentEmail(to, subject, body))
    )
    return sent


@pytest.fixture
def make_user(db: Session) -> Callable[..., User]:
    counter = iter(range(1, 1000))

    def _make(role: UserRole = "customer", email_addr: str | None = None) -> User:
        user_in = UserCreate(
            email=email_addr or f"user{next(counter)}@ejemplo.com",
            phone="3415551234",
            password=PASSWORD,
            full_name="Cliente de Prueba",
        )
        return create_user(db, user_in, role=role)

    return _make


def auth_headers(user: User) -> dict[str, str]:
    token = create_access_token(
        subject=user.email, fingerprint=password_fingerprint(user.hashed_password)
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def customer(make_user: Callable[..., User]) -> User:
    return make_user()


@pytest.fixture
def admin(make_user: Callable[..., User]) -> User:
    return make_user(role="admin")


@pytest.fixture
def make_product(db: Session) -> Callable[..., Product]:
    def _make(**overrides) -> Product:
        data = {"name": "Botella térmica", "category": "Verano", "price": 1000, "stock": 5}
        data.update(overrides)
        return create_product(db, ProductCreate(**data))

    return _make


SHIPPING = {
    "fullName": "Cliente de Prueba",
    "phone": "0341 15 555-1234",
    "address": "Córdoba 1234",
    "city": "Rosario",
    "postalCode": "2000",
}


def order_body(*items: tuple[int, int]) -> dict:
    return {
        "items": [{"productId": product_id, "qty": qty} for product_id, qty in items],
        "shipping": dict(SHIPPING),
    }
