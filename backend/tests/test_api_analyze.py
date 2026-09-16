import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_analyze_gemini_provider_extraction():
    with patch("app.api.classify_demo_image") as mock_classify, patch("app.api._validate_image"):
        # Mock classify_demo_image to return Gemini metadata
        mock_classify.return_value = ("Waterlogging", 0.95, "[provider=gemini, model=gemini-3.6-flash] Standing water is visible.")
        
        # We also need to mock dependency get_current_user to bypass auth
        from app.dependencies import get_current_user
        from app.models import User, UserRole
        
        async def mock_user():
            return User(id="00000000-0000-0000-0000-000000000000", email="test@test.com", role=UserRole.CITIZEN)
            
        app.dependency_overrides[get_current_user] = mock_user
        
        # Create a dummy image file
        files = {"file": ("test.jpg", b"fake_image_bytes", "image/jpeg")}
        
        response = client.post("/api/complaints/analyze", files=files)
        assert response.status_code == 200
        
        data = response.json()
        assert data["category_name"] == "Waterlogging"
        assert data["provider"] == "gemini"
        assert data["model"] == "gemini-3.6-flash"
        assert data["rationale"] == "Standing water is visible."

def test_analyze_fallback_provider_extraction():
    with patch("app.api.classify_demo_image") as mock_classify, patch("app.api._validate_image"):
        # Mock classify_demo_image to return fallback metadata
        mock_classify.return_value = ("Other / Uncertain", 0.55, "[provider=fallback] Deterministic fallback based on image content.")
        
        from app.dependencies import get_current_user
        from app.models import User, UserRole
        
        async def mock_user():
            return User(id="00000000-0000-0000-0000-000000000000", email="test@test.com", role=UserRole.CITIZEN)
            
        app.dependency_overrides[get_current_user] = mock_user
        
        files = {"file": ("test.jpg", b"fake_image_bytes", "image/jpeg")}
        
        response = client.post("/api/complaints/analyze", files=files)
        assert response.status_code == 200
        
        data = response.json()
        assert data["category_name"] == "Other / Uncertain"
        assert data["provider"] == "fallback"
        assert data["model"] == "unknown"
        assert data["rationale"] == "Deterministic fallback based on image content."
        
        app.dependency_overrides.clear()
