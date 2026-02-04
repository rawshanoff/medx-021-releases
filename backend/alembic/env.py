"""Alembic environment.

Note: We intentionally tweak sys.path before importing `backend.*` so Alembic can
run from the `backend/` directory. Ruff would normally flag this as E402.
"""

# ruff: noqa: E402

import os
import sys

try:
    # In some packaged environments (e.g. old PyInstaller builds) `logging.config`
    # may not be bundled. Logging config is optional for migrations, so we fail-open.
    from logging.config import fileConfig  # type: ignore
except Exception:  # pragma: no cover
    fileConfig = None  # type: ignore
from pathlib import Path

# Ensure `backend` package is importable even when running Alembic from `backend/`
_repo_root = Path(__file__).resolve().parents[2]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from sqlalchemy import create_engine, pool
from sqlalchemy.engine.url import make_url

from alembic import context

config = context.config

if fileConfig is not None and config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None
try:
    # Optional: only needed for autogenerate.
    from backend.core.database import Base  # type: ignore

    target_metadata = Base.metadata
except Exception:
    target_metadata = None


def _read_env_key(env_path: str, key: str) -> str:
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("#"):
                    continue
                if not s.startswith(key + "="):
                    continue
                return s.split("=", 1)[1].strip().strip("'\"")
    except Exception:
        return ""
    return ""


def _get_database_url() -> str:
    # Prefer explicit env var (updater can set it).
    direct = os.getenv("DATABASE_URL", "").strip()
    if direct:
        return direct

    # Desktop: backend passes MEDX_ENV_FILE to child processes.
    env_file = os.getenv("MEDX_ENV_FILE", "").strip()
    if env_file:
        v = _read_env_key(env_file, "DATABASE_URL")
        if v:
            return v

    # Dev fallback: import settings
    try:
        from backend.core.config import settings  # type: ignore

        return str(settings.DATABASE_URL)
    except Exception:
        return ""


def _get_sync_url() -> str:
    """Alembic работает через sync драйвер.

    В коде приложения используется async URL (asyncpg), поэтому здесь конвертируем в psycopg2.
    """
    raw = _get_database_url()
    if not raw:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Set DATABASE_URL or MEDX_ENV_FILE before running Alembic."
        )
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
