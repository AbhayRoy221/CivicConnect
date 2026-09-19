"""Add is_test_account to User

Revision ID: 4ee0a06a5808
Revises: f4d37dcec9ab
Create Date: 2026-09-19 14:45:22.353291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4ee0a06a5808'
down_revision: Union[str, Sequence[str], None] = 'f4d37dcec9ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_test_account', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'is_test_account')
