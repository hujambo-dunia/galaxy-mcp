"""Tests for Galaxy Pages (notebook/report) operations.

The page tools talk to Galaxy's /api/pages* REST endpoints directly (bioblend
has no Pages API), so the HTTP layer is stubbed with the `responses` library --
mirroring tests/test_job_operations.py.
"""

import json
from urllib.parse import parse_qs, urlparse

import pytest
import responses

from galaxy_mcp.server import galaxy_state
from tests.test_helpers import (
    create_page_fn,
    get_page_fn,
    get_page_revision_fn,
    list_page_revisions_fn,
    list_pages_fn,
    revert_page_revision_fn,
    update_page_fn,
)

BASE_URL = "http://localhost:8080/"


class TestPageOperations:
    def setup_method(self):
        galaxy_state["connected"] = True
        galaxy_state["gi"] = type("MockGI", (), {})()
        galaxy_state["url"] = BASE_URL
        galaxy_state["api_key"] = "test_key"

    def teardown_method(self):
        galaxy_state["connected"] = False
        galaxy_state["gi"] = None

    @responses.activate
    def test_list_pages(self):
        responses.add(
            responses.GET,
            f"{BASE_URL}api/pages",
            json=[
                {"id": "page1", "title": "Notebook 1", "history_id": "hist1"},
                {"id": "page2", "title": "Report 2", "history_id": None},
            ],
            headers={"total_matches": "5"},
            status=200,
        )

        result = list_pages_fn(limit=2, offset=0)

        assert result.success is True
        assert result.count == 2
        assert result.data[0]["id"] == "page1"
        # total_matches header is surfaced through pagination metadata
        assert result.pagination is not None
        assert result.pagination.total_items == 5
        assert result.pagination.has_next is True

        # REST index defaults (show_own/show_published) are wrong for an agent;
        # confirm we override them explicitly.
        query = parse_qs(urlparse(responses.calls[0].request.url).query)
        assert query["show_own"] == ["true"]
        assert query["show_published"] == ["false"]
        assert query["show_shared"] == ["false"]

    @responses.activate
    def test_list_pages_history_filter(self):
        responses.add(
            responses.GET,
            f"{BASE_URL}api/pages",
            json=[{"id": "page1", "title": "Notebook 1", "history_id": "hist1"}],
            headers={"total_matches": "1"},
            status=200,
        )

        result = list_pages_fn(history_id="hist1", show_published=True)

        assert result.count == 1
        query = parse_qs(urlparse(responses.calls[0].request.url).query)
        assert query["history_id"] == ["hist1"]
        assert query["show_published"] == ["true"]

    @responses.activate
    def test_get_page_strips_rendered_by_default(self):
        responses.add(
            responses.GET,
            f"{BASE_URL}api/pages/page1",
            json={
                "id": "page1",
                "title": "Notebook 1",
                "content": "<rendered html>",
                "content_editor": "raw markdown",
                "edit_source": "agent",
            },
            status=200,
        )

        result = get_page_fn("page1")

        assert result.success is True
        assert result.data["content_editor"] == "raw markdown"
        # The large rendered form is dropped unless explicitly requested.
        assert "content" not in result.data

    @responses.activate
    def test_get_page_include_rendered(self):
        responses.add(
            responses.GET,
            f"{BASE_URL}api/pages/page1",
            json={
                "id": "page1",
                "title": "Notebook 1",
                "content": "<rendered html>",
                "content_editor": "raw markdown",
            },
            status=200,
        )

        result = get_page_fn("page1", include_rendered=True)

        assert result.data["content"] == "<rendered html>"
        assert result.data["content_editor"] == "raw markdown"

    @responses.activate
    def test_create_notebook(self):
        responses.add(
            responses.POST,
            f"{BASE_URL}api/pages",
            json={
                "id": "page1",
                "title": "My History",
                "content": "<rendered>",
                "content_editor": "# notes",
            },
            status=200,
        )

        result = create_page_fn(history_id="hist1", content="# notes")

        assert result.success is True
        assert result.data["id"] == "page1"
        # create returns the editable form, not the rendered one
        assert "content" not in result.data

        sent = json.loads(responses.calls[0].request.body)
        assert sent["content_format"] == "markdown"
        assert sent["history_id"] == "hist1"
        assert sent["content"] == "# notes"

    @responses.activate
    def test_create_report(self):
        responses.add(
            responses.POST,
            f"{BASE_URL}api/pages",
            json={"id": "page9", "title": "My Report", "content_editor": ""},
            status=200,
        )

        result = create_page_fn(title="My Report", slug="my-report")

        assert result.data["id"] == "page9"
        sent = json.loads(responses.calls[0].request.body)
        assert sent["title"] == "My Report"
        assert sent["slug"] == "my-report"
        assert "history_id" not in sent

    @responses.activate
    def test_create_report_missing_slug_error(self):
        # Standalone reports require a unique slug; Galaxy rejects the request.
        responses.add(
            responses.POST,
            f"{BASE_URL}api/pages",
            json={"err_msg": "Slug is required for standalone pages"},
            status=400,
        )

        with pytest.raises(ValueError, match="Create page failed"):
            create_page_fn(title="My Report")

    @responses.activate
    def test_update_page_attributes_to_agent(self):
        responses.add(
            responses.PUT,
            f"{BASE_URL}api/pages/page1",
            json={
                "id": "page1",
                "title": "Notebook 1",
                "content": "<rendered>",
                "content_editor": "# updated",
            },
            status=200,
        )

        result = update_page_fn("page1", content="# updated")

        assert result.success is True
        assert "content" not in result.data
        sent = json.loads(responses.calls[0].request.body)
        assert sent["edit_source"] == "agent"
        assert sent["content"] == "# updated"

    @responses.activate
    def test_list_page_revisions(self):
        responses.add(
            responses.GET,
            f"{BASE_URL}api/pages/page1/revisions",
            json=[
                {"id": "rev1", "page_id": "page1", "edit_source": "user"},
                {"id": "rev2", "page_id": "page1", "edit_source": "agent"},
            ],
            status=200,
        )

        result = list_page_revisions_fn("page1", sort_desc=True)

        assert result.success is True
        assert result.count == 2
        assert result.data[1]["edit_source"] == "agent"
        query = parse_qs(urlparse(responses.calls[0].request.url).query)
        assert query["sort_desc"] == ["true"]

    @responses.activate
    def test_get_page_revision_strips_rendered(self):
        responses.add(
            responses.GET,
            f"{BASE_URL}api/pages/page1/revisions/rev1",
            json={
                "id": "rev1",
                "page_id": "page1",
                "content": "<rendered>",
                "content_editor": "raw md",
                "edit_source": "user",
            },
            status=200,
        )

        result = get_page_revision_fn("page1", "rev1")

        assert result.success is True
        assert "content" not in result.data
        assert result.data["edit_source"] == "user"

    @responses.activate
    def test_revert_page_revision(self):
        responses.add(
            responses.POST,
            f"{BASE_URL}api/pages/page1/revisions/rev1/revert",
            json={
                "id": "rev3",
                "page_id": "page1",
                "content": "<rendered>",
                "content_editor": "restored md",
                "edit_source": "restore",
            },
            status=200,
        )

        result = revert_page_revision_fn("page1", "rev1")

        assert result.success is True
        assert result.data["id"] == "rev3"
        assert result.data["edit_source"] == "restore"
        assert "content" not in result.data

    def test_list_pages_not_connected(self):
        galaxy_state["connected"] = False
        with pytest.raises(ValueError, match="Not connected to Galaxy"):
            list_pages_fn()
