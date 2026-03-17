import os
import sys

# Add backend/ to path so we can import app
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models import User, Department, Doctor


def seed_departments() -> dict:
    """Create 4 departments with consultation fees. Returns name→object map."""
    departments_data = [
        {'name': 'Cardiology', 'description': 'Heart and cardiovascular care', 'consultation_fee': 500},
        {'name': 'Gastroenterology', 'description': 'Digestive system care', 'consultation_fee': 500},
        {'name': 'Hepatology', 'description': 'Liver and biliary care', 'consultation_fee': 600},
        {'name': 'General Medicine', 'description': 'General outpatient care', 'consultation_fee': 300},
    ]

    departments = {}
    for data in departments_data:
        dept = Department(**data)
        db.session.add(dept)
        departments[data['name']] = dept
        print(f"  Created department: {data['name']} (fee: ₹{data['consultation_fee']})")

    return departments


def seed_users() -> dict:
    """Create admin, 2 doctors, 1 front desk. Returns email→object map."""
    users_data = [
        {'email': 'admin', 'full_name': 'Admin User', 'role': 'admin', 'password': 'admin123'},
        {'email': 'dr.mohanty', 'full_name': 'Dr. Rajesh Mohanty', 'role': 'doctor', 'password': 'doctor123'},
        {'email': 'dr.patel', 'full_name': 'Dr. Priya Patel', 'role': 'doctor', 'password': 'doctor123'},
        {'email': 'frontdesk1', 'full_name': 'Anita Das', 'role': 'front_desk', 'password': 'front123'},
    ]

    users = {}
    for data in users_data:
        user = User(
            email=data['email'],
            full_name=data['full_name'],
            role=data['role'],
        )
        user.set_password(data['password'])
        db.session.add(user)
        users[data['email']] = user
        print(f"  Created user: {data['full_name']} ({data['role']})")

    return users


def seed_doctors(users: dict, departments: dict) -> None:
    """Create 2 doctor profiles linked to user accounts."""
    doctors_data = [
        {
            'user': users['dr.mohanty'],
            'department': departments['Cardiology'],
            'specialization': 'Interventional Cardiology',
            'phone': '9876543201',
            'license_number': 'OD-12345',
        },
        {
            'user': users['dr.patel'],
            'department': departments['Gastroenterology'],
            'specialization': 'Gastroenterology',
            'phone': '9876543202',
            'license_number': 'OD-12346',
        },
    ]

    for data in doctors_data:
        doctor = Doctor(
            user=data['user'],
            department=data['department'],
            specialization=data['specialization'],
            phone=data['phone'],
            license_number=data['license_number'],
        )
        db.session.add(doctor)
        print(f"  Created doctor: {data['user'].full_name} → {data['department'].name}")


def run_seed() -> None:
    """Main seed function. Clears existing data and reseeds."""
    app = create_app('development')

    with app.app_context():
        print("\nClearing existing data...")
        # Delete in reverse dependency order to avoid FK violations
        Doctor.query.delete()
        User.query.delete()
        Department.query.delete()
        db.session.commit()

        print("\nSeeding departments...")
        departments = seed_departments()

        # Flush so departments get IDs before doctors reference them
        db.session.flush()

        print("\nSeeding users...")
        users = seed_users()

        # Flush so users get IDs before doctors reference them
        db.session.flush()

        print("\nSeeding doctors...")
        seed_doctors(users, departments)

        db.session.commit()
        print("\nSeed complete.")


if __name__ == '__main__':
    run_seed()