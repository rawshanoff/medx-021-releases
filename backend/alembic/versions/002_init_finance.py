"""init_finance

Revision ID: 002_init_finance
Revises: 001_init_patients
Create Date: 2026-01-31 03:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_init_finance'
down_revision: Union[str, None] = '001_init_patients'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SHIFTS
    op.create_table('shifts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cashier_id', sa.String(), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_cash', sa.Integer(), nullable=True),
        sa.Column('total_card', sa.Integer(), nullable=True),
        sa.Column('total_transfer', sa.Integer(), nullable=True),
        sa.Column('is_closed', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shifts_id'), 'shifts', ['id'], unique=False)

    # TRANSACTIONS
    op.create_table('transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=True),
        sa.Column('patient_id', sa.Integer(), nullable=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('payment_method', sa.String(), nullable=True),
        sa.Column('cash_amount', sa.Integer(), nullable=True),
        sa.Column('card_amount', sa.Integer(), nullable=True),
        sa.Column('transfer_amount', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], )
    )
    op.create_index(op.f('ix_transactions_id'), 'transactions', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_transactions_id'), table_name='transactions')
    op.drop_table('transactions')
    op.drop_index(op.f('ix_shifts_id'), table_name='shifts')
    op.drop_table('shifts')
