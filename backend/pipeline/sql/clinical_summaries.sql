-- pipeline/sql/clinical_summaries.sql
-- Fetches denormalized patient + visit + billing data for summary generation.
-- One row per visit per patient, ordered by patient_id then visit date.
-- Python job groups by patient_id and builds summary text.

SELECT
    p.id                                                    AS patient_id,
    p.first_name || ' ' || p.last_name                     AS full_name,
    DATE_PART('year', AGE(p.date_of_birth))::integer       AS age,
    p.gender,
    p.blood_group,
    p.phone,
    v.id                                                    AS visit_id,
    v.created_at::date                                      AS visit_date,
    u.full_name                                             AS doctor_name,
    d.name                                                  AS department_name,
    v.symptoms,
    v.diagnosis,
    v.diagnosis_code,
    v.prescription,
    v.follow_up_date,
    v.follow_up_notes,
    br.total_amount                                         AS billing_amount,
    br.status                                               AS billing_status,
    br.payment_method,
    COALESCE(
        STRING_AGG(
            bi.description || ' (INR ' || bi.amount::text || ')',
            ', ' ORDER BY bi.id
        ), ''
    )                                                       AS line_items
FROM patients p
JOIN visits v           ON v.patient_id = p.id
JOIN doctors doc        ON doc.id = v.doctor_id
JOIN users u            ON u.id = doc.user_id
JOIN departments d      ON d.id = doc.department_id
LEFT JOIN billing_records br ON br.visit_id = v.id
LEFT JOIN billing_items bi   ON bi.billing_record_id = br.id
WHERE p.is_active = TRUE
GROUP BY
    p.id, p.first_name, p.last_name, p.date_of_birth,
    p.gender, p.blood_group, p.phone,
    v.id, v.created_at, u.full_name, d.name,
    v.symptoms, v.diagnosis, v.diagnosis_code,
    v.prescription, v.follow_up_date, v.follow_up_notes,
    br.total_amount, br.status, br.payment_method
ORDER BY p.id, v.created_at;