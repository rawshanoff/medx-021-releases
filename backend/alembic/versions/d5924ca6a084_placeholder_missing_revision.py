"""placeholder missing revision

Revision ID: d5924ca6a084
Revises: 007_add_queue_prefix
Create Date: 2026-02-03

This revision existed in the database but was missing from the repository.
It is intentionally a no-op placeholder to restore a linear Alembic history.
"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "d5924ca6a084"
down_revision: Union[str, None] = "007_add_queue_prefix"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op: placeholder revision to match existing DB state.
    pass


def downgrade() -> None:
    # No-op
    pass
