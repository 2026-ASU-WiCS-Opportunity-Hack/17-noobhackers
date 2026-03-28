"""Unit tests for the chapter provisioning handler."""

from __future__ import annotations

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Ensure shared modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "lambda"))

# Set env vars before importing handler
os.environ.setdefault("CHAPTERS_TABLE", "wial-chapters")
os.environ.setdefault("PAGES_TABLE", "wial-pages")
os.environ.setdefault("ASSETS_BUCKET", "wial-platform-assets")
os.environ.setdefault("URL_MODE", "subdomain")
os.environ.setdefault("DOMAIN", "wial.org")
os.environ.setdefault("HOSTED_ZONE_ID", "")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_CHAPTER_BODY = {
    "chapterName": "WIAL USA",
    "slug": "usa",
    "region": "North America",
    "executiveDirectorEmail": "director@example.com",
}


def _api_event(method: str, body: dict | None = None, path_params: dict | None = None, path: str = "/chapters") -> dict:
    """Build a minimal API Gateway proxy event."""
    event: dict = {
        "httpMethod": method,
        "path": path,
        "pathParameters": path_params,
        "body": json.dumps(body) if body else None,
    }
    return event


# ---------------------------------------------------------------------------
# URL generation tests
# ---------------------------------------------------------------------------

class TestGenerateUrl:
    def test_subdomain_mode(self):
        from provisioning.handler import _generate_url

        with patch("provisioning.handler.URL_MODE", "subdomain"), \
             patch("provisioning.handler.DOMAIN", "wial.org"):
            assert _generate_url("usa") == "usa.wial.org"

    def test_subdirectory_mode(self):
        from provisioning.handler import _generate_url

        with patch("provisioning.handler.URL_MODE", "subdirectory"), \
             patch("provisioning.handler.DOMAIN", "wial.org"):
            assert _generate_url("usa") == "wial.org/usa"

    def test_subdomain_is_default(self):
        from provisioning.handler import _generate_url

        with patch("provisioning.handler.URL_MODE", "anything-else"), \
             patch("provisioning.handler.DOMAIN", "wial.org"):
            assert _generate_url("brazil") == "brazil.wial.org"


# ---------------------------------------------------------------------------
# Handler routing tests
# ---------------------------------------------------------------------------

class TestHandlerRouting:
    @patch("provisioning.handler.create_chapter")
    def test_post_chapters_calls_create(self, mock_create):
        from provisioning.handler import handler

        mock_create.return_value = {"chapterId": "abc", "url": "usa.wial.org", "status": "active"}
        resp = handler(_api_event("POST", body=VALID_CHAPTER_BODY))
        assert resp["statusCode"] == 201
        body = json.loads(resp["body"])
        assert body["chapterId"] == "abc"
        mock_create.assert_called_once()

    @patch("provisioning.handler.list_chapters")
    def test_get_chapters_calls_list(self, mock_list):
        from provisioning.handler import handler

        mock_list.return_value = {"chapters": []}
        resp = handler(_api_event("GET"))
        assert resp["statusCode"] == 200
        mock_list.assert_called_once()

    @patch("provisioning.handler.get_chapter")
    def test_get_chapter_by_id(self, mock_get):
        from provisioning.handler import handler

        mock_get.return_value = {"chapterId": "abc", "chapterName": "Test"}
        resp = handler(_api_event("GET", path_params={"chapterId": "abc"}, path="/chapters/abc"))
        assert resp["statusCode"] == 200
        mock_get.assert_called_once_with("abc")

    @patch("provisioning.handler.update_chapter")
    def test_put_chapter_calls_update(self, mock_update):
        from provisioning.handler import handler

        mock_update.return_value = {"chapterId": "abc", "chapterName": "Updated"}
        resp = handler(_api_event("PUT", body={"chapterName": "Updated"}, path_params={"chapterId": "abc"}))
        assert resp["statusCode"] == 200
        mock_update.assert_called_once()

    @patch("provisioning.handler.delete_chapter")
    def test_delete_chapter_calls_deactivate(self, mock_delete):
        from provisioning.handler import handler

        mock_delete.return_value = {"chapterId": "abc", "status": "inactive"}
        resp = handler(_api_event("DELETE", path_params={"chapterId": "abc"}))
        assert resp["statusCode"] == 200
        mock_delete.assert_called_once_with("abc")

    def test_unsupported_method_returns_400(self):
        from provisioning.handler import handler

        resp = handler(_api_event("PATCH"))
        assert resp["statusCode"] == 400

    def test_invalid_json_body_returns_400(self):
        from provisioning.handler import handler

        event = _api_event("POST")
        event["body"] = "not-json{{"
        resp = handler(event)
        assert resp["statusCode"] == 400
        body = json.loads(resp["body"])
        assert body["error"]["code"] == "INVALID_JSON"


# ---------------------------------------------------------------------------
# Validation error handling
# ---------------------------------------------------------------------------

class TestValidationErrors:
    @patch("provisioning.handler.chapters_table")
    def test_missing_required_field_returns_400(self, _mock_table):
        from provisioning.handler import handler

        incomplete = {"chapterName": "Test"}  # missing slug, region, email
        resp = handler(_api_event("POST", body=incomplete))
        assert resp["statusCode"] == 400
        body = json.loads(resp["body"])
        assert body["error"]["code"] == "VALIDATION_ERROR"

    @patch("provisioning.handler.chapters_table")
    def test_invalid_slug_pattern_returns_400(self, _mock_table):
        from provisioning.handler import handler

        bad_slug = {**VALID_CHAPTER_BODY, "slug": "UPPER CASE!"}
        resp = handler(_api_event("POST", body=bad_slug))
        assert resp["statusCode"] == 400


# ---------------------------------------------------------------------------
# create_chapter logic tests
# ---------------------------------------------------------------------------

class TestCreateChapter:
    @patch("provisioning.handler._create_core_pages")
    @patch("provisioning.handler._create_subdomain_record")
    @patch("provisioning.handler._copy_template_assets")
    @patch("provisioning.handler.chapters_table")
    def test_create_returns_active_chapter(self, mock_table, mock_copy, mock_dns, mock_pages):
        from provisioning.handler import create_chapter

        result = create_chapter(VALID_CHAPTER_BODY)
        assert result["status"] == "active"
        assert "chapterId" in result
        assert "url" in result
        mock_table.put_item.assert_called_once()
        mock_copy.assert_called_once()
        mock_pages.assert_called_once()

    @patch("provisioning.handler._create_core_pages")
    @patch("provisioning.handler._create_subdomain_record")
    @patch("provisioning.handler._copy_template_assets")
    @patch("provisioning.handler.chapters_table")
    def test_create_with_external_link(self, mock_table, mock_copy, mock_dns, mock_pages):
        from provisioning.handler import create_chapter

        body = {**VALID_CHAPTER_BODY, "externalLink": "https://affiliate.example.com"}
        result = create_chapter(body)
        assert result["status"] == "active"
        # Verify the put_item call includes externalLink
        call_args = mock_table.put_item.call_args
        item = call_args[1]["Item"] if "Item" in call_args[1] else call_args[0][0]
        assert item.get("externalLink") == "https://affiliate.example.com"

    @patch("provisioning.handler._create_core_pages")
    @patch("provisioning.handler._copy_template_assets")
    @patch("provisioning.handler.chapters_table")
    def test_create_url_subdomain_mode(self, mock_table, mock_copy, mock_pages):
        from provisioning.handler import create_chapter

        with patch("provisioning.handler.URL_MODE", "subdomain"), \
             patch("provisioning.handler.DOMAIN", "wial.org"), \
             patch("provisioning.handler.HOSTED_ZONE_ID", ""):
            result = create_chapter(VALID_CHAPTER_BODY)
            assert result["url"] == "usa.wial.org"

    @patch("provisioning.handler._create_core_pages")
    @patch("provisioning.handler._copy_template_assets")
    @patch("provisioning.handler.chapters_table")
    def test_create_url_subdirectory_mode(self, mock_table, mock_copy, mock_pages):
        from provisioning.handler import create_chapter

        with patch("provisioning.handler.URL_MODE", "subdirectory"), \
             patch("provisioning.handler.DOMAIN", "wial.org"), \
             patch("provisioning.handler.HOSTED_ZONE_ID", ""):
            result = create_chapter(VALID_CHAPTER_BODY)
            assert result["url"] == "wial.org/usa"

    @patch("provisioning.handler.chapters_table")
    def test_create_dynamo_failure_raises_provisioning_error(self, mock_table):
        from provisioning.handler import create_chapter
        from shared.exceptions import ProvisioningError

        mock_table.put_item.side_effect = Exception("DynamoDB unavailable")
        with pytest.raises(ProvisioningError, match="Failed to create chapter"):
            create_chapter(VALID_CHAPTER_BODY)


# ---------------------------------------------------------------------------
# Core pages creation
# ---------------------------------------------------------------------------

class TestCorePages:
    def test_core_pages_count_is_six(self):
        from shared.models import CORE_PAGES
        assert len(CORE_PAGES) == 6

    def test_core_pages_slugs(self):
        from shared.models import CORE_PAGES
        expected = {"about", "coach-directory", "events", "team", "resources", "contact"}
        assert set(CORE_PAGES) == expected
