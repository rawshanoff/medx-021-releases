# MedX MVP (один ПК, localhost)

> **🤖 Для разработчиков и Cursor Agent:** См. детальный план разработки → [`CURSOR_AGENT_PLAN.md`](./CURSOR_AGENT_PLAN.md)

## 🚀 Quick Start для MVP

### 1. Подготовка

```bash
# Установить зависимости
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# Создать .env файлы
cp .env.example .env
cp frontend/.env.example frontend/.env

# Отредактировать .env (заполнить DATABASE_URL, SECRET_KEY)
# Основное: DATABASE_URL должна указывать на запущенный PostgreSQL
```

### 2. Запуск всех компонентов (в разных терминалах)

```bash
# Терминал 1: Backend
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Терминал 2: Frontend
cd frontend
npm run dev

# Терминал 3: License Server (опционально)
cd license_server
python main.py
```

### 3. Применить миграции

```bash
cd backend
python -m alembic -c alembic.ini upgrade head
```

### 4. Проверить статус

```
✅ Backend: http://127.0.0.1:8000/docs (Swagger)
✅ Frontend: http://127.0.0.1:5173
✅ License Server: http://127.0.0.1:8001 (если запущен)
```

### 5. Логин

```
Username: admin
Password: admin123
```

---

## Быстрый старт (Батники для Windows)

## Требования

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- `pg_dump` в PATH (для бэкапов)
- OpenSSL в PATH (для лицензирования)

## Конфигурация (.env)

Минимально необходимо заполнить:

```bash
# Backend
DATABASE_URL=postgresql+asyncpg://user:password@127.0.0.1:5432/medx_db
SECRET_KEY=your-secret-key-here-min-32-chars-long-secure

# License
LICENSE_DEV_MODE=true  # для MVP (разработки)
# или укажите пути к ключам для production:
# PRIVATE_KEY_PATH=license_server/private_key.pem
# LICENSE_PUBLIC_KEY_PATH=license_server/public_key.pem
```

**Все переменные** в `.env.example`

## Генерация RSA‑ключей

Выполните в корне репозитория:

```
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out license_server/private_key.pem
openssl rsa -in license_server/private_key.pem -pubout -out license_server/public_key.pem
```

Альтернатива (если установлен `cryptography`):

```
python license_server/generate_keys.py
```

## Установка зависимостей

Backend:

```bash
cd backend
pip install -r requirements.txt
```

License server:

```bash
cd license_server
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
```

## 🧪 Тестирование (для MVP)

### Unit Tests

```bash
# Backend
pytest backend/tests/ -v

# Frontend
cd frontend
npm run test:run
```

### E2E Smoke Tests

```bash
cd frontend
npm run test:e2e
```

**Проверяет:**
- ✅ Login
- ✅ Add patient to queue
- ✅ Process payment
- ✅ Close shift
- ✅ Error handling
- ✅ Network retry

## Healthchecks

## Healthchecks

- Backend: `http://127.0.0.1:8000/docs` (Swagger docs)
- Backend health: `http://127.0.0.1:8000/health`
- Frontend: `http://127.0.0.1:5173`
- License server: `http://127.0.0.1:8001/health`

## MVP Features

✅ **Регистратура** (Reception)
- Поиск пациентов
- Создание новых пациентов
- Добавление в очередь (автогенерация талонов)
- Просмотр истории пациента

✅ **Касса** (Finance)
- Открытие смены
- Регистрация платежей (наличные/карта/смешанно)
- Добавление расходов
- Закрытие смены с отчётом

✅ **Управление** (System)
- Пациенты (CRUD)
- Врачи (CRUD)
- Системные настройки
- История изменений с откатом

✅ **Надёжность**
- Retry логика для сетевых ошибок
- Error handling везде
- Loading states
- Soft delete (данные не теряются)
- Аудит логирование

## Pre-launch Checklist

Перед запуском MVP смотри [`MVP_READY_CHECKLIST.md`](./docs/MVP_READY_CHECKLIST.md)

## Бэкапы Postgres

```
set DATABASE_URL=postgresql+asyncpg://postgres:PASS@127.0.0.1/medx_db
scripts\backup_postgres.bat
```

## Чек‑лист тестирования (регистратура / касса / отчёты)

1. Вход под администратором (создан миграцией `006_add_users`, пароль по умолчанию `admin123` — сменить).
2. Регистратура:
   - создать пациента
   - поиск пациента по ФИО/телефону
   - добавить в очередь (талон)
   - создать запись к врачу
3. Касса:
   - открыть смену
   - провести оплату (нал/карта/смешанная)
   - закрыть смену
4. Отчёты:
   - X‑отчёт (по активной смене)
   - Z‑отчёт (по последней закрытой смене)
