import hashlib
import uuid
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


DUPLICATE_RADIUS_METERS = 200.0
DUPLICATE_LOOKBACK_DAYS = 7

async def find_related_complaints(
    session: AsyncSession,
    latitude: float,
    longitude: float,
    category_id: uuid.UUID,
    exclude_id: uuid.UUID | None = None,
    radius_meters: float = DUPLICATE_RADIUS_METERS,
    lookback_days: int = DUPLICATE_LOOKBACK_DAYS,
    min_score: int = 40
) -> list[dict]:
    from app.hotspots import haversine_distance
    from app.models import Category

    since = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    query = select(Complaint, Category.name).outerjoin(Category, Complaint.category_id == Category.id).where(
        Complaint.category_id == category_id,
        Complaint.created_at >= since,
        Complaint.latitude.isnot(None),
        Complaint.longitude.isnot(None)
    )
    if exclude_id:
        query = query.where(Complaint.id != exclude_id)

    candidates = (await session.execute(query)).all()

    results = []
    for c, cat_name in candidates:
        dist = haversine_distance(latitude, longitude, c.latitude, c.longitude)

        if dist <= radius_meters:
            # Score calculation
            score = 50 # Category match base score
            reasons = ["Same category"]

            if dist <= 50:
                score += 30
                reasons.append(f"Very close ({int(dist)}m)")
            elif dist <= 100:
                score += 20
                reasons.append(f"Nearby ({int(dist)}m)")
            elif dist <= 200:
                score += 10
                reasons.append(f"In vicinity ({int(dist)}m)")

            days_ago = (datetime.now(timezone.utc) - c.created_at.replace(tzinfo=timezone.utc)).days
            if days_ago == 0:
                reasons.append("Reported today")
            else:
                reasons.append(f"Reported {days_ago} days ago")

            if score >= min_score:
                results.append({
                    "public_id": c.public_id,
                    "category_name": cat_name,
                    "status": c.status.value if hasattr(c.status, "value") else str(c.status),
                    "severity": c.severity.value if hasattr(c.severity, "value") else str(c.severity),
                    "latitude": c.latitude,
                    "longitude": c.longitude,
                    "administrative_ward_name": c.administrative_ward_name,
                    "geographic_ward_number": c.geographic_ward_number,
                    "created_at": c.created_at,
                    "distance_meters": dist,
                    "match_score": score,
                    "match_reasons": reasons
                })

    # Sort by score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results


def upload_path(upload_dir: str, filename: str) -> Path:
    suffix = Path(filename).suffix.lower() or ".jpg"
    return Path(upload_dir) / f"{hashlib.sha256(filename.encode()).hexdigest()[:10]}-{datetime.now().timestamp():.0f}{suffix}"
