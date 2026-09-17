import pytest
import uuid
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.dependencies import get_current_user, get_session
from app.models import CivicAdvisory, PuneWard, User, UserRole, Category

def override_auth_for_user(user: User):
    async def _override():
        return user
    return _override



@pytest.fixture
def mock_session():
    mock_db = AsyncMock(spec=AsyncSession)

    async def scalar_side_effect(*args, **kwargs):
        # Mock ward lookup
        ward = PuneWard(id=uuid.uuid4(), ward_number=999, ward_name="Test")
        return ward

    async def scalars_side_effect(*args, **kwargs):
        mock_result = MagicMock()
        adv = CivicAdvisory(id=uuid.uuid4(), public_id="ADV-1234", title="Test", description="Test", starts_at=datetime.now(timezone.utc), expires_at=datetime.now(timezone.utc) + timedelta(days=1), status="ACTIVE", created_by=uuid.uuid4())
        mock_result.all.return_value = [adv]
        return mock_result

    async def execute_side_effect(*args, **kwargs):
        query_str = str(args[0]).lower()
        if "st_contains" in query_str:
            mock_result = MagicMock()
            ward = PuneWard(id=uuid.uuid4(), ward_number=999, ward_name="Test")
            mock_result.scalar_one_or_none.return_value = ward
            return mock_result
        mock_result = MagicMock()
        adv = CivicAdvisory(id=uuid.uuid4(), public_id="ADV-1234", title="Water Cut", description="Test", starts_at=datetime.now(timezone.utc), expires_at=datetime.now(timezone.utc) + timedelta(days=1), status="ACTIVE", created_by=uuid.uuid4(), created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
        mock_result.scalars.return_value.all.return_value = [adv]
        return mock_result

    mock_db.scalar.side_effect = scalar_side_effect
    mock_db.scalars.side_effect = scalars_side_effect
    mock_db.execute.side_effect = execute_side_effect

    async def refresh_side_effect(obj, *args, **kwargs):
        if hasattr(obj, "id") and obj.id is None:
            obj.id = uuid.uuid4()
        if hasattr(obj, "created_at") and getattr(obj, "created_at") is None:
            obj.created_at = datetime.now(timezone.utc)
        if hasattr(obj, "updated_at") and getattr(obj, "updated_at") is None:
            obj.updated_at = datetime.now(timezone.utc)

    mock_db.refresh.side_effect = refresh_side_effect

    app.dependency_overrides[get_session] = lambda: mock_db
    try:
        yield mock_db
    finally:
        app.dependency_overrides.pop(get_session, None)

@pytest.fixture
def admin_user():
    return User(id=uuid.uuid4(), email="admin@test.local", name="Admin", role=UserRole.ADMINISTRATOR)

@pytest.fixture
def municipal_officer():
    user = User(id=uuid.uuid4(), email="officer@test.local", name="Officer", role=UserRole.MUNICIPAL_OFFICER)
    user.ward_id = uuid.uuid4()
    return user

@pytest.fixture
def citizen_user():
    return User(id=uuid.uuid4(), email="citizen@test.local", name="Citizen", role=UserRole.CITIZEN)

@pytest.mark.anyio
async def test_admin_create_advisory(admin_user, mock_session):
    app.dependency_overrides[get_current_user] = override_auth_for_user(admin_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        now = datetime.now(timezone.utc)
        res = await ac.post(
            "/api/advisories",
            json={
                "title": "Global Maintenance",
                "description": "City-wide maintenance",
                "starts_at": now.isoformat(),
                "expires_at": (now + timedelta(days=1)).isoformat()
            }
        )
        assert res.status_code == 201

@pytest.mark.anyio
async def test_officer_create_advisory_in_scope(municipal_officer, mock_session):
    app.dependency_overrides[get_current_user] = override_auth_for_user(municipal_officer)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        now = datetime.now(timezone.utc)
        res = await ac.post(
            "/api/advisories",
            json={
                "title": "Ward Maintenance",
                "description": "Ward specific maintenance",
                "starts_at": now.isoformat(),
                "expires_at": (now + timedelta(days=1)).isoformat(),
                "ward_id": str(municipal_officer.ward_id)
            }
        )
        assert res.status_code == 201

@pytest.mark.anyio
async def test_officer_create_advisory_out_of_scope(municipal_officer, mock_session):
    app.dependency_overrides[get_current_user] = override_auth_for_user(municipal_officer)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        now = datetime.now(timezone.utc)
        res = await ac.post(
            "/api/advisories",
            json={
                "title": "Global Maintenance",
                "description": "Global",
                "starts_at": now.isoformat(),
                "expires_at": (now + timedelta(days=1)).isoformat()
            }
        )
        assert res.status_code == 403

@pytest.mark.anyio
async def test_citizen_cannot_create_advisory(citizen_user, mock_session):
    app.dependency_overrides[get_current_user] = override_auth_for_user(citizen_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        now = datetime.now(timezone.utc)
        res = await ac.post(
            "/api/advisories",
            json={
                "title": "Citizen Maintenance",
                "description": "Should fail",
                "starts_at": now.isoformat(),
                "expires_at": (now + timedelta(days=1)).isoformat()
            }
        )
        assert res.status_code == 403

@pytest.mark.anyio
async def test_check_advisories(admin_user, mock_session):
    app.dependency_overrides[get_current_user] = override_auth_for_user(admin_user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/api/complaints/check-advisories",
            params={"latitude": 18.520430, "longitude": 73.856743}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["has_advisory"] is True
        assert len(data["advisories"]) > 0
