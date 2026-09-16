"""add_NOT_ASSESSED_to_severity_enum

Revision ID: 456a6a3f058b
Revises: 3e00b18f0a00
Create Date: 2026-09-16 04:53:50.301205

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '456a6a3f058b'
down_revision: Union[str, Sequence[str], None] = '3e00b18f0a00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE severity ADD VALUE IF NOT EXISTS 'NOT_ASSESSED'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
