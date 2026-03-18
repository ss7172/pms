from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app.services.department_service import DepartmentService
from app.utils.decorators import role_required
from app.utils.helpers import error_response, success_response

departments_bp = Blueprint('departments', __name__)


@departments_bp.route('', methods=['GET'])
@jwt_required()
def get_departments():
    """
    Get all active departments with consultation fees.
    GET /api/v1/departments
    All roles.
    """
    departments = DepartmentService.get_all_departments()
    return success_response({'departments': departments}, 200)


@departments_bp.route('', methods=['POST'])
@jwt_required()
@role_required(['admin'])
def create_department():
    """
    Create a new department.
    POST /api/v1/departments
    admin only.
    """
    data = request.get_json()

    if not data:
        return error_response("Request body is required", 400)

    name = data.get('name', '').strip()
    consultation_fee = data.get('consultation_fee')

    if not name:
        return error_response("name is required", 400)
    if consultation_fee is None:
        return error_response("consultation_fee is required", 400)

    try:
        consultation_fee = float(consultation_fee)
        if consultation_fee <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return error_response("consultation_fee must be a positive number", 400)

    try:
        department = DepartmentService.create_department(
            name=name,
            consultation_fee=consultation_fee,
            description=data.get('description'),
        )
        return success_response({'department': department.to_dict()}, 201)
    except ValueError as e:
        return error_response(str(e), 409)


@departments_bp.route('/<int:department_id>', methods=['PUT'])
@jwt_required()
@role_required(['admin'])
def update_department(department_id: int):
    """
    Update department.
    PUT /api/v1/departments/:id
    admin only.
    """
    data = request.get_json()

    if not data:
        return error_response("Request body is required", 400)

    # Only allow these fields to be updated
    allowed_fields = ['name', 'description', 'consultation_fee']
    update_data = {k: v for k, v in data.items() if k in allowed_fields}

    if not update_data:
        return error_response("No valid fields to update", 400)

    try:
        department = DepartmentService.update_department(department_id, update_data)
        return success_response({'department': department.to_dict()}, 200)
    except ValueError as e:
        return error_response(str(e), 404)


@departments_bp.route('/<int:department_id>', methods=['DELETE'])
@jwt_required()
@role_required(['admin'])
def delete_department(department_id: int):
    """
    Soft delete a department.
    DELETE /api/v1/departments/:id
    admin only.
    """
    try:
        DepartmentService.delete_department(department_id)
        return success_response({'message': 'Department deactivated successfully'}, 200)
    except ValueError as e:
        return error_response(str(e), 404)