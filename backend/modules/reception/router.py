from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from datetime import datetime, date

from backend.core.database import get_db
from backend.modules.auth import require_roles
from backend.modules.users.models import UserRole
from backend.modules.reception.models import QueueItem, QueueStatus
from backend.modules.reception.schemas import QueueItemCreate, QueueItemRead, QueueItemUpdate
from backend.modules.doctors.models import Doctor

router = APIRouter()

@router.post("/queue", response_model=QueueItemRead)
async def add_to_queue(
    item: QueueItemCreate,
    db: AsyncSession = Depends(get_db),
    _user = Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))
):
    """Add patient to queue with doctor-specific prefix (A-001, B-001, etc.)"""
    today = date.today()
    
    # Get doctor to fetch queue_prefix
    doctor_result = await db.execute(select(Doctor).where(Doctor.id == item.doctor_id))
    doctor = doctor_result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    # Generate sequential number atomically with retry on unique constraint.
    # This prevents collisions when two patients are registered at the same time.
    for _attempt in range(10):
        # Next seq for this doctor & date
        res = await db.execute(
            select(func.coalesce(func.max(QueueItem.sequence), 0) + 1)
            .where(QueueItem.doctor_id == item.doctor_id, QueueItem.queue_date == today)
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

    raise HTTPException(status_code=409, detail="Failed to allocate queue ticket (try again)")

@router.get("/queue", response_model=list[QueueItemRead])
async def get_queue(
    db: AsyncSession = Depends(get_db),
    _user = Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))
):
    # Return all waiting items, or all items for today
    # Ordering by created_at desc (or asc for queue?) Usually ASC for queue (FIFO)
    result = await db.execute(
        select(QueueItem)
        .options(selectinload(QueueItem.doctor))
        .order_by(QueueItem.created_at.asc())
        # .where(QueueItem.status == QueueStatus.WAITING) # Optionally filter
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
    _user = Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))
):
    item = await db.get(QueueItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    item.status = update.status
    await db.commit()
    await db.refresh(item)
    return item
