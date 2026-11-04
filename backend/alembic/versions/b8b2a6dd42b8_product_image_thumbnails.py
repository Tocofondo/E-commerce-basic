"""product image thumbnails

Las imágenes nuevas se guardan como WEBP + miniatura (products/images.py).
Las existentes quedan con estas columnas en NULL hasta reprocesarlas con
`python -m app.modules.products.reprocess_images`.

Revision ID: b8b2a6dd42b8
Revises: 3dee6727f197
Create Date: 2026-11-04 04:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8b2a6dd42b8"
down_revision: str | Sequence[str] | None = "3dee6727f197"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "product_images", sa.Column("thumb_filename", sa.String(length=255), nullable=True)
    )
    op.add_column("product_images", sa.Column("width", sa.Integer(), nullable=True))
    op.add_column("product_images", sa.Column("height", sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("product_images", "height")
    op.drop_column("product_images", "width")
    op.drop_column("product_images", "thumb_filename")
