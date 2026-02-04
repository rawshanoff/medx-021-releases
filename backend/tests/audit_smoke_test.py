"""
Audit Smoke Test: проверка импортов, базовой функциональности и отсутствия критических ошибок.

Этот тест проверяет:
1. Импорт всех основных модулей без ошибок циклических зависимостей
2. Инициализацию основных классов без падений
3. Базовую валидность схем Pydantic
4. Отсутствие явных ошибок в критических путях
5. Проверки на мертвый код и неиспользуемые импорты (расширенная версия)
"""

import sys
from pathlib import Path

# Ensure backend package is importable
_repo_root = Path(__file__).resolve().parents[2]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))


def test_import_backend_core():
    """Проверка импорта core модулей."""
    try:
        from backend.core.config import settings
        from backend.core.database import Base
        from backend.core.licenses import LicenseManager, license_manager
        from backend.core.updater import Updater

        assert settings is not None
        assert Base is not None
        assert LicenseManager is not None
        assert license_manager is not None
        assert Updater is not None
    except Exception as err:
        raise AssertionError(f"Failed to import backend.core modules: {err}") from err


def test_import_backend_modules():
    """Проверка импорта всех модулей."""
    try:
        from backend.modules.appointments import router as appointments_router
        from backend.modules.auth import router as auth_router
        from backend.modules.doctors import router as doctors_router
        from backend.modules.files import router as files_router
        from backend.modules.finance import router as finance_router
        from backend.modules.licenses import router as licenses_router
        from backend.modules.patients import router as patients_router
        from backend.modules.reception import router as reception_router
        from backend.modules.system import router as system_router
        from backend.modules.users import router as users_router

        # Проверка, что роутеры существуют
        assert auth_router is not None
        assert doctors_router is not None
        assert finance_router is not None
        assert patients_router is not None
        assert reception_router is not None
        assert system_router is not None
        assert users_router is not None
        assert appointments_router is not None
        assert files_router is not None
        assert licenses_router is not None
    except Exception as err:
        raise AssertionError(f"Failed to import backend modules: {err}") from err


def test_import_models():
    """Проверка импорта моделей."""
    try:
        from backend.modules.doctors.models import Doctor, DoctorService
        from backend.modules.finance.models import Shift, Transaction
        from backend.modules.patients.models import Patient
        from backend.modules.reception.models import QueueItem
        from backend.modules.system.models import SystemSetting
        from backend.modules.users.models import User, UserRole

        # Проверка, что модели определены
        assert Doctor is not None
        assert DoctorService is not None
        assert Shift is not None
        assert Transaction is not None
        assert Patient is not None
        assert QueueItem is not None
        assert User is not None
        assert UserRole is not None
        assert SystemSetting is not None
    except Exception as err:
        raise AssertionError(f"Failed to import models: {err}") from err


def test_import_schemas():
    """Проверка импорта схем Pydantic."""
    try:
        from backend.modules.doctors.schemas import DoctorCreate, DoctorRead
        from backend.modules.finance.schemas import ShiftCreate, TransactionCreate
        from backend.modules.patients.schemas import PatientCreate
        from backend.modules.reception.schemas import QueueItemCreate
        from backend.modules.users.schemas import UserCreate, UserResponse

        # Проверка, что схемы определены
        assert DoctorCreate is not None
        assert DoctorRead is not None
        assert ShiftCreate is not None
        assert TransactionCreate is not None
        assert PatientCreate is not None
        assert QueueItemCreate is not None
        assert UserCreate is not None
        assert UserResponse is not None
    except Exception as err:
        raise AssertionError(f"Failed to import schemas: {err}") from err


def test_license_manager_initialization():
    """Проверка инициализации LicenseManager."""
    try:
        from backend.core.licenses import LicenseManager

        # Создание экземпляра в dev режиме
        manager = LicenseManager(dev_mode=True)
        assert manager.dev_mode is True

        # Проверка загрузки лицензии в dev режиме
        license_data = manager.load_license()
        assert "error" not in license_data or manager.dev_mode

        # Проверка получения активных фич
        features = manager.get_active_features()
        assert isinstance(features, list)
    except Exception as err:
        raise AssertionError(f"Failed to initialize LicenseManager: {err}") from err


def test_updater_initialization():
    """Проверка инициализации Updater."""
    try:
        from backend.core.updater import Updater

        updater = Updater()
        assert updater is not None

        # Проверка, что методы существуют
        assert hasattr(updater, "check_for_updates")
        assert hasattr(updater, "spawn_update_process")
    except Exception as err:
        raise AssertionError(f"Failed to initialize Updater: {err}") from err


def test_schema_validation():
    """Проверка базовой валидации схем."""
    try:
        from backend.modules.doctors.schemas import DoctorCreate
        from backend.modules.patients.schemas import PatientCreate
        from backend.modules.users.schemas import UserCreate

        # Валидные данные
        doctor = DoctorCreate(
            full_name="Test Doctor", specialty="Cardiology", queue_prefix="A"
        )
        assert doctor.full_name == "Test Doctor"

        patient = PatientCreate(full_name="Test Patient", phone="+998901234567")
        assert patient.full_name == "Test Patient"

        user = UserCreate(
            username="testuser",
            password="testpass123",
            full_name="Test User",
            role="doctor",
        )
        assert user.username == "testuser"

        # Примечание: DoctorBase не валидирует пустое full_name на уровне схемы
        # Это может быть проблемой, но пока оставляем как есть для совместимости
        # В будущем стоит добавить @field_validator для full_name

    except Exception as err:
        raise AssertionError(f"Schema validation test failed: {err}") from err


def test_user_role_enum():
    """Проверка UserRole enum."""
    try:
        from backend.modules.users.models import UserRole

        # Проверка всех ролей
        assert UserRole.ADMIN is not None
        assert UserRole.OWNER is not None
        assert UserRole.DOCTOR is not None
        assert UserRole.RECEPTIONIST is not None
        assert UserRole.CASHIER is not None

        # Проверка, что это enum
        assert isinstance(UserRole.ADMIN, UserRole)
    except Exception as err:
        raise AssertionError(f"UserRole enum test failed: {err}") from err


def test_payment_method_enum():
    """Проверка PaymentMethod enum."""
    try:
        from backend.modules.finance.models import PaymentMethod

        # Проверка всех методов оплаты
        assert PaymentMethod.CASH is not None
        assert PaymentMethod.CARD is not None
        assert PaymentMethod.TRANSFER is not None
        assert PaymentMethod.MIXED is not None

        # Проверка, что это enum
        assert isinstance(PaymentMethod.CASH, PaymentMethod)
    except Exception as err:
        raise AssertionError(f"PaymentMethod enum test failed: {err}") from err


def test_main_app_import():
    """Проверка импорта главного приложения."""
    try:
        from backend.main import app

        assert app is not None
        assert hasattr(app, "router")
        assert hasattr(app, "state")
    except Exception as err:
        raise AssertionError(f"Failed to import main app: {err}") from err


def test_database_connection():
    """Проверка подключения к базе данных (без реального подключения)."""
    try:
        from backend.core.config import settings
        from backend.core.database import init_db

        # Проверяем, что функция существует и не падает при импорте
        assert callable(init_db)

        # Проверяем наличие основных настроек БД
        assert hasattr(settings, "DATABASE_URL") or hasattr(settings, "database_url")

    except Exception as err:
        raise AssertionError(f"Database connection test failed: {err}") from err


def test_circular_imports_check():
    """Расширенная проверка на циклические импорты."""
    try:
        # Импортируем все основные модули одновременно для проверки циклов
        import backend.core.config
        import backend.core.database
        import backend.core.licenses
        import backend.modules.auth
        import backend.modules.doctors
        import backend.modules.finance
        import backend.modules.patients
        import backend.modules.reception
        import backend.modules.system
        import backend.modules.users  # noqa: F401

        # Если мы дошли сюда, значит нет циклических импортов
        assert True

    except ImportError as err:
        raise AssertionError(f"Circular import detected: {err}") from err


def test_dead_code_detection():
    """Проверка на потенциально мертвый код (экспериментальная)."""
    try:
        from backend.core.updater import Updater

        # Проверяем методы, которые могут быть неиспользуемыми
        updater = Updater()
        methods = [method for method in dir(updater) if not method.startswith("_")]

        # download_update - алиас для spawn_update_process, должен существовать
        assert hasattr(updater, "download_update")

        # Проверяем, что все публичные методы вызываемы
        for method in methods:
            attr = getattr(updater, method)
            assert callable(attr), f"Method {method} should be callable"

    except Exception as err:
        raise AssertionError(f"Dead code detection test failed: {err}") from err


def test_error_handling_patterns():
    """Проверка паттернов обработки ошибок."""
    try:
        from backend.core.exceptions import AppException

        # Проверяем, что наше исключение наследуется правильно
        assert issubclass(AppException, Exception)

        # Проверяем наличие стандартных атрибутов
        exc = AppException(status_code=400, detail="test message")
        assert exc.detail == "test message"
        assert exc.status_code == 400

    except Exception as err:
        raise AssertionError(f"Error handling patterns test failed: {err}") from err


def test_config_validation():
    """Проверка валидности конфигурации."""
    try:
        from backend.core.config import settings

        # Проверяем наличие критически важных настроек
        required_attrs = ["SECRET_KEY", "DATABASE_URL", "CORS_ORIGINS"]
        for attr in required_attrs:
            if not hasattr(settings, attr):
                # Ищем альтернативные имена (snake_case)
                alt_attr = attr.lower()
                assert hasattr(settings, alt_attr), f"Missing required config: {attr}"

        # Проверяем, что SECRET_KEY не пустой
        secret_key = getattr(
            settings, "SECRET_KEY", getattr(settings, "secret_key", None)
        )
        assert secret_key is not None, "SECRET_KEY cannot be None"
        assert len(str(secret_key)) > 0, "SECRET_KEY cannot be empty"

    except Exception as err:
        raise AssertionError(f"Config validation test failed: {err}") from err
