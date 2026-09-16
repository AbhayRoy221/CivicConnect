import io
import pytest
from PIL import Image
from fastapi import HTTPException
from app.api import _can_view, _validate_image
from app.models import Complaint, User, UserRole


def test_can_view_cross_citizen_isolation():
    """Verify citizens can only view their own complaints while admins can view all."""
    citizen_a = User(id=1, name="Citizen A", role=UserRole.CITIZEN)
    citizen_b = User(id=2, name="Citizen B", role=UserRole.CITIZEN)
    admin = User(id=3, name="Admin", role=UserRole.ADMINISTRATOR)

    complaint_a = Complaint(citizen_id=1)

    assert _can_view(citizen_a, complaint_a) is True
    assert _can_view(citizen_b, complaint_a) is False
    assert _can_view(admin, complaint_a) is True


def test_validate_image_rejects_invalid_mime_type():
    """Verify image validation rejects non-image MIME types."""
    class DummyUploadFile:
        content_type = "application/pdf"
        filename = "document.pdf"

    dummy_file = DummyUploadFile()
    dummy_content = b"%PDF-1.4 test file content"

    with pytest.raises(HTTPException) as exc_info:
        _validate_image(dummy_file, dummy_content)
    assert exc_info.value.status_code == 415


def test_validate_image_accepts_valid_jpeg():
    """Verify image validation passes for valid JPEG byte streams."""
    class DummyUploadFile:
        content_type = "image/jpeg"
        filename = "valid.jpg"

    img = Image.new("RGB", (100, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    content = buf.getvalue()

    dummy_file = DummyUploadFile()
    # Should not raise exception
    _validate_image(dummy_file, content)
