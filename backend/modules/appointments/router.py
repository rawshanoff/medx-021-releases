from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from datetime import datetime, timedelta

from backend.core.database import get_db
from backend.modules.auth import require_roles
from backend.modules.users.models import UserRole
from backend.modules.appointments.models import Appointment
from backend.modules.appointments.schemas import AppointmentCreate, AppointmentRead, AppointmentUpdate
from backend.modules.patients.models import Patient

router = APIRouter()

@router.post("/", response_model=AppointmentRead)
async def create_appointment(
    appt: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    _user = Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR))
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
            Appointment.status != "cancelled"
        )
    )
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="Time slot already booked for this doctor")

    new_appt = Appointment(**appt.model_dump())
    db.add(new_appt)
    await db.commit()
    await db.refresh(new_appt)
    
    # Manually enrich patient name for response (or use relationship lazy load explicitly)
    # For MVP response, schema expects patient_name optional.
    new_appt.patient_name = patient.full_name
    return new_appt

@router.get("/", response_model=List[AppointmentRead])
async def list_appointments(
    start: datetime, 
    end: datetime, 
    doctor_id: str = None, 
    db: AsyncSession = Depends(get_db),
    _user = Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR))
):
    query = select(Appointment).join(Appointment.patient).where(
        Appointment.start_time >= start,
        Appointment.start_time <= end
    )
    
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    
    query = query.order_by(Appointment.start_time)
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    # Fill names
    # Note: Because of async, accessing relationship 'appointment.patient' might need eager loading logic
    # But let's try assuming our schema handles it if we joined? 
    # Actually, default relationship loading in async needs 'selectinload' or manual fetch.
    # Let's fix query to eager load.
    
    return appointments

# FIX: We need eager loading for 'patient'
from sqlalchemy.orm import selectinload

@router.get("/v2", response_model=List[AppointmentRead])
async def list_appointments_v2(
    start: datetime, 
    end: datetime, 
    doctor_id: str = None, 
    db: AsyncSession = Depends(get_db),
    _user = Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR))
):
    query = select(Appointment).options(selectinload(Appointment.patient)).where(
        Appointment.start_time >= start,
        Appointment.start_time <= end
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

@router.delete("/{id}")
async def cancel_appointment(
    id: int,
    db: AsyncSession = Depends(get_db),
    _user = Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR))
):
    appt = await db.get(Appointment, id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    db.delete(appt) # Or set status='cancelled'
    await db.commit()
    return {"message": "Deleted"}
