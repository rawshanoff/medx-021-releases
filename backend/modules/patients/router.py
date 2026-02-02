from typing import List

from backend.core.database import get_db
from backend.modules.appointments.models import Appointment
from backend.modules.auth import require_roles
from backend.modules.finance.models import Transaction
from backend.modules.patients.models import Patient
from backend.modules.patients.schemas import (
    PatientAppointmentHistoryRead,
    PatientCreate,
    PatientHistoryRead,
    PatientQueueHistoryRead,
    PatientRead,
    PatientTransactionRead,
    PatientUpdate,
)
from backend.modules.patients.text import (
    contains_cyrillic,
    contains_latin,
    cyrillic_to_latin,
    latin_to_cyrillic,
    normalize_full_name,
)
from backend.modules.reception.models import QueueItem
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("/", response_model=PatientRead)
async def create_patient(
    patient: PatientCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    ),
):
    # Check phone uniqueness
    result = await db.execute(select(Patient).where(Patient.phone == patient.phone))
    if result.scalars().first():
        raise HTTPException(
            status_code=400, detail="Patient with this phone already exists"
        )

    payload = patient.model_dump()
    if payload.get("full_name"):
        payload["full_name"] = normalize_full_name(payload["full_name"])

    new_patient = Patient(**payload)
    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)
    return new_patient


@router.get("/", response_model=List[PatientRead])
async def search_patients(
    q: str = "",  # Legacy global search
    phone: str = None,
    full_name: str = None,
    birth_date: str = None,  # Expect ISO string YYYY-MM-DD
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    ),
):
    query = select(Patient).where(Patient.deleted_at.is_(None))

    # Granular filters (AND logic)
    if phone:
        query = query.where(Patient.phone.ilike(f"%{phone}%"))
    if full_name:
        # Multi-script search: if user types Latin, also match Cyrillic and vice versa.
        variants = [full_name.strip()]
        if contains_latin(full_name):
            variants.append(latin_to_cyrillic(full_name))
        if contains_cyrillic(full_name):
            variants.append(cyrillic_to_latin(full_name))
        # remove duplicates / empties
        uniq = []
        for v in variants:
            v = (v or "").strip()
            if v and v not in uniq:
                uniq.append(v)
        query = query.where(or_(*[Patient.full_name.ilike(f"%{v}%") for v in uniq]))
    if birth_date:
        # Assuming birth_date in DB is Date object. comparing with string might need casting or parsing
        # simple exact match
        from datetime import date

        try:
            # handle potential format issues casually
            bd = date.fromisoformat(birth_date)
            query = query.where(Patient.birth_date == bd)
        except ValueError:
            pass

    # Fallback to global search if no specific filters provided but 'q' is there
    if not (phone or full_name or birth_date) and q:
        query = query.where(
            or_(Patient.full_name.ilike(f"%{q}%"), Patient.phone.ilike(f"%{q}%"))
        )

    query = query.offset(skip).limit(limit).order_by(Patient.full_name)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{patient_id}", response_model=PatientRead)
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    ),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.deleted_at.is_(None))
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.put("/{patient_id}", response_model=PatientRead)
async def update_patient(
    patient_id: int,
    patient_update: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    ),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.deleted_at.is_(None))
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    update_data = patient_update.model_dump(exclude_unset=True)
    if "full_name" in update_data and update_data["full_name"]:
        update_data["full_name"] = normalize_full_name(update_data["full_name"])
    for key, value in update_data.items():
        setattr(patient, key, value)

    await db.commit()
    await db.refresh(patient)
    return patient


@router.get("/{patient_id}/history", response_model=PatientHistoryRead)
async def get_patient_history(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    ),
):
    patient = await db.get(Patient, patient_id)
    if not patient or patient.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Patient not found")

    tx_res = await db.execute(
        select(Transaction)
        .where(Transaction.patient_id == patient_id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
    )
    q_res = await db.execute(
        select(QueueItem)
        .where(QueueItem.patient_id == patient_id)
        .order_by(QueueItem.created_at.desc())
        .limit(50)
    )
    a_res = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(Appointment.start_time.desc())
        .limit(50)
    )

    return PatientHistoryRead(
        transactions=[
            PatientTransactionRead.model_validate(x) for x in tx_res.scalars().all()
        ],
        queue=[
            PatientQueueHistoryRead.model_validate(x) for x in q_res.scalars().all()
        ],
        appointments=[
            PatientAppointmentHistoryRead.model_validate(x)
            for x in a_res.scalars().all()
        ],
    )
