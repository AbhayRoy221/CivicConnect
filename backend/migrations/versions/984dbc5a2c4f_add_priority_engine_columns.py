"""add priority engine columns

Revision ID: 984dbc5a2c4f
Revises: a1b2c3d4e5f6
Create Date: 2026-09-16 19:53:50.970285

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '984dbc5a2c4f'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('complaints', sa.Column('base_priority_score', sa.Integer(), server_default='0', nullable=False))
    op.add_column('complaints', sa.Column('base_priority_reasons', sa.JSON(), nullable=True))
    op.add_column('complaints', sa.Column('admin_priority_override', sa.Integer(), nullable=True))
    op.add_column('complaints', sa.Column('admin_priority_remarks', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('complaints', 'admin_priority_remarks')
    op.drop_column('complaints', 'admin_priority_override')
    op.drop_column('complaints', 'base_priority_reasons')
    op.drop_column('complaints', 'base_priority_score')
    # ### end Alembic commands ###
