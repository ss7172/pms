# pipeline/jobs/patient_analytics.py
"""
Patient analytics job.
Produces denormalized patient profiles with aggregated metrics and risk flags.
Output feeds both the dashboard and the RAG system via patient_profiles table.
"""
from pipeline.jobs.base import BaseJob
from pipeline.db import get_connection, load_sql
from sqlalchemy import text


class PatientAnalyticsJob(BaseJob):
    """
    Transforms patients + visits + billing into analytics.patient_profiles.

    Source: patients, visits, appointments, billing_records, doctors, departments
    Destination: analytics.patient_profiles
    Granularity: one row per active patient
    """
    job_name = 'patient_analytics'

    def run(self) -> int:
        """
        Execute patient profiles SQL and return rows upserted.

        Returns:
            Number of rows processed
        """
        sql = load_sql('patient_profiles.sql')

        with get_connection() as conn:
            result = conn.execute(text(sql))
            conn.commit()
            return result.rowcount