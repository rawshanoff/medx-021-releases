import logging
import os
from datetime import datetime, timezone
from typing import Dict, List

from backend.core.config import settings
from backend.core.features import (
    FEATURE_CORE,
    FEATURE_FILES_RESULTS,
    FEATURE_FINANCE_BASIC,
    FEATURE_REPORTS_BASIC,
    FEATURE_TELEGRAM_PATIENT,
)
from jose import JWTError, jwt

ALGORITHM = "RS256"
logger = logging.getLogger("medx.licenses")


class LicenseManager:
    def __init__(self, license_path: str = "license.key", dev_mode: bool = False):
        self.license_path = license_path
        self._cached_features: List[str] = []
        self._cached_data: Dict = {}
        # Dev mode: all features enabled without license verification
        self.dev_mode = dev_mode or os.getenv("LICENSE_DEV_MODE", "").lower() in (
            "true",
            "1",
            "yes",
        )

    def load_license(self) -> Dict:
        """Loads and verifies the license file."""
        # In dev mode, return all features enabled
        if self.dev_mode:
            return {
                "features": {
                    # IMPORTANT: feature codes must match backend/core/features.py values
                    # (e.g. "core", "finance_basic", ...)
                    FEATURE_CORE: "9999-12-31T23:59:59",
                    FEATURE_FINANCE_BASIC: "9999-12-31T23:59:59",
                    FEATURE_REPORTS_BASIC: "9999-12-31T23:59:59",
                    FEATURE_FILES_RESULTS: "9999-12-31T23:59:59",
                    FEATURE_TELEGRAM_PATIENT: "9999-12-31T23:59:59",
                }
            }

        if not os.path.exists(self.license_path):
            return {"error": "License file not found"}

        with open(self.license_path, "r") as f:
            token = f.read().strip()

        try:
            # Verify signature using the Public Key
            payload = jwt.decode(
                token, settings.LICENSE_PUBLIC_KEY, algorithms=[ALGORITHM]
            )

            # Check global expiration
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(
                timezone.utc
            ):
                return {"error": "License expired"}

            self._cached_data = payload
            return payload
        except JWTError as e:
            return {"error": f"Invalid license: {str(e)}"}

    def get_active_features(self) -> List[str]:
        """Returns a list of active features based on current time."""
        payload = self.load_license()
        if "error" in payload:
            if not self.dev_mode:
                logger.warning(
                    "License error (%s): %s", self.license_path, payload.get("error")
                )
            # Fail-closed for paid features, but keep free lifetime features enabled.
            # Dev-mode explicitly bypasses this in load_license().
            return [FEATURE_CORE, FEATURE_FINANCE_BASIC, FEATURE_REPORTS_BASIC]

        features = payload.get("features", {})
        active = []
        now = datetime.now(timezone.utc)

        for code, valid_until_str in features.items():
            try:
                # Assuming format "YYYY-MM-DDTHH:MM:SS" or "9999..."
                if valid_until_str.startswith("9999"):
                    active.append(code)
                    continue

                valid_until = datetime.fromisoformat(valid_until_str).replace(
                    tzinfo=timezone.utc
                )
                if valid_until > now:
                    active.append(code)
            except ValueError:
                continue

        return active

    def save_license_token(self, token: str) -> None:
        """Saves license token to disk (server-side)."""
        token = (token or "").strip()
        if not token:
            raise ValueError("Empty license token")
        with open(self.license_path, "w", encoding="utf-8") as f:
            f.write(token)
        # reset caches
        self._cached_features = []
        self._cached_data = {}


# Dev mode is controlled via env LICENSE_DEV_MODE=true/1/yes.
license_manager = LicenseManager(dev_mode=False)


def require_features(*required: str):
    """Dependency factory: проверяет, что нужные фичи активны.

    Использовать на платных эндпойнтах (например files_results/telegram_patient).
    """
    from backend.modules.auth import get_current_user
    from fastapi import Depends, HTTPException

    async def _dep(_user=Depends(get_current_user)):
        active = set(license_manager.get_active_features())
        missing = [c for c in required if c not in active]
        if missing:
            raise HTTPException(
                status_code=403, detail=f"Feature not active: {', '.join(missing)}"
            )
        return True

    return _dep
