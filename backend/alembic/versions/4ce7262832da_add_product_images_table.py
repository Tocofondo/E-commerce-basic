"""add product_images table

Revision ID: 4ce7262832da
Revises: e3de0262d10b
Create Date: 2026-09-21 02:24:27.196005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ce7262832da'
down_revision: Union[str, Sequence[str], None] = 'e3de0262d10b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'product_images',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_product_images_product_id'), 'product_images', ['product_id'], unique=False)
    op.drop_column('products', 'image')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'products',
        sa.Column('image', sa.String(length=1000), nullable=False, server_default=''),
    )
    op.alter_column('products', 'image', server_default=None)
    op.drop_index(op.f('ix_product_images_product_id'), table_name='product_images')
    op.drop_table('product_images')
