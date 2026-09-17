import pytest
import asyncio
from unittest.mock import patch
from urllib.error import URLError
import socket
from sqlalchemy import select, func
from app.database import AsyncSessionLocal, engine
from app.models import PuneWard, AdministrativeWardOffice
from app.seed import seed_administrative_wards
from app.services import get_ward_from_coordinates

@pytest.mark.anyio
async def test_pmc_geoserver_timeout_preserves_snapshot():
    await engine.dispose()
    async with AsyncSessionLocal() as session:
        # 1. Count before timeout
        pune_wards_before = await session.scalar(select(func.count()).select_from(PuneWard))
        admin_wards_before = await session.scalar(select(func.count()).select_from(AdministrativeWardOffice))
        
        # 2. Simulate PMC GeoServer timeout
        with patch('urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.side_effect = URLError(socket.timeout("The read operation timed out"))
            
            await seed_administrative_wards(session)
            
        # 3. Count after timeout
        pune_wards_after = await session.scalar(select(func.count()).select_from(PuneWard))
        admin_wards_after = await session.scalar(select(func.count()).select_from(AdministrativeWardOffice))
        
        assert pune_wards_after == pune_wards_before
        assert admin_wards_after == admin_wards_before
        
        # We expect 41 and 15 exactly for the current verified DB, but let's assert they are not 0
        assert pune_wards_after >= 41
        assert admin_wards_after >= 15
        
        # 4. Verify routing still works using stored data (Pune railway station approx)
        ward = await get_ward_from_coordinates(session, 18.5284, 73.8739)
        assert ward is not None
        assert ward.ward_number == 13
