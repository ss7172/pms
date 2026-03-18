from typing import Optional
from app.extensions import db
from app.models.doctor import Doctor
from app.models.user import User
from app.models.department import Department


class DoctorService:
    """Handles all doctor business logic."""

    @staticmethod
    def get_doctors(department_id: Optional[int] = None) -> list:
        """
        Get all active doctors, optionally filtered by department.

        Args:
            department_id: Optional department filter

        Returns:
            List of doctor dicts
        """
        query = Doctor.query.filter_by(is_active=True)

        if department_id:
            query = query.filter_by(department_id=department_id)

        doctors = query.all()
        return [d.to_dict() for d in doctors]

    @staticmethod
    def get_doctor_by_id(doctor_id: int) -> Doctor:
        """
        Get single doctor by ID.

        Args:
            doctor_id: Doctor primary key

        Returns:
            Doctor object

        Raises:
            ValueError: If doctor not found
        """
        doctor = Doctor.query.filter_by(
            id=doctor_id,
            is_active=True
        ).first()

        if not doctor:
            raise ValueError(f"Doctor {doctor_id} not found")

        return doctor

    @staticmethod
    def create_doctor(
        email: str,
        password: str,
        full_name: str,
        department_id: int,
        specialization: str,
        phone: str,
        license_number: Optional[str] = None,
    ) -> Doctor:
        """
        Create a doctor — simultaneously creates a user account.

        Args:
            email: Login username
            password: Plain text password
            full_name: Display name
            department_id: Department primary key
            specialization: e.g. Interventional Cardiology
            phone: Contact phone
            license_number: Optional medical license

        Returns:
            Created Doctor object

        Raises:
            ValueError: If email exists or department not found
        """
        # Verify department exists
        department = Department.query.filter_by(
            id=department_id,
            is_active=True
        ).first()
        if not department:
            raise ValueError(f"Department {department_id} not found")

        # Check email not taken
        existing = User.query.filter_by(email=email).first()
        if existing:
            raise ValueError(f"User with email '{email}' already exists")

        # Create user account first
        user = User(
            email=email,
            full_name=full_name,
            role='doctor',
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()  # Get user.id before creating doctor

        # Create doctor profile linked to user
        doctor = Doctor(
            user_id=user.id,
            department_id=department_id,
            specialization=specialization,
            phone=phone,
            license_number=license_number,
        )
        db.session.add(doctor)
        db.session.commit()
        return doctor

    @staticmethod
    def update_doctor(doctor_id: int, data: dict) -> Doctor:
        """
        Update doctor profile.

        Args:
            doctor_id: Doctor primary key
            data: Fields to update

        Returns:
            Updated Doctor object

        Raises:
            ValueError: If doctor not found or department not found
        """
        doctor = DoctorService.get_doctor_by_id(doctor_id)

        # If department is changing, verify new department exists
        if 'department_id' in data:
            department = Department.query.filter_by(
                id=data['department_id'],
                is_active=True
            ).first()
            if not department:
                raise ValueError(f"Department {data['department_id']} not found")

        for key, value in data.items():
            setattr(doctor, key, value)

        db.session.commit()
        return doctor

    @staticmethod
    def get_doctor_schedule(doctor_id: int, date: str) -> list:
        """
        Get all appointments for a doctor on a given date.

        Args:
            doctor_id: Doctor primary key
            date: Date string in YYYY-MM-DD format

        Returns:
            List of appointment dicts ordered by time

        Raises:
            ValueError: If doctor not found
        """
        from app.models.appointment import Appointment
        from datetime import datetime

        doctor = DoctorService.get_doctor_by_id(doctor_id)

        try:
            query_date = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError("Invalid date format. Use YYYY-MM-DD")

        appointments = Appointment.query.filter_by(
            doctor_id=doctor_id,
            appointment_date=query_date,
        ).order_by(Appointment.appointment_time).all()

        return [a.to_dict() for a in appointments]

    @staticmethod
    def get_available_slots(doctor_id: int, date: str) -> list:
        """
        Get open 30-minute appointment slots for a doctor on a given date.
        Clinic hours: 9 AM to 5 PM. Excludes booked and cancelled slots.

        Args:
            doctor_id: Doctor primary key
            date: Date string in YYYY-MM-DD format

        Returns:
            List of available time strings in HH:MM format

        Raises:
            ValueError: If doctor not found or invalid date
        """
        from app.models.appointment import Appointment
        from datetime import datetime, time

        DoctorService.get_doctor_by_id(doctor_id)

        try:
            query_date = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError("Invalid date format. Use YYYY-MM-DD")

        # Generate all 30-min slots from 9 AM to 5 PM
        all_slots = []
        hour = 9
        minute = 0
        while hour < 17:
            all_slots.append(time(hour, minute))
            minute += 30
            if minute >= 60:
                minute = 0
                hour += 1

        # Get booked slots — exclude cancelled appointments
        booked = Appointment.query.filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == query_date,
            Appointment.status.notin_(['cancelled', 'no_show'])
        ).all()

        booked_times = {a.appointment_time for a in booked}

        # Return available slots as HH:MM strings
        available = [
            slot.strftime('%H:%M')
            for slot in all_slots
            if slot not in booked_times
        ]

        return available