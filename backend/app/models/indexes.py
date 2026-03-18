from app.extensions import db

def create_indexes() -> None:
    """
    Additional performance indexes beyond PKs, FKs, and unique constraints.
    Called from a dedicated migration.
    """
    pass