"""Unit tests for the auth handler — Cognito triggers, RBAC, and user management."""

from __future__ import annotations

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Ensure shared modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "lambda"))

os.environ.setdefault("USERS_TABLE", "wial-users")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cognito_event(
    trigger_source: str,
    sub: str = "user-123",
    email: str = "user@example.com",
    groups: list | None = None,
    extra_attrs: dict | None = None,
) -> dict:
    """Build a minimal Cognito trigger event."""
    attrs = {"sub": sub, "email": email}
    if extra_attrs:
        attrs.update(extra_attrs)
    return {
        "triggerSource": trigger_source,
        "request": {
            "userAttributes": attrs,
            "groupConfiguration": {
                "groupsToOverride": groups or [],
            },
        },
        "response": {},
    }


def _api_event(
    method: str,
    path: str = "/users",
    body: dict | None = None,
    path_params: dict | None = None,
    groups: str = "SuperAdmins",
    sub: str = "admin-001",
) -> dict:
    """Build a minimal API Gateway proxy event with Cognito authorizer claims."""
    return {
        "httpMethod": method,
        "path": path,
        "pathParameters": path_params,
        "body": json.dumps(body) if body else None,
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": sub,
                    "cognito:groups": groups,
                },
            },
        },
    }


def _api_event_no_auth(method: str, path: str = "/users", body: dict | None = None) -> dict:
    """Build an API Gateway event with no authorizer claims."""
    return {
        "httpMethod": method,
        "path": path,
        "pathParameters": None,
        "body": json.dumps(body) if body else None,
        "requestContext": {},
    }



# ---------------------------------------------------------------------------
# Role resolution tests
# ---------------------------------------------------------------------------


class TestResolveRole:
    def test_super_admin_group(self):
        from auth.handler import _resolve_role
        assert _resolve_role(["SuperAdmins"]) == "Super_Admin"

    def test_chapter_lead_group(self):
        from auth.handler import _resolve_role
        assert _resolve_role(["ChapterLeads"]) == "Chapter_Lead"

    def test_content_creator_group(self):
        from auth.handler import _resolve_role
        assert _resolve_role(["ContentCreators"]) == "Content_Creator"

    def test_coaches_group(self):
        from auth.handler import _resolve_role
        assert _resolve_role(["Coaches"]) == "Coach"

    def test_multiple_groups_returns_highest_privilege(self):
        from auth.handler import _resolve_role
        assert _resolve_role(["Coaches", "ChapterLeads"]) == "Chapter_Lead"

    def test_empty_groups_defaults_to_coach(self):
        from auth.handler import _resolve_role
        assert _resolve_role([]) == "Coach"

    def test_unknown_group_defaults_to_coach(self):
        from auth.handler import _resolve_role
        assert _resolve_role(["UnknownGroup"]) == "Coach"


# ---------------------------------------------------------------------------
# Group-to-role mapping tests
# ---------------------------------------------------------------------------


class TestGroupRoleMapping:
    def test_all_groups_mapped(self):
        from auth.handler import GROUP_TO_ROLE
        assert GROUP_TO_ROLE == {
            "SuperAdmins": "Super_Admin",
            "ChapterLeads": "Chapter_Lead",
            "ContentCreators": "Content_Creator",
            "Coaches": "Coach",
        }

    def test_reverse_mapping(self):
        from auth.handler import ROLE_TO_GROUP
        assert ROLE_TO_GROUP["Super_Admin"] == "SuperAdmins"
        assert ROLE_TO_GROUP["Coach"] == "Coaches"



# ---------------------------------------------------------------------------
# Pre-authentication trigger tests
# ---------------------------------------------------------------------------


class TestPreAuthentication:
    @patch("auth.handler.users_table")
    def test_active_user_passes(self, mock_table):
        from auth.handler import pre_authentication

        mock_table.get_item.return_value = {
            "Item": {"status": "active", "cognitoUserId": "user-123"}
        }
        event = _cognito_event("PreAuthentication_Authentication")
        result = pre_authentication(event)
        assert result is event  # event returned unchanged

    @patch("auth.handler.users_table")
    def test_inactive_user_denied(self, mock_table):
        from auth.handler import pre_authentication

        mock_table.get_item.return_value = {
            "Item": {"status": "inactive", "cognitoUserId": "user-123"}
        }
        event = _cognito_event("PreAuthentication_Authentication")
        with pytest.raises(Exception, match="User account is deactivated"):
            pre_authentication(event)

    @patch("auth.handler.users_table")
    def test_new_user_no_record_passes(self, mock_table):
        from auth.handler import pre_authentication

        mock_table.get_item.return_value = {}  # no Item
        event = _cognito_event("PreAuthentication_Authentication")
        result = pre_authentication(event)
        assert result is event

    @patch("auth.handler.users_table")
    def test_super_admin_without_mfa_denied(self, mock_table):
        from auth.handler import pre_authentication

        mock_table.get_item.return_value = {
            "Item": {"status": "active", "cognitoUserId": "user-123"}
        }
        event = _cognito_event(
            "PreAuthentication_Authentication",
            groups=["SuperAdmins"],
        )
        with pytest.raises(Exception, match="MFA must be configured"):
            pre_authentication(event)

    @patch("auth.handler.users_table")
    def test_super_admin_with_mfa_passes(self, mock_table):
        from auth.handler import pre_authentication

        mock_table.get_item.return_value = {
            "Item": {"status": "active", "cognitoUserId": "user-123"}
        }
        event = _cognito_event(
            "PreAuthentication_Authentication",
            groups=["SuperAdmins"],
            extra_attrs={"preferred_mfa_setting": "SOFTWARE_TOKEN_MFA"},
        )
        result = pre_authentication(event)
        assert result is event


# ---------------------------------------------------------------------------
# Post-authentication trigger tests
# ---------------------------------------------------------------------------


class TestPostAuthentication:
    @patch("auth.handler.users_table")
    def test_creates_new_user_record(self, mock_table):
        from auth.handler import post_authentication

        mock_table.get_item.return_value = {}  # no existing record
        event = _cognito_event(
            "PostAuthentication_Authentication",
            groups=["ChapterLeads"],
        )
        result = post_authentication(event)
        assert result is event
        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args[1]["Item"]
        assert item["PK"] == "USER#user-123"
        assert item["SK"] == "PROFILE"
        assert item["role"] == "Chapter_Lead"
        assert item["email"] == "user@example.com"
        assert item["status"] == "active"

    @patch("auth.handler.users_table")
    def test_preserves_assigned_chapters_on_update(self, mock_table):
        from auth.handler import post_authentication

        mock_table.get_item.return_value = {
            "Item": {
                "assignedChapters": ["ch-1", "ch-2"],
                "createdAt": "2024-01-01T00:00:00+00:00",
            }
        }
        event = _cognito_event(
            "PostAuthentication_Authentication",
            groups=["ChapterLeads"],
        )
        post_authentication(event)
        item = mock_table.put_item.call_args[1]["Item"]
        assert item["assignedChapters"] == ["ch-1", "ch-2"]
        assert item["createdAt"] == "2024-01-01T00:00:00+00:00"

    @patch("auth.handler.users_table")
    def test_sync_failure_does_not_block_auth(self, mock_table):
        from auth.handler import post_authentication

        mock_table.get_item.side_effect = Exception("DynamoDB down")
        event = _cognito_event("PostAuthentication_Authentication")
        result = post_authentication(event)
        assert result is event  # should not raise



# ---------------------------------------------------------------------------
# RBAC authorize tests
# ---------------------------------------------------------------------------


class TestAuthorize:
    @patch("auth.handler.users_table")
    def test_super_admin_full_access(self, mock_table):
        from auth.handler import authorize

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("GET", groups="SuperAdmins", sub="admin-001")
        result = authorize(event, "Super_Admin")
        assert result["role"] == "Super_Admin"
        assert result["cognitoUserId"] == "admin-001"

    @patch("auth.handler.users_table")
    def test_chapter_lead_can_act_as_content_creator(self, mock_table):
        from auth.handler import authorize

        mock_table.get_item.return_value = {"Item": {"assignedChapters": ["ch-1"]}}
        event = _api_event("PUT", groups="ChapterLeads", sub="lead-001")
        result = authorize(event, "Content_Creator")
        assert result["role"] == "Chapter_Lead"

    @patch("auth.handler.users_table")
    def test_coach_cannot_access_admin(self, mock_table):
        from auth.handler import authorize
        from shared.exceptions import AuthorizationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("GET", groups="Coaches", sub="coach-001")
        with pytest.raises(AuthorizationError, match="Insufficient permissions"):
            authorize(event, "Super_Admin")

    @patch("auth.handler.users_table")
    def test_content_creator_cannot_access_chapter_lead(self, mock_table):
        from auth.handler import authorize
        from shared.exceptions import AuthorizationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("GET", groups="ContentCreators", sub="cc-001")
        with pytest.raises(AuthorizationError, match="Insufficient permissions"):
            authorize(event, "Chapter_Lead")

    def test_missing_claims_returns_401(self):
        from auth.handler import authorize
        from shared.exceptions import AuthorizationError

        event = _api_event_no_auth("GET")
        with pytest.raises(AuthorizationError) as exc_info:
            authorize(event, "Super_Admin")
        assert exc_info.value.status_code == 401

    def test_missing_sub_returns_401(self):
        from auth.handler import authorize
        from shared.exceptions import AuthorizationError

        event = {
            "httpMethod": "GET",
            "path": "/users",
            "requestContext": {
                "authorizer": {"claims": {"cognito:groups": "SuperAdmins"}},
            },
        }
        with pytest.raises(AuthorizationError) as exc_info:
            authorize(event, "Super_Admin")
        assert exc_info.value.status_code == 401

    @patch("auth.handler.users_table")
    def test_coach_can_access_own_profile(self, mock_table):
        from auth.handler import authorize

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("PUT", groups="Coaches", sub="coach-001")
        result = authorize(event, "Coach", resource="coach-001")
        assert result["role"] == "Coach"

    @patch("auth.handler.users_table")
    def test_coach_cannot_access_other_profile(self, mock_table):
        from auth.handler import authorize
        from shared.exceptions import AuthorizationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("PUT", groups="Coaches", sub="coach-001")
        with pytest.raises(AuthorizationError, match="Insufficient permissions"):
            authorize(event, "Coach", resource="coach-999")


# ---------------------------------------------------------------------------
# Chapter access authorization tests
# ---------------------------------------------------------------------------


class TestAuthorizeChapterAccess:
    @patch("auth.handler.users_table")
    def test_super_admin_bypasses_chapter_check(self, mock_table):
        from auth.handler import authorize_chapter_access

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("PUT", groups="SuperAdmins", sub="admin-001")
        result = authorize_chapter_access(event, "Chapter_Lead", "any-chapter")
        assert result["role"] == "Super_Admin"

    @patch("auth.handler.users_table")
    def test_chapter_lead_assigned_chapter_passes(self, mock_table):
        from auth.handler import authorize_chapter_access

        mock_table.get_item.return_value = {"Item": {"assignedChapters": ["ch-1"]}}
        event = _api_event("PUT", groups="ChapterLeads", sub="lead-001")
        result = authorize_chapter_access(event, "Chapter_Lead", "ch-1")
        assert result["role"] == "Chapter_Lead"

    @patch("auth.handler.users_table")
    def test_chapter_lead_unassigned_chapter_denied(self, mock_table):
        from auth.handler import authorize_chapter_access
        from shared.exceptions import AuthorizationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": ["ch-1"]}}
        event = _api_event("PUT", groups="ChapterLeads", sub="lead-001")
        with pytest.raises(AuthorizationError, match="Insufficient permissions"):
            authorize_chapter_access(event, "Chapter_Lead", "ch-999")



# ---------------------------------------------------------------------------
# Handler routing tests
# ---------------------------------------------------------------------------


class TestHandlerRouting:
    @patch("auth.handler.pre_authentication")
    def test_pre_auth_trigger_routed(self, mock_pre):
        from auth.handler import handler

        mock_pre.return_value = {"some": "event"}
        event = _cognito_event("PreAuthentication_Authentication")
        result = handler(event)
        mock_pre.assert_called_once_with(event)

    @patch("auth.handler.post_authentication")
    def test_post_auth_trigger_routed(self, mock_post):
        from auth.handler import handler

        mock_post.return_value = {"some": "event"}
        event = _cognito_event("PostAuthentication_Authentication")
        result = handler(event)
        mock_post.assert_called_once_with(event)

    def test_unknown_trigger_returns_event(self):
        from auth.handler import handler

        event = _cognito_event("CustomMessage_SignUp")
        result = handler(event)
        assert result is event

    @patch("auth.handler.list_users")
    def test_get_users_routed(self, mock_list):
        from auth.handler import handler

        mock_list.return_value = {"users": []}
        event = _api_event("GET", path="/users")
        resp = handler(event)
        assert resp["statusCode"] == 200
        mock_list.assert_called_once()

    @patch("auth.handler.create_user")
    def test_post_users_routed(self, mock_create):
        from auth.handler import handler

        mock_create.return_value = {"cognitoUserId": "x", "email": "a@b.com", "role": "Coach", "status": "active"}
        event = _api_event("POST", path="/users", body={"email": "a@b.com", "role": "Coach"})
        resp = handler(event)
        assert resp["statusCode"] == 201
        mock_create.assert_called_once()

    @patch("auth.handler.change_user_role")
    def test_put_role_routed(self, mock_change):
        from auth.handler import handler

        mock_change.return_value = {"cognitoUserId": "u1", "role": "Chapter_Lead"}
        event = _api_event(
            "PUT",
            path="/users/u1/role",
            path_params={"userId": "u1"},
            body={"role": "Chapter_Lead"},
        )
        resp = handler(event)
        assert resp["statusCode"] == 200
        mock_change.assert_called_once()

    @patch("auth.handler.deactivate_user")
    def test_delete_user_routed(self, mock_deactivate):
        from auth.handler import handler

        mock_deactivate.return_value = {"cognitoUserId": "u1", "status": "inactive"}
        event = _api_event("DELETE", path="/users/u1", path_params={"userId": "u1"})
        resp = handler(event)
        assert resp["statusCode"] == 200
        mock_deactivate.assert_called_once()

    def test_unsupported_method_returns_400(self):
        from auth.handler import handler

        event = _api_event("PATCH", path="/users")
        resp = handler(event)
        assert resp["statusCode"] == 400

    def test_auth_error_returns_proper_status(self):
        from auth.handler import handler

        event = _api_event_no_auth("GET", path="/users")
        resp = handler(event)
        assert resp["statusCode"] in (401, 403)

    def test_invalid_json_body_returns_400(self):
        from auth.handler import handler

        event = _api_event("POST", path="/users")
        event["body"] = "not-json{{"
        # Need valid auth claims for this to reach JSON parsing
        resp = handler(event)
        assert resp["statusCode"] == 400


# ---------------------------------------------------------------------------
# User management API tests
# ---------------------------------------------------------------------------


class TestListUsers:
    @patch("auth.handler.users_table")
    def test_returns_user_list(self, mock_table):
        from auth.handler import list_users

        mock_table.scan.return_value = {
            "Items": [
                {
                    "PK": "USER#u1",
                    "SK": "PROFILE",
                    "cognitoUserId": "u1",
                    "email": "admin@example.com",
                    "role": "Super_Admin",
                    "assignedChapters": [],
                    "status": "active",
                    "createdAt": "2024-01-01T00:00:00+00:00",
                }
            ]
        }
        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("GET", groups="SuperAdmins")
        result = list_users(event)
        assert len(result["users"]) == 1
        assert result["users"][0]["email"] == "admin@example.com"

    @patch("auth.handler.users_table")
    def test_non_admin_denied(self, mock_table):
        from auth.handler import list_users
        from shared.exceptions import AuthorizationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("GET", groups="Coaches", sub="coach-001")
        with pytest.raises(AuthorizationError):
            list_users(event)


class TestCreateUser:
    @patch("auth.handler.users_table")
    def test_super_admin_creates_any_role(self, mock_table):
        from auth.handler import create_user

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("POST", groups="SuperAdmins", body={"email": "new@example.com", "role": "Chapter_Lead"})
        result = create_user(event)
        assert result["role"] == "Chapter_Lead"
        assert result["status"] == "active"
        mock_table.put_item.assert_called_once()

    @patch("auth.handler.users_table")
    def test_chapter_lead_cannot_create_admin(self, mock_table):
        from auth.handler import create_user
        from shared.exceptions import AuthorizationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": ["ch-1"]}}
        event = _api_event("POST", groups="ChapterLeads", sub="lead-001", body={"email": "x@y.com", "role": "Super_Admin"})
        with pytest.raises(AuthorizationError, match="Insufficient permissions"):
            create_user(event)

    @patch("auth.handler.users_table")
    def test_chapter_lead_can_create_coach(self, mock_table):
        from auth.handler import create_user

        mock_table.get_item.return_value = {"Item": {"assignedChapters": ["ch-1"]}}
        event = _api_event("POST", groups="ChapterLeads", sub="lead-001", body={"email": "coach@example.com", "role": "Coach"})
        result = create_user(event)
        assert result["role"] == "Coach"

    @patch("auth.handler.users_table")
    def test_invalid_input_returns_validation_error(self, mock_table):
        from auth.handler import create_user
        from shared.exceptions import ValidationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("POST", groups="SuperAdmins", body={"email": "bad"})
        with pytest.raises(ValidationError):
            create_user(event)


class TestChangeUserRole:
    @patch("auth.handler.users_table")
    def test_changes_role_successfully(self, mock_table):
        from auth.handler import change_user_role

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        mock_table.update_item.return_value = {
            "Attributes": {
                "cognitoUserId": "u1",
                "email": "user@example.com",
                "role": "Content_Creator",
                "status": "active",
            }
        }
        event = _api_event("PUT", groups="SuperAdmins", body={"role": "Content_Creator"})
        result = change_user_role(event, "u1")
        assert result["role"] == "Content_Creator"

    @patch("auth.handler.users_table")
    def test_invalid_role_rejected(self, mock_table):
        from auth.handler import change_user_role
        from shared.exceptions import ValidationError

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        event = _api_event("PUT", groups="SuperAdmins", body={"role": "InvalidRole"})
        with pytest.raises(ValidationError, match="Invalid role"):
            change_user_role(event, "u1")


class TestDeactivateUser:
    @patch("auth.handler.users_table")
    def test_deactivates_user(self, mock_table):
        from auth.handler import deactivate_user

        mock_table.get_item.return_value = {"Item": {"assignedChapters": []}}
        mock_table.update_item.return_value = {
            "Attributes": {
                "cognitoUserId": "u1",
                "email": "user@example.com",
                "role": "Coach",
                "status": "inactive",
            }
        }
        event = _api_event("DELETE", groups="SuperAdmins")
        result = deactivate_user(event, "u1")
        assert result["status"] == "inactive"
