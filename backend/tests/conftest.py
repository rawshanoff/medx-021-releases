# ruff: noqa: E402
import sys
from pathlib import Path

# Make `import backend.*` work when running pytest from `backend/`.
_repo_root = Path(__file__).resolve().parents[2]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

import pytest
from backend.core.database import Base, get_db
from backend.core.licenses import license_manager
from backend.modules.appointments.router import router as appointments_router
from backend.modules.auth import get_current_user
from backend.modules.auth import router as auth_router
from backend.modules.doctors.models import Doctor
from backend.modules.doctors.router import router as doctors_router
from backend.modules.files.router import router as files_router
from backend.modules.finance.router import router as finance_router
from backend.modules.licenses.router import router as licenses_router
from backend.modules.patients.router import router as patients_router
from backend.modules.reception.router import router as reception_router
from backend.modules.system.router import router as system_router
from backend.modules.users.models import User, UserRole
from backend.modules.users.router import router as users_router
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


@pytest.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        session.add(
            Doctor(
                full_name="Test Doctor",
                specialty="General",
                queue_prefix="A",
                is_active=True,
            )
        )
        await session.commit()
        yield session

    await engine.dispose()


@pytest.fixture
async def async_client(db_session: AsyncSession):
    app = FastAPI()
    app.include_router(auth_router, prefix="/api")
    app.include_router(users_router, prefix="/api")
    app.include_router(patients_router, prefix="/api/patients", tags=["Patients"])
    app.include_router(finance_router, prefix="/api/finance", tags=["Finance"])
    app.include_router(doctors_router, prefix="/api/doctors", tags=["Doctors"])
    app.include_router(
        appointments_router, prefix="/api/appointments", tags=["Appointments"]
    )
    app.include_router(system_router, prefix="/api/system", tags=["System"])
    app.include_router(reception_router, prefix="/api/reception", tags=["Reception"])
    app.include_router(files_router, prefix="/api")
    app.include_router(licenses_router, prefix="/api")

    async def _override_get_db():
        yield db_session

    async def _override_current_user():
        return User(
            username="test-admin",
            password_hash="x",
            full_name="Test Admin",
            role=UserRole.ADMIN,
            is_active=True,
        )

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_current_user
    license_manager.dev_mode = True

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def headers():
    return {}
