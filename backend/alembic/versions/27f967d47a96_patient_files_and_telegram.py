"""patient files and telegram

Revision ID: 27f967d47a96
Revises: c57ce24ff60c
Create Date: 2026-02-01 03:33:54.720411

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "27f967d47a96"
down_revision: Union[str, None] = "c57ce24ff60c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # patients: telegram link fields
    op.add_column(
        "patients", sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True)
    )
    op.add_column(
        "patients", sa.Column("telegram_username", sa.String(), nullable=True)
    )

    # patient_files
    op.create_table(
        "patient_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("visit_id", sa.Integer(), nullable=True),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("stored_filename", sa.String(), nullable=False),
        sa.Column("mime", sa.String(), nullable=True),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stored_filename"),
    )
    op.create_index(op.f("ix_patient_files_id"), "patient_files", ["id"], unique=False)
    op.create_index(
        op.f("ix_patient_files_patient_id"),
        "patient_files",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_patient_files_visit_id"), "patient_files", ["visit_id"], unique=False
    )

    # file_delivery_log
    op.create_table(
        "file_delivery_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("sent_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("error", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["file_id"], ["patient_files.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.ForeignKeyConstraint(["sent_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_file_delivery_log_id"), "file_delivery_log", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_file_delivery_log_file_id"),
        "file_delivery_log",
        ["file_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_file_delivery_log_patient_id"),
        "file_delivery_log",
        ["patient_id"],
        unique=False,
    )

    # telegram link tokens
    op.create_table(
        "telegram_link_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_telegram_link_tokens_id"), "telegram_link_tokens", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_telegram_link_tokens_patient_id"),
        "telegram_link_tokens",
        ["patient_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_telegram_link_tokens_code"),
        "telegram_link_tokens",
        ["code"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_telegram_link_tokens_code"), table_name="telegram_link_tokens"
    )
    op.drop_index(
        op.f("ix_telegram_link_tokens_patient_id"), table_name="telegram_link_tokens"
    )
    op.drop_index(op.f("ix_telegram_link_tokens_id"), table_name="telegram_link_tokens")
    op.drop_table("telegram_link_tokens")

    op.drop_index(
        op.f("ix_file_delivery_log_patient_id"), table_name="file_delivery_log"
    )
    op.drop_index(op.f("ix_file_delivery_log_file_id"), table_name="file_delivery_log")
    op.drop_index(op.f("ix_file_delivery_log_id"), table_name="file_delivery_log")
    op.drop_table("file_delivery_log")

    op.drop_index(op.f("ix_patient_files_visit_id"), table_name="patient_files")
    op.drop_index(op.f("ix_patient_files_patient_id"), table_name="patient_files")
    op.drop_index(op.f("ix_patient_files_id"), table_name="patient_files")
    op.drop_table("patient_files")

    op.drop_column("patients", "telegram_username")
    op.drop_column("patients", "telegram_chat_id")
