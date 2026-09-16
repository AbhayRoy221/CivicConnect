import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import User, UserRole
from app.dependencies import get_current_user

def mock_auth(role, department_id=None):
    async def override_get_user():
        user = User(id=uuid.uuid4(), email=f"{role}@test.local", name=f"Test {role}", role=role)
        if department_id:
            user.department_id = department_id
        return user
    app.dependency_overrides[get_current_user] = override_get_user

@pytest.mark.anyio
async def test_analytics_detailed_access():
    mock_auth(UserRole.CITIZEN)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/admin/analytics/detailed")
        assert resp.status_code == 403

    mock_auth(UserRole.ADMINISTRATOR)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/admin/analytics/detailed")
        assert resp.status_code == 200
        data = resp.json()
        assert "kpis" in data
        assert "status_distribution" in data

        kpis = data["kpis"]

        # 1. Total = open + resolved + rejected
        # Note: in_progress is a subset of open, escalated is an independent flag.
        assert kpis["total_complaints"] == kpis["open_complaints"] + kpis["resolved_complaints"] + kpis["rejected_complaints"]

        # 2. Ward sum = total
        ward_total = sum(w["total_complaints"] for w in data["ward_summary"])
        assert ward_total == kpis["total_complaints"]

        # 3. Department sum = total
        dept_total = sum(d["total"] for d in data["department_workload"])
        assert dept_total == kpis["total_complaints"]

        # Test Authority Filters
        # PMC
        resp_pmc = await ac.get("/api/admin/analytics/detailed?authority=PMC")
        assert resp_pmc.status_code == 200
        pmc_data = resp_pmc.json()
        assert "kpis" in pmc_data

        # Pune Traffic Police
        resp_ptp = await ac.get("/api/admin/analytics/detailed?authority=PUNE_TRAFFIC_POLICE")
        assert resp_ptp.status_code == 200
        ptp_data = resp_ptp.json()
        assert "kpis" in ptp_data

        # Invalid authority
        resp_invalid = await ac.get("/api/admin/analytics/detailed?authority=INVALID_AUTH")
        assert resp_invalid.status_code == 200 # Should ignore invalid filter and return 200

    app.dependency_overrides.clear()
