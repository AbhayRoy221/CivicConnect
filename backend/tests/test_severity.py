"""Tests for severity validation, normalization, and error recovery.

Covers:
- Citizen low/medium/high severity submission
- Uppercase HIGH normalization
- Invalid severity rejection (422)
- Stored severity values are canonical lowercase
"""
import pytest
from app.models import Severity
from app.schemas import _normalize_severity


class TestSeverityNormalization:
    """Test the _normalize_severity function directly."""

    def test_lowercase_low(self):
        assert _normalize_severity("low") == "low"

    def test_lowercase_medium(self):
        assert _normalize_severity("medium") == "medium"

    def test_lowercase_high(self):
        assert _normalize_severity("high") == "high"

    def test_lowercase_critical(self):
        assert _normalize_severity("critical") == "critical"

    def test_lowercase_not_assessed(self):
        assert _normalize_severity("not_assessed") == "not_assessed"

    def test_uppercase_HIGH(self):
        assert _normalize_severity("HIGH") == "high"

    def test_uppercase_LOW(self):
        assert _normalize_severity("LOW") == "low"

    def test_uppercase_MEDIUM(self):
        assert _normalize_severity("MEDIUM") == "medium"

    def test_uppercase_CRITICAL(self):
        assert _normalize_severity("CRITICAL") == "critical"

    def test_uppercase_NOT_ASSESSED(self):
        assert _normalize_severity("NOT_ASSESSED") == "not_assessed"

    def test_mixed_case_High(self):
        assert _normalize_severity("High") == "high"

    def test_mixed_case_Medium(self):
        assert _normalize_severity("Medium") == "medium"

    def test_whitespace_trimmed(self):
        assert _normalize_severity("  high  ") == "high"

    def test_enum_instance_passthrough(self):
        assert _normalize_severity(Severity.HIGH) == "high"

    def test_invalid_value_passthrough(self):
        # Invalid values should pass through for Pydantic to reject
        result = _normalize_severity("VERY_HIGH")
        assert result == "VERY_HIGH"  # Not normalized, Pydantic will reject


class TestSeverityEnumValues:
    """Verify the Python Severity enum has the expected canonical values."""

    def test_severity_low_value(self):
        assert Severity.LOW.value == "low"

    def test_severity_medium_value(self):
        assert Severity.MEDIUM.value == "medium"

    def test_severity_high_value(self):
        assert Severity.HIGH.value == "high"

    def test_severity_critical_value(self):
        assert Severity.CRITICAL.value == "critical"

    def test_severity_not_assessed_value(self):
        assert Severity.NOT_ASSESSED.value == "not_assessed"

    def test_severity_from_lowercase_string(self):
        """Severity('low') should produce Severity.LOW."""
        assert Severity("low") is Severity.LOW

    def test_severity_from_uppercase_rejects(self):
        """Severity('HIGH') should raise ValueError (enum values are lowercase)."""
        with pytest.raises(ValueError):
            Severity("HIGH")


class TestSeverityUpdateRequestValidation:
    """Test the SeverityUpdateRequest Pydantic model with CaseInsensitiveSeverity."""

    def test_accept_lowercase(self):
        from app.schemas import SeverityUpdateRequest
        req = SeverityUpdateRequest(severity="high")
        assert req.severity == Severity.HIGH

    def test_accept_uppercase(self):
        from app.schemas import SeverityUpdateRequest
        req = SeverityUpdateRequest(severity="HIGH")
        assert req.severity == Severity.HIGH

    def test_accept_mixed_case(self):
        from app.schemas import SeverityUpdateRequest
        req = SeverityUpdateRequest(severity="Medium")
        assert req.severity == Severity.MEDIUM

    def test_reject_invalid(self):
        from app.schemas import SeverityUpdateRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SeverityUpdateRequest(severity="VERY_HIGH")

    def test_accept_not_assessed(self):
        from app.schemas import SeverityUpdateRequest
        req = SeverityUpdateRequest(severity="NOT_ASSESSED")
        assert req.severity == Severity.NOT_ASSESSED
