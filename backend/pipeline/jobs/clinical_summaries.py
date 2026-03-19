# pipeline/jobs/clinical_summaries.py
"""
Clinical summaries job.
Produces per-patient structured text summaries for the RAG system.
This is the bridge between the PMS data and the Clinical AI Assistant.

Summary format is intentionally flat text (not JSON) — LLMs perform
better on natural-language structured text for retrieval tasks.
The RAG system chunks on 'VISIT N [date]' boundaries.
"""
import hashlib
from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import text

from pipeline.jobs.base import BaseJob
from pipeline.db import get_connection, load_sql, execute_sql_file


class ClinicalSummariesJob(BaseJob):
    """
    Transforms patient + visit + billing data into
    analytics.patient_clinical_summaries.

    Source: patients, visits, doctors, users, departments,
            billing_records, billing_items
    Destination: analytics.patient_clinical_summaries
    Granularity: one row per active patient with at least one visit
    """
    job_name = 'clinical_summaries'

    def run(self) -> int:
        """
        Fetch raw visit data, group by patient, build summary text,
        batch upsert to analytics schema.

        Returns:
            Number of patient summaries upserted
        """
        # Step 1: Fetch all visit rows (one row per visit per patient)
        rows = execute_sql_file('clinical_summaries.sql')

        if not rows:
            return 0

        # Step 2: Group rows by patient_id
        patients: dict[int, dict[str, Any]] = {}
        for row in rows:
            pid = row['patient_id']
            if pid not in patients:
                patients[pid] = {
                    'patient_id': pid,
                    'full_name': row['full_name'],
                    'age': row['age'],
                    'gender': row['gender'],
                    'blood_group': row['blood_group'],
                    'phone': row['phone'],
                    'visits': [],
                }
            patients[pid]['visits'].append(row)

        # Step 3: Build summary text per patient
        summaries = []
        for pid, data in patients.items():
            text_summary = self._build_summary_text(data)
            summary_hash = hashlib.sha256(text_summary.encode()).hexdigest()
            summaries.append({
                'patient_id': pid,
                'summary_text': text_summary,
                'visit_count': len(data['visits']),
                'summary_hash': summary_hash,
            })

        # Step 4: Batch upsert
        self._upsert_summaries(summaries)
        return len(summaries)

    def _build_summary_text(self, data: dict) -> str:
        """
        Build structured text summary for a patient.
        Format designed for LLM consumption and RAG chunking.

        The RAG system splits on 'VISIT N [date]' boundaries.

        Args:
            data: Patient dict with visits list

        Returns:
            Formatted summary text string
        """
        lines = []

        # Header — patient demographics
        blood = data['blood_group'] or 'Unknown'
        lines.append(
            f"PATIENT: {data['full_name']} | "
            f"Age: {data['age']} | "
            f"Gender: {data['gender'].capitalize()} | "
            f"Blood Group: {blood}"
        )
        lines.append("")

        # One section per visit — ordered by date (SQL already sorted)
        for i, visit in enumerate(data['visits'], 1):
            visit_date = visit['visit_date']
            if isinstance(visit_date, date):
                visit_date = visit_date.strftime('%Y-%m-%d')

            lines.append(f"VISIT {i} [{visit_date}]")
            lines.append(
                f"{visit['doctor_name']}, {visit['department_name']}")

            if visit['symptoms']:
                lines.append(f"Symptoms: {visit['symptoms']}")

            icd = f" (ICD-10: {visit['diagnosis_code']})" if visit['diagnosis_code'] else ""
            lines.append(f"Diagnosis: {visit['diagnosis']}{icd}")

            if visit['prescription']:
                lines.append(f"Prescription: {visit['prescription']}")

            if visit['line_items']:
                lines.append(f"Tests/Procedures: {visit['line_items']}")

            if visit['billing_amount']:
                status = visit['billing_status'] or 'unknown'
                method = visit['payment_method'] or ''
                payment_str = f" via {method}" if method else ""
                lines.append(
                    f"Billing: INR {visit['billing_amount']} "
                    f"({status}{payment_str})"
                )

            if visit['follow_up_date']:
                follow_date = visit['follow_up_date']
                if isinstance(follow_date, date):
                    follow_date = follow_date.strftime('%Y-%m-%d')
                lines.append(f"Follow-up: {follow_date}")
                if visit['follow_up_notes']:
                    lines.append(f"Follow-up Notes: {visit['follow_up_notes']}")

            lines.append("")  # blank line between visits

        return "\n".join(lines).strip()

    def _upsert_summaries(self, summaries: list[dict]) -> None:
        """
        Batch upsert summaries to analytics.patient_clinical_summaries.
        Uses ON CONFLICT to update existing rows — idempotent.

        Args:
            summaries: List of summary dicts
        """
        upsert_sql = text("""
            INSERT INTO analytics.patient_clinical_summaries
                (patient_id, summary_text, visit_count, summary_hash, last_updated)
            VALUES
                (:patient_id, :summary_text, :visit_count, :summary_hash, NOW())
            ON CONFLICT (patient_id) DO UPDATE SET
                summary_text  = EXCLUDED.summary_text,
                visit_count   = EXCLUDED.visit_count,
                summary_hash  = EXCLUDED.summary_hash,
                last_updated  = NOW()
        """)

        with get_connection() as conn:
            # Insert in batches of 500 for efficiency
            batch_size = 500
            for i in range(0, len(summaries), batch_size):
                batch = summaries[i:i + batch_size]
                conn.execute(upsert_sql, batch)
            conn.commit()