import logging

from backend.core.config import settings
from sqlalchemy import Column, DateTime, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import func

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DB_ECHO)

SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

logger = logging.getLogger("medx.db")


class SoftDeleteMixin:
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    def soft_delete(self) -> None:
        # Use DB-side timestamp to avoid timezone drift.
        self.deleted_at = func.now()


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


async def init_db():
    """Проверка доступности БД и версии схемы.

    Важно: схемой БД управляем через Alembic миграции, а не через create_all().
    """
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    # Проверяем версию БД
    await _check_db_version()
