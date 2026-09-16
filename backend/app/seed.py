import asyncio
import uuid

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement
import xml.etree.ElementTree as ET
from pathlib import Path

from app.core.config import get_settings
from app.database import AsyncSessionLocal
from app.models import Category, Department, PuneWard, User, UserRole, Authority, AdministrativeWardOffice
from app.security import hash_password

DEPARTMENTS = {
    "Road Department": {"description": "Road surface and public infrastructure issues.", "authority": Authority.PMC},
    "Solid Waste Management Department": {"description": "Waste collection and sanitation issues.", "authority": Authority.PMC},
    "Electrical Department": {"description": "Streetlight and public electrical issues.", "authority": Authority.PMC},
    "Water Supply Department": {"description": "Water leakage and supply issues.", "authority": Authority.PMC},
    "Drainage Department": {"description": "Waterlogging and storm water drains.", "authority": Authority.PMC},
    "Traffic Police": {"description": "Traffic and parking enforcement issues.", "authority": Authority.PUNE_TRAFFIC_POLICE},
    "PMC Care / Grievance Redressal Cell": {"description": "Manually reviews uncategorised reports.", "authority": Authority.PMC},
}

CATEGORY_MAPPINGS = {
    "Pothole / Road Damage": "Road Department",
    "Overflowing Garbage": "Solid Waste Management Department",
    "Water Leakage": "Water Supply Department",
    "Waterlogging": "Drainage Department",
    "Broken Streetlight": "Electrical Department",
    "Illegal Parking": "Traffic Police",
    "Other / Uncertain": "PMC Care / Grievance Redressal Cell",
    "Plain / No Issue": None,
}


async def seed_wards(session) -> None:
    kml_path = Path("data/gis/pune/pmc_wards_2025.kml")
    if not kml_path.exists():
        kml_path = Path("backend/data/gis/pune/pmc_wards_2025.kml")
        if not kml_path.exists():
            print("Ward KML not found, skipping ward import.")
            return

    tree = ET.parse(kml_path)
    root = tree.getroot()
    namespace = root.tag.split('}')[0].strip('{') if '}' in root.tag else ''
    ns = {'kml': namespace} if namespace else {}
    placemarks = root.findall('.//kml:Placemark', ns) if ns else root.findall('.//Placemark')

    for p in placemarks:
        # Extract qwr
        qwr_node = None
        simple_data = p.findall('.//kml:SimpleData', ns) if ns else p.findall('.//SimpleData')
        for sd in simple_data:
            if sd.get('name') == 'qwr':
                qwr_node = sd
                break
        if qwr_node is None or not qwr_node.text:
            continue
        
        ward_num = int(float(qwr_node.text.strip()))
        
        # Build WKT
        polygons_wkt = []
        polys = p.findall('.//kml:Polygon', ns) if ns else p.findall('.//Polygon')
        for poly in polys:
            rings = []
            outer = poly.find('.//kml:outerBoundaryIs//kml:coordinates', ns) if ns else poly.find('.//outerBoundaryIs//coordinates')
            if outer is not None and outer.text:
                pts = [c.replace(',', ' ') for c in outer.text.strip().split()]
                rings.append(f"({', '.join(pts)})")
            inners = poly.findall('.//kml:innerBoundaryIs//kml:coordinates', ns) if ns else poly.findall('.//innerBoundaryIs//coordinates')
            for inner in inners:
                if inner is not None and inner.text:
                    pts = [c.replace(',', ' ') for c in inner.text.strip().split()]
                    rings.append(f"({', '.join(pts)})")
            if rings:
                polygons_wkt.append(f"({', '.join(rings)})")
        
        if polygons_wkt:
            wkt = f"MULTIPOLYGON({', '.join(polygons_wkt)})"
            stmt = pg_insert(PuneWard).values(
                id=uuid.uuid4(),
                ward_number=ward_num,
                geometry=WKTElement(wkt, srid=4326)
            ).on_conflict_do_nothing(index_elements=['ward_number'])
            await session.execute(stmt)
    await session.flush()


async def seed() -> None:
    async with AsyncSessionLocal.begin() as session:
        await seed_wards(session)
        existing_departments = {
            department.name: department
            for department in (await session.scalars(select(Department))).all()
        }
        for name, data in DEPARTMENTS.items():
            if name not in existing_departments:
                department = Department(name=name, description=data["description"], authority=data["authority"])
                session.add(department)
                existing_departments[name] = department
            else:
                dept = existing_departments[name]
                if dept.description != data["description"] or dept.authority != data["authority"]:
                    dept.description = data["description"]
                    dept.authority = data["authority"]

        await session.flush()
        existing_categories = {
            category.name: category for category in (await session.scalars(select(Category))).all()
        }
        for category_name, department_name in CATEGORY_MAPPINGS.items():
            department = existing_departments.get(department_name) if department_name else None
            category = existing_categories.get(category_name)
            if category is None:
                session.add(Category(name=category_name, default_department_id=department.id if department else None))
            elif category.default_department_id != (department.id if department else None):
                category.default_department_id = department.id if department else None

        settings = get_settings()
        demo_accounts = [
            ("Demo Administrator", settings.demo_admin_email, UserRole.ADMINISTRATOR, None, None),
            (
                "Demo Sanitation Officer",
                settings.demo_officer_email,
                UserRole.MUNICIPAL_OFFICER,
                existing_departments["Solid Waste Management Department"].id,
                None
            ),
        ]
        
        ward_5 = await session.scalar(select(PuneWard).where(PuneWard.ward_number == 5))
        if ward_5:
            demo_accounts.append(("Demo Sanitation Officer (Ward 5 - A)", "demo_officer_ward5a@civic.local", UserRole.MUNICIPAL_OFFICER, existing_departments["Solid Waste Management Department"].id, ward_5.id))
            demo_accounts.append(("Demo Sanitation Officer (Ward 5 - B)", "demo_officer_ward5b@civic.local", UserRole.MUNICIPAL_OFFICER, existing_departments["Solid Waste Management Department"].id, ward_5.id))
            
        ward_9 = await session.scalar(select(PuneWard).where(PuneWard.ward_number == 9))
        if ward_9:
            demo_accounts.append(("Demo Sanitation Officer (Ward 9)", "demo_officer_ward9@civic.local", UserRole.MUNICIPAL_OFFICER, existing_departments["Solid Waste Management Department"].id, ward_9.id))

        for name, email, role, department_id, ward_id in demo_accounts:
            if not await session.scalar(select(User).where(User.email == email)):
                session.add(
                    User(
                        name=name,
                        email=email,
                        password_hash=hash_password(settings.demo_password),
                        role=role,
                        department_id=department_id,
                        ward_id=ward_id
                    )
                )
        
        await seed_administrative_wards(session)


async def seed_administrative_wards(session: AsyncSession) -> None:
    import urllib.request
    import json
    
    url = "https://iwmsgis.pmc.gov.in/geoserver/pmc/wms?service=WFS&version=1.1.0&request=GetFeature&typeName=pmc:ward_boundary1&outputFormat=application/json"
    try:
        req = urllib.request.urlopen(url, timeout=10)
        data = json.loads(req.read().decode("utf-8"))
    except Exception as e:
        print(f"Live PMC GIS refresh unavailable; using last verified database snapshot. (Error: {e})")
        return
        
    features = data.get("features", [])
    if len(features) != 15:
        print(f"Live PMC GIS refresh unavailable; using last verified database snapshot. (Expected exactly 15 features, got {len(features)})")
        return
        
    admin_wards_to_insert = []
    seen_official_ids = set()
    
    for f in features:
        props = f.get("properties", {})
        geom = f.get("geometry")
        
        raw_ward_id = props.get("ward_id", "")
        if not raw_ward_id:
            print("Live PMC GIS refresh unavailable; using last verified database snapshot. (Missing ward_id)")
            return
            
        try:
            official_ward_id = int(raw_ward_id.strip())
        except ValueError:
            print(f"Live PMC GIS refresh unavailable; using last verified database snapshot. (Invalid ward_id '{raw_ward_id}')")
            return
            
        if official_ward_id in seen_official_ids:
            print(f"Live PMC GIS refresh unavailable; using last verified database snapshot. (Duplicate official_ward_id {official_ward_id})")
            return
        seen_official_ids.add(official_ward_id)
        
        if not geom:
            print("Live PMC GIS refresh unavailable; using last verified database snapshot. (Missing geometry)")
            return
            
        # Ensure MULTIPOLYGON
        if geom["type"] == "Polygon":
            geom["type"] = "MultiPolygon"
            geom["coordinates"] = [geom["coordinates"]]
        elif geom["type"] != "MultiPolygon":
            print(f"Live PMC GIS refresh unavailable; using last verified database snapshot. (Invalid geometry type {geom['type']})")
            return
            
        geojson_str = json.dumps(geom)
        
        admin_wards_to_insert.append({
            "official_ward_id": official_ward_id,
            "office_name": props.get("WardOffice", ""),
            "ward_name": props.get("Ward_Name"),
            "zone": props.get("Zone"),
            "geometry": func.ST_SetSRID(func.ST_Force2D(func.ST_GeomFromGeoJSON(geojson_str)), 4326),
            "source_url": url,
            "source_type": "PMC GeoServer pmc:ward_boundary1",
        })
        
    if len(admin_wards_to_insert) != 15:
        print("Live PMC GIS refresh unavailable; using last verified database snapshot. (Mismatch in parsed ward offices)")
        return
        
    stmt = pg_insert(AdministrativeWardOffice).values(admin_wards_to_insert)
    stmt = stmt.on_conflict_do_update(
        index_elements=["official_ward_id"],
        set_={
            "office_name": stmt.excluded.office_name,
            "ward_name": stmt.excluded.ward_name,
            "zone": stmt.excluded.zone,
            "geometry": stmt.excluded.geometry,
            "source_url": stmt.excluded.source_url,
            "source_type": stmt.excluded.source_type,
        }
    )
    await session.execute(stmt)
    print("Administrative ward synchronization completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
