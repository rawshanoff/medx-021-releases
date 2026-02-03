"""doctor room number

Revision ID: d7c1a2b3c4d5
Revises: b49fa69ead33
Create Date: 2026-02-03 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7c1a2b3c4d5"
down_revision: Union[str, None] = "b49fa69ead33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "doctors" in set(inspector.get_table_names()):
        cols = {c["name"] for c in inspector.get_columns("doctors")}
        if "room_number" not in cols:
            op.add_column(
                "doctors", sa.Column("room_number", sa.String(length=32), nullable=True)
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "doctors" in set(inspector.get_table_names()):
        cols = {c["name"] for c in inspector.get_columns("doctors")}
        if "room_number" in cols:
            op.drop_column("doctors", "room_number")
