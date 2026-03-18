from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app.services.appointment_service import AppointmentService
from app.schemas.appointment_schema import (
    AppointmentSchema, AppointmentUpdateSchema, AppointmentStatusSchema
)
from app.models.user import User
from app.utils.decorators import role_required
from app.utils.helpers import error_response, success_response

appointments_bp = Blueprint('appointments', __name__)


@appointments_bp.route('', methods=['GET'])
@jwt_required()
def get_appointments():
    """
    Get filtered list of appointments.
    GET /api/v1/appointments?date=&doctor_id=&status=&patient_id=
    All roles.
    """
    try:
        appointments = AppointmentService.get_appointments(
            appointment_date=request.args.get('date'),
            doctor_id=request.args.get('doctor_id', type=int),
            patient_id=request.args.get('patient_id', type=int),
            status=request.args.get('status'),
        )
        return success_response({'appointments': appointments}, 200)
    except ValueError as e:
        return error_response(str(e), 400)


# IMPORTANT: 'today' must be defined BEFORE /<int:appointment_id>
# Same route ordering rule as check-phone in patients
@appointments_bp.route('/today', methods=['GET'])
@jwt_required()
def get_today_appointments():
    """
    Get all appointments for today.
    GET /api/v1/appointments/today
    All roles.
    """
    appointments = AppointmentService.get_today_appointments()
    return success_response({'appointments': appointments}, 200)


@appointments_bp.route('/<int:appointment_id>', methods=['GET'])
@jwt_required()
def get_appointment(appointment_id: int):
    """
    Get single appointment detail.
    GET /api/v1/appointments/:id
    All roles.
    """
    try:
        appointment = AppointmentService.get_appointment_by_id(appointment_id)
        return success_response({'appointment': appointment.to_dict()}, 200)
    except ValueError as e:
        return error_response(str(e), 404)


@appointments_bp.route('', methods=['POST'])
@jwt_required()
@role_required(['front_desk', 'admin'])
def book_appointment():
    """
    Book a new appointment.
    POST /api/v1/appointments
    front_desk, admin only.
    """
    data = request.get_json()

    if not data:
        return error_response("Request body is required", 400)

    try:
        validated = AppointmentSchema().load(data)
    except ValidationError as e:
        return error_response(str(e.messages), 400)

    try:
        appointment = AppointmentService.book_appointment(**validated)
        return success_response({'appointment': appointment.to_dict()}, 201)
    except ValueError as e:
        return error_response(str(e), 409)


@appointments_bp.route('/<int:appointment_id>', methods=['PUT'])
@jwt_required()
@role_required(['front_desk', 'admin'])
def update_appointment(appointment_id: int):
    """
    Reschedule an appointment.
    PUT /api/v1/appointments/:id
    front_desk, admin only.
    """
    data = request.get_json()

    if not data:
        return error_response("Request body is required", 400)

    try:
        validated = AppointmentUpdateSchema().load(data)
    except ValidationError as e:
        return error_response(str(e.messages), 400)

    try:
        appointment = AppointmentService.update_appointment(
            appointment_id, validated
        )
        return success_response({'appointment': appointment.to_dict()}, 200)
    except ValueError as e:
        return error_response(str(e), 400)


@appointments_bp.route('/<int:appointment_id>/status', methods=['PATCH'])
@jwt_required()
def update_appointment_status(appointment_id: int):
    """
    Update appointment status with role validation.
    PATCH /api/v1/appointments/:id/status
    All roles — but transitions are role-restricted.
    """
    data = request.get_json()

    if not data:
        return error_response("Request body is required", 400)

    try:
        validated = AppointmentStatusSchema().load(data)
    except ValidationError as e:
        return error_response(str(e.messages), 400)

    # Get current user's role for transition validation
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    try:
        appointment = AppointmentService.update_status(
            appointment_id=appointment_id,
            new_status=validated['status'],
            user_role=user.role,
        )
        return success_response({'appointment': appointment.to_dict()}, 200)
    except ValueError as e:
        return error_response(str(e), 400)


@appointments_bp.route('/<int:appointment_id>', methods=['DELETE'])
@jwt_required()
@role_required(['front_desk', 'admin'])
def cancel_appointment(appointment_id: int):
    """
    Cancel an appointment.
    DELETE /api/v1/appointments/:id
    front_desk, admin only.
    """
    try:
        AppointmentService.cancel_appointment(appointment_id)
        return success_response(
            {'message': 'Appointment cancelled successfully'}, 200
        )
    except ValueError as e:
        return error_response(str(e), 400)