"""add_queue_prefix_to_doctors

Revision ID: 007_add_queue_prefix
Revises: 006_add_users
Create Date: 2026-01-31 20:12:00

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "007_add_queue_prefix"
down_revision = "006_add_users"
branch_labels = None
depends_on = None


def upgrade():
    # Add queue_prefix column to doctors table
    op.add_column(
        "doctors",
        sa.Column("queue_prefix", sa.String(1), server_default="A", nullable=False),
    )

    # Update existing doctors with different prefixes (A, B, C, etc.)
    op.execute("""
        WITH numbered_doctors AS (
            SELECT id, CHR(65 + ((ROW_NUMBER() OVER (ORDER BY id) - 1) % 26)::integer) as new_prefix
            FROM doctors
        )
        UPDATE doctors
        SET queue_prefix = numbered_doctors.new_prefix
        FROM numbered_doctors
        WHERE doctors.id = numbered_doctors.id
    """)


def downgrade():
    op.drop_column("doctors", "queue_prefix")
