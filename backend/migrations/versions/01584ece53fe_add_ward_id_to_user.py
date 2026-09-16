"""Add ward_id to User

Revision ID: 01584ece53fe
Revises: c16c1c3f892f
Create Date: 2026-09-14 19:46:49.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01584ece53fe'
down_revision: Union[str, Sequence[str], None] = 'c16c1c3f892f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("ward_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_users_ward_id_pune_wards", "users", "pune_wards", ["ward_id"], ["id"]
    )
    op.create_index("ix_users_ward_id", "users", ["ward_id"])


def downgrade() -> None:
    op.drop_index("ix_users_ward_id", table_name="users")
    op.drop_constraint("fk_users_ward_id_pune_wards", "users", type_="foreignkey")
    op.drop_column("users", "ward_id")
