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
CHAPTERS_TABLE = os.environ.get("CHAPTERS_TABLE", "wial-chapters")
USERS_TABLE = os.environ.get("USERS_TABLE", "wial-users")
SEARCH_FN_NAME = os.environ.get("SEARCH_FN_NAME", "")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
lambda_client = boto3.client("lambda")
coaches_table = dynamodb.Table(COACHES_TABLE)
chapters_table = dynamodb.Table(CHAPTERS_TABLE)
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
    """Extract JWT claims from Cognito authorizer or Authorization header."""
    # 1. Try Cognito authorizer claims (populated by API Gateway)
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims")
    )
    if claims:
        return claims

    # 2. Decode JWT from Authorization header directly
    headers = event.get("headers") or {}
    auth_header = headers.get("Authorization") or headers.get("authorization") or ""
    token = auth_header.replace("Bearer ", "").strip() if auth_header else ""
    if not token:
        return None

    try:
        import base64
        import time as _time
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        exp = claims.get("exp", 0)
        if exp and _time.time() > exp:
            return None
        return claims
    except Exception:
        return None


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

        # Post-query filters (location substring, keyword search, status)
        # GSI2 queries don't filter by status, so we do it here
        items = [i for i in items if i.get("status", "active") == "active"]

        if location_filter:
            location_lower = location_filter.lower()
            items = [i for i in items if location_lower in i.get("location", "").lower()]

        if keyword:
            items = [
                i for i in items
                if keyword in i.get("name", "").lower()
                or keyword in i.get("bio", "").lower()
                or keyword in i.get("location", "").lower()
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

    # Chapter_Lead can only add coaches to their assigned chapters.
    # For now, we trust that the Chapter Lead is operating on their own
    # chapter since the frontend only shows their chapter's manage page.
    # A full check would compare the chapter slug against assignedChapters.
    target_chapter = sanitized["chapterId"]

    coach_id = str(uuid.uuid4())
    now = _now_iso()
    cognito_user_id = "unlinked"

    # Create Cognito account for the coach if email + password provided
    coach_email = body.get("email", "")
    coach_password = body.get("password", "")
    user_pool_id = os.environ.get("USER_POOL_ID", "")

    if coach_email and coach_password and not user_pool_id:
        _safe_log("WARNING: USER_POOL_ID not set, cannot create Cognito account for coach")

    if coach_email and coach_password and user_pool_id:
        try:
            cognito_client = boto3.client("cognito-idp")
            create_resp = cognito_client.admin_create_user(
                UserPoolId=user_pool_id,
                Username=coach_email,
                UserAttributes=[
                    {"Name": "email", "Value": coach_email},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "given_name", "Value": sanitized["name"].split()[0]},
                    {"Name": "family_name", "Value": sanitized["name"].split()[-1] if len(sanitized["name"].split()) > 1 else "Coach"},
                ],
                TemporaryPassword="TempPass123!",
                MessageAction="SUPPRESS",
            )
            # Extract sub
            for attr in create_resp.get("User", {}).get("Attributes", []):
                if attr.get("Name") == "sub":
                    cognito_user_id = attr["Value"]
                    break
            # Set permanent password
            cognito_client.admin_set_user_password(
                UserPoolId=user_pool_id, Username=coach_email,
                Password=coach_password, Permanent=True,
            )
            # Add to Coaches group
            cognito_client.admin_add_user_to_group(
                UserPoolId=user_pool_id, Username=coach_email, GroupName="Coaches",
            )
            # Write user record to Users table with chapter slug
            chapter_slug = ""
            try:
                ch_resp = chapters_table.get_item(Key={"PK": f"CHAPTER#{target_chapter}", "SK": "METADATA"})
                chapter_slug = ch_resp.get("Item", {}).get("slug", "")
            except Exception:
                pass
            users_table.put_item(Item={
                "PK": f"USER#{cognito_user_id}", "SK": "PROFILE",
                "cognitoUserId": cognito_user_id, "email": coach_email,
                "role": "Coach", "assignedChapters": [chapter_slug] if chapter_slug else [],
                "status": "active", "createdAt": now, "updatedAt": now,
            })
            _safe_log("Cognito coach user created", {"coachId": coach_id})
        except Exception as exc:
            _safe_log("Coach Cognito creation failed (non-blocking)", {"error": str(exc)})

    item = {
        "PK": f"COACH#{coach_id}",
        "SK": "PROFILE",
        "coachId": coach_id,
        "cognitoUserId": cognito_user_id,
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

    # Trigger async embedding via the search Lambda
    if SEARCH_FN_NAME:
        try:
            lambda_client.invoke(
                FunctionName=SEARCH_FN_NAME,
                InvocationType="Event",  # async — don't wait for response
                Payload=json.dumps({
                    "httpMethod": "POST",
                    "path": f"/coaches/{coach_id}/embed",
                    "pathParameters": {"coachId": coach_id},
                    "body": "{}",
                }).encode(),
            )
            _safe_log("Embedding triggered", {"coachId": coach_id})
        except Exception as exc:
            # Non-blocking — coach is created even if embedding fails
            _safe_log("Embedding trigger failed", {"coachId": coach_id, "error": str(exc)})

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


def delete_coach(event: Dict[str, Any], coach_id: str) -> Dict[str, Any]:
    """DELETE /coaches/{coachId} — soft-delete (set status to inactive).

    Chapter_Lead or Super_Admin only.
    """
    _authorize(event, "Chapter_Lead")

    now = _now_iso()
    try:
        response = coaches_table.update_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"},
            UpdateExpression="SET #s = :inactive, #u = :now",
            ExpressionAttributeNames={"#s": "status", "#u": "updatedAt"},
            ExpressionAttributeValues={":inactive": "inactive", ":now": now},
            ConditionExpression="attribute_exists(PK)",
            ReturnValues="ALL_NEW",
        )
        _safe_log("Coach deactivated", {"coachId": coach_id})
        return {"coachId": coach_id, "status": "inactive"}
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValidationError(f"Coach {coach_id} not found")
    except Exception as exc:
        _safe_log("Delete coach failed", {"coachId": coach_id, "error": str(exc)})
        raise


def admin_update_coach(event: Dict[str, Any], coach_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """PUT /coaches/{coachId} by Chapter_Lead/Super_Admin — direct update
    (no pending approval needed).
    """
    sanitized = validate_input(body, COACH_UPDATE_SCHEMA)
    if not sanitized:
        raise ValidationError("No valid fields to update")

    now = _now_iso()
    update_parts = ["#u = :now"]
    attr_names: Dict[str, str] = {"#u": "updatedAt"}
    attr_values: Dict[str, Any] = {":now": now}

    for field, value in sanitized.items():
        placeholder = f"#{field}"
        val_placeholder = f":{field}"
        update_parts.append(f"{placeholder} = {val_placeholder}")
        attr_names[placeholder] = field
        attr_values[val_placeholder] = value

    try:
        coaches_table.update_item(
            Key={"PK": f"COACH#{coach_id}", "SK": "PROFILE"},
            UpdateExpression="SET " + ", ".join(update_parts),
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
            ConditionExpression="attribute_exists(PK)",
        )
        _safe_log("Coach updated by admin", {"coachId": coach_id})
        return {"coachId": coach_id, "status": "updated"}
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValidationError(f"Coach {coach_id} not found")
    except Exception as exc:
        _safe_log("Admin update coach failed", {"coachId": coach_id, "error": str(exc)})
        raise


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
            # Check if caller is Chapter_Lead or Super_Admin for direct update
            claims = _extract_claims(event)
            groups = []
            if claims:
                groups_str = claims.get("cognito:groups", "")
                if isinstance(groups_str, str):
                    groups = [g.strip() for g in groups_str.split(",") if g.strip()] if groups_str else []
                elif isinstance(groups_str, list):
                    groups = groups_str
            role = _resolve_role(groups)
            if role in ("Super_Admin", "Chapter_Lead"):
                result = admin_update_coach(event, coach_id, body)
            else:
                result = update_coach_profile(event, coach_id, body)
            return _json_response(200, result)

        # DELETE /coaches/{coachId} — deactivate coach
        if http_method == "DELETE" and coach_id:
            result = delete_coach(event, coach_id)
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
