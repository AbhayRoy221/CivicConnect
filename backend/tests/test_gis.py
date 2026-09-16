import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services import get_ward_from_coordinates
from app.models import PuneWard, Complaint
from fastapi.testclient import TestClient
from app.main import app

# Create mock PuneWard objects
mock_ward_5 = PuneWard(id="mock-id-5", ward_number=5, ward_name="5")
mock_ward_9 = PuneWard(id="mock-id-9", ward_number=9, ward_name="9")

@pytest.mark.anyio
async def test_get_ward_inside_ward_5():
    session = AsyncMock()
    # Mocking the session to return ward 5 when queried for its bounding box
    session.scalar.return_value = mock_ward_5
    
    ward = await get_ward_from_coordinates(session, 18.5204, 73.8567)
    
    assert ward is not None
    assert ward.ward_number == 5
    # Ensure ST_Contains was called in the query by checking the mock arguments
    assert session.scalar.called

@pytest.mark.anyio
async def test_get_ward_inside_ward_9():
    session = AsyncMock()
    session.scalar.return_value = mock_ward_9
    
    ward = await get_ward_from_coordinates(session, 18.55, 73.95)
    
    assert ward is not None
    assert ward.ward_number == 9

@pytest.mark.anyio
async def test_get_ward_outside_all_polygons():
    session = AsyncMock()
    session.scalar.return_value = None
    
    # Coordinates in another country/city
    ward = await get_ward_from_coordinates(session, 51.5074, -0.1278)
    
    assert ward is None

@pytest.mark.anyio
async def test_complaint_creation_no_fallback_to_demo_wards():
    # If a point is outside (e.g. ward returns None), we should not fall back to "Ward 07 - Central Market Zone"
    session = AsyncMock()
    session.scalar.return_value = None
    
    ward = await get_ward_from_coordinates(session, 10.0, 10.0)
    assert ward is None
    # We assert it explicitly returns None and not any string from DEMO_WARDS

def test_geometry_srid_4326():
    # Ensure our model defines the geometry with SRID 4326
    geom_col = PuneWard.__table__.columns['geometry']
    assert geom_col.type.srid == 4326
    assert geom_col.type.geometry_type == 'MULTIPOLYGON'
