import enum

from backend.core.database import Base, SoftDeleteMixin
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"
    MIXED = "MIXED"


class Shift(SoftDeleteMixin, Base):
    __tablename__ = "shifts"
    __table_args__ = (
        CheckConstraint("total_cash >= 0", name="ck_shifts_total_cash_nonnegative"),
        CheckConstraint("total_card >= 0", name="ck_shifts_total_card_nonnegative"),
        CheckConstraint(
            "total_transfer >= 0", name="ck_shifts_total_transfer_nonnegative"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    cashier_id = Column(String, nullable=False)  # In MVP just a string name or ID
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)

    total_cash = Column(Integer, default=0)
    total_card = Column(Integer, default=0)
    total_transfer = Column(Integer, default=0)

    is_closed = Column(Boolean, default=False)
    version = Column(Integer, default=1, nullable=False)

    transactions = relationship("Transaction", back_populates="shift")


class Transaction(SoftDeleteMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint(
            "shift_id", "idempotency_key", name="uq_shift_idempotency_key"
        ),
        CheckConstraint("amount <> 0", name="ck_transactions_amount_nonzero"),
    )

    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    patient_id = Column(Integer, ForeignKey("patients.id"))

    amount = Column(Integer, nullable=False)  # Total amount
    doctor_id = Column(String, nullable=True)  # For commission/tracking
    payment_method = Column(String, default=PaymentMethod.CASH)

    cash_amount = Column(Integer, default=0)  # If mixed
    card_amount = Column(Integer, default=0)
    transfer_amount = Column(Integer, default=0)

    description = Column(String, nullable=True)  # e.g. "Consultation"
    idempotency_key = Column(String, index=True, nullable=True)
    related_transaction_id = Column(
        Integer, ForeignKey("transactions.id"), nullable=True
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    shift = relationship("Shift", back_populates="transactions")
    patient = relationship("Patient")
    related_transaction = relationship("Transaction", remote_side=[id])

    @property
    def patient_name(self) -> str | None:
        try:
            return self.patient.full_name if self.patient else None
        except Exception:
            return None


class FinanceAuditLog(SoftDeleteMixin, Base):
    __tablename__ = "finance_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
