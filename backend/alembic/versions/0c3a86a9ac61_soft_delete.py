"""soft delete

Revision ID: 0c3a86a9ac61
Revises: 27f967d47a96
Create Date: 2026-02-02 10:13:05.973177

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0c3a86a9ac61"
down_revision: Union[str, None] = "27f967d47a96"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    tables = ["patients", "doctors", "doctor_services", "users", "appointments"]

    for t in tables:
        if t not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(t)}
        if "deleted_at" not in cols:
            op.add_column(
                t, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
            )
        # Postgres-safe idempotent index creation
        op.execute(f"CREATE INDEX IF NOT EXISTS ix_{t}_deleted_at ON {t} (deleted_at)")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    tables = ["appointments", "users", "doctor_services", "doctors", "patients"]

    for t in tables:
        if t not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(t)}
        # Drop index if it exists (IF EXISTS avoids hard failure)
        op.execute(f"DROP INDEX IF EXISTS ix_{t}_deleted_at")
        if "deleted_at" in cols:
            op.drop_column(t, "deleted_at")
