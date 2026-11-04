"""promotions coupons referrals

Módulo de promociones (modules/promotions): tablas `promotions` y `coupons`,
desglose de descuentos en `orders` y programa de referidos en `users`.

Revision ID: 8f9b565de785
Revises: b8b2a6dd42b8
Create Date: 2026-11-04 00:54:57.609124

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8f9b565de785"
down_revision: str | Sequence[str] | None = "b8b2a6dd42b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "coupons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("percent", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("min_amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("uses", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("origin", sa.String(length=20), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("origin IN ('admin', 'referral')", name="ck_coupons_origin"),
        sa.CheckConstraint("code = upper(code)", name="ck_coupons_code_upper"),
        sa.CheckConstraint("max_uses IS NULL OR uses <= max_uses", name="ck_coupons_max_uses"),
        sa.CheckConstraint("percent > 0 AND percent <= 100", name="ck_coupons_percent"),
        sa.CheckConstraint("uses >= 0", name="ck_coupons_uses"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_coupons_code"), "coupons", ["code"], unique=True)
    op.create_index(op.f("ix_coupons_owner_id"), "coupons", ["owner_id"], unique=False)

    op.create_table(
        "promotions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("percent", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("min_qty", sa.Integer(), nullable=False),
        sa.Column("min_amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(kind = 'order') = (min_amount IS NOT NULL)", name="ck_promotions_min_amount"
        ),
        sa.CheckConstraint("kind IN ('product', 'order')", name="ck_promotions_kind"),
        sa.CheckConstraint("min_qty >= 1", name="ck_promotions_min_qty"),
        sa.CheckConstraint("percent > 0 AND percent <= 100", name="ck_promotions_percent"),
        sa.CheckConstraint(
            "product_id IS NULL OR category IS NULL", name="ck_promotions_single_scope"
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Pedidos: los existentes no tuvieron descuentos, subtotal = total.
    op.add_column("orders", sa.Column("subtotal", sa.Numeric(precision=12, scale=2), nullable=True))
    op.execute("UPDATE orders SET subtotal = total")
    op.alter_column("orders", "subtotal", nullable=False)
    op.add_column(
        "orders",
        sa.Column(
            "discount_total",
            sa.Numeric(precision=12, scale=2),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "discounts",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column("orders", sa.Column("coupon_id", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("coupon_code", sa.String(length=40), nullable=True))
    op.create_index(op.f("ix_orders_coupon_id"), "orders", ["coupon_id"], unique=False)
    op.create_foreign_key(
        "fk_orders_coupon_id", "orders", "coupons", ["coupon_id"], ["id"], ondelete="SET NULL"
    )

    # Usuarios: un código de referido para cada uno de los existentes.
    op.add_column("users", sa.Column("referral_code", sa.String(length=16), nullable=True))
    op.execute(
        "UPDATE users SET referral_code = upper(substr(md5(random()::text || id::text), 1, 8))"
    )
    op.alter_column("users", "referral_code", nullable=False)
    op.create_unique_constraint("uq_users_referral_code", "users", ["referral_code"])
    op.add_column("users", sa.Column("referred_by_id", sa.UUID(), nullable=True))
    op.add_column(
        "users", sa.Column("referral_rewarded_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(op.f("ix_users_referred_by_id"), "users", ["referred_by_id"], unique=False)
    op.create_foreign_key(
        "fk_users_referred_by_id", "users", "users", ["referred_by_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_users_referred_by_id", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_referred_by_id"), table_name="users")
    op.drop_column("users", "referral_rewarded_at")
    op.drop_column("users", "referred_by_id")
    op.drop_constraint("uq_users_referral_code", "users", type_="unique")
    op.drop_column("users", "referral_code")

    op.drop_constraint("fk_orders_coupon_id", "orders", type_="foreignkey")
    op.drop_index(op.f("ix_orders_coupon_id"), table_name="orders")
    op.drop_column("orders", "coupon_code")
    op.drop_column("orders", "coupon_id")
    op.drop_column("orders", "discounts")
    op.drop_column("orders", "discount_total")
    op.drop_column("orders", "subtotal")

    op.drop_table("promotions")
    op.drop_index(op.f("ix_coupons_owner_id"), table_name="coupons")
    op.drop_index(op.f("ix_coupons_code"), table_name="coupons")
    op.drop_table("coupons")
