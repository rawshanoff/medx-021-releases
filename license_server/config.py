from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    ADMIN_TOKEN: str  # Simple auth for Bot -> API
    BOT_TOKEN: str = ""
    LICENSE_SERVER_URL: str = "http://127.0.0.1:8001"
    PRIVATE_KEY_PATH: str = "license_server/private_key.pem"
    REGISTRY_PATH: str = "license_server/license_registry.json"
    ISSUE_LOG_PATH: str = "license_server/license_issues.log"
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

def get_private_key():
    if not os.path.exists(settings.PRIVATE_KEY_PATH):
        raise FileNotFoundError(f"Private key not found at {settings.PRIVATE_KEY_PATH}. Run generate_keys.py first.")
    with open(settings.PRIVATE_KEY_PATH, "r") as f:
        return f.read()
