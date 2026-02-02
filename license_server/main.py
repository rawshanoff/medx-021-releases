from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timedelta, timezone
from license_server.config import settings, get_private_key
import hashlib
import json
import logging
import os

app = FastAPI(title="MedX License Server")

class LicenseRequest(BaseModel):
    clinic_id: str
    features: dict[str, str] # {"finance_pro": "2026-12-31"}

logger = logging.getLogger("license_server")
logger.setLevel(logging.INFO)
if not logger.handlers:
    os.makedirs(os.path.dirname(settings.ISSUE_LOG_PATH), exist_ok=True)
    handler = logging.FileHandler(settings.ISSUE_LOG_PATH, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)

def _load_registry():
    if not os.path.exists(settings.REGISTRY_PATH):
        return []
    with open(settings.REGISTRY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def _save_registry(entries: list[dict]):
    os.makedirs(os.path.dirname(settings.REGISTRY_PATH), exist_ok=True)
    with open(settings.REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

def _record_issue(record: dict):
    entries = _load_registry()
    entries.append(record)
    _save_registry(entries)

@app.post("/generate")
def generate_license(req: LicenseRequest, x_admin_token: str = Header(None)):
    if x_admin_token != settings.ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid Admin Token")
    
    private_key = get_private_key()
    
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(days=3650)
    payload = {
        "sub": req.clinic_id,
        "features": req.features,
        "iat": issued_at,
        "exp": expires_at # Key signature valid for 10 years, features control specific expiration
    }
    
    token = jwt.encode(payload, private_key, algorithm="RS256")
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    _record_issue({
        "clinic_id": req.clinic_id,
        "features": req.features,
        "issued_at": issued_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "token_hash": token_hash
    })
    logger.info("Issued license for clinic_id=%s token_hash=%s", req.clinic_id, token_hash)
    return {"clinic_id": req.clinic_id, "license_key": token}

@app.get("/health")
def health():
    return {"status": "running"}
