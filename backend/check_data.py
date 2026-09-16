import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine('postgresql+asyncpg://civic_user:change-me-for-local-development@localhost:5432/civic_reports')

async def main():
    async with engine.begin() as conn:
        try:
            res = await conn.execute(sa.text("SELECT count(*) FROM administrative_ward_offices;"))
            print(f"Administrative Wards count: {res.scalar()}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
