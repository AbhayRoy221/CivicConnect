import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import get_settings

engine = create_async_engine(get_settings().database_url)

async def main():
    async with engine.begin() as conn:
        try:
            res = await conn.execute(sa.text("SELECT current_database();"))
            print(f"Connected to DB: {res.scalar()}")
            res2 = await conn.execute(sa.text("SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_name = 'pune_wards';"))
            for row in res2.fetchall():
                print(row)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
