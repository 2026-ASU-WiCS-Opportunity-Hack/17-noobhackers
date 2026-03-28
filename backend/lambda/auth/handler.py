"""Auth Lambda handler — Cognito triggers, RBAC middleware, and user management.

Cognito trigger routing (detected via ``triggerSource``):
- PreAuthentication_Authentication  → pre_authentication
- PostAuthentication_Authentication → post_authentication

API Gateway routes (detected via ``httpMethod``):
- GET    /users              → list_users   (Super_Admin only)
- POST   /users              → create_user  (Super_Admin, Chapter_Lead)
- PUT    /users/{userId}/role → change_role  (Super_Admin only)
- DELETE /users/{userId}      → deactivate_user (Super_Admin only)
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import boto3

from shared.exceptions import AuthorizationError, ValidationError
from shared.models import USER_SCHEMA, VALID_ROLES
from shared.pii_filter import redact_pii
from shared.validators import validate_input

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

USERS_TABLE = os.environ.get("USERS_TABLE", "wial-users")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(USERS_TABLE)

# ---------------------------------------------------------------------------
# Cognito group → role mapping
# ---------------------------------------------------------------------------

GROUP_TO_ROLE: Dict[str, str] = {
    "SuperAdmins": "Super_Admin",
    "ChapterLeads": "Chapter_Lead",
    "ContentCreators": "Content_Creator",
    "Coaches": "Coach",
}

ROLE_TO_GROUP: Dict[str, str] = {v: k for k, v in GROUP_TO_ROLE.items()}

# Role hierarchy (lower index = higher privilege)
_ROLE_HIERARCHY: List[str] = [
    "Super_Admin",
    "Chapter_Lead",
    "Content_Creator",
    "Coach",
]

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
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_log(message: str, extra: Optional[Dict[str, Any]] = None) -> None:
    record: Dict[str, Any] = {"message": message}
    if extra:
        record.update(extra)
    logger.info(json.dumps(redact_pii(record)))


def _resolve_role(cognito_groups: List[str]) -> str:
    """Return the highest-privilege role from a list of Cognito group names."""
    for role in _ROLE_HIERARCHY:
        group = ROLE_TO_GROUP.get(role)
        if group and group in cognito_groups:
            return role
    return "Coach"  # default lowest role



# ---------------------------------------------------------------------------
# Cognito Triggers
# ---------------------------------------------------------------------------


def pre_authentication(event: Dict[str, Any]) -> Dict[str, Any]:
    """Cognito pre-authentication trigger.

    - Verify user status is active in the Users table.
    - If user is in SuperAdmins group, verify MFA is configured.
    - Deny authentication if user is inactive.
    """
    user_attributes = event.get("request", {}).get("userAttributes", {})
    cognito_user_id = user_attributes.get("sub", "")
    groups = event.get("request", {}).get("groupConfiguration", {}).get("groupsToOverride", []) or []

    _safe_log("Pre-authentication trigger", {"cognitoUserId": cognito_user_id})

    # Check user status in Users table
    if cognito_user_id:
        try:
            response = users_table.get_item(
                Key={"PK": f"USER#{cognito_user_id}", "SK": "PROFILE"}
            )
            user_record = response.get("Item")
            if user_record and user_record.get("status") == "inactive":
                raise Exception("User account is deactivated")
        except Exception as exc:
            if "deactivated" in str(exc):
                raise
            # If table lookup fails, allow authentication to proceed
            _safe_log("Users table lookup failed during pre-auth", {"cognitoUserId": cognito_user_id})

    # If user is in SuperAdmins group, verify MFA is configured
    if "SuperAdmins" in groups:
        preferred_mfa = user_attributes.get("preferred_mfa_setting", "")
        software_token = user_attributes.get("software_token_mfa_setting", "")
        if not preferred_mfa and not software_token:
            raise Exception(
                "MFA must be configured for Super Admin accounts"
            )

    # Return the event unchanged to allow authentication to proceed
    return event


def post_authentication(event: Dict[str, Any]) -> Dict[str, Any]:
    """Cognito post-authentication trigger.

    Sync user record to Users table (create or update):
    - PK: USER#{cognitoUserId}, SK: PROFILE
    - Fields: email, role (from Cognito groups), timestamp
    """
    user_attributes = event.get("request", {}).get("userAttributes", {})
    cognito_user_id = user_attributes.get("sub", "")
    email = user_attributes.get("email", "")
    groups = event.get("request", {}).get("groupConfiguration", {}).get("groupsToOverride", []) or []

    role = _resolve_role(groups)
    now = _now_iso()

    _safe_log("Post-authentication trigger", {"cognitoUserId": cognito_user_id, "role": role})

    try:
        # Upsert user record — preserve assignedChapters if they exist
        response = users_table.get_item(
            Key={"PK": f"USER#{cognito_user_id}", "SK": "PROFILE"}
        )
        existing = response.get("Item")
        assigned_chapters = existing.get("assignedChapters", []) if existing else []

        users_table.put_item(
            Item={
                "PK": f"USER#{cognito_user_id}",
                "SK": "PROFILE",
                "cognitoUserId": cognito_user_id,
                "email": email,
                "role": role,
                "assignedChapters": assigned_chapters,
                "status": "active",
                "createdAt": existing.get("createdAt", now) if existing else now,
                "updatedAt": now,
            }
        )
    except Exception as exc:
        _safe_log("Post-auth user sync failed", {"cognitoUserId": cognito_user_id, "error": str(exc)})
        # Don't block authentication on sync failure

    return event



# ---------------------------------------------------------------------------
# RBAC Middleware
# ---------------------------------------------------------------------------


def _extract_claims(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract JWT claims from the API Gateway request context.

    Returns None if no valid authorizer claims are present.
    """
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims")
    )
    return claims


def authorize(
    event: Dict[str, Any],
    required_role: str,
    resource: Optional[str] = None,
) -> Dict[str, Any]:
    """RBAC authorization middleware.

    Extracts user role from JWT claims (``cognito:groups``) and enforces
    the permission matrix.

    Returns a dict with ``cognitoUserId``, ``role``, and ``assignedChapters``.

    Raises:
        AuthorizationError: 401 for missing/invalid token, 403 for insufficient permissions.
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

    # Extract groups from claims
    groups_str = claims.get("cognito:groups", "")
    if isinstance(groups_str, str):
        groups = [g.strip() for g in groups_str.split(",") if g.strip()] if groups_str else []
    elif isinstance(groups_str, list):
        groups = groups_str
    else:
        groups = []

    user_role = _resolve_role(groups)

    # Check permission matrix
    _check_permission(user_role, required_role, cognito_user_id, resource)

    # Fetch assigned chapters from Users table for chapter-scoped checks
    assigned_chapters: List[str] = []
    try:
        response = users_table.get_item(
            Key={"PK": f"USER#{cognito_user_id}", "SK": "PROFILE"}
        )
        user_record = response.get("Item")
        if user_record:
            assigned_chapters = user_record.get("assignedChapters", [])
    except Exception:
        _safe_log("Failed to fetch user record for RBAC", {"cognitoUserId": cognito_user_id})

    return {
        "cognitoUserId": cognito_user_id,
        "role": user_role,
        "assignedChapters": assigned_chapters,
    }


def _check_permission(
    user_role: str,
    required_role: str,
    cognito_user_id: str,
    resource: Optional[str],
) -> None:
    """Enforce the RBAC permission matrix.

    Permission matrix:
    - Super_Admin  → full access to all resources
    - Chapter_Lead → manage assigned chapters + Content_Creator actions on own chapters
    - Content_Creator → edit content on assigned chapters only
    - Coach → read directory + update own profile only
    """
    # Super_Admin has full access
    if user_role == "Super_Admin":
        return

    user_rank = _ROLE_HIERARCHY.index(user_role) if user_role in _ROLE_HIERARCHY else len(_ROLE_HIERARCHY)
    required_rank = _ROLE_HIERARCHY.index(required_role) if required_role in _ROLE_HIERARCHY else 0

    # Chapter_Lead can perform Content_Creator actions
    if user_role == "Chapter_Lead" and required_role == "Content_Creator":
        return

    # Check role hierarchy
    if user_rank > required_rank:
        raise AuthorizationError("Insufficient permissions")

    # Coach can only update own profile
    if user_role == "Coach" and required_role == "Coach":
        if resource and resource != cognito_user_id:
            raise AuthorizationError("Insufficient permissions")
        return


def authorize_chapter_access(
    event: Dict[str, Any],
    required_role: str,
    chapter_id: str,
) -> Dict[str, Any]:
    """Authorize access to a specific chapter resource.

    Verifies the user has the required role AND is assigned to the chapter.
    Super_Admin bypasses chapter assignment checks.
    """
    auth_context = authorize(event, required_role)

    if auth_context["role"] == "Super_Admin":
        return auth_context

    if chapter_id not in auth_context.get("assignedChapters", []):
        raise AuthorizationError("Insufficient permissions")

    return auth_context



# ---------------------------------------------------------------------------
# User Management API Handlers
# ---------------------------------------------------------------------------


def list_users(event: Dict[str, Any]) -> Dict[str, Any]:
    """GET /users — list all users (Super_Admin only)."""
    authorize(event, "Super_Admin")

    try:
        response = users_table.scan(
            FilterExpression="SK = :sk",
            ExpressionAttributeValues={":sk": "PROFILE"},
        )
        items: List[Dict[str, Any]] = response.get("Items", [])

        while response.get("LastEvaluatedKey"):
            response = users_table.scan(
                FilterExpression="SK = :sk",
                ExpressionAttributeValues={":sk": "PROFILE"},
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        # Strip internal keys from response
        users = []
        for item in items:
            users.append({
                "cognitoUserId": item.get("cognitoUserId"),
                "email": item.get("email"),
                "role": item.get("role"),
                "assignedChapters": item.get("assignedChapters", []),
                "status": item.get("status", "active"),
                "createdAt": item.get("createdAt"),
            })

        return {"users": users}

    except AuthorizationError:
        raise
    except Exception as exc:
        _safe_log("List users failed", {"error": str(exc)})
        raise


def create_user(event: Dict[str, Any]) -> Dict[str, Any]:
    """POST /users — create user with role (Super_Admin, Chapter_Lead)."""
    auth_context = authorize(event, "Chapter_Lead")

    body = json.loads(event.get("body") or "{}")
    sanitized = validate_input(body, USER_SCHEMA)

    target_role = sanitized["role"]

    # Chapter_Lead can only create Content_Creator and Coach roles
    if auth_context["role"] == "Chapter_Lead" and target_role in ("Super_Admin", "Chapter_Lead"):
        raise AuthorizationError("Insufficient permissions")

    now = _now_iso()
    # Use email as a temporary cognito user id placeholder until Cognito sync
    cognito_user_id = sanitized["email"]

    user_item = {
        "PK": f"USER#{cognito_user_id}",
        "SK": "PROFILE",
        "cognitoUserId": cognito_user_id,
        "email": sanitized["email"],
        "role": target_role,
        "assignedChapters": sanitized.get("assignedChapters", []),
        "status": "active",
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        users_table.put_item(Item=user_item)
        _safe_log("User created", {"email": sanitized["email"], "role": target_role})
    except Exception as exc:
        _safe_log("Create user failed", {"error": str(exc)})
        raise

    return {
        "cognitoUserId": cognito_user_id,
        "email": sanitized["email"],
        "role": target_role,
        "status": "active",
    }


def change_user_role(event: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """PUT /users/{userId}/role — change user role (Super_Admin only)."""
    authorize(event, "Super_Admin")

    body = json.loads(event.get("body") or "{}")
    new_role = body.get("role")

    if not new_role or new_role not in VALID_ROLES:
        raise ValidationError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    now = _now_iso()

    try:
        response = users_table.update_item(
            Key={"PK": f"USER#{user_id}", "SK": "PROFILE"},
            UpdateExpression="SET #r = :role, #u = :now",
            ExpressionAttributeNames={"#r": "role", "#u": "updatedAt"},
            ExpressionAttributeValues={":role": new_role, ":now": now},
            ConditionExpression="attribute_exists(PK)",
            ReturnValues="ALL_NEW",
        )
        updated = response.get("Attributes", {})
        _safe_log("User role changed", {"userId": user_id, "newRole": new_role})

        return {
            "cognitoUserId": updated.get("cognitoUserId"),
            "email": updated.get("email"),
            "role": updated.get("role"),
            "status": updated.get("status"),
        }

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValidationError(f"User {user_id} not found")
    except AuthorizationError:
        raise
    except Exception as exc:
        _safe_log("Change role failed", {"userId": user_id, "error": str(exc)})
        raise


def deactivate_user(event: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """DELETE /users/{userId} — deactivate user (Super_Admin only)."""
    authorize(event, "Super_Admin")

    now = _now_iso()

    try:
        response = users_table.update_item(
            Key={"PK": f"USER#{user_id}", "SK": "PROFILE"},
            UpdateExpression="SET #s = :inactive, #u = :now",
            ExpressionAttributeNames={"#s": "status", "#u": "updatedAt"},
            ExpressionAttributeValues={":inactive": "inactive", ":now": now},
            ConditionExpression="attribute_exists(PK)",
            ReturnValues="ALL_NEW",
        )
        updated = response.get("Attributes", {})
        _safe_log("User deactivated", {"userId": user_id})

        return {
            "cognitoUserId": updated.get("cognitoUserId"),
            "email": updated.get("email"),
            "role": updated.get("role"),
            "status": "inactive",
        }

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValidationError(f"User {user_id} not found")
    except AuthorizationError:
        raise
    except Exception as exc:
        _safe_log("Deactivate user failed", {"userId": user_id, "error": str(exc)})
        raise



# ---------------------------------------------------------------------------
# Main handler — routes Cognito triggers and API Gateway events
# ---------------------------------------------------------------------------


def handler(event: dict, context: Any = None) -> Dict[str, Any]:
    """Route incoming events to the appropriate handler.

    Detection logic:
    - ``triggerSource`` present → Cognito trigger event
    - ``httpMethod`` present   → API Gateway proxy event
    """
    _safe_log("Auth handler invoked", {
        "triggerSource": event.get("triggerSource", ""),
        "httpMethod": event.get("httpMethod", ""),
        "path": event.get("path", ""),
    })

    # ── Cognito Trigger Events ─────────────────────────────────────────
    trigger_source = event.get("triggerSource")
    if trigger_source:
        if trigger_source == "PreAuthentication_Authentication":
            return pre_authentication(event)
        elif trigger_source == "PostAuthentication_Authentication":
            return post_authentication(event)
        else:
            _safe_log("Unknown trigger source", {"triggerSource": trigger_source})
            return event

    # ── API Gateway Events ─────────────────────────────────────────────
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}
    user_id = path_params.get("userId")

    try:
        # GET /users — list users
        if http_method == "GET" and path.rstrip("/") == "/users":
            result = list_users(event)
            return _json_response(200, result)

        # POST /users — create user
        if http_method == "POST" and path.rstrip("/") == "/users":
            result = create_user(event)
            return _json_response(201, result)

        # PUT /users/{userId}/role — change role
        if http_method == "PUT" and user_id and path.rstrip("/").endswith("/role"):
            result = change_user_role(event, user_id)
            return _json_response(200, result)

        # DELETE /users/{userId} — deactivate
        if http_method == "DELETE" and user_id:
            result = deactivate_user(event, user_id)
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
