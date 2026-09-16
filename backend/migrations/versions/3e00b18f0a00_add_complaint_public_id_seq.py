"""add complaint public id sequence

Revision ID: 3e00b18f0a00
Revises: 5359e8ab58ba
Create Date: 2026-09-15 02:24:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3e00b18f0a00'
down_revision: Union[str, None] = '5359e8ab58ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dynamically find the max sequence value from existing complaints
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT MAX(CAST(SUBSTRING(public_id FROM 5) AS INTEGER)) FROM complaints WHERE public_id LIKE 'CIV-%'"))
    max_id = result.scalar()
    
    start_with = (max_id + 1) if max_id is not None else 1001
    
    op.execute(f"CREATE SEQUENCE IF NOT EXISTS complaint_public_id_seq START WITH {start_with}")


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS complaint_public_id_seq")
