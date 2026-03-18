from marshmallow import Schema, fields, validate


class BillingItemSchema(Schema):
    """Validates billing line item create/update requests."""

    description = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    category = fields.Str(
        required=True,
        validate=validate.OneOf(['consultation', 'test', 'procedure', 'other'])
    )
    amount = fields.Decimal(required=True, places=2)


class BillingItemUpdateSchema(Schema):
    """Validates billing line item update — all fields optional."""

    description = fields.Str(required=False, validate=validate.Length(min=1, max=255))
    category = fields.Str(
        required=False,
        validate=validate.OneOf(['consultation', 'test', 'procedure', 'other'])
    )
    amount = fields.Decimal(required=False, places=2)


class BillingPaymentSchema(Schema):
    """Validates payment request."""

    payment_method = fields.Str(
        required=True,
        validate=validate.OneOf(['cash', 'card', 'upi', 'insurance'])
    )
    notes = fields.Str(required=False, load_default=None)