"""users email lowercase

Revision ID: e236eb6c8b41
Revises: e99ebead88a5
Create Date: 2026-10-06 13:50:15.920499

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e236eb6c8b41'
down_revision: Union[str, Sequence[str], None] = 'e99ebead88a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Pasa los emails existentes a minúsculas y lo exige con un CHECK.

    Si dos cuentas solo difieren en mayúsculas (`Juan@x.com` y
    `juan@x.com`), la migración falla en vez de fusionarlas sola: hay que
    decidir a mano cuál queda (tienen contraseñas y pedidos distintos).
    """
    conn = op.get_bind()
    duplicates = conn.execute(
        sa.text(
            "SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1"
        )
    ).scalars().all()
    if duplicates:
        raise RuntimeError(
            "Hay cuentas que solo difieren en mayúsculas/minúsculas; resolverlas "
            f"a mano antes de migrar: {', '.join(duplicates)}"
        )

    op.execute("UPDATE users SET email = lower(email) WHERE email <> lower(email)")
    op.create_check_constraint('ck_users_email_lowercase', 'users', "email = lower(email)")


def downgrade() -> None:
    """Downgrade schema (los emails quedan en minúsculas)."""
    op.drop_constraint('ck_users_email_lowercase', 'users', type_='check')
