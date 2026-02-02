from datetime import datetime
from typing import Optional

from backend.modules.finance.models import PaymentMethod
from pydantic import BaseModel, Field, field_validator, model_validator


class TransactionCreate(BaseModel):
    patient_id: Optional[int] = None
    # Allow negative amounts for expenses/refunds, but never allow 0.
    amount: int = Field(ge=-10_000_000, le=10_000_000)
    doctor_id: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    cash_amount: int = Field(default=0, ge=0, le=10_000_000)
    card_amount: int = Field(default=0, ge=0, le=10_000_000)
    transfer_amount: int = Field(default=0, ge=0, le=10_000_000)
    description: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def validate_amount_not_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("amount must not be 0")
        return v

    @field_validator("transfer_amount", "card_amount", "cash_amount")
    @classmethod
    def validate_split_non_negative(cls, v: int) -> int:
        # keep explicit error message for API clients
        if v < 0:
            raise ValueError("split amounts must be >= 0")
        return v

    @model_validator(mode="after")
    def validate_mixed_payment(self):
        if self.payment_method != PaymentMethod.MIXED:
            return self

        if self.amount <= 0:
            raise ValueError("mixed payment amount must be > 0")

        total = (
            int(self.cash_amount) + int(self.card_amount) + int(self.transfer_amount)
        )
        if total != int(self.amount):
            raise ValueError("mixed split must equal amount")
        return self


class TransactionRead(TransactionCreate):
    id: int
    shift_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ShiftCreate(BaseModel):
    cashier_id: str


class ShiftRead(ShiftCreate):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    is_closed: bool
    total_cash: int
    total_card: int
    total_transfer: int

    class Config:
        from_attributes = True


class ReportXRead(BaseModel):
    type: str
    shift_id: int
    cashier: int | None
    total_cash: int
    total_card: int
    total_transfer: int
    generated_at: datetime


class ReportZRead(BaseModel):
    type: str
    shift_id: int
    total_cash: int
    total_card: int
    total_transfer: int
    total_income: int
    closed_at: datetime | None


class RefundCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)
