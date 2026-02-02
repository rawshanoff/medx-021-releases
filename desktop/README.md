## Enterprise Desktop (контур)

Цель: один дистрибутив `MedX.exe`, который:\n
- поднимает локально backend + license_server\n
- открывает UI\n
- умеет обновляться (скачать → проверить → бэкап → миграции → healthcheck → rollback)\n

В этом репозитории выбран **Electron** как оболочка (нативный desktop для React/Vite).\n

### Где лежит оболочка\n- `desktop/electron/`\n

### Dev запуск (после сборки фронта)\n1) Собрать фронт:\n- `cd frontend && npm run build`\n
2) Запустить Electron:\n- `cd desktop/electron && npm install && npm run dev`\n

### Важно (для Enterprise)\n- backend должен запускаться **без --reload**\n- обновлятор должен делать бэкап БД и иметь откат\n- секреты/ключи не должны попадать в билд\n+
