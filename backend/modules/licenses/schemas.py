from pydantic import BaseModel


class LicenseUpload(BaseModel):
    token: str


class LicenseStatus(BaseModel):
    active_features: list[str]
    error: str | None = None

