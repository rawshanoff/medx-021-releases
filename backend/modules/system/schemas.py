from pydantic import BaseModel


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
