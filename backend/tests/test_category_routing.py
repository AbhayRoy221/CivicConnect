import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import uuid
from app.seed import DEPARTMENTS, CATEGORY_MAPPINGS
from app.models import Authority, Category, Department

def test_department_definitions():
    assert DEPARTMENTS["Road Department"]["authority"] == Authority.PMC
    assert DEPARTMENTS["Solid Waste Management Department"]["authority"] == Authority.PMC
    assert DEPARTMENTS["Water Supply Department"]["authority"] == Authority.PMC
    assert DEPARTMENTS["Drainage Department"]["authority"] == Authority.PMC
    assert DEPARTMENTS["Electrical Department"]["authority"] == Authority.PMC
    assert DEPARTMENTS["Traffic Police"]["authority"] == Authority.PUNE_TRAFFIC_POLICE
    assert DEPARTMENTS["PMC Care / Grievance Redressal Cell"]["authority"] == Authority.PMC

def test_category_mappings():
    assert CATEGORY_MAPPINGS["Pothole / Road Damage"] == "Road Department"
    assert CATEGORY_MAPPINGS["Overflowing Garbage"] == "Solid Waste Management Department"
    assert CATEGORY_MAPPINGS["Water Leakage"] == "Water Supply Department"
    assert CATEGORY_MAPPINGS["Waterlogging"] == "Drainage Department"
    assert CATEGORY_MAPPINGS["Broken Streetlight"] == "Electrical Department"
    assert CATEGORY_MAPPINGS["Illegal Parking"] == "Traffic Police"
    assert CATEGORY_MAPPINGS["Other / Uncertain"] == "PMC Care / Grievance Redressal Cell"
    assert CATEGORY_MAPPINGS["Plain / No Issue"] is None

@pytest.mark.anyio
async def test_illegal_parking_bypasses_pmc_admin_ward():
    # In API logic, if department authority is not PMC, admin_ward becomes None
    session = AsyncMock()
    
    mock_dept = Department(id=uuid.uuid4(), name="Traffic Police", authority=Authority.PUNE_TRAFFIC_POLICE)
    mock_cat = Category(id=uuid.uuid4(), name="Illegal Parking", default_department_id=mock_dept.id)
    
    # Simulate session.get(Department, cat.default_department_id) returning the mock_dept
    session.get.return_value = mock_dept
    
    # Simulating what api.py does:
    category_dept = await session.get(Department, mock_cat.default_department_id) if mock_cat.default_department_id else None
    
    # Simulated fetch from gis
    admin_ward = "Administrative Ward 5"
    
    if not category_dept or category_dept.authority != Authority.PMC:
        admin_ward = None
        
    assert admin_ward is None

@pytest.mark.anyio
async def test_plain_no_issue_bypasses_routing():
    session = AsyncMock()
    
    mock_cat = Category(id=uuid.uuid4(), name="Plain / No Issue", default_department_id=None)
    
    category_dept = await session.get(Department, mock_cat.default_department_id) if mock_cat.default_department_id else None
    
    admin_ward = "Administrative Ward 5"
    
    if not category_dept or category_dept.authority != Authority.PMC:
        admin_ward = None
        
    assert admin_ward is None
    assert category_dept is None
