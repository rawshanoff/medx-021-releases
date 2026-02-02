from backend.core.config import settings
from backend.core.updater import updater
from backend.modules.auth import require_roles
from backend.modules.system.schemas import (
    DoctorInfo,
    UpdateCheckResponse,
    VersionResponse,
)
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends

router = APIRouter()


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
    """Проверка наличия обновлений"""
    current_version = settings.CURRENT_VERSION

    # Если URL для проверки обновлений не задан, возвращаем текущую версию
    if not settings.UPDATE_CHECK_URL:
        return {
            "update_available": False,
            "latest_version": current_version,
            "current_version": current_version,
            "release_notes": "Update check URL not configured",
        }

    try:
        # Используем updater для проверки обновлений
        update_info = await updater.check_for_updates()
        if update_info:
            return {
                "update_available": True,
                "latest_version": update_info["latest"],
                "current_version": update_info["current"],
                "release_notes": f"Update available: {update_info['latest']}",
                "download_url": update_info.get("url"),
            }
        else:
            return {
                "update_available": False,
                "latest_version": current_version,
                "current_version": current_version,
                "release_notes": "You are using the latest version",
            }
    except Exception as e:
        # В случае ошибки возвращаем текущую версию без ошибки
        return {
            "update_available": False,
            "latest_version": current_version,
            "current_version": current_version,
            "release_notes": f"Update check failed: {str(e)}",
        }


@router.get("/doctors", response_model=list[DoctorInfo])
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
