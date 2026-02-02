"""add owner role

Revision ID: 8f83edd6df48
Revises: 008_ticket_string
Create Date: 2026-02-01 03:24:10.823240

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8f83edd6df48"
down_revision: Union[str, None] = "008_ticket_string"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new enum value for roles (PostgreSQL)
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'OWNER'")


def downgrade() -> None:
    # Downgrade for enum value removal is intentionally omitted:
    # PostgreSQL does not support dropping enum values safely.
    # If you must rollback, recreate type and cast columns manually.
    return None
