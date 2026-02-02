from pydantic import BaseModel


class VersionResponse(BaseModel):
    version: str
    status: str


class UpdateCheckResponse(BaseModel):
    update_available: bool
    latest_version: str
    current_version: str
    release_notes: str


class DoctorInfo(BaseModel):
    id: str
    name: str
    specialty: str
