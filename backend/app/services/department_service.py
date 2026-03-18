from typing import Optional
from app.extensions import db
from app.models.department import Department


class DepartmentService:
    """Handles all department business logic."""

    @staticmethod
    def get_all_departments() -> list:
        """
        Get all active departments with consultation fees.

        Returns:
            List of department dicts
        """
        departments = Department.query.filter_by(
            is_active=True
        ).order_by(Department.name).all()
        return [d.to_dict() for d in departments]

    @staticmethod
    def create_department(name: str, consultation_fee: float,
                         description: Optional[str] = None) -> Department:
        """
        Create a new department.

        Args:
            name: Department name — must be unique
            consultation_fee: Base fee in INR
            description: Optional description

        Returns:
            Created Department object

        Raises:
            ValueError: If department name already exists
        """
        existing = Department.query.filter_by(name=name).first()
        if existing:
            raise ValueError(f"Department '{name}' already exists")

        department = Department(
            name=name,
            consultation_fee=consultation_fee,
            description=description,
        )
        db.session.add(department)
        db.session.commit()
        return department

    @staticmethod
    def update_department(department_id: int, data: dict) -> Department:
        """
        Update department name, fee, or description.

        Args:
            department_id: Department primary key
            data: Fields to update

        Returns:
            Updated Department object

        Raises:
            ValueError: If department not found or name conflict
        """
        department = Department.query.filter_by(
            id=department_id,
            is_active=True
        ).first()

        if not department:
            raise ValueError(f"Department {department_id} not found")

        # If name is changing, check it isn't taken
        if 'name' in data and data['name'] != department.name:
            existing = Department.query.filter_by(name=data['name']).first()
            if existing:
                raise ValueError(f"Department '{data['name']}' already exists")

        for key, value in data.items():
            setattr(department, key, value)

        db.session.commit()
        return department

    @staticmethod
    def delete_department(department_id: int) -> None:
        """
        Soft delete a department.

        Args:
            department_id: Department primary key

        Raises:
            ValueError: If department not found
        """
        department = Department.query.filter_by(
            id=department_id,
            is_active=True
        ).first()

        if not department:
            raise ValueError(f"Department {department_id} not found")

        department.is_active = False
        db.session.commit()