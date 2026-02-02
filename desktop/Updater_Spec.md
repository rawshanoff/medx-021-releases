## Updater (Enterprise): спецификация и формат обновления

Цель: обновлять MedX без потери данных.\n

---

## High-level flow
1) приложение проверяет `latest.json` (версия, URL, sha256)\n
2) скачивает `update.zip`\n
3) проверяет sha256\n
4) делает бэкап БД (и/или каталога приложения)\n
5) останавливает процессы backend/license_server\n
6) запускает `scripts/updater.py --pid <PID> --zip update.zip --app-dir <root>`\n
7) `updater.py`:\n
   - бэкапит ключевые директории\n
   - распаковывает и заменяет `backend/`, `license_server/`, `scripts/`, `frontend/dist/`\n
   - выполняет `alembic upgrade head`\n
   - при ошибке откатывает из бэкапа\n
8) приложение перезапускается\n

---

## Формат update.zip
Архив должен содержать:\n
- `backend/`\n
- `license_server/`\n
- `scripts/`\n
- `frontend/dist/`\n

---

## Что важно для безопасности
- приватные ключи и `.env` не должны попадать в архив\n
- перед заменой файлов — всегда бэкап\n
- миграции только forward-compatible\n

