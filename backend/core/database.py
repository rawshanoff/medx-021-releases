from backend.core.config import settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DB_ECHO)

SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    async with SessionLocal() as session:
        yield session


async def init_db():
    """Проверка доступности БД.

    Важно: схемой БД управляем через Alembic миграции, а не через create_all().
    """
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
