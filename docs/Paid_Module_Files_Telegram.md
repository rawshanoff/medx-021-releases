## Платный модуль: “Файлы результатов + Telegram пациентам”

Что даёт:\n
- хранение файлов (УЗИ/анализы/прочее) **локально**\n
- отправка файла пациенту в Telegram (требует интернет)\n
- привязка пациента к Telegram через одноразовый код\n

---

## Feature flags

- `files_results` — доступ к загрузке/просмотру файлов\n
- `telegram_patient` — доступ к отправке в Telegram\n

---

## Переменные окружения (backend)

- `FILE_STORAGE_DIR` — папка хранения файлов (по умолчанию `storage/patient_files`)\n
- `PATIENT_BOT_TOKEN` — токен Telegram‑бота пациента\n
- `PATIENT_BOT_INTERNAL_TOKEN` — секрет для связи бот→backend (header `x-bot-token`)\n

---

## Поток привязки пациента (MVP)

1) На ресепшне открывают “Файлы” пациента → жмут “Сгенерировать код привязки Telegram”.\n
2) Пациент в Telegram пишет вашему боту:\n
   `/start <код>`\n
3) Бот вызывает backend:\n
   `POST /api/files/telegram/link` с `x-bot-token` и телеграм chat_id.\n
4) Теперь клиника может отправлять файлы кнопкой “В Telegram”.\n

---

## Запуск patient-bot

Переменные окружения:\n
```bat
set PATIENT_BOT_TOKEN=123:ABC
set PATIENT_BOT_INTERNAL_TOKEN=CHANGE_ME
set BACKEND_URL=http://127.0.0.1:8000
```\n
Запуск:\n
```bat
.venv\\Scripts\\python scripts\\patient_telegram_bot.py
```\n

