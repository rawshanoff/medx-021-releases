import logging
import os
import time
from pathlib import Path
from typing import Any

from backend.core.config import settings
from backend.core.database import get_db
from backend.core.updater import updater
from backend.modules.auth import get_current_user, require_roles
from backend.modules.system.models import SystemAuditLog, SystemSetting
from backend.modules.system.schemas import (
    PrintSettingsValue,
    SystemAuditLogRead,
    SystemSettingRead,
    SystemSettingUpdate,
    UpdateCheckResponse,
    VersionResponse,
)
from backend.modules.users.models import User, UserRole
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger("medx")
router = APIRouter()


# ============================================================================
# Validation Functions
# ============================================================================


def validate_print_config(value: Any) -> None:
    """Validate print_config setting value.

    Raises HTTPException if validation fails.
    """
    if not isinstance(value, dict):
        raise HTTPException(
            status_code=400,
            detail="print_config value must be a JSON object",
        )

    # Validate silentScalePercent is within 10-200 range
    if "silentScalePercent" in value:
        scale = value.get("silentScalePercent")
        if not isinstance(scale, int) or not (10 <= scale <= 200):
            raise HTTPException(
                status_code=400,
                detail="silentScalePercent must be an integer between 10 and 200",
            )

    # Validate logoMaxMm is within 8-40 range
    if "logoMaxMm" in value:
        logo_max = value.get("logoMaxMm")
        if not isinstance(logo_max, int) or not (8 <= logo_max <= 40):
            raise HTTPException(
                status_code=400,
                detail="logoMaxMm must be an integer between 8 and 40",
            )

    # Validate fontScalePercent is within 60-140 range
    if "fontScalePercent" in value:
        font_scale = value.get("fontScalePercent")
        if not isinstance(font_scale, int) or not (60 <= font_scale <= 140):
            raise HTTPException(
                status_code=400,
                detail="fontScalePercent must be an integer between 60 and 140",
            )

    # Validate silentPrintMode is one of allowed values
    if "silentPrintMode" in value:
        mode = value.get("silentPrintMode")
        if mode not in ("html", "image"):
            raise HTTPException(
                status_code=400,
                detail="silentPrintMode must be 'html' or 'image'",
            )

    # Validate receiptWidthMode
    if "receiptWidthMode" in value:
        width_mode = value.get("receiptWidthMode")
        if width_mode not in ("standard", "safe"):
            raise HTTPException(
                status_code=400,
                detail="receiptWidthMode must be 'standard' or 'safe'",
            )

    # Validate paperSize
    if "paperSize" in value:
        paper = value.get("paperSize")
        if paper not in ("58", "80"):
            raise HTTPException(
                status_code=400,
                detail="paperSize must be '58' or '80'",
            )

    # Validate receiptTemplateId
    if "receiptTemplateId" in value:
        template = value.get("receiptTemplateId")
        if template not in ("check-4-58", "check-1", "check-6"):
            raise HTTPException(
                status_code=400,
                detail="receiptTemplateId must be one of: check-4-58, check-1, check-6",
            )

    # Validate string fields are not too long
    for field in (
        "clinicName",
        "clinicPhone",
        "clinicAddress",
        "footerNote",
        "underQrText",
    ):
        if field in value:
            val = value.get(field)
            if not isinstance(val, str):
                raise HTTPException(
                    status_code=400,
                    detail=f"{field} must be a string",
                )
            if len(val) > 500:
                raise HTTPException(
                    status_code=400,
                    detail=f"{field} must be less than 500 characters",
                )

    # Validate boolean fields
    for field in (
        "autoPrint",
        "boldAllText",
        "showTotalAmount",
        "showPaymentType",
        "showLogo",
        "showClinicName",
        "showClinicPhone",
        "showClinicAddress",
        "showDateTime",
        "showQueue",
        "showPatientName",
        "showDoctor",
        "showDoctorRoom",
        "showServices",
        "showQr",
        "showUnderQrText",
        "showFooterNote",
    ):
        if field in value:
            val = value.get(field)
            if not isinstance(val, bool):
                raise HTTPException(
                    status_code=400,
                    detail=f"{field} must be a boolean (true/false)",
                )


def validate_setting_value(setting_key: str, value: Any) -> None:
    """Route to appropriate validation function based on setting key."""
    if setting_key == "print_config":
        validate_print_config(value)
    elif setting_key == "patient_required_fields":
        if not isinstance(value, dict):
            raise HTTPException(
                status_code=400,
                detail="patient_required_fields value must be a JSON object",
            )
        for field in ("phone", "firstName", "lastName", "birthDate"):
            if field in value and not isinstance(value.get(field), bool):
                raise HTTPException(
                    status_code=400,
                    detail=f"{field} must be a boolean (true/false)",
                )
    elif setting_key == "quick_receipts":
        if not isinstance(value, dict):
            raise HTTPException(
                status_code=400,
                detail="quick_receipts value must be a JSON object",
            )
        if "enabled" in value and not isinstance(value.get("enabled"), bool):
            raise HTTPException(
                status_code=400,
                detail="enabled must be a boolean (true/false)",
            )
        bindings = value.get("bindings")
        if bindings is not None:
            if not isinstance(bindings, list):
                raise HTTPException(
                    status_code=400,
                    detail="bindings must be a list",
                )
            for idx, item in enumerate(bindings):
                if not isinstance(item, dict):
                    raise HTTPException(
                        status_code=400,
                        detail=f"bindings[{idx}] must be an object",
                    )
                hotkey = item.get("hotkey")
                if hotkey is not None and not isinstance(hotkey, str):
                    raise HTTPException(
                        status_code=400,
                        detail=f"bindings[{idx}].hotkey must be a string",
                    )
                payment = item.get("paymentMethod")
                if payment not in (None, "CASH", "CARD", "TRANSFER"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"bindings[{idx}].paymentMethod invalid",
                    )
                for field in ("doctorId", "serviceId"):
                    if field in item and item.get(field) is not None:
                        if not isinstance(item.get(field), int):
                            raise HTTPException(
                                status_code=400,
                                detail=f"bindings[{idx}].{field} must be an int",
                            )
    # Add more validators for other setting keys as needed
    # elif setting_key == "ui_preferences":
    #     validate_ui_preferences(value)


async def _audit(
    db: AsyncSession,
    user: User,
    action: str,
    setting_key: str,
    old_value: dict | None = None,
    new_value: dict | None = None,
    details: str | None = None,
) -> None:
    """Log an audit entry for system settings changes."""
    db.add(
        SystemAuditLog(
            user_id=user.id,
            action=action,
            setting_key=setting_key,
            old_value=old_value,
            new_value=new_value,
            details=details,
        )
    )


@router.get("/version", response_model=VersionResponse)
def get_version(
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    )
):
    return {"version": settings.CURRENT_VERSION, "status": "active"}


@router.get("/update-check", response_model=UpdateCheckResponse)
async def check_update(
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    )
):
    update_info = await updater.check_for_updates()

    if update_info:
        return {
            "update_available": True,
            "latest_version": update_info["latest"],
            "current_version": settings.CURRENT_VERSION,
            "release_notes": update_info.get("notes") or "Update available",
            "download_url": update_info["url"],
        }

    return {
        "update_available": False,
        "latest_version": settings.CURRENT_VERSION,
        "current_version": settings.CURRENT_VERSION,
        "release_notes": "Up to date",
    }


def _hard_exit_after_delay(delay_sec: float = 0.8) -> None:
    # Never hard-exit during tests.
    if os.getenv("MEDX_DISABLE_HARD_EXIT") in ("1", "true", "yes") or os.getenv(
        "PYTEST_CURRENT_TEST"
    ):
        return
    # Give the HTTP response a moment to flush, then hard-exit the process.
    # Electron will restart services after updater finishes.
    try:
        time.sleep(max(0.0, float(delay_sec)))
    finally:
        os._exit(0)  # noqa: S404


def _spawn_update(download_url: str, sha256: str | None) -> None:
    updater.spawn_update_process(download_url=download_url, sha256=sha256)


@router.post("/update-install", response_model=UpdateCheckResponse)
async def install_update(
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    """Start online update installation (desktop/Electron MVP).

    Spawns `scripts/updater.py` to download/apply the update ZIP, then exits the
    backend process shortly after responding. Electron is responsible for
    restarting services and reloading the UI.
    """
    update_info = await updater.check_for_updates()

    if not update_info:
        return {
            "update_available": False,
            "latest_version": settings.CURRENT_VERSION,
            "current_version": settings.CURRENT_VERSION,
            "release_notes": "Up to date",
            "download_url": None,
        }

    # Audit (best-effort): store the update start event in system audit log.
    try:
        await _audit(
            db=db,
            user=user,
            action="update_install_start",
            setting_key="app_update",
            old_value={"version": settings.CURRENT_VERSION},
            new_value={
                "version": update_info.get("latest"),
                "url": update_info.get("url"),
                "sha256": update_info.get("sha256"),
                "published_at": update_info.get("published_at"),
            },
            details="Started online update installation",
        )
        await db.commit()
    except Exception:
        await db.rollback()

    # Spawn updater and then exit after we return response.
    # IMPORTANT: create marker BEFORE exiting to avoid race with Electron watcher.
    try:
        p = Path(os.getcwd()) / "._update_in_progress"
        p.write_text(
            f"started_at={time.time()}\nurl={update_info.get('url')}\n",
            encoding="utf-8",
        )
    except Exception:
        logger.exception("Failed to write update marker")

    _spawn_update(download_url=update_info["url"], sha256=update_info.get("sha256"))
    # Give Electron/updater a bit more time on Windows before we hard-exit.
    background.add_task(_hard_exit_after_delay, 2.0)

    return {
        "update_available": True,
        "latest_version": update_info["latest"],
        "current_version": settings.CURRENT_VERSION,
        "release_notes": update_info.get("notes") or "Update available",
        "download_url": update_info.get("url"),
    }


@router.get("/doctors")
async def get_doctors(
    _user=Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.RECEPTIONIST,
            UserRole.DOCTOR,
            UserRole.CASHIER,
        )
    )
):
    # Mock list of doctors
    return [
        {"id": "dr_house", "name": "Dr. Gregory House", "specialty": "Diagnostician"},
        {"id": "dr_wilson", "name": "Dr. James Wilson", "specialty": "Oncologist"},
        {
            "id": "dr_cameron",
            "name": "Dr. Allison Cameron",
            "specialty": "Immunologist",
        },
        {"id": "dr_chase", "name": "Dr. Robert Chase", "specialty": "Surgeon"},
        {"id": "dr_foreman", "name": "Dr. Eric Foreman", "specialty": "Neurologist"},
    ]


# ============================================================================
# System Settings API (NEW)
# ============================================================================


@router.get("/print-settings", response_model=PrintSettingsValue)
async def get_print_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Convenience endpoint for print settings (alias for key=print_config)."""
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.user_id == user.id,
            SystemSetting.key == "print_config",
            SystemSetting.deleted_at.is_(None),
        )
    )
    setting = result.scalars().first()

    if not setting or not isinstance(setting.value, dict):
        return PrintSettingsValue()

    try:
        return PrintSettingsValue(**setting.value)
    except ValidationError:
        # Fail-safe: if DB contains invalid/legacy value, return defaults.
        return PrintSettingsValue()


@router.put("/print-settings", response_model=PrintSettingsValue)
async def update_print_settings(
    value: PrintSettingsValue,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Convenience endpoint for print settings (alias for key=print_config)."""
    updated = await update_system_setting(
        key="print_config",
        data=SystemSettingUpdate(value=value.model_dump()),
        db=db,
        user=user,
    )
    try:
        return PrintSettingsValue(**(updated.value or {}))
    except ValidationError:
        return PrintSettingsValue()


@router.get("/settings/keys", response_model=list[str])
async def list_setting_keys(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List available setting keys for current user.

    Used by the Settings UI to populate history filters and navigation.
    """
    result = await db.execute(
        select(SystemSetting.key)
        .where(
            SystemSetting.user_id == user.id,
            SystemSetting.deleted_at.is_(None),
        )
        .distinct()
        .order_by(SystemSetting.key.asc())
    )
    keys = [r[0] for r in result.all() if r and r[0]]
    # Ensure known keys are present even if not yet saved.
    if "print_config" not in keys:
        keys.insert(0, "print_config")
    if "patient_required_fields" not in keys:
        keys.append("patient_required_fields")
    if "quick_receipts" not in keys:
        keys.append("quick_receipts")
    return keys


@router.get("/settings/{key}", response_model=SystemSettingRead)
async def get_system_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a system setting for the current user.

    Example: GET /api/system/settings/print_config
    """
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.user_id == user.id,
            SystemSetting.key == key,
            SystemSetting.deleted_at.is_(None),
        )
    )
    setting = result.scalars().first()

    if not setting:
        raise HTTPException(
            status_code=404,
            detail=f"Setting '{key}' not found for user",
        )

    return setting


@router.put("/settings/{key}", response_model=SystemSettingRead)
async def update_system_setting(
    key: str,
    data: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create or update a system setting for the current user.

    Example: PUT /api/system/settings/print_config
    Body: {"value": {...}}

    Validates the value before saving.
    """
    # Validate the value first
    validate_setting_value(key, data.value)

    # Try to find existing setting
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.user_id == user.id,
            SystemSetting.key == key,
            SystemSetting.deleted_at.is_(None),
        )
    )
    setting = result.scalars().first()

    old_value = None
    if setting:
        # Update existing
        old_value = setting.value
        setting.value = data.value
        action = "update"
    else:
        # Create new
        setting = SystemSetting(
            user_id=user.id,
            key=key,
            value=data.value,
        )
        db.add(setting)
        action = "create"

    # Log audit before commit
    await _audit(
        db=db,
        user=user,
        action=action,
        setting_key=key,
        old_value=old_value,
        new_value=data.value,
    )

    await db.commit()
    await db.refresh(setting)

    logger.info(f"System setting '{key}' {action}d for user {user.id}")
    return setting


@router.get("/settings", response_model=dict)
async def get_all_system_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all system settings for the current user.

    Returns dict with keys as setting keys and values as setting values.
    """
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.user_id == user.id,
            SystemSetting.deleted_at.is_(None),
        )
    )
    settings = result.scalars().all()

    # Convert to dict: key -> value
    settings_dict = {s.key: s.value for s in settings}
    return settings_dict


# ============================================================================
# Audit Log API
# ============================================================================


@router.get("/settings/audit/{setting_key}", response_model=list[SystemAuditLogRead])
async def get_setting_audit_history(
    setting_key: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get audit history for a specific setting key (for current user).

    Example: GET /api/system/settings/audit/print_config?limit=20
    """
    result = await db.execute(
        select(SystemAuditLog)
        .options(selectinload(SystemAuditLog.user))
        .where(
            SystemAuditLog.user_id == user.id,
            SystemAuditLog.setting_key == setting_key,
            SystemAuditLog.deleted_at.is_(None),
        )
        .order_by(SystemAuditLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    return logs


@router.post("/settings/{setting_key}/rollback/{audit_id}")
async def rollback_setting(
    setting_key: str,
    audit_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rollback a system setting to a previous version based on audit log.

    Example: POST /api/system/settings/print_config/rollback/123

    This endpoint:
    1. Finds the audit log entry
    2. Extracts the old_value from that entry
    3. Restores the setting to that value
    4. Logs the rollback action
    """
    # Find the audit log entry
    result = await db.execute(
        select(SystemAuditLog).where(
            SystemAuditLog.id == audit_id,
            SystemAuditLog.user_id == user.id,
            SystemAuditLog.setting_key == setting_key,
            SystemAuditLog.deleted_at.is_(None),
        )
    )
    audit_log = result.scalars().first()

    if not audit_log:
        raise HTTPException(
            status_code=404,
            detail=f"Audit log entry {audit_id} not found",
        )

    # The value to restore is the old_value from the audit log
    rollback_value = audit_log.old_value
    if rollback_value is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot rollback: no previous value available (this was the first creation)",
        )

    # Find the current setting
    result = await db.execute(
        select(SystemSetting).where(
            SystemSetting.user_id == user.id,
            SystemSetting.key == setting_key,
            SystemSetting.deleted_at.is_(None),
        )
    )
    setting = result.scalars().first()

    if not setting:
        # Setting was deleted, recreate it
        old_value_before_rollback = None
        setting = SystemSetting(
            user_id=user.id,
            key=setting_key,
            value=rollback_value,
        )
        db.add(setting)
    else:
        # Update existing setting
        old_value_before_rollback = setting.value
        setting.value = rollback_value

    # Log the rollback action
    await _audit(
        db=db,
        user=user,
        action="rollback",
        setting_key=setting_key,
        old_value=old_value_before_rollback,
        new_value=rollback_value,
        details=f"Rolled back from audit entry #{audit_id}",
    )

    await db.commit()
    await db.refresh(setting)

    logger.info(
        f"System setting '{setting_key}' rolled back to audit entry {audit_id} "
        f"for user {user.id}"
    )
    return setting
