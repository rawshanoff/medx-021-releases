# MedX MVP (один ПК, localhost)

## Быстрый старт

1. Создайте `.env` в корне по примеру `.env.example`.
2. Создайте `frontend/.env` по примеру `frontend/.env.example`.
3. Сгенерируйте RSA‑ключи лицензирования (см. ниже).
4. Выполните миграции БД: `run_migrations.bat`.
5. Запустите всё: `start_all.bat` (или отдельно `start_backend.bat`, `start_license_server.bat`, `start_frontend.bat`).

## Требования

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- `pg_dump` в PATH
- OpenSSL в PATH

## Конфигурация (.env)

Минимально необходимо заполнить:

- `DATABASE_URL`
- `SECRET_KEY`
- `ADMIN_TOKEN`
- `PRIVATE_KEY_PATH`
- `LICENSE_PUBLIC_KEY_PATH`

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

```
pip install -r backend/requirements.txt
```

License server:

```
pip install -r license_server/requirements.txt
```

Frontend:

```
cd frontend
npm install
```

## Healthchecks

- Backend: `http://127.0.0.1:8000/health`
- License server: `http://127.0.0.1:8001/health`

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
