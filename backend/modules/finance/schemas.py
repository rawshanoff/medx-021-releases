from datetime import datetime
from typing import Optional

from backend.modules.finance.models import PaymentMethod
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    patient_id: Optional[int] = None
    amount: int
    doctor_id: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    cash_amount: int = 0
    card_amount: int = 0
    transfer_amount: int = 0
    description: Optional[str] = None


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
