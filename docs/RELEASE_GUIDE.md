# MedX MVP Release Guide

## Обзор системы обновлений

MedX использует механизм обновлений через интернет:

1. **Проверка обновлений**: Бэкенд запрашивает `latest.json` по URL из `UPDATE_CHECK_URL`
2. **Скачивание**: Если есть новая версия, скачивается ZIP-архив
3. **Проверка целостности**: Проверяется SHA256 хеш
4. **Применение**: Создаётся бэкап, применяются файлы, запускаются миграции
5. **Перезапуск**: Приложение перезапускается с новой версией

## Формат latest.json

```json
{
  "version": "1.0.1",
  "url": "https://github.com/rawshanoff/medx-021/releases/download/v1.0.1/medx-1.0.1.zip",
  "sha256": "a1b2c3d4e5f6...",
  "notes": "Исправления и улучшения",
  "published_at": "2026-02-03T10:00:00Z"
}
```

## Содержимое update.zip

Архив должен содержать:
```
medx-1.0.1.zip/
├── backend/           # Python бэкенд
├── license_server/    # Сервер лицензий (без private_key.pem!)
├── scripts/           # Вспомогательные скрипты
└── frontend/
    └── dist/          # Собранный фронтенд
```

## Сборка релиза

### Автоматическая сборка

```powershell
# Из корня проекта
python scripts/build_release.py --version 1.0.1 --notes "MVP Release"
```

Скрипт:
1. Соберёт frontend (`npm run build`)
2. Создаст ZIP-архив в `releases/medx-1.0.1.zip`
3. Вычислит SHA256
4. Сгенерирует `releases/latest.json`

### Ручная сборка

```powershell
# 1. Собрать frontend
cd frontend
npm run build

# 2. Обновить версию
# В backend/core/config.py: CURRENT_VERSION = "1.0.1"

# 3. Создать ZIP вручную
# Включить: backend/, license_server/, scripts/, frontend/dist/
# Исключить: __pycache__, .env, .git, node_modules, private_key.pem
```

## Публикация релиза

### GitHub Releases

1. Создайте новый релиз на GitHub
2. Загрузите `medx-1.0.1.zip`
3. Загрузите `latest.json`
4. Получите URL для `latest.json`:
   ```
   https://raw.githubusercontent.com/rawshanoff/medx-021-releases/main/latest.json
   ```

### Настройка клиента

В файле `.env` клиента:
```env
UPDATE_CHECK_URL=https://raw.githubusercontent.com/rawshanoff/medx-021-releases/main/latest.json
```

## Процесс обновления

### Автоматическая проверка

Пользователь может проверить обновления из:
**Система → Обновления → Проверить обновления**

### Установка обновления

1. При обнаружении обновления показывается кнопка "Установить"
2. После нажатия:
   - Бэкенд запускает `scripts/updater.py`
   - Бэкенд завершается
   - Updater скачивает и применяет обновление
   - Updater запускает миграции (`alembic upgrade head`)
   - Electron перезапускает приложение

### При ошибке

Если обновление не удалось:
- Автоматически восстанавливается бэкап
- Создаётся файл `._update_failed` с деталями ошибки

## Безопасность

- **Не включайте в архив**: `.env`, `private_key.pem`, `medx.db`
- **SHA256 проверка**: Защита от повреждённых/изменённых файлов
- **Бэкапы**: Перед каждым обновлением создаётся бэкап

## Версионирование

Формат версии: `MAJOR.MINOR.PATCH[-suffix]`

Примеры:
- `1.0.0` — первый стабильный релиз
- `1.0.1` — патч с исправлениями
- `1.1.0` — новые функции
- `1.0.0-mvp` — MVP версия

## Чеклист релиза

- [ ] Обновить `CURRENT_VERSION` в `backend/core/config.py`
- [ ] Протестировать все критические функции
- [ ] Собрать релиз: `python scripts/build_release.py --version X.Y.Z`
- [ ] Проверить содержимое ZIP
- [ ] Загрузить на GitHub Releases
- [ ] Проверить URL `latest.json`
- [ ] Протестировать обновление на тестовой машине

## Устранение проблем

### Обновление не находится

1. Проверьте `UPDATE_CHECK_URL` в `.env`
2. Проверьте доступность `latest.json` по URL
3. Проверьте формат JSON

### Ошибка SHA256

1. Перегенерируйте `latest.json`
2. Проверьте, что ZIP не был изменён после загрузки

### Сбой после обновления

1. Проверьте `._update_failed` в корне приложения
2. Восстановите из бэкапа в `_update_backup/`
