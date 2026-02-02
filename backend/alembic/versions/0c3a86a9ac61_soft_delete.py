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
    tables = [
        "patients",
        "doctors",
        "doctor_services",
        "users",
        "appointments",
    ]

    for t in tables:
        op.add_column(
            t, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
        )
        op.create_index(op.f(f"ix_{t}_deleted_at"), t, ["deleted_at"], unique=False)


def downgrade() -> None:
    tables = [
        "appointments",
        "users",
        "doctor_services",
        "doctors",
        "patients",
    ]

    for t in tables:
        op.drop_index(op.f(f"ix_{t}_deleted_at"), table_name=t)
        op.drop_column(t, "deleted_at")
