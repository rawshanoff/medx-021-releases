from backend.modules.auth import require_roles
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends

router = APIRouter()


@router.get("/version")
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


@router.get("/update-check")
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
