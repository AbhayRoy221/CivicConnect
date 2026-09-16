import json
import pytest
from unittest.mock import patch, MagicMock
from app.gemini_classifier import GeminiClassifier, classify_civic_image

class MockGenerateContentResponse:
    def __init__(self, text):
        self.text = text

@pytest.fixture(autouse=True)
def clear_cache():
    from app.gemini_classifier import _classify_civic_image_cached
    _classify_civic_image_cached.cache_clear()

@pytest.fixture
def mock_settings(monkeypatch):
    class MockSettings:
        gemini_api_key = "fake_key"
        gemini_model = "gemini-3.6-flash"
        gemini_classifier_enabled = True
    monkeypatch.setattr("app.gemini_classifier.get_settings", lambda: MockSettings())

def test_valid_gemini_response(mock_settings):
    valid_json = json.dumps({
        "category": "Waterlogging",
        "confidence": 0.93,
        "evidence": "Standing water visibly covers the roadway.",
        "uncertain": False
    })
    
    with patch("app.gemini_classifier.genai.Client") as mock_client:
        mock_instance = mock_client.return_value
        mock_instance.models.generate_content.return_value = MockGenerateContentResponse(valid_json)
        
        category, confidence, evidence = classify_civic_image(b"fake_image_bytes")
        assert category == "Waterlogging"
        assert confidence == 0.93
        assert evidence == "Standing water visibly covers the roadway."

def test_invalid_category_rejected(mock_settings):
    invalid_json = json.dumps({
        "category": "Alien Invasion",
        "confidence": 0.99,
        "evidence": "Aliens",
        "uncertain": False
    })
    
    with patch("app.gemini_classifier.genai.Client") as mock_client:
        mock_instance = mock_client.return_value
        mock_instance.models.generate_content.return_value = MockGenerateContentResponse(invalid_json)
        
        category, confidence, evidence = classify_civic_image(b"fake_image_bytes")
        assert category == "Other / Uncertain"
        assert confidence == 0.99

def test_invalid_confidence_rejected(mock_settings):
    invalid_json = json.dumps({
        "category": "Pothole / Road Damage",
        "confidence": 1.5,
        "evidence": "Pothole",
        "uncertain": False
    })
    
    with patch("app.gemini_classifier.genai.Client") as mock_client:
        mock_instance = mock_client.return_value
        mock_instance.models.generate_content.return_value = MockGenerateContentResponse(invalid_json)
        
        category, confidence, evidence = classify_civic_image(b"fake_image_bytes")
        assert category == "Other / Uncertain"
        assert confidence == 0.0

def test_malformed_json_rejected(mock_settings):
    with patch("app.gemini_classifier.genai.Client") as mock_client:
        mock_instance = mock_client.return_value
        mock_instance.models.generate_content.return_value = MockGenerateContentResponse("not json")
        
        with pytest.raises(Exception):
            classify_civic_image(b"fake_image_bytes")

def test_gemini_exception_fallback():
    # If the API fails, it raises an exception which is caught in services.py fallback
    # We test services.py fallback behavior
    from app.services import classify_demo_image
    
    class MockSettingsFail:
        gemini_api_key = "fake_key"
        gemini_model = "gemini-2.5-flash"
        gemini_classifier_enabled = True
    
    with patch("app.core.config.get_settings", return_value=MockSettingsFail()):
        with patch("app.gemini_classifier.classify_civic_image", side_effect=Exception("API Error")):
            cat, conf, rat = classify_demo_image("test.jpg", b"fakebytes")
            assert "[provider=fallback]" in rat

def test_missing_api_key_fallback():
    # If API key is missing, classify_civic_image raises ValueError
    from app.services import classify_demo_image
    
    class MockSettingsNoKey:
        gemini_api_key = None
        gemini_model = "gemini-2.5-flash"
        gemini_classifier_enabled = True
    
    with patch("app.core.config.get_settings", return_value=MockSettingsNoKey()):
        cat, conf, rat = classify_demo_image("test.jpg", b"fakebytes")
        assert "[provider=fallback]" in rat

def test_gemini_disabled_fallback():
    from app.services import classify_demo_image
    
    class MockSettingsDisabled:
        gemini_api_key = "fake_key"
        gemini_model = "gemini-3.6-flash"
        gemini_classifier_enabled = False
    
    with patch("app.core.config.get_settings", return_value=MockSettingsDisabled()):
        cat, conf, rat = classify_demo_image("test.jpg", b"fakebytes")
        assert "[provider=fallback]" in rat
