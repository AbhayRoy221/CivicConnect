import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import uuid
from app.services import assign_officer_to_complaint, get_ward_from_coordinates
from app.models import PuneWard, Complaint, User, UserRole

@pytest.mark.anyio
async def test_ward_5_complaint_ward_5_officer():
    session = AsyncMock()
    dept_id = uuid.uuid4()
    ward_id = uuid.uuid4()
    
    mock_officer = User(id=uuid.uuid4(), department_id=dept_id, ward_id=ward_id)
    # The result of await session.execute(stmt) is a mock object whose first() returns a tuple
    mock_result = MagicMock()
    mock_result.first.return_value = (mock_officer, 0)
    session.execute.return_value = mock_result

    officer = await assign_officer_to_complaint(session, dept_id, ward_id)
    assert officer is not None
    assert officer.id == mock_officer.id

@pytest.mark.anyio
async def test_two_officers_load_balancing():
    session = AsyncMock()
    dept_id = uuid.uuid4()
    ward_id = uuid.uuid4()
    
    mock_officer_b = User(id=uuid.uuid4(), department_id=dept_id, ward_id=ward_id)
    mock_result = MagicMock()
    mock_result.first.return_value = (mock_officer_b, 1)
    session.execute.return_value = mock_result
    
    officer = await assign_officer_to_complaint(session, dept_id, ward_id)
    assert officer.id == mock_officer_b.id

@pytest.mark.anyio
async def test_no_matching_officer_unassigned():
    session = AsyncMock()
    dept_id = uuid.uuid4()
    ward_id = uuid.uuid4()
    
    mock_result = MagicMock()
    mock_result.first.return_value = None
    session.execute.return_value = mock_result
    
    officer = await assign_officer_to_complaint(session, dept_id, ward_id)
    assert officer is None

@pytest.mark.anyio
async def test_outside_pune_no_ward_no_officer():
    session = AsyncMock()
    session.scalar.return_value = None
    
    ward = await get_ward_from_coordinates(session, 51.5074, -0.1278)
    assert ward is None
    
    mock_result = MagicMock()
    mock_result.first.return_value = None
    session.execute.return_value = mock_result
    
    officer = await assign_officer_to_complaint(session, uuid.uuid4(), None)
    assert officer is None
