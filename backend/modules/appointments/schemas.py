from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: Optional[str] = "Dr. Default"
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    status: Optional[str] = "scheduled"

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    doctor_id: Optional[str] = None

class AppointmentRead(AppointmentBase):
    id: int
    created_at: datetime
    patient_name: Optional[str] = None # Enriched field

    class Config:
        from_attributes = True
