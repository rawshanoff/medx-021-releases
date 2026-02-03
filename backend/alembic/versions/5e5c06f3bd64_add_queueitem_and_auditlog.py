"""Add QueueItem and AuditLog

Revision ID: 5e5c06f3bd64
Revises: d5924ca6a084
Create Date: 2026-01-31 18:19:10.010520

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5e5c06f3bd64"
down_revision: Union[str, None] = "d5924ca6a084"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Be defensive: some dev databases may already contain these tables.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    # Some environments may miss legacy MVP tables even if Alembic was stamped.
    if "appointments" not in existing:
        op.create_table(
            "appointments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("patient_id", sa.Integer(), nullable=True),
            sa.Column("doctor_id", sa.String(), nullable=True),
            sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
            sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        )
        op.execute("CREATE INDEX IF NOT EXISTS ix_appointments_id ON appointments (id)")

    if "audit_logs" not in existing:
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(), nullable=False),
            sa.Column("details", sa.String(), nullable=True),
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)

    if "queue_items" not in existing:
        op.create_table(
            "queue_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("ticket_number", sa.Integer(), nullable=False),
            sa.Column("patient_name", sa.String(), nullable=False),
            sa.Column("patient_id", sa.Integer(), nullable=True),
            sa.Column("doctor_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.ForeignKeyConstraint(
                ["doctor_id"],
                ["doctors.id"],
            ),
            sa.ForeignKeyConstraint(
                ["patient_id"],
                ["patients.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_queue_items_id"), "queue_items", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    # appointments table might have been created as a compatibility fix
    if "appointments" in existing:
        op.execute("DROP INDEX IF EXISTS ix_appointments_id")
        op.drop_table("appointments")

    if "queue_items" in existing:
        op.drop_index(op.f("ix_queue_items_id"), table_name="queue_items")
        op.drop_table("queue_items")
    if "audit_logs" in existing:
        op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
        op.drop_table("audit_logs")
