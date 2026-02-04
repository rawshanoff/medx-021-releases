from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class AppointmentStatus(str, Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no-show"


class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: str
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    status: AppointmentStatus = AppointmentStatus.scheduled

    @field_validator("doctor_id")
    @classmethod
    def _normalize_doctor_id(cls, v: str) -> str:
        s = str(v or "").strip()
        if not s:
            raise ValueError("doctor_id must not be empty")
        return s


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None
    doctor_id: Optional[str] = None

    @field_validator("doctor_id")
    @classmethod
    def _normalize_optional_doctor_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = str(v or "").strip()
        if not s:
            raise ValueError("doctor_id must not be empty")
        return s


class AppointmentRead(AppointmentBase):
    id: int
    created_at: datetime
    patient_name: Optional[str] = None  # Enriched field

    model_config = ConfigDict(from_attributes=True)
