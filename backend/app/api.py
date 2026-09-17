import hashlib
import io
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.dependencies import get_current_user, get_session, require_roles
from app.models import (
    AuditLog,
    Authority,
    Category,
    Complaint,
    ComplaintStatus,
    ComplaintStatusHistory,
    Department,
    DuplicateLink,
    DuplicateLinkStatus,
    Notification,
    ResolutionEvidence,
    Reward,
    Severity,
    User,
    UserRole,
    PuneWard,
    is_resolved,
    AdministrativeWardOffice,
)
from app.schemas import (
    AIAnalysisResponse,
    AnalyticsDetailedResponse,
    AssignmentRequest,
    AuditLogResponse,
    CategoryResponse,
    ComplaintResponse,
    DepartmentResponse,
    DisputeRequest,
    DuplicateResponse,
    HotspotResponse,
    LeaderboardEntry,
    LoginRequest,
    MapComplaintResponse,
    NotificationResponse,
    RegisterRequest,
    RelatedComplaintResponse,
    ResolutionEvidenceResponse,
    RewardResponse,
    RoutingPreviewRequest,
    RoutingPreviewResponse,
    StatusUpdateRequest,
    SeverityUpdateRequest,
    TokenResponse,
    UserResponse,
    UserRewardsSummary,
    UserRoleUpdateRequest,
    WardSummaryResponse,
    PuneWardResponse,
)
from app.security import create_access_token, hash_password, verify_password
from app.services import (
    assign_officer_to_complaint,
    audit,
    calculate_sla_due_at,
    category_by_name,
    classify_demo_image,
    find_related_complaints,
    get_ward_from_coordinates,
    get_administrative_ward_from_coordinates,
    make_public_id,
    notify,
    upload_path,
)

router = APIRouter(prefix="/api")

@router.get("/diag_gemini")
def diag_gemini():
    from app.core.config import get_settings
    import os
    s = get_settings()
    return {
        "model": s.gemini_model,
        "enabled": s.gemini_classifier_enabled,
        "has_key": bool(s.gemini_api_key),
        "os_env": os.environ.get("GEMINI_MODEL")
    }

@router.get("/diag_max_id")
async def diag_max_id(session: AsyncSession = Depends(get_session)):
    from sqlalchemy import text
    result = await session.execute(text("SELECT public_id FROM complaints WHERE public_id LIKE 'CIV-%'"))
    ids = [row[0] for row in result.all()]
    nums = []
    for pid in ids:
        try:
            nums.append(int(pid.replace('CIV-', '')))
        except:
            pass
    return {"max_id": max(nums) if nums else 0}


def _response(
    complaint: Complaint,
    category: Category | None = None,
    department: Department | None = None,
    evidence: ResolutionEvidence | None = None,
    officer: User | None = None,
) -> ComplaintResponse:
    resp = ComplaintResponse(
        id=complaint.id,
        public_id=complaint.public_id,
        citizen_id=complaint.citizen_id,
        category_id=complaint.category_id,
        category_name=category.name if category else None,
        description=complaint.description,
        image_url=complaint.image_url,
        latitude=complaint.latitude,
        longitude=complaint.longitude,
        address=complaint.address,
        ward_name=complaint.ward_name,
        geographic_ward_number=complaint.geographic_ward_number,
        administrative_ward_office=complaint.administrative_ward_office,
        administrative_ward_name=complaint.administrative_ward_name,
        administrative_zone=complaint.administrative_zone,
        severity=complaint.severity,
        citizen_reported_severity=complaint.citizen_reported_severity,
        system_assessed_severity=complaint.system_assessed_severity,
        status=complaint.status,
        department_id=complaint.department_id,
        department_name=department.name if department else None,
        authority=department.authority.value if department else None,
        officer_id=complaint.officer_id,
        officer_name=officer.name if officer else None,
        sla_due_at=complaint.sla_due_at,
        is_escalated=complaint.is_escalated,
        upvotes=complaint.upvotes,
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
        resolved_at=complaint.resolved_at,
        resolution_evidence=ResolutionEvidenceResponse.model_validate(evidence) if evidence else None,
        priority_score=complaint.base_priority_score or 0,
        priority_reasons=complaint.base_priority_reasons,
        admin_priority_override=complaint.admin_priority_override,
        admin_priority_remarks=complaint.admin_priority_remarks,
        effective_priority=0, # Placeholder, will be computed below
    )
    from app.priority import get_effective_priority
    eff_pri, all_reasons, engine_pri = get_effective_priority(complaint)
    resp.effective_priority = eff_pri
    resp.priority_score = engine_pri
    resp.priority_reasons = all_reasons

    if complaint.sla_due_at and complaint.status not in (ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        delta = complaint.sla_due_at - now
        if delta.total_seconds() < 0:
            resp.is_sla_breached = True
        elif delta.total_seconds() <= 14400: # 4 hours
            resp.is_sla_approaching = True

    return resp


async def _get_complaint(session: AsyncSession, complaint_ref: str) -> Complaint:
    complaint = await session.scalar(select(Complaint).where(Complaint.public_id == complaint_ref))
    if complaint is None:
        try:
            complaint = await session.get(Complaint, uuid.UUID(complaint_ref))
        except ValueError:
            pass
    if complaint is None:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint


async def _complaint_response(session: AsyncSession, complaint: Complaint) -> ComplaintResponse:
    category = await session.get(Category, complaint.category_id) if complaint.category_id else None
    department = await session.get(Department, complaint.department_id) if complaint.department_id else None
    officer = await session.get(User, complaint.officer_id) if complaint.officer_id else None

    # Get latest resolution evidence if multiple exist
    evidence = await session.scalar(
        select(ResolutionEvidence)
        .where(ResolutionEvidence.complaint_id == complaint.id)
        .order_by(ResolutionEvidence.created_at.desc())
    )

    return _response(complaint, category, department, evidence, officer)


def _can_view(user: User, complaint: Complaint) -> bool:
    return user.role == UserRole.ADMINISTRATOR or complaint.citizen_id == user.id or (
        user.role == UserRole.MUNICIPAL_OFFICER and complaint.department_id == user.department_id
    )





@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    if await session.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="Email is already registered")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.CITIZEN,
        phone=payload.phone,
        language=payload.language,
    )
    session.add(user)
    await audit(session, user.id, "register", "user", str(user.id))
    await session.commit()
    await session.refresh(user)
    return TokenResponse(access_token=create_access_token(str(user.id), user.role.value), user=user)


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> dict:
    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    resp_user = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    if user.department_id:
        dept = await session.get(Department, user.department_id)
        if dept:
            resp_user["department_name"] = dept.name
    if user.ward_id:
        ward = await session.get(PuneWard, user.ward_id)
        if ward:
            resp_user["ward_name"] = ward.ward_name or str(ward.ward_number)

    return {"access_token": create_access_token(str(user.id), user.role.value), "token_type": "bearer", "user": resp_user}


@router.get("/auth/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)) -> dict:
    resp = {c.name: getattr(current_user, c.name) for c in current_user.__table__.columns}
    if current_user.department_id:
        dept = await session.get(Department, current_user.department_id)
        if dept:
            resp["department_name"] = dept.name
    if current_user.ward_id:
        ward = await session.get(PuneWard, current_user.ward_id)
        if ward:
            resp["ward_name"] = ward.ward_name or str(ward.ward_number)
    return resp


@router.get("/diag_gemini", tags=["system"])
async def diag_gemini():
    from app.core.config import get_settings
    settings = get_settings()
    return {
        "GEMINI_ENABLED": settings.gemini_classifier_enabled,
        "GEMINI_MODEL": settings.gemini_model,
        "GEMINI_KEY_PRESENT": bool(settings.gemini_api_key)
    }

@router.get("/categories", response_model=list[CategoryResponse])
async def categories(session: AsyncSession = Depends(get_session)):
    return (await session.scalars(select(Category).where(Category.active.is_(True)).order_by(Category.name))).all()


@router.get("/departments", response_model=list[DepartmentResponse])
async def get_departments(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Department).order_by(Department.name))
    return result.scalars().all()

@router.get("/pune-wards", response_model=list[PuneWardResponse])
async def get_pune_wards(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(PuneWard).order_by(PuneWard.ward_number))
    return result.scalars().all()


@router.post("/complaints/analyze", response_model=AIAnalysisResponse)
async def analyze_upload(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    import re
    import logging
    content = await file.read()
    _validate_image(file, content)
    category_name, confidence, rationale = classify_demo_image(file.filename or "upload.jpg", content)

    provider = "unknown"
    model = "unknown"
    match = re.match(r"^\[provider=([^,\]]+)(?:,\s*model=([^\]]+))?\]\s*(.*)$", rationale)
    if match:
        provider = match.group(1).strip()
        model = match.group(2).strip() if match.group(2) else "unknown"
        clean_rationale = match.group(3).strip()
    else:
        clean_rationale = rationale

    logging.getLogger(__name__).info(f"provider={provider} model={model} category={category_name}")

    return AIAnalysisResponse(
        category_name=category_name,
        confidence=confidence,
        rationale=clean_rationale,
        provider=provider,
        model=model
    )


def _validate_image(file: UploadFile, content: bytes) -> None:
    settings = get_settings()
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WebP images are allowed")
    if not content or len(content) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 5 MB")
    try:
        image = Image.open(io.BytesIO(content))
        image.verify()
        if image.width * image.height > 24_000_000:
            raise HTTPException(status_code=413, detail="Image dimensions are too large")
    except UnidentifiedImageError as error:
        raise HTTPException(status_code=415, detail="Uploaded file is not a valid image") from error

async def _resolve_routing(session: AsyncSession, latitude: float | None, longitude: float | None, category: Category):
    ward = await get_ward_from_coordinates(session, latitude, longitude)
    admin_ward = await get_administrative_ward_from_coordinates(session, latitude, longitude)

    category_dept = await session.get(Department, category.default_department_id) if category.default_department_id else None

    if not category_dept or category_dept.authority != Authority.PMC:
        admin_ward = None

    return ward, admin_ward, category_dept

@router.post("/complaints/routing-preview", response_model=RoutingPreviewResponse)
async def routing_preview(
    payload: RoutingPreviewRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    category = await category_by_name(session, payload.category_name)
    if not category:
        raise HTTPException(status_code=400, detail="Invalid category")

    ward, admin_ward, category_dept = await _resolve_routing(session, payload.latitude, payload.longitude, category)

    assigned_officer = None
    if category_dept:
        assigned_officer = await assign_officer_to_complaint(session, category_dept.id, ward.id if ward else None)

    assignment_status = "Ward Office / Manual Triage"
    if assigned_officer:
        assignment_status = "Auto-assign to available officer"
    elif not category_dept:
        assignment_status = "No municipal department"
    elif category_dept.authority != Authority.PMC:
        assignment_status = "Not handled by PMC"

    return RoutingPreviewResponse(
        authority=category_dept.authority if category_dept else None,
        department_name=category_dept.name if category_dept else None,
        geographic_ward_number=ward.ward_number if ward else None,
        administrative_ward_office=admin_ward.office_name if admin_ward else None,
        administrative_ward_name=admin_ward.ward_name if admin_ward else None,
        administrative_zone=str(admin_ward.zone) if admin_ward and admin_ward.zone else None,
        assignment_status=assignment_status
    )


@router.post("/complaints", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    description: str = Form(..., min_length=10, max_length=3000),
    file: UploadFile = File(...),
    category_id: uuid.UUID | None = Form(default=None),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
    address: str | None = Form(default=None, max_length=500),
    severity: str = Form(default="not_assessed"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ComplaintResponse:
    # Normalize severity: accept any case variation
    severity_normalized = severity.strip().lower()
    try:
        severity_enum = Severity(severity_normalized)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid severity value: '{severity}'. Allowed: not_assessed, low, medium, high, critical")
    try:
        content = await file.read()
        _validate_image(file, content)
        predicted_name, confidence, _ = classify_demo_image(file.filename or "upload.jpg", content)
        category = await session.get(Category, category_id) if category_id else await category_by_name(session, predicted_name)
        if category is None or not category.active:
            raise HTTPException(status_code=400, detail="Selected category is unavailable")

        location = upload_path(get_settings().upload_dir, file.filename or "upload.jpg")
        Path(location).parent.mkdir(parents=True, exist_ok=True)
        location.write_bytes(content)

        ward, admin_ward, category_dept = await _resolve_routing(session, latitude, longitude, category)

        assigned_officer = None
        if category_dept:
            assigned_officer = await assign_officer_to_complaint(session, category_dept.id, ward.id if ward else None)

        point = f'SRID=4326;POINT({longitude} {latitude})' if longitude is not None and latitude is not None else None

        complaint = Complaint(
            public_id=await make_public_id(session),
            citizen_id=current_user.id,
            category_id=category.id,
            description=description,
            image_url=f"/uploads/{location.name}",
            latitude=latitude,
            longitude=longitude,
            location=point,
            address=address,
            ward_id=ward.id if ward else None,
            ward_name=str(ward.ward_number) if ward else None,
            geographic_ward_number=ward.ward_number if ward else None,
            administrative_ward_id=admin_ward.id if admin_ward else None,
            administrative_ward_office=admin_ward.office_name if admin_ward else None,
            administrative_ward_name=admin_ward.ward_name if admin_ward else None,
            administrative_zone=admin_ward.zone if admin_ward else None,
            citizen_reported_severity=severity_enum,
            system_assessed_severity=Severity.NOT_ASSESSED,
            severity=severity_enum,
            sla_due_at=calculate_sla_due_at(severity_enum),
            department_id=category.default_department_id,
            officer_id=assigned_officer.id if assigned_officer else None,
        )

        from app.priority import calculate_base_priority
        related_count = 0
        if latitude is not None and longitude is not None:
            related = await find_related_complaints(session, latitude, longitude, category.id)
            related_count = len(related)
        
        base_score, base_reasons = calculate_base_priority(complaint, related_count)
        complaint.base_priority_score = base_score
        complaint.base_priority_reasons = base_reasons

        session.add(complaint)
        await session.flush()

        routing_metadata = {
            "ward_id": str(ward.id) if ward else None,
            "department_id": str(category.default_department_id) if category.default_department_id else None,
            "assigned_officer_id": str(assigned_officer.id) if assigned_officer else None,
            "reason": "Officer assigned via load-balancing in ward" if assigned_officer else "No eligible officer in ward"
        }
        await audit(session, current_user.id, "route_complaint", "complaint", str(complaint.id), routing_metadata)
        session.add(
            ComplaintStatusHistory(
                complaint_id=complaint.id,
                old_status=None,
                new_status=ComplaintStatus.SUBMITTED,
                changed_by=current_user.id,
                remarks=f"AI suggested {predicted_name} ({confidence:.0%}); citizen category recorded.",
            )
        )
        await audit(session, current_user.id, "create", "complaint", str(complaint.id))
        await notify(session, current_user.id, complaint.id, "Complaint Submitted", f"Your complaint {complaint.public_id} has been submitted successfully.")

        # Event-driven alerts
        from app.models import NotificationEventType
        from app.services import emit_operational_alert
        if severity_enum == Severity.CRITICAL:
            event_key = f"critical-creation:{complaint.id}"
            title = "Critical severity complaint created"
            message = f"Complaint {complaint.public_id} was submitted with CRITICAL severity."
            if assigned_officer:
                await emit_operational_alert(session, assigned_officer.id, complaint.id, title, message, NotificationEventType.CRITICAL_SEVERITY.value, event_key)
            else:
                admins = (await session.scalars(select(User).where(User.role == UserRole.ADMINISTRATOR))).all()
                for admin in admins:
                    await emit_operational_alert(session, admin.id, complaint.id, title, message, NotificationEventType.CRITICAL_SEVERITY.value, event_key)
                    
        # RELATED_SPIKE threshold crossing
        if related_count == 4: # Previous count was 4, this new one makes it 5 (the threshold)
            event_key = f"related-spike:{complaint.category_id}:{complaint.ward_id}" # or just unique key
            # To be simpler and idempotent for this specific complaint triggering it:
            event_key = f"related-threshold:{complaint.id}"
            title = "Related complaint spike detected"
            message = f"Complaint {complaint.public_id} triggered a spike (5+ related complaints) in its area."
            if assigned_officer:
                await emit_operational_alert(session, assigned_officer.id, complaint.id, title, message, NotificationEventType.RELATED_SPIKE.value, event_key)
            else:
                admins = (await session.scalars(select(User).where(User.role == UserRole.ADMINISTRATOR))).all()
                for admin in admins:
                    await emit_operational_alert(session, admin.id, complaint.id, title, message, NotificationEventType.RELATED_SPIKE.value, event_key)

        from app.priority import get_effective_priority
        from app.services import check_and_emit_priority_alert
        new_eff_pri, _, _ = get_effective_priority(complaint)
        await check_and_emit_priority_alert(session, complaint, 0, new_eff_pri)

        await session.commit()
        await session.refresh(complaint)
        return await _complaint_response(session, complaint)
    except Exception as e:
        import traceback
        with open("error_traceback.txt", "w") as f:
            f.write(traceback.format_exc())
        raise e


@router.get("/complaints/my", response_model=list[ComplaintResponse])
async def my_complaints(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    items = (await session.scalars(select(Complaint).where(Complaint.citizen_id == current_user.id).order_by(Complaint.created_at.desc()))).all()
    return [await _complaint_response(session, item) for item in items]


@router.get("/complaints/check-related", response_model=list[RelatedComplaintResponse])
async def check_related_complaints_pre(
    latitude: float,
    longitude: float,
    category_name: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Pre-submission related complaint check (uses category_name, no complaint ID)."""
    cat = await category_by_name(session, category_name)
    if not cat:
        return []

    related = await find_related_complaints(
        session=session,
        latitude=latitude,
        longitude=longitude,
        category_id=cat.id
    )
    return related


@router.get("/complaints/{complaint_ref}", response_model=ComplaintResponse)
async def complaint_detail(complaint_ref: str, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)
    if not _can_view(current_user, complaint):
        raise HTTPException(status_code=403, detail="You cannot access this complaint")
    return await _complaint_response(session, complaint)


@router.get("/complaints/{complaint_ref}/timeline")
async def complaint_timeline(complaint_ref: str, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)
    if not _can_view(current_user, complaint):
        raise HTTPException(status_code=403, detail="You cannot access this complaint")
    return (await session.scalars(select(ComplaintStatusHistory).where(ComplaintStatusHistory.complaint_id == complaint.id).order_by(ComplaintStatusHistory.timestamp))).all()


@router.patch("/complaints/{complaint_ref}/status", response_model=ComplaintResponse)
async def update_status(complaint_ref: str, payload: StatusUpdateRequest, current_user: User = Depends(require_roles(UserRole.MUNICIPAL_OFFICER, UserRole.ADMINISTRATOR)), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)

    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if current_user.department_id and complaint.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot modify complaints outside your department scope")
        if not current_user.department_id and complaint.officer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot modify complaints outside your assignment scope")

    old_status = complaint.status
    if old_status in (ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Finalized complaints cannot be modified")
    if old_status == payload.status:
        return await _complaint_response(session, complaint)

    # Restrict status transitions
    if old_status == ComplaintStatus.SUBMITTED and payload.status not in (ComplaintStatus.ASSIGNED, ComplaintStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Invalid status transition from Submitted")
    if old_status == ComplaintStatus.ASSIGNED and payload.status not in (ComplaintStatus.IN_PROGRESS, ComplaintStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Invalid status transition from Assigned")

    if payload.status == ComplaintStatus.RESOLVED and not await session.scalar(select(ResolutionEvidence).where(ResolutionEvidence.complaint_id == complaint.id)):
        raise HTTPException(status_code=400, detail="Resolution evidence is required before resolving")

    complaint.status = payload.status
    if payload.status == ComplaintStatus.RESOLVED:
        complaint.resolved_at = func.now()
        if old_status != ComplaintStatus.RESOLVED:
            session.add(Reward(user_id=complaint.citizen_id, points=50, reason=f"Issue {complaint.public_id} successfully resolved", complaint_id=complaint.id))
    session.add(ComplaintStatusHistory(complaint_id=complaint.id, old_status=old_status, new_status=payload.status, changed_by=current_user.id, remarks=payload.remarks))
    await notify(session, complaint.citizen_id, complaint.id, "Complaint status updated", f"{complaint.public_id} is now {payload.status.value.replace('_', ' ')}.")
    await audit(session, current_user.id, "status_change", "complaint", str(complaint.id), {"from": old_status.value, "to": payload.status.value})
    await session.commit()
    await session.refresh(complaint)
    return await _complaint_response(session, complaint)


@router.patch("/complaints/{complaint_ref}/severity", response_model=ComplaintResponse)
async def update_severity(complaint_ref: str, payload: SeverityUpdateRequest, current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)

    old_severity = complaint.severity
    if old_severity == payload.severity:
        return await _complaint_response(session, complaint)

    from app.priority import get_effective_priority
    old_eff_pri, _, _ = get_effective_priority(complaint)

    complaint.severity = payload.severity
    await audit(session, current_user.id, "severity_change", "complaint", str(complaint.id), {"from": old_severity.value, "to": payload.severity.value, "remarks": payload.remarks})
    
    # Also update base priority score when severity changes
    from app.priority import calculate_base_priority
    related_count = 0
    if complaint.latitude is not None and complaint.longitude is not None:
        related = await find_related_complaints(session, complaint.latitude, complaint.longitude, complaint.category_id)
        related_count = len(related)
    base_score, base_reasons = calculate_base_priority(complaint, related_count)
    complaint.base_priority_score = base_score
    complaint.base_priority_reasons = base_reasons

    new_eff_pri, _, _ = get_effective_priority(complaint)
    from app.services import check_and_emit_priority_alert
    await check_and_emit_priority_alert(session, complaint, old_eff_pri, new_eff_pri)

    await session.commit()
    await session.refresh(complaint)
    return await _complaint_response(session, complaint)


from app.schemas import PriorityOverrideRequest

@router.patch("/complaints/{complaint_ref}/priority", response_model=ComplaintResponse)
async def update_priority(complaint_ref: str, payload: PriorityOverrideRequest, current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)
    
    from app.priority import get_effective_priority
    old_eff_pri, _, _ = get_effective_priority(complaint)

    old_val = complaint.admin_priority_override
    if old_val == payload.override_score:
        return await _complaint_response(session, complaint)
    
    complaint.admin_priority_override = payload.override_score
    await audit(session, current_user.id, "priority_override", "complaint", str(complaint.id), {"from": old_val, "to": payload.override_score, "remarks": payload.remarks})
    
    new_eff_pri, _, _ = get_effective_priority(complaint)
    from app.services import check_and_emit_priority_alert
    await check_and_emit_priority_alert(session, complaint, old_eff_pri, new_eff_pri)

    await session.commit()
    await session.refresh(complaint)
    return await _complaint_response(session, complaint)


@router.post("/complaints/{complaint_ref}/upvote", response_model=ComplaintResponse)
async def upvote_complaint(complaint_ref: str, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)
    complaint.upvotes += 1
    await session.commit()
    await session.refresh(complaint)
    return await _complaint_response(session, complaint)


@router.post("/complaints/{complaint_ref}/resolution", response_model=ComplaintResponse)
async def add_resolution(complaint_ref: str, file: UploadFile = File(...), remarks: str | None = Form(default=None, max_length=2000), current_user: User = Depends(require_roles(UserRole.MUNICIPAL_OFFICER, UserRole.ADMINISTRATOR)), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)

    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if current_user.department_id and complaint.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot resolve complaints outside your department scope")
        if not current_user.department_id and complaint.officer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot resolve complaints outside your assignment scope")

    content = await file.read()
    _validate_image(file, content)
    if complaint.image_url:
        orig_filename = Path(complaint.image_url).name
        orig_file_path = Path(get_settings().upload_dir) / orig_filename
        if orig_file_path.exists():
            orig_bytes = orig_file_path.read_bytes()
            if hashlib.sha256(content).hexdigest() == hashlib.sha256(orig_bytes).hexdigest():
                raise HTTPException(
                    status_code=400,
                    detail="Resolution Fraud Detected: You cannot re-upload the citizen's original issue photo as proof of work!",
                )
    location = upload_path(get_settings().upload_dir, file.filename or "evidence.jpg")
    Path(location).write_bytes(content)
    session.add(ResolutionEvidence(complaint_id=complaint.id, officer_id=current_user.id, image_url=f"/uploads/{location.name}", remarks=remarks))
    await audit(session, current_user.id, "add_resolution_evidence", "complaint", str(complaint.id))
    await notify(session, complaint.citizen_id, complaint.id, "Resolution Submitted", f"Proof of work was submitted for {complaint.public_id}.")
    await session.commit()
    return await _complaint_response(session, complaint)


@router.post("/complaints/{complaint_ref}/dispute", response_model=ComplaintResponse)
async def dispute_complaint(
    complaint_ref: str,
    request: DisputeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    complaint = await _get_complaint(session, complaint_ref)
    if complaint.citizen_id != current_user.id and current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="Only the reporting citizen can dispute or appeal")

    if complaint.status not in (ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Only resolved or rejected complaints can be disputed/appealed")

    old_status = complaint.status
    complaint.status = ComplaintStatus.IN_PROGRESS
    complaint.is_escalated = True
    complaint.resolved_at = None

    is_appeal = old_status == ComplaintStatus.REJECTED
    action_label = "APPEALED" if is_appeal else "DISPUTED"

    session.add(
        ComplaintStatusHistory(
            complaint_id=complaint.id,
            old_status=old_status,
            new_status=ComplaintStatus.IN_PROGRESS,
            changed_by=current_user.id,
            remarks=f"{action_label} BY CITIZEN: {request.remarks}",
        )
    )
    await audit(session, current_user.id, f"{action_label.lower()}_resolution", "complaint", str(complaint.id), {"remarks": request.remarks})

    notif_title = "Rejection Appealed" if is_appeal else "Resolution Disputed"
    notif_msg = f"{'Appeal' if is_appeal else 'Dispute'} for {complaint.public_id} recorded. It is now escalated for review."
    await notify(session, complaint.citizen_id, complaint.id, notif_title, notif_msg)

    # Operational Alert for Dispute/Escalation
    from app.models import NotificationEventType
    from app.services import emit_operational_alert
    import time
    # Use a time-based or history-based key to allow multiple legitimate dispute cycles
    event_key = f"disputed:{complaint.id}:{int(time.time())}"
    op_title = "Complaint escalated for review"
    op_msg = f"Complaint {complaint.public_id} was {action_label.lower()} by the citizen and is now escalated."
    
    if complaint.officer_id:
        await emit_operational_alert(session, complaint.officer_id, complaint.id, op_title, op_msg, NotificationEventType.DISPUTED.value, event_key)
    else:
        admins = (await session.scalars(select(User).where(User.role == UserRole.ADMINISTRATOR))).all()
        for admin in admins:
            await emit_operational_alert(session, admin.id, complaint.id, op_title, op_msg, NotificationEventType.DISPUTED.value, event_key)

    # Recalculate priority due to escalation
    from app.priority import get_effective_priority, calculate_base_priority
    old_eff_pri, _, _ = get_effective_priority(complaint)

    related_count = 0
    if complaint.latitude is not None and complaint.longitude is not None:
        related = await find_related_complaints(session, complaint.latitude, complaint.longitude, complaint.category_id)
        related_count = len(related)
    base_score, base_reasons = calculate_base_priority(complaint, related_count)
    complaint.base_priority_score = base_score
    complaint.base_priority_reasons = base_reasons

    new_eff_pri, _, _ = get_effective_priority(complaint)
    from app.services import check_and_emit_priority_alert
    await check_and_emit_priority_alert(session, complaint, old_eff_pri, new_eff_pri)

    await session.commit()
    await session.refresh(complaint)
    return await _complaint_response(session, complaint)





@router.get("/complaints/{complaint_ref}/related", response_model=list[RelatedComplaintResponse])
async def get_related_complaints(complaint_ref: str, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)
    if not _can_view(current_user, complaint):
        raise HTTPException(status_code=403, detail="You cannot access this complaint")

    if complaint.latitude is None or complaint.longitude is None or complaint.category_id is None:
        return []

    related = await find_related_complaints(
        session=session,
        latitude=complaint.latitude,
        longitude=complaint.longitude,
        category_id=complaint.category_id,
        exclude_id=complaint.id
    )
    return related


@router.get("/notifications", response_model=list[NotificationResponse])
async def notifications(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    return (await session.scalars(select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()))).all()


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def read_notification(notification_id: uuid.UUID, current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    item = await session.get(Notification, notification_id)
    if item is None or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True
    await session.commit()
    await session.refresh(item)
    return item


@router.patch("/notifications/read-all")
async def read_all_notifications(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    await session.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await session.commit()
    return {"message": "All notifications marked as read"}


@router.get("/officer/complaints", response_model=list[ComplaintResponse])
async def officer_queue(
    department_id: uuid.UUID | None = None,
    authority: Authority | None = None,
    geographic_ward_number: int | None = None,
    administrative_ward_name: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    category_id: uuid.UUID | None = None,
    sort_by: str | None = None,
    current_user: User = Depends(require_roles(UserRole.MUNICIPAL_OFFICER, UserRole.ADMINISTRATOR)),
    session: AsyncSession = Depends(get_session)
):
    query = select(Complaint)
    
    if sort_by == "priority":
        from sqlalchemy import case
        sla_seconds = func.extract('epoch', Complaint.sla_due_at - func.now())
        sla_bonus = case(
            (sla_seconds < 0, 25),
            (sla_seconds <= 86400, 15),
            (sla_seconds <= 172800, 5),
            else_=0
        )
        engine_score = Complaint.base_priority_score + sla_bonus
        engine_score_clamped = case((engine_score > 100, 100), else_=engine_score)
        effective_priority = func.coalesce(Complaint.admin_priority_override, engine_score_clamped)
        query = query.order_by(effective_priority.desc(), Complaint.created_at.desc())
    else:
        query = query.order_by(Complaint.created_at.desc())

    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if current_user.department_id:
            query = query.where(Complaint.department_id == current_user.department_id)
        else:
            query = query.where(Complaint.officer_id == current_user.id)
    elif current_user.role == UserRole.ADMINISTRATOR:
        if department_id:
            query = query.where(Complaint.department_id == department_id)
        if authority:
            query = query.join(Department, Complaint.department_id == Department.id).where(Department.authority == authority)

    if geographic_ward_number is not None:
        query = query.where(Complaint.geographic_ward_number == geographic_ward_number)
    if administrative_ward_name is not None:
        query = query.where(Complaint.administrative_ward_name == administrative_ward_name)
    if status is not None:
        try:
            parsed_status = ComplaintStatus(status.lower())
            query = query.where(Complaint.status == parsed_status)
        except ValueError:
            pass # Ignore invalid status filter safely
    if severity is not None:
        try:
            parsed_severity = Severity(severity.lower())
            query = query.where(Complaint.severity == parsed_severity)
        except ValueError:
            pass # Ignore invalid severity filter safely
    if category_id is not None:
        query = query.where(Complaint.category_id == category_id)

    items = (await session.scalars(query)).all()
    return [await _complaint_response(session, item) for item in items]


@router.patch("/complaints/{complaint_ref}/assignment", response_model=ComplaintResponse)
async def assign_complaint(complaint_ref: str, payload: AssignmentRequest, current_user: User = Depends(require_roles(UserRole.MUNICIPAL_OFFICER, UserRole.ADMINISTRATOR)), session: AsyncSession = Depends(get_session)):
    complaint = await _get_complaint(session, complaint_ref)

    # Check if officer is allowed to touch this complaint
    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if current_user.department_id and complaint.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Cannot assign complaints outside your department scope")
        if not current_user.department_id and complaint.officer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot assign complaints outside your scope")

    target_dept = complaint.department_id
    if payload.department_id:
        if current_user.role == UserRole.MUNICIPAL_OFFICER and payload.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Officers cannot assign complaints to other departments")
        department = await session.get(Department, payload.department_id)
        if department is None or not department.active:
            raise HTTPException(status_code=400, detail="Department is unavailable")

        # Enforce Authority separation
        if complaint.department_id:
            old_dept = await session.get(Department, complaint.department_id)
            if old_dept and old_dept.authority != department.authority:
                raise HTTPException(status_code=403, detail="Cannot cross-assign across authorities (e.g. PMC to Traffic Police)")

        target_dept = department.id
        complaint.department_id = department.id

    if payload.officer_id:
        officer = await session.get(User, payload.officer_id)
        if officer is None or officer.role != UserRole.MUNICIPAL_OFFICER:
            raise HTTPException(status_code=400, detail="Officer is unavailable")

        if officer.department_id and target_dept and officer.department_id != target_dept:
            raise HTTPException(status_code=403, detail="Officer department does not match complaint department")

        if officer.ward_id and complaint.ward_id and officer.ward_id != complaint.ward_id:
            raise HTTPException(status_code=403, detail="Officer ward does not match complaint ward")

        if target_dept:
            dept = await session.get(Department, target_dept)
            if dept and dept.authority == Authority.PUNE_TRAFFIC_POLICE and officer.department_id != target_dept:
                raise HTTPException(status_code=403, detail="Traffic complaints cannot receive non-traffic PMC officers")
            if dept and dept.authority == Authority.PMC and officer.department_id:
                officer_dept = await session.get(Department, officer.department_id)
                if officer_dept and officer_dept.authority == Authority.PUNE_TRAFFIC_POLICE:
                    raise HTTPException(status_code=403, detail="Traffic officers cannot be assigned to PMC complaints")

        complaint.officer_id = officer.id
    else:
        complaint.officer_id = None

    if complaint.status == ComplaintStatus.SUBMITTED:
        complaint.status = ComplaintStatus.ASSIGNED
        session.add(ComplaintStatusHistory(complaint_id=complaint.id, old_status=ComplaintStatus.SUBMITTED, new_status=ComplaintStatus.ASSIGNED, changed_by=current_user.id, remarks="Assignment updated."))
    await audit(session, current_user.id, "assign", "complaint", str(complaint.id))

    if payload.officer_id:
        await notify(session, complaint.citizen_id, complaint.id, "Complaint Assigned", f"Your complaint {complaint.public_id} has been assigned to an officer.")

    await session.commit()
    await session.refresh(complaint)
    return await _complaint_response(session, complaint)


@router.get("/admin/analytics")
async def analytics(current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR, UserRole.MUNICIPAL_OFFICER)), session: AsyncSession = Depends(get_session)):
    query = select(Complaint)
    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if current_user.department_id:
            query = query.where(Complaint.department_id == current_user.department_id)
        else:
            query = query.where(Complaint.officer_id == current_user.id)

    base_subq = query.subquery()

    total = await session.scalar(select(func.count(base_subq.c.id)))

    status_counts = (await session.execute(select(base_subq.c.status, func.count(base_subq.c.id)).group_by(base_subq.c.status))).all()
    by_status = {s.value: c for s, c in status_counts}

    category_counts = (await session.execute(
        select(Category.name, func.count(base_subq.c.id))
        .select_from(base_subq)
        .outerjoin(Category, base_subq.c.category_id == Category.id)
        .group_by(Category.name)
    )).all()
    by_category = {cat or "Unknown": count for cat, count in category_counts}

    dept_counts = (await session.execute(
        select(Department.name, func.count(base_subq.c.id))
        .select_from(base_subq)
        .outerjoin(Department, base_subq.c.department_id == Department.id)
        .group_by(Department.name)
    )).all()
    by_department = {d or "Unassigned": count for d, count in dept_counts}

    auth_counts = (await session.execute(
        select(Department.authority, func.count(base_subq.c.id))
        .select_from(base_subq)
        .outerjoin(Department, base_subq.c.department_id == Department.id)
        .group_by(Department.authority)
    )).all()
    by_authority = {a.value if a else "Unknown": count for a, count in auth_counts}

    geo_ward_counts = (await session.execute(select(base_subq.c.geographic_ward_number, func.count(base_subq.c.id)).group_by(base_subq.c.geographic_ward_number))).all()
    by_geo_ward = {str(w) if w else "Unknown": count for w, count in geo_ward_counts}

    admin_ward_counts = (await session.execute(select(base_subq.c.administrative_ward_name, func.count(base_subq.c.id)).group_by(base_subq.c.administrative_ward_name))).all()
    by_admin_ward = {w or "Unknown": count for w, count in admin_ward_counts}

    resolved = by_status.get(ComplaintStatus.RESOLVED.value, 0)
    resolution_rate = round(resolved / total * 100, 1) if total > 0 else 0.0

    my_assigned = await session.scalar(select(func.count(Complaint.id)).where(Complaint.officer_id == current_user.id))
    disputed = await session.scalar(select(func.count(base_subq.c.id)).where(base_subq.c.is_escalated == True))

    return {
        "complaints_total": total,
        "my_assigned": my_assigned or 0,
        "disputed": disputed or 0,
        "by_status": by_status,
        "by_category": by_category,
        "by_department": by_department,
        "by_authority": by_authority,
        "by_geo_ward": by_geo_ward,
        "by_admin_ward": by_admin_ward,
        "resolution_rate": resolution_rate
    }


@router.get("/admin/users", response_model=list[UserResponse])
async def admin_users(current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR, UserRole.MUNICIPAL_OFFICER)), session: AsyncSession = Depends(get_session)):
    query = select(User).order_by(User.created_at.desc())
    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if current_user.department_id:
            query = query.where(User.department_id == current_user.department_id)
        else:
            query = query.where(User.id == current_user.id)
    return (await session.scalars(query)).all()


@router.get("/admin/gis-sync-status")
async def admin_gis_status(
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    session: AsyncSession = Depends(get_session)
):
    pune_wards_count = await session.scalar(select(func.count()).select_from(PuneWard))
    admin_wards_count = await session.scalar(select(func.count()).select_from(AdministrativeWardOffice))

    return {
        "status": "Live PMC GIS refresh unavailable; using last verified database snapshot.",
        "pune_wards_count": pune_wards_count,
        "administrative_ward_offices_count": admin_wards_count,
    }


@router.patch("/admin/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdateRequest,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    session: AsyncSession = Depends(get_session),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own role")
    target_user = await session.get(User, user_id)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    old_role = target_user.role
    target_user.role = payload.role
    if payload.role == UserRole.MUNICIPAL_OFFICER and payload.department_id:
        target_user.department_id = payload.department_id
    elif payload.role != UserRole.MUNICIPAL_OFFICER:
        target_user.department_id = None
    await audit(
        session,
        current_user.id,
        "update_user_role",
        "user",
        str(target_user.id),
        {"from_role": old_role.value, "to_role": payload.role.value, "department_id": str(payload.department_id) if payload.department_id else None},
    )
    await session.commit()
    await session.refresh(target_user)
    return target_user


@router.get("/admin/audit-logs", response_model=list[AuditLogResponse])
async def audit_logs(current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)), session: AsyncSession = Depends(get_session)):
    return (await session.scalars(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100))).all()


@router.get("/rewards/my", response_model=UserRewardsSummary)
async def my_rewards(current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    total = (await session.scalar(select(func.coalesce(func.sum(Reward.points), 0)).where(Reward.user_id == current_user.id))) or 0
    history = (await session.scalars(select(Reward).where(Reward.user_id == current_user.id).order_by(Reward.created_at.desc()))).all()
    return UserRewardsSummary(total_points=int(total), history=list(history))


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(session: AsyncSession = Depends(get_session)):
    query = (
        select(
            User.name.label("user_name"),
            func.coalesce(func.sum(Reward.points), 0).label("points"),
            func.count(Complaint.id).label("complaints_resolved"),
        )
        .join(Reward, Reward.user_id == User.id, isouter=True)
        .join(Complaint, (Complaint.citizen_id == User.id) & (Complaint.status == ComplaintStatus.RESOLVED), isouter=True)
        .where(User.role == UserRole.CITIZEN)
        .group_by(User.id, User.name)
        .order_by(func.coalesce(func.sum(Reward.points), 0).desc(), User.name)
        .limit(10)
    )
    result = await session.execute(query)
    return [LeaderboardEntry(user_name=row.user_name, points=int(row.points), complaints_resolved=int(row.complaints_resolved)) for row in result.all()]

@router.get("/admin/complaints/map", response_model=list[MapComplaintResponse])
async def admin_map_complaints(
    department_id: uuid.UUID | None = None,
    authority: Authority | None = None,
    geographic_ward_number: int | None = None,
    administrative_ward_name: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    category_id: uuid.UUID | None = None,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    session: AsyncSession = Depends(get_session)
):
    query = select(Complaint).where(Complaint.latitude.isnot(None), Complaint.longitude.isnot(None))

    if department_id:
        query = query.where(Complaint.department_id == department_id)
    if authority:
        query = query.join(Department, Complaint.department_id == Department.id).where(Department.authority == authority)

    if geographic_ward_number is not None:
        query = query.where(Complaint.geographic_ward_number == geographic_ward_number)
    if administrative_ward_name is not None:
        query = query.where(Complaint.administrative_ward_name == administrative_ward_name)
    if status is not None:
        try:
            parsed_status = ComplaintStatus(status.lower())
            query = query.where(Complaint.status == parsed_status)
        except ValueError:
            pass # Ignore invalid status filter safely
    if severity is not None:
        try:
            parsed_severity = Severity(severity.lower())
            query = query.where(Complaint.severity == parsed_severity)
        except ValueError:
            pass # Ignore invalid severity filter safely
    if category_id is not None:
        query = query.where(Complaint.category_id == category_id)

    # We will fetch categories, departments, and officers separately and map them in memory to avoid N+1.
    items = (await session.scalars(query)).all()

    categories = {c.id: c.name for c in (await session.scalars(select(Category))).all()}
    departments = {d.id: d for d in (await session.scalars(select(Department))).all()}
    officers = {u.id: u.name for u in (await session.scalars(select(User).where(User.role.in_([UserRole.MUNICIPAL_OFFICER, UserRole.ADMINISTRATOR])))).all()}

    results = []
    for c in items:
        officer_name = officers.get(c.officer_id) if c.officer_id else None
        dept = departments.get(c.department_id) if c.department_id else None
        dept_name = dept.name if dept else None
        cat_name = categories.get(c.category_id) if c.category_id else None
        authority_val = dept.authority if dept else None

        results.append({
            "id": c.id,
            "public_id": c.public_id,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "category_name": cat_name,
            "severity": c.severity,
            "status": c.status,
            "geographic_ward_number": c.geographic_ward_number if hasattr(c, 'geographic_ward_number') else getattr(c, 'ward_id', None),
            "administrative_ward_name": c.administrative_ward_name,
            "administrative_zone": c.administrative_zone,
            "authority": authority_val,
            "department_name": dept_name,
            "officer_name": officer_name
        })
    return results


@router.get("/admin/hotspots", response_model=list[HotspotResponse])
async def admin_hotspots(
    department_id: uuid.UUID | None = None,
    authority: Authority | None = None,
    geographic_ward_number: int | None = None,
    administrative_ward_name: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    category_id: uuid.UUID | None = None,
    radius_meters: float = 200.0,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    session: AsyncSession = Depends(get_session)
):
    from app.hotspots import calculate_hotspots

    query = select(Complaint).where(
        Complaint.latitude.isnot(None),
        Complaint.longitude.isnot(None)
    )

    if department_id:
        query = query.where(Complaint.department_id == department_id)
    if authority:
        query = query.join(Department, Complaint.department_id == Department.id).where(Department.authority == authority)

    if geographic_ward_number is not None:
        query = query.where(Complaint.geographic_ward_number == geographic_ward_number)
    if administrative_ward_name is not None:
        query = query.where(Complaint.administrative_ward_name == administrative_ward_name)
    if status is not None:
        try:
            parsed_status = ComplaintStatus(status.lower())
            query = query.where(Complaint.status == parsed_status)
        except ValueError:
            pass
    if severity is not None:
        try:
            parsed_severity = Severity(severity.lower())
            query = query.where(Complaint.severity == parsed_severity)
        except ValueError:
            pass
    if category_id is not None:
        query = query.where(Complaint.category_id == category_id)

    items = (await session.scalars(query)).all()
    categories = {c.id: c.name for c in (await session.scalars(select(Category))).all()}

    # We need to map category_name for calculate_hotspots
    for c in items:
        if not hasattr(c, "category_name"):
            c.category_name = categories.get(c.category_id) if c.category_id else "Uncategorized"

    hotspots = calculate_hotspots(items, radius_meters=radius_meters)
    return hotspots


@router.get("/admin/ward-summary", response_model=list[WardSummaryResponse])
async def admin_ward_summary(
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR)),
    session: AsyncSession = Depends(get_session)
):
    # Group by administrative_ward_name
    query = select(Complaint)
    items = (await session.scalars(query)).all()

    ward_stats = {}
    for c in items:
        ward = c.administrative_ward_name or "Unassigned"
        if ward not in ward_stats:
            ward_stats[ward] = {
                "administrative_ward_name": ward,
                "total_complaints": 0,
                "open_complaints": 0,
                "resolved_complaints": 0,
                "in_progress_complaints": 0,
                "overdue_complaints": 0
            }

        stat = ward_stats[ward]
        stat["total_complaints"] += 1

        if is_resolved(c.status):
            stat["resolved_complaints"] += 1
        elif c.status == ComplaintStatus.IN_PROGRESS:
            stat["in_progress_complaints"] += 1
            stat["open_complaints"] += 1
        else:
            stat["open_complaints"] += 1

        if c.sla_due_at and c.sla_due_at < datetime.now().astimezone() and not is_resolved(c.status):
            stat["overdue_complaints"] += 1

    return list(ward_stats.values())


@router.get("/admin/analytics/detailed", response_model=AnalyticsDetailedResponse)
async def admin_analytics_detailed(
    department_id: uuid.UUID | None = None,
    geographic_ward_number: int | None = None,
    administrative_ward_name: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    category_id: uuid.UUID | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    authority: str | None = None,
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR, UserRole.MUNICIPAL_OFFICER)),
    session: AsyncSession = Depends(get_session)
):
    if current_user.role == UserRole.CITIZEN:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = select(Complaint)

    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if current_user.department_id:
            query = query.where(Complaint.department_id == current_user.department_id)
        else:
            raise HTTPException(status_code=403, detail="Officer has no department assigned")

    if department_id is not None:
        query = query.where(Complaint.department_id == department_id)
    if geographic_ward_number is not None:
        query = query.where(Complaint.geographic_ward_number == geographic_ward_number)
    if administrative_ward_name is not None:
        query = query.where(Complaint.administrative_ward_name == administrative_ward_name)
    if status is not None:
        try:
            parsed_status = ComplaintStatus(status.lower())
            query = query.where(Complaint.status == parsed_status)
        except ValueError:
            pass
    if severity is not None:
        try:
            parsed_severity = Severity(severity.lower())
            query = query.where(Complaint.severity == parsed_severity)
        except ValueError:
            pass
    if category_id is not None:
        query = query.where(Complaint.category_id == category_id)
    if authority is not None:
        try:
            parsed_auth = Authority(authority.upper())
            query = query.join(Department, Complaint.department_id == Department.id).where(Department.authority == parsed_auth)
        except ValueError:
            pass
    if start_date is not None:
        try:
            sd = datetime.fromisoformat(start_date)
            query = query.where(Complaint.created_at >= sd)
        except ValueError:
            pass
    if end_date is not None:
        try:
            ed = datetime.fromisoformat(end_date)
            query = query.where(Complaint.created_at <= ed)
        except ValueError:
            pass

    items = (await session.scalars(query)).all()

    # 1. KPIs
    total = len(items)
    resolved = 0
    rejected = 0
    open_c = 0
    in_progress = 0
    escalated = 0

    for c in items:
        if c.status == ComplaintStatus.RESOLVED:
            resolved += 1
        elif c.status == ComplaintStatus.REJECTED:
            rejected += 1
        elif c.status == ComplaintStatus.IN_PROGRESS:
            in_progress += 1
            open_c += 1
        else:
            open_c += 1

        if c.is_escalated:
            escalated += 1

    res_rate = (resolved / total * 100) if total > 0 else 0.0

    # 2. Trends (group by day)
    from collections import defaultdict
    trends_map = {}
    for c in items:
        if not c.created_at: continue
        d = c.created_at.strftime("%Y-%m-%d")
        if d not in trends_map:
            trends_map[d] = {"submitted": 0, "resolved": 0}
        trends_map[d]["submitted"] += 1

        if c.resolved_at:
            rd = c.resolved_at.strftime("%Y-%m-%d")
            if rd not in trends_map:
                trends_map[rd] = {"submitted": 0, "resolved": 0}
            trends_map[rd]["resolved"] += 1

    trends_list = [{"date": k, "submitted": v["submitted"], "resolved": v["resolved"]} for k, v in sorted(trends_map.items())]

    # 3. Status Distribution
    status_dist = {"submitted": 0, "assigned": 0, "in_progress": 0, "resolved": 0, "rejected": 0, "escalated": 0}
    for c in items:
        val = c.status.value if hasattr(c.status, "value") else str(c.status)
        if val in status_dist:
            status_dist[val] += 1
        if c.is_escalated:
            status_dist["escalated"] += 1

    # 4. Severity Distribution
    sev_dist = {
        "citizen_reported": {"not_assessed": 0, "low": 0, "medium": 0, "high": 0, "critical": 0},
        "system_assessed": {"not_assessed": 0, "low": 0, "medium": 0, "high": 0, "critical": 0},
        "final_severity": {"not_assessed": 0, "low": 0, "medium": 0, "high": 0, "critical": 0},
    }

    for c in items:
        f_sev = c.severity.value if hasattr(c.severity, "value") else str(c.severity)
        if f_sev in sev_dist["final_severity"]:
            sev_dist["final_severity"][f_sev] += 1

        c_sev = (c.citizen_reported_severity.value if hasattr(c.citizen_reported_severity, "value") else str(c.citizen_reported_severity)) if c.citizen_reported_severity else "not_assessed"
        if c_sev in sev_dist["citizen_reported"]:
            sev_dist["citizen_reported"][c_sev] += 1

        s_sev = (c.system_assessed_severity.value if hasattr(c.system_assessed_severity, "value") else str(c.system_assessed_severity)) if c.system_assessed_severity else "not_assessed"
        if s_sev in sev_dist["system_assessed"]:
            sev_dist["system_assessed"][s_sev] += 1

    # 5. Ward Summary
    ward_stats = {}
    for c in items:
        ward = c.administrative_ward_name or "Unassigned"
        if ward not in ward_stats:
            ward_stats[ward] = {
                "administrative_ward_name": ward,
                "total_complaints": 0, "open_complaints": 0, "resolved_complaints": 0,
                "in_progress_complaints": 0, "overdue_complaints": 0
            }
        st = ward_stats[ward]
        st["total_complaints"] += 1
        if is_resolved(c.status):
            st["resolved_complaints"] += 1
        elif c.status == ComplaintStatus.IN_PROGRESS:
            st["in_progress_complaints"] += 1
            st["open_complaints"] += 1
        else:
            st["open_complaints"] += 1

        if c.sla_due_at and c.sla_due_at < datetime.now().astimezone() and not is_resolved(c.status):
            st["overdue_complaints"] += 1

    ward_summary = list(ward_stats.values())

    # 6. Department Workload
    dept_stats = {}
    # Fetch department names
    depts = {d.id: d.name for d in (await session.scalars(select(Department))).all()}

    for c in items:
        d_id = c.department_id
        d_name = depts.get(d_id, "Unassigned") if d_id else "Unassigned"
        if d_name not in dept_stats:
            dept_stats[d_name] = {
                "department_name": d_name, "total": 0, "open": 0, "in_progress": 0,
                "resolved": 0, "overdue": 0, "assigned": 0, "unassigned": 0
            }
        st = dept_stats[d_name]
        st["total"] += 1

        if is_resolved(c.status):
            st["resolved"] += 1
        elif c.status == ComplaintStatus.IN_PROGRESS:
            st["in_progress"] += 1
            st["open"] += 1
        else:
            st["open"] += 1

        if c.sla_due_at and c.sla_due_at < datetime.now().astimezone() and not is_resolved(c.status):
            st["overdue"] += 1

        if c.officer_id:
            st["assigned"] += 1
        else:
            st["unassigned"] += 1

    dept_summary = list(dept_stats.values())

    # 7. SLA Analytics
    sla = {"on_track": 0, "due_soon": 0, "overdue": 0, "resolved_within_sla": 0, "resolved_after_sla": 0}
    now = datetime.now().astimezone()
    for c in items:
        if not c.sla_due_at: continue

        if is_resolved(c.status):
            if c.resolved_at and c.resolved_at <= c.sla_due_at:
                sla["resolved_within_sla"] += 1
            else:
                sla["resolved_after_sla"] += 1
        else:
            if now > c.sla_due_at:
                sla["overdue"] += 1
            elif (c.sla_due_at - now).total_seconds() <= 86400:
                sla["due_soon"] += 1
            else:
                sla["on_track"] += 1

    total_sla_resolved = sla["resolved_within_sla"] + sla["resolved_after_sla"]
    sla_rate = (sla["resolved_within_sla"] / total_sla_resolved * 100) if total_sla_resolved > 0 else 0.0

    # 8. Resolution Performance
    resolution_times = []
    for c in items:
        if is_resolved(c.status) and c.resolved_at and c.created_at:
            diff = (c.resolved_at - c.created_at).total_seconds() / 3600.0 # in hours
            if diff >= 0:
                resolution_times.append(diff)

    avg_hours = sum(resolution_times) / len(resolution_times) if resolution_times else 0.0
    med_hours = sorted(resolution_times)[len(resolution_times)//2] if resolution_times else 0.0

    # 9. Escalation Insights
    esc = {"current_escalated": 0, "total_disputes": 0, "rejected": rejected, "reopened_after_dispute": 0}

    for c in items:
        if c.is_escalated:
            esc["total_disputes"] += 1
            if not is_resolved(c.status):
                esc["current_escalated"] += 1
            elif is_resolved(c.status) and c.status == ComplaintStatus.RESOLVED:
                # Assuming if it was escalated and is now resolved, it was reopened and resolved again.
                esc["reopened_after_dispute"] += 1

    return AnalyticsDetailedResponse(
        kpis={
            "total_complaints": total,
            "open_complaints": open_c,
            "in_progress_complaints": in_progress,
            "resolved_complaints": resolved,
            "rejected_complaints": rejected,
            "escalated_complaints": escalated,
            "resolution_rate": res_rate,
            "sla_compliance_rate": sla_rate,
        },
        trends=trends_list,
        status_distribution=status_dist,
        severity_analysis=sev_dist,
        ward_summary=ward_summary,
        department_workload=dept_summary,
        sla_analytics=sla,
        resolution_performance={"average_hours": avg_hours, "median_hours": med_hours},
        escalation_insights=esc
    )
