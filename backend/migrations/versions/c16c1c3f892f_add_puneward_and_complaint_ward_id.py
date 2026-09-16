"""Add PuneWard and Complaint ward_id

Revision ID: c16c1c3f892f
Revises: d7afb9b9bacc
Create Date: 2026-09-14 19:35:22.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'c16c1c3f892f'
down_revision: Union[str, Sequence[str], None] = 'd7afb9b9bacc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pune_wards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("ward_number", sa.Integer(), nullable=False),
        sa.Column("ward_name", sa.String(120)),
        sa.Column("geometry", geoalchemy2.types.Geometry(geometry_type='MULTIPOLYGON', srid=4326, spatial_index=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_pune_wards_ward_number", "pune_wards", ["ward_number"], unique=True)
    
    op.add_column("complaints", sa.Column("ward_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_complaints_ward_id_pune_wards", "complaints", "pune_wards", ["ward_id"], ["id"]
    )
    op.create_index("ix_complaints_ward_id", "complaints", ["ward_id"])


def downgrade() -> None:
    op.drop_index("ix_complaints_ward_id", table_name="complaints")
    op.drop_constraint("fk_complaints_ward_id_pune_wards", "complaints", type_="foreignkey")
    op.drop_column("complaints", "ward_id")
    op.drop_index("ix_pune_wards_ward_number", table_name="pune_wards")
    op.drop_table("pune_wards")
