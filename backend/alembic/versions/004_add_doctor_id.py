"""add_doctor_id_to_transactions

Revision ID: 004_add_doctor_id
Revises: 003_init_appointments
Create Date: 2026-01-31 16:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_add_doctor_id"
down_revision: Union[str, None] = "003_init_appointments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("doctor_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "doctor_id")
