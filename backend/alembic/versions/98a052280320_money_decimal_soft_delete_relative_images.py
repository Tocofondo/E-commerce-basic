"""precios decimal, soft delete de productos e imagenes relativas

- Montos (`products.price`, `products.original_price`, `orders.total`,
  `order_items.unit_price`) de double precision a numeric(12, 2): se
  redondean a centavos al convertir.
- `products.is_active` para pausar productos en vez de borrarlos.
- `order_items.product_image` pasa de URL absoluta a ruta relativa
  (`/static/...`); el backend arma la URL al responder (app/core/urls.py).

Revision ID: 98a052280320
Revises: e236eb6c8b41
Create Date: 2026-10-19 21:16:53.544606

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98a052280320'
down_revision: Union[str, Sequence[str], None] = 'e236eb6c8b41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MONEY_COLUMNS = [
    ("order_items", "unit_price", False),
    ("orders", "total", False),
    ("products", "price", False),
    ("products", "original_price", True),
]


def upgrade() -> None:
    """Upgrade schema."""
    for table, column, nullable in MONEY_COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.DOUBLE_PRECISION(precision=53),
            type_=sa.Numeric(precision=12, scale=2),
            existing_nullable=nullable,
            postgresql_using=f"round({column}::numeric, 2)",
        )
    op.add_column(
        "products",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.create_index(op.f("ix_products_is_active"), "products", ["is_active"], unique=False)

    # "http://IP:8000/static/products/1/x.jpg" -> "/static/products/1/x.jpg"
    op.execute(
        "UPDATE order_items "
        "SET product_image = regexp_replace(product_image, '^https?://[^/]+', '') "
        "WHERE product_image ~ '^https?://'"
    )


def downgrade() -> None:
    """Downgrade schema. Las rutas de imagen de los pedidos quedan relativas
    (no hay forma de saber qué dominio tenían)."""
    op.drop_index(op.f("ix_products_is_active"), table_name="products")
    op.drop_column("products", "is_active")
    for table, column, nullable in MONEY_COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=sa.Numeric(precision=12, scale=2),
            type_=sa.DOUBLE_PRECISION(precision=53),
            existing_nullable=nullable,
        )
