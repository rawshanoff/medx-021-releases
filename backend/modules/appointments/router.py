from datetime import datetime
from typing import List

from backend.core.database import get_db
from backend.core.schemas import MessageResponse
from backend.modules.appointments.models import Appointment
from backend.modules.appointments.schemas import AppointmentCreate, AppointmentRead
from backend.modules.auth import require_roles
from backend.modules.patients.models import Patient
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter()


@router.post("/", response_model=AppointmentRead)
async def create_appointment(
    appt: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
    ),
):
    # Check if patient exists
    patient = await db.get(Patient, appt.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Basic Overlap Check (MVP: exact overlaps only for same doctor)
    # logic: (StartA <= EndB) and (EndA >= StartB)
    stmt = select(Appointment).where(
        and_(
            Appointment.doctor_id == appt.doctor_id,
            Appointment.start_time < appt.end_time,
            Appointment.end_time > appt.start_time,
            Appointment.status != "cancelled",
            Appointment.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=409, detail="Time slot already booked for this doctor"
        )

    new_appt = Appointment(**appt.model_dump())
    db.add(new_appt)
    await db.commit()
    await db.refresh(new_appt, ["patient"])

    # Enrich with patient name
    new_appt.patient_name = patient.full_name
    return new_appt


@router.get("/", response_model=List[AppointmentRead])
async def list_appointments(
    start: datetime,
    end: datetime,
    doctor_id: str = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
    ),
):
    """List appointments with eager loading to prevent N+1 queries."""
    query = (
        select(Appointment)
        .options(selectinload(Appointment.patient))
        .where(
            Appointment.start_time >= start,
            Appointment.start_time <= end,
            Appointment.deleted_at.is_(None),
        )
    )

    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)

    query = query.order_by(Appointment.start_time)

    result = await db.execute(query)
    appointments = result.scalars().all()

    # Enrich with patient name
    for a in appointments:
        a.patient_name = a.patient.full_name if a.patient else "Unknown"

    return appointments


@router.get("/v2", response_model=List[AppointmentRead])
async def list_appointments_v2(
    start: datetime,
    end: datetime,
    doctor_id: str = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
    ),
):
    query = (
        select(Appointment)
        .options(selectinload(Appointment.patient))
        .where(
            Appointment.start_time >= start,
            Appointment.start_time <= end,
            Appointment.deleted_at.is_(None),
        )
    )
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)

    result = await db.execute(query)
    appts = result.scalars().all()

    # Map to schema
    res_list = []
    for a in appts:
        # Schema 'patient_name' is optional, we fill it manually or rely on relationship
        a.patient_name = a.patient.full_name if a.patient else "Unknown"
        res_list.append(a)
    return res_list


@router.delete("/{id}", response_model=MessageResponse)
async def cancel_appointment(
    id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
    ),
):
    appt = await db.get(Appointment, id)
    if not appt or appt.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.status = "cancelled"
    appt.soft_delete()
    await db.commit()
    return {"message": "Cancelled"}
