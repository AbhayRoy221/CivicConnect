import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Complaint
from app.services import find_related_complaints
from app.priority import calculate_base_priority
from sqlalchemy.orm import selectinload

async def recalculate():
    print("Starting priority engine recalculation...")
    async with AsyncSessionLocal() as session:
        # Fetch all complaints
        query = select(Complaint)
        result = await session.execute(query)
        complaints = result.scalars().all()
        
        print(f"Found {len(complaints)} complaints to process.")
        
        updated_count = 0
        
        for complaint in complaints:
            related_count = 0
            # Only lookup related complaints if coordinates and category exist
            if complaint.latitude is not None and complaint.longitude is not None and complaint.category_id is not None:
                related = await find_related_complaints(
                    session=session,
                    latitude=complaint.latitude,
                    longitude=complaint.longitude,
                    category_id=complaint.category_id,
                    exclude_id=complaint.id
                )
                related_count = len(related)
                
            # Calculate base priority
            base_score, base_reasons = calculate_base_priority(complaint, related_count)
            
            # Update values
            complaint.base_priority_score = base_score
            complaint.base_priority_reasons = base_reasons
            
            # Note: We do not touch admin_priority_override or severity
            
            session.add(complaint)
            updated_count += 1
            
        await session.commit()
        print(f"Successfully recalculated base_priority_score for {updated_count} complaints.")

if __name__ == "__main__":
    asyncio.run(recalculate())
