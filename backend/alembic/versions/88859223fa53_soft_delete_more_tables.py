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
    # Add deleted_at column to tables that inherit SoftDeleteMixin but don't have it yet
    tables_to_add = [
        "shifts",
        "transactions",
        "finance_audit_log",
        "queue_items",
    ]

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table in tables_to_add:
        if table not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}
        if "deleted_at" not in cols:
            op.add_column(
                table,
                sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            )
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{table}_deleted_at ON {table} (deleted_at)"
        )


def downgrade() -> None:
    # Remove deleted_at column from tables
    tables_to_remove = [
        "queue_items",
        "finance_audit_log",
        "transactions",
        "shifts",
    ]

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table in tables_to_remove:
        if table not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}
        op.execute(f"DROP INDEX IF EXISTS ix_{table}_deleted_at")
        if "deleted_at" in cols:
            op.drop_column(table, "deleted_at")
