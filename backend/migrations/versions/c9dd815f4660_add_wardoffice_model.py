"""Add WardOffice model

Revision ID: c9dd815f4660
Revises: 01584ece53fe
Create Date: 2026-09-14 21:08:12.662890

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9dd815f4660'
down_revision: Union[str, Sequence[str], None] = '01584ece53fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('ward_offices',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('pune_ward_id', sa.Uuid(), nullable=False),
    sa.Column('official_ward_id', sa.Integer(), nullable=False),
    sa.Column('office_name', sa.String(length=120), nullable=False),
    sa.Column('ward_name', sa.String(length=120), nullable=True),
    sa.Column('zone', sa.String(length=50), nullable=True),
    sa.Column('source_url', sa.String(length=500), nullable=True),
    sa.Column('source_type', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['pune_ward_id'], ['pune_wards.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('official_ward_id'),
    sa.UniqueConstraint('pune_ward_id')
    )
    op.add_column('complaints', sa.Column('ward_office', sa.String(length=120), nullable=True))
    op.add_column('complaints', sa.Column('zone', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('complaints', 'zone')
    op.drop_column('complaints', 'ward_office')
    op.drop_table('ward_offices')
