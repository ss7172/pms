-- pipeline/sql/patient_profiles.sql
-- Denormalized patient profiles with aggregated metrics and risk flags.
-- Uses CTEs for readability and window functions for visit frequency.
-- UPSERT: safe to re-run.

INSERT INTO analytics.patient_profiles (
    patient_id,
    full_name,
    age,
    gender,
    blood_group,
    phone,
    total_visits,
    first_visit_date,
    last_visit_date,
    visit_frequency_days,
    total_billed,
    total_paid,
    outstanding_balance,
    total_appointments,
    no_show_count,
    no_show_rate,
    primary_department,
    primary_doctor,
    risk_flags,
    last_updated
)
WITH visit_stats AS (
    -- Aggregate visit counts and dates per patient
    -- LAG window function computes days between consecutive visits
    SELECT
        patient_id,
        COUNT(*)                          AS total_visits,
        MIN(created_at::date)             AS first_visit_date,
        MAX(created_at::date)             AS last_visit_date,
        ROUND(AVG(gap_days)::numeric, 2)  AS visit_frequency_days
    FROM (
        SELECT
            patient_id,
            created_at,
            created_at::date - LAG(created_at::date)
                OVER (PARTITION BY patient_id ORDER BY created_at) AS gap_days
        FROM visits
    ) gaps
    GROUP BY patient_id
),
billing_stats AS (
    -- Total billed, paid, and outstanding per patient
    SELECT
        patient_id,
        COALESCE(SUM(total_amount), 0)                                           AS total_billed,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'partially_paid')
                          THEN total_amount ELSE 0 END), 0)                      AS outstanding_balance
    FROM billing_records
    GROUP BY patient_id
),
appointment_stats AS (
    -- Total appointments and no-show counts
    SELECT
        patient_id,
        COUNT(*)                                              AS total_appointments,
        COUNT(*) FILTER (WHERE status = 'no_show')           AS no_show_count,
        ROUND(
            COUNT(*) FILTER (WHERE status = 'no_show') * 100.0
            / NULLIF(COUNT(*), 0), 2
        )                                                     AS no_show_rate
    FROM appointments
    GROUP BY patient_id
),
primary_dept AS (
    -- Most visited department per patient using ROW_NUMBER
    SELECT patient_id, department_name
    FROM (
        SELECT
            v.patient_id,
            d.name AS department_name,
            COUNT(*) AS visit_count,
            ROW_NUMBER() OVER (
                PARTITION BY v.patient_id
                ORDER BY COUNT(*) DESC
            ) AS rn
        FROM visits v
        JOIN doctors doc ON doc.id = v.doctor_id
        JOIN departments d ON d.id = doc.department_id
        GROUP BY v.patient_id, d.name
    ) ranked
    WHERE rn = 1
),
primary_doc AS (
    -- Most seen doctor per patient
    SELECT patient_id, doctor_name
    FROM (
        SELECT
            v.patient_id,
            u.full_name AS doctor_name,
            COUNT(*) AS visit_count,
            ROW_NUMBER() OVER (
                PARTITION BY v.patient_id
                ORDER BY COUNT(*) DESC
            ) AS rn
        FROM visits v
        JOIN doctors doc ON doc.id = v.doctor_id
        JOIN users u ON u.id = doc.user_id
        GROUP BY v.patient_id, u.full_name
    ) ranked
    WHERE rn = 1
),
risk_calc AS (
    -- Compute risk flags as array of strings
    SELECT
        p.id AS patient_id,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN COALESCE(aps.no_show_rate, 0) > 30
                 THEN 'high_no_show_rate' END,
            CASE WHEN COALESCE(vs.visit_frequency_days, 0) > 180
                 THEN 'infrequent_visits' END,
            CASE WHEN COALESCE(bs.outstanding_balance, 0) > 5000
                 THEN 'high_outstanding_balance' END,
            CASE WHEN vs.last_visit_date < CURRENT_DATE - INTERVAL '365 days'
                 THEN 'no_visit_in_year' END
        ], NULL) AS risk_flags
    FROM patients p
    LEFT JOIN visit_stats vs ON vs.patient_id = p.id
    LEFT JOIN billing_stats bs ON bs.patient_id = p.id
    LEFT JOIN appointment_stats aps ON aps.patient_id = p.id
    WHERE p.is_active = TRUE
)
SELECT
    p.id                                                    AS patient_id,
    p.first_name || ' ' || p.last_name                     AS full_name,
    DATE_PART('year', AGE(p.date_of_birth))::integer       AS age,
    p.gender,
    p.blood_group,
    p.phone,
    COALESCE(vs.total_visits, 0)                           AS total_visits,
    vs.first_visit_date,
    vs.last_visit_date,
    vs.visit_frequency_days,
    COALESCE(bs.total_billed, 0)                           AS total_billed,
    COALESCE(bs.total_paid, 0)                             AS total_paid,
    COALESCE(bs.outstanding_balance, 0)                    AS outstanding_balance,
    COALESCE(aps.total_appointments, 0)                    AS total_appointments,
    COALESCE(aps.no_show_count, 0)                         AS no_show_count,
    COALESCE(aps.no_show_rate, 0)                          AS no_show_rate,
    pd.department_name                                     AS primary_department,
    pdoc.doctor_name                                       AS primary_doctor,
    COALESCE(rc.risk_flags, ARRAY[]::text[])               AS risk_flags,
    NOW()                                                  AS last_updated
FROM patients p
LEFT JOIN visit_stats vs        ON vs.patient_id = p.id
LEFT JOIN billing_stats bs      ON bs.patient_id = p.id
LEFT JOIN appointment_stats aps ON aps.patient_id = p.id
LEFT JOIN primary_dept pd       ON pd.patient_id = p.id
LEFT JOIN primary_doc pdoc      ON pdoc.patient_id = p.id
LEFT JOIN risk_calc rc          ON rc.patient_id = p.id
WHERE p.is_active = TRUE
ON CONFLICT (patient_id) DO UPDATE SET
    full_name             = EXCLUDED.full_name,
    age                   = EXCLUDED.age,
    gender                = EXCLUDED.gender,
    blood_group           = EXCLUDED.blood_group,
    phone                 = EXCLUDED.phone,
    total_visits          = EXCLUDED.total_visits,
    first_visit_date      = EXCLUDED.first_visit_date,
    last_visit_date       = EXCLUDED.last_visit_date,
    visit_frequency_days  = EXCLUDED.visit_frequency_days,
    total_billed          = EXCLUDED.total_billed,
    total_paid            = EXCLUDED.total_paid,
    outstanding_balance   = EXCLUDED.outstanding_balance,
    total_appointments    = EXCLUDED.total_appointments,
    no_show_count         = EXCLUDED.no_show_count,
    no_show_rate          = EXCLUDED.no_show_rate,
    primary_department    = EXCLUDED.primary_department,
    primary_doctor        = EXCLUDED.primary_doctor,
    risk_flags            = EXCLUDED.risk_flags,
    last_updated          = NOW();