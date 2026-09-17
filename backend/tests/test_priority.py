import pytest
import uuid
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.models import Complaint, Category, Department, Authority, Severity, ComplaintStatus, User, UserRole
from app.priority import calculate_base_priority, calculate_dynamic_sla_priority, get_effective_priority

@pytest.fixture
def mock_complaint():
    c = Complaint(
        id=uuid.uuid4(),
        public_id="CIV-1000",
        severity=Severity.NOT_ASSESSED,
        base_priority_score=0,
        base_priority_reasons=[],
        is_escalated=False,
    )
    return c

def test_priority_severity(mock_complaint):
    # NOT ASSESSED
    mock_complaint.severity = Severity.NOT_ASSESSED
    score, reasons = calculate_base_priority(mock_complaint, 0)
    assert score == 0

    # LOW
    mock_complaint.severity = Severity.LOW
    score, reasons = calculate_base_priority(mock_complaint, 0)
    assert score == 0
    assert any(r["signal"] == "Severity" for r in reasons)

    # MEDIUM
    mock_complaint.severity = Severity.MEDIUM
    score, reasons = calculate_base_priority(mock_complaint, 0)
    assert score == 10

    # HIGH
    mock_complaint.severity = Severity.HIGH
    score, reasons = calculate_base_priority(mock_complaint, 0)
    assert score == 20

    # CRITICAL
    mock_complaint.severity = Severity.CRITICAL
    score, reasons = calculate_base_priority(mock_complaint, 0)
    assert score == 35

def test_priority_related_count(mock_complaint):
    mock_complaint.severity = Severity.LOW
    
    # 1 related
    score, reasons = calculate_base_priority(mock_complaint, 1)
    assert score == 5
    
    # 3 related
    score, reasons = calculate_base_priority(mock_complaint, 3)
    assert score == 15
    
    # Cap at 20 (4 or more)
    score, reasons = calculate_base_priority(mock_complaint, 5)
    assert score == 20
    assert any("20" in str(r["points"]) for r in reasons if r["signal"] == "Related complaints")

def test_priority_escalation(mock_complaint):
    mock_complaint.severity = Severity.LOW
    mock_complaint.is_escalated = True
    score, reasons = calculate_base_priority(mock_complaint, 0)
    assert score == 20
    assert any(r["signal"] == "Escalation" for r in reasons)

def test_priority_clamp(mock_complaint):
    mock_complaint.severity = Severity.CRITICAL # 35
    mock_complaint.is_escalated = True # 20
    score, reasons = calculate_base_priority(mock_complaint, 10) # 20
    # 35 + 20 + 20 = 75 base score
    assert score == 75

def test_dynamic_sla(mock_complaint):
    now = datetime.now(timezone.utc)
    
    # > 48h
    mock_complaint.sla_due_at = now + timedelta(hours=50)
    score, _ = calculate_dynamic_sla_priority(mock_complaint)
    assert score == 0
    
    # < 48h
    mock_complaint.sla_due_at = now + timedelta(hours=36)
    score, _ = calculate_dynamic_sla_priority(mock_complaint)
    assert score == 5
    
    # < 24h
    mock_complaint.sla_due_at = now + timedelta(hours=12)
    score, _ = calculate_dynamic_sla_priority(mock_complaint)
    assert score == 15
    
    # Overdue
    mock_complaint.sla_due_at = now - timedelta(hours=1)
    score, _ = calculate_dynamic_sla_priority(mock_complaint)
    assert score == 25

def test_effective_priority(mock_complaint):
    mock_complaint.base_priority_score = 40
    mock_complaint.sla_due_at = datetime.now(timezone.utc) - timedelta(hours=1) # 25 points
    
    eff, _, engine = get_effective_priority(mock_complaint)
    assert engine == 65
    assert eff == 65
    
    # Clamp engine score
    mock_complaint.base_priority_score = 80
    eff, _, engine = get_effective_priority(mock_complaint)
    assert engine == 100
    
    # Admin Override
    mock_complaint.admin_priority_override = 99
    eff, _, engine = get_effective_priority(mock_complaint)
    assert engine == 100
    assert eff == 99

from app.main import app
from httpx import ASGITransport
from app.dependencies import get_current_user, get_session

def override_auth_for_user(user: User):
    async def _override():
        return user
    return _override

@pytest.mark.anyio
async def test_admin_override_api():
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import get_settings

    engine = create_async_engine(get_settings().database_url)
    TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_session():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    admin_id = uuid.uuid4()
    admin_user = User(id=admin_id, name="Admin", email=f"admin_{admin_id}@test.local", password_hash="123", role=UserRole.ADMINISTRATOR)
    
    officer_id = uuid.uuid4()
    officer_user = User(id=officer_id, name="Officer", email=f"off_{officer_id}@test.local", password_hash="123", role=UserRole.MUNICIPAL_OFFICER)

    citizen_id = uuid.uuid4()
    citizen_user = User(id=citizen_id, name="Citizen", email=f"cit_{citizen_id}@test.local", password_hash="123", role=UserRole.CITIZEN)

    created_complaint_id = None
    try:
        async with TestingSessionLocal() as session:
            session.add_all([admin_user, officer_user, citizen_user])
            await session.flush()
            
            c = Complaint(
                public_id=f"CIV-PRIO-{uuid.uuid4().hex[:6].upper()}",
                description="Priority test",
                citizen_id=citizen_id,
                severity=Severity.LOW,
                status=ComplaintStatus.SUBMITTED,
                latitude=18.0,
                longitude=73.0,
                base_priority_score=10
            )
            session.add(c)
            await session.commit()
            await session.refresh(c)
            ref = c.public_id
            created_complaint_id = c.id

        from app.security import create_access_token
        admin_token = create_access_token(str(admin_id), UserRole.ADMINISTRATOR.value)
        officer_token = create_access_token(str(officer_id), UserRole.MUNICIPAL_OFFICER.value)
        citizen_token = create_access_token(str(citizen_id), UserRole.CITIZEN.value)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.patch(
                f"/api/complaints/{ref}/priority",
                json={"override_score": 85, "remarks": "Urgent VIP"},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert res.status_code == 200
            assert res.json()["admin_priority_override"] == 85
            assert res.json()["effective_priority"] == 85
            
            # Admin clears override
            res = await ac.patch(
                f"/api/complaints/{ref}/priority",
                json={"override_score": None, "remarks": "Cleared"},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert res.status_code == 200
            assert res.json()["admin_priority_override"] is None
            assert res.json()["effective_priority"] >= 10

        # Test officer cannot override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.patch(
                f"/api/complaints/{ref}/priority",
                json={"override_score": 85, "remarks": "Urgent"},
                headers={"Authorization": f"Bearer {officer_token}"}
            )
            assert res.status_code == 403

        # Test citizen cannot override
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.patch(
                f"/api/complaints/{ref}/priority",
                json={"override_score": 85, "remarks": "Urgent"},
                headers={"Authorization": f"Bearer {citizen_token}"}
            )
            assert res.status_code == 403

    finally:
        from sqlalchemy import delete
        from app.models import AuditLog, Notification
        async with TestingSessionLocal() as session:
            uids = [admin_id, officer_id, citizen_id]
            if created_complaint_id:
                await session.execute(delete(AuditLog).where((AuditLog.actor_id.in_(uids)) | (AuditLog.entity_id == str(created_complaint_id))))
                await session.execute(delete(Notification).where(Notification.complaint_id == created_complaint_id))
            else:
                await session.execute(delete(AuditLog).where(AuditLog.actor_id.in_(uids)))
            
            if created_complaint_id:
                await session.execute(delete(Complaint).where(Complaint.id == created_complaint_id))
                
            await session.execute(delete(User).where(User.id.in_(uids)))
            await session.commit()
        
        app.dependency_overrides.clear()
