import uuid
from app.models import Complaint, ComplaintStatus, ResolutionEvidence, Reward, User, UserRole
from app.security import hash_password


def test_resolution_evidence_association():
    """Verify resolution evidence attaches to complaint and officer."""
    citizen_id = uuid.uuid4()
    officer_id = uuid.uuid4()
    complaint_id = uuid.uuid4()

    complaint = Complaint(
        id=complaint_id,
        public_id="CIV-9999",
        citizen_id=citizen_id,
        description="Pothole on 5th Avenue",
        status=ComplaintStatus.IN_PROGRESS,
    )
    evidence = ResolutionEvidence(
        complaint_id=complaint_id,
        officer_id=officer_id,
        image_url="/uploads/repaired.jpg",
        remarks="Pothole filled with fresh asphalt",
    )

    assert evidence.complaint_id == complaint.id
    assert evidence.image_url == "/uploads/repaired.jpg"


def test_reward_points_creation():
    """Verify reward points object creation for resolved issue."""
    citizen_id = uuid.uuid4()
    complaint_id = uuid.uuid4()

    reward = Reward(
        user_id=citizen_id,
        points=50,
        reason="Issue CIV-1001 successfully resolved",
        complaint_id=complaint_id,
    )

    assert reward.points == 50
    assert reward.user_id == citizen_id
    assert reward.complaint_id == complaint_id
