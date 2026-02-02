from datetime import datetime, timezone
from typing import Optional

from backend.core.database import get_db
from backend.core.features import FEATURE_CORE, FEATURE_FINANCE_BASIC
from backend.core.licenses import license_manager
from backend.modules.auth import require_roles
from backend.modules.finance.models import (
    FinanceAuditLog,
    PaymentMethod,
    Shift,
    Transaction,
)
from backend.modules.finance.schemas import (
    RefundCreate,
    ReportXRead,
    ReportZRead,
    ShiftCreate,
    ShiftRead,
    TransactionCreate,
    TransactionRead,
)
from backend.modules.users.models import User, UserRole
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


async def _acquire_shift_lock(db: AsyncSession) -> None:
    """Serialize shift operations (open/close/pay) to avoid races.

    We use Postgres advisory transaction lock. If DB doesn't support it, we skip.
    """
    try:
        await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": 21_001})
    except Exception:
        # best-effort (e.g., sqlite in some environments)
        return


async def check_finance_license():
    features = license_manager.get_active_features()
    if (
        FEATURE_FINANCE_BASIC not in features and FEATURE_CORE not in features
    ):  # core usually includes basic finance in MVP
        # In MVP validation, we might skip this if "core" implies it, but let's be strict for demo
        pass
        # Uncomment to enforce: raise HTTPException(status_code=403, detail="Finance module not active")


async def _audit(
    db: AsyncSession, user: User | None, action: str, details: str | None = None
) -> None:
    db.add(
        FinanceAuditLog(
            user_id=user.id if user else None, action=action, details=details
        )
    )


@router.get("/shifts/active", response_model=Optional[ShiftRead])
async def get_active_shift(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER)
    ),
):
    await check_finance_license()
    existing = await db.execute(
        select(Shift).where(Shift.is_closed == False, Shift.deleted_at.is_(None))
    )
    shift = existing.scalars().first()
    return shift


@router.post("/shifts/open", response_model=ShiftRead)
async def open_shift(
    shift_data: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER)
    ),
):
    await check_finance_license()
    await _acquire_shift_lock(db)

    # Check if there is already an open shift
    existing = await db.execute(
        select(Shift).where(Shift.is_closed == False, Shift.deleted_at.is_(None))
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="A shift is already open")

    new_shift = Shift(cashier_id=shift_data.cashier_id)
    db.add(new_shift)
    await db.flush()
    await _audit(
        db,
        user,
        "shift_open",
        f"cashier_id={shift_data.cashier_id}, shift_id={new_shift.id}",
    )
    await db.commit()
    await db.refresh(new_shift)
    return new_shift


@router.post("/shifts/close", response_model=ShiftRead)
async def close_shift(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER)
    ),
):
    await _acquire_shift_lock(db)
    result = await db.execute(
        select(Shift).where(Shift.is_closed == False, Shift.deleted_at.is_(None))
    )
    shift = result.scalars().first()
    if not shift:
        raise HTTPException(status_code=400, detail="No open shift found")

    shift.is_closed = True
    shift.end_time = datetime.now(timezone.utc)

    # Recalculate totals (simple aggregation)
    # real app would use sum() query

    await _audit(db, user, "shift_close", f"shift_id={shift.id}")
    await db.commit()
    await db.refresh(shift)
    return shift


@router.post("/transactions", response_model=TransactionRead)
async def process_payment(
    tx: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER)
    ),
):
    await check_finance_license()
    await _acquire_shift_lock(db)

    # Требуем описание для отрицательных сумм (расход/возврат)
    if tx.amount < 0 and not (tx.description and tx.description.strip()):
        raise HTTPException(
            status_code=400, detail="Description is required for negative transactions"
        )

    # Find current shift
    # Lock active shift row to prevent race conditions on running totals.
    # We still perform atomic UPDATE on totals, but the lock guarantees a single active shift is used consistently.
    result = await db.execute(
        select(Shift)
        .where(Shift.is_closed == False, Shift.deleted_at.is_(None))
        .with_for_update()
    )
    shift = result.scalars().first()
    if not shift:
        raise HTTPException(
            status_code=400, detail="No open shift. Open a shift first."
        )

    new_tx = Transaction(shift_id=shift.id, **tx.model_dump())

    # Atomic running totals update (race-safe).
    delta_cash = (
        int(tx.cash_amount)
        if tx.payment_method == PaymentMethod.MIXED
        else (int(tx.amount) if tx.payment_method == PaymentMethod.CASH else 0)
    )
    delta_card = (
        int(tx.card_amount)
        if tx.payment_method == PaymentMethod.MIXED
        else (int(tx.amount) if tx.payment_method == PaymentMethod.CARD else 0)
    )
    delta_transfer = (
        int(tx.transfer_amount)
        if tx.payment_method == PaymentMethod.MIXED
        else (int(tx.amount) if tx.payment_method == PaymentMethod.TRANSFER else 0)
    )

    db.add(new_tx)
    await db.flush()

    await db.execute(
        update(Shift)
        .where(
            Shift.id == shift.id, Shift.is_closed == False, Shift.deleted_at.is_(None)
        )
        .values(
            total_cash=Shift.total_cash + delta_cash,
            total_card=Shift.total_card + delta_card,
            total_transfer=Shift.total_transfer + delta_transfer,
        )
    )

    await _audit(
        db,
        user,
        "transaction",
        f"tx_id={new_tx.id}, amount={tx.amount}, method={tx.payment_method}, patient_id={tx.patient_id}",
    )
    await db.commit()
    await db.refresh(new_tx)
    return new_tx


@router.post("/refund/{transaction_id}", response_model=TransactionRead)
async def refund_payment(
    transaction_id: int,
    refund_data: RefundCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER)
    ),
):
    """Refund payment for unstarted appointment. Creates negative transaction."""
    await check_finance_license()
    await _acquire_shift_lock(db)

    reason = refund_data.reason

    # Find original transaction
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.deleted_at.is_(None)
        )
    )
    original_tx = result.scalars().first()
    if not original_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Check if appointment has started (has appointment record)
    from backend.modules.appointments.models import Appointment

    appointment_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.patient_id == original_tx.patient_id,
            Appointment.created_at >= original_tx.created_at,
            Appointment.deleted_at.is_(None),
        )
        .limit(1)
    )
    if appointment_result.scalars().first():
        raise HTTPException(
            status_code=400, detail="Cannot refund: appointment has already started"
        )

    # Find current shift
    shift_result = await db.execute(
        select(Shift)
        .where(Shift.is_closed == False, Shift.deleted_at.is_(None))
        .with_for_update()
    )
    shift = shift_result.scalars().first()
    if not shift:
        raise HTTPException(
            status_code=400, detail="No open shift. Open a shift first."
        )

    # Create refund transaction (negative amount)
    refund_tx = Transaction(
        shift_id=shift.id,
        patient_id=original_tx.patient_id,
        amount=-abs(original_tx.amount),  # Always negative
        doctor_id=original_tx.doctor_id,
        payment_method=original_tx.payment_method,
        cash_amount=-abs(original_tx.cash_amount),
        card_amount=-abs(original_tx.card_amount),
        transfer_amount=-abs(original_tx.transfer_amount),
        description=f"Refund: {reason.strip()} (original TX #{original_tx.id})",
    )

    # Atomic running totals update (negative values for refund)
    delta_cash = (
        -abs(original_tx.cash_amount)
        if original_tx.payment_method == PaymentMethod.MIXED
        else (
            -abs(original_tx.amount)
            if original_tx.payment_method == PaymentMethod.CASH
            else 0
        )
    )
    delta_card = (
        -abs(original_tx.card_amount)
        if original_tx.payment_method == PaymentMethod.MIXED
        else (
            -abs(original_tx.amount)
            if original_tx.payment_method == PaymentMethod.CARD
            else 0
        )
    )
    delta_transfer = (
        -abs(original_tx.transfer_amount)
        if original_tx.payment_method == PaymentMethod.MIXED
        else (
            -abs(original_tx.amount)
            if original_tx.payment_method == PaymentMethod.TRANSFER
            else 0
        )
    )

    # Update shift totals atomically
    await db.execute(
        update(Shift)
        .where(Shift.id == shift.id)
        .values(
            total_cash=Shift.total_cash + delta_cash,
            total_card=Shift.total_card + delta_card,
            total_transfer=Shift.total_transfer + delta_transfer,
        )
    )

    db.add(refund_tx)
    await db.commit()
    await db.refresh(refund_tx)

    await _audit(
        db,
        user,
        "Refund Payment",
        f"Refunded TX #{original_tx.id} for {abs(original_tx.amount)} (reason: {reason})",
    )

    return refund_tx


@router.get("/reports/{type}", response_model=ReportXRead | ReportZRead)
async def get_report(
    type: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER)
    ),
):
    # Check Active Shift
    res = await db.execute(
        select(Shift).where(Shift.is_closed == False, Shift.deleted_at.is_(None))
    )
    shift = res.scalars().first()

    if type.upper() == "X":
        if not shift:
            raise HTTPException(status_code=400, detail="No active shift for X-Report")
        # For MVP returning stored running totals
        return {
            "type": "X-Report",
            "shift_id": shift.id,
            "cashier": shift.cashier_id,
            "total_cash": shift.total_cash,
            "total_card": shift.total_card,
            "total_transfer": shift.total_transfer,
            "generated_at": datetime.now(timezone.utc),
        }

    elif type.upper() == "Z":
        # Usually checking last closed shift or closing current
        # For simplicity, return last closed shift
        res = await db.execute(
            select(Shift)
            .where(Shift.is_closed == True, Shift.deleted_at.is_(None))
            .order_by(Shift.end_time.desc())
        )
        last_shift = res.scalars().first()
        if not last_shift:
            raise HTTPException(status_code=404, detail="No closed shifts found")

        return {
            "type": "Z-Report",
            "shift_id": last_shift.id,
            "total_cash": last_shift.total_cash,
            "total_card": last_shift.total_card,
            "total_transfer": last_shift.total_transfer,
            "total_income": last_shift.total_cash
            + last_shift.total_card
            + last_shift.total_transfer,
            "closed_at": last_shift.end_time,
        }
    raise HTTPException(status_code=400, detail="Unknown report type")
