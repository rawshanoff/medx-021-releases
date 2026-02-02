from typing import List, Optional

from pydantic import BaseModel


# Service Schemas
class DoctorServiceBase(BaseModel):
    name: str
    price: int
    priority: int = 0


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
    queue_prefix: Optional[str] = "A"
    is_active: bool = True


class DoctorCreate(DoctorBase):
    services: List[DoctorServiceCreate] = []


class DoctorUpdate(BaseModel):
    full_name: Optional[str] = None
    specialty: Optional[str] = None
    is_active: Optional[bool] = None


class DoctorRead(DoctorBase):
    id: int
    services: List[DoctorServiceRead] = []

    class Config:
        from_attributes = True
