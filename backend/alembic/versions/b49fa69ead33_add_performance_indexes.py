"""add performance indexes

Revision ID: b49fa69ead33
Revises: 88859223fa53
Create Date: 2026-02-03 00:26:36.937621

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b49fa69ead33"
down_revision: Union[str, None] = "88859223fa53"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Appointments
    op.create_index(
        op.f("ix_appointments_patient_id"), "appointments", ["patient_id"], unique=False
    )
    op.create_index(
        op.f("ix_appointments_doctor_id"), "appointments", ["doctor_id"], unique=False
    )

    # Transactions
    op.create_index(
        op.f("ix_transactions_patient_id"), "transactions", ["patient_id"], unique=False
    )

    # Queue
    op.create_index(
        op.f("ix_queue_items_status"), "queue_items", ["status"], unique=False
    )
    op.create_index(
        op.f("ix_queue_items_queue_date"), "queue_items", ["queue_date"], unique=False
    )

    # Soft delete indexes (critical for performance)
    op.create_index(
        op.f("ix_patients_deleted_at"), "patients", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_doctors_deleted_at"), "doctors", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_users_deleted_at"), "users", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_appointments_deleted_at"), "appointments", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_transactions_deleted_at"), "transactions", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_shifts_deleted_at"), "shifts", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_queue_items_deleted_at"), "queue_items", ["deleted_at"], unique=False
    )

    # Patient search indexes
    op.create_index(
        op.f("ix_patients_phone"), "patients", ["phone"], unique=False
    )
    op.create_index(
        op.f("ix_patients_full_name"), "patients", ["full_name"], unique=False
    )
    op.create_index(
        op.f("ix_patients_birth_date"), "patients", ["birth_date"], unique=False
    )

    # Doctor search indexes
    op.create_index(
        op.f("ix_doctors_full_name"), "doctors", ["full_name"], unique=False
    )

    # User search indexes
    op.create_index(
        op.f("ix_users_username"), "users", ["username"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_doctors_full_name"), table_name="doctors")
    op.drop_index(op.f("ix_patients_birth_date"), table_name="patients")
    op.drop_index(op.f("ix_patients_full_name"), table_name="patients")
    op.drop_index(op.f("ix_patients_phone"), table_name="patients")
    op.drop_index(op.f("ix_queue_items_deleted_at"), table_name="queue_items")
    op.drop_index(op.f("ix_shifts_deleted_at"), table_name="shifts")
    op.drop_index(op.f("ix_transactions_deleted_at"), table_name="transactions")
    op.drop_index(op.f("ix_appointments_deleted_at"), table_name="appointments")
    op.drop_index(op.f("ix_users_deleted_at"), table_name="users")
    op.drop_index(op.f("ix_doctors_deleted_at"), table_name="doctors")
    op.drop_index(op.f("ix_patients_deleted_at"), table_name="patients")

    op.drop_index(op.f("ix_queue_items_queue_date"), table_name="queue_items")
    op.drop_index(op.f("ix_queue_items_status"), table_name="queue_items")

    op.drop_index(op.f("ix_transactions_patient_id"), table_name="transactions")

    op.drop_index(op.f("ix_appointments_doctor_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_patient_id"), table_name="appointments")
