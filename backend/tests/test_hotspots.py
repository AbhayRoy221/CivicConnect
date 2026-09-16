import pytest
from app.hotspots import calculate_hotspots, haversine_distance

def test_haversine_distance():
    # Test distance between two known points (e.g., Pune coordinates)
    # Approx distance 1 degree lat is ~111km
    d = haversine_distance(18.5204, 73.8567, 18.5294, 73.8567)
    # 0.009 degrees * 111,000 meters/deg ~ 1000 meters
    assert 990 < d < 1010

class DummyComplaint:
    def __init__(self, id, lat, lon, category, status="SUBMITTED", severity="low", ward=None, zone=None):
        self.id = id
        self.latitude = lat
        self.longitude = lon
        self.category_name = category
        self.status = status
        self.severity = severity
        self.administrative_ward_name = ward
        self.administrative_zone = zone

def test_calculate_hotspots():
    complaints = [
        DummyComplaint("1", 18.52, 73.85, "Garbage", status="RESOLVED"),
        DummyComplaint("2", 18.5201, 73.8501, "Garbage", status="SUBMITTED", ward="Aundh"),
        
        DummyComplaint("3", 18.60, 73.90, "Garbage"), 
        DummyComplaint("3b", 18.6001, 73.9001, "Garbage"),
        
        DummyComplaint("4", 18.52, 73.85, "Roads"), 
        DummyComplaint("4b", 18.5201, 73.8501, "Roads"),
        
        DummyComplaint("5", None, None, "Garbage"), # null coords -> skipped
    ]

    hotspots = calculate_hotspots(complaints, radius_meters=200.0)

    # We expect 3 hotspots because each cluster now has 2 valid items
    assert len(hotspots) == 3

    garbage_hotspots = [h for h in hotspots if h["category_name"] == "Garbage"]
    assert len(garbage_hotspots) == 2

    # Check the combined one
    combined = next(h for h in garbage_hotspots if "Aundh" in h["administrative_wards"])
    assert combined["complaint_count"] == 2
    assert combined["open_count"] == 1
    assert combined["resolved_count"] == 1
    assert combined["administrative_wards"] == ["Aundh"]

def test_empty_complaints():
    assert calculate_hotspots([]) == []
