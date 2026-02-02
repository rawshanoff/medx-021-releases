from typing import List

from backend.core.database import get_db
from backend.core.schemas import MessageResponse
from backend.modules.auth import require_roles
from backend.modules.doctors.models import AuditLog, Doctor, DoctorService
from backend.modules.doctors.schemas import (
    DoctorCreate,
    DoctorRead,
    DoctorServiceCreate,
    DoctorServiceRead,
    DoctorUpdate,
)
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, with_loader_criteria

router = APIRouter()


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
        .options(
            selectinload(Doctor.services),
            with_loader_criteria(
                DoctorService, DoctorService.deleted_at.is_(None), include_aliases=True
            ),
        )
        .where(Doctor.deleted_at.is_(None))
        .where(Doctor.id == new_doctor.id)
    )
    return result.scalars().first()


@router.get("/", response_model=List[DoctorRead])
async def list_doctors(
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    stmt = (
        select(Doctor)
        .options(
            selectinload(Doctor.services),
            with_loader_criteria(
                DoctorService, DoctorService.deleted_at.is_(None), include_aliases=True
            ),
        )
        .order_by(Doctor.full_name)
    )
    if not include_deleted:
        stmt = stmt.where(Doctor.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{doctor_id}/services", response_model=MessageResponse)
async def add_service(
    doctor_id: int,
    service: DoctorServiceCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    doctor = await db.get(Doctor, doctor_id)
    if not doctor or doctor.deleted_at is not None:
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
    if not doctor or doctor.deleted_at is not None:
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
        .options(
            selectinload(Doctor.services),
            with_loader_criteria(
                DoctorService, DoctorService.deleted_at.is_(None), include_aliases=True
            ),
        )
        .where(Doctor.deleted_at.is_(None))
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
    if not doctor or doctor.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Doctor not found")

    try:
        doctor.soft_delete()
        doctor.is_active = False
        # Archive services too
        svc_res = await db.execute(
            select(DoctorService).where(DoctorService.doctor_id == doctor_id)
        )
        for svc in svc_res.scalars().all():
            svc.soft_delete()

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
    if not svc or svc.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Service not found")

    svc.soft_delete()

    log = AuditLog(action="Delete Service", details=f"Deleted service {svc.name}")
    db.add(log)

    await db.commit()
    return {"message": "Service archived"}


@router.get("/archived/", response_model=List[DoctorRead])
async def get_archived_doctors(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN)),
):
    """Get archived doctors. Admin only."""
    result = await db.execute(
        select(Doctor)
        .where(Doctor.deleted_at.is_not(None))
        .order_by(Doctor.deleted_at.desc())
    )
    doctors = result.scalars().all()

    # Add services data for each doctor
    for doc in doctors:
        svc_result = await db.execute(
            select(DoctorService).where(
                DoctorService.doctor_id == doc.id, DoctorService.deleted_at.is_(None)
            )
        )
        doc.services = svc_result.scalars().all()

    return doctors


@router.post("/{doctor_id}/restore", response_model=DoctorRead)
async def restore_doctor(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN)),
):
    """Restore archived doctor. Admin only."""
    doctor = await db.get(Doctor, doctor_id)
    if not doctor or doctor.deleted_at is None:
        raise HTTPException(status_code=404, detail="Archived doctor not found")

    doctor.restore()
    doctor.is_active = True

    # Restore services too
    svc_res = await db.execute(
        select(DoctorService).where(DoctorService.doctor_id == doctor_id)
    )
    for svc in svc_res.scalars().all():
        svc.restore()

    log = AuditLog(
        action="Restore Doctor", details=f"Restored doctor {doctor.full_name}"
    )
    db.add(log)

    await db.commit()
    await db.refresh(doctor)

    # Load services for response
    svc_result = await db.execute(
        select(DoctorService).where(
            DoctorService.doctor_id == doctor.id, DoctorService.deleted_at.is_(None)
        )
    )
    doctor.services = svc_result.scalars().all()

    return doctor


@router.get("/services/archived/", response_model=List[DoctorServiceRead])
async def get_archived_services(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN)),
):
    """Get archived services. Admin only."""
    result = await db.execute(
        select(DoctorService)
        .options(selectinload(DoctorService.doctor))
        .where(DoctorService.deleted_at.is_not(None))
        .order_by(DoctorService.deleted_at.desc())
    )
    return result.scalars().all()


@router.post("/services/{service_id}/restore", response_model=DoctorServiceRead)
async def restore_service(
    service_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN)),
):
    """Restore archived service. Admin only."""
    svc = await db.get(DoctorService, service_id)
    if not svc or svc.deleted_at is None:
        raise HTTPException(status_code=404, detail="Archived service not found")

    svc.restore()

    log = AuditLog(action="Restore Service", details=f"Restored service {svc.name}")
    db.add(log)

    await db.commit()
    await db.refresh(svc)
    return svc


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
