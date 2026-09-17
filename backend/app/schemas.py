from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, EmailStr, BeforeValidator

from app.models import ComplaintStatus, Severity, UserRole, Authority


def _normalize_severity(v: str | Severity) -> str:
    """Normalize severity input to lowercase canonical values.
    Accepts 'HIGH', 'High', 'high' etc. and converts to 'high'.
    Raises ValueError for genuinely unsupported values.
    """
    if isinstance(v, Severity):
        return v.value
    if isinstance(v, str):
        lowered = v.strip().lower()
        # Map common uppercase enum member names to values
        name_to_value = {
            "not_assessed": "not_assessed",
            "low": "low",
            "medium": "medium",
            "high": "high",
            "critical": "critical",
        }
        if lowered in name_to_value:
            return name_to_value[lowered]
    return v  # Let Pydantic's enum validation catch truly invalid values


CaseInsensitiveSeverity = Annotated[Severity, BeforeValidator(_normalize_severity)]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    language: str = Field(default="en", pattern="^(en|hi)$")


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: UserRole
    phone: str | None
    language: str
    department_id: UUID | None = None
    department_name: str | None = None
    ward_id: UUID | None = None
    ward_name: str | None = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    default_department_id: UUID | None
    active: bool


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    authority: Authority
    active: bool


class ResolutionEvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    officer_id: UUID
    image_url: str
    remarks: str | None = None
    created_at: datetime


class ComplaintResponse(BaseModel):
    id: UUID
    public_id: str
    citizen_id: UUID
    category_id: UUID | None
    category_name: str | None = None
    description: str
    image_url: str | None
    latitude: float | None
    longitude: float | None
    address: str | None
    ward_name: str | None = None
    geographic_ward_number: int | None = None
    administrative_ward_office: str | None = None
    administrative_ward_name: str | None = None
    administrative_zone: str | None = None
    severity: Severity
    citizen_reported_severity: Severity | None = None
    system_assessed_severity: Severity | None = None
    status: ComplaintStatus
    department_id: UUID | None
    department_name: str | None = None
    authority: str | None = None
    officer_id: UUID | None
    officer_name: str | None = None
    sla_due_at: datetime | None = None
    is_escalated: bool = False
    upvotes: int = 0
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    resolution_evidence: ResolutionEvidenceResponse | None = None
    
    # Priority Engine
    priority_score: int = 0
    priority_reasons: list | dict | None = None
    admin_priority_override: int | None = None
    admin_priority_remarks: str | None = None
    effective_priority: int = 0

    # Dynamic SLA
    is_sla_breached: bool = False
    is_sla_approaching: bool = False


class StatusUpdateRequest(BaseModel):
    status: ComplaintStatus
    remarks: str | None = Field(default=None, max_length=2000)


class SeverityUpdateRequest(BaseModel):
    severity: CaseInsensitiveSeverity
    remarks: str | None = Field(default=None, max_length=2000)


class PriorityOverrideRequest(BaseModel):
    override_score: int | None = Field(default=None, ge=0, le=100, description="Override score 0-100, or null to clear")
    remarks: str | None = Field(default=None, max_length=500)


class DisputeRequest(BaseModel):
    remarks: str = Field(..., min_length=5, max_length=2000)


class AssignmentRequest(BaseModel):
    department_id: UUID | None = None
    officer_id: UUID | None = None


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    complaint_id: UUID | None = None
    title: str
    message: str
    is_read: bool
    created_at: datetime


class LeaderboardUser(BaseModel):
    id: UUID
    name: str
    points: int


class LeaderboardResponse(BaseModel):
    top_users: list[LeaderboardUser]


class MapComplaintResponse(BaseModel):
    id: UUID
    public_id: str
    latitude: float
    longitude: float
    category_name: str | None
    severity: Severity
    status: ComplaintStatus
    geographic_ward_number: int | None
    administrative_ward_name: str | None
    administrative_zone: str | None
    authority: Authority | None
    department_name: str | None
    officer_name: str | None


class HotspotResponse(BaseModel):
    id: str
    latitude: float
    longitude: float
    radius_meters: float
    category_name: str | None
    complaint_count: int
    open_count: int
    resolved_count: int
    status_breakdown: dict[str, int]
    severity_breakdown: dict[str, int]
    administrative_wards: list[str]
    zones: list[str]


class WardSummaryResponse(BaseModel):
    administrative_ward_name: str
    total_complaints: int
    open_complaints: int
    resolved_complaints: int
    in_progress_complaints: int
    overdue_complaints: int


class AIAnalysisResponse(BaseModel):
    category_name: str
    confidence: float
    rationale: str
    provider: str | None = None
    model: str | None = None


class DuplicateResponse(BaseModel):
    complaint_public_id: str
    similarity_score: float
    status: str


class RelatedComplaintResponse(BaseModel):
    public_id: str
    category_name: str | None = None
    status: str
    severity: str
    latitude: float | None = None
    longitude: float | None = None
    administrative_ward_name: str | None = None
    geographic_ward_number: int | None = None
    created_at: datetime
    distance_meters: float
    match_score: int
    match_reasons: list[str]


class UserRoleUpdateRequest(BaseModel):
    role: UserRole
    department_id: UUID | None = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_id: UUID | None
    action: str
    entity_type: str
    entity_id: str
    metadata_json: dict | None = None
    timestamp: datetime


class RewardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    points: int
    reason: str
    complaint_id: UUID | None
    created_at: datetime


class UserRewardsSummary(BaseModel):
    total_points: int
    history: list[RewardResponse]


class LeaderboardEntry(BaseModel):
    user_name: str
    points: int
    complaints_resolved: int


class TrendDataPoint(BaseModel):
    date: str
    submitted: int
    resolved: int


class DepartmentWorkload(BaseModel):
    department_name: str
    total: int
    open: int
    in_progress: int
    resolved: int
    overdue: int
    assigned: int
    unassigned: int


class AnalyticsDetailedResponse(BaseModel):
    kpis: dict[str, float]
    trends: list[TrendDataPoint]
    status_distribution: dict[str, int]
    severity_analysis: dict[str, dict[str, int]]
    ward_summary: list[WardSummaryResponse]
    department_workload: list[DepartmentWorkload]
    sla_analytics: dict[str, int]
    resolution_performance: dict[str, float]
    escalation_insights: dict[str, int]


class RoutingPreviewRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    category_name: str


class RoutingPreviewResponse(BaseModel):
    authority: Authority | None
    department_name: str | None
    geographic_ward_number: int | None
    administrative_ward_office: str | None
    administrative_ward_name: str | None
    administrative_zone: str | None = None
    assignment_status: str

