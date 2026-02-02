import asyncio

from backend.core.config import settings
from backend.modules.doctors.models import AuditLog, Doctor, DoctorService
from backend.modules.doctors.router import update_doctor
from backend.modules.doctors.schemas import DoctorUpdate
from backend.modules.reception import models as _reception_models  # noqa: F401
from backend.modules.reception.models import QueueItem
from backend.modules.users.models import User, UserRole
from sqlalchemy import delete
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
