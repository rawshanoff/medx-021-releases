"""Rate limiting configuration for API endpoints"""

from backend.core.config import settings
from slowapi import Limiter
from slowapi.util import get_remote_address

# Создаем глобальный limiter для использования в роутерах
limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.RATE_LIMIT_ENABLED,
)
