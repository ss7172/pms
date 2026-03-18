"""add performance indexes

Revision ID: 5ec4c8bc1460
Revises: 09983940dc82
Create Date: 2026-03-17 20:47:58.362260

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5ec4c8bc1460'
down_revision = '09983940dc82'
branch_labels = None
depends_on = None

def upgrade():
    op.create_index('ix_patients_phone', 'patients', ['phone'])
    op.create_index('ix_patients_name', 'patients', ['last_name', 'first_name'])
    op.create_index('ix_appointments_doctor_date', 'appointments', ['doctor_id', 'appointment_date'])
    op.create_index('ix_appointments_date_status', 'appointments', ['appointment_date', 'status'])
    op.create_index('ix_billing_records_status_created', 'billing_records', ['status', 'created_at'])
    op.create_index('ix_billing_items_record', 'billing_items', ['billing_record_id'])
    op.create_index('ix_visits_patient_created', 'visits', ['patient_id', 'created_at'])
    op.create_index('ix_patient_documents_patient_created', 'patient_documents', ['patient_id', 'created_at'])

def downgrade():
    op.drop_index('ix_patients_phone')
    op.drop_index('ix_patients_name')
    op.drop_index('ix_appointments_doctor_date')
    op.drop_index('ix_appointments_date_status')
    op.drop_index('ix_billing_records_status_created')
    op.drop_index('ix_billing_items_record')
    op.drop_index('ix_visits_patient_created')
    op.drop_index('ix_patient_documents_patient_created')