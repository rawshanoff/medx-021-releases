from backend.core.licenses import license_manager
from backend.modules.auth import require_roles
from backend.modules.licenses.schemas import LicenseStatus, LicenseUpload
from backend.modules.users.models import UserRole
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/licenses", tags=["Licenses"])


@router.get("/status", response_model=LicenseStatus)
async def license_status(
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
    payload = license_manager.load_license()
    if "error" in payload:
        return LicenseStatus(active_features=[], error=payload["error"])
    return LicenseStatus(
        active_features=license_manager.get_active_features(), error=None
    )


@router.post("/upload", response_model=LicenseStatus)
async def upload_license(
    data: LicenseUpload,
    _user=Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
):
    token = (data.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Empty license token")

    # Persist to server-side license.key (used by LicenseManager)
    try:
        license_manager.save_license_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save license: {e}"
        ) from e

    payload = license_manager.load_license()
    if "error" in payload:
        return LicenseStatus(active_features=[], error=payload["error"])
    return LicenseStatus(
        active_features=license_manager.get_active_features(), error=None
    )
