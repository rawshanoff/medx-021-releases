from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.core.database import Base, SoftDeleteMixin


class SystemSetting(SoftDeleteMixin, Base):
    """User-specific system settings (e.g., print configuration, UI preferences)."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    key = Column(String, nullable=False, index=True)
    value = Column(JSON, nullable=False)  # Can store any JSON-serializable value
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Constraints & Indices
    __table_args__ = (
        UniqueConstraint("user_id", "key", name="uq_user_setting_key"),
        Index("ix_system_settings_user_id_key", "user_id", "key"),
    )

    # Relationships
    user = relationship("User", back_populates="system_settings")


class SystemAuditLog(SoftDeleteMixin, Base):
    """Audit log for system settings changes (who changed what, when, old value -> new value)."""
    __tablename__ = "system_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String, nullable=False)  # "update", "create", "delete"
    setting_key = Column(String, nullable=False)  # e.g., "print_config"
    old_value = Column(JSON, nullable=True)  # Previous value (null for create)
    new_value = Column(JSON, nullable=True)  # New value (null for delete)
    details = Column(String, nullable=True)  # Additional details
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Constraints & Indices
    __table_args__ = (
        Index("ix_system_audit_log_user_id", "user_id"),
        Index("ix_system_audit_log_created_at", "created_at"),
    )

    # Relationships
    user = relationship("User")
