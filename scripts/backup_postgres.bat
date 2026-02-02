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

REM Создаём подпапку по дате для организации
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set DATE_DIR=%%i
set DATE_BACKUP_DIR=%BACKUP_DIR%\%DATE_DIR%
if not exist "%DATE_BACKUP_DIR%" mkdir "%DATE_BACKUP_DIR%"

REM Генерируем имя файла с временной меткой
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
set OUT_FILE=%DATE_BACKUP_DIR%\medx_%TS%.sql

echo Creating backup: %OUT_FILE%
pg_dump "%DB_URL%" > "%OUT_FILE%"
if %ERRORLEVEL% NEQ 0 (
  echo Ошибка: backup не выполнен.
  exit /b 1
)

REM Проверяем размер файла
for %%A in ("%OUT_FILE%") do set SIZE=%%~zA
if %SIZE% LSS 1000 (
  echo Предупреждение: размер backup файла очень мал (%SIZE% байт). Возможно, backup неполный.
  exit /b 1
)

echo Backup сохранен: %OUT_FILE% (%SIZE% байт)

REM Ротация старых бэкапов: удаляем бэкапы старше 30 дней
echo Cleaning old backups (older than 30 days)...
forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path" 2>nul

echo Backup completed successfully.
endlocal
