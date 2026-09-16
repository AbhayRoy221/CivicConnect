import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Department, Category

async def main():
    async with AsyncSessionLocal() as session:
        depts = (await session.scalars(select(Department))).all()
        print('DEPARTMENTS:')
        for d in depts:
            print(f'- {d.name} ({d.authority}) [{d.id}]')
            
        cats = (await session.scalars(select(Category))).all()
        print('\nCATEGORIES:')
        for c in cats:
            dept = next((d for d in depts if d.id == c.default_department_id), None)
            print(f'- {c.name} -> {dept.name if dept else "NULL"} ({dept.authority.value if dept else "NONE"})')

if __name__ == "__main__":
    asyncio.run(main())
