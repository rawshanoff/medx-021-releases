"""add_related_tx_id

Revision ID: g234567890cd
Revises: f123456789ab
Create Date: 2026-02-03 12:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g234567890cd"
down_revision: Union[str, None] = "f123456789ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "transactions" in set(inspector.get_table_names()):
        cols = {c["name"] for c in inspector.get_columns("transactions")}
        if "related_transaction_id" in cols:
            return

    op.add_column(
        "transactions", sa.Column("related_transaction_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_transactions_related_transaction_id",
        "transactions",
        "transactions",
        ["related_transaction_id"],
        ["id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "transactions" not in set(inspector.get_table_names()):
        return
    cols = {c["name"] for c in inspector.get_columns("transactions")}
    if "related_transaction_id" not in cols:
        return

    op.drop_constraint(
        "fk_transactions_related_transaction_id", "transactions", type_="foreignkey"
    )
    op.drop_column("transactions", "related_transaction_id")
