from datetime import date

from backend.core.database import get_db
from backend.modules.auth import require_roles
from backend.modules.doctors.models import Doctor
from backend.modules.reception.models import QueueItem
from backend.modules.reception.schemas import (
    QueueItemCreate,
    QueueItemRead,
    QueueItemUpdate,
)
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter()


@router.post("/queue", response_model=QueueItemRead, status_code=201)
async def add_to_queue(
    item: QueueItemCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    """Add patient to queue with doctor-specific prefix (A-001, B-001, etc.)"""
    today = date.today()

    # Get doctor to fetch queue_prefix (must be active and not deleted)
    doctor_result = await db.execute(
        select(Doctor).where(
            Doctor.id == item.doctor_id,
            Doctor.deleted_at.is_(None),
            Doctor.is_active == True,
        )
    )
    doctor = doctor_result.scalar_one_or_none()

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found or inactive")

    # Generate sequential number atomically with retry on unique constraint.
    # This prevents collisions when two patients are registered at the same time.
    for _attempt in range(10):
        # Next seq for this doctor & date
        res = await db.execute(
            select(func.coalesce(func.max(QueueItem.sequence), 0) + 1).where(
                QueueItem.doctor_id == item.doctor_id, QueueItem.queue_date == today
            )
        )
        next_seq = int(res.scalar_one())

        ticket_number = f"{doctor.queue_prefix}-{next_seq:03d}"
        new_item = QueueItem(
            **item.model_dump(),
            ticket_number=ticket_number,
            queue_date=today,
            sequence=next_seq,
        )

        db.add(new_item)
        try:
            await db.commit()
            await db.refresh(new_item)
            return new_item
        except IntegrityError:
            await db.rollback()
            continue

    raise HTTPException(
        status_code=409, detail="Failed to allocate queue ticket (try again)"
    )


@router.get("/queue", response_model=list[QueueItemRead])
async def get_queue(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    # Return today's queue items (not cancelled) ordered by creation time (FIFO)
    today = date.today()
    result = await db.execute(
        select(QueueItem)
        .options(selectinload(QueueItem.doctor))
        .where(
            QueueItem.queue_date == today,
            QueueItem.status != "CANCELLED",
        )
        .order_by(QueueItem.created_at.asc())
    )
    items = result.scalars().all()

    # Enrichment
    response = []
    for i in items:
        # Convert to Pydantic and add doc name manually if needed or rely on relationship
        # Pydantic model has doctor_name, we can map it
        doc_name = i.doctor.full_name if i.doctor else "Unknown"
        # We need to create Read object
        resp_item = QueueItemRead.model_validate(i)
        resp_item.doctor_name = doc_name
        response.append(resp_item)

    return response


@router.patch("/queue/{item_id}", response_model=QueueItemRead)
async def update_queue_status(
    item_id: int,
    update: QueueItemUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST)),
):
    item = await db.get(QueueItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    item.status = update.status
    await db.commit()
    await db.refresh(item)
    return item
