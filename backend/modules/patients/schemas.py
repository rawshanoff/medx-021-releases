import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class PatientBase(BaseModel):
    full_name: str
    phone: str
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = "standard"


class PatientCreate(PatientBase):
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return _normalize_phone(v)


class PatientUpdate(PatientBase):
    full_name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_optional_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return _normalize_phone(v)


class PatientRead(PatientBase):
    id: int
    balance: int
    is_blacklisted: bool
    telegram_chat_id: Optional[int] = None
    telegram_username: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatientTransactionRead(BaseModel):
    id: int
    amount: int
    payment_method: str
    cash_amount: int = 0
    card_amount: int = 0
    transfer_amount: int = 0
    description: Optional[str] = None
    related_transaction_id: Optional[int] = None
    doctor_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatientQueueHistoryRead(BaseModel):
    id: int
    ticket_number: str
    doctor_id: Optional[int] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatientAppointmentHistoryRead(BaseModel):
    id: int
    doctor_id: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PatientHistoryRead(BaseModel):
    transactions: list[PatientTransactionRead] = []
    queue: list[PatientQueueHistoryRead] = []
    appointments: list[PatientAppointmentHistoryRead] = []


def _normalize_phone(raw: str) -> str:
    s = str(raw).strip()
    # remove common separators, keep digits
    digits = re.sub(r"\D+", "", s)
    if len(digits) < 7:
        raise ValueError("phone is too short")
    if len(digits) > 16:
        raise ValueError("phone is too long")

    # Preserve explicit "+" if provided.
    if s.startswith("+"):
        return "+" + digits

    # Uzbekistan defaults (avoid duplicates): 9-digit local numbers -> +998xxxxxxxxx
    # Also handle: 998xxxxxxxxx (12 digits) and 0xxxxxxxxx (10 digits).
    if digits.startswith("998") and len(digits) == 12:
        return "+" + digits
    if len(digits) == 10 and digits.startswith("0"):
        return "+998" + digits[1:]
    if len(digits) == 9:
        return "+998" + digits

    # Fallback: keep digits-only for other countries / legacy.
    return digits
