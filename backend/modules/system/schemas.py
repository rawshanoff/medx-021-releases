from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional


class VersionResponse(BaseModel):
    version: str
    status: str


class UpdateCheckResponse(BaseModel):
    update_available: bool
    latest_version: str
    current_version: str
    release_notes: str
    download_url: str | None = None


class DoctorInfo(BaseModel):
    id: str
    name: str
    specialty: str


# System Settings Schemas


class SystemSettingCreate(BaseModel):
    value: Any  # Can be any JSON-serializable value


class SystemSettingUpdate(BaseModel):
    value: Any


class SystemSettingRead(BaseModel):
    id: int
    user_id: int
    key: str
    value: Any
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PrintSettingsValue(BaseModel):
    """Detailed schema for print_config setting value."""

    clinicName: str = "MedX Clinic"
    clinicPhone: str = ""
    clinicAddress: str = ""
    footerNote: str = ""
    underQrText: str = ""
    logoDataUrl: str = ""
    autoPrint: bool = False
    preferredPrinterName: str = ""
    preferredPrinterDeviceName: str = ""
    boldAllText: bool = True
    showTotalAmount: bool = True
    showPaymentType: bool = True
    showLogo: bool = True
    showClinicName: bool = True
    showClinicPhone: bool = True
    showClinicAddress: bool = True
    showDateTime: bool = True
    showQueue: bool = True
    showPatientName: bool = True
    showDoctor: bool = True
    showDoctorRoom: bool = True
    showServices: bool = True
    showQr: bool = True
    showUnderQrText: bool = True
    showFooterNote: bool = True
    silentPrintMode: str = "image"
    silentScalePercent: int = 100
    receiptWidthMode: str = "standard"
    receiptTemplateId: str = "check-6"
    paperSize: str = "80"
    qrUrl: str = ""
    qrImageDataUrl: str = ""


class SystemAuditLogRead(BaseModel):
    """Schema for audit log entries."""

    id: int
    action: str  # "create", "update", "delete", "rollback"
    setting_key: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    details: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

