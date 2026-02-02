from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PatientFileRead(BaseModel):
    id: int
    patient_id: int
    visit_id: Optional[int] = None
    file_type: str
    original_filename: str
    mime: Optional[str] = None
    size: int
    sha256: str
    created_by_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TelegramLinkCodeResponse(BaseModel):
    patient_id: int
    code: str
    expires_at: datetime


class TelegramLinkRequest(BaseModel):
    code: str
    chat_id: int
    username: Optional[str] = None


class TelegramLinkResult(BaseModel):
    patient_id: int
    telegram_chat_id: int
    telegram_username: Optional[str] = None
