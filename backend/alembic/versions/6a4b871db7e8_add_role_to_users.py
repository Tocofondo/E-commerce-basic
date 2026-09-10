"""add role to users

Revision ID: 6a4b871db7e8
Revises: e25d042f7876
Create Date: 2026-09-10 03:57:22.119813

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a4b871db7e8'
down_revision: Union[str, Sequence[str], None] = 'e25d042f7876'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default para que filas existentes queden en 'customer'; se puede
    # sacar el default de la columna después si se quiere forzarlo explícito.
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=20), nullable=False, server_default='customer'),
    )
    op.create_check_constraint('ck_users_role', 'users', "role IN ('customer', 'admin')")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_users_role', 'users', type_='check')
    op.drop_column('users', 'role')
