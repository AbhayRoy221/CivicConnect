import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models import PuneWard, AdministrativeWardOffice
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
import xml.etree.ElementTree as ET
from pathlib import Path

engine = create_async_engine('postgresql+asyncpg://civic_user:change-me-for-local-development@localhost:5432/civic_reports')
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def test_seed():
    async with AsyncSessionLocal.begin() as session:
        kml_path = Path("data/gis/pune/pmc_wards_2025.kml")
        tree = ET.parse(kml_path)
        root = tree.getroot()
        ns = {'kml': 'http://www.opengis.net/kml/2.2'} if 'kml' in root.tag else {}
        
        folders = root.findall('.//kml:Folder', ns) if ns else root.findall('.//Folder')
        placemarks = []
        for f in folders:
            placemarks.extend(f.findall('.//kml:Placemark', ns) if ns else f.findall('.//Placemark'))
            
        for pm in placemarks:
            ed = pm.find('.//kml:ExtendedData', ns) if ns else pm.find('.//ExtendedData')
            ward_num = None
            if ed is not None:
                for sd in (ed.findall('kml:SchemaData/kml:SimpleData', ns) if ns else ed.findall('SchemaData/SimpleData')):
                    if sd.get('name') == 'qwr':
                        ward_num = int(float(sd.text))
                        break
            
            polygons_wkt = []
            polys = pm.findall('.//kml:Polygon', ns) if ns else pm.find('.//Polygon')
            for poly in polys:
                rings = []
                outer = poly.find('.//kml:outerBoundaryIs//kml:coordinates', ns) if ns else poly.find('.//outerBoundaryIs//coordinates')
                if outer is not None and outer.text:
                    pts = [c.replace(',', ' ') for c in outer.text.strip().split()]
                    rings.append(f"({', '.join(pts)})")
                if rings:
                    polygons_wkt.append(f"({', '.join(rings)})")
            if polygons_wkt:
                wkt = f"MULTIPOLYGON({', '.join(polygons_wkt)})"
                stmt = pg_insert(PuneWard).values(
                    ward_number=ward_num,
                    geometry=WKTElement(wkt, srid=4326)
                ).on_conflict_do_nothing(index_elements=['ward_number'])
                await session.execute(stmt)
                print(f"Inserted ward {ward_num}")

if __name__ == "__main__":
    asyncio.run(test_seed())
