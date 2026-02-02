from backend.core.database import Base, SoftDeleteMixin
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class Doctor(SoftDeleteMixin, Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True, nullable=False)
    specialty = Column(String, nullable=True)
    queue_prefix = Column(
        String(1), default="A", nullable=False
    )  # A, B, C for queue numbering
    is_active = Column(Boolean, default=True)

    services = relationship(
        "DoctorService", back_populates="doctor", cascade="all, delete-orphan"
    )


class DoctorService(SoftDeleteMixin, Base):
    __tablename__ = "doctor_services"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "Primary Consultation"
    price = Column(Integer, default=0)
    priority = Column(
        Integer, default=0
    )  # Higher number = higher priority (default selection)

    doctor = relationship("Doctor", back_populates="services")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)  # e.g. "Create Doctor"
    details = Column(String, nullable=True)  # e.g. "Created Dr. House"
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
