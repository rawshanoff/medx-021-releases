# Тестирование проекта MedX

## 📋 Структура тестов

### Frontend (`frontend/src/__tests__/`)

```
__tests__/
├── components/     # Компоненты UI
├── pages/          # Страницы (Reception, Finance, System и т.д.)
├── hooks/          # Custom React хуки
├── utils/          # Утилиты и helper функции
├── context/        # Context провайдеры
└── setup.ts        # Конфиг и моки для всех тестов
```

### Backend (`backend/tests/`)

```
tests/
├── integration/
│   ├── reception/     # API тесты для очереди
│   ├── finance/       # Тесты платежей и смен
│   ├── system/        # Тесты системных настроек
│   └── patients/      # Тесты пациентов
├── unit/             # Unit тесты (если нужны)
└── conftest.py       # Общие фикстуры pytest
```

## 🚀 Команды для запуска

### Frontend

```bash
# Запустить все тесты
npm run test

# Запустить тесты в режиме watch
npm run test:watch

# Получить отчет покрытия
npm run test:coverage

# Запустить конкретный файл
npm test -- text.test.ts
```

### Backend

```bash
# Запустить все тесты
pytest

# Только integration тесты
pytest -m integration

# Только unit тесты
pytest -m unit

# С подробным выводом
pytest -v

# С покрытием
pytest --cov=backend --cov-report=html
```

## 📝 Написание тестов

### Frontend (Jest + React Testing Library)

```typescript
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';

describe('Component', () => {
  it('should render correctly', () => {
    const { container } = render(<YourComponent />);
    expect(container).toBeInTheDocument();
  });

  it('should handle click', async () => {
    render(<YourComponent />);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });
});
```

### Backend (Pytest + AsyncIO)

```python
import pytest

@pytest.mark.integration
class TestAPI:
    @pytest.mark.asyncio
    async def test_endpoint(self, test_db):
        # Arrange
        test_data = {"key": "value"}
        
        # Act
        result = await some_function(test_db, test_data)
        
        # Assert
        assert result is not None
```

## 🎯 Целевое покрытие

| Компонент | Целевое покрытие |
|-----------|-----------------|
| Utils     | 90%+            |
| Hooks     | 80%+            |
| Components| 75%+            |
| Pages     | 70%+            |
| API Routes| 85%+            |
| Models    | 80%+            |

## ⚙️ CI/CD Интеграция

При коммите автоматически запускаются:
1. Linting (ESLint + Ruff)
2. Formatting (Prettier + Black)
3. Unit тесты
4. Coverage проверка

## 📊 Генерация отчетов

### Frontend
```bash
npm run test:coverage
# Открыть coverage/index.html в браузере
```

### Backend
```bash
pytest --cov=backend --cov-report=html
# Открыть htmlcov/index.html в браузере
```

## 🐛 Debug режим

### Frontend
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### Backend
```bash
pytest -s -vv --tb=short
```

## 📚 Ресурсы

- [Jest документация](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Pytest документация](https://docs.pytest.org/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/14/orm/session_basics.html#using-sessions-with-events)
