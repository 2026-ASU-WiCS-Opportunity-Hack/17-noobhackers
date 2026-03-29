"""Chapter provisioning Lambda handler.

Handles chapter CRUD operations via API Gateway proxy integration:
- POST   /chapters              → create_chapter
- GET    /chapters              → list_chapters
- GET    /chapters/{chapterId}  → get_chapter
- PUT    /chapters/{chapterId}  → update_chapter
- DELETE /chapters/{chapterId}  → delete_chapter (soft-delete)
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import boto3

from shared.exceptions import ProvisioningError, ValidationError
from shared.models import CHAPTER_SCHEMA, CORE_PAGES
from shared.pii_filter import redact_pii
from shared.validators import validate_input

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CHAPTERS_TABLE = os.environ.get("CHAPTERS_TABLE", "wial-chapters")
PAGES_TABLE = os.environ.get("PAGES_TABLE", "wial-pages")
ASSETS_BUCKET = os.environ.get("ASSETS_BUCKET", "wial-platform-assets")
URL_MODE = os.environ.get("URL_MODE", "subdomain")  # "subdomain" | "subdirectory"
HOSTED_ZONE_ID = os.environ.get("HOSTED_ZONE_ID", "")
DOMAIN = os.environ.get("DOMAIN", "wial.org")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# AWS clients — instantiated once per container for connection reuse
dynamodb = boto3.resource("dynamodb")
s3_client = boto3.client("s3")
route53_client = boto3.client("route53")

chapters_table = dynamodb.Table(CHAPTERS_TABLE)
pages_table = dynamodb.Table(PAGES_TABLE)

# ---------------------------------------------------------------------------
# Page title mapping for the 6 core pages
# ---------------------------------------------------------------------------

_CORE_PAGE_TITLES: Dict[str, str] = {
    "about": "About",
    "coach-directory": "Coach Directory",
    "events": "Events",
    "team": "Team",
    "resources": "Resources",
    "contact": "Contact",
}

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
    def _default(obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return int(obj) if obj == int(obj) else float(obj)
        raise TypeError(f"Not serializable: {type(obj).__name__}")
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=_default),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_url(slug: str) -> str:
    """Generate the chapter URL based on the global URL_MODE setting."""
    if URL_MODE == "subdirectory":
        return f"{DOMAIN}/{slug}"
    # Default: subdomain
    return f"{slug}.{DOMAIN}"


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    """Log with PII redaction applied."""
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))



# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------


def create_chapter(body: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new chapter site.

    Steps:
    1. Validate input against CHAPTER_SCHEMA
    2. Write chapter metadata to DynamoDB Chapters table
    3. Copy parent template assets from S3
    4. Create Route 53 subdomain record
    5. Auto-generate 6 core pages in Pages table

    Returns ``{ chapterId, url, status }`` on success.
    Raises ``ProvisioningError`` on failure.
    """
    # 1. Validate
    try:
        sanitized = validate_input(body, CHAPTER_SCHEMA)
    except ValidationError:
        raise

    chapter_id = str(uuid.uuid4())
    slug = sanitized["slug"]
    now = _now_iso()
    url = _generate_url(slug)

    # 1. Validate
    try:
        sanitized = validate_input(body, CHAPTER_SCHEMA)
    except ValidationError:
        raise

    slug = sanitized["slug"]

    # 1b. Check for duplicate slug via GSI1
    try:
        existing = chapters_table.query(
            IndexName="GSI1",
            KeyConditionExpression="slug = :slug",
            ExpressionAttributeValues={":slug": slug},
            Limit=1,
        )
        if existing.get("Items"):
            existing_chapter = existing["Items"][0]
            if existing_chapter.get("status") == "active":
                raise ValidationError(
                    f"A chapter with slug '{slug}' already exists. Choose a different slug."
                )
    except ValidationError:
        raise
    except Exception as exc:
        _safe_log("Slug uniqueness check failed", {"slug": slug, "error": str(exc)})
        # Allow creation to proceed if GSI query fails (non-blocking)

    chapter_id = str(uuid.uuid4())
    now = _now_iso()
    url = _generate_url(slug)

    try:
        # 2. Write chapter metadata
        chapter_item = {
            "PK": f"CHAPTER#{chapter_id}",
            "SK": "METADATA",
            "chapterId": chapter_id,
            "chapterName": sanitized["chapterName"],
            "slug": slug,
            "region": sanitized["region"],
            "executiveDirectorEmail": sanitized["executiveDirectorEmail"],
            "status": "active",
            "createdAt": now,
            "updatedAt": now,
        }
        if sanitized.get("externalLink"):
            chapter_item["externalLink"] = sanitized["externalLink"]

        chapters_table.put_item(Item=chapter_item)
        _safe_log("Chapter metadata written", {"chapterId": chapter_id, "slug": slug})

        # 3. Copy parent template assets from S3
        _copy_template_assets(chapter_id)

        # 4. Create Route 53 subdomain record (subdomain mode only)
        if URL_MODE == "subdomain" and HOSTED_ZONE_ID:
            _create_subdomain_record(slug)

        # 5. Auto-generate 6 core pages
        _create_core_pages(chapter_id, now)

        _safe_log("Chapter provisioned successfully", {"chapterId": chapter_id, "url": url})

        return {"chapterId": chapter_id, "url": url, "status": "active"}

    except ValidationError:
        raise
    except Exception as exc:
        _safe_log(
            "Chapter provisioning failed",
            {"chapterId": chapter_id, "error": str(exc)},
        )
        raise ProvisioningError(f"Failed to create chapter: {exc}") from exc


def _copy_template_assets(chapter_id: str) -> None:
    """Copy global template assets from ``templates/global/`` to ``chapters/{chapterId}/``."""
    prefix = "templates/global/"
    try:
        paginator = s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=ASSETS_BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                src_key = obj["Key"]
                relative = src_key[len(prefix):]
                if not relative:
                    continue
                dest_key = f"chapters/{chapter_id}/{relative}"
                s3_client.copy_object(
                    Bucket=ASSETS_BUCKET,
                    CopySource={"Bucket": ASSETS_BUCKET, "Key": src_key},
                    Key=dest_key,
                )
    except Exception as exc:
        _safe_log("Template asset copy failed", {"chapterId": chapter_id, "error": str(exc)})
        raise ProvisioningError(f"Failed to copy template assets: {exc}") from exc


def _create_subdomain_record(slug: str) -> None:
    """Create a Route 53 CNAME record for the chapter subdomain."""
    try:
        route53_client.change_resource_record_sets(
            HostedZoneId=HOSTED_ZONE_ID,
            ChangeBatch={
                "Changes": [
                    {
                        "Action": "UPSERT",
                        "ResourceRecordSet": {
                            "Name": f"{slug}.{DOMAIN}",
                            "Type": "CNAME",
                            "TTL": 300,
                            "ResourceRecords": [{"Value": DOMAIN}],
                        },
                    }
                ]
            },
        )
    except Exception as exc:
        _safe_log("DNS record creation failed", {"slug": slug, "error": str(exc)})
        raise ProvisioningError(f"Failed to create subdomain record: {exc}") from exc


def _create_core_pages(chapter_id: str, now: str) -> None:
    """Write the 6 core page records to the Pages table."""
    try:
        with pages_table.batch_writer() as batch:
            for page_slug in CORE_PAGES:
                title = _CORE_PAGE_TITLES.get(page_slug, page_slug.replace("-", " ").title())
                batch.put_item(
                    Item={
                        "PK": f"CHAPTER#{chapter_id}",
                        "SK": f"PAGE#{page_slug}",
                        "pageSlug": page_slug,
                        "title": title,
                        "content": "",
                        "isCorePage": True,
                        "updatedAt": now,
                    }
                )
    except Exception as exc:
        _safe_log("Core page creation failed", {"chapterId": chapter_id, "error": str(exc)})
        raise ProvisioningError(f"Failed to create core pages: {exc}") from exc



def list_chapters() -> Dict[str, Any]:
    """Return all active chapters."""
    try:
        response = chapters_table.scan(
            FilterExpression="SK = :sk AND #s = :active",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":sk": "METADATA", ":active": "active"},
        )
        chapters: List[Dict[str, Any]] = response.get("Items", [])

        # Handle pagination for large tables
        while response.get("LastEvaluatedKey"):
            response = chapters_table.scan(
                FilterExpression="SK = :sk AND #s = :active",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":sk": "METADATA", ":active": "active"},
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            chapters.extend(response.get("Items", []))

        return {"chapters": chapters}

    except Exception as exc:
        _safe_log("List chapters failed", {"error": str(exc)})
        raise ProvisioningError(f"Failed to list chapters: {exc}") from exc


def get_chapter(chapter_id: str) -> Dict[str, Any]:
    """Get a single chapter by ID."""
    try:
        response = chapters_table.get_item(
            Key={"PK": f"CHAPTER#{chapter_id}", "SK": "METADATA"}
        )
        item = response.get("Item")
        if not item:
            return _json_response(404, {"error": {"code": "NOT_FOUND", "message": f"Chapter {chapter_id} not found"}})
        return item

    except Exception as exc:
        _safe_log("Get chapter failed", {"chapterId": chapter_id, "error": str(exc)})
        raise ProvisioningError(f"Failed to get chapter: {exc}") from exc


def update_chapter(chapter_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Update chapter metadata fields."""
    # Only allow updating specific fields
    allowed_fields = {"chapterName", "region", "executiveDirectorEmail", "externalLink"}
    update_fields = {k: v for k, v in body.items() if k in allowed_fields}

    if not update_fields:
        raise ValidationError("No valid fields to update")

    now = _now_iso()
    try:
        update_expr_parts = ["#updatedAt = :updatedAt"]
        attr_names: Dict[str, str] = {"#updatedAt": "updatedAt"}
        attr_values: Dict[str, Any] = {":updatedAt": now}

        for field_name, value in update_fields.items():
            placeholder = f"#{field_name}"
            value_placeholder = f":{field_name}"
            update_expr_parts.append(f"{placeholder} = {value_placeholder}")
            attr_names[placeholder] = field_name
            attr_values[value_placeholder] = value

        response = chapters_table.update_item(
            Key={"PK": f"CHAPTER#{chapter_id}", "SK": "METADATA"},
            UpdateExpression="SET " + ", ".join(update_expr_parts),
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
            ConditionExpression="attribute_exists(PK)",
            ReturnValues="ALL_NEW",
        )
        _safe_log("Chapter updated", {"chapterId": chapter_id})
        return response.get("Attributes", {})

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ProvisioningError(f"Chapter {chapter_id} not found")
    except Exception as exc:
        _safe_log("Update chapter failed", {"chapterId": chapter_id, "error": str(exc)})
        raise ProvisioningError(f"Failed to update chapter: {exc}") from exc


def delete_chapter(chapter_id: str) -> Dict[str, Any]:
    """Soft-delete a chapter by setting status to 'inactive'."""
    now = _now_iso()
    try:
        response = chapters_table.update_item(
            Key={"PK": f"CHAPTER#{chapter_id}", "SK": "METADATA"},
            UpdateExpression="SET #s = :inactive, #updatedAt = :now",
            ExpressionAttributeNames={"#s": "status", "#updatedAt": "updatedAt"},
            ExpressionAttributeValues={":inactive": "inactive", ":now": now},
            ConditionExpression="attribute_exists(PK)",
            ReturnValues="ALL_NEW",
        )
        _safe_log("Chapter deactivated", {"chapterId": chapter_id})
        return response.get("Attributes", {})

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ProvisioningError(f"Chapter {chapter_id} not found")
    except Exception as exc:
        _safe_log("Delete chapter failed", {"chapterId": chapter_id, "error": str(exc)})
        raise ProvisioningError(f"Failed to deactivate chapter: {exc}") from exc



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
        # POST /chapters — create
        if http_method == "POST" and not chapter_id:
            body = json.loads(event.get("body") or "{}")
            result = create_chapter(body)
            return _json_response(201, result)

        # GET /chapters — list
        if http_method == "GET" and not chapter_id:
            result = list_chapters()
            return _json_response(200, result)

        # GET /chapters/{chapterId} — get
        if http_method == "GET" and chapter_id:
            result = get_chapter(chapter_id)
            # get_chapter may return a full response dict (404 case)
            if isinstance(result, dict) and "statusCode" in result:
                return result
            return _json_response(200, result)

        # PUT /chapters/{chapterId} — update
        if http_method == "PUT" and chapter_id:
            body = json.loads(event.get("body") or "{}")
            result = update_chapter(chapter_id, body)
            return _json_response(200, result)

        # DELETE /chapters/{chapterId} — deactivate
        if http_method == "DELETE" and chapter_id:
            result = delete_chapter(chapter_id)
            return _json_response(200, result)

        return _json_response(400, {"error": {"code": "BAD_REQUEST", "message": "Unsupported method or path"}})

    except ValidationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except ProvisioningError as exc:
        _safe_log("Provisioning error", {"error": exc.message})
        return _json_response(exc.status_code, exc.to_dict())

    except json.JSONDecodeError:
        return _json_response(400, {"error": {"code": "INVALID_JSON", "message": "Request body is not valid JSON"}})

    except Exception as exc:
        _safe_log("Unexpected error", {"error": str(exc)})
        return _json_response(500, {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})
