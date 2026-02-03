import logging
import json
from backend.modules.auth import require_roles, get_current_user
from backend.modules.users.models import UserRole, User
from backend.modules.system.models import SystemSetting, SystemAuditLog
from backend.modules.system.schemas import (
    VersionResponse,
    UpdateCheckResponse,
    DoctorInfo,
    SystemSettingCreate,
    SystemSettingRead,
    SystemSettingUpdate,
    PrintSettingsValue,
    SystemAuditLogRead,
)
from backend.core.database import get_db
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("medx")
router = APIRouter()


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
    return {"version": "1.0.0-mvp", "status": "active"}


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
    # Mock update check
    return {
        "update_available": False,
        "latest_version": "1.0.0",
        "current_version": "1.0.0",
        "release_notes": "Initial release",
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
    """
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
        old_value=setting.value if setting else rollback_value,
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

