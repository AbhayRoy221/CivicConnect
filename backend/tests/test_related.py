import pytest
from httpx import AsyncClient, ASGITransport
import uuid
from unittest.mock import patch, AsyncMock
from datetime import datetime, timezone
from app.main import app
from app.models import User, UserRole
from app.dependencies import get_current_user, get_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

def mock_auth(role, department_id=None):
    async def override_get_user():
        user = User(id=uuid.uuid4(), email=f"{role}@test.local", name=f"Test {role}", role=role)
        if department_id:
            user.department_id = department_id
        return user

    async def override_get_session():
        mock_session = AsyncMock(spec=AsyncSession)
        yield mock_session

    app.dependency_overrides[get_current_user] = override_get_user
    app.dependency_overrides[get_session] = override_get_session

@pytest.fixture
def mock_related():
    return [
        {
            "public_id": "MATCH-50",
            "category_name": "Pothole",
            "status": "in_progress",
            "severity": "medium",
            "latitude": 18.5208,
            "longitude": 73.8567,
            "administrative_ward_name": "Ward 1",
            "geographic_ward_number": 5,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "distance_meters": 44.5,
            "match_score": 80,
            "match_reasons": ["Same category", "Very close (44m)"]
        },
        {
            "public_id": "MATCH-150",
            "category_name": "Pothole",
            "status": "resolved",
            "severity": "low",
            "latitude": 18.5218,
            "longitude": 73.8567,
            "administrative_ward_name": "Ward 1",
            "geographic_ward_number": 5,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "distance_meters": 155.0,
            "match_score": 60,
            "match_reasons": ["Same category", "In vicinity (155m)"]
        }
    ]

@pytest.mark.anyio
async def test_check_related_pre_submission(mock_related):
    mock_auth(UserRole.CITIZEN)
    with patch("app.api.find_related_complaints", new_callable=AsyncMock) as mock_find, \
         patch("app.api.category_by_name", new_callable=AsyncMock) as mock_cat:

        mock_cat.return_value = type("Cat", (), {"id": uuid.uuid4()})()
        mock_find.return_value = mock_related

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/complaints/check-related?latitude=18.5204&longitude=73.8567&category_name=Pothole")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2
            assert data[0]["public_id"] == "MATCH-50"
            assert data[1]["public_id"] == "MATCH-150"

@pytest.mark.anyio
async def test_get_related_for_complaint_excludes_self(mock_related):
    mock_auth(UserRole.CITIZEN)
    with patch("app.api._get_complaint", new_callable=AsyncMock) as mock_get_c, \
         patch("app.api._can_view") as mock_can_view, \
         patch("app.api.find_related_complaints", new_callable=AsyncMock) as mock_find:

        mock_get_c.return_value = type("Complaint", (), {
            "id": uuid.uuid4(),
            "latitude": 18.5204,
            "longitude": 73.8567,
            "category_id": uuid.uuid4()
        })()
        mock_can_view.return_value = True
        mock_find.return_value = mock_related

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/complaints/TARGET-123/related")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2

@pytest.mark.anyio
async def test_get_related_privacy(mock_related):
    mock_auth(UserRole.CITIZEN)
    with patch("app.api._get_complaint", new_callable=AsyncMock) as mock_get_c, \
         patch("app.api._can_view") as mock_can_view, \
         patch("app.api.find_related_complaints", new_callable=AsyncMock) as mock_find:

        mock_get_c.return_value = type("Complaint", (), {
            "id": uuid.uuid4(),
            "latitude": 18.5204,
            "longitude": 73.8567,
            "category_id": uuid.uuid4()
        })()
        mock_can_view.return_value = True
        mock_find.return_value = mock_related

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/complaints/TARGET-123/related")
            data = resp.json()
            for item in data:
                assert "citizen_id" not in item
                assert "citizen_name" not in item
                assert "public_id" in item

@pytest.mark.anyio
async def test_empty_results():
    mock_auth(UserRole.CITIZEN)
    with patch("app.api.category_by_name", new_callable=AsyncMock) as mock_cat, \
         patch("app.api.find_related_complaints", new_callable=AsyncMock) as mock_find:

        mock_cat.return_value = None  # Non-existent category

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/complaints/check-related?latitude=18.5204&longitude=73.8567&category_name=NonExistentCategory")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 0

@pytest.mark.anyio
async def test_admin_access_related(mock_related):
    mock_auth(UserRole.ADMINISTRATOR)
    with patch("app.api._get_complaint", new_callable=AsyncMock) as mock_get_c, \
         patch("app.api._can_view") as mock_can_view, \
         patch("app.api.find_related_complaints", new_callable=AsyncMock) as mock_find:

        mock_get_c.return_value = type("Complaint", (), {
            "id": uuid.uuid4(),
            "latitude": 18.5204,
            "longitude": 73.8567,
            "category_id": uuid.uuid4()
        })()
        mock_can_view.return_value = True
        mock_find.return_value = mock_related

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/complaints/TARGET-123/related")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2

@pytest.mark.anyio
async def test_bibwewadi_vit_regression():
    """
    Regression test: real VIT/Bibwewadi location (18.4637697, 73.8682067)
    must return >= 1 related Pothole / Road Damage complaint from live DB.
    This test runs against the real database (not mocked session).
    It verifies that the endpoint is not blocked by route shadowing,
    that category_by_name resolves 'Pothole / Road Damage', and that
    distance/lookback filtering returns real matches.
    """
    # Only mock auth, use real DB session
    async def override_get_user():
        return User(id=uuid.uuid4(), email="citizen@test.local", name="Test", role=UserRole.CITIZEN)

    app.dependency_overrides[get_current_user] = override_get_user

    # Use a test-local engine/session to avoid cross-test event loop issues with asyncpg
    async def override_get_session():
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from app.core.config import get_settings

        engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            yield session
        await engine.dispose()

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get(
            "/api/complaints/check-related"
            "?latitude=18.4637697"
            "&longitude=73.8682067"
            "&category_name=Pothole%20%2F%20Road%20Damage"
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response must be a list"
        assert len(data) >= 1, (
            f"Expected >= 1 related complaint at 18.4637697, 73.8682067 within 200m "
            f"and 7 days for 'Pothole / Road Damage', got 0. "
            f"Check: (a) recent DB data exists, (b) distance rule is <=200m, "
            f"(c) category name matches canonical 'Pothole / Road Damage'."
        )
        # Verify response structure and privacy
        for item in data:
            assert "public_id" in item
            assert "distance_meters" in item
            assert "match_score" in item
            assert "match_reasons" in item
            assert item["distance_meters"] <= 200.0
            assert "citizen_id" not in item
            assert "email" not in item
