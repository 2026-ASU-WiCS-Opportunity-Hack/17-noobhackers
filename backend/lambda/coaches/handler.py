"""Coach directory Lambda handler.

Handles coach CRUD and profile approval via API Gateway proxy integration:
- GET    /coaches              → list_coaches  (Public, paginated, filterable)
- POST   /coaches              → create_coach  (Chapter_Lead, Super_Admin)
- GET    /coaches/{coachId}    → get_coach     (Public)
- PUT    /coaches/{coachId}    → update_coach_profile (Coach own, Super_Admin)
- POST   /coaches/{coachId}/approve → approve_coach_update (Chapter_Lead, Super_Admin)
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
from boto3.dynamodb.conditions import Attr, Key

from shared.exceptions import AuthorizationError, ValidationError
from shared.models import (
    COACH_SCHEMA,
    COACH_UPDATE_SCHEMA,
    VALID_CERTIFICATION_LEVELS,
)
from shared.pii_filter import redact_pii
from shared.validators import validate_input

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

COACHES_TABLE = os.environ.get("COACHES_TABLE", "wial-coaches")
USERS_TABLE = os.environ.get("USERS_TABLE", "wial-users")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
coaches_table = dynamodb.Table(COACHES_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

# ---------------------------------------------------------------------------
# Auth helpers (mirrors auth/handler.py patterns)
# ---------------------------------------------------------------------------

GROUP_TO_ROLE: Dict[str, str] = {
    "SuperAdmins": "Super_Admin",
    "ChapterLeads": "Chapter_Lead",
    "ContentCreators": "Content_Creator",
    "Coaches": "Coach",
}

ROLE_TO_GROUP: Dict[str, str] = {v: k for k, v in GROUP_TO_ROLE.items()}

_ROLE_HIERARCHY: List[str] = [
    "Super_Admin",
    "Chapter_Lead",
    "Content_Creator",
    "Coach",
]

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def _decimal_default(obj: Any) -> Any:
    """JSON serializer for Decimal values returned by DynamoDB."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _json_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=_decimal_default),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))


def _resolve_role(cognito_groups: List[str]) -> str:
    """Return the highest-privilege role from Cognito group names."""
    for role in _ROLE_HIERARCHY:
        group = ROLE_TO_GROUP.get(role)
        if group and group in cognito_groups:
            return role
    return "Coach"


def _extract_claims(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims")
    )


def _authorize(
    event: Dict[str, Any],
    required_role: str,
    resource: Optional[str] = None,
) -> Dict[str, Any]:
    """Lightweight RBAC check. Returns auth context dict.

    Raises AuthorizationError (401 for missing token, 403 for insufficient perms).
    """
    claims = _extract_claims(event)
    if not claims:
        error = AuthorizationError("Missing or invalid token")
        error.status_code = 401
        raise error

    cognito_user_id = claims.get("sub")
    if not cognito_user_id:
        error = AuthorizationError("Missing or invalid token")
        error.status_code = 401
        raise error

    groups_str = claims.get("cognito:groups", "")
    if isinstance(groups_str, str):
        groups = [g.strip() for g in groups_str.split(",") if g.strip()] if groups_str else []
    elif isinstance(groups_str, list):
        groups = groups_str
    else:
        groups = []

    user_role = _resolve_role(groups)

    # Super_Admin has full access
    if user_role != "Super_Admin":
        user_rank = _ROLE_HIERARCHY.index(user_role) if user_role in _ROLE_HIERARCHY else len(_ROLE_HIERARCHY)
        required_rank = _ROLE_HIERARCHY.index(required_role) if required_role in _ROLE_HIERARCHY else 0

        # Chapter_Lead inherits Content_Creator permissions
        if user_role == "Chapter_Lead" and required_role == "Content_Creator":
            pass
        elif user_role == "Coach" and required_role == "Coach":
            # Coach can only act on own profile
            if resource and resource != cognito_user_id:
                raise AuthorizationError("Insufficient permissions")
        elif user_rank > required_rank:
            raise AuthorizationError("Insufficient permissions")

    # Fetch assigned chapters
    assigned_chapters: List[str] = []
    try:
        resp = users_table.get_item(
            Key={"PK": f"USER#{cognito_user_id}", "SK": "PROFILE"}
        )
        user_record = resp.get("Item")
        if user_record:
            assigned_chapters = user_record.get("assignedChapters", [])
    except Exception:
        _safe_log("Failed to fetch user record for RBAC", {"cognitoUserId": cognito_user_id})

    return {
        "cognitoUserId": cognito_user_id,
        "role": user_role,
        "assignedChapters": assigned_chapters,
    }


# ---------------------------------------------------------------------------
# Coach CRUD operations
# ---------------------------------------------------------------------------

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def _coach_response(item: Dict[str, Any]) -> Dict[str, Any]:
    """Project a DynamoDB coach item to the public API shape."""
    return {
        "coachId": item.get("coachId"),
        "chapterId": item.get("chapterId"),
        "name": item.get("name"),
        "photoUrl": item.get("photoUrl", ""),
        "certificationLevel": item.get("certificationLevel"),
        "location": item.get("location"),
        "country": item.get("country", ""),
        "contactInfo": item.get("contactInfo"),
        "bio": item.get("bio"),
        "languages": item.get("languages", []),
        "status": item.get("status"),
        "embeddingVersion": item.get("embeddingVersion", 0),
    }


def list_coaches(event: Dict[str, Any]) -> Dict[str, Any]:
    """GET /coaches — paginated, filterable by chapterId, certificationLevel,
    location; keyword search by name and bio.

    Query params:
      chapterId, certificationLevel, location, keyword, limit, nextToken
    """
    params = event.get("queryStringParameters") or {}
    chapter_id = params.get("chapterId")
    cert_level = params.get("certificationLevel")
    location_filter = params.get("location")
    keyword = params.get("keyword", "").strip().lower()
    limit = min(int(params.get("limit", DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE)
    next_token = params.get("nextToken")

    try:
        # Use GSI2 (chapterId + certificationLevel) when both filters present
        if chapter_id and cert_level:
            query_kwargs: Dict[str, Any] = {
                "IndexName": "GSI2",
                "KeyConditionExpression": Key("chapterId").eq(chapter_id)
                & Key("certificationLevel").eq(cert_level),
                "Limit": limit,
            }
            if next_token:
                query_kwargs["ExclusiveStartKey"] = json.loads(next_token)
            response = coaches_table.query(**query_kwargs)
            items = response.get("Items", [])

        elif chapter_id:
            # GSI2 with only partition key
            query_kwargs = {
                "IndexName": "GSI2",
                "KeyConditionExpression": Key("chapterId").eq(chapter_id),
                "Limit": limit,
            }
            if cert_level:
                query_kwargs["KeyConditionExpression"] &= Key("certificationLevel").eq(cert_level)
            if next_token:
                query_kwargs["ExclusiveStartKey"] = json.loads(next_token)
            response = coaches_table.query(**query_kwargs)
            items = response.get("Items", [])

        else:
            # Full scan with optional filters
            scan_kwargs: Dict[str, Any] = {"Limit": limit}
            filter_exprs = [Attr("SK").eq("PROFILE"), Attr("status").eq("active")]

            if cert_level:
                filter_exprs.append(Attr("certificationLevel").eq(cert_level))

            combined = filter_exprs[0]
            for expr in filter_exprs[1:]:
                combined = combined & expr

            scan_kwargs["FilterExpression"] = combined
            if next_token:
                scan_kwargs["ExclusiveStartKey"] = json.loads(next_token)
            response = coaches_table.scan(**scan_kwargs)
            items = response.get("Items", [])

        # Post-query filters (location substring, keyword search)
        if location_filter:
            location_lower = location_filter.lower()
            items = [i for i in items if location_lower in i.get("location", "").lower()]

        if keyword:
            items = [
                i for i in items
                if keyword in i.get("name", "").lower()
                or keyword in i.get("bio", "").lower()
            ]

        # Build pagination token
        last_key = response.get("LastEvaluatedKey")
        result: Dict[str, Any] = {
            "coaches": [_coach_response(i) for i in items],
        }
        if last_key:
            result["nextToken"] = json.dumps(last_key)

        return result

    except Exception as exc:
        _safe_log("List coaches failed", {"error": str(exc)})
        raise


def get_coach(coach_id: str) -> Dict[str, Any]:
    """GET /coaches/{coachId} — return full coach profile."""
    try:
        response = coaches_table.get_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"}
        )
        item = response.get("Item")
        if not item:
            return _json_response(404, {
                "error": {"code": "NOT_FOUND", "message": f"Coach {coach_id} not found"},
            })
        return _coach_response(item)

    except Exception as exc:
        _safe_log("Get coach failed", {"coachId": coach_id, "error": str(exc)})
        raise


def create_coach(event: Dict[str, Any], body: Dict[str, Any]) -> Dict[str, Any]:
    """POST /coaches — Chapter_Lead or Super_Admin only."""
    auth_context = _authorize(event, "Chapter_Lead")

    sanitized = validate_input(body, COACH_SCHEMA)

    # Chapter_Lead can only add coaches to their assigned chapters
    target_chapter = sanitized["chapterId"]
    if auth_context["role"] != "Super_Admin":
        if target_chapter not in auth_context.get("assignedChapters", []):
            raise AuthorizationError("Insufficient permissions")

    coach_id = str(uuid.uuid4())
    now = _now_iso()

    item = {
        "PK": f"COACH#{coach_id}",
        "SK": "PROFILE",
        "coachId": coach_id,
        "cognitoUserId": "unlinked",
        "chapterId": target_chapter,
        "name": sanitized["name"],
        "photoUrl": sanitized.get("photoUrl", ""),
        "certificationLevel": sanitized["certificationLevel"],
        "location": sanitized["location"],
        "contactInfo": sanitized["contactInfo"],
        "bio": sanitized["bio"],
        "languages": sanitized.get("languages", []),
        "status": "active",
        "embeddingVersion": 0,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        coaches_table.put_item(Item=item)
        _safe_log("Coach created", {"coachId": coach_id, "chapterId": target_chapter})
    except Exception as exc:
        _safe_log("Create coach failed", {"error": str(exc)})
        raise

    return {"coachId": coach_id, "status": "active"}


def update_coach_profile(event: Dict[str, Any], coach_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """PUT /coaches/{coachId} — store changes in pendingUpdate, set status
    to pending_approval. Active profile remains unchanged.

    Coach can update own profile; Super_Admin can update any.
    """
    # Look up the coach to get cognitoUserId for ownership check
    try:
        resp = coaches_table.get_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"}
        )
        existing = resp.get("Item")
    except Exception as exc:
        _safe_log("Coach lookup failed", {"coachId": coach_id, "error": str(exc)})
        raise

    if not existing:
        raise ValidationError(f"Coach {coach_id} not found")

    # Authorize — Coach role uses cognitoUserId as resource for ownership
    _authorize(event, "Coach", resource=existing.get("cognitoUserId"))

    sanitized = validate_input(body, COACH_UPDATE_SCHEMA)
    if not sanitized:
        raise ValidationError("No valid fields to update")

    now = _now_iso()

    try:
        coaches_table.update_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"},
            UpdateExpression="SET #pu = :pending, #s = :status, #u = :now",
            ExpressionAttributeNames={
                "#pu": "pendingUpdate",
                "#s": "status",
                "#u": "updatedAt",
            },
            ExpressionAttributeValues={
                ":pending": sanitized,
                ":status": "pending_approval",
                ":now": now,
            },
            ConditionExpression="attribute_exists(PK)",
        )
        _safe_log("Coach profile update queued", {"coachId": coach_id})
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValidationError(f"Coach {coach_id} not found")
    except Exception as exc:
        _safe_log("Update coach profile failed", {"coachId": coach_id, "error": str(exc)})
        raise

    return {"coachId": coach_id, "status": "pending_approval"}


def approve_coach_update(event: Dict[str, Any], coach_id: str) -> Dict[str, Any]:
    """POST /coaches/{coachId}/approve — merge pending changes into active
    profile, clear pendingUpdate, increment embeddingVersion, trigger
    re-embedding.

    Chapter_Lead or Super_Admin only.
    """
    auth_context = _authorize(event, "Chapter_Lead")

    # Fetch current coach record
    try:
        resp = coaches_table.get_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"}
        )
        existing = resp.get("Item")
    except Exception as exc:
        _safe_log("Coach lookup failed for approval", {"coachId": coach_id, "error": str(exc)})
        raise

    if not existing:
        raise ValidationError(f"Coach {coach_id} not found")

    pending = existing.get("pendingUpdate")
    if not pending:
        raise ValidationError(f"Coach {coach_id} has no pending update")

    # Chapter_Lead can only approve coaches in their assigned chapters
    coach_chapter = existing.get("chapterId", "")
    if auth_context["role"] != "Super_Admin":
        if coach_chapter not in auth_context.get("assignedChapters", []):
            raise AuthorizationError("Insufficient permissions")

    now = _now_iso()
    current_version = existing.get("embeddingVersion", 0)
    new_version = current_version + 1

    # Build update expression to merge pending fields into active profile
    update_parts = [
        "#s = :active",
        "#u = :now",
        "#ev = :version",
    ]
    attr_names: Dict[str, str] = {
        "#s": "status",
        "#u": "updatedAt",
        "#ev": "embeddingVersion",
    }
    attr_values: Dict[str, Any] = {
        ":active": "active",
        ":now": now,
        ":version": new_version,
    }

    # Merge each pending field into the active profile
    for field_name, value in pending.items():
        placeholder_name = f"#f_{field_name}"
        placeholder_value = f":v_{field_name}"
        update_parts.append(f"{placeholder_name} = {placeholder_value}")
        attr_names[placeholder_name] = field_name
        attr_values[placeholder_value] = value

    # Remove pendingUpdate
    remove_expr = "REMOVE pendingUpdate"

    try:
        coaches_table.update_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"},
            UpdateExpression=f"SET {', '.join(update_parts)} {remove_expr}",
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
            ConditionExpression="attribute_exists(PK)",
        )
        _safe_log("Coach update approved", {
            "coachId": coach_id,
            "embeddingVersion": new_version,
        })
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValidationError(f"Coach {coach_id} not found")
    except Exception as exc:
        _safe_log("Approve coach update failed", {"coachId": coach_id, "error": str(exc)})
        raise

    return {"coachId": coach_id, "status": "approved", "embeddingVersion": new_version}


# ---------------------------------------------------------------------------
# Main handler — API Gateway proxy integration router
# ---------------------------------------------------------------------------


def handler(event: dict, context: Any = None) -> Dict[str, Any]:
    """Route incoming API Gateway events to the appropriate operation."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    coach_id = path_params.get("coachId")

    _safe_log("Coaches handler invoked", {"httpMethod": http_method, "path": path})

    try:
        # POST /coaches/{coachId}/approve — approve pending update
        if http_method == "POST" and coach_id and path.rstrip("/").endswith("/approve"):
            result = approve_coach_update(event, coach_id)
            return _json_response(200, result)

        # POST /coaches — create coach
        if http_method == "POST" and not coach_id:
            body = json.loads(event.get("body") or "{}")
            result = create_coach(event, body)
            return _json_response(201, result)

        # GET /coaches/{coachId} — get single coach
        if http_method == "GET" and coach_id:
            result = get_coach(coach_id)
            # get_coach may return a full response dict (404 case)
            if isinstance(result, dict) and "statusCode" in result:
                return result
            return _json_response(200, result)

        # GET /coaches — list coaches
        if http_method == "GET" and not coach_id:
            result = list_coaches(event)
            return _json_response(200, result)

        # PUT /coaches/{coachId} — update coach profile
        if http_method == "PUT" and coach_id:
            body = json.loads(event.get("body") or "{}")
            result = update_coach_profile(event, coach_id, body)
            return _json_response(200, result)

        return _json_response(400, {
            "error": {"code": "BAD_REQUEST", "message": "Unsupported method or path"},
        })

    except AuthorizationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except ValidationError as exc:
        return _json_response(exc.status_code, exc.to_dict())

    except json.JSONDecodeError:
        return _json_response(400, {
            "error": {"code": "INVALID_JSON", "message": "Request body is not valid JSON"},
        })

    except Exception as exc:
        _safe_log("Unexpected error", {"error": str(exc)})
        return _json_response(500, {
            "error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
        })
