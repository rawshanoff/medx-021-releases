"""finance_constraints_and_shift_version

Revision ID: h345678901ef
Revises: g234567890cd
Create Date: 2026-02-05 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "h345678901ef"
down_revision: Union[str, None] = "g234567890cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_sqlite() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "sqlite"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "shifts" in tables:
        cols = {c["name"] for c in inspector.get_columns("shifts")}
        if "version" not in cols:
            op.add_column(
                "shifts",
                sa.Column(
                    "version", sa.Integer(), server_default=sa.text("1"), nullable=False
                ),
            )

        if not _is_sqlite():
            op.create_check_constraint(
                "ck_shifts_total_cash_nonnegative",
                "shifts",
                "total_cash >= 0",
            )
            op.create_check_constraint(
                "ck_shifts_total_card_nonnegative",
                "shifts",
                "total_card >= 0",
            )
            op.create_check_constraint(
                "ck_shifts_total_transfer_nonnegative",
                "shifts",
                "total_transfer >= 0",
            )

    if "transactions" in tables:
        if not _is_sqlite():
            op.create_check_constraint(
                "ck_transactions_amount_nonzero",
                "transactions",
                "amount <> 0",
            )
        op.execute("DROP INDEX IF EXISTS ix_transactions_idempotency_key")
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_shift_idempotency "
            "ON transactions (shift_id, idempotency_key)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "transactions" in tables:
        op.execute("DROP INDEX IF EXISTS uq_transactions_shift_idempotency")
        if not _is_sqlite():
            op.drop_constraint(
                "ck_transactions_amount_nonzero", "transactions", type_="check"
            )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_transactions_idempotency_key "
            "ON transactions (idempotency_key)"
        )

    if "shifts" in tables:
        if not _is_sqlite():
            op.drop_constraint(
                "ck_shifts_total_transfer_nonnegative", "shifts", type_="check"
            )
            op.drop_constraint(
                "ck_shifts_total_card_nonnegative", "shifts", type_="check"
            )
            op.drop_constraint(
                "ck_shifts_total_cash_nonnegative", "shifts", type_="check"
            )
        cols = {c["name"] for c in inspector.get_columns("shifts")}
        if "version" in cols:
            op.drop_column("shifts", "version")
