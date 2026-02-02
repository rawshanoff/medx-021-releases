## MedX — Бэкап и восстановление PostgreSQL (ядро офлайн)

Цель: чтобы при сбое ПК/диска/обновления вы **не потеряли данные клиники**.

---

## Backup (ежедневно)

1) Убедитесь, что `pg_dump` доступен в PATH (PostgreSQL установлен с client tools).\n
2) Задайте переменную окружения:

```bat
set DATABASE_URL=postgresql://postgres:YOUR_PASS@127.0.0.1/medx_db
```

3) Запустите:

```bat
scripts\\backup_postgres.bat
```

Результат: файл вида `backups\\medx_YYYYMMDD_HHMMSS.sql`.

---

## Restore (проверять хотя бы 1 раз перед пилотом)

Пример восстановления в новую базу (рекомендуется тестировать так):\n
1) Создайте пустую базу (например `medx_db_restore_test`).\n
2) Выполните:

```bat
psql "postgresql://postgres:YOUR_PASS@127.0.0.1/postgres" -c "DROP DATABASE IF EXISTS medx_db_restore_test;"
psql "postgresql://postgres:YOUR_PASS@127.0.0.1/postgres" -c "CREATE DATABASE medx_db_restore_test;"
psql "postgresql://postgres:YOUR_PASS@127.0.0.1/medx_db_restore_test" < backups\\medx_YYYYMMDD_HHMMSS.sql
```

---

## Минимальная политика для клиники

- хранить минимум 7–30 последних бэкапов\n
- копировать папку `backups\\` на внешний диск/флешку\n
- перед обновлением версии — делать бэкап обязательно\n

