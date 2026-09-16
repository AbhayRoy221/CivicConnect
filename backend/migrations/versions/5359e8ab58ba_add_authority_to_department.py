"""add_authority_to_department

Revision ID: 5359e8ab58ba
Revises: fb97c22d9d27
Create Date: 2026-09-14 22:34:01.027878

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5359e8ab58ba'
down_revision: Union[str, Sequence[str], None] = 'fb97c22d9d27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ENUM type
    authority_enum = postgresql.ENUM('PMC', 'PUNE_TRAFFIC_POLICE', 'NONE', name='authority_enum')
    authority_enum.create(op.get_bind(), checkfirst=True)

    # 2. Add column as nullable first
    op.add_column('departments', sa.Column('authority', sa.Enum('PMC', 'PUNE_TRAFFIC_POLICE', 'NONE', name='authority_enum'), nullable=True))

    # 3. Data migration: Update existing legacy departments
    op.execute("UPDATE departments SET name = 'Solid Waste Management Department', authority = 'PMC' WHERE name = 'Sanitation Department'")
    op.execute("UPDATE departments SET name = 'Road Department', authority = 'PMC' WHERE name = 'Roads & Infrastructure Department'")
    op.execute("UPDATE departments SET name = 'Traffic Police', authority = 'PUNE_TRAFFIC_POLICE' WHERE name = 'Traffic / Enforcement Department'")
    op.execute("UPDATE departments SET name = 'PMC Care / Grievance Redressal Cell', authority = 'PMC' WHERE name = 'General Intake Department'")
    
    # Update authorities for retaining departments
    op.execute("UPDATE departments SET authority = 'PMC' WHERE name = 'Electrical Department'")
    op.execute("UPDATE departments SET authority = 'PMC' WHERE name = 'Water Supply Department'")
    
    # 4. Make column not null
    op.execute("UPDATE departments SET authority = 'PMC' WHERE authority IS NULL")
    op.alter_column('departments', 'authority', nullable=False)
    
    # 6. Update Category mappings
    op.execute("UPDATE categories SET name = 'Other / Uncertain' WHERE name = 'Other'")

def downgrade() -> None:
    op.drop_column('departments', 'authority')
    authority_enum = postgresql.ENUM('PMC', 'PUNE_TRAFFIC_POLICE', 'NONE', name='authority_enum')
    authority_enum.drop(op.get_bind(), checkfirst=True)
