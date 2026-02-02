"""soft_delete_more_tables

Revision ID: 88859223fa53
Revises: 0c3a86a9ac61
Create Date: 2026-02-02 11:39:42.872770

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "88859223fa53"
down_revision: Union[str, None] = "0c3a86a9ac61"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        "shifts",
        "transactions",
        "finance_audit_log",
        "queue_items",
        "patient_files",
        "file_delivery_log",
        "telegram_link_tokens",
    ]

    for t in tables:
        op.add_column(
            t, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
        )
        op.create_index(op.f(f"ix_{t}_deleted_at"), t, ["deleted_at"], unique=False)


def downgrade() -> None:
    tables = [
        "telegram_link_tokens",
        "file_delivery_log",
        "patient_files",
        "queue_items",
        "finance_audit_log",
        "transactions",
        "shifts",
    ]

    for t in tables:
        op.drop_index(op.f(f"ix_{t}_deleted_at"), table_name=t)
        op.drop_column(t, "deleted_at")
