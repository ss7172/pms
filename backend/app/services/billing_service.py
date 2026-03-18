from datetime import datetime
from decimal import Decimal
from sqlalchemy import func
from app.extensions import db
from app.models.billing import BillingRecord, BillingItem


class BillingService:
    """
    Handles billing line items and payment processing.
    Total amount is always recalculated from line items — never set manually.
    """

    @staticmethod
    def get_billing_records(
        status: str = None,
        date_from: str = None,
        date_to: str = None,
    ) -> list:
        """
        Get filtered list of billing records.

        Args:
            status: Filter by payment status
            date_from: Filter from this date (YYYY-MM-DD)
            date_to: Filter to this date (YYYY-MM-DD)

        Returns:
            List of billing record dicts with line items
        """
        query = BillingRecord.query

        if status:
            query = query.filter_by(status=status)
        if date_from:
            try:
                date_from_obj = datetime.strptime(date_from, '%Y-%m-%d')
                query = query.filter(BillingRecord.created_at >= date_from_obj)
            except ValueError:
                raise ValueError("Invalid date_from format. Use YYYY-MM-DD")
        if date_to:
            try:
                date_to_obj = datetime.strptime(date_to, '%Y-%m-%d')
                query = query.filter(BillingRecord.created_at <= date_to_obj)
            except ValueError:
                raise ValueError("Invalid date_to format. Use YYYY-MM-DD")

        records = query.order_by(BillingRecord.created_at.desc()).all()
        return [r.to_dict() for r in records]

    @staticmethod
    def get_billing_record_by_id(billing_id: int) -> BillingRecord:
        """
        Get single billing record with all line items.

        Args:
            billing_id: BillingRecord primary key

        Returns:
            BillingRecord object

        Raises:
            ValueError: If record not found
        """
        record = BillingRecord.query.get(billing_id)
        if not record:
            raise ValueError(f"Billing record {billing_id} not found")
        return record

    @staticmethod
    def recalculate_total(billing_record_id: int) -> None:
        """
        Recalculate and update total_amount from all line items.
        Called after every add/update/delete of a line item.

        Args:
            billing_record_id: BillingRecord primary key
        """
        total = db.session.query(
            func.sum(BillingItem.amount)
        ).filter(
            BillingItem.billing_record_id == billing_record_id
        ).scalar()

        record = BillingRecord.query.get(billing_record_id)
        record.total_amount = total or Decimal('0.00')
        db.session.commit()

    @staticmethod
    def add_line_item(
        billing_id: int,
        description: str,
        category: str,
        amount: Decimal,
    ) -> BillingRecord:
        """
        Add a line item to an invoice and recalculate total.

        Args:
            billing_id: BillingRecord primary key
            description: Item description e.g. 'ECG', 'CBC'
            category: One of test/procedure/other
            amount: Charge in INR

        Returns:
            Updated BillingRecord with all items

        Raises:
            ValueError: If record not found or already paid
        """
        record = BillingService.get_billing_record_by_id(billing_id)

        if record.status not in ['pending', 'partially_paid']:
            raise ValueError(
                f"Cannot add items to a billing record with status '{record.status}'"
            )

        item = BillingItem(
            billing_record_id=billing_id,
            description=description,
            category=category,
            amount=Decimal(str(amount)),
        )
        db.session.add(item)
        db.session.flush()

        BillingService.recalculate_total(billing_id)
        return BillingService.get_billing_record_by_id(billing_id)

    @staticmethod
    def update_line_item(
        billing_id: int,
        item_id: int,
        data: dict,
    ) -> BillingRecord:
        """
        Update a line item and recalculate total.

        Args:
            billing_id: BillingRecord primary key
            item_id: BillingItem primary key
            data: Fields to update

        Returns:
            Updated BillingRecord with all items

        Raises:
            ValueError: If item not found or belongs to different record
        """
        item = BillingItem.query.filter_by(
            id=item_id,
            billing_record_id=billing_id,
        ).first()

        if not item:
            raise ValueError(
                f"Line item {item_id} not found on billing record {billing_id}"
            )

        for key, value in data.items():
            if key == 'amount':
                value = Decimal(str(value))
            setattr(item, key, value)

        db.session.flush()
        BillingService.recalculate_total(billing_id)
        return BillingService.get_billing_record_by_id(billing_id)

    @staticmethod
    def remove_line_item(billing_id: int, item_id: int) -> BillingRecord:
        """
        Remove a line item and recalculate total.
        Cannot remove consultation fee item.

        Args:
            billing_id: BillingRecord primary key
            item_id: BillingItem primary key

        Returns:
            Updated BillingRecord with remaining items

        Raises:
            ValueError: If item not found or is consultation fee
        """
        item = BillingItem.query.filter_by(
            id=item_id,
            billing_record_id=billing_id,
        ).first()

        if not item:
            raise ValueError(
                f"Line item {item_id} not found on billing record {billing_id}"
            )

        if item.category == 'consultation':
            raise ValueError(
                "Cannot remove consultation fee — it is auto-generated and required"
            )

        db.session.delete(item)
        db.session.flush()
        BillingService.recalculate_total(billing_id)
        return BillingService.get_billing_record_by_id(billing_id)

    @staticmethod
    def process_payment(
        billing_id: int,
        payment_method: str,
        notes: str = None,
    ) -> BillingRecord:
        """
        Mark a billing record as paid.

        Args:
            billing_id: BillingRecord primary key
            payment_method: One of cash/card/upi/insurance
            notes: Optional payment notes

        Returns:
            Updated BillingRecord

        Raises:
            ValueError: If record not found or already paid/waived
        """
        record = BillingService.get_billing_record_by_id(billing_id)

        if record.status in ['paid', 'waived']:
            raise ValueError(
                f"Billing record is already '{record.status}'"
            )

        record.status = 'paid'
        record.payment_method = payment_method
        record.payment_date = datetime.utcnow()
        if notes:
            record.notes = notes

        db.session.commit()
        return record