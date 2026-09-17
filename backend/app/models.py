import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    CITIZEN = "citizen"
    MUNICIPAL_OFFICER = "municipal_officer"
    ADMINISTRATOR = "administrator"


class ComplaintStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"

def is_resolved(status: ComplaintStatus | str) -> bool:
    """Canonical definition of whether a complaint is considered resolved/closed."""
    val = status.value if isinstance(status, enum.Enum) else str(status)
    return val.lower() in ("resolved", "rejected")


class Authority(str, enum.Enum):
    PMC = "PMC"
    PUNE_TRAFFIC_POLICE = "PUNE_TRAFFIC_POLICE"
    NONE = "NONE"


class Severity(str, enum.Enum):
    NOT_ASSESSED = "not_assessed"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DuplicateLinkStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"


def utc_now() -> datetime:
    return datetime.now().astimezone()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    auth_provider: Mapped[str | None] = mapped_column(String(50))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), default=UserRole.CITIZEN)
    phone: Mapped[str | None] = mapped_column(String(30))
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"), index=True)
    ward_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("pune_wards.id"), index=True)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    authority: Mapped[Authority] = mapped_column(Enum(Authority, name="authority_enum"), default=Authority.PMC, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    default_department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PuneWard(Base):
    __tablename__ = "pune_wards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    ward_number: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    ward_name: Mapped[str | None] = mapped_column(String(120))
    geometry: Mapped[Any] = mapped_column(Geometry(geometry_type='MULTIPOLYGON', srid=4326, spatial_index=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class AdministrativeWardOffice(Base):
    __tablename__ = "administrative_ward_offices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    official_ward_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    office_name: Mapped[str] = mapped_column(String(120), nullable=False)
    ward_name: Mapped[str | None] = mapped_column(String(120))
    zone: Mapped[str | None] = mapped_column(String(50))
    geometry: Mapped[Any] = mapped_column(Geometry(geometry_type='MULTIPOLYGON', srid=4326, spatial_index=True), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(500))
    source_type: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    public_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    location: Mapped[Any | None] = mapped_column(Geometry(geometry_type='POINT', srid=4326, spatial_index=True))
    address: Mapped[str | None] = mapped_column(String(500))
    severity: Mapped[Severity] = mapped_column(Enum(Severity, name="severity"), default=Severity.NOT_ASSESSED)
    citizen_reported_severity: Mapped[Severity | None] = mapped_column(Enum(Severity, name="severity"), nullable=True)
    system_assessed_severity: Mapped[Severity | None] = mapped_column(Enum(Severity, name="severity"), nullable=True)
    status: Mapped[ComplaintStatus] = mapped_column(
        Enum(ComplaintStatus, name="complaint_status"), default=ComplaintStatus.SUBMITTED, index=True
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"), index=True)
    officer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    ward_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("pune_wards.id"), index=True)
    ward_name: Mapped[str | None] = mapped_column(String(120))
    
    administrative_ward_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("administrative_ward_offices.id"), index=True)
    administrative_ward_office: Mapped[str | None] = mapped_column(String(120))
    administrative_ward_name: Mapped[str | None] = mapped_column(String(120))
    administrative_zone: Mapped[str | None] = mapped_column(String(50))
    
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_escalated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    upvotes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    geographic_ward_number: Mapped[int | None] = mapped_column(Integer)

    base_priority_score: Mapped[int] = mapped_column(Integer, default=0, server_default='0', nullable=False)
    base_priority_reasons: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    admin_priority_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    admin_priority_remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ComplaintStatusHistory(Base):
    __tablename__ = "complaint_status_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("complaints.id"), index=True, nullable=False)
    old_status: Mapped[ComplaintStatus | None] = mapped_column(Enum(ComplaintStatus, name="complaint_status"))
    new_status: Mapped[ComplaintStatus] = mapped_column(Enum(ComplaintStatus, name="complaint_status"), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    remarks: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DuplicateLink(Base):
    __tablename__ = "duplicate_links"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("complaints.id"), nullable=False)
    possible_duplicate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("complaints.id"), nullable=False)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[DuplicateLinkStatus] = mapped_column(
        Enum(DuplicateLinkStatus, name="duplicate_link_status"), default=DuplicateLinkStatus.PENDING
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    complaint_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("complaints.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column("read", Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ResolutionEvidence(Base):
    __tablename__ = "resolution_evidence"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("complaints.id"), index=True, nullable=False)
    officer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(300), nullable=False)
    complaint_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("complaints.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
