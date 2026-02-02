from backend.core.config import settings
from sqlalchemy import Column, DateTime, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import func

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DB_ECHO)

SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


class SoftDeleteMixin:
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    def soft_delete(self) -> None:
        # Use DB-side timestamp to avoid timezone drift.
        self.deleted_at = func.now()


async def get_db():
    async with SessionLocal() as session:
        yield session


async def init_db():
    """Проверка доступности БД.

    Важно: схемой БД управляем через Alembic миграции, а не через create_all().
    """
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
