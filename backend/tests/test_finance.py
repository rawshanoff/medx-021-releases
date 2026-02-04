import asyncio

import pytest
from backend.core.database import Base
from backend.modules.appointments import models as _appointments_models  # noqa: F401
from backend.modules.finance.models import (
    PaymentMethod,
    Shift,
)
from backend.modules.finance.router import close_shift, open_shift, process_payment
from backend.modules.finance.schemas import ShiftCreate, TransactionCreate
from backend.modules.patients import models as _patients_models  # noqa: F401
from backend.modules.users.models import User, UserRole
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool


def _dummy_cashier() -> User:
    # Not persisted; audit log uses nullable user_id.
    return User(
        username="test_cashier",
        password_hash="x",
        full_name="Test Cashier",
        role=UserRole.CASHIER,
        is_active=True,
    )


async def _with_db(fn):
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with Session() as db:
        await fn(db)

    await engine.dispose()


def test_open_shift_and_cash_payment_updates_totals():
    async def _test(db):
        user = _dummy_cashier()

        shift = await open_shift(ShiftCreate(cashier_id="cashier-1"), db=db, user=user)
        assert shift.id > 0
        assert shift.total_cash == 0
        assert shift.total_card == 0
        assert shift.total_transfer == 0

        tx = await process_payment(
            TransactionCreate(
                patient_id=None,
                amount=100,
                payment_method=PaymentMethod.CASH,
                description="Consultation",
            ),
            db=db,
            user=user,
        )
        assert tx.id > 0

        res = await db.execute(select(Shift).where(Shift.id == shift.id))
        persisted = res.scalars().one()
        assert persisted.total_cash == 100
        assert persisted.total_card == 0
        assert persisted.total_transfer == 0

    asyncio.run(_with_db(_test))


def test_mixed_payment_updates_split_totals():
    async def _test(db):
        user = _dummy_cashier()
        shift = await open_shift(ShiftCreate(cashier_id="cashier-1"), db=db, user=user)

        await process_payment(
            TransactionCreate(
                patient_id=None,
                amount=150,
                payment_method=PaymentMethod.MIXED,
                cash_amount=50,
                card_amount=100,
                transfer_amount=0,
                description="Service",
            ),
            db=db,
            user=user,
        )

        res = await db.execute(select(Shift).where(Shift.id == shift.id))
        persisted = res.scalars().one()
        assert persisted.total_cash == 50
        assert persisted.total_card == 100
        assert persisted.total_transfer == 0

    asyncio.run(_with_db(_test))


def test_negative_transaction_requires_description():
    async def _test(db):
        user = _dummy_cashier()
        await open_shift(ShiftCreate(cashier_id="cashier-1"), db=db, user=user)

        with pytest.raises(HTTPException) as e:
            await process_payment(
                TransactionCreate(
                    patient_id=None,
                    amount=-10,
                    payment_method=PaymentMethod.CASH,
                    description="",
                ),
                db=db,
                user=user,
            )

        assert e.value.status_code == 400

    asyncio.run(_with_db(_test))


def test_close_shift_marks_closed():
    async def _test(db):
        user = _dummy_cashier()
        shift = await open_shift(ShiftCreate(cashier_id="cashier-1"), db=db, user=user)

        closed = await close_shift(db=db, user=user)
        assert closed.id == shift.id
        assert closed.is_closed is True
        assert closed.end_time is not None

    asyncio.run(_with_db(_test))
