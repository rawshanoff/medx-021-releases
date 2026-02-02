from jose import jwt, JWTError
from datetime import datetime, timezone
import os
from typing import List, Dict, Optional
from backend.core.config import settings

ALGORITHM = "RS256"

class LicenseManager:
    def __init__(self, license_path: str = "license.key"):
        self.license_path = license_path
        self._cached_features: List[str] = []
        self._cached_data: Dict = {}

    def load_license(self) -> Dict:
        """Loads and verifies the license file."""
        if not os.path.exists(self.license_path):
            return {"error": "License file not found"}

        with open(self.license_path, "r") as f:
            token = f.read().strip()

        try:
            # Verify signature using the Public Key
            payload = jwt.decode(token, settings.LICENSE_PUBLIC_KEY, algorithms=[ALGORITHM])
            
            # Check global expiration
            exp = payload.get("exp")
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                return {"error": "License expired"}

            self._cached_data = payload
            return payload
        except JWTError as e:
            return {"error": f"Invalid license: {str(e)}"}

    def get_active_features(self) -> List[str]:
        """Returns a list of active features based on current time."""
        payload = self.load_license()
        if "error" in payload:
            print(f"License Error: {payload['error']}")
            return [] # Fail safe: no features

        features = payload.get("features", {})
        active = []
        now = datetime.now(timezone.utc)

        for code, valid_until_str in features.items():
            try:
                # Assuming format "YYYY-MM-DDTHH:MM:SS" or "9999..."
                 if valid_until_str.startswith("9999"):
                     active.append(code)
                     continue
                 
                 valid_until = datetime.fromisoformat(valid_until_str).replace(tzinfo=timezone.utc)
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

license_manager = LicenseManager()


def require_features(*required: str):
    """Dependency factory: проверяет, что нужные фичи активны.

    Использовать на платных эндпойнтах (например files_results/telegram_patient).
    """
    from fastapi import Depends, HTTPException
    from backend.modules.auth import get_current_user

    async def _dep(_user=Depends(get_current_user)):
        active = set(license_manager.get_active_features())
        missing = [c for c in required if c not in active]
        if missing:
            raise HTTPException(status_code=403, detail=f"Feature not active: {', '.join(missing)}")
        return True

    return _dep
