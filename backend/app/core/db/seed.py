"""Seed de datos de desarrollo: usuarios de prueba + catálogo inicial.

Idempotente: se puede correr las veces que sea, si un usuario o producto ya
existe no lo toca (no pisa la contraseña de alguien que ya la cambió, ni
duplica productos).

Uso:
    python -m app.core.db.seed
"""

import logging

from sqlalchemy import select

from app.core.logging import setup_logging
from app.core.db.session import SessionLocal
from app.modules.auth.schemas import UserCreate, UserRole
from app.modules.auth.service import create_user, get_user_by_email
from app.modules.products.models import Product
from app.modules.products.schemas import BadgeInfo, ProductCreate
from app.modules.products.service import create_product

logger = logging.getLogger(__name__)

# Ya no se siembran cuentas demo acá para que el login se comporte como en
# prod real (los clientes se registran desde /register; el registro público
# nunca puede pisar el role, un admin siempre se crea server-side). Las
# cuentas de prueba viven en `seed_local.py`, un archivo sin trackear en git
# (ver backend/.gitignore) que no se sube al repo ni queda visible para quien
# clone el proyecto — solo existe en esta máquina.
try:
    from app.core.db.seed_local import SEED_USERS
except ImportError:
    SEED_USERS: list[tuple[UserCreate, UserRole]] = []

# Mismo catálogo mock que tenía ProductService en el frontend
# (frontend/src/app/core/services/product.service.ts), movido acá para que
# sea real y compartido entre navegadores/dispositivos.
# Sin `image`: las imágenes ahora se suben como archivos reales vía
# POST /products/{id}/images (ver app/modules/products), no hay URL que
# seedear acá. Los productos seed quedan sin imagen hasta que el admin les
# suba una desde /admin/productos.
SEED_PRODUCTS: list[ProductCreate] = [
    ProductCreate(
        name="Auriculares Inalámbricos Pro Max",
        price=79.99,
        original_price=129.99,
        badge=BadgeInfo(label="Sale", variant="sale"),
        rating=4.5,
        review_count=128,
        description="Auriculares inalámbricos con cancelación de ruido activa y 30 horas de batería.",
        category="Electrónica",
        stock=24,
    ),
    ProductCreate(
        name="Zapatillas Running Ultra Boost",
        price=149.99,
        badge=BadgeInfo(label="Nuevo", variant="new"),
        rating=5,
        review_count=43,
        description="Zapatillas de running con amortiguación reactiva para largas distancias.",
        category="Deportes",
        stock=12,
    ),
    ProductCreate(
        name="Mochila Urbana Minimalista 25L",
        price=59.99,
        original_price=89.99,
        rating=4,
        review_count=76,
        description="Mochila resistente al agua con compartimento acolchado para laptop de 15\".",
        category="Accesorios",
        stock=30,
    ),
    ProductCreate(
        name="Reloj Inteligente Serie X",
        price=199.99,
        badge=BadgeInfo(label="Destacado", variant="featured"),
        rating=4.5,
        review_count=201,
        description="Reloj inteligente con GPS, monitor de ritmo cardíaco y resistencia al agua.",
        category="Electrónica",
        stock=0,
    ),
    ProductCreate(
        name="Campera Impermeable Trekking",
        price=89.99,
        rating=4.2,
        review_count=34,
        description="Campera impermeable y transpirable, ideal para trekking y montaña.",
        category="Ropa",
        stock=18,
    ),
    ProductCreate(
        name="Lámpara de Escritorio LED",
        price=34.99,
        original_price=49.99,
        badge=BadgeInfo(label="Sale", variant="sale"),
        rating=4.7,
        review_count=58,
        description="Lámpara LED regulable con puerto USB y temperatura de color ajustable.",
        category="Hogar",
        stock=40,
    ),
    ProductCreate(
        name="Set de Sartenes Antiadherentes",
        price=69.99,
        rating=4.3,
        review_count=91,
        description="Set de 3 sartenes antiadherentes aptas para inducción.",
        category="Hogar",
        stock=15,
    ),
    ProductCreate(
        name="Bicicleta Urbana Plegable",
        price=349.99,
        badge=BadgeInfo(label="Destacado", variant="featured"),
        rating=4.8,
        review_count=22,
        description="Bicicleta plegable liviana ideal para combinar con transporte público.",
        category="Deportes",
        stock=6,
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

        for product_in in SEED_PRODUCTS:
            if db.scalar(select(Product).where(Product.name == product_in.name)) is not None:
                logger.info("Ya existe, no se toca: %s", product_in.name)
                continue
            create_product(db, product_in)
    finally:
        db.close()


if __name__ == "__main__":
    setup_logging()
    run_seed()
