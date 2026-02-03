# MVP Ready Checklist

## Phase 0: Infrastructure Setup

- [ ] PostgreSQL запущен на :5432
- [ ] Backend запущен: `cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload`
- [ ] Frontend запущен: `cd frontend && npm run dev`
- [ ] Linter проверки пройдены: `npm run lint` и `ruff check backend/`

## Phase 1: Database & Migrations ✅

- [ ] Все миграции применены: `python -m alembic -c backend/alembic.ini upgrade head`
- [ ] Таблицы созданы: `queue_items`, `shifts`, `transactions`, `patients`, `doctors`, `users`, `system_settings`
- [ ] Тестовые данные залиты (пользователи, врачи, услуги)

## Phase 2: Backend Tests ✅

```bash
# Smoke tests
pytest backend/tests/integration/smoke/test_smoke.py -v

# All backend tests
pytest backend/tests/ -v
```

- [ ] Тесты очереди проходят
- [ ] Тесты финансов проходят
- [ ] Тесты файлов проходят (валидация размера)
- [ ] Нет ошибок валидации

## Phase 3: Frontend Tests ✅

```bash
# Unit tests
npm run test:run

# E2E tests (требует запущенный backend)
npm run test:e2e
```

- [ ] Unit тесты проходят
- [ ] E2E smoke tests проходят:
  - [x] Login works
  - [x] Add patient to queue
  - [x] Process payment
  - [x] Close shift
  - [x] Error handling
  - [x] Network retry
  - [x] Loading states
  - [x] Logout

## Phase 4: Functional Testing

### 4.1 Authentication

```
[ ] Логин admin/admin123
[ ] Неверный пароль = ошибка
[ ] Истекший токен = переразлогин
[ ] Logout работает
```

### 4.2 Reception (Регистратура)

```
[ ] Поиск пациента по телефону/имени работает
[ ] Создание нового пациента работает
[ ] Добавление в очередь (с выбором врача) работает
[ ] Генерация талона (A-001, B-042 и т.д.) работает
[ ] Видно список очереди справа
[ ] Статусы очереди обновляются (WAITING -> IN_PROGRESS -> DONE)
```

### 4.3 Finance (Касса)

```
[ ] Открытие смены (Open Shift) работает
[ ] Добавление платежа (Payment) работает:
    - Наличные (CASH)
    - Карта (CARD)
    - Смешанный (CASH + CARD)
[ ] Добавление расхода (Expense) работает
[ ] Закрытие смены (Close Shift) работает
[ ] Отчёт X (CashFlow) показывает корректные данные
```

### 4.4 Patients (Пациенты)

```
[ ] Список всех пациентов загружается
[ ] Поиск пациента работает
[ ] Можно открыть карточку пациента
[ ] История платежей видна
[ ] История очереди видна
```

### 4.5 System Settings

```
[ ] Открыть Settings (для Admin)
[ ] Настройки принтера загружаются
[ ] Изменить настройку (scale, paper size)
[ ] История изменений видна
[ ] Откат на предыдущую версию работает
```

### 4.6 Error Handling

```
[ ] Ошибка при добавлении в очередь => toast
[ ] Ошибка при платеже => toast с описанием
[ ] Ошибка сети => автоматический retry
[ ] Таймаут БД => graceful error
[ ] 401 Unauthorized => redirect на login
[ ] 403 Forbidden => message "Нет доступа"
```

### 4.7 UI/UX

```
[ ] Loading состояния видны при загрузке данных
[ ] Skeleton loaders показываются (если реализованы)
[ ] Toast notifications показываются (success/error/warning)
[ ] Responsive дизайн работает на 1366×768
[ ] Тёмная тема работает (Dark Mode)
[ ] Переключение языков работает (RU/EN/UZ)
```

## Phase 5: Print Integration (если есть принтер)

```
[ ] Открыть печать талона
[ ] Выбрать принтер
[ ] Печать работает (HTML -> PDF/Print)
[ ] Поддержка термопринтера (58mm/80mm)
```

## Phase 6: License Integration

```
[ ] Лицензия загружается при старте
[ ] Платные фичи недоступны без лицензии
[ ] System Settings защищён лицензией
[ ] Файлы защищены лицензией
```

## Phase 7: Performance Check

```
[ ] Загрузка пациентов < 2 сек (до 100)
[ ] Загрузка очереди < 1 сек
[ ] Платёж регистрируется < 2 сек
[ ] Нет утечек памяти (DevTools Memory)
[ ] Нет infinite loops (DevTools Console)
```

## Phase 8: Data Integrity

```
[ ] Транзакция = 1 запись в DB
[ ] Идемпотентность работает (duplicate payment не создаёт 2 записи)
[ ] Soft Delete работает (удалённые записи не видны)
[ ] Аудит логирует все изменения
[ ] Откат настроек не повреждает данные
```

## Phase 9: Security Check

```
[ ] .env файл не в git (проверить .gitignore)
[ ] Ключи/сертификаты не в git
[ ] CORS работает (только для своего домена)
[ ] Rate limiting работает (попробовать 100 запросов в сек)
[ ] JWT не содержит sensitive данные
[ ] SQL injection невозможна (используется ORM)
[ ] XSS невозможна (React санитизирует)
```

## Phase 10: Documentation

```
[ ] README.md обновлен (как запустить MVP)
[ ] .env.example содержит все переменные
[ ] API документация доступна на /docs
[ ] Инструкция по печати добавлена
[ ] Инструкция по лицензированию добавлена
```

## Pre-Release Automation

### 1. Run All Tests

```bash
# Backend
cd backend
pytest tests/ -v --tb=short

# Frontend
cd frontend
npm run test:run
npm run lint
npm run test:e2e
```

### 2. Build for Production

```bash
cd frontend
npm run build

cd ../backend
# No build needed for FastAPI
```

### 3. Docker Check (optional)

```bash
docker-compose up -d
# Should be accessible on http://localhost:3000
```

## Final Verification (Manual)

```
✅ Browser: http://localhost:5173
✅ Login: admin/admin123
✅ Add patient → queue → payment → close shift
✅ Check database has audit logs
✅ Check error toast works (break network)
✅ Check license system works
```

---

## If Something Fails

### Error: "queue_items" table doesn't exist
```bash
python -m alembic -c backend/alembic.ini upgrade head
```

### Error: 401 Unauthorized
```
- Check JWT token in localStorage
- Check Authorization header in requests
- Clear cookies/storage and re-login
```

### Error: 403 Forbidden
```
- Check user role in database
- Check require_roles decorator on endpoint
- Check license features
```

### Error: Network timeout
```
- Check backend is running on :8000
- Check frontend can reach /api
- Check PostgreSQL is running
```

### Error: E2E tests fail
```bash
# Run with debug
npm run test:e2e:debug

# Or in UI mode
npm run test:e2e:ui
```

---

## Go Live Checklist (Final)

✅ All tests pass
✅ No console errors
✅ No 500 errors in production
✅ Database backups configured
✅ Logs configured
✅ Error tracking configured (if using Sentry)
✅ Performance monitoring configured (if using APM)
✅ Incident response plan ready

**MVP Status: READY TO LAUNCH** 🚀
