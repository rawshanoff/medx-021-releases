"""queue sequence unique

Revision ID: 9ecb6229cdbf
Revises: 8f83edd6df48
Create Date: 2026-02-01 03:24:58.915827

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9ecb6229cdbf"
down_revision: Union[str, None] = "8f83edd6df48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "queue_items",
        sa.Column(
            "queue_date",
            sa.Date(),
            server_default=sa.text("CURRENT_DATE"),
            nullable=False,
        ),
    )
    op.add_column(
        "queue_items",
        sa.Column("sequence", sa.Integer(), server_default="1", nullable=False),
    )

    # Backfill existing rows with stable unique sequences per (doctor_id, day)
    # We use row_number ordering by created_at/id to avoid collisions.
    op.execute("""
        WITH ranked AS (
            SELECT
                id,
                doctor_id,
                created_at::date AS qd,
                ROW_NUMBER() OVER (PARTITION BY doctor_id, created_at::date ORDER BY created_at, id) AS rn
            FROM queue_items
            WHERE doctor_id IS NOT NULL
        )
        UPDATE queue_items q
        SET
            queue_date = r.qd,
            sequence = r.rn
        FROM ranked r
        WHERE q.id = r.id
    """)
    op.execute(
        "UPDATE queue_items SET queue_date = created_at::date WHERE queue_date IS NULL"
    )

    op.create_unique_constraint(
        "uq_queue_doctor_date_seq",
        "queue_items",
        ["doctor_id", "queue_date", "sequence"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_queue_doctor_date_seq", "queue_items", type_="unique")
    op.drop_column("queue_items", "sequence")
    op.drop_column("queue_items", "queue_date")
