"""Tests for the public/sanitized complaint view endpoint."""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import User, UserRole, Complaint, ComplaintStatus, Severity, Category, Department
from app.dependencies import get_current_user
from app.api import get_session, _can_view
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone


# ── Shared fixtures ──────────────────────────────────────────────────────────

CITIZEN_A_ID = uuid.uuid4()
CITIZEN_B_ID = uuid.uuid4()
ADMIN_ID = uuid.uuid4()
OFFICER_ID = uuid.uuid4()
DEPT_ID = uuid.uuid4()
CATEGORY_ID = uuid.uuid4()
COMPLAINT_ID = uuid.uuid4()

MOCK_COMPLAINT = Complaint(
    id=COMPLAINT_ID,
    public_id="CIV-TEST-001",
    citizen_id=CITIZEN_A_ID,
    category_id=CATEGORY_ID,
    department_id=DEPT_ID,
    status=ComplaintStatus.SUBMITTED,
    description="Pothole on MG Road near Shivaji Nagar",
    severity=Severity.MEDIUM,
    upvotes=3,
    latitude=18.5204,
    longitude=73.8567,
    address="MG Road, Shivaji Nagar, Pune",
    image_url="/path/to/image.jpg",
    ward_name="Shivajinagar",
    geographic_ward_number=15,
    administrative_ward_office="Shivajinagar Ward Office",
    administrative_ward_name="Shivajinagar",
    administrative_zone="Zone 1",
    is_escalated=False,
    created_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
    updated_at=datetime(2026, 9, 15, tzinfo=timezone.utc),
    resolved_at=None,
)

MOCK_CATEGORY = MagicMock(spec=Category)
MOCK_CATEGORY.name = "Road & Pothole"

MOCK_DEPARTMENT = MagicMock(spec=Department)
MOCK_DEPARTMENT.name = "Road Maintenance"
MOCK_DEPARTMENT.authority = MagicMock()
MOCK_DEPARTMENT.authority.value = "PMC"


def _setup_auth(user_id: uuid.UUID, role: UserRole, department_id=None):
    """Override auth with a mock user of the given role."""
    async def override():
        user = User(id=user_id, email=f"{role.value}@test.local", name=f"Test {role.value}", role=role)
        if department_id:
            user.department_id = department_id
        return user
    app.dependency_overrides[get_current_user] = override


def _setup_db():
    """Override DB session with mocks that return our test complaint."""
    async def override():
        mock_session = AsyncMock(spec=AsyncSession)
        scalar_call_count = [0]

        async def scalar_side_effect(query, *args, **kwargs):
            scalar_call_count[0] += 1
            # First scalar call is _get_complaint, rest are evidence etc.
            if scalar_call_count[0] == 1:
                return MOCK_COMPLAINT
            return None

        async def get_side_effect(model_cls, pk, *args, **kwargs):
            if model_cls == Category:
                return MOCK_CATEGORY
            if model_cls == Department:
                return MOCK_DEPARTMENT
            return None

        mock_session.scalar.side_effect = scalar_side_effect
        mock_session.get.side_effect = get_side_effect

        # scalars / execute for timeline etc.
        async def scalars_side_effect(query, *args, **kwargs):
            result = MagicMock()
            result.all.return_value = []
            return result

        mock_session.scalars.side_effect = scalars_side_effect

        async def execute_side_effect(query, *args, **kwargs):
            result = MagicMock()
            result.all.return_value = []
            return result

        mock_session.execute.side_effect = execute_side_effect
        yield mock_session

    app.dependency_overrides[get_session] = override


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides = {}


# ── 1. Citizen can access own complaint via private endpoint ─────────────────

@pytest.mark.anyio
async def test_citizen_can_access_own_complaint():
    _setup_auth(CITIZEN_A_ID, UserRole.CITIZEN)
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["public_id"] == "CIV-TEST-001"
        # Owner gets full data including citizen_id
        assert "citizen_id" in data


# ── 2. Citizen CANNOT access another citizen's private complaint ─────────────

@pytest.mark.anyio
async def test_citizen_cannot_access_other_private_complaint():
    _setup_auth(CITIZEN_B_ID, UserRole.CITIZEN)
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}")
        assert resp.status_code == 403
        assert "cannot access" in resp.json()["detail"].lower()


# ── 3. Authenticated citizen CAN access any complaint via /public ────────────

@pytest.mark.anyio
async def test_citizen_can_access_public_view():
    _setup_auth(CITIZEN_B_ID, UserRole.CITIZEN)
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}/public")
        assert resp.status_code == 200
        data = resp.json()
        assert data["public_id"] == "CIV-TEST-001"


# ── 4. Public response contains only approved fields ────────────────────────

@pytest.mark.anyio
async def test_public_response_contains_approved_fields():
    _setup_auth(CITIZEN_B_ID, UserRole.CITIZEN)
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}/public")
        data = resp.json()
        # Must contain these approved fields
        assert "public_id" in data
        assert "category_name" in data
        assert "status" in data
        assert "created_at" in data
        assert "department_name" in data
        assert "authority" in data
        assert "ward_name" in data
        assert "image_url" in data


# ── 5. Public response does NOT contain private fields ───────────────────────

@pytest.mark.anyio
async def test_public_response_excludes_private_fields():
    _setup_auth(CITIZEN_B_ID, UserRole.CITIZEN)
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}/public")
        data = resp.json()
        # Must NOT contain any of these private fields
        private_fields = [
            "citizen_id", "id", "description",
            "latitude", "longitude", "address",
            "officer_id", "officer_name",
            "priority_score", "priority_reasons",
            "admin_priority_override", "admin_priority_remarks",
            "effective_priority", "is_escalated",
            "is_sla_breached", "is_sla_approaching",
            "sla_due_at", "resolution_evidence",
            "severity", "citizen_reported_severity", "system_assessed_severity",
        ]
        for field in private_fields:
            assert field not in data, f"Private field '{field}' should not be in public response"


# ── 6. Unauthenticated request to /public is rejected ────────────────────────

@pytest.mark.anyio
async def test_unauthenticated_public_request_rejected():
    # Do NOT set up auth override — let the real dependency run
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}/public")
        # Should be 401 or 403 — not 200
        assert resp.status_code in (401, 403)


# ── 7. Admin can still access the full complaint ─────────────────────────────

@pytest.mark.anyio
async def test_admin_full_access_unchanged():
    _setup_auth(ADMIN_ID, UserRole.ADMINISTRATOR)
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "citizen_id" in data


# ── 8. Authorized officer can access complaint in their department ───────────

@pytest.mark.anyio
async def test_officer_department_access_unchanged():
    _setup_auth(OFFICER_ID, UserRole.MUNICIPAL_OFFICER, department_id=DEPT_ID)
    _setup_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/complaints/{MOCK_COMPLAINT.public_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "citizen_id" in data


# ── 9. _can_view still enforces ownership ────────────────────────────────────

def test_can_view_enforcement():
    """Direct unit test that _can_view still correctly blocks cross-citizen access."""
    citizen_a = User(id=CITIZEN_A_ID, name="A", role=UserRole.CITIZEN)
    citizen_b = User(id=CITIZEN_B_ID, name="B", role=UserRole.CITIZEN)
    admin = User(id=ADMIN_ID, name="Admin", role=UserRole.ADMINISTRATOR)

    assert _can_view(citizen_a, MOCK_COMPLAINT) is True
    assert _can_view(citizen_b, MOCK_COMPLAINT) is False
    assert _can_view(admin, MOCK_COMPLAINT) is True


# ── 10. Invalid complaint returns 404 for /public ───────────────────────────

@pytest.mark.anyio
async def test_public_nonexistent_complaint_404():
    _setup_auth(CITIZEN_A_ID, UserRole.CITIZEN)

    async def override():
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.scalar.return_value = None
        mock_session.get.return_value = None
        yield mock_session

    app.dependency_overrides[get_session] = override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/complaints/CIV-NONEXISTENT/public")
        assert resp.status_code == 404
