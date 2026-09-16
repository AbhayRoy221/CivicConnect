import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import uuid
from app.models import PuneWard, AdministrativeWardOffice, Complaint
from app.services import get_ward_from_coordinates, get_administrative_ward_from_coordinates
from app.seed import seed_administrative_wards

@pytest.mark.anyio
async def test_qwr_and_administrative_ward_are_independent():
    # Simulate geographic ward
    session = AsyncMock()
    
    mock_ward = PuneWard(id=uuid.uuid4(), ward_number=5)
    
    # Return Geographic Ward
    session.scalar.return_value = mock_ward
    
    geo_ward = await get_ward_from_coordinates(session, 18.55, 73.8)
    assert geo_ward is not None
    assert geo_ward.ward_number == 5
    
    # Simulate missing administrative ward
    session.scalar.return_value = None
    
    admin_ward = await get_administrative_ward_from_coordinates(session, 18.55, 73.8)
    assert admin_ward is None


@pytest.mark.anyio
async def test_administrative_ward_resolves():
    session = AsyncMock()
    mock_office = AdministrativeWardOffice(
        id=uuid.uuid4(), official_ward_id=5, office_name="AUNDH-BANER", 
        ward_name="Aundh - Baner", zone="2"
    )
    
    session.scalar.return_value = mock_office
    
    ward = await get_administrative_ward_from_coordinates(session, 18.55, 73.8)
    
    assert ward is not None
    assert ward.official_ward_id == 5
    assert ward.office_name == "AUNDH-BANER"
    assert ward.ward_name == "Aundh - Baner"
    assert ward.zone == "2"


@pytest.mark.anyio
async def test_no_mapping_for_outside_pune():
    session = AsyncMock()
    
    session.scalar.return_value = None
    
    ward = await get_administrative_ward_from_coordinates(session, 18.0, 73.0)
    assert ward is None


@pytest.mark.anyio
@patch("urllib.request.urlopen")
async def test_pmc_endpoint_failure_does_not_fabricate(mock_urlopen):
    # Simulate HTTP failure
    mock_urlopen.side_effect = Exception("Connection Refused")
    
    session = AsyncMock()
    
    # Must not raise an exception, just skip and return
    await seed_administrative_wards(session)
    
    # Validate session.execute was not called to insert data
    session.execute.assert_not_called()
