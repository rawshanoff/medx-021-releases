import asyncio

import pytest
from backend.core.database import Base
from backend.modules.doctors.models import Doctor
from backend.modules.patients.models import Patient
from backend.modules.reception.models import QueueItem
from backend.modules.reception.router import (
    add_to_queue,
    get_queue,
    update_queue_status,
)
from backend.modules.reception.schemas import QueueItemCreate, QueueItemUpdate
from backend.modules.users.models import User, UserRole
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


def _dummy_receptionist() -> User:
    return User(
        username="test_receptionist",
        password_hash="x",
        full_name="Test Receptionist",
        role=UserRole.RECEPTIONIST,
        is_active=True,
    )


def _dummy_patient(full_name: str, phone: str) -> Patient:
    return Patient(full_name=full_name, phone=phone)


async def _with_db(fn):
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with Session() as db:
        await fn(db)

    await engine.dispose()


def test_add_to_queue_generates_sequential_ticket_per_doctor():
    async def _test(db):
        user = _dummy_receptionist()

        doc_a = Doctor(
            full_name="Doc A", specialty="Spec", queue_prefix="A", is_active=True
        )
        doc_b = Doctor(
            full_name="Doc B", specialty="Spec", queue_prefix="B", is_active=True
        )
        db.add_all([doc_a, doc_b])
        await db.commit()
        await db.refresh(doc_a)
        await db.refresh(doc_b)

        p1 = _dummy_patient("P1", "+1000000001")
        p2 = _dummy_patient("P2", "+1000000002")
        p3 = _dummy_patient("P3", "+1000000003")
        db.add_all([p1, p2, p3])
        await db.commit()
        await db.refresh(p1)
        await db.refresh(p2)
        await db.refresh(p3)

        i1 = await add_to_queue(
            QueueItemCreate(patient_name="P1", patient_id=p1.id, doctor_id=doc_a.id),
            db=db,
            _user=user,
        )
        i2 = await add_to_queue(
            QueueItemCreate(patient_name="P2", patient_id=p2.id, doctor_id=doc_a.id),
            db=db,
            _user=user,
        )
        i3 = await add_to_queue(
            QueueItemCreate(patient_name="P3", patient_id=p3.id, doctor_id=doc_b.id),
            db=db,
            _user=user,
        )

        assert i1.ticket_number == "A-001"
        assert i2.ticket_number == "A-002"
        assert i3.ticket_number == "B-001"
        assert i1.sequence == 1
        assert i2.sequence == 2
        assert i3.sequence == 1

    asyncio.run(_with_db(_test))


def test_get_queue_enriches_doctor_name_and_fifo_order():
    async def _test(db):
        user = _dummy_receptionist()

        doc = Doctor(
            full_name="Doc Queue", specialty="Spec", queue_prefix="Q", is_active=True
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        p1 = _dummy_patient("P1", "+1000000011")
        p2 = _dummy_patient("P2", "+1000000012")
        db.add_all([p1, p2])
        await db.commit()
        await db.refresh(p1)
        await db.refresh(p2)

        await add_to_queue(
            QueueItemCreate(patient_name="P1", patient_id=p1.id, doctor_id=doc.id),
            db=db,
            _user=user,
        )
        await add_to_queue(
            QueueItemCreate(patient_name="P2", patient_id=p2.id, doctor_id=doc.id),
            db=db,
            _user=user,
        )

        items = await get_queue(db=db, _user=user)
        assert len(items) == 2
        assert items[0].ticket_number == "Q-001"
        assert items[0].doctor_name == "Doc Queue"
        assert items[1].ticket_number == "Q-002"
        assert items[1].doctor_name == "Doc Queue"

    asyncio.run(_with_db(_test))


def test_update_queue_status_sets_value():
    async def _test(db):
        user = _dummy_receptionist()

        doc = Doctor(
            full_name="Doc Status", specialty="Spec", queue_prefix="S", is_active=True
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        patient = _dummy_patient("P1", "+1000000021")
        db.add(patient)
        await db.commit()
        await db.refresh(patient)

        item = await add_to_queue(
            QueueItemCreate(patient_name="P1", patient_id=patient.id, doctor_id=doc.id),
            db=db,
            _user=user,
        )
        updated = await update_queue_status(
            item_id=item.id,
            update=QueueItemUpdate(status="COMPLETED"),
            db=db,
            _user=user,
        )
        assert updated.status == "COMPLETED"

        res = await db.execute(select(QueueItem).where(QueueItem.id == item.id))
        persisted = res.scalars().one()
        assert persisted.status == "COMPLETED"

    asyncio.run(_with_db(_test))


def test_add_to_queue_missing_doctor_404():
    async def _test(db):
        user = _dummy_receptionist()

        patient = _dummy_patient("P1", "+1000000031")
        db.add(patient)
        await db.commit()
        await db.refresh(patient)

        with pytest.raises(HTTPException) as e:
            await add_to_queue(
                QueueItemCreate(
                    patient_name="P1", patient_id=patient.id, doctor_id=999999
                ),
                db=db,
                _user=user,
            )
        assert e.value.status_code == 404

    asyncio.run(_with_db(_test))
