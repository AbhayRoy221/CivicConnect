from datetime import datetime, timezone
import string
import random
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_, and_, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_session, get_current_user, require_roles
from app.models import CivicAdvisory, CivicAdvisoryStatus, User, UserRole, PuneWard, Category
from app.schemas import CivicAdvisoryCreate, CivicAdvisoryUpdate, CivicAdvisoryResponse, CheckAdvisoryResponse

router = APIRouter(prefix="/api/advisories", tags=["advisories"])

def generate_public_id() -> str:
    return "ADV-" + "".join(random.choices(string.digits, k=4))

@router.post("", response_model=CivicAdvisoryResponse, status_code=status.HTTP_201_CREATED)
async def create_advisory(
    advisory_in: CivicAdvisoryCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR, UserRole.MUNICIPAL_OFFICER)),
):
    # Check scope for officer
    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if advisory_in.ward_id is None and current_user.ward_id is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create global advisory. Must specify authorized ward.")
        if advisory_in.ward_id != current_user.ward_id and current_user.ward_id is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create advisory outside of authorized ward.")

    advisory = CivicAdvisory(
        public_id=generate_public_id(),
        title=advisory_in.title,
        description=advisory_in.description,
        category_id=advisory_in.category_id,
        ward_id=advisory_in.ward_id,
        starts_at=advisory_in.starts_at,
        expires_at=advisory_in.expires_at,
        created_by=current_user.id,
        status=CivicAdvisoryStatus.ACTIVE
    )

    db.add(advisory)
    await db.commit()
    await db.refresh(advisory)

    from app.services import audit
    await audit(
        session=db,
        action="ADVISORY_CREATED",
        entity_type="civic_advisory",
        entity_id=advisory.public_id,
        actor_id=current_user.id,
        metadata={"title": advisory.title}
    )

    return advisory

@router.get("", response_model=list[CivicAdvisoryResponse])
async def get_advisories(
    ward_id: UUID | None = None,
    category_id: UUID | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_session)
):
    now = datetime.now(timezone.utc)
    query = select(CivicAdvisory)

    if active_only:
        query = query.where(
            CivicAdvisory.status == CivicAdvisoryStatus.ACTIVE,
            CivicAdvisory.expires_at > now
        )

    if ward_id:
        query = query.where(or_(CivicAdvisory.ward_id == ward_id, CivicAdvisory.ward_id == None))

    if category_id:
        query = query.where(or_(CivicAdvisory.category_id == category_id, CivicAdvisory.category_id == None))

    query = query.order_by(desc(CivicAdvisory.created_at))
    result = await db.execute(query)
    return result.scalars().all()

@router.patch("/{id}", response_model=CivicAdvisoryResponse)
async def update_advisory(
    id: UUID,
    advisory_update: CivicAdvisoryUpdate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.ADMINISTRATOR, UserRole.MUNICIPAL_OFFICER))
):
    advisory = await db.get(CivicAdvisory, id)
    if not advisory:
        raise HTTPException(status_code=404, detail="Advisory not found")

    if current_user.role == UserRole.MUNICIPAL_OFFICER:
        if advisory.ward_id != current_user.ward_id and current_user.ward_id is not None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this advisory")

    update_data = advisory_update.model_dump(exclude_unset=True)

    if "ward_id" in update_data and current_user.role == UserRole.MUNICIPAL_OFFICER:
        if update_data["ward_id"] != current_user.ward_id and current_user.ward_id is not None:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot change ward to unauthorized area")

    for key, value in update_data.items():
        setattr(advisory, key, value)

    await db.commit()
    await db.refresh(advisory)

    from app.services import audit
    await audit(
        session=db,
        action="ADVISORY_UPDATED" if "status" not in update_data or update_data["status"] == CivicAdvisoryStatus.ACTIVE else f"ADVISORY_{update_data['status'].name}",
        entity_type="civic_advisory",
        entity_id=advisory.public_id,
        actor_id=current_user.id
    )

    return advisory

complaints_advisories_router = APIRouter(prefix="/api/complaints", tags=["complaints_advisories"])

@complaints_advisories_router.get("/check-advisories", response_model=CheckAdvisoryResponse)
async def check_advisories(
    latitude: float,
    longitude: float,
    category_id: UUID | None = None,
    category_name: str | None = None,
    db: AsyncSession = Depends(get_session)
):
    from sqlalchemy import func
    # 1. Resolve geographic ward
    point = f"SRID=4326;POINT({longitude} {latitude})"
    ward_query = select(PuneWard).where(func.ST_Contains(PuneWard.geometry, func.ST_GeomFromEWKT(point)))
    ward_result = await db.execute(ward_query)
    ward = ward_result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    # 2. Find active advisories
    adv_query = select(CivicAdvisory).where(
        CivicAdvisory.status == CivicAdvisoryStatus.ACTIVE,
        CivicAdvisory.starts_at <= now,
        CivicAdvisory.expires_at > now
    )

    # Matching ward OR global
    if ward:
        adv_query = adv_query.where(or_(CivicAdvisory.ward_id == ward.id, CivicAdvisory.ward_id == None))
    else:
        adv_query = adv_query.where(CivicAdvisory.ward_id == None)

    # Resolve category_id if name is provided
    resolved_category_id = category_id
    if category_name and not resolved_category_id:
        cat_query = select(Category).where(Category.name == category_name)
        cat_res = await db.execute(cat_query)
        cat = cat_res.scalar_one_or_none()
        if cat:
            resolved_category_id = cat.id

    # Matching category OR global category
    if resolved_category_id:
        adv_query = adv_query.where(or_(CivicAdvisory.category_id == resolved_category_id, CivicAdvisory.category_id == None))
    else:
        adv_query = adv_query.where(CivicAdvisory.category_id == None)

    result = await db.execute(adv_query)
    advisories = result.scalars().all()

    return CheckAdvisoryResponse(
        has_advisory=len(advisories) > 0,
        advisories=advisories
    )
