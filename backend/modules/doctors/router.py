from typing import List

from backend.core.database import get_db
from backend.core.schemas import MessageResponse
from backend.modules.auth import require_roles
from backend.modules.doctors.models import AuditLog, Doctor, DoctorService
from backend.modules.doctors.schemas import (
    DoctorCreate,
    DoctorRead,
    DoctorServiceCreate,
    DoctorUpdate,
)
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter()


@router.get("/archived", response_model=List[DoctorRead])
@router.get("/archived/", response_model=List[DoctorRead])
async def list_archived_doctors(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.services))
        .where(Doctor.deleted_at.is_not(None))
        .order_by(Doctor.full_name)
        .limit(500)
    )
    return result.scalars().all()


@router.post("/{doctor_id}/restore", response_model=MessageResponse)
async def restore_doctor(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    doctor = await db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if doctor.deleted_at is None:
        return {"message": "Doctor is already active"}

    doctor.deleted_at = None
    doctor.is_active = True
    # Restore services too
    svc_res = await db.execute(
        select(DoctorService).where(DoctorService.doctor_id == doctor_id)
    )
    for svc in svc_res.scalars().all():
        svc.deleted_at = None
    await db.commit()
    return {"message": "Doctor restored successfully"}


@router.post("/", response_model=DoctorRead)
async def create_doctor(
    doctor: DoctorCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    # Create doctor
    new_doctor = Doctor(
        full_name=doctor.full_name,
        specialty=doctor.specialty,
        queue_prefix=doctor.queue_prefix,
        is_active=doctor.is_active,
    )
    db.add(new_doctor)
    await db.commit()
    await db.refresh(new_doctor)

    # Add services if any
    for svc in doctor.services:
        new_svc = DoctorService(
            doctor_id=new_doctor.id,
            name=svc.name,
            price=svc.price,
            priority=svc.priority,
        )
        db.add(new_svc)

    await db.commit()
    # Eager load relationships for response
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.services))
        .where(Doctor.id == new_doctor.id)
    )
    return result.scalars().first()


@router.get("/", response_model=List[DoctorRead])
async def list_doctors(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.services))
        .where(Doctor.deleted_at.is_(None))
        .order_by(Doctor.full_name)
    )
    return result.scalars().all()


@router.post("/{doctor_id}/services", response_model=MessageResponse)
async def add_service(
    doctor_id: int,
    service: DoctorServiceCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    doctor = await db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    new_svc = DoctorService(doctor_id=doctor_id, **service.model_dump())
    db.add(new_svc)
    await db.commit()
    return {"message": "Service added"}


@router.put("/{doctor_id}", response_model=DoctorRead)
async def update_doctor(
    doctor_id: int,
    doctor_update: DoctorUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    doctor = await db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if doctor_update.full_name is not None:
        doctor.full_name = doctor_update.full_name
    if doctor_update.specialty is not None:
        doctor.specialty = doctor_update.specialty
    if doctor_update.queue_prefix is not None:
        doctor.queue_prefix = doctor_update.queue_prefix
    if doctor_update.is_active is not None:
        doctor.is_active = doctor_update.is_active

    # Log logic
    log = AuditLog(action="Update Doctor", details=f"Updated doctor ID {doctor_id}")
    db.add(log)

    await db.commit()
    await db.refresh(doctor)
    # Re-fetch with services
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.services))
        .where(Doctor.id == doctor_id)
    )
    return result.scalars().first()


@router.delete("/{doctor_id}", response_model=MessageResponse)
async def delete_doctor(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    doctor = await db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    try:
        # Soft delete (supports Archive restore)
        doctor.soft_delete()
        doctor.is_active = False
        # Archive services too
        svc_res = await db.execute(
            select(DoctorService).where(DoctorService.doctor_id == doctor_id)
        )
        for svc in svc_res.scalars().all():
            svc.soft_delete()
        # Keep historical queue items (do not delete)

        log = AuditLog(action="Delete Doctor", details=f"Deleted doctor ID {doctor_id}")
        db.add(log)

        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete doctor: {e}"
        ) from e

    return {"message": "Archived"}


@router.delete("/services/{service_id}", response_model=MessageResponse)
async def delete_service(
    service_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    svc = await db.get(DoctorService, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    # Soft delete to preserve history / allow restore
    svc.soft_delete()

    log = AuditLog(action="Delete Service", details=f"Deleted service {svc.name}")
    db.add(log)

    await db.commit()
    return {"message": "Service deleted"}


@router.get("/history", response_model=List[dict])
async def get_history(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    result = await db.execute(
        select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(50)
    )
    logs = result.scalars().all()
    # Handle timezone awareness for isoformat if needed, but usually fine
    return [
        {
            "time": (
                log_entry.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                if log_entry.timestamp
                else ""
            ),
            "action": log_entry.action,
            "details": log_entry.details,
        }
        for log_entry in logs
    ]
