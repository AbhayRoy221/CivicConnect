import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine('postgresql+asyncpg://civic_user:change-me-for-local-development@localhost:5432/civic_reports')

async def main():
    async with engine.begin() as conn:
        try:
            res = await conn.execute(sa.text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pune_wards';"))
            for row in res.fetchall():
                print(row)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
