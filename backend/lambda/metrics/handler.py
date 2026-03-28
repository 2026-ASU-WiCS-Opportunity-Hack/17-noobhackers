"""Metrics and dashboard Lambda handler.

Aggregates revenue and chapter activity metrics via API Gateway proxy
integration:

- GET /metrics/global                  → get_global_metrics (Super_Admin)
- GET /metrics/chapters/{chapterId}    → get_chapter_metrics (Chapter_Lead, Super_Admin)

Requirements: 5.7, 11.1, 11.2, 11.3, 11.4
"""

from __future__ import annotations

import json
import logging
import os
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3

from shared.exceptions import ValidationError
from shared.pii_filter import redact_pii

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CHAPTERS_TABLE = os.environ.get("CHAPTERS_TABLE", "wial-chapters")
COACHES_TABLE = os.environ.get("COACHES_TABLE", "wial-coaches")
PAYMENTS_TABLE = os.environ.get("PAYMENTS_TABLE", "wial-payments")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# AWS clients — instantiated once per container for connection reuse
dynamodb = boto3.resource("dynamodb")

chapters_table = dynamodb.Table(CHAPTERS_TABLE)
coaches_table = dynamodb.Table(COACHES_TABLE)
payments_table = dynamodb.Table(PAYMENTS_TABLE)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


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


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    """Log with PII redaction applied."""
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))


# ---------------------------------------------------------------------------
# Data fetching helpers
# ---------------------------------------------------------------------------


def _scan_all(table, **kwargs) -> List[Dict[str, Any]]:
    """Scan a DynamoDB table with automatic pagination."""
    items: List[Dict[str, Any]] = []
    response = table.scan(**kwargs)
    items.extend(response.get("Items", []))
    while response.get("LastEvaluatedKey"):
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"], **kwargs)
        items.extend(response.get("Items", []))
    return items


def _get_all_chapters() -> List[Dict[str, Any]]:
    """Return all chapter metadata records."""
    return _scan_all(
        chapters_table,
        FilterExpression="SK = :sk",
        ExpressionAttributeValues={":sk": "METADATA"},
    )


def _get_all_coaches() -> List[Dict[str, Any]]:
    """Return all coach profile records."""
    return _scan_all(
        coaches_table,
        FilterExpression="SK = :sk",
        ExpressionAttributeValues={":sk": "PROFILE"},
    )


def _get_all_payments() -> List[Dict[str, Any]]:
    """Return all payment records."""
    return _scan_all(
        payments_table,
        FilterExpression="SK = :sk",
        ExpressionAttributeValues={":sk": "RECORD"},
    )


# ---------------------------------------------------------------------------
# Global metrics — Requirement 11.1, 11.4, 5.7
# ---------------------------------------------------------------------------


def get_global_metrics() -> Dict[str, Any]:
    """Aggregate metrics across all chapters.

    Returns:
        activeChapters: count of chapters with status "active"
        totalCoaches: sum of active coaches across all chapters
        totalRevenue: sum of totalAmount for succeeded payments
        duesCollectionStatus: { succeeded, pending, failed, overdue } counts
        membershipGrowth: per-chapter growth rates (placeholder — requires
            historical snapshots; returns current coach counts per chapter)
        paymentConversionRate: global paid / issued ratio
    """
    try:
        chapters = _get_all_chapters()
        coaches = _get_all_coaches()
        payments = _get_all_payments()
    except Exception as exc:
        _safe_log("Failed to fetch data for global metrics", {"error": str(exc)})
        raise ValidationError(f"Failed to aggregate global metrics: {exc}") from exc

    active_chapters = [c for c in chapters if c.get("status") == "active"]
    active_coaches = [c for c in coaches if c.get("status") == "active"]

    # Revenue: sum of totalAmount for succeeded payments
    total_revenue = sum(
        int(p.get("totalAmount", 0))
        for p in payments
        if p.get("status") == "succeeded"
    )

    # Dues collection status breakdown
    dues_status: Dict[str, int] = {"succeeded": 0, "pending": 0, "failed": 0, "overdue": 0}
    for p in payments:
        s = p.get("status", "")
        if s in dues_status:
            dues_status[s] += 1

    # Payment conversion rate: succeeded / total issued (all non-zero payments)
    total_issued = len(payments)
    total_paid = dues_status["succeeded"]
    conversion_rate = (total_paid / total_issued) if total_issued > 0 else 0.0

    # Per-chapter coach counts (for membership tracking)
    chapter_coach_counts: Dict[str, int] = {}
    for coach in active_coaches:
        cid = coach.get("chapterId", "")
        chapter_coach_counts[cid] = chapter_coach_counts.get(cid, 0) + 1

    return {
        "activeChapters": len(active_chapters),
        "totalCoaches": len(active_coaches),
        "totalRevenue": total_revenue,
        "duesCollectionStatus": dues_status,
        "membershipGrowth": chapter_coach_counts,
        "paymentConversionRate": round(conversion_rate, 4),
    }


# ---------------------------------------------------------------------------
# Per-chapter metrics — Requirement 11.2, 11.3
# ---------------------------------------------------------------------------


def get_chapter_metrics(chapter_id: str) -> Dict[str, Any]:
    """Compute metrics for a specific chapter.

    Returns:
        chapterId: the chapter identifier
        revenue: sum of succeeded payment amounts for this chapter
        coachCount: number of active coaches in this chapter
        membershipGrowthRate: (current - previous) / previous
            (requires historical data; returns 0.0 as baseline)
        paymentConversionRate: paid / issued for this chapter
        duesCollectionStatus: { succeeded, pending, failed, overdue } counts
    """
    try:
        coaches = _get_all_coaches()
        payments = _get_all_payments()
    except Exception as exc:
        _safe_log("Failed to fetch data for chapter metrics", {"chapterId": chapter_id, "error": str(exc)})
        raise ValidationError(f"Failed to compute chapter metrics: {exc}") from exc

    # Filter to this chapter
    chapter_coaches = [
        c for c in coaches
        if c.get("chapterId") == chapter_id and c.get("status") == "active"
    ]
    chapter_payments = [
        p for p in payments
        if p.get("chapterId") == chapter_id
    ]

    # Revenue
    revenue = sum(
        int(p.get("totalAmount", 0))
        for p in chapter_payments
        if p.get("status") == "succeeded"
    )

    # Dues collection status
    dues_status: Dict[str, int] = {"succeeded": 0, "pending": 0, "failed": 0, "overdue": 0}
    for p in chapter_payments:
        s = p.get("status", "")
        if s in dues_status:
            dues_status[s] += 1

    # Payment conversion rate
    total_issued = len(chapter_payments)
    total_paid = dues_status["succeeded"]
    conversion_rate = (total_paid / total_issued) if total_issued > 0 else 0.0

    # Membership growth rate — requires previous period snapshot.
    # For now, return 0.0 as baseline. A future enhancement would store
    # periodic snapshots and compute (current - previous) / previous.
    growth_rate = 0.0

    return {
        "chapterId": chapter_id,
        "revenue": revenue,
        "coachCount": len(chapter_coaches),
        "membershipGrowthRate": round(growth_rate, 4),
        "paymentConversionRate": round(conversion_rate, 4),
        "duesCollectionStatus": dues_status,
    }


# ---------------------------------------------------------------------------
# Main handler — API Gateway proxy integration router
# ---------------------------------------------------------------------------


def handler(event: dict, context: Any = None) -> Dict[str, Any]:
    """Route incoming API Gateway events to the appropriate operation."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    chapter_id = path_params.get("chapterId")

    _safe_log("Incoming request", {"httpMethod": http_method, "path": path})

    try:
        # GET /metrics/global
        if http_method == "GET" and "/metrics/global" in path:
            result = get_global_metrics()
            return _json_response(200, result)

        # GET /metrics/chapters/{chapterId}
        if http_method == "GET" and chapter_id and "/metrics/chapters/" in path:
            result = get_chapter_metrics(chapter_id)
            return _json_response(200, result)

        return _json_response(400, {"error": {"code": "BAD_REQUEST", "message": "Unsupported method or path"}})

    except ValidationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except Exception as exc:
        _safe_log("Unexpected error", {"error": str(exc)})
        return _json_response(500, {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})
