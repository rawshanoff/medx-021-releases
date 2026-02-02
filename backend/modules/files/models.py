import enum
from uuid import uuid4

from backend.core.database import Base, SoftDeleteMixin
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class PatientFileType(str, enum.Enum):
    UZD = "uzd"
    ANALYSIS = "analysis"
    OTHER = "other"


class PatientFile(SoftDeleteMixin, Base):
    __tablename__ = "patient_files"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    visit_id = Column(Integer, nullable=True, index=True)

    file_type = Column(String, nullable=False, default=PatientFileType.OTHER.value)
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False, unique=True)
    mime = Column(String, nullable=True)
    size = Column(Integer, nullable=False, default=0)
    sha256 = Column(String(64), nullable=False)

    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient")
    created_by = relationship("User")


class FileDeliveryStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"


class FileDeliveryLog(SoftDeleteMixin, Base):
    __tablename__ = "file_delivery_log"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(
        Integer, ForeignKey("patient_files.id"), nullable=False, index=True
    )
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)

    channel = Column(String, nullable=False, default="telegram")
    status = Column(String, nullable=False)
    sent_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    error = Column(String, nullable=True)

    file = relationship("PatientFile")
    patient = relationship("Patient")
    sent_by = relationship("User")


class TelegramLinkToken(SoftDeleteMixin, Base):
    __tablename__ = "telegram_link_tokens"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient")

    @staticmethod
    def new_code() -> str:
        return uuid4().hex
