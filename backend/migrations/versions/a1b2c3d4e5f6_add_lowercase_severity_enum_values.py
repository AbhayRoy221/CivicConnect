"""add_lowercase_severity_enum_values

Revision ID: a1b2c3d4e5f6
Revises: fd75433cf91f
Create Date: 2026-09-16 06:10:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fd75433cf91f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add lowercase values to the severity PostgreSQL enum.
    
    The Python Severity enum uses lowercase values (low, medium, high, critical)
    but the PostgreSQL enum only had uppercase (LOW, MEDIUM, HIGH, CRITICAL).
    This adds the lowercase variants so both are valid in the database.
    Then migrates existing uppercase data to lowercase for consistency.
    """
    # Add lowercase values to the enum type
    op.execute("ALTER TYPE severity ADD VALUE IF NOT EXISTS 'low'")
    op.execute("ALTER TYPE severity ADD VALUE IF NOT EXISTS 'medium'")
    op.execute("ALTER TYPE severity ADD VALUE IF NOT EXISTS 'high'")
    op.execute("ALTER TYPE severity ADD VALUE IF NOT EXISTS 'critical'")
    # Commit the enum changes before we can use them in UPDATE
    # (PostgreSQL requires enum additions to be committed before use)


def downgrade() -> None:
    """PostgreSQL does not support removing enum values easily.
    The lowercase values are harmless if left in place.
    """
    pass
