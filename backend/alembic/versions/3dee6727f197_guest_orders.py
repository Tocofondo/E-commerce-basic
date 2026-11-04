"""guest orders

Pedidos sin login: `user_id` y `shipping_phone` pasan a ser opcionales y el
email de contacto se guarda en el pedido (`customer_email`, antes salía de la
cuenta). Se exige email o teléfono.

Revision ID: 3dee6727f197
Revises: f4d6e5eb5ce6
Create Date: 2026-11-03 23:51:30.048249

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3dee6727f197"
down_revision: str | Sequence[str] | None = "f4d6e5eb5ce6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("orders", sa.Column("customer_email", sa.String(length=255), nullable=True))
    # Pedidos existentes: el email de la cuenta que los hizo.
    op.execute(
        "UPDATE orders SET customer_email = users.email FROM users WHERE users.id = orders.user_id"
    )
    op.alter_column("orders", "user_id", existing_type=sa.UUID(), nullable=True)
    op.alter_column("orders", "shipping_phone", existing_type=sa.VARCHAR(length=50), nullable=True)
    op.create_check_constraint(
        "ck_orders_contact", "orders", "customer_email IS NOT NULL OR shipping_phone IS NOT NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Los pedidos de invitados no tienen lugar en el esquema anterior.
    op.execute("DELETE FROM orders WHERE user_id IS NULL")
    op.execute("UPDATE orders SET shipping_phone = '' WHERE shipping_phone IS NULL")
    op.drop_constraint("ck_orders_contact", "orders", type_="check")
    op.alter_column("orders", "shipping_phone", existing_type=sa.VARCHAR(length=50), nullable=False)
    op.alter_column("orders", "user_id", existing_type=sa.UUID(), nullable=False)
    op.drop_column("orders", "customer_email")
