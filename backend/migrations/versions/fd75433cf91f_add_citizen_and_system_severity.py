"""add_citizen_and_system_severity

Revision ID: fd75433cf91f
Revises: 456a6a3f058b
Create Date: 2026-09-16 05:47:56.705053

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'fd75433cf91f'
down_revision: Union[str, Sequence[str], None] = '456a6a3f058b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('complaints', sa.Column('citizen_reported_severity', postgresql.ENUM('NOT_ASSESSED', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='severity', create_type=False), nullable=True))
    op.add_column('complaints', sa.Column('system_assessed_severity', postgresql.ENUM('NOT_ASSESSED', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='severity', create_type=False), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('complaints', 'system_assessed_severity')
    op.drop_column('complaints', 'citizen_reported_severity')
