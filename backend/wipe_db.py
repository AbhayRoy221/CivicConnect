import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine('postgresql+asyncpg://civic_user:change-me-for-local-development@localhost:5432/civic_reports')

async def main():
    async with engine.begin() as conn:
        try:
            await conn.execute(sa.text("DROP SCHEMA public CASCADE;"))
            await conn.execute(sa.text("CREATE SCHEMA public;"))
            await conn.execute(sa.text("GRANT ALL ON SCHEMA public TO civic_user;"))
            await conn.execute(sa.text("GRANT ALL ON SCHEMA public TO public;"))
            await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            print("DB wiped and recreated clean.")
        except Exception as e:
            print(f"Error wiping DB: {e}")

if __name__ == "__main__":
    asyncio.run(main())
