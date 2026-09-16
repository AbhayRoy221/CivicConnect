import asyncio
from app.seed import seed
import sys
import traceback

async def main():
    try:
        await seed()
        print("Seed completed successfully!")
    except Exception as e:
        print("Exception caught:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
