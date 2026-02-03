"""add_idempotency_key

Revision ID: f123456789ab
Revises: ed29b7bff4b1
Create Date: 2026-02-03 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f123456789ab"
down_revision: Union[str, None] = "ed29b7bff4b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "transactions" in set(inspector.get_table_names()):
        cols = {c["name"] for c in inspector.get_columns("transactions")}
        if "idempotency_key" not in cols:
            op.add_column(
                "transactions", sa.Column("idempotency_key", sa.String(), nullable=True)
            )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_transactions_idempotency_key ON transactions (idempotency_key)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "transactions" in set(inspector.get_table_names()):
        cols = {c["name"] for c in inspector.get_columns("transactions")}
        op.execute("DROP INDEX IF EXISTS ix_transactions_idempotency_key")
        if "idempotency_key" in cols:
            op.drop_column("transactions", "idempotency_key")
