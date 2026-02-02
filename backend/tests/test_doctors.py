import asyncio

import pytest
from backend.core.config import settings
from backend.modules.doctors.models import AuditLog, Doctor, DoctorService
from backend.modules.doctors.router import delete_doctor, update_doctor
from backend.modules.doctors.schemas import DoctorUpdate
from backend.modules.reception import models as _reception_models  # noqa: F401
from backend.modules.reception.models import QueueItem
from backend.modules.users.models import User, UserRole
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool


def _dummy_admin() -> User:
    return User(
        username="test_admin",
        password_hash="x",
        full_name="Test Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )


async def _with_db(fn):
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # Clean state (order matters due to FKs)
        await db.execute(delete(QueueItem))
        await db.execute(delete(DoctorService))
        await db.execute(delete(Doctor))
        await db.execute(delete(AuditLog))
        await db.commit()

        await fn(db)

    await engine.dispose()


def test_update_doctor_can_change_queue_prefix():
    async def _test(db):
        user = _dummy_admin()

        d = Doctor(
            full_name="Doc One", specialty="Spec", queue_prefix="A", is_active=True
        )
        db.add(d)
        await db.commit()
        await db.refresh(d)

        await update_doctor(
            doctor_id=d.id,
            doctor_update=DoctorUpdate(queue_prefix="b"),
            db=db,
            _user=user,
        )

        await db.refresh(d)
        assert d.queue_prefix == "B"

    asyncio.run(_with_db(_test))


def test_doctor_update_queue_prefix_validation():
    # empty string should be rejected by schema validation
    with pytest.raises(ValidationError):
        DoctorUpdate(queue_prefix="")

    # longer value should be normalized to first letter
    du = DoctorUpdate(queue_prefix="bb")
    assert du.queue_prefix == "B"


def test_delete_doctor_removes_queue_items():
    async def _test(db):
        user = _dummy_admin()

        d = Doctor(
            full_name="Doc Delete", specialty="Spec", queue_prefix="A", is_active=True
        )
        db.add(d)
        await db.commit()
        await db.refresh(d)

        qi = QueueItem(
            ticket_number="A-001",
            patient_name="Test Patient",
            doctor_id=d.id,
        )
        db.add(qi)
        await db.commit()

        await delete_doctor(doctor_id=d.id, db=db, _user=user)

        res = await db.execute(select(QueueItem).where(QueueItem.doctor_id == d.id))
        assert res.scalars().all() == []

        res2 = await db.execute(select(Doctor).where(Doctor.id == d.id))
        assert res2.scalars().first() is None

    asyncio.run(_with_db(_test))
