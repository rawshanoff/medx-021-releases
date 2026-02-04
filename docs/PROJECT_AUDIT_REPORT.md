# 🔧 MedX MVP - Backend Audit Report (38 issues) — актуализировано

**Audit Date:** 2026-02-04  
**Last Updated:** 2026-02-04  
**Scope:** Backend (FastAPI / SQLAlchemy / Pydantic)  

> Этот файл **восстановлен/создан заново**, потому что на него ссылаются `EXECUTIVE_BRIEF.md`, `INDEX.md`, `AUDIT_README.md`, `AUDIT_SUMMARY.md`.
> Ранее он отсутствовал в `docs/`.

---

## ✅ Критические пункты (из аудита) — статус

- ✅ `backend/core/licenses.py`: `print()` заменён на `logger.warning()` (ошибка лицензии больше не теряется в production).
- ✅ `backend/modules/doctors/schemas.py`: добавлена валидация `DoctorBase.full_name` (strip + non-empty).

---

## ✅ High priority (ошибки “тихих” except/логирование) — статус

- ✅ `backend/modules/patients/router.py`: парсинг `birth_date` больше не “тихий” — возвращает **400** + debug‑лог.
- ✅ `backend/modules/patients/router.py`: best‑effort блоки в `deduplicate` теперь логируются (files module / deleted_at).
- ✅ `backend/modules/finance/router.py`: advisory lock best‑effort теперь логируется debug.
- ✅ `backend/modules/finance/router.py`: idempotency `IntegrityError` теперь имеет debug‑лог (race‑condition).
- ✅ `backend/core/config.py`: `_load_version()` больше не “немой” (debug‑логи проб VERSION).
- ✅ `backend/core/update_artifacts.py`: финальный fallback cleanup больше не “немой” (debug‑лог).

---

## ✅ Консистентность / совместимость

- ✅ `backend/core/updater.py`: добавлен алиас `download_update()` → `spawn_update_process()` (совместимость с тестами/доками).
- ✅ `backend/modules/users/schemas.py`: добавлен алиас `UserRead = UserResponse`.

---

## ✅ Технический долг, который мешал релизу (deprecations)

- ✅ Pydantic v2: `class Config` → `ConfigDict(from_attributes=True)` (в основных схемах).
- ✅ FastAPI: `@app.on_event("startup")` → `lifespan` (`backend/main.py`).

---

## 🧪 Проверка

- ✅ `python -m pytest -q backend/tests/audit_smoke_test.py` → `10 passed`

---

## 📌 Оставшиеся рекомендации (не блокер релиза)

Эти пункты не считаются “критическими ошибками”, но полезны для качества:
- Довести логирование до единого стандарта `medx.*` (неймспейсы логгеров).
- Уточнить модель данных appointments (enum‑статусы в БД / единый источник истины).
- Расширить тесты на негативные кейсы (400/403/409).

