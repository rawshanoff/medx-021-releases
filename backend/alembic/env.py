"""Alembic environment.

Note: We intentionally tweak sys.path before importing `backend.*` so Alembic can
run from the `backend/` directory. Ruff would normally flag this as E402.
"""

# ruff: noqa: E402

import sys
from logging.config import fileConfig
from pathlib import Path

# Ensure `backend` package is importable even when running Alembic from `backend/`
_repo_root = Path(__file__).resolve().parents[2]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from backend.core.config import settings

# Import your Base model here
from backend.core.database import Base

# Import all models explicitly to register with Base.metadata
from sqlalchemy import create_engine, pool
from sqlalchemy.engine.url import make_url

from alembic import context

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

    connectable = create_engine(sync_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
