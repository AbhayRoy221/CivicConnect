"""Initial schema and PostGIS

Revision ID: d7afb9b9bacc
Revises: 
Create Date: 2026-09-14 19:12:13.873869

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'd7afb9b9bacc'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role = sa.Enum("CITIZEN", "MUNICIPAL_OFFICER", "ADMINISTRATOR", name="user_role")
complaint_status = sa.Enum("SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED", name="complaint_status")
severity = sa.Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="severity")
duplicate_link_status = sa.Enum("PENDING", "CONFIRMED", "DISMISSED", name="duplicate_link_status")


def upgrade() -> None:
    # 1. Enable PostGIS extension safely
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')

    # 2. Create Enums (Required in Postgres before using them in tables if explicitly defined, though SQLAlchemy often handles it. We'll let SA handle it in create_table)

    op.create_table(
        "departments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("auth_provider", sa.String(50)),
        sa.Column("role", user_role, nullable=False, server_default="CITIZEN"),
        sa.Column("phone", sa.String(30)),
        sa.Column("department_id", sa.Uuid(), sa.ForeignKey("departments.id")),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_department_id", "users", ["department_id"])
    
    op.create_table(
        "categories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("default_department_id", sa.Uuid(), sa.ForeignKey("departments.id")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    
    op.create_table(
        "complaints",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("public_id", sa.String(32), nullable=False, unique=True),
        sa.Column("citizen_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category_id", sa.Uuid(), sa.ForeignKey("categories.id")),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_url", sa.String(500)),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("location", geoalchemy2.types.Geometry(geometry_type='POINT', srid=4326, spatial_index=True)),
        sa.Column("address", sa.String(500)),
        sa.Column("severity", severity, nullable=False, server_default="MEDIUM"),
        sa.Column("status", complaint_status, nullable=False, server_default="SUBMITTED"),
        sa.Column("department_id", sa.Uuid(), sa.ForeignKey("departments.id")),
        sa.Column("officer_id", sa.Uuid(), sa.ForeignKey("users.id")),
        sa.Column("ward_name", sa.String(120)),
        sa.Column("sla_due_at", sa.DateTime(timezone=True)),
        sa.Column("is_escalated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("upvotes", sa.Integer(), nullable=False, server_default='0'),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
    )
    for column in ("public_id", "citizen_id", "category_id", "status", "department_id", "officer_id"):
        op.create_index(f"ix_complaints_{column}", "complaints", [column])
        
    op.create_table(
        "complaint_status_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("complaint_id", sa.Uuid(), sa.ForeignKey("complaints.id"), nullable=False),
        sa.Column("old_status", complaint_status),
        sa.Column("new_status", complaint_status, nullable=False),
        sa.Column("changed_by", sa.Uuid(), sa.ForeignKey("users.id")),
        sa.Column("remarks", sa.Text()),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_complaint_status_history_complaint_id", "complaint_status_history", ["complaint_id"])
    
    op.create_table(
        "duplicate_links",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("complaint_id", sa.Uuid(), sa.ForeignKey("complaints.id"), nullable=False),
        sa.Column("possible_duplicate_id", sa.Uuid(), sa.ForeignKey("complaints.id"), nullable=False),
        sa.Column("similarity_score", sa.Float(), nullable=False),
        sa.Column("status", duplicate_link_status, nullable=False, server_default="PENDING"),
    )
    
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("complaint_id", sa.Uuid(), sa.ForeignKey("complaints.id")),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_complaint_id", "notifications", ["complaint_id"])
    
    op.create_table(
        "resolution_evidence",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("complaint_id", sa.Uuid(), sa.ForeignKey("complaints.id"), nullable=False),
        sa.Column("officer_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=False),
        sa.Column("remarks", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_resolution_evidence_complaint_id", "resolution_evidence", ["complaint_id"])
    
    op.create_table(
        "rewards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(300), nullable=False),
        sa.Column("complaint_id", sa.Uuid(), sa.ForeignKey("complaints.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_rewards_user_id", "rewards", ["user_id"])
    op.create_index("ix_rewards_complaint_id", "rewards", ["complaint_id"])
    
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("entity_type", sa.String(80), nullable=False),
        sa.Column("entity_id", sa.String(64), nullable=False),
        sa.Column("metadata", sa.JSON()),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])


def downgrade() -> None:
    for table in (
        "audit_logs", "rewards", "resolution_evidence", "notifications", "duplicate_links",
        "complaint_status_history", "complaints", "categories", "users", "departments",
    ):
        op.drop_table(table)
    
    bind = op.get_bind()
    duplicate_link_status.drop(bind, checkfirst=True)
    severity.drop(bind, checkfirst=True)
    complaint_status.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
    
    op.execute('DROP EXTENSION IF EXISTS postgis')
