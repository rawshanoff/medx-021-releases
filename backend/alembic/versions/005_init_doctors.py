"""init_doctors

Revision ID: 005_init_doctors
Revises: 004_add_doctor_id
Create Date: 2026-01-31 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_init_doctors'
down_revision: Union[str, None] = '004_add_doctor_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Doctors table
    op.create_table('doctors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('specialty', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_doctors_full_name'), 'doctors', ['full_name'], unique=False)
    op.create_index(op.f('ix_doctors_id'), 'doctors', ['id'], unique=False)

    # Doctor Services table
    op.create_table('doctor_services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('doctor_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('price', sa.Integer(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_doctor_services_id'), 'doctor_services', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_doctor_services_id'), table_name='doctor_services')
    op.drop_table('doctor_services')
    op.drop_index(op.f('ix_doctors_id'), table_name='doctors')
    op.drop_index(op.f('ix_doctors_full_name'), table_name='doctors')
    op.drop_table('doctors')
