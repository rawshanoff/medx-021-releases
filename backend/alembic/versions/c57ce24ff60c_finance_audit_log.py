"""finance audit log

Revision ID: c57ce24ff60c
Revises: 9ecb6229cdbf
Create Date: 2026-02-01 03:25:29.206382

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c57ce24ff60c'
down_revision: Union[str, None] = '9ecb6229cdbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'finance_audit_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('details', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_finance_audit_log_id'), 'finance_audit_log', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_finance_audit_log_id'), table_name='finance_audit_log')
    op.drop_table('finance_audit_log')
