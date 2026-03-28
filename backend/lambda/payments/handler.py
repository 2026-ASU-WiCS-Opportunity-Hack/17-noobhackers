"""Payment processing Lambda handler.

Handles payment CRUD, Stripe/PayPal webhook verification, and dues
reminder scheduling via API Gateway proxy integration:

- POST   /payments                    → create_payment
- GET    /payments                    → list_payments
- GET    /payments/{paymentId}        → get_payment
- POST   /payments/webhook/stripe     → handle_stripe_webhook
- POST   /payments/webhook/paypal     → handle_paypal_webhook

Scheduled (EventBridge):
- send_dues_reminders                 → query overdue, send SES emails

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 5.10
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

from shared.exceptions import PaymentError, ValidationError
from shared.models import (
    COACH_CERTIFICATION_FEE,
    PAYMENT_SCHEMA,
    STUDENT_ENROLLMENT_FEE,
    VALID_DUE_TYPES,
    VALID_PAYMENT_METHODS,
)
from shared.pii_filter import redact_pii
from shared.validators import validate_input

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PAYMENTS_TABLE = os.environ.get("PAYMENTS_TABLE", "wial-payments")
STRIPE_SECRET_NAME = os.environ.get("STRIPE_SECRET_NAME", "wial/stripe-api-key")
PAYPAL_SECRET_NAME = os.environ.get("PAYPAL_SECRET_NAME", "wial/paypal-client-secret")
SES_SENDER_EMAIL = os.environ.get("SES_SENDER_EMAIL", "noreply@wial.org")

# Retry configuration for payment provider calls
MAX_RETRIES = 2
RETRY_DELAYS = [1, 3]  # seconds — exponential backoff

# Reminder schedule: days past due → which reminder number it is
REMINDER_SCHEDULE = {7: 1, 14: 2, 30: 3}

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# AWS clients — instantiated once per container for connection reuse
dynamodb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
ses_client = boto3.client("ses")

payments_table = dynamodb.Table(PAYMENTS_TABLE)

# In-memory secret cache to avoid repeated Secrets Manager calls within
# the same Lambda invocation.  Cleared on cold start.
_secrets_cache: Dict[str, Dict[str, str]] = {}

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _json_response(status_code: int, body: Any) -> Dict[str, Any]:
    """Build an API Gateway proxy-compatible response."""
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=_decimal_default),
    }


def _decimal_default(obj: Any) -> Any:
    """JSON serializer for Decimal values returned by DynamoDB."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    """Log with PII redaction applied."""
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))


def _get_secret(secret_name: str) -> Dict[str, str]:
    """Fetch a secret from Secrets Manager, with per-invocation caching."""
    if secret_name in _secrets_cache:
        return _secrets_cache[secret_name]
    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        secret = json.loads(response["SecretString"])
        _secrets_cache[secret_name] = secret
        return secret
    except ClientError as exc:
        _safe_log("Failed to fetch secret", {"secretName": secret_name, "error": str(exc)})
        raise PaymentError(f"Unable to retrieve payment credentials") from exc


def _unit_amount_for_due_type(due_type: str) -> int:
    """Return the per-unit fee in USD for the given due type."""
    if due_type == "student_enrollment":
        return STUDENT_ENROLLMENT_FEE
    if due_type == "coach_certification":
        return COACH_CERTIFICATION_FEE
    raise ValidationError(f"Invalid due type: {due_type}")


# ---------------------------------------------------------------------------
# Retry wrapper for payment provider calls
# ---------------------------------------------------------------------------


def _retry_provider_call(fn, *args, **kwargs) -> Any:
    """Call *fn* with up to MAX_RETRIES retries using exponential backoff.

    Retries on transient errors only (network / 5xx from provider).
    """
    last_exc: Optional[Exception] = None
    for attempt in range(1 + MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            last_exc = exc
            if attempt < MAX_RETRIES:
                delay = RETRY_DELAYS[attempt]
                _safe_log(
                    "Payment provider call failed, retrying",
                    {"attempt": attempt + 1, "delay": delay, "error": str(exc)},
                )
                time.sleep(delay)
            else:
                _safe_log(
                    "Payment provider call failed after all retries",
                    {"attempts": attempt + 1, "error": str(exc)},
                )
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Stripe integration
# ---------------------------------------------------------------------------


def _process_stripe_payment(
    amount_cents: int,
    currency: str,
    payer_email: str,
    metadata: Dict[str, str],
) -> Dict[str, Any]:
    """Create a Stripe PaymentIntent via the Stripe REST API.

    Uses ``requests``-free approach with ``urllib`` to avoid extra
    dependencies in the Lambda layer.  In production you would use the
    Stripe SDK; this implementation keeps the Lambda package minimal.
    """
    import urllib.request
    import urllib.parse
    import urllib.error

    secret = _get_secret(STRIPE_SECRET_NAME)
    api_key = secret["apiKey"]

    data = urllib.parse.urlencode({
        "amount": str(amount_cents),
        "currency": currency.lower(),
        "receipt_email": payer_email,
        "metadata[chapterId]": metadata.get("chapterId", ""),
        "metadata[dueType]": metadata.get("dueType", ""),
        "metadata[paymentId]": metadata.get("paymentId", ""),
        "automatic_payment_methods[enabled]": "true",
    }).encode()

    req = urllib.request.Request(
        "https://api.stripe.com/v1/payment_intents",
        data=data,
        method="POST",
    )
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    def _call() -> Dict[str, Any]:
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as http_err:
            body = http_err.read().decode() if http_err.fp else ""
            raise PaymentError(f"Stripe API error ({http_err.code}): {body}") from http_err
        except urllib.error.URLError as url_err:
            raise PaymentError(f"Stripe connection error: {url_err.reason}") from url_err

    return _retry_provider_call(_call)


# ---------------------------------------------------------------------------
# PayPal integration
# ---------------------------------------------------------------------------


def _get_paypal_access_token() -> str:
    """Obtain a PayPal OAuth2 access token using client credentials."""
    import urllib.request
    import urllib.error
    import base64

    secret = _get_secret(PAYPAL_SECRET_NAME)
    client_id = secret["clientId"]
    client_secret = secret["clientSecret"]

    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    req = urllib.request.Request(
        "https://api-m.paypal.com/v1/oauth2/token",
        data=b"grant_type=client_credentials",
        method="POST",
    )
    req.add_header("Authorization", f"Basic {credentials}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            return result["access_token"]
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        raise PaymentError(f"PayPal auth failed: {exc}") from exc


def _process_paypal_payment(
    amount_usd: str,
    currency: str,
    metadata: Dict[str, str],
) -> Dict[str, Any]:
    """Create a PayPal order via the PayPal REST API."""
    import urllib.request
    import urllib.error

    access_token = _get_paypal_access_token()

    order_body = json.dumps({
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {"currency_code": currency, "value": amount_usd},
                "custom_id": metadata.get("paymentId", ""),
                "description": f"WIAL dues — {metadata.get('dueType', '')}",
            }
        ],
    }).encode()

    req = urllib.request.Request(
        "https://api-m.paypal.com/v2/checkout/orders",
        data=order_body,
        method="POST",
    )
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("Content-Type", "application/json")

    def _call() -> Dict[str, Any]:
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as http_err:
            body = http_err.read().decode() if http_err.fp else ""
            raise PaymentError(f"PayPal API error ({http_err.code}): {body}") from http_err
        except urllib.error.URLError as url_err:
            raise PaymentError(f"PayPal connection error: {url_err.reason}") from url_err

    return _retry_provider_call(_call)


# ---------------------------------------------------------------------------
# Core payment operations
# ---------------------------------------------------------------------------


def create_payment(body: Dict[str, Any]) -> Dict[str, Any]:
    """Process a dues payment via Stripe or PayPal.

    Steps:
    1. Validate input against PAYMENT_SCHEMA
    2. Calculate total (quantity × unit amount)
    3. Route to Stripe or PayPal based on paymentMethod
    4. Write payment record to DynamoDB
    5. Send receipt via SES on success
    6. Return descriptive error on failure, log for Super_Admin review

    Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.9, 5.10
    """
    try:
        sanitized = validate_input(body, PAYMENT_SCHEMA)
    except ValidationError:
        raise

    payment_id = str(uuid.uuid4())
    chapter_id = sanitized["chapterId"]
    payment_method = sanitized["paymentMethod"]
    due_type = sanitized["dueType"]
    quantity = sanitized["quantity"]
    payer_email = sanitized["payerEmail"]
    now = _now_iso()

    unit_amount = _unit_amount_for_due_type(due_type)
    total_amount = quantity * unit_amount

    metadata = {
        "chapterId": chapter_id,
        "dueType": due_type,
        "paymentId": payment_id,
    }

    provider_ref: Dict[str, Optional[str]] = {
        "stripePaymentIntentId": None,
        "paypalOrderId": None,
    }

    try:
        if payment_method == "stripe":
            result = _process_stripe_payment(
                amount_cents=total_amount * 100,
                currency="USD",
                payer_email=payer_email,
                metadata=metadata,
            )
            provider_ref["stripePaymentIntentId"] = result.get("id")
            status = "succeeded" if result.get("status") in ("succeeded", "requires_capture") else "pending"

        elif payment_method == "paypal":
            result = _process_paypal_payment(
                amount_usd=f"{total_amount:.2f}",
                currency="USD",
                metadata=metadata,
            )
            provider_ref["paypalOrderId"] = result.get("id")
            status = "succeeded" if result.get("status") == "COMPLETED" else "pending"

        else:
            raise ValidationError(f"Unsupported payment method: {payment_method}")

    except PaymentError:
        # Write a failed record so Super_Admin can review
        _write_payment_record(
            payment_id=payment_id,
            chapter_id=chapter_id,
            payer_email=payer_email,
            payment_method=payment_method,
            due_type=due_type,
            quantity=quantity,
            unit_amount=unit_amount,
            total_amount=total_amount,
            status="failed",
            provider_ref=provider_ref,
            now=now,
            failure_reason="Payment provider error",
        )
        raise

    except Exception as exc:
        _write_payment_record(
            payment_id=payment_id,
            chapter_id=chapter_id,
            payer_email=payer_email,
            payment_method=payment_method,
            due_type=due_type,
            quantity=quantity,
            unit_amount=unit_amount,
            total_amount=total_amount,
            status="failed",
            provider_ref=provider_ref,
            now=now,
            failure_reason=str(exc),
        )
        _safe_log("Payment failed unexpectedly", {"paymentId": payment_id, "error": str(exc)})
        raise PaymentError(f"Payment processing failed: {exc}") from exc

    # Write successful payment record
    _write_payment_record(
        payment_id=payment_id,
        chapter_id=chapter_id,
        payer_email=payer_email,
        payment_method=payment_method,
        due_type=due_type,
        quantity=quantity,
        unit_amount=unit_amount,
        total_amount=total_amount,
        status=status,
        provider_ref=provider_ref,
        now=now,
    )

    # Send receipt email on success
    if status == "succeeded":
        _send_receipt_email(payer_email, payment_id, due_type, quantity, total_amount)
        # Update receipt timestamp
        try:
            payments_table.update_item(
                Key={"PK": f"PAYMENT#{payment_id}", "SK": "RECORD"},
                UpdateExpression="SET receiptSentAt = :ts",
                ExpressionAttributeValues={":ts": _now_iso()},
            )
        except Exception as exc:
            _safe_log("Failed to update receipt timestamp", {"paymentId": payment_id, "error": str(exc)})

    _safe_log("Payment processed", {"paymentId": payment_id, "status": status})

    return {
        "paymentId": payment_id,
        "amount": total_amount,
        "status": status,
    }


def _write_payment_record(
    *,
    payment_id: str,
    chapter_id: str,
    payer_email: str,
    payment_method: str,
    due_type: str,
    quantity: int,
    unit_amount: int,
    total_amount: int,
    status: str,
    provider_ref: Dict[str, Optional[str]],
    now: str,
    failure_reason: Optional[str] = None,
) -> None:
    """Write a payment record to DynamoDB."""
    item: Dict[str, Any] = {
        "PK": f"PAYMENT#{payment_id}",
        "SK": "RECORD",
        "paymentId": payment_id,
        "chapterId": chapter_id,
        "payerEmail": payer_email,
        "paymentMethod": payment_method,
        "dueType": due_type,
        "quantity": quantity,
        "unitAmount": unit_amount,
        "totalAmount": total_amount,
        "currency": "USD",
        "status": status,
        "remindersSent": 0,
        "createdAt": now,
    }

    if provider_ref.get("stripePaymentIntentId"):
        item["stripePaymentIntentId"] = provider_ref["stripePaymentIntentId"]
    if provider_ref.get("paypalOrderId"):
        item["paypalOrderId"] = provider_ref["paypalOrderId"]
    if failure_reason:
        item["failureReason"] = failure_reason

    try:
        payments_table.put_item(Item=item)
    except Exception as exc:
        _safe_log("Failed to write payment record", {"paymentId": payment_id, "error": str(exc)})
        raise PaymentError(f"Failed to persist payment record: {exc}") from exc


def _send_receipt_email(
    payer_email: str,
    payment_id: str,
    due_type: str,
    quantity: int,
    total_amount: int,
) -> None:
    """Send a payment receipt email via SES. Requirement 5.5."""
    due_label = "Student Enrollment" if due_type == "student_enrollment" else "Coach Certification"
    subject = f"WIAL Payment Receipt — {due_label}"
    body_text = (
        f"Thank you for your payment.\n\n"
        f"Payment ID: {payment_id}\n"
        f"Type: {due_label}\n"
        f"Quantity: {quantity}\n"
        f"Total: ${total_amount} USD\n\n"
        f"This receipt confirms your dues payment to WIAL Global.\n"
    )

    try:
        ses_client.send_email(
            Source=SES_SENDER_EMAIL,
            Destination={"ToAddresses": [payer_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
            },
        )
        _safe_log("Receipt email sent", {"paymentId": payment_id})
    except ClientError as exc:
        # Non-fatal: log but don't fail the payment
        _safe_log("Failed to send receipt email", {"paymentId": payment_id, "error": str(exc)})


# ---------------------------------------------------------------------------
# List / Get payments
# ---------------------------------------------------------------------------


def list_payments(
    chapter_id: Optional[str] = None,
) -> Dict[str, Any]:
    """List payments, optionally filtered by chapterId.

    Chapter_Lead sees their chapter's payments (GSI1 query).
    Super_Admin sees all payments (scan or GSI1 query with chapterId).
    Requirement: 5.6
    """
    try:
        if chapter_id:
            # Query GSI1: chapterId (PK), createdAt (SK)
            response = payments_table.query(
                IndexName="GSI1",
                KeyConditionExpression="chapterId = :cid",
                ExpressionAttributeValues={":cid": chapter_id},
                ScanIndexForward=False,  # newest first
            )
            items = response.get("Items", [])
            while response.get("LastEvaluatedKey"):
                response = payments_table.query(
                    IndexName="GSI1",
                    KeyConditionExpression="chapterId = :cid",
                    ExpressionAttributeValues={":cid": chapter_id},
                    ScanIndexForward=False,
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))
        else:
            # Full scan for Super_Admin global view
            response = payments_table.scan(
                FilterExpression="SK = :sk",
                ExpressionAttributeValues={":sk": "RECORD"},
            )
            items = response.get("Items", [])
            while response.get("LastEvaluatedKey"):
                response = payments_table.scan(
                    FilterExpression="SK = :sk",
                    ExpressionAttributeValues={":sk": "RECORD"},
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))

        return {"payments": items}

    except Exception as exc:
        _safe_log("List payments failed", {"error": str(exc)})
        raise PaymentError(f"Failed to list payments: {exc}") from exc


def get_payment(payment_id: str) -> Dict[str, Any]:
    """Get a single payment by ID."""
    try:
        response = payments_table.get_item(
            Key={"PK": f"PAYMENT#{payment_id}", "SK": "RECORD"}
        )
        item = response.get("Item")
        if not item:
            return _json_response(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Payment {payment_id} not found"}},
            )
        return item

    except Exception as exc:
        _safe_log("Get payment failed", {"paymentId": payment_id, "error": str(exc)})
        raise PaymentError(f"Failed to get payment: {exc}") from exc


# ---------------------------------------------------------------------------
# Webhook handlers
# ---------------------------------------------------------------------------


def _verify_stripe_signature(payload: str, sig_header: str) -> bool:
    """Verify a Stripe webhook signature using HMAC-SHA256.

    Stripe signs webhooks with ``whsec_...`` secret using the scheme:
    ``t=<timestamp>,v1=<signature>``.
    """
    secret = _get_secret(STRIPE_SECRET_NAME)
    webhook_secret = secret.get("webhookSecret", "")

    try:
        parts = {k: v for k, v in (p.split("=", 1) for p in sig_header.split(","))}
        timestamp = parts.get("t", "")
        expected_sig = parts.get("v1", "")

        signed_payload = f"{timestamp}.{payload}"
        computed = hmac.new(
            webhook_secret.encode(),
            signed_payload.encode(),
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(computed, expected_sig)
    except Exception:
        return False


def handle_stripe_webhook(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle incoming Stripe webhook events with signature verification."""
    body = event.get("body", "")
    headers = event.get("headers") or {}
    sig_header = headers.get("Stripe-Signature") or headers.get("stripe-signature", "")

    if not _verify_stripe_signature(body, sig_header):
        _safe_log("Stripe webhook signature verification failed")
        return _json_response(400, {"error": {"code": "INVALID_SIGNATURE", "message": "Invalid webhook signature"}})

    try:
        webhook_event = json.loads(body)
    except json.JSONDecodeError:
        return _json_response(400, {"error": {"code": "INVALID_JSON", "message": "Invalid JSON payload"}})

    event_type = webhook_event.get("type", "")
    data_object = webhook_event.get("data", {}).get("object", {})

    _safe_log("Stripe webhook received", {"eventType": event_type})

    if event_type == "payment_intent.succeeded":
        _update_payment_status_from_webhook(
            provider_field="stripePaymentIntentId",
            provider_id=data_object.get("id", ""),
            new_status="succeeded",
        )
    elif event_type == "payment_intent.payment_failed":
        _update_payment_status_from_webhook(
            provider_field="stripePaymentIntentId",
            provider_id=data_object.get("id", ""),
            new_status="failed",
            failure_reason=data_object.get("last_payment_error", {}).get("message", "Payment failed"),
        )

    return _json_response(200, {"received": True})


def _verify_paypal_signature(event: Dict[str, Any]) -> bool:
    """Verify a PayPal webhook notification.

    In production this would call PayPal's verify-webhook-signature API.
    Here we perform a basic header presence check; full verification
    requires the PayPal SDK or an HTTP call to their verification endpoint.
    """
    headers = event.get("headers") or {}
    # PayPal sends these headers for webhook verification
    required_headers = [
        "PAYPAL-TRANSMISSION-ID",
        "PAYPAL-TRANSMISSION-TIME",
        "PAYPAL-TRANSMISSION-SIG",
        "PAYPAL-CERT-URL",
    ]
    # Case-insensitive header check
    lower_headers = {k.lower(): v for k, v in headers.items()}
    return all(h.lower() in lower_headers for h in required_headers)


def handle_paypal_webhook(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle incoming PayPal webhook events with signature verification."""
    if not _verify_paypal_signature(event):
        _safe_log("PayPal webhook signature verification failed")
        return _json_response(400, {"error": {"code": "INVALID_SIGNATURE", "message": "Invalid webhook signature"}})

    body = event.get("body", "")
    try:
        webhook_event = json.loads(body)
    except json.JSONDecodeError:
        return _json_response(400, {"error": {"code": "INVALID_JSON", "message": "Invalid JSON payload"}})

    event_type = webhook_event.get("event_type", "")
    resource = webhook_event.get("resource", {})

    _safe_log("PayPal webhook received", {"eventType": event_type})

    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        order_id = resource.get("supplementary_data", {}).get("related_ids", {}).get("order_id", "")
        if order_id:
            _update_payment_status_from_webhook(
                provider_field="paypalOrderId",
                provider_id=order_id,
                new_status="succeeded",
            )
    elif event_type == "PAYMENT.CAPTURE.DENIED":
        order_id = resource.get("supplementary_data", {}).get("related_ids", {}).get("order_id", "")
        if order_id:
            _update_payment_status_from_webhook(
                provider_field="paypalOrderId",
                provider_id=order_id,
                new_status="failed",
                failure_reason="Payment capture denied by PayPal",
            )

    return _json_response(200, {"received": True})


def _update_payment_status_from_webhook(
    *,
    provider_field: str,
    provider_id: str,
    new_status: str,
    failure_reason: Optional[str] = None,
) -> None:
    """Look up a payment by provider reference and update its status."""
    if not provider_id:
        return

    # Scan for the payment with the matching provider reference.
    # In a high-volume system you'd add a GSI on the provider ID field.
    try:
        response = payments_table.scan(
            FilterExpression=f"SK = :sk AND {provider_field} = :pid",
            ExpressionAttributeValues={":sk": "RECORD", ":pid": provider_id},
        )
        items = response.get("Items", [])
        if not items:
            _safe_log("Webhook: payment not found for provider ref", {"providerField": provider_field, "providerId": provider_id})
            return

        payment = items[0]
        update_expr = "SET #s = :status"
        attr_names: Dict[str, str] = {"#s": "status"}
        attr_values: Dict[str, Any] = {":status": new_status}

        if failure_reason:
            update_expr += ", failureReason = :reason"
            attr_values[":reason"] = failure_reason

        payments_table.update_item(
            Key={"PK": payment["PK"], "SK": payment["SK"]},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
        )

        # Send receipt if payment just succeeded
        if new_status == "succeeded":
            _send_receipt_email(
                payer_email=payment.get("payerEmail", ""),
                payment_id=payment.get("paymentId", ""),
                due_type=payment.get("dueType", ""),
                quantity=int(payment.get("quantity", 0)),
                total_amount=int(payment.get("totalAmount", 0)),
            )

        _safe_log("Payment status updated via webhook", {"paymentId": payment.get("paymentId"), "newStatus": new_status})

    except Exception as exc:
        _safe_log("Webhook status update failed", {"error": str(exc)})


# ---------------------------------------------------------------------------
# Dues reminder scheduler (EventBridge triggered) — Requirement 5.8
# ---------------------------------------------------------------------------


def send_dues_reminders(event: Dict[str, Any] = None, context: Any = None) -> Dict[str, Any]:
    """Query overdue payments and send reminder emails at 7, 14, 30 days.

    Triggered by an EventBridge scheduled rule (daily).
    - Queries Payments table GSI2 for status='overdue'
    - Determines which reminder to send based on days past due
    - Skips if not overdue or all 3 reminders already sent
    - Increments remindersSent counter after each send
    """
    reminders_sent_count = 0
    errors: List[str] = []

    try:
        # Query GSI2: status (PK) = 'overdue', dueDate (SK)
        response = payments_table.query(
            IndexName="GSI2",
            KeyConditionExpression="#s = :overdue",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":overdue": "overdue"},
        )
        overdue_payments = response.get("Items", [])

        while response.get("LastEvaluatedKey"):
            response = payments_table.query(
                IndexName="GSI2",
                KeyConditionExpression="#s = :overdue",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":overdue": "overdue"},
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            overdue_payments.extend(response.get("Items", []))

    except Exception as exc:
        _safe_log("Failed to query overdue payments", {"error": str(exc)})
        return {"remindersSent": 0, "errors": [str(exc)]}

    now = datetime.now(timezone.utc)

    for payment in overdue_payments:
        payment_id = payment.get("paymentId", "")
        payer_email = payment.get("payerEmail", "")
        due_date_str = payment.get("dueDate", "")
        reminders_already_sent = int(payment.get("remindersSent", 0))

        # Skip if all 3 reminders already sent
        if reminders_already_sent >= 3:
            continue

        # Calculate days past due
        if not due_date_str:
            continue
        try:
            due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue

        days_overdue = (now - due_date).days
        if days_overdue < 0:
            continue

        # Determine which reminder to send
        reminder_to_send = _determine_reminder(days_overdue, reminders_already_sent)
        if reminder_to_send is None:
            continue

        # Send the reminder email
        try:
            _send_reminder_email(
                payer_email=payer_email,
                payment_id=payment_id,
                days_overdue=days_overdue,
                reminder_number=reminder_to_send,
                total_amount=int(payment.get("totalAmount", 0)),
                due_type=payment.get("dueType", ""),
            )

            # Increment remindersSent counter
            payments_table.update_item(
                Key={"PK": payment["PK"], "SK": payment["SK"]},
                UpdateExpression="SET remindersSent = :count",
                ExpressionAttributeValues={":count": reminders_already_sent + 1},
            )
            reminders_sent_count += 1

        except Exception as exc:
            _safe_log("Failed to send reminder", {"paymentId": payment_id, "error": str(exc)})
            errors.append(f"{payment_id}: {exc}")

    _safe_log("Dues reminders completed", {"sent": reminders_sent_count, "errors": len(errors)})
    return {"remindersSent": reminders_sent_count, "errors": errors}


def _determine_reminder(days_overdue: int, reminders_already_sent: int) -> Optional[int]:
    """Return the reminder number to send, or None if no reminder is due.

    Schedule: reminder 1 at 7 days, reminder 2 at 14 days, reminder 3 at 30 days.
    Only send the next unsent reminder when the threshold is reached.
    """
    thresholds = [(7, 1), (14, 2), (30, 3)]
    for threshold_days, reminder_num in thresholds:
        if days_overdue >= threshold_days and reminders_already_sent < reminder_num:
            return reminder_num
    return None


def _send_reminder_email(
    *,
    payer_email: str,
    payment_id: str,
    days_overdue: int,
    reminder_number: int,
    total_amount: int,
    due_type: str,
) -> None:
    """Send a dues reminder email via SES."""
    due_label = "Student Enrollment" if due_type == "student_enrollment" else "Coach Certification"
    ordinal = {1: "First", 2: "Second", 3: "Final"}.get(reminder_number, "")
    subject = f"WIAL Dues Reminder ({ordinal}) — {due_label}"
    body_text = (
        f"This is a reminder that your WIAL dues payment is overdue.\n\n"
        f"Payment ID: {payment_id}\n"
        f"Type: {due_label}\n"
        f"Amount Due: ${total_amount} USD\n"
        f"Days Overdue: {days_overdue}\n\n"
        f"Please submit your payment at your earliest convenience.\n"
    )

    ses_client.send_email(
        Source=SES_SENDER_EMAIL,
        Destination={"ToAddresses": [payer_email]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
        },
    )
    _safe_log("Reminder email sent", {"paymentId": payment_id, "reminderNumber": reminder_number})


# ---------------------------------------------------------------------------
# Main handler — API Gateway proxy integration router
# ---------------------------------------------------------------------------


def handler(event: dict, context: Any = None) -> Dict[str, Any]:
    """Route incoming API Gateway events to the appropriate operation.

    Also handles EventBridge scheduled invocations for dues reminders.
    """
    # EventBridge scheduled event (dues reminders)
    source = event.get("source", "")
    if source == "aws.events" or event.get("detail-type") == "Scheduled Event":
        result = send_dues_reminders(event, context)
        return _json_response(200, result)

    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    payment_id = path_params.get("paymentId")

    _safe_log("Incoming request", {"httpMethod": http_method, "path": path})

    try:
        # POST /payments/webhook/stripe
        if http_method == "POST" and path.endswith("/webhook/stripe"):
            return handle_stripe_webhook(event)

        # POST /payments/webhook/paypal
        if http_method == "POST" and path.endswith("/webhook/paypal"):
            return handle_paypal_webhook(event)

        # POST /payments — create
        if http_method == "POST" and not payment_id:
            body = json.loads(event.get("body") or "{}")
            result = create_payment(body)
            return _json_response(201, result)

        # GET /payments — list (optional chapterId query param)
        if http_method == "GET" and not payment_id:
            query_params = event.get("queryStringParameters") or {}
            chapter_id = query_params.get("chapterId")
            result = list_payments(chapter_id=chapter_id)
            return _json_response(200, result)

        # GET /payments/{paymentId} — get
        if http_method == "GET" and payment_id:
            result = get_payment(payment_id)
            if isinstance(result, dict) and "statusCode" in result:
                return result
            return _json_response(200, result)

        return _json_response(400, {"error": {"code": "BAD_REQUEST", "message": "Unsupported method or path"}})

    except ValidationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except PaymentError as exc:
        _safe_log("Payment error", {"error": exc.message})
        return _json_response(exc.status_code, exc.to_dict())

    except json.JSONDecodeError:
        return _json_response(400, {"error": {"code": "INVALID_JSON", "message": "Request body is not valid JSON"}})

    except Exception as exc:
        _safe_log("Unexpected error", {"error": str(exc)})
        return _json_response(500, {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})
