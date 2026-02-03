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


@router.get("/settings/audit/{setting_key}")
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
    
    return [
        {
            "id": log.id,
            "action": log.action,
            "setting_key": log.setting_key,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
