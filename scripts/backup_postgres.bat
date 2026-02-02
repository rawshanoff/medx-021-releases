@echo off
setlocal

if "%DATABASE_URL%"=="" (
  echo DATABASE_URL не задан. Установите переменную окружения и повторите.
  echo Пример: set DATABASE_URL=postgresql://postgres:PASS@127.0.0.1/medx_db
  exit /b 1
)

REM pg_dump не понимает SQLAlchemy URL вида postgresql+asyncpg://
set DB_URL=%DATABASE_URL%
set DB_URL=%DB_URL:postgresql+asyncpg=postgresql%
set DB_URL=%DB_URL:postgresql+psycopg2=postgresql%

set BACKUP_DIR=backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
set OUT_FILE=%BACKUP_DIR%\medx_%TS%.sql

pg_dump "%DB_URL%" > "%OUT_FILE%"
if %ERRORLEVEL% NEQ 0 (
  echo Ошибка: backup не выполнен.
  exit /b 1
)

echo Backup сохранен: %OUT_FILE%
endlocal
