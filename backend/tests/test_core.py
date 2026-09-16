from app.security import hash_password, verify_password
from app.services import classify_demo_image


def test_password_hash_round_trip() -> None:
    encoded = hash_password("safe-demo-password")
    assert verify_password("safe-demo-password", encoded)
    assert not verify_password("wrong-password", encoded)


def test_demo_classifier_is_deterministic() -> None:
    first = classify_demo_image("pothole-road.jpg", b"image bytes")
    second = classify_demo_image("pothole-road.jpg", b"image bytes")
    assert first == second
    assert first[0] == "Pothole / Road Damage"
