import hashlib
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.features import FEATURE_FILES_RESULTS, FEATURE_TELEGRAM_PATIENT
from backend.core.licenses import require_features
from backend.core.schemas import StatusResponse
from backend.modules.auth import require_roles
from backend.modules.files.models import (
    FileDeliveryLog,
    FileDeliveryStatus,
    PatientFile,
    TelegramLinkToken,
)
from backend.modules.files.schemas import (
    PatientFileRead,
    TelegramLinkCodeResponse,
    TelegramLinkRequest,
    TelegramLinkResult,
)
from backend.modules.patients.models import Patient
from backend.modules.users.models import User, UserRole
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/files", tags=["Files"])


def _storage_path(stored_filename: str) -> str:
    os.makedirs(settings.FILE_STORAGE_DIR, exist_ok=True)
    return os.path.join(settings.FILE_STORAGE_DIR, stored_filename)


@router.post(
    "/upload",
    response_model=PatientFileRead,
)
async def upload_file(
    patient_id: int = Form(...),
    file_type: str = Form("other"),
    visit_id: int | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.CASHIER,
            UserRole.DOCTOR,
        )
    ),
    _feat=Depends(require_features(FEATURE_FILES_RESULTS)),
):
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    sha256 = hashlib.sha256(raw).hexdigest()
    stored_filename = f"{uuid4().hex}_{os.path.basename(file.filename or 'file')}"
    path = _storage_path(stored_filename)
    with open(path, "wb") as f:
        f.write(raw)

    rec = PatientFile(
        patient_id=patient_id,
        visit_id=visit_id,
        file_type=file_type,
        original_filename=file.filename or "file",
        stored_filename=stored_filename,
        mime=file.content_type,
        size=len(raw),
        sha256=sha256,
        created_by_user_id=user.id,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.get("/{file_id}", response_class=FileResponse)
async def download_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.CASHIER,
            UserRole.DOCTOR,
        )
    ),
    _feat=Depends(require_features(FEATURE_FILES_RESULTS)),
):
    rec = await db.get(PatientFile, file_id)
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")

    path = _storage_path(rec.stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File missing on disk")

    return FileResponse(
        path,
        media_type=rec.mime or "application/octet-stream",
        filename=rec.original_filename,
    )


@router.get("/patient/{patient_id}", response_model=list[PatientFileRead])
async def list_patient_files(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.CASHIER,
            UserRole.DOCTOR,
        )
    ),
    _feat=Depends(require_features(FEATURE_FILES_RESULTS)),
):
    res = await db.execute(
        select(PatientFile)
        .where(PatientFile.patient_id == patient_id)
        .order_by(PatientFile.created_at.desc())
    )
    return res.scalars().all()


@router.post("/{file_id}/send/telegram", response_model=StatusResponse)
async def send_file_to_telegram(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(
        require_roles(
            UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.DOCTOR
        )
    ),
    _feat=Depends(require_features(FEATURE_FILES_RESULTS, FEATURE_TELEGRAM_PATIENT)),
):
    if not settings.PATIENT_BOT_TOKEN:
        raise HTTPException(
            status_code=500, detail="PATIENT_BOT_TOKEN is not configured"
        )

    rec = await db.get(PatientFile, file_id)
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")

    patient = await db.get(Patient, rec.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    chat_id = getattr(patient, "telegram_chat_id", None)
    if not chat_id:
        raise HTTPException(status_code=400, detail="Patient is not linked to Telegram")

    path = _storage_path(rec.stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File missing on disk")

    url = f"https://api.telegram.org/bot{settings.PATIENT_BOT_TOKEN}/sendDocument"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            with open(path, "rb") as f:
                files = {
                    "document": (
                        rec.original_filename,
                        f,
                        rec.mime or "application/octet-stream",
                    )
                }
                data = {
                    "chat_id": str(chat_id),
                    "caption": "Результаты/файл из клиники",
                }
                resp = await client.post(url, data=data, files=files)
                ok = resp.status_code == 200 and resp.json().get("ok") is True
                if not ok:
                    raise RuntimeError(resp.text)

        db.add(
            FileDeliveryLog(
                file_id=rec.id,
                patient_id=rec.patient_id,
                channel="telegram",
                status=FileDeliveryStatus.SUCCESS.value,
                sent_by_user_id=user.id,
            )
        )
        await db.commit()
        return {"status": "sent"}
    except Exception as e:
        db.add(
            FileDeliveryLog(
                file_id=rec.id,
                patient_id=rec.patient_id,
                channel="telegram",
                status=FileDeliveryStatus.FAILED.value,
                sent_by_user_id=user.id,
                error=str(e)[:500],
            )
        )
        await db.commit()
        raise HTTPException(
            status_code=502, detail="Failed to send via Telegram"
        ) from e


@router.post(
    "/patient/{patient_id}/telegram/link-code", response_model=TelegramLinkCodeResponse
)
async def create_telegram_link_code(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    _user=Depends(
        require_roles(
            UserRole.ADMIN, UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.CASHIER
        )
    ),
):
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    code = TelegramLinkToken.new_code()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    token = TelegramLinkToken(
        patient_id=patient_id, code=code, expires_at=expires_at, used=False
    )
    db.add(token)
    await db.commit()
    return TelegramLinkCodeResponse(
        patient_id=patient_id, code=code, expires_at=expires_at
    )


@router.post("/telegram/link", response_model=TelegramLinkResult)
async def telegram_link(
    req: TelegramLinkRequest,
    db: AsyncSession = Depends(get_db),
    x_bot_token: str | None = Header(None),
):
    if (
        not settings.PATIENT_BOT_INTERNAL_TOKEN
        or x_bot_token != settings.PATIENT_BOT_INTERNAL_TOKEN
    ):
        raise HTTPException(status_code=403, detail="Invalid bot token")

    res = await db.execute(
        select(TelegramLinkToken).where(TelegramLinkToken.code == req.code)
    )
    token = res.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=404, detail="Invalid code")
    if token.used:
        raise HTTPException(status_code=400, detail="Code already used")
    if token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expired")

    patient = await db.get(Patient, token.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Store on patient record (simple MVP approach)
    patient.telegram_chat_id = int(req.chat_id)
    patient.telegram_username = req.username
    token.used = True

    await db.commit()
    return TelegramLinkResult(
        patient_id=patient.id,
        telegram_chat_id=int(req.chat_id),
        telegram_username=req.username,
    )
