# 🧠 Аудит Бизнес-Логики и Целостности Данных

**Дата:** 4 февраля 2026  
**Аудитор:** Senior Backend Architect & QA Engineer  
**Статус:** 🔴 **CRITICAL** (Выявлены уязвимости в логике операций с деньгами)

---

## 📋 Резюме (Executive Summary)

В ходе параноидного аудита бизнес-логики системы MedX выявлены **критические уязвимости**, связанные с целостностью финансовых данных и race conditions. Основная проблема: **система позволяет создать отрицательный баланс кассы** и не имеет полной валидации смешанных платежей.

| Категория | Кол-во | Серьезность |
|-----------|--------|-------------|
| **Критические уязвимости** | 3 | 🔴 CRITICAL |
| **Высокие риски** | 5 | 🟠 HIGH |
| **Средние проблемы** | 4 | 🟡 MEDIUM |
| **Низкие проблемы** | 2 | 🟢 LOW |
| **ИТОГО** | **14** | Mixed |

---

## 🔴 1. КРИТИЧЕСКИЕ УЯЗВИМОСТИ ЛОГИКИ

### 1.1 Баланс кассы уходит в минус (NEGATIVE CASH BALANCE)

**Где:** `backend/modules/finance/models.py`, `backend/modules/finance/router.py`

**Проблема:**
```python
# Нет валидации на отрицательный баланс!
shift.total_cash = 1000 - 1500  # = -500 ✗ ALLOWED!
```

**Сценарий атаки:**
1. Смена открыта с `total_cash = 0`
2. Добавлен платеж 1000 руб (cash)
3. Добавлен возврат 1500 руб (отрицательная транзакция)
4. `total_cash` становится **-500** (ПОТЕРЯ ДЕНЕГ!)

**Текущий код:**
```python
# In router.py lines 283-297
delta_cash = int(tx.cash_amount) if tx.payment_method == PaymentMethod.MIXED \
             else (int(tx.amount) if tx.payment_method == PaymentMethod.CASH else 0)

# Прямое обновление без проверки:
shift.total_cash += delta_cash  # ← БЕЗ ПРОВЕРКИ!
```

**Тест:** `test_negative_balance_prevention` - **FAILED** ❌

**Решение (Robust):**
```python
# Вариант 1: Constraint в БД (BEST)
# ALTER TABLE shifts ADD CONSTRAINT check_totals 
# CHECK (total_cash >= 0 AND total_card >= 0 AND total_transfer >= 0);

# Вариант 2: Валидация в коде (FALLBACK)
if shift.total_cash < 0 or shift.total_card < 0 or shift.total_transfer < 0:
    raise HTTPException(
        status_code=400, 
        detail="Transaction would result in negative balance"
    )
```

**Impact:** 🔴 **CRITICAL** - Потеря денег, аудит-триал неверен

---

### 1.2 MIXED платежи не валидируют компоненты

**Где:** `backend/modules/finance/router.py:283-297`

**Проблема:**
Когда платеж содержит `MIXED` метод, компоненты (`cash_amount + card_amount + transfer_amount`) могут **не совпадать с `amount`**:

```python
# Возможно создать:
Transaction(
    amount=1000,              # Всего 1000
    payment_method="MIXED",
    cash_amount=600,          # Наличные
    card_amount=600,          # Карта
    transfer_amount=600,      # Перевод
    # Итого: 600+600+600 = 1800 > 1000! ✗
)
```

**Текущий код не имеет проверки:**
```python
# В router.py нет валидации типа:
if tx.payment_method == PaymentMethod.MIXED:
    total = tx.cash_amount + tx.card_amount + tx.transfer_amount
    if total != tx.amount:
        # VALIDATION MISSING! ✗
```

**Решение:**
```python
@router.post("/transactions")
async def process_payment(tx: TransactionCreate, ...):
    if tx.payment_method == PaymentMethod.MIXED:
        component_total = (
            (tx.cash_amount or 0) + 
            (tx.card_amount or 0) + 
            (tx.transfer_amount or 0)
        )
        if component_total != tx.amount:
            raise HTTPException(
                status_code=400,
                detail=f"Mixed payment components ({component_total}) must equal total ({tx.amount})"
            )
```

**Impact:** 🔴 **CRITICAL** - Отчеты по платежам неверны, потеря денег

---

### 1.3 Totals Mismatch на закрытии смены

**Где:** `backend/modules/finance/router.py:194-208`

**Проблема:**
Система вычисляет `shift.total_cash/card/transfer` во время закрытия и сравнивает с сохраненными значениями. Но:

1. **Если базу испортить между платежом и закрытием**, проверка не поймет ошибку
2. **Race condition:** Платеж может быть добавлен после проверки, но до commit

**Уязвимый код:**
```python
# lines 194-208: Close shift verification
if (shift.total_cash != cash_total or ...):
    raise HTTPException(status_code=400, ...)

# Но это ПОСЛЕ того, как мы уже обновили totals!
# Если между process_payment() и close_shift() база изменится -> проблема
```

**Сценарий:**
1. Платеж добавляет 1000 руб → `shift.total_cash = 1000`
2. Кто-то обновляет БД напрямую: `shift.total_cash = 999`
3. Close shift вычислит 1000 из транзакций, но скажет "Mismatch!"
4. Смена не закроется, деньги "потеряны" в открытой смене

**Решение:**
```python
# Использовать transactions с SERIALIZABLE isolation level
# или добавить version control:

class Shift:
    version = Column(Integer, default=1)  # Для оптимистической блокировки

# Перед commit проверить:
if shift.version != expected_version:
    raise HTTPException(status_code=409, detail="Concurrent modification")
    shift.version += 1
```

**Impact:** 🔴 **CRITICAL** - Невозможно закрыть смену, финансовые данные зависают

---

## 🟠 2. ВЫСОКИЕ РИСКИ

### 2.1 Orphaned Records: Удаленный врач в очереди

**Где:** `backend/modules/doctors/router.py`, `backend/modules/reception/router.py`

**Проблема:**
```python
# В Archive.tsx пользователь может удалить врача:
doctor.deleted_at = datetime.now(timezone.utc)

# Но QueueItem все еще ссылается на этого врача:
QueueItem.doctor_id = 5  # Врач ID 5 удален!
```

**Последствия:**
- UI покажет "Unknown" врача
- Отчеты будут неполными
- История потеряется

**Решение (Cascade Delete):**
```python
# В models.py Doctor:
class Doctor(Base):
    __tablename__ = "doctors"
    queue_items = relationship("QueueItem", cascade="soft-delete")

# Или в schemas:
@router.post("/{doctor_id}/delete")
async def delete_doctor(...):
    # Soft delete всех queue items
    queue_items = await db.execute(
        select(QueueItem).where(QueueItem.doctor_id == doctor_id)
    )
    for item in queue_items.scalars().all():
        item.deleted_at = now()
    
    doctor.deleted_at = now()
    await db.commit()
```

**Impact:** 🟠 **HIGH** - Потеря историиданных, неправильные отчеты

---

### 2.2 Patient Deletion с Active Transactions

**Где:** `backend/modules/patients/router.py`

**Проблема:**
Пациент может быть удален (soft delete), но его транзакции остаются в системе:

```python
patient.deleted_at = now()  # Soft delete

# Но Transaction.patient_id все еще = patient.id
# Финансовые отчеты потеряют связь с пациентом
```

**Решение:**
```python
@router.post("/{patient_id}/delete")
async def delete_patient(...):
    # Cascade delete на транзакции/очередь
    await db.execute(
        update(Transaction)
        .where(Transaction.patient_id == patient_id)
        .values(deleted_at=now())
    )
    
    await db.execute(
        update(QueueItem)
        .where(QueueItem.patient_id == patient_id)
        .values(deleted_at=now())
    )
    
    patient.deleted_at = now()
    await db.commit()
```

**Impact:** 🟠 **HIGH** - Неполные финансовые отчеты

---

### 2.3 Zero-Amount Transactions

**Где:** `backend/modules/finance/router.py:248-259`

**Проблема:**
```python
# Нет проверки на нулевую сумму!
Transaction(
    amount=0,
    payment_method=PaymentMethod.CASH,
)
# Создается пустая транзакция
```

**Решение:**
```python
if abs(tx.amount) < 1:  # Минимум 1 (в копейках)
    raise HTTPException(
        status_code=400,
        detail="Transaction amount must be at least 1"
    )
```

**Impact:** 🟠 **HIGH** - Аудит-логи загрязнены, отчеты неверны

---

### 2.4 Idempotency Key не уникален между сменами

**Где:** `backend/modules/finance/models.py:49`

**Проблема:**
```python
idempotency_key = Column(String, unique=True, index=True, nullable=True)
# ✓ Уникален ГЛОБАЛЬНО

# Но сценарий:
# Смена 1: Платеж 1000 с ключом "PAY-123"
# Смена 2: Повторная попытка с ключом "PAY-123"
#         → Вернет транзакцию из СМЕНЫ 1! ✗
```

**Решение:**
```python
# Уникальность должна быть composite:
__table_args__ = (
    UniqueConstraint('shift_id', 'idempotency_key', name='uq_shift_idempotency'),
)

# Или проверить в коде:
if tx.idempotency_key:
    existing = await db.execute(
        select(Transaction).where(
            Transaction.shift_id == shift.id,  # ← ВА ЖЮ!
            Transaction.idempotency_key == tx.idempotency_key,
            Transaction.deleted_at.is_(None),
        )
    )
```

**Impact:** 🟠 **HIGH** - Дублирование платежей между сменами

---

## 🟡 3. СРЕДНИЕ ПРОБЛЕМЫ

### 3.1 Empty Queue Item Data

**Где:** `backend/modules/reception/router.py:22-75`

**Проблема:**
```python
QueueItem(
    doctor_id=1,
    patient_id=1,
    ticket_number="A-001",
    status="WAITING",
    # patient_name МОЖЕТ БЫТЬ NULL!
)
```

**Решение:**
```python
if not item.patient_name or not item.patient_name.strip():
    raise HTTPException(
        status_code=400,
        detail="Patient name is required"
    )
```

**Impact:** 🟡 **MEDIUM** - UI покажет "Unknown", пользователь не поймет кто в очереди

---

### 3.2 Negative Components in Mixed Payment

**Где:** `backend/modules/finance/models.py:44-46`

**Проблема:**
```python
Transaction(
    amount=1000,
    payment_method="MIXED",
    cash_amount=-200,    # ✗ Отрицательная наличность?
    card_amount=700,
    transfer_amount=500,
)
```

**Решение:**
```python
for field in ['cash_amount', 'card_amount', 'transfer_amount']:
    value = getattr(tx, field, 0) or 0
    if value < 0:
        raise HTTPException(
            status_code=400,
            detail=f"{field} cannot be negative"
        )
```

**Impact:** 🟡 **MEDIUM** - Отчеты перепутаны

---

### 3.3 Advisory Lock Best-Effort (SQLite)

**Где:** `backend/modules/finance/router.py:37-47`

**Проблема:**
```python
async def _acquire_shift_lock(db: AsyncSession):
    try:
        await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": 21_001})
    except Exception:
        logger.debug("Advisory shift lock unavailable", exc_info=True)
        return  # ← CONTINUE WITHOUT LOCK!
```

**На SQLite это lock не работает** → Race conditions не предотвращены!

**Решение:**
```python
# Использовать Postgres-специфичный код:
# 1. Check DB type before lock
# 2. Или использовать application-level lock (mutex)
# 3. Или требовать Postgres для production

if settings.DATABASE_URL.startswith("postgresql"):
    await db.execute(...)
else:
    logger.warning("Advisory locks not supported on SQLite!")
```

**Impact:** 🟡 **MEDIUM** - Race conditions в dev/test окружении

---

### 3.4 No Validation of Shift totals Before Processing Payment

**Где:** `backend/modules/finance/router.py:224-341`

**Проблема:**
```python
# Payment может быть обработан без проверки, что shift totals хоть как-то верны
# Если смена была испорчена, мы добавим еще ошибок

# SHOULD CHECK:
cash_total = sum(t.cash_amount for t in shift.transactions)
if shift.total_cash != cash_total:
    raise HTTPException("Shift is corrupted, cannot process payment")
```

**Impact:** 🟡 **MEDIUM** - Накопление ошибок

---

## 🟢 4. НИЗКИЕ ПРОБЛЕМЫ

### 4.1 No Validation of Queue Sequence Uniqueness

**Где:** `backend/modules/reception/router.py:46-74`

**Проблема:**
Race condition: две запросы получают `next_seq = 1`, обе пытаются создать `A-001`

**Текущее решение:** Retry loop (хорошо), но можно улучшить с DB-level constraint

**Решение:**
```python
# В миграции:
# ALTER TABLE queue_items ADD CONSTRAINT 
# UNIQUE(doctor_id, queue_date, sequence)
```

**Impact:** 🟢 **LOW** - Уже обработано retry logic

---

### 4.2 Audit Log Loss on Transaction Failure

**Где:** `backend/modules/finance/router.py:110-115`

**Проблема:**
```python
new_shift = Shift(...)
db.add(new_shift)
await db.flush()

await _audit(db, user, "shift_open", ...)  # ← ЧТО ЕСЛИ КОММИТ УПАДЕТ?
# Audit не будет залогирован!

await db.commit()
```

**Решение:**
```python
try:
    await db.commit()
    await _audit(db, user, "shift_open", ...)  # ← После успеха
    await db.commit()
except Exception:
    raise
```

**Impact:** 🟢 **LOW** - Неполный аудит-логирование

---

## 💡 5. АРХИТЕКТУРНЫЕ РЕКОМЕНДАЦИИ

### 5.1 Unit of Work Pattern

**Текущее состояние:** ⚠️ Частичное использование

**Рекомендация:**
```python
class UnitOfWork:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._pending_audits = []
    
    async def process_payment(self, tx: TransactionCreate, shift_id: int):
        """
        Атомарная операция:
        1. Валидация
        2. Обновление shift totals (atomic SQL)
        3. Создание транзакции
        4. Логирование аудита
        5. Commit всех или rollback всех
        """
        async with self.db.begin_nested():
            # Validate
            # Update shift
            # Create tx
            # Append audit
            pass
    
    async def commit(self):
        await self.db.commit()
```

---

### 5.2 Strict Type Checking for Financial Fields

**Текущее состояние:**
```python
amount = Column(Integer, default=0)  # ✓ Integer (копейки)
```

**Рекомендация:**
```python
# Использовать Decimal для денег:
amount = Column(Numeric(15,2), nullable=False)  # BETTER
# Или Integer с явным ограничением >= 0
amount = Column(Integer, CheckConstraint('amount >= 0'))
```

---

### 5.3 Temporal Auditing

**Сейчас:** Basic audit log в `finance_audit_log`

**Рекомендация:**
```python
# Event Sourcing для финансовых операций:
class FinanceEvent(Base):
    __tablename__ = "finance_events"
    
    id = Column(Integer, primary_key=True)
    aggregate_id = Column(Integer, ForeignKey("shifts.id"))  # shift_id
    event_type = Column(String)  # "payment_added", "shift_closed"
    event_data = Column(JSON)    # Full transaction data
    timestamp = Column(DateTime, default=now)
    
    # Позволяет replaying истории и полного аудита
```

---

### 5.4 Concurrency Control Strategy

**Текущее:** Advisory locks (Postgres-specific)

**Рекомендация (Layered):**
```
Layer 1: Database Constraints
    - UNIQUE constraints
    - CHECK constraints
    - Foreign Keys
    
Layer 2: Application Locks
    - Optimistic: version field + conflict detection
    - Pessimistic: SELECT ... FOR UPDATE
    
Layer 3: Idempotency
    - Idempotency keys for retries
    - Exactly-once semantics
```

---

## 📊 Таблица Рисков

| Уязвимость | Вероятность | Воздействие | Серьезность | Усилие | Приоритет |
|-----------|------------|-----------|-----------|--------|----------|
| Negative Balance | 🔴 HIGH | 🔴 CRITICAL | **CRITICAL** | 2h | 🔴 NOW |
| Mixed Validation | 🔴 HIGH | 🔴 CRITICAL | **CRITICAL** | 1h | 🔴 NOW |
| Totals Mismatch | 🟠 MED | 🔴 CRITICAL | **CRITICAL** | 3h | 🔴 NOW |
| Orphaned Doctor | 🟠 MED | 🟠 HIGH | HIGH | 1.5h | 🟠 THIS WEEK |
| Patient Cascade | 🟠 MED | 🟠 HIGH | HIGH | 1.5h | 🟠 THIS WEEK |
| Zero Amount | 🟡 LOW | 🟠 HIGH | HIGH | 0.5h | 🟠 THIS WEEK |
| Idempotency Scope | 🟡 LOW | 🟠 HIGH | HIGH | 1h | 🟠 THIS WEEK |
| Other issues | 🟢 VERY LOW | 🟡 MEDIUM | MEDIUM | Various | 🟡 LATER |

---

## 🔧 Checklists и Action Items

### CRITICAL (Исправить ДО релиза - 6 часов)

- [ ] **Negative Balance**: Добавить DB constraint + code validation
  - [ ] Add CHECK constraint на Shift totals
  - [ ] Validate в `process_payment()` перед update
  - [ ] Test: `test_negative_balance_prevention` must PASS
  
- [ ] **Mixed Payment Validation**: Проверить компоненты
  - [ ] Add validation logic
  - [ ] Update schema с явным ограничением
  - [ ] Test: `test_mixed_payment_validation` must PASS

- [ ] **Totals Mismatch**: Добавить version control или optimistic locking
  - [ ] Add version field к Shift
  - [ ] Implement conflict detection
  - [ ] Update `close_shift()` logic

### HIGH (Исправить в этой неделе - 4 часа)

- [ ] Orphaned Doctor: Cascade delete queue items
- [ ] Patient Cascade: Cascade delete transactions
- [ ] Zero Amount: Валидация  в схеме
- [ ] Idempotency: Составной ключ (shift_id, idempotency_key)

### MEDIUM (Постоянное улучшение - 8+ часов)

- [ ] Implement Unit of Work pattern
- [ ] Add Event Sourcing для finance operations
- [ ] Strict Decimal types для денег
- [ ] Comprehensive integration tests

---

## ✅ Testing Strategy

### Unit Tests (Required)
```python
# backend/tests/test_finance_logic.py
def test_negative_balance_blocked():
    """Попытка создать negative balance должна fail"""
    
def test_mixed_payment_validation():
    """Components должны совпадать с total"""
    
def test_orphaned_records():
    """Cascade delete проверяются"""
```

### Integration Tests (Required)
```python
# backend/tests/integration/test_full_shift_cycle.py
async def test_shift_full_cycle():
    """
    1. Open shift
    2. Add multiple payments
    3. Verify totals
    4. Close shift
    5. Verify audit log
    """
```

### Stress Tests (Recommended)
```python
# backend/tests/stress_test.py
async def test_concurrent_payments():
    """100 одновременных платежей - должны быть обработаны корректно"""
```

---

## 📋 Summary Sheet

### Текущее состояние
- ✅ Базовая функциональность работает
- ✅ Есть аудит-логирование
- ✅ Есть soft-delete для данных
- ❌ **Нет защиты от negative balance**
- ❌ **Нет полной валидации MIXED платежей**
- ❌ **Orphaned records возможны**
- ⚠️ Race conditions на SQLite

### Требуемые изменения
1. **Database Layer**: Constraints для финансовых полей
2. **Application Layer**: Строгая валидация перед write
3. **Testing Layer**: Stress tests for concurrency
4. **Architecture**: Unit of Work, Event Sourcing (future)

### Ожидаемый результат после исправлений
- ✅ Negative balance blocked
- ✅데이터 integrity guaranteed
- ✅ Orphaned records prevented
- ✅ Idempotency working correctly
- ✅ Full audit trail available

---

## 📚 Документы для Разработчиков

### Для Backend Team
1. Создать test file: `backend/tests/test_finance_logic.py`
2. Обновить моделис constraints
3. Обновить router с валидацией
4. Запустить `pytest backend/tests/ -v`

### Для Database Team
1. Создать миграцию с CHECK constraints
2. Добавить индексы для query optimization
3. Обновить реplication rules

### Для QA Team
1. Создать test cases для negative balance scenarios
2. Stress test с concurrent operations
3. Validatio test для mixed payments

---

**Дата отчета:** 4 февраля 2026  
**Статус:** 🔴 **REQUIRES IMMEDIATE ACTION**  
**Next Review:** После внесения критических исправлений

---

**Отчет подготовлен:** Senior Backend Architect & QA Engineer  
**Распространение:** Development Team, QA Team, Tech Lead, Product Manager
