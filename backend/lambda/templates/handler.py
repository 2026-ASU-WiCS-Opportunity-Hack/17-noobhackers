"""Template engine Lambda handler.

Manages the global parent template and chapter page content via API
Gateway proxy integration:

- GET    /templates                                → get_template
- PUT    /templates                                → update_template (Super_Admin)
- GET    /chapters/{chapterId}/pages               → get_pages
- GET    /chapters/{chapterId}/pages/{pageSlug}    → get_page
- PUT    /chapters/{chapterId}/pages/{pageSlug}    → update_page

Internal (invoked by update_template):
- sync_template  → propagate locked elements to all active chapters

Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

from shared.exceptions import AuthorizationError, ValidationError
from shared.models import PAGE_SCHEMA, TEMPLATE_SCHEMA
from shared.pii_filter import redact_pii
from shared.validators import validate_input

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TEMPLATES_TABLE = os.environ.get("TEMPLATES_TABLE", "wial-templates")
PAGES_TABLE = os.environ.get("PAGES_TABLE", "wial-pages")
CHAPTERS_TABLE = os.environ.get("CHAPTERS_TABLE", "wial-chapters")
ASSETS_BUCKET = os.environ.get("ASSETS_BUCKET", "wial-platform-assets")

# Locked template elements that non-Super_Admins cannot modify
LOCKED_ELEMENTS = {"headerHtml", "footerHtml", "navConfig", "globalStyles"}

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# AWS clients — instantiated once per container for connection reuse
dynamodb = boto3.resource("dynamodb")
s3_client = boto3.client("s3")

templates_table = dynamodb.Table(TEMPLATES_TABLE)
pages_table = dynamodb.Table(PAGES_TABLE)
chapters_table = dynamodb.Table(CHAPTERS_TABLE)

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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    """Log with PII redaction applied."""
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))


# ---------------------------------------------------------------------------
# Template operations
# ---------------------------------------------------------------------------


def get_template() -> Dict[str, Any]:
    """Return the current (latest version) parent template.

    Queries the Templates table for all versions under PK=TEMPLATE#global
    and returns the one with the highest version number.
    """
    try:
        response = templates_table.query(
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues={":pk": "TEMPLATE#global"},
            ScanIndexForward=False,  # descending by SK
            Limit=1,
        )
        items = response.get("Items", [])
        if not items:
            return {"template": None, "message": "No template found"}
        return {"template": items[0]}

    except Exception as exc:
        _safe_log("Get template failed", {"error": str(exc)})
        raise ValidationError(f"Failed to retrieve template: {exc}") from exc


def update_template(body: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
    """Update the parent template (Super_Admin only).

    Steps:
    1. Validate input against TEMPLATE_SCHEMA
    2. Determine next version number
    3. Store new template version in Templates table
    4. Upload global styles to S3
    5. Trigger sync to all active chapters

    Returns: { version, syncStatus, chaptersUpdated }
    Requirement: 4.1, 4.3
    """
    try:
        sanitized = validate_input(body, TEMPLATE_SCHEMA)
    except ValidationError:
        raise

    # Determine next version
    current = _get_latest_version()
    next_version = current + 1
    now = _now_iso()

    try:
        # Store new template version
        template_item: Dict[str, Any] = {
            "PK": "TEMPLATE#global",
            "SK": f"VERSION#{next_version:06d}",
            "version": next_version,
            "headerHtml": sanitized["headerHtml"],
            "footerHtml": sanitized["footerHtml"],
            "navConfig": sanitized["navConfig"],
            "globalStyles": sanitized["globalStyles"],
            "updatedBy": updated_by,
            "updatedAt": now,
            "syncStatus": "syncing",
        }
        templates_table.put_item(Item=template_item)

        # Upload global styles to S3
        _upload_global_styles(sanitized["globalStyles"])

        # Sync to all active chapters
        sync_result = sync_template(template_item)

        # Update sync status
        final_status = "synced" if not sync_result.get("failures") else "failed"
        templates_table.update_item(
            Key={"PK": "TEMPLATE#global", "SK": f"VERSION#{next_version:06d}"},
            UpdateExpression="SET syncStatus = :status",
            ExpressionAttributeValues={":status": final_status},
        )

        _safe_log("Template updated", {"version": next_version, "syncStatus": final_status})

        return {
            "version": next_version,
            "syncStatus": final_status,
            "chaptersUpdated": sync_result.get("chaptersUpdated", 0),
            "failures": sync_result.get("failures", []),
        }

    except ValidationError:
        raise
    except Exception as exc:
        _safe_log("Template update failed", {"error": str(exc)})
        raise ValidationError(f"Failed to update template: {exc}") from exc


def _get_latest_version() -> int:
    """Return the latest template version number, or 0 if none exists."""
    try:
        response = templates_table.query(
            KeyConditionExpression="PK = :pk",
            ExpressionAttributeValues={":pk": "TEMPLATE#global"},
            ScanIndexForward=False,
            Limit=1,
        )
        items = response.get("Items", [])
        if items:
            return int(items[0].get("version", 0))
        return 0
    except Exception:
        return 0


def _upload_global_styles(styles_content: str) -> None:
    """Upload global styles CSS to S3."""
    try:
        s3_client.put_object(
            Bucket=ASSETS_BUCKET,
            Key="templates/global/styles/tokens.css",
            Body=styles_content.encode("utf-8"),
            ContentType="text/css",
        )
    except Exception as exc:
        _safe_log("Failed to upload global styles", {"error": str(exc)})
        # Non-fatal: template record is already saved


# ---------------------------------------------------------------------------
# Template sync — propagate locked elements to all active chapters
# ---------------------------------------------------------------------------


def sync_template(template: Dict[str, Any]) -> Dict[str, Any]:
    """Sync locked template elements to all active chapters.

    Iterates all chapters with status='active' and updates their
    template assets in S3. Must complete within 10 minutes (Lambda
    timeout should be configured accordingly).

    Returns: { chaptersUpdated: int, failures: list[str] }
    Requirement: 4.3
    """
    chapters_updated = 0
    failures: List[str] = []

    try:
        # Scan for all active chapters
        active_chapters = _get_active_chapters()
    except Exception as exc:
        _safe_log("Failed to fetch active chapters for sync", {"error": str(exc)})
        return {"chaptersUpdated": 0, "failures": [str(exc)]}

    header_html = template.get("headerHtml", "")
    footer_html = template.get("footerHtml", "")
    nav_config = template.get("navConfig", {})
    global_styles = template.get("globalStyles", "")

    for chapter in active_chapters:
        chapter_id = chapter.get("chapterId", "")
        if not chapter_id:
            continue

        try:
            _sync_chapter_template(chapter_id, header_html, footer_html, nav_config, global_styles)
            chapters_updated += 1
        except Exception as exc:
            _safe_log("Sync failed for chapter", {"chapterId": chapter_id, "error": str(exc)})
            failures.append(chapter_id)

    _safe_log("Template sync completed", {"updated": chapters_updated, "failures": len(failures)})
    return {"chaptersUpdated": chapters_updated, "failures": failures}


def _get_active_chapters() -> List[Dict[str, Any]]:
    """Return all chapters with status='active'."""
    chapters: List[Dict[str, Any]] = []
    response = chapters_table.scan(
        FilterExpression="SK = :sk AND #s = :active",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":sk": "METADATA", ":active": "active"},
    )
    chapters.extend(response.get("Items", []))

    while response.get("LastEvaluatedKey"):
        response = chapters_table.scan(
            FilterExpression="SK = :sk AND #s = :active",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":sk": "METADATA", ":active": "active"},
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        chapters.extend(response.get("Items", []))

    return chapters


def _sync_chapter_template(
    chapter_id: str,
    header_html: str,
    footer_html: str,
    nav_config: Dict[str, Any],
    global_styles: str,
) -> None:
    """Write locked template files to a chapter's S3 prefix."""
    prefix = f"chapters/{chapter_id}/"

    s3_client.put_object(
        Bucket=ASSETS_BUCKET,
        Key=f"{prefix}header.html",
        Body=header_html.encode("utf-8"),
        ContentType="text/html",
    )
    s3_client.put_object(
        Bucket=ASSETS_BUCKET,
        Key=f"{prefix}footer.html",
        Body=footer_html.encode("utf-8"),
        ContentType="text/html",
    )
    s3_client.put_object(
        Bucket=ASSETS_BUCKET,
        Key=f"{prefix}nav.json",
        Body=json.dumps(nav_config).encode("utf-8"),
        ContentType="application/json",
    )
    s3_client.put_object(
        Bucket=ASSETS_BUCKET,
        Key=f"{prefix}styles/tokens.css",
        Body=global_styles.encode("utf-8"),
        ContentType="text/css",
    )


# ---------------------------------------------------------------------------
# Template lock enforcement — Requirement 4.4, 4.5
# ---------------------------------------------------------------------------


def _check_locked_element_modification(
    body: Dict[str, Any],
    role: str,
) -> None:
    """Reject modifications to locked template elements by non-Super_Admins.

    Raises ValidationError if a Chapter_Lead or Content_Creator attempts
    to modify headerHtml, footerHtml, navConfig, or globalStyles.
    """
    if role == "Super_Admin":
        return

    attempted_locked = set(body.keys()) & LOCKED_ELEMENTS
    if attempted_locked:
        elements = ", ".join(sorted(attempted_locked))
        raise ValidationError(
            f"Cannot modify locked template elements ({elements}). "
            f"These elements are controlled by the global template."
        )


# ---------------------------------------------------------------------------
# Chapter page content CRUD
# ---------------------------------------------------------------------------


def get_pages(chapter_id: str) -> Dict[str, Any]:
    """List all pages for a chapter."""
    try:
        response = pages_table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues={
                ":pk": f"CHAPTER#{chapter_id}",
                ":prefix": "PAGE#",
            },
        )
        pages = response.get("Items", [])

        while response.get("LastEvaluatedKey"):
            response = pages_table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :prefix)",
                ExpressionAttributeValues={
                    ":pk": f"CHAPTER#{chapter_id}",
                    ":prefix": "PAGE#",
                },
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            pages.extend(response.get("Items", []))

        return {"pages": pages}

    except Exception as exc:
        _safe_log("Get pages failed", {"chapterId": chapter_id, "error": str(exc)})
        raise ValidationError(f"Failed to list pages: {exc}") from exc


def get_page(chapter_id: str, page_slug: str) -> Dict[str, Any]:
    """Get a single page by chapter ID and page slug."""
    try:
        response = pages_table.get_item(
            Key={"PK": f"CHAPTER#{chapter_id}", "SK": f"PAGE#{page_slug}"}
        )
        item = response.get("Item")
        if not item:
            return _json_response(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Page '{page_slug}' not found in chapter {chapter_id}"}},
            )
        return item

    except Exception as exc:
        _safe_log("Get page failed", {"chapterId": chapter_id, "pageSlug": page_slug, "error": str(exc)})
        raise ValidationError(f"Failed to get page: {exc}") from exc


def update_page(
    chapter_id: str,
    page_slug: str,
    body: Dict[str, Any],
    updated_by: str,
    role: str,
) -> Dict[str, Any]:
    """Update a chapter page's content.

    Chapter_Leads and Content_Creators can edit content in designated
    editable areas. Locked template elements cannot be modified by
    non-Super_Admins (Requirement 4.4, 4.5).
    """
    # Enforce template lock for non-Super_Admins
    _check_locked_element_modification(body, role)

    try:
        sanitized = validate_input(body, PAGE_SCHEMA)
    except ValidationError:
        raise

    now = _now_iso()

    try:
        response = pages_table.update_item(
            Key={"PK": f"CHAPTER#{chapter_id}", "SK": f"PAGE#{page_slug}"},
            UpdateExpression="SET title = :title, content = :content, updatedBy = :by, updatedAt = :at",
            ExpressionAttributeValues={
                ":title": sanitized["title"],
                ":content": sanitized["content"],
                ":by": updated_by,
                ":at": now,
            },
            ConditionExpression="attribute_exists(PK)",
            ReturnValues="ALL_NEW",
        )
        _safe_log("Page updated", {"chapterId": chapter_id, "pageSlug": page_slug})
        return response.get("Attributes", {})

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValidationError(f"Page '{page_slug}' not found in chapter {chapter_id}")
    except Exception as exc:
        _safe_log("Update page failed", {"chapterId": chapter_id, "pageSlug": page_slug, "error": str(exc)})
        raise ValidationError(f"Failed to update page: {exc}") from exc


# ---------------------------------------------------------------------------
# Main handler — API Gateway proxy integration router
# ---------------------------------------------------------------------------


def handler(event: dict, context: Any = None) -> Dict[str, Any]:
    """Route incoming API Gateway events to the appropriate operation."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    chapter_id = path_params.get("chapterId")
    page_slug = path_params.get("pageSlug")

    _safe_log("Incoming request", {"httpMethod": http_method, "path": path})

    try:
        # --- Template endpoints ---

        # GET /templates — get current template
        if http_method == "GET" and path.rstrip("/").endswith("/templates") and not chapter_id:
            result = get_template()
            return _json_response(200, result)

        # PUT /templates — update template (Super_Admin only)
        if http_method == "PUT" and path.rstrip("/").endswith("/templates") and not chapter_id:
            # Auth is enforced at the API Gateway / Cognito authorizer level.
            # Extract the caller identity from request context.
            request_context = event.get("requestContext", {})
            authorizer = request_context.get("authorizer", {})
            claims = authorizer.get("claims", {})
            updated_by = claims.get("sub", "unknown")

            body = json.loads(event.get("body") or "{}")
            result = update_template(body, updated_by)
            return _json_response(200, result)

        # --- Chapter page endpoints ---

        # GET /chapters/{chapterId}/pages — list pages
        if http_method == "GET" and chapter_id and not page_slug and "/pages" in path:
            result = get_pages(chapter_id)
            return _json_response(200, result)

        # GET /chapters/{chapterId}/pages/{pageSlug} — get page
        if http_method == "GET" and chapter_id and page_slug:
            result = get_page(chapter_id, page_slug)
            if isinstance(result, dict) and "statusCode" in result:
                return result
            return _json_response(200, result)

        # PUT /chapters/{chapterId}/pages/{pageSlug} — update page
        if http_method == "PUT" and chapter_id and page_slug:
            request_context = event.get("requestContext", {})
            authorizer = request_context.get("authorizer", {})
            claims = authorizer.get("claims", {})
            updated_by = claims.get("sub", "unknown")

            # Determine role from Cognito groups
            groups = claims.get("cognito:groups", "")
            if isinstance(groups, str):
                groups_list = [g.strip() for g in groups.split(",") if g.strip()]
            elif isinstance(groups, list):
                groups_list = groups
            else:
                groups_list = []

            role = _resolve_role_from_groups(groups_list)

            body = json.loads(event.get("body") or "{}")
            result = update_page(chapter_id, page_slug, body, updated_by, role)
            return _json_response(200, result)

        return _json_response(400, {"error": {"code": "BAD_REQUEST", "message": "Unsupported method or path"}})

    except ValidationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except AuthorizationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except json.JSONDecodeError:
        return _json_response(400, {"error": {"code": "INVALID_JSON", "message": "Request body is not valid JSON"}})

    except Exception as exc:
        _safe_log("Unexpected error", {"error": str(exc)})
        return _json_response(500, {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})


def _resolve_role_from_groups(groups: List[str]) -> str:
    """Resolve the highest-privilege role from Cognito group names.

    Mirrors the logic in auth/handler.py but kept local to avoid
    cross-Lambda import dependencies.
    """
    group_priority = {
        "SuperAdmins": "Super_Admin",
        "ChapterLeads": "Chapter_Lead",
        "ContentCreators": "Content_Creator",
        "Coaches": "Coach",
    }
    priority_order = ["SuperAdmins", "ChapterLeads", "ContentCreators", "Coaches"]

    for group_name in priority_order:
        if group_name in groups:
            return group_priority[group_name]
    return "Coach"
