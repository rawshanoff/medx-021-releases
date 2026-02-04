import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from backend.core.config import settings
from sqlalchemy import Column, DateTime, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DB_ECHO)

SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

logger = logging.getLogger("medx.db")


class SoftDeleteMixin:
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    def soft_delete(self) -> None:
        # Use UTC timestamp to avoid timezone drift.
        self.deleted_at = datetime.now(timezone.utc)


async def get_db():
    async with SessionLocal() as session:
        yield session


async def _check_db_version():
    """Проверка версии БД через Alembic.

    Проверяет, что таблица alembic_version существует и содержит версию.
    Детальная проверка соответствия последней миграции выполняется через команду alembic.
    """
    try:
        async with engine.begin() as conn:
            # Проверяем, существует ли таблица alembic_version
            result = await conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'alembic_version'
                    )
                    """))
            table_exists = result.scalar()

            if not table_exists:
                logger.warning(
                    "⚠️  Таблица alembic_version не найдена. "
                    "Возможно, миграции не применены. Запустите: alembic upgrade head"
                )
                return True  # Не блокируем запуск, но предупреждаем

            # Получаем текущую версию БД
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            current_rev = result.scalar_one_or_none()

            if not current_rev:
                logger.warning(
                    "⚠️  База данных не имеет версии Alembic. "
                    "Возможно, миграции не применены. Запустите: alembic upgrade head"
                )
                return True

            logger.info(f"✅ Версия БД: {current_rev}")
            logger.info(
                "💡 Для проверки соответствия последней миграции выполните: alembic current"
            )
            return True
    except Exception as e:
        logger.warning(f"⚠️  Не удалось проверить версию БД: {e}. Продолжаем запуск...")
        # Не блокируем запуск, если проверка не удалась (например, в тестах)
        return True


async def _auto_migrate_if_enabled() -> None:
    """Desktop helper: auto-apply Alembic migrations if enabled.

    On target machines the DB can be empty. For MVP desktop we want a smooth first-run:
    if MEDX_AUTO_MIGRATE=1, run `alembic upgrade head` using Alembic API.

    We rely on external migration files shipped with Electron extraResources:
      <MEDX_APP_DIR>/backend/alembic.ini
      <MEDX_APP_DIR>/backend/alembic/versions/...
    """
    env_flag = os.getenv("MEDX_AUTO_MIGRATE", "").strip() == "1"
    # In packaged desktop backend we want migrations on first run even if env vars were lost.
    frozen = bool(getattr(sys, "frozen", False))
    if not (env_flag or frozen):
        return

    # Prefer explicit app dir from Electron, otherwise fallback to current working directory.
    app_dir = os.getenv("MEDX_APP_DIR", "").strip() or os.getcwd()

    root = Path(app_dir)
    cfg_path = root / "backend" / "alembic.ini"
    script_location = root / "backend" / "alembic"
    if not cfg_path.exists() or not script_location.exists():
        logger.warning(
            "Auto-migrate skipped: alembic files not found. "
            f"cfg={cfg_path} script_location={script_location}"
        )
        return

    # Check if migrations needed: either alembic_version or users table missing.
    async with engine.begin() as conn:
        result = await conn.execute(text("""
                SELECT
                  EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'alembic_version'
                  ) AS has_alembic,
                  EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'users'
                  ) AS has_users
                """))
        row = result.first()
        has_alembic = bool(row[0]) if row is not None else False
        has_users = bool(row[1]) if row is not None else False

    if has_alembic and has_users:
        return

    logger.warning(
        "⚠️  Похоже, БД не инициализирована: применяем миграции Alembic автоматически... "
        f"(app_dir={root})"
    )

    def _run() -> None:
        from alembic.config import Config

        from alembic import command

        cfg = Config(str(cfg_path))
        cfg.set_main_option("script_location", str(script_location).replace("\\", "/"))
        command.upgrade(cfg, "head")

    try:
        import asyncio

        await asyncio.to_thread(_run)
        logger.info("✅ Миграции применены (alembic upgrade head)")
    except Exception:
        logger.exception("❌ Не удалось применить миграции автоматически")
        raise


async def init_db():
    """Проверка доступности БД и версии схемы.

    Важно: схемой БД управляем через Alembic миграции, а не через create_all().
    """
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    # Desktop: create schema automatically on first run (when DB is empty).
    await _auto_migrate_if_enabled()

    # Проверяем версию БД
    await _check_db_version()
