import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "MedX"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DB_ECHO: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"
    # If set, also write logs to this file path (e.g. logs/medx.log)
    LOG_FILE: str | None = None
    LOG_MAX_BYTES: int = 5_000_000
    LOG_BACKUP_COUNT: int = 3

    # Files / Telegram (paid modules)
    FILE_STORAGE_DIR: str = "storage/patient_files"
    PATIENT_BOT_TOKEN: str = ""  # Telegram bot token for sending files to patients
    PATIENT_BOT_INTERNAL_TOKEN: str = (
        ""  # shared secret for bot -> backend linking calls
    )

    # Licensing
    LICENSE_PUBLIC_KEY: str = ""
    LICENSE_PUBLIC_KEY_PATH: str = "license_server/public_key.pem"

    # Updates
    UPDATE_CHECK_URL: str = (
        ""  # URL для проверки обновлений (например, https://update.medx.com/latest.json)
    )
    CURRENT_VERSION: str = "1.0.0-mvp"  # Текущая версия приложения

    # CORS
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173"  # Разрешенные origins через запятую
    )

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN: str = "5/minute"  # Лимит для логина
    RATE_LIMIT_DEFAULT: str = (
        "100/minute"  # Лимит по умолчанию для остальных эндпоинтов
    )

    # Default Admin Password (for security check)
    DEFAULT_ADMIN_PASSWORD_HASH: str = (
        "$2b$12$nr4PvI2HcWYkT0uR6cXMv.rUZH0s6rKK3lyOoR01XpCNj17ZH.tNC"  # Hash для 'admin123'
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.LICENSE_PUBLIC_KEY:
            self.LICENSE_PUBLIC_KEY = self._load_public_key()

    def _load_public_key(self) -> str:
        path = self.LICENSE_PUBLIC_KEY_PATH
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()

        raise FileNotFoundError(
            f"LICENSE_PUBLIC_KEY not provided and key file not found at {path}"
        )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
