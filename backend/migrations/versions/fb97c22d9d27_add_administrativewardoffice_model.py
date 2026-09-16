"""Add AdministrativeWardOffice model

Revision ID: fb97c22d9d27
Revises: c9dd815f4660
Create Date: 2026-09-14 21:38:27.352790

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2

# revision identifiers, used by Alembic.
revision: str = 'fb97c22d9d27'
down_revision: Union[str, Sequence[str], None] = 'c9dd815f4660'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('administrative_ward_offices',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('official_ward_id', sa.Integer(), nullable=False),
    sa.Column('office_name', sa.String(length=120), nullable=False),
    sa.Column('ward_name', sa.String(length=120), nullable=True),
    sa.Column('zone', sa.String(length=50), nullable=True),
    sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='MULTIPOLYGON', srid=4326, from_text='ST_GeomFromEWKT', name='geometry', nullable=False), nullable=False),
    sa.Column('source_url', sa.String(length=500), nullable=True),
    sa.Column('source_type', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('official_ward_id')
    )
    
    # Complaints table
    op.add_column('complaints', sa.Column('administrative_ward_id', sa.Uuid(), nullable=True))
    op.add_column('complaints', sa.Column('administrative_ward_office', sa.String(length=120), nullable=True))
    op.add_column('complaints', sa.Column('administrative_ward_name', sa.String(length=120), nullable=True))
    op.add_column('complaints', sa.Column('administrative_zone', sa.String(length=50), nullable=True))
    op.add_column('complaints', sa.Column('geographic_ward_number', sa.Integer(), nullable=True))
    
    op.create_index(op.f('ix_complaints_administrative_ward_id'), 'complaints', ['administrative_ward_id'], unique=False)
    op.create_foreign_key(None, 'complaints', 'administrative_ward_offices', ['administrative_ward_id'], ['id'])
    
    op.drop_column('complaints', 'ward_office')
    op.drop_column('complaints', 'zone')
    op.drop_table('ward_offices')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('complaints', sa.Column('zone', sa.VARCHAR(length=50), autoincrement=False, nullable=True))
    op.add_column('complaints', sa.Column('ward_office', sa.VARCHAR(length=120), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'complaints', type_='foreignkey')
    op.drop_index(op.f('ix_complaints_administrative_ward_id'), table_name='complaints')
    op.drop_column('complaints', 'geographic_ward_number')
    op.drop_column('complaints', 'administrative_zone')
    op.drop_column('complaints', 'administrative_ward_name')
    op.drop_column('complaints', 'administrative_ward_office')
    op.drop_column('complaints', 'administrative_ward_id')
    
    op.create_table('ward_offices',
    sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('pune_ward_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('official_ward_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('office_name', sa.VARCHAR(length=120), autoincrement=False, nullable=False),
    sa.Column('ward_name', sa.VARCHAR(length=120), autoincrement=False, nullable=True),
    sa.Column('zone', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('source_url', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('source_type', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['pune_ward_id'], ['pune_wards.id'], name='ward_offices_pune_ward_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='ward_offices_pkey'),
    sa.UniqueConstraint('official_ward_id', name='ward_offices_official_ward_id_key'),
    sa.UniqueConstraint('pune_ward_id', name='ward_offices_pune_ward_id_key')
    )
    op.drop_index('idx_administrative_ward_offices_geometry', table_name='administrative_ward_offices', postgresql_using='gist')
    op.drop_table('administrative_ward_offices')
