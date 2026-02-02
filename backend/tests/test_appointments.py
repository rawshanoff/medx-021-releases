import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from backend.core.config import settings
from backend.modules.appointments.models import Appointment
from backend.modules.appointments.router import (
    cancel_appointment,
    create_appointment,
    list_appointments_v2,
)
from backend.modules.appointments.schemas import AppointmentCreate
from backend.modules.files.models import FileDeliveryLog, PatientFile, TelegramLinkToken
from backend.modules.patients.models import Patient
from backend.modules.reception.models import QueueItem
from backend.modules.users.models import User, UserRole
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool


def _dummy_receptionist() -> User:
    return User(
        username="test_receptionist",
        password_hash="x",
        full_name="Test Receptionist",
        role=UserRole.RECEPTIONIST,
        is_active=True,
    )


async def _with_db(fn):
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # Clean state (order matters due to FKs)
        await db.execute(delete(QueueItem))
        await db.execute(delete(FileDeliveryLog))
        await db.execute(delete(PatientFile))
        await db.execute(delete(TelegramLinkToken))
        await db.execute(delete(Appointment))
        await db.execute(delete(Patient))
        await db.commit()

        await fn(db)

    await engine.dispose()


def test_create_appointment_requires_patient_404():
    async def _test(db):
        user = _dummy_receptionist()
        now = datetime.now(timezone.utc).replace(microsecond=0)

        with pytest.raises(HTTPException) as e:
            await create_appointment(
                appt=AppointmentCreate(
                    patient_id=999999,
                    doctor_id="Dr. X",
                    start_time=now + timedelta(hours=1),
                    end_time=now + timedelta(hours=2),
                ),
                db=db,
                _user=user,
            )
        assert e.value.status_code == 404

    asyncio.run(_with_db(_test))


def test_create_appointment_detects_overlap_same_doctor():
    async def _test(db):
        user = _dummy_receptionist()

        p = Patient(full_name="Patient One", phone="+998900000001")
        db.add(p)
        await db.commit()
        await db.refresh(p)

        now = datetime.now(timezone.utc).replace(microsecond=0)
        await create_appointment(
            appt=AppointmentCreate(
                patient_id=p.id,
                doctor_id="Dr. Overlap",
                start_time=now + timedelta(hours=10),
                end_time=now + timedelta(hours=11),
            ),
            db=db,
            _user=user,
        )

        with pytest.raises(HTTPException) as e:
            await create_appointment(
                appt=AppointmentCreate(
                    patient_id=p.id,
                    doctor_id="Dr. Overlap",
                    start_time=now + timedelta(hours=10, minutes=30),
                    end_time=now + timedelta(hours=11, minutes=30),
                ),
                db=db,
                _user=user,
            )
        assert e.value.status_code == 409

    asyncio.run(_with_db(_test))


def test_list_appointments_v2_filters_and_fills_patient_name():
    async def _test(db):
        user = _dummy_receptionist()

        p = Patient(full_name="Patient Two", phone="+998900000002")
        db.add(p)
        await db.commit()
        await db.refresh(p)

        now = datetime.now(timezone.utc).replace(microsecond=0)
        a1 = await create_appointment(
            appt=AppointmentCreate(
                patient_id=p.id,
                doctor_id="Dr. A",
                start_time=now + timedelta(days=1, hours=1),
                end_time=now + timedelta(days=1, hours=2),
            ),
            db=db,
            _user=user,
        )
        a2 = await create_appointment(
            appt=AppointmentCreate(
                patient_id=p.id,
                doctor_id="Dr. B",
                start_time=now + timedelta(days=1, hours=3),
                end_time=now + timedelta(days=1, hours=4),
            ),
            db=db,
            _user=user,
        )

        start = now + timedelta(days=1)
        end = now + timedelta(days=2)

        all_items = await list_appointments_v2(
            start=start,
            end=end,
            doctor_id=None,
            db=db,
            _user=user,
        )
        ids = {x.id for x in all_items}
        assert a1.id in ids
        assert a2.id in ids
        assert all(x.patient_name for x in all_items)

        filtered = await list_appointments_v2(
            start=start,
            end=end,
            doctor_id="Dr. A",
            db=db,
            _user=user,
        )
        assert [x.id for x in filtered] == [a1.id]
        assert filtered[0].patient_name == "Patient Two"

    asyncio.run(_with_db(_test))


def test_cancel_appointment_deletes_record():
    async def _test(db):
        user = _dummy_receptionist()

        p = Patient(full_name="Patient Three", phone="+998900000003")
        db.add(p)
        await db.commit()
        await db.refresh(p)

        now = datetime.now(timezone.utc).replace(microsecond=0)
        a = await create_appointment(
            appt=AppointmentCreate(
                patient_id=p.id,
                doctor_id="Dr. Cancel",
                start_time=now + timedelta(hours=1),
                end_time=now + timedelta(hours=2),
            ),
            db=db,
            _user=user,
        )

        await cancel_appointment(id=a.id, db=db, _user=user)

        res = await db.execute(select(Appointment).where(Appointment.id == a.id))
        row = res.scalars().first()
        assert row is not None
        assert row.deleted_at is not None
        assert row.status == "cancelled"

    asyncio.run(_with_db(_test))
