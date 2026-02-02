"""add_users_table

Revision ID: 006_add_users
Revises: 005_init_doctors
Create Date: 2026-01-31 20:10:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006_add_users'
down_revision = '005_init_doctors'
branch_labels = None
depends_on = None

def upgrade():
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(100), nullable=True),
        sa.Column('role', sa.Enum('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'CASHIER', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    
    # Create default admin user
    # Password: admin123
    # Hash generated with bcrypt
    op.execute("""
        INSERT INTO users (username, password_hash, full_name, role, is_active)
        VALUES ('admin', '$2b$12$nr4PvI2HcWYkT0uR6cXMv.rUZH0s6rKK3lyOoR01XpCNj17ZH.tNC', 'Administrator', 'ADMIN', true)
    """)

def downgrade():
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')
    op.execute('DROP TYPE userrole')
