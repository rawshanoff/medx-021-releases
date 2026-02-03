import logging
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
    ReceiptRead,
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
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter()
logger = logging.getLogger("medx")


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
    """Check if Finance module is licensed.

    Raises HTTPException if finance features are not activated.
    Finance requires either FEATURE_FINANCE_BASIC or FEATURE_CORE license.
    """
    features = license_manager.get_active_features()
    if FEATURE_FINANCE_BASIC not in features and FEATURE_CORE not in features:
        raise HTTPException(
            status_code=403,
            detail="Finance module not active. Please upgrade your license.",
        )


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
    """Close current shift and verify totals match transactions."""
    await check_finance_license()
    await _acquire_shift_lock(db)
    result = await db.execute(
        select(Shift).where(Shift.is_closed == False, Shift.deleted_at.is_(None))
    )
    shift = result.scalars().first()
    if not shift:
        raise HTTPException(status_code=400, detail="No open shift found")

    # Calculate running totals from transactions for verification
    cash_result = await db.execute(
        select(func.sum(Transaction.cash_amount)).where(
            Transaction.shift_id == shift.id,
            Transaction.payment_method == PaymentMethod.MIXED,
            Transaction.deleted_at.is_(None),
        )
    )
    mixed_cash = cash_result.scalar() or 0

    card_result = await db.execute(
        select(func.sum(Transaction.card_amount)).where(
            Transaction.shift_id == shift.id,
            Transaction.payment_method == PaymentMethod.MIXED,
            Transaction.deleted_at.is_(None),
        )
    )
    mixed_card = card_result.scalar() or 0

    transfer_result = await db.execute(
        select(func.sum(Transaction.transfer_amount)).where(
            Transaction.shift_id == shift.id,
            Transaction.payment_method == PaymentMethod.MIXED,
            Transaction.deleted_at.is_(None),
        )
    )
    mixed_transfer = transfer_result.scalar() or 0

    # Calculate totals for non-mixed payments
    cash_tx_result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.shift_id == shift.id,
            Transaction.payment_method == PaymentMethod.CASH,
            Transaction.deleted_at.is_(None),
        )
    )
    cash_total = (cash_tx_result.scalar() or 0) + mixed_cash

    card_tx_result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.shift_id == shift.id,
            Transaction.payment_method == PaymentMethod.CARD,
            Transaction.deleted_at.is_(None),
        )
    )
    card_total = (card_tx_result.scalar() or 0) + mixed_card

    transfer_tx_result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.shift_id == shift.id,
            Transaction.payment_method == PaymentMethod.TRANSFER,
            Transaction.deleted_at.is_(None),
        )
    )
    transfer_total = (transfer_tx_result.scalar() or 0) + mixed_transfer

    # Verify stored totals match calculated
    if (
        shift.total_cash != cash_total
        or shift.total_card != card_total
        or shift.total_transfer != transfer_total
    ):
        logger.error(
            f"Shift #{shift.id} total mismatch on close! "
            f"Stored: cash={shift.total_cash}, card={shift.total_card}, transfer={shift.total_transfer} "
            f"Calculated: cash={cash_total}, card={card_total}, transfer={transfer_total}"
        )
        raise HTTPException(
            status_code=400,
            detail="Shift totals do not match transactions. Contact support.",
        )

    shift.is_closed = True
    shift.end_time = datetime.now(timezone.utc)

    await _audit(
        db,
        user,
        "shift_close",
        f"shift_id={shift.id}, total_cash={shift.total_cash}, total_card={shift.total_card}, total_transfer={shift.total_transfer}",
    )
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
    logger.info(f"Processing payment: {tx.model_dump()}, user: {user.id}")
    await check_finance_license()
    await _acquire_shift_lock(db)

    # Idempotency check
    if tx.idempotency_key:
        existing = await db.execute(
            select(Transaction).where(
                Transaction.idempotency_key == tx.idempotency_key,
                Transaction.deleted_at.is_(None),
            )
        )
        if found := existing.scalars().first():
            logger.info(f"Idempotent hit: {tx.idempotency_key}")
            return found

    # Validate amount is within limits
    if abs(tx.amount) > 10_000_000:
        raise HTTPException(
            status_code=400,
            detail="Transaction amount exceeds maximum limit of 10,000,000",
        )

    # Требуем описание для отрицательных сумм (расход/возврат)
    if tx.amount < 0 and not (tx.description and tx.description.strip()):
        raise HTTPException(
            status_code=400, detail="Description is required for negative transactions"
        )

    # Find current shift
    # Lock active shift row to prevent race conditions on running totals.
    # We still perform atomic UPDATE on totals, but the lock guarantees a single active shift is used consistently.
    logger.info("Looking for open shift")
    result = await db.execute(
        select(Shift)
        .where(Shift.is_closed == False, Shift.deleted_at.is_(None))
        .with_for_update()
    )
    shift = result.scalars().first()
    logger.info(f"Found shift: {shift}")
    if not shift:
        logger.warning("No open shift found")
        raise HTTPException(
            status_code=400, detail="No open shift. Open a shift first."
        )

    logger.info(f"Creating transaction with shift_id: {shift.id}")
    new_tx = Transaction(shift_id=shift.id, **tx.model_dump())
    logger.info(f"Transaction created: {new_tx.id}")

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
    logger.info(
        f"Deltas: cash={delta_cash}, card={delta_card}, transfer={delta_transfer}"
    )

    db.add(new_tx)
    await db.flush()
    logger.info("Transaction flushed")

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
    logger.info("Shift updated")

    await _audit(
        db,
        user,
        "transaction",
        f"tx_id={new_tx.id}, amount={tx.amount}, method={tx.payment_method}, patient_id={tx.patient_id}",
    )
    try:
        await db.commit()
    except IntegrityError:
        # Most likely a concurrent duplicate idempotency_key.
        await db.rollback()
        if tx.idempotency_key:
            existing = await db.execute(
                select(Transaction).where(
                    Transaction.idempotency_key == tx.idempotency_key,
                    Transaction.deleted_at.is_(None),
                )
            )
            if found := existing.scalars().first():
                logger.info(f"Idempotent race hit: {tx.idempotency_key}")
                return found
        raise

    logger.info("Transaction committed")
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
        related_transaction_id=original_tx.id,
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
    await _audit(
        db,
        user,
        "refund_payment",
        f"Refunded TX #{original_tx.id} for {abs(original_tx.amount)} (reason: {reason})",
    )
    await db.commit()
    await db.refresh(refund_tx)

    return refund_tx


@router.get("/receipt/{transaction_id}", response_model=ReceiptRead)
async def get_receipt_data(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    ),
):
    """Get receipt data for printing by transaction ID."""
    await check_finance_license()

    # Get transaction with related data
    result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.patient),
        )
        .where(Transaction.id == transaction_id, Transaction.deleted_at.is_(None))
    )
    tx = result.scalars().first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not tx.patient:
        raise HTTPException(status_code=404, detail="Patient data not found")

    # Get queue item for ticket number
    from backend.modules.reception.models import QueueItem

    queue_result = await db.execute(
        select(QueueItem)
        .options(selectinload(QueueItem.doctor))
        .where(
            QueueItem.patient_id == tx.patient_id,
            QueueItem.created_at <= tx.created_at,
            QueueItem.deleted_at.is_(None),
        )
        .order_by(QueueItem.created_at.desc())
        .limit(1)
    )
    queue_item = queue_result.scalars().first()

    ticket_number = queue_item.ticket_number if queue_item else "N/A"
    service_name = tx.doctor_id or "Consultation"  # Fallback if no specific service

    # Payment breakdown for mixed payments
    payment_breakdown = None
    if tx.payment_method == PaymentMethod.MIXED:
        payment_breakdown = {}
        if tx.cash_amount:
            payment_breakdown["cash"] = tx.cash_amount
        if tx.card_amount:
            payment_breakdown["card"] = tx.card_amount
        if tx.transfer_amount:
            payment_breakdown["transfer"] = tx.transfer_amount

    return ReceiptRead(
        receipt_no=f"TX-{tx.id}",
        ticket=ticket_number,
        created_at_iso=tx.created_at.isoformat(),
        patient_name=tx.patient.full_name,
        service_name=service_name,
        amount=tx.amount,
        currency="UZS",  # Assuming Uzbek Som as default
        payment_method=tx.payment_method,
        payment_breakdown=payment_breakdown,
    )


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


@router.get("/recent-transactions", response_model=list[TransactionRead])
async def get_recent_transactions(
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER)),
):
    """Get recent transactions for current shift or last transactions"""
    # Get current active shift
    shift_res = await db.execute(
        select(Shift).where(Shift.is_closed == False, Shift.deleted_at.is_(None))
    )
    active_shift = shift_res.scalars().first()

    if active_shift:
        # Get transactions for active shift
        res = await db.execute(
            select(Transaction)
            .where(Transaction.shift_id == active_shift.id)
            .order_by(Transaction.created_at.desc())
            .limit(limit)
        )
    else:
        # Get last transactions regardless of shift
        res = await db.execute(
            select(Transaction).order_by(Transaction.created_at.desc()).limit(limit)
        )

    transactions = res.scalars().all()

    return transactions
