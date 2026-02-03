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
    # Appointments - create only if they don't exist
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_appointments_patient_id ON appointments (patient_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_appointments_doctor_id ON appointments (doctor_id)"
    )

    # Transactions - create only if they don't exist
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_transactions_patient_id ON transactions (patient_id)"
    )

    # Queue - create only if they don't exist
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_queue_items_status ON queue_items (status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_queue_items_queue_date ON queue_items (queue_date)"
    )

    # Soft delete indexes (critical for performance) - create only if they don't exist
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patients_deleted_at ON patients (deleted_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_doctors_deleted_at ON doctors (deleted_at)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_deleted_at ON users (deleted_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_appointments_deleted_at ON appointments (deleted_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_transactions_deleted_at ON transactions (deleted_at)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_shifts_deleted_at ON shifts (deleted_at)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_queue_items_deleted_at ON queue_items (deleted_at)"
    )

    # Patient search indexes - create only if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_patients_phone ON patients (phone)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patients_full_name ON patients (full_name)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_patients_birth_date ON patients (birth_date)"
    )

    # Doctor search indexes - create only if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_doctors_full_name ON doctors (full_name)")

    # User search indexes - create only if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_username ON users (username)")


def downgrade() -> None:
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_doctors_full_name"), table_name="doctors")
    op.drop_index(op.f("ix_patients_birth_date"), table_name="patients")
    op.drop_index(op.f("ix_patients_full_name"), table_name="patients")
    op.drop_index(op.f("ix_patients_phone"), table_name="patients")

    # Drop soft delete indexes only if they exist
    op.execute("DROP INDEX IF EXISTS ix_queue_items_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_shifts_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_transactions_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_appointments_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_users_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_doctors_deleted_at")
    op.execute("DROP INDEX IF EXISTS ix_patients_deleted_at")

    op.drop_index(op.f("ix_queue_items_queue_date"), table_name="queue_items")
    op.drop_index(op.f("ix_queue_items_status"), table_name="queue_items")

    op.drop_index(op.f("ix_transactions_patient_id"), table_name="transactions")

    op.drop_index(op.f("ix_appointments_doctor_id"), table_name="appointments")
    op.drop_index(op.f("ix_appointments_patient_id"), table_name="appointments")
