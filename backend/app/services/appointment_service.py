from datetime import date, datetime
from typing import Optional
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.department import Department


class AppointmentService:
    """Handles appointment booking, conflict detection, and status transitions."""

    @staticmethod
    def get_appointments(
        appointment_date: Optional[str] = None,
        doctor_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> list:
        """
        Get filtered list of appointments.

        Args:
            appointment_date: Filter by date (YYYY-MM-DD)
            doctor_id: Filter by doctor
            patient_id: Filter by patient
            status: Filter by status

        Returns:
            List of appointment dicts ordered by date and time
        """
        query = Appointment.query

        if appointment_date:
            try:
                query_date = datetime.strptime(
                    appointment_date, '%Y-%m-%d'
                ).date()
                query = query.filter_by(appointment_date=query_date)
            except ValueError:
                raise ValueError("Invalid date format. Use YYYY-MM-DD")

        if doctor_id:
            query = query.filter_by(doctor_id=doctor_id)
        if patient_id:
            query = query.filter_by(patient_id=patient_id)
        if status:
            query = query.filter_by(status=status)

        appointments = query.order_by(
            Appointment.appointment_date,
            Appointment.appointment_time
        ).all()

        return [a.to_dict() for a in appointments]

    @staticmethod
    def get_today_appointments() -> list:
        """
        Get all appointments for today ordered by time.

        Returns:
            List of today's appointment dicts
        """
        appointments = Appointment.query.filter_by(
            appointment_date=date.today()
        ).order_by(Appointment.appointment_time).all()

        return [a.to_dict() for a in appointments]

    @staticmethod
    def get_appointment_by_id(appointment_id: int) -> Appointment:
        """
        Get single appointment by ID.

        Args:
            appointment_id: Appointment primary key

        Returns:
            Appointment object

        Raises:
            ValueError: If appointment not found
        """
        appointment = Appointment.query.get(appointment_id)
        if not appointment:
            raise ValueError(f"Appointment {appointment_id} not found")
        return appointment

    @staticmethod
    def book_appointment(
        patient_id: int,
        doctor_id: int,
        department_id: int,
        appointment_date: date,
        appointment_time: object,
        notes: Optional[str] = None,
    ) -> Appointment:
        """
        Book a new appointment with conflict detection.

        Args:
            patient_id: Patient primary key
            doctor_id: Doctor primary key
            department_id: Department primary key
            appointment_date: Date of appointment
            appointment_time: Time of appointment
            notes: Optional notes

        Returns:
            Created Appointment object

        Raises:
            ValueError: If patient/doctor/department not found or slot taken
        """
        # Validate all referenced records exist
        patient = Patient.query.filter_by(
            id=patient_id, is_active=True
        ).first()
        if not patient:
            raise ValueError(f"Patient {patient_id} not found")

        doctor = Doctor.query.filter_by(
            id=doctor_id, is_active=True
        ).first()
        if not doctor:
            raise ValueError(f"Doctor {doctor_id} not found")

        department = Department.query.filter_by(
            id=department_id, is_active=True
        ).first()
        if not department:
            raise ValueError(f"Department {department_id} not found")

        # Verify doctor belongs to department
        if doctor.department_id != department_id:
            raise ValueError(
                f"Doctor {doctor_id} does not belong to department {department_id}"
            )

        # Check for scheduling conflict
        conflict = Appointment.query.filter_by(
            doctor_id=doctor_id,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
        ).filter(
            Appointment.status.notin_(['cancelled', 'no_show'])
        ).first()

        if conflict:
            raise ValueError(
                f"Dr. {doctor.user.full_name} already has an appointment "
                f"at {appointment_time.strftime('%H:%M')} "
                f"on {appointment_date.strftime('%d %b %Y')}"
            )

        appointment = Appointment(
            patient_id=patient_id,
            doctor_id=doctor_id,
            department_id=department_id,
            appointment_date=appointment_date,
            appointment_time=appointment_time,
            notes=notes,
            status='scheduled',
        )

        try:
            db.session.add(appointment)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError(
                "This time slot is already booked — please choose another"
            )

        return appointment

    @staticmethod
    def update_appointment(appointment_id: int, data: dict) -> Appointment:
        """
        Reschedule an appointment.

        Args:
            appointment_id: Appointment primary key
            data: Fields to update

        Returns:
            Updated Appointment object

        Raises:
            ValueError: If appointment not found or new slot conflicts
        """
        appointment = AppointmentService.get_appointment_by_id(appointment_id)

        if appointment.status not in ['scheduled']:
            raise ValueError(
                "Only scheduled appointments can be rescheduled"
            )

        for key, value in data.items():
            setattr(appointment, key, value)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise ValueError(
                "This time slot is already booked — please choose another"
            )

        return appointment

    @staticmethod
    def update_status(
        appointment_id: int,
        new_status: str,
        user_role: str,
    ) -> Appointment:
        """
        Update appointment status with role-based transition validation.

        Args:
            appointment_id: Appointment primary key
            new_status: Target status
            user_role: Role of user making the change

        Returns:
            Updated Appointment object

        Raises:
            ValueError: If transition invalid or role not permitted
        """
        appointment = AppointmentService.get_appointment_by_id(appointment_id)

        # Validate transition is allowed
        if not appointment.is_valid_transition(new_status):
            raise ValueError(
                f"Cannot transition from '{appointment.status}' to '{new_status}'"
            )

        # Role-based transition rules from spec
        doctor_only = {
            ('scheduled', 'in_progress'),
            ('in_progress', 'completed'),
        }
        front_desk_admin = {
            ('scheduled', 'cancelled'),
            ('scheduled', 'no_show'),
        }

        transition = (appointment.status, new_status)

        if transition in doctor_only and user_role not in ['doctor']:
            raise ValueError(
                f"Only doctors can transition to '{new_status}'"
            )

        if transition in front_desk_admin and user_role not in ['front_desk', 'admin']:
            raise ValueError(
                f"Only front desk or admin can transition to '{new_status}'"
            )

        appointment.status = new_status
        db.session.commit()
        return appointment

    @staticmethod
    def cancel_appointment(appointment_id: int) -> None:
        """
        Cancel an appointment — only if scheduled.

        Args:
            appointment_id: Appointment primary key

        Raises:
            ValueError: If appointment not found or not cancellable
        """
        appointment = AppointmentService.get_appointment_by_id(appointment_id)

        if appointment.status != 'scheduled':
            raise ValueError(
                f"Cannot cancel appointment with status '{appointment.status}'"
            )

        appointment.status = 'cancelled'
        db.session.commit()