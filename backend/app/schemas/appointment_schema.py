from marshmallow import Schema, fields, validate, validates, ValidationError
from datetime import date


class AppointmentSchema(Schema):
    """Validates appointment create requests."""

    patient_id = fields.Int(required=True)
    doctor_id = fields.Int(required=True)
    department_id = fields.Int(required=True)
    appointment_date = fields.Date(required=True)
    appointment_time = fields.Time(required=True)
    notes = fields.Str(required=False, load_default=None)

    @validates('appointment_date')
    def validate_date(self, value: date) -> None:
        """Appointment date cannot be in the past."""
        if value < date.today():
            raise ValidationError("Appointment date cannot be in the past")


class AppointmentUpdateSchema(Schema):
    """Validates appointment reschedule requests."""

    appointment_date = fields.Date(required=False)
    appointment_time = fields.Time(required=False)
    notes = fields.Str(required=False)
    doctor_id = fields.Int(required=False)
    department_id = fields.Int(required=False)

    @validates('appointment_date')
    def validate_date(self, value: date) -> None:
        """Rescheduled date cannot be in the past."""
        if value < date.today():
            raise ValidationError("Appointment date cannot be in the past")


class AppointmentStatusSchema(Schema):
    """Validates status update requests."""

    status = fields.Str(
        required=True,
        validate=validate.OneOf([
            'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'
        ])
    )