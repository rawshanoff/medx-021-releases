import os
from pathlib import Path

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
    UPDATE_CHECK_URL: str = ""  # URL для проверки обновлений (через .env)
    CURRENT_VERSION: str = "1.0.0-mvp"  # Will be overwritten by _load_version

    # CORS
    CORS_ORIGINS: str = (
        # Разрешенные origins через запятую (dev/desktop)
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:3005,http://127.0.0.1:3005"
    )

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN: str = "5/minute"  # Лимит для логина
    RATE_LIMIT_DEFAULT: str = (
        "100/minute"  # Лимит по умолчанию для остальных эндпоинтов
    )

    # Default Admin Password Hash (for security check)
    # Set via environment variable if needed, otherwise empty (no default password check)
    DEFAULT_ADMIN_PASSWORD_HASH: str = ""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # License public key is optional for dev; paid features will be fail-closed.
        # If a path is provided, we'll try to load it.
        if not self.LICENSE_PUBLIC_KEY and self.LICENSE_PUBLIC_KEY_PATH:
            self.LICENSE_PUBLIC_KEY = self._load_public_key()

        # Load version from file if exists
        self.CURRENT_VERSION = self._load_version()

    def _load_version(self) -> str:
        try:
            repo_root = Path(__file__).resolve().parents[2]
            version_file = repo_root / "VERSION"
            if version_file.exists():
                return version_file.read_text(encoding="utf-8").strip()
        except Exception:
            pass
        return "1.0.0-mvp"

    def _load_public_key(self) -> str:
        path = self.LICENSE_PUBLIC_KEY_PATH
        if not path:
            return ""
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()

        # If key file is missing, do not crash the whole app: paid features will be disabled.
        # (Still fail-closed: require_features() will see no active features.)
        return ""

    _REPO_ROOT = Path(__file__).resolve().parents[2]
    model_config = SettingsConfigDict(
        # Support both repo-root ".env" and "backend/.env" to make local dev painless.
        env_file=(
            str(_REPO_ROOT / ".env"),
            str(_REPO_ROOT / "backend" / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
