from backend.core.database import Base
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    birth_date = Column(Date, nullable=True)
    gender = Column(String(10), nullable=True)  # 'M' or 'F'
    address = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)
    category = Column(String, default="standard")  # standard, vip, blacklist
    balance = Column(Integer, default=0)  # Simple integer for cents/tiyin or main unit.

    # Telegram linking (for paid telegram_patient module)
    telegram_chat_id = Column(BigInteger, nullable=True)
    telegram_username = Column(String, nullable=True)

    # Relationships
    appointments = relationship("Appointment", back_populates="patient")

    is_blacklisted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Patient {self.full_name}>"
