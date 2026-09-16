import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, Category, Complaint, Notification, Severity, PuneWard, AdministrativeWardOffice, User


def calculate_sla_due_at(severity: Severity) -> datetime:
    hours_map = {
        Severity.CRITICAL: 12,
        Severity.HIGH: 24,
        Severity.MEDIUM: 48,
        Severity.LOW: 72,
    }
    hours = hours_map.get(severity, 48)
    return datetime.now(timezone.utc) + timedelta(hours=hours)


async def get_ward_from_coordinates(session: AsyncSession, latitude: float | None, longitude: float | None) -> PuneWard | None:
    if latitude is None or longitude is None:
        return None
    point = f"SRID=4326;POINT({longitude} {latitude})"
    stmt = select(PuneWard).where(
        PuneWard.geometry.ST_Contains(func.ST_GeomFromEWKT(point))
    )
    return await session.scalar(stmt)


async def get_administrative_ward_from_coordinates(session: AsyncSession, latitude: float | None, longitude: float | None) -> AdministrativeWardOffice | None:
    if latitude is None or longitude is None:
        return None
    point = f"SRID=4326;POINT({longitude} {latitude})"
    stmt = select(AdministrativeWardOffice).where(
        AdministrativeWardOffice.geometry.ST_Contains(func.ST_GeomFromEWKT(point))
    )
    return await session.scalar(stmt)


async def assign_officer_to_complaint(session: AsyncSession, department_id, ward_id) -> User | None:
    if not department_id:
        return None
    from app.models import UserRole, ComplaintStatus
    import sqlalchemy as sa
    from sqlalchemy import or_
    stmt = (
        select(User, func.count(Complaint.id).label("active_complaints"))
        .outerjoin(Complaint, (Complaint.officer_id == User.id) & (Complaint.status.in_([ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS])))
        .where(User.role == UserRole.MUNICIPAL_OFFICER)
        .where(User.department_id == department_id)
        .where(or_(User.ward_id == ward_id, User.ward_id.is_(None)))
        .group_by(User.id)
        .order_by(sa.text("active_complaints ASC"), User.id.asc())
        .limit(1)
    )
    result = await session.execute(stmt)
    row = result.first()
    return row[0] if row else None


DEMO_CATEGORY_KEYWORDS = {
    "Overflowing Garbage": ("garbage", "trash", "waste", "bin", "rubbish"),
    "Pothole / Road Damage": ("pothole", "road", "crack", "asphalt"),
    "Broken Streetlight": ("streetlight", "street-light", "lamp", "light"),
    "Water Leakage": ("water", "leak", "pipe", "flood"),
    "Illegal Parking": ("parking", "parked", "vehicle", "car"),
}


def classify_demo_image(filename: str, content: bytes) -> tuple[str, float, str]:
    """Service interface for AI image classification with Gemini + local fallback."""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        if settings.gemini_classifier_enabled:
            import mimetypes
            from app.gemini_classifier import classify_civic_image
            mime_type, _ = mimetypes.guess_type(filename)
            category, confidence, evidence = classify_civic_image(content, mime_type or "image/jpeg")
            return category, confidence, f"[provider=gemini, model={settings.gemini_model}] {evidence}"
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Gemini classification failed or unavailable, falling back: {e}")

    # Fallback behavior
    try:
        import sys
        from pathlib import Path
        root = Path(__file__).resolve().parents[2]
        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        from ml.classifier import classify_image
        cat, conf, rat = classify_image(filename, content)
        return cat, conf, f"[provider=fallback] {rat}"
    except Exception:
        normalized = filename.lower().replace("_", "-")
        for category, keywords in DEMO_CATEGORY_KEYWORDS.items():
            if any(keyword in normalized for keyword in keywords):
                return category, 0.91, "[provider=fallback] Matched a category keyword in the uploaded filename."
        digest = hashlib.sha256(content).digest()[0]
        categories = [*DEMO_CATEGORY_KEYWORDS, "Other / Uncertain"]
        category = categories[digest % len(categories)]
        return category, round(0.55 + (digest % 30) / 100, 2), "[provider=fallback] Deterministic fallback based on image content."


async def category_by_name(session: AsyncSession, name: str) -> Category | None:
    return await session.scalar(select(Category).where(Category.name == name, Category.active.is_(True)))


async def make_public_id(session: AsyncSession) -> str:
    from sqlalchemy import text
    result = await session.execute(text("SELECT nextval('complaint_public_id_seq')"))
    seq_val = result.scalar()
    return f"CIV-{seq_val}"


async def notify(session: AsyncSession, user_id, complaint_id, title: str, message: str) -> None:
    session.add(Notification(user_id=user_id, complaint_id=complaint_id, title=title, message=message))


async def audit(session: AsyncSession, actor_id, action: str, entity_type: str, entity_id: str, metadata=None) -> None:
    session.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata,
        )
    )


async def find_possible_duplicates(session: AsyncSession, complaint: Complaint) -> list[Complaint]:
    if complaint.category_id is None or complaint.latitude is None or complaint.longitude is None:
        return []
    since = datetime.now(timezone.utc) - timedelta(days=30)
    candidates = (
        await session.scalars(
            select(Complaint).where(
                Complaint.id != complaint.id,
                Complaint.category_id == complaint.category_id,
                Complaint.created_at >= since,
            )
        )
    ).all()
    return [
        item
        for item in candidates
        if item.latitude is not None
        and item.longitude is not None
        and abs(item.latitude - complaint.latitude) < 0.01
        and abs(item.longitude - complaint.longitude) < 0.01
    ]


def upload_path(upload_dir: str, filename: str) -> Path:
    suffix = Path(filename).suffix.lower() or ".jpg"
    return Path(upload_dir) / f"{hashlib.sha256(filename.encode()).hexdigest()[:10]}-{datetime.now().timestamp():.0f}{suffix}"
