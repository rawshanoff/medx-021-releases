from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class PatientBase(BaseModel):
    full_name: str
    phone: str
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = "standard"


class PatientCreate(PatientBase):
    pass


class PatientUpdate(PatientBase):
    full_name: Optional[str] = None
    phone: Optional[str] = None


class PatientRead(PatientBase):
    id: int
    balance: int
    is_blacklisted: bool
    telegram_chat_id: Optional[int] = None
    telegram_username: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PatientTransactionRead(BaseModel):
    id: int
    amount: int
    payment_method: str
    cash_amount: int = 0
    card_amount: int = 0
    transfer_amount: int = 0
    description: Optional[str] = None
    doctor_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PatientQueueHistoryRead(BaseModel):
    id: int
    ticket_number: str
    doctor_id: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PatientAppointmentHistoryRead(BaseModel):
    id: int
    doctor_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PatientHistoryRead(BaseModel):
    transactions: list[PatientTransactionRead] = []
    queue: list[PatientQueueHistoryRead] = []
    appointments: list[PatientAppointmentHistoryRead] = []
