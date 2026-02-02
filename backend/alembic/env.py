import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.engine.url import make_url

from alembic import context

# Import your Base model here
from backend.core.database import Base
from backend.core.config import settings

# Import all models explicitly to register with Base.metadata
from backend.modules.patients.models import Patient
from backend.modules.finance.models import Shift, Transaction, FinanceAuditLog
from backend.modules.doctors.models import Doctor, DoctorService, AuditLog
from backend.modules.appointments.models import Appointment
from backend.modules.reception.models import QueueItem
from backend.modules.files.models import PatientFile, FileDeliveryLog, TelegramLinkToken

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def _get_sync_url() -> str:
    """Alembic работает через sync драйвер.

    В коде приложения используется async URL (asyncpg), поэтому здесь конвертируем в psycopg2.
    """
    raw = settings.DATABASE_URL
    if raw.startswith("postgresql+asyncpg://"):
        return raw.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)

    # Если без драйвера или с другим драйвером — оставляем как есть.
    # make_url просто валидирует строку и нормализует.
    return str(make_url(raw))

def run_migrations_offline() -> None:
    url = _get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    sync_url = _get_sync_url()

    connectable = create_engine(
        sync_url, 
        poolclass=pool.NullPool
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
