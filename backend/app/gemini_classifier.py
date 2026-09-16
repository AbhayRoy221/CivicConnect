import io
import json
import logging
import hashlib
from functools import lru_cache

from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.config import get_settings

logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = [
    "Pothole / Road Damage",
    "Overflowing Garbage",
    "Water Leakage",
    "Waterlogging",
    "Broken Streetlight",
    "Illegal Parking",
    "Other / Uncertain",
    "Plain / No Issue"
]

class CivicClassificationResult(BaseModel):
    category: str
    confidence: float
    evidence: str
    uncertain: bool


def _get_classification_prompt() -> str:
    return """Classify this image into EXACTLY ONE category:
1. Pothole / Road Damage
2. Overflowing Garbage
3. Water Leakage
4. Waterlogging
5. Broken Streetlight
6. Illegal Parking
7. Other / Uncertain
8. Plain / No Issue

RULES:
Pothole vs Waterlogging:
- pothole/road depression -> Pothole
- standing water covering a road/public area -> Waterlogging
- pothole containing water remains Pothole unless flooding clearly dominates

Overflowing Garbage vs Plain:
- significant waste accumulation/overflow -> Overflowing Garbage
- minor isolated litter -> not automatically Overflowing Garbage
- normal/clean bin -> Plain unless obvious overflow

Water Leakage vs Waterlogging:
- active pipe/infrastructure leakage -> Water Leakage
- accumulated standing water over road/public area -> Waterlogging

Illegal Parking:
- classify only with visual evidence of a likely parking violation
- ordinary parked vehicle alone is NOT sufficient
- if evidence insufficient -> Other / Uncertain

Plain / No Issue:
- no target civic issue visibly established

Other / Uncertain:
- ambiguous
- insufficient evidence
- civic problem outside target classes
- do not guess if insufficient evidence

CONFIDENCE RULES (0.0-1.0):
High: clear visible evidence
Medium: some ambiguity but strongest category identifiable
Low: insufficient/conflicting evidence

Provide short visible evidence (one sentence)."""

class GeminiClassifier:
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.gemini_api_key
        self.model_name = settings.gemini_model
        
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def classify_image(self, content: bytes, mime_type: str = "image/jpeg") -> tuple[str, float, str]:
        if not self.client:
            raise ValueError("GEMINI_API_KEY is not configured.")

        image_part = types.Part.from_bytes(data=content, mime_type=mime_type)
        
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CivicClassificationResult,
            temperature=0.1
        )

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[_get_classification_prompt(), image_part],
                config=config,
            )
            
            if not response.text:
                raise ValueError("Empty response from Gemini")
                
            result_dict = json.loads(response.text)
            
            category = result_dict.get("category", "Other / Uncertain")
            confidence = float(result_dict.get("confidence", 0.0))
            evidence = result_dict.get("evidence", "")
            uncertain = result_dict.get("uncertain", False)
            
            if category not in ALLOWED_CATEGORIES:
                category = "Other / Uncertain"
                
            if not (0.0 <= confidence <= 1.0):
                confidence = 0.0
                category = "Other / Uncertain"

            if confidence < 0.60:
                uncertain = True
                
            return category, confidence, evidence
            
        except Exception as e:
            logger.error(f"Gemini classification failed: {e}")
            raise e

@lru_cache(maxsize=128)
def _classify_civic_image_cached(content_hash: str, content: bytes, mime_type: str) -> tuple[str, float, str]:
    classifier = GeminiClassifier()
    return classifier.classify_image(content, mime_type)

def classify_civic_image(content: bytes, mime_type: str = "image/jpeg") -> tuple[str, float, str]:
    content_hash = hashlib.sha256(content).hexdigest()
    return _classify_civic_image_cached(content_hash, content, mime_type)
