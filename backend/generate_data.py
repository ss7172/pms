import os
import sys
import random
from datetime import date, time, timedelta, datetime
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from faker import Faker
from app import create_app
from app.extensions import db
from app.models import (
    User, Department, Doctor, Patient,
    Appointment, Visit, BillingRecord, BillingItem, PatientDocument
)

fake = Faker('en_IN')  # Indian locale for realistic names/addresses
random.seed(42)        # Reproducible data

# ─── Constants ────────────────────────────────────────────────────────────────

APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show']
APPOINTMENT_STATUS_WEIGHTS = [20, 60, 10, 10]  # 60% completed

BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
BLOOD_GROUP_WEIGHTS = [28, 6, 23, 5, 30, 3, 8, 2]  # Realistic Indian distribution

GENDERS = ['male', 'female']
GENDER_WEIGHTS = [52, 48]

DIAGNOSES = [
    ("Hypertension, uncontrolled", "I10"),
    ("Type 2 diabetes mellitus", "E11.9"),
    ("Stable angina", "I20.9"),
    ("Acute gastritis", "K29.70"),
    ("Irritable bowel syndrome", "K58.9"),
    ("Fatty liver disease", "K76.0"),
    ("Viral fever", "A99"),
    ("Upper respiratory tract infection", "J06.9"),
    ("Migraine without aura", "G43.909"),
    ("Anxiety disorder", "F41.9"),
    ("Osteoarthritis of knee", "M17.9"),
    ("Hypothyroidism", "E03.9"),
    ("Anaemia, unspecified", "D64.9"),
    ("Chronic obstructive pulmonary disease", "J44.9"),
    ("Acute myocardial infarction", "I21.9"),
]

SYMPTOMS = [
    "Chest pain and shortness of breath",
    "Abdominal pain and nausea",
    "Fever and body ache",
    "Headache and dizziness",
    "Fatigue and weakness",
    "Cough and cold",
    "Back pain",
    "Joint pain and swelling",
    "Loss of appetite",
    "Palpitations",
]

PRESCRIPTIONS = [
    "Tab. Metoprolol 25mg BD, Tab. Aspirin 75mg OD",
    "Tab. Metformin 500mg BD, Tab. Glipizide 5mg OD",
    "Tab. Pantoprazole 40mg OD, Tab. Ondansetron 4mg TDS",
    "Tab. Paracetamol 500mg TDS, Tab. Cetirizine 10mg OD",
    "Syp. Amoxicillin 250mg/5ml TDS x 5 days",
    "Tab. Atorvastatin 10mg OD, Tab. Ramipril 5mg OD",
    "Tab. Levothyroxine 50mcg OD",
    "Tab. Amlodipine 5mg OD, Tab. Losartan 50mg OD",
]

TESTS = [
    ("ECG", "test", 200),
    ("Echocardiogram", "test", 1500),
    ("CBC", "test", 300),
    ("Lipid Profile", "test", 400),
    ("Blood Sugar Fasting", "test", 150),
    ("LFT", "test", 500),
    ("KFT", "test", 500),
    ("Thyroid Profile", "test", 600),
    ("Chest X-Ray", "procedure", 400),
    ("USG Abdomen", "procedure", 800),
    ("Upper GI Endoscopy", "procedure", 2500),
    ("Colonoscopy", "procedure", 3000),
]

PAYMENT_METHODS = ['cash', 'card', 'upi', 'insurance']
PAYMENT_WEIGHTS = [50, 15, 30, 5]


def generate_patients(n: int = 10000) -> list:
    """Generate n realistic Indian patients."""
    print(f"\nGenerating {n} patients...")
    patients = []

    used_phones = set()

    # Get existing phones from seed data
    existing = Patient.query.with_entities(Patient.phone).all()
    used_phones = {p.phone for p in existing}

    for i in range(n):
        # Generate unique phone
        while True:
            phone = f"9{random.randint(100000000, 999999999)}"
            if phone not in used_phones:
                used_phones.add(phone)
                break

        gender = random.choices(GENDERS, weights=GENDER_WEIGHTS)[0]

        if gender == 'male':
            first_name = fake.first_name_male()
        else:
            first_name = fake.first_name_female()

        dob = fake.date_of_birth(minimum_age=5, maximum_age=85)

        patient = Patient(
            first_name=first_name,
            last_name=fake.last_name(),
            date_of_birth=dob,
            gender=gender,
            phone=phone,
            email=fake.email() if random.random() > 0.6 else None,
            address=fake.address(),
            emergency_contact=f"{fake.name()} - {fake.phone_number()}",
            blood_group=random.choices(BLOOD_GROUPS, weights=BLOOD_GROUP_WEIGHTS)[0],
        )
        db.session.add(patient)
        patients.append(patient)

        if (i + 1) % 1000 == 0:
            db.session.flush()
            print(f"  {i + 1}/{n} patients created...")

    db.session.flush()
    print(f"  {n} patients created.")
    return patients


def generate_appointments(patients: list, doctors: list) -> list:
    """Generate ~3 appointments per patient over past 2 years."""
    print("\nGenerating appointments...")
    appointments = []
    today = date.today()
    two_years_ago = today - timedelta(days=730)

    # Track booked slots to avoid conflicts
    booked_slots = set()

    # Load existing booked slots
    existing = Appointment.query.with_entities(
        Appointment.doctor_id,
        Appointment.appointment_date,
        Appointment.appointment_time
    ).all()
    for a in existing:
        booked_slots.add((a.doctor_id, a.appointment_date, a.appointment_time))

    # Generate all 30-min slots 9 AM to 5 PM
    all_times = []
    h, m = 9, 0
    while h < 17:
        all_times.append(time(h, m))
        m += 30
        if m >= 60:
            m = 0
            h += 1

    count = 0
    for patient in patients:
        # 1-4 appointments per patient
        n_appointments = random.randint(1, 4)

        for _ in range(n_appointments):
            # Random date in past 2 years, some in future
            if random.random() > 0.05:
                appt_date = fake.date_between(
                    start_date=two_years_ago,
                    end_date=today
                )
                status = random.choices(
                    APPOINTMENT_STATUSES,
                    weights=APPOINTMENT_STATUS_WEIGHTS
                )[0]
            else:
                # 5% future appointments
                appt_date = fake.date_between(
                    start_date=today + timedelta(days=1),
                    end_date=today + timedelta(days=30)
                )
                status = 'scheduled'

            # Pick random doctor
            doctor = random.choice(doctors)

            # Find available slot
            available = [
                t for t in all_times
                if (doctor.id, appt_date, t) not in booked_slots
            ]

            if not available:
                continue  # Skip if no slots

            appt_time = random.choice(available)
            booked_slots.add((doctor.id, appt_date, appt_time))

            appointment = Appointment(
                patient_id=patient.id,
                doctor_id=doctor.id,
                department_id=doctor.department_id,
                appointment_date=appt_date,
                appointment_time=appt_time,
                status=status,
            )
            db.session.add(appointment)
            appointments.append(appointment)
            count += 1

        if count % 5000 == 0 and count > 0:
            db.session.flush()
            print(f"  {count} appointments created...")

    db.session.flush()
    print(f"  {count} appointments created.")
    return appointments


def generate_visits_and_billing(appointments: list) -> None:
    """Generate visits and billing for completed appointments."""
    print("\nGenerating visits and billing...")

    completed = [a for a in appointments if a.status == 'completed']
    print(f"  Processing {len(completed)} completed appointments...")

    for i, appointment in enumerate(completed):
        # Get department consultation fee
        dept = appointment.department
        consultation_fee = Decimal(str(dept.consultation_fee))

        # Pick random diagnosis
        diagnosis_text, diagnosis_code = random.choice(DIAGNOSES)

        # Create visit
        visit = Visit(
            appointment_id=appointment.id,
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            symptoms=random.choice(SYMPTOMS),
            diagnosis=diagnosis_text,
            diagnosis_code=diagnosis_code,
            prescription=random.choice(PRESCRIPTIONS),
            follow_up_date=appointment.appointment_date + timedelta(days=14)
            if random.random() > 0.5 else None,
        )
        db.session.add(visit)
        db.session.flush()

        # Determine total amount and tests
        total = consultation_fee
        extra_items = []

        # 60% chance of additional tests
        if random.random() > 0.4:
            n_tests = random.randint(1, 3)
            selected_tests = random.sample(TESTS, min(n_tests, len(TESTS)))
            for desc, category, amount in selected_tests:
                extra_items.append((desc, category, Decimal(str(amount))))
                total += Decimal(str(amount))

        # Determine billing status
        if appointment.appointment_date < date.today() - timedelta(days=30):
            # Old appointments mostly paid
            status = random.choices(
                ['paid', 'paid', 'paid', 'partially_paid', 'waived'],
                weights=[70, 70, 70, 15, 5]
            )[0]
        else:
            # Recent appointments mix of paid and pending
            status = random.choices(
                ['paid', 'pending', 'partially_paid'],
                weights=[60, 30, 10]
            )[0]

        payment_method = None
        payment_date = None
        if status == 'paid':
            payment_method = random.choices(
                PAYMENT_METHODS,
                weights=PAYMENT_WEIGHTS
            )[0]
            payment_date = datetime.combine(
                appointment.appointment_date,
                time(random.randint(9, 17), 0)
            )

        # Create billing record
        billing_record = BillingRecord(
            visit_id=visit.id,
            patient_id=appointment.patient_id,
            total_amount=total,
            status=status,
            payment_method=payment_method,
            payment_date=payment_date,
        )
        db.session.add(billing_record)
        db.session.flush()

        # Consultation fee line item
        db.session.add(BillingItem(
            billing_record_id=billing_record.id,
            description=f"{dept.name} Consultation",
            category='consultation',
            amount=consultation_fee,
        ))

        # Additional test line items
        for desc, category, amount in extra_items:
            db.session.add(BillingItem(
                billing_record_id=billing_record.id,
                description=desc,
                category=category,
                amount=amount,
            ))

        if (i + 1) % 2000 == 0:
            db.session.commit()
            print(f"  {i + 1}/{len(completed)} visits processed...")

    db.session.commit()
    print(f"  All visits and billing created.")


def run_generate() -> None:
    """Main function — generates synthetic data on top of seed data."""
    app = create_app('development')

    with app.app_context():
        print("\nLoading existing doctors...")
        doctors = Doctor.query.filter_by(is_active=True).all()
        print(f"  Found {len(doctors)} doctors: "
              f"{[d.user.full_name for d in doctors]}")

        patients = generate_patients(10000)
        appointments = generate_appointments(patients, doctors)
        generate_visits_and_billing(appointments)

        print("\nData generation complete.")
        print(f"  Patients: {Patient.query.count()}")
        print(f"  Appointments: {Appointment.query.count()}")
        print(f"  Visits: {Visit.query.count()}")
        print(f"  Billing records: {BillingRecord.query.count()}")
        print(f"  Billing items: {BillingItem.query.count()}")


if __name__ == '__main__':
    run_generate()