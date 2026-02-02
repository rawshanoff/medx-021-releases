"""change_ticket_number_to_string

Revision ID: 008_ticket_string
Revises: 5e5c06f3bd64
Create Date: 2026-01-31 21:05:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008_ticket_string'
down_revision = '5e5c06f3bd64'
branch_labels = None
depends_on = None

def upgrade():
    # Change ticket_number from Integer to String
    op.alter_column('queue_items', 'ticket_number',
                    existing_type=sa.Integer(),
                    type_=sa.String(10),
                    existing_nullable=False)

def downgrade():
    # Revert back to Integer
    op.alter_column('queue_items', 'ticket_number',
                    existing_type=sa.String(10),
                    type_=sa.Integer(),
                    existing_nullable=False)
