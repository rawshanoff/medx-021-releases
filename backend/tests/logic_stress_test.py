"""
🧠 Logic Stress Test - Проверка целостности бизнес-логики

Этот тест пытается "сломать" систему путем:
1. Отрицательных балансов
2. Race conditions
3. Orphaned records
4. Валидации данных
5. Transactional integrity
"""

import pytest
from backend.modules.appointments import models as _appointments_models  # noqa: F401
from backend.modules.doctors.models import Doctor
from backend.modules.doctors.router import delete_doctor
from backend.modules.finance.models import PaymentMethod, Transaction
from backend.modules.finance.router import close_shift, open_shift, process_payment
from backend.modules.finance.schemas import ShiftCreate, TransactionCreate
from backend.modules.patients import models as _patients_models  # noqa: F401
from backend.modules.patients.models import Patient
from backend.modules.patients.router import delete_patient
from backend.modules.reception.models import QueueItem
from backend.modules.reception.schemas import QueueItemCreate
from backend.modules.users.models import User, UserRole
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Setup test database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


def _dummy_cashier() -> User:
    """Create a dummy cashier for testing."""
    return User(
        username="test_cashier",
        password_hash="x",
        full_name="Test Cashier",
        role=UserRole.CASHIER,
        is_active=True,
    )


def _dummy_patient() -> Patient:
    """Create a dummy patient for testing."""
    return Patient(
        full_name="Test Patient",
        phone="+998901234567",
        birth_date=None,
    )


def _dummy_doctor() -> Doctor:
    """Create a dummy doctor for testing."""
    return Doctor(
        full_name="Test Doctor",
        specialty="General",
        queue_prefix="A",
        is_active=True,
    )


async def _setup_db():
    """Setup in-memory test database."""
    from backend.core.database import Base

    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    return engine, SessionLocal


# ============================================================================
# STRESS TESTS
# ============================================================================


class TestFinanceLogic:
    """Тесты целостности финансовой логики."""

    @pytest.mark.asyncio
    async def test_negative_balance_prevention(self):
        """
        🔴 CRITICAL: Попытка создать платеж больше, чем баланс смены.

        Сценарий:
        1. Открыть смену
        2. Записать платеж 1000 руб (CASH)
        3. Попытаться вернуть 1500 руб (должно FAIL)

        Ожидаемый результат: HTTPException 400 или ошибка БД
        """
        engine, SessionLocal = await _setup_db()

        try:
            async with SessionLocal() as db:
                # Setup
                cashier = _dummy_cashier()
                db.add(cashier)
                await db.flush()

                # 1. Открыть смену
                shift = await open_shift(
                    ShiftCreate(cashier_id=str(cashier.id)), db=db, user=cashier
                )

                # 2. Записать платеж
                await process_payment(
                    TransactionCreate(
                        amount=1000,
                        payment_method=PaymentMethod.CASH,
                        description="Pay",
                    ),
                    db=db,
                    user=cashier,
                )

                # 3. Попытаться вернуть больше, чем есть
                with pytest.raises(HTTPException):
                    await process_payment(
                        TransactionCreate(
                            amount=-1500,
                            payment_method=PaymentMethod.CASH,
                            description="Return",
                        ),
                        db=db,
                        user=cashier,
                    )

                # Баланс не должен уйти в минус
                await db.refresh(shift)
                assert shift.total_cash >= 0

        finally:
            await engine.dispose()

    @pytest.mark.asyncio
    async def test_mixed_payment_validation(self):
        """
        🟠 HIGH: MIXED платежи должны иметь валидные компоненты.

        Проверяем:
        1. cash_amount + card_amount + transfer_amount <= total amount
        2. Все компоненты неотрицательны
        """
        with pytest.raises(ValidationError):
            TransactionCreate(
                amount=1000,
                payment_method=PaymentMethod.MIXED,
                cash_amount=600,
                card_amount=600,
                transfer_amount=600,  # Total = 1800 > 1000!
            )

    @pytest.mark.asyncio
    async def test_orphaned_doctor_in_queue(self):
        """
        🟡 MEDIUM: Можно ли удалить врача, у которого есть пациенты в очереди?

        Сценарий:
        1. Создать врача
        2. Добавить пациента в очередь к этому врачу
        3. Удалить врача (soft-delete)
        4. Проверить, что пациент все еще в очереди с orphaned doctor_id
        """
        engine, SessionLocal = await _setup_db()

        try:
            async with SessionLocal() as db:
                # Setup
                doctor = _dummy_doctor()
                patient = _dummy_patient()
                admin = User(
                    username="admin_user",
                    password_hash="x",
                    full_name="Admin",
                    role=UserRole.ADMIN,
                    is_active=True,
                )
                db.add(doctor)
                db.add(patient)
                db.add(admin)
                await db.flush()

                # Add to queue
                queue_item = QueueItem(
                    doctor_id=doctor.id,
                    patient_id=patient.id,
                    patient_name=patient.full_name,
                    ticket_number="A-001",
                    status="WAITING",
                )
                db.add(queue_item)
                await db.commit()

                # Delete doctor (soft delete)
                await delete_doctor(doctor.id, db=db, _user=admin)

                # Check queue items were cancelled
                queue_result = await db.execute(
                    select(QueueItem).where(QueueItem.id == queue_item.id)
                )
                saved_queue = queue_result.scalar_one()
                assert saved_queue.status == "CANCELLED"

        finally:
            await engine.dispose()

    @pytest.mark.asyncio
    async def test_shift_totals_mismatch(self):
        """
        🔴 CRITICAL: Shift totals могут не совпадать с суммой транзакций.

        Сценарий:
        1. Открыть смену
        2. Добавить платеж (обновит shift.total_cash)
        3. Искусственно изменить shift.total_cash в БД
        4. Попытаться закрыть смену (должно fail)
        """
        engine, SessionLocal = await _setup_db()

        try:
            async with SessionLocal() as db:
                cashier = _dummy_cashier()
                db.add(cashier)
                await db.flush()

                shift = await open_shift(
                    ShiftCreate(cashier_id=str(cashier.id)), db=db, user=cashier
                )

                await process_payment(
                    TransactionCreate(
                        amount=1000,
                        payment_method=PaymentMethod.CASH,
                        description="Pay",
                    ),
                    db=db,
                    user=cashier,
                )

                # Искусственно испортить totals
                shift.total_cash = 999  # Mismatch!
                await db.commit()

                # Try to close shift -> should raise
                with pytest.raises(HTTPException):
                    await close_shift(db=db, user=cashier)

        finally:
            await engine.dispose()

    @pytest.mark.asyncio
    async def test_empty_transaction_amount(self):
        """
        🟡 MEDIUM: Можно ли создать платеж с amount=0?
        """
        with pytest.raises(ValidationError):
            TransactionCreate(amount=0, payment_method=PaymentMethod.CASH)

    @pytest.mark.asyncio
    async def test_duplicate_payment_with_idempotency(self):
        """
        ✅ GOOD: Idempotency key prevents duplicate payments.
        """
        engine, SessionLocal = await _setup_db()

        try:
            async with SessionLocal() as db:
                cashier = _dummy_cashier()
                db.add(cashier)
                await db.flush()

                await open_shift(
                    ShiftCreate(cashier_id=str(cashier.id)), db=db, user=cashier
                )

                idempotency_key = "unique-key-123"

                # First payment
                tx1 = await process_payment(
                    TransactionCreate(
                        amount=1000,
                        payment_method=PaymentMethod.CASH,
                        idempotency_key=idempotency_key,
                        description="Pay",
                    ),
                    db=db,
                    user=cashier,
                )

                # Try duplicate
                tx2 = await process_payment(
                    TransactionCreate(
                        amount=1000,
                        payment_method=PaymentMethod.CASH,
                        idempotency_key=idempotency_key,  # Same key
                        description="Pay again",
                    ),
                    db=db,
                    user=cashier,
                )
                assert tx1.id == tx2.id

                # Close and open new shift: same idempotency key is allowed
                await close_shift(db=db, user=cashier)
                new_shift = await open_shift(
                    ShiftCreate(cashier_id=str(cashier.id)), db=db, user=cashier
                )
                tx3 = await process_payment(
                    TransactionCreate(
                        amount=1000,
                        payment_method=PaymentMethod.CASH,
                        idempotency_key=idempotency_key,
                        description="New shift",
                    ),
                    db=db,
                    user=cashier,
                )
                assert tx3.shift_id == new_shift.id
                assert tx3.id != tx1.id

        finally:
            await engine.dispose()


class TestDataConsistency:
    """Тесты консистентности данных."""

    @pytest.mark.asyncio
    async def test_patient_deletion_cascade(self):
        """
        🟡 MEDIUM: Что происходит при удалении пациента с активными транзакциями?
        """
        engine, SessionLocal = await _setup_db()

        try:
            async with SessionLocal() as db:
                patient = _dummy_patient()
                admin = User(
                    username="admin_user",
                    password_hash="x",
                    full_name="Admin",
                    role=UserRole.ADMIN,
                    is_active=True,
                )
                db.add(patient)
                db.add(admin)
                await db.flush()

                await open_shift(
                    ShiftCreate(cashier_id=str(admin.id)), db=db, user=admin
                )

                # Transaction linked to patient
                tx = await process_payment(
                    TransactionCreate(
                        patient_id=patient.id,
                        amount=1000,
                        payment_method=PaymentMethod.CASH,
                        description="Pay",
                    ),
                    db=db,
                    user=admin,
                )

                # Queue item linked to patient
                queue_item = QueueItem(
                    doctor_id=None,
                    patient_id=patient.id,
                    patient_name=patient.full_name,
                    ticket_number="A-001",
                    status="WAITING",
                )
                db.add(queue_item)
                await db.commit()

                # Delete patient (soft delete)
                await delete_patient(patient.id, db=db, _user=admin)

                # Queue item should be cancelled
                queue_result = await db.execute(
                    select(QueueItem).where(QueueItem.id == queue_item.id)
                )
                saved_queue = queue_result.scalar_one()
                assert saved_queue.status == "CANCELLED"

                # Transaction remains, but patient is archived
                result = await db.execute(
                    select(Transaction).where(Transaction.id == tx.id)
                )
                saved_tx = result.scalar_one()
                assert saved_tx.patient_id == patient.id
                assert saved_tx.patient.deleted_at is not None

        finally:
            await engine.dispose()

    @pytest.mark.asyncio
    async def test_empty_queue_item_data(self):
        """
        🟡 MEDIUM: Can queue item be created with missing required fields?
        """
        with pytest.raises(ValidationError):
            QueueItemCreate(
                doctor_id=1,
                patient_id=1,
                patient_name="   ",
                status="WAITING",
            )


# ============================================================================
# EXECUTION
# ============================================================================

if __name__ == "__main__":
    print("🧠 Running Logic Stress Tests...\n")

    # Run with pytest
    pytest.main([__file__, "-v", "-s"])
