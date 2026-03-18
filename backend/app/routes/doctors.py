from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app.services.doctor_service import DoctorService
from app.utils.decorators import role_required
from app.utils.helpers import error_response, success_response

doctors_bp = Blueprint('doctors', __name__)


@doctors_bp.route('', methods=['GET'])
@jwt_required()
def get_doctors():
    """
    Get all active doctors, optionally filtered by department.
    GET /api/v1/doctors?department_id=
    All roles.
    """
    department_id = request.args.get('department_id', type=int)
    doctors = DoctorService.get_doctors(department_id)
    return success_response({'doctors': doctors}, 200)


@doctors_bp.route('/<int:doctor_id>', methods=['GET'])
@jwt_required()
def get_doctor(doctor_id: int):
    """
    Get single doctor profile.
    GET /api/v1/doctors/:id
    All roles.
    """
    try:
        doctor = DoctorService.get_doctor_by_id(doctor_id)
        return success_response({'doctor': doctor.to_dict()}, 200)
    except ValueError as e:
        return error_response(str(e), 404)


@doctors_bp.route('', methods=['POST'])
@jwt_required()
@role_required(['admin'])
def create_doctor():
    """
    Create a doctor and their user account simultaneously.
    POST /api/v1/doctors
    admin only.
    """
    data = request.get_json()

    if not data:
        return error_response("Request body is required", 400)

    required_fields = ['email', 'password', 'full_name',
                       'department_id', 'specialization', 'phone']
    missing = [f for f in required_fields if not data.get(f)]
    if missing:
        return error_response(f"Missing required fields: {missing}", 400)

    try:
        doctor = DoctorService.create_doctor(
            email=data['email'].strip(),
            password=data['password'],
            full_name=data['full_name'].strip(),
            department_id=int(data['department_id']),
            specialization=data['specialization'].strip(),
            phone=data['phone'].strip(),
            license_number=data.get('license_number'),
        )
        return success_response({'doctor': doctor.to_dict()}, 201)
    except ValueError as e:
        return error_response(str(e), 409)


@doctors_bp.route('/<int:doctor_id>', methods=['PUT'])
@jwt_required()
@role_required(['admin'])
def update_doctor(doctor_id: int):
    """
    Update doctor profile.
    PUT /api/v1/doctors/:id
    admin only.
    """
    data = request.get_json()

    if not data:
        return error_response("Request body is required", 400)

    allowed_fields = ['department_id', 'specialization', 'phone', 'license_number']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return error_response("No valid fields to update", 400)

    try:
        doctor = DoctorService.update_doctor(doctor_id, update_data)
        return success_response({'doctor': doctor.to_dict()}, 200)
    except ValueError as e:
        return error_response(str(e), 404)


@doctors_bp.route('/<int:doctor_id>/schedule', methods=['GET'])
@jwt_required()
def get_doctor_schedule(doctor_id: int):
    """
    Get doctor's appointments for a specific date.
    GET /api/v1/doctors/:id/schedule?date=YYYY-MM-DD
    All roles.
    """
    date = request.args.get('date', '')
    if not date:
        return error_response("date parameter is required (YYYY-MM-DD)", 400)

    try:
        schedule = DoctorService.get_doctor_schedule(doctor_id, date)
        return success_response({'schedule': schedule, 'date': date}, 200)
    except ValueError as e:
        return error_response(str(e), 400)


@doctors_bp.route('/<int:doctor_id>/available-slots', methods=['GET'])
@jwt_required()
def get_available_slots(doctor_id: int):
    """
    Get open 30-minute slots for a doctor on a given date.
    GET /api/v1/doctors/:id/available-slots?date=YYYY-MM-DD
    All roles.
    """
    date = request.args.get('date', '')
    if not date:
        return error_response("date parameter is required (YYYY-MM-DD)", 400)

    try:
        slots = DoctorService.get_available_slots(doctor_id, date)
        return success_response({'available_slots': slots, 'date': date}, 200)
    except ValueError as e:
        return error_response(str(e), 400)