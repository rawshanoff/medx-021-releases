from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from backend.core.database import Base
import enum

class QueueStatus(str, enum.Enum):
    WAITING = "WAITING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class QueueItem(Base):
    __tablename__ = "queue_items"
    __table_args__ = (
        UniqueConstraint("doctor_id", "queue_date", "sequence", name="uq_queue_doctor_date_seq"),
    )

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(10), nullable=False)  # e.g., "A-001", "B-042"
    queue_date = Column(Date, nullable=False, server_default=func.current_date())
    sequence = Column(Integer, nullable=False, server_default="1")
    patient_name = Column(String, nullable=False) # Snapshot name in case patient deleted? Or just link.
    # We can link specifically to a patient or keep it simple. Linking is better.
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True) 
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    
    status = Column(String, default=QueueStatus.WAITING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    patient = relationship("Patient")
    doctor = relationship("Doctor")
