import asyncio
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.config import get_settings
from app.dependencies import get_session

@pytest.mark.anyio
async def test_illegal_parking_routing():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # We need a user to login
        pass
