from typing import List, Optional

from pydantic import BaseModel, field_validator


# Service Schemas
class DoctorServiceBase(BaseModel):
    name: str
    price: int
    priority: int = 0

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        s = str(v or "").strip()
        if not s:
            raise ValueError("service name is required")
        return s

    @field_validator("price")
    @classmethod
    def _validate_price(cls, v: int) -> int:
        if int(v) < 0:
            raise ValueError("price must be >= 0")
        return int(v)

    @field_validator("priority")
    @classmethod
    def _validate_priority(cls, v: int) -> int:
        if int(v) < 0:
            raise ValueError("priority must be >= 0")
        return int(v)


class DoctorServiceCreate(DoctorServiceBase):
    pass


class DoctorServiceRead(DoctorServiceBase):
    id: int
    doctor_id: int

    class Config:
        from_attributes = True


# Doctor Schemas
class DoctorBase(BaseModel):
    full_name: str
    specialty: Optional[str] = None
    room_number: Optional[str] = None
    queue_prefix: Optional[str] = "A"
    is_active: bool = True

    @field_validator("queue_prefix")
    @classmethod
    def _normalize_queue_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        s = str(v).strip().upper()
        if not s:
            raise ValueError("queue_prefix must be 1 letter")
        # keep only one character (DB column is String(1))
        return s[0]


class DoctorCreate(DoctorBase):
    services: List[DoctorServiceCreate] = []


class DoctorUpdate(BaseModel):
    full_name: Optional[str] = None
    specialty: Optional[str] = None
    room_number: Optional[str] = None
    queue_prefix: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("queue_prefix")
    @classmethod
    def _normalize_queue_prefix(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        s = str(v).strip().upper()
        if not s:
            raise ValueError("queue_prefix must be 1 letter")
        return s[0]


class DoctorRead(DoctorBase):
    id: int
    services: List[DoctorServiceRead] = []

    class Config:
        from_attributes = True
