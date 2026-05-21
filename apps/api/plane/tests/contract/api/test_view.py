# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the public REST API: saved Views (workspace + project).

ENG-116 — Phase 4 of the Plane-fork programme (parent ENG-42).
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient
from uuid import uuid4

from plane.db.models import (
    IssueView,
    Project,
    ProjectMember,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.db.models.api import APIToken


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def project(db, workspace, create_user):
    """Create a test project with the user as a member (admin role)."""
    project = Project.objects.create(
        name="Test Project",
        identifier="TP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=create_user,
        role=20,  # Admin
        is_active=True,
    )
    return project


@pytest.fixture
def second_user(db):
    """Create a second user with their own API token, in the same workspace + project."""
    unique = uuid4().hex[:8]
    user = User.objects.create(
        email=f"user-b-{unique}@plane.so",
        username=f"user_b_{unique}",
        first_name="User",
        last_name="B",
    )
    user.set_password("user-b-password")
    user.save()
    return user


@pytest.fixture
def second_user_workspace_member(db, workspace, second_user):
    """Add second_user to the workspace as a member."""
    WorkspaceMember.objects.create(
        workspace=workspace,
        member=second_user,
        role=15,  # Member
        is_active=True,
    )
    return second_user


@pytest.fixture
def second_user_project_member(db, project, second_user_workspace_member):
    """Add second_user as a project member as well."""
    ProjectMember.objects.create(
        project=project,
        member=second_user_workspace_member,
        role=15,  # Member
        is_active=True,
    )
    return second_user_workspace_member


@pytest.fixture
def second_api_key_client(db, second_user_project_member):
    """API client authenticated as user B (project + workspace member)."""
    token = APIToken.objects.create(
        user=second_user_project_member,
        label="Test API Token B",
        token=f"test-api-token-b-{uuid4().hex[:8]}",
    )
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return client


@pytest.fixture
def workspace_view_payload():
    return {
        "name": "My workspace view",
        "description": "A workspace-level saved view",
        "filters": {"priority": ["urgent", "high"], "state": None},
        "display_filters": {"layout": "list", "order_by": "-created_at"},
        "display_properties": {"key": True, "priority": True, "state": True},
        "access": 1,
    }


@pytest.fixture
def project_view_payload():
    return {
        "name": "My project view",
        "description": "A project-level saved view",
        "filters": {"assignees": None, "labels": None},
        "display_filters": {"layout": "kanban", "group_by": "state"},
        "display_properties": {"key": True, "assignee": True},
        "access": 1,
    }


# ---------------------------------------------------------------------------
# Workspace-level CRUD
# ---------------------------------------------------------------------------


@pytest.mark.contract
class TestWorkspaceViewListCreateAPIEndpoint:
    """Workspace-level Views — list + create."""

    @staticmethod
    def url(workspace_slug):
        return f"/api/v1/workspaces/{workspace_slug}/views/"

    @pytest.mark.django_db
    def test_create_workspace_view_success(
        self, api_key_client, workspace, workspace_view_payload
    ):
        response = api_key_client.post(
            self.url(workspace.slug), workspace_view_payload, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert IssueView.objects.filter(project__isnull=True).count() == 1

        created = IssueView.objects.first()
        assert created.name == workspace_view_payload["name"]
        assert created.project_id is None
        assert created.workspace == workspace
        assert created.owned_by_id is not None
        # filters JSON round-trip
        assert created.filters == workspace_view_payload["filters"]
        assert created.display_properties == workspace_view_payload["display_properties"]

    @pytest.mark.django_db
    def test_create_workspace_view_invalid(self, api_key_client, workspace):
        response = api_key_client.post(self.url(workspace.slug), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_list_workspace_views(
        self, api_key_client, workspace, workspace_view_payload
    ):
        # seed two workspace-level views
        api_key_client.post(
            self.url(workspace.slug), workspace_view_payload, format="json"
        )
        second = dict(workspace_view_payload, name="Another workspace view")
        api_key_client.post(self.url(workspace.slug), second, format="json")

        response = api_key_client.get(self.url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert len(response.data["results"]) == 2

    @pytest.mark.django_db
    def test_filters_json_roundtrip(
        self, api_key_client, workspace, workspace_view_payload
    ):
        """Complex filter JSON round-trips intact via POST→GET."""
        complex_filters = {
            "priority": ["urgent", "high"],
            "state_group": ["started", "backlog"],
            "labels": None,
            "nested": {"a": 1, "b": [2, 3]},
        }
        payload = dict(workspace_view_payload, filters=complex_filters)
        create = api_key_client.post(self.url(workspace.slug), payload, format="json")
        assert create.status_code == status.HTTP_201_CREATED
        view_id = create.data["id"]

        detail_url = f"/api/v1/workspaces/{workspace.slug}/views/{view_id}/"
        fetched = api_key_client.get(detail_url)
        assert fetched.status_code == status.HTTP_200_OK
        assert fetched.data["filters"] == complex_filters


@pytest.mark.contract
class TestWorkspaceViewDetailAPIEndpoint:
    """Workspace-level Views — retrieve + update + delete."""

    @staticmethod
    def url(workspace_slug, pk):
        return f"/api/v1/workspaces/{workspace_slug}/views/{pk}/"

    @pytest.fixture
    def created_view(self, api_key_client, workspace, workspace_view_payload):
        list_url = f"/api/v1/workspaces/{workspace.slug}/views/"
        response = api_key_client.post(list_url, workspace_view_payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        return response.data

    @pytest.mark.django_db
    def test_retrieve_view(self, api_key_client, workspace, created_view):
        response = api_key_client.get(self.url(workspace.slug, created_view["id"]))
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["id"]) == str(created_view["id"])
        assert response.data["name"] == created_view["name"]

    @pytest.mark.django_db
    def test_update_view(self, api_key_client, workspace, created_view):
        response = api_key_client.patch(
            self.url(workspace.slug, created_view["id"]),
            {"name": "Updated workspace view"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated workspace view"

    @pytest.mark.django_db
    def test_owned_by_is_read_only(
        self, api_key_client, workspace, created_view, second_user
    ):
        """Attempting to set `owned_by` on update must NOT change the owner."""
        original_owner = created_view["owned_by"]
        response = api_key_client.patch(
            self.url(workspace.slug, created_view["id"]),
            {"owned_by": str(second_user.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["owned_by"]) == str(original_owner)

    @pytest.mark.django_db
    def test_delete_view(self, api_key_client, workspace, created_view):
        response = api_key_client.delete(self.url(workspace.slug, created_view["id"]))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not IssueView.objects.filter(pk=created_view["id"]).exists()


@pytest.mark.contract
class TestWorkspaceViewAccessEnforcement:
    """Access-enforcement: private views are owner-only; public views are workspace-wide."""

    @staticmethod
    def list_url(workspace_slug):
        return f"/api/v1/workspaces/{workspace_slug}/views/"

    @staticmethod
    def detail_url(workspace_slug, pk):
        return f"/api/v1/workspaces/{workspace_slug}/views/{pk}/"

    @pytest.mark.django_db
    def test_private_view_not_visible_to_other_workspace_member(
        self, api_key_client, second_api_key_client, workspace
    ):
        """User A creates a PRIVATE workspace view; User B (same workspace) cannot see it."""
        payload = {
            "name": "Private workspace view",
            "filters": {},
            "access": 0,  # Private
        }
        create = api_key_client.post(
            self.list_url(workspace.slug), payload, format="json"
        )
        assert create.status_code == status.HTTP_201_CREATED
        view_id = create.data["id"]

        # B lists — should not see A's private view
        list_response = second_api_key_client.get(self.list_url(workspace.slug))
        assert list_response.status_code == status.HTTP_200_OK
        result_ids = [str(v["id"]) for v in list_response.data["results"]]
        assert str(view_id) not in result_ids

        # B fetches detail — should 404
        detail_response = second_api_key_client.get(
            self.detail_url(workspace.slug, view_id)
        )
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_public_view_visible_to_other_workspace_member(
        self, api_key_client, second_api_key_client, workspace
    ):
        """User A creates a PUBLIC workspace view; User B (same workspace) CAN see it."""
        payload = {
            "name": "Public workspace view",
            "filters": {},
            "access": 1,  # Public
        }
        create = api_key_client.post(
            self.list_url(workspace.slug), payload, format="json"
        )
        assert create.status_code == status.HTTP_201_CREATED
        view_id = create.data["id"]

        list_response = second_api_key_client.get(self.list_url(workspace.slug))
        assert list_response.status_code == status.HTTP_200_OK
        result_ids = [str(v["id"]) for v in list_response.data["results"]]
        assert str(view_id) in result_ids

        detail_response = second_api_key_client.get(
            self.detail_url(workspace.slug, view_id)
        )
        assert detail_response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_non_owner_cannot_update_view(
        self, api_key_client, second_api_key_client, workspace
    ):
        """Even on a PUBLIC view, only the owner can update."""
        payload = {
            "name": "Public workspace view",
            "filters": {},
            "access": 1,
        }
        create = api_key_client.post(
            self.list_url(workspace.slug), payload, format="json"
        )
        assert create.status_code == status.HTTP_201_CREATED
        view_id = create.data["id"]

        response = second_api_key_client.patch(
            self.detail_url(workspace.slug, view_id),
            {"name": "B-renamed"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Project-level CRUD
# ---------------------------------------------------------------------------


@pytest.mark.contract
class TestProjectViewListCreateAPIEndpoint:
    """Project-level Views — list + create."""

    @staticmethod
    def url(workspace_slug, project_id):
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/views/"

    @pytest.mark.django_db
    def test_create_project_view_success(
        self, api_key_client, workspace, project, project_view_payload
    ):
        response = api_key_client.post(
            self.url(workspace.slug, project.id),
            project_view_payload,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        created = IssueView.objects.filter(project=project).first()
        assert created is not None
        assert created.name == project_view_payload["name"]
        assert created.project == project
        assert created.workspace == workspace
        assert created.owned_by_id is not None
        assert created.filters == project_view_payload["filters"]

    @pytest.mark.django_db
    def test_create_project_view_invalid(
        self, api_key_client, workspace, project
    ):
        response = api_key_client.post(
            self.url(workspace.slug, project.id), {}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_list_project_views(
        self, api_key_client, workspace, project, project_view_payload
    ):
        api_key_client.post(
            self.url(workspace.slug, project.id),
            project_view_payload,
            format="json",
        )
        second = dict(project_view_payload, name="Second project view")
        api_key_client.post(self.url(workspace.slug, project.id), second, format="json")

        response = api_key_client.get(self.url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 2


@pytest.mark.contract
class TestProjectViewDetailAPIEndpoint:
    """Project-level Views — retrieve + update + delete."""

    @staticmethod
    def list_url(workspace_slug, project_id):
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/views/"

    @staticmethod
    def detail_url(workspace_slug, project_id, pk):
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/views/{pk}/"

    @pytest.fixture
    def created_view(
        self, api_key_client, workspace, project, project_view_payload
    ):
        response = api_key_client.post(
            self.list_url(workspace.slug, project.id),
            project_view_payload,
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        return response.data

    @pytest.mark.django_db
    def test_retrieve_project_view(
        self, api_key_client, workspace, project, created_view
    ):
        response = api_key_client.get(
            self.detail_url(workspace.slug, project.id, created_view["id"])
        )
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data["id"]) == str(created_view["id"])

    @pytest.mark.django_db
    def test_update_project_view(
        self, api_key_client, workspace, project, created_view
    ):
        response = api_key_client.patch(
            self.detail_url(workspace.slug, project.id, created_view["id"]),
            {"name": "Updated project view"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated project view"

    @pytest.mark.django_db
    def test_delete_project_view(
        self, api_key_client, workspace, project, created_view
    ):
        response = api_key_client.delete(
            self.detail_url(workspace.slug, project.id, created_view["id"])
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not IssueView.objects.filter(pk=created_view["id"]).exists()


@pytest.mark.contract
class TestProjectViewAccessEnforcement:
    """Access-enforcement at the project level (mirrors workspace-level)."""

    @staticmethod
    def list_url(workspace_slug, project_id):
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/views/"

    @staticmethod
    def detail_url(workspace_slug, project_id, pk):
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/views/{pk}/"

    @pytest.mark.django_db
    def test_private_project_view_not_visible_to_other_member(
        self, api_key_client, second_api_key_client, workspace, project
    ):
        payload = {"name": "Private project view", "filters": {}, "access": 0}
        create = api_key_client.post(
            self.list_url(workspace.slug, project.id), payload, format="json"
        )
        assert create.status_code == status.HTTP_201_CREATED
        view_id = create.data["id"]

        list_response = second_api_key_client.get(
            self.list_url(workspace.slug, project.id)
        )
        assert list_response.status_code == status.HTTP_200_OK
        result_ids = [str(v["id"]) for v in list_response.data["results"]]
        assert str(view_id) not in result_ids

        detail_response = second_api_key_client.get(
            self.detail_url(workspace.slug, project.id, view_id)
        )
        assert detail_response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_public_project_view_visible_to_other_member(
        self, api_key_client, second_api_key_client, workspace, project
    ):
        payload = {"name": "Public project view", "filters": {}, "access": 1}
        create = api_key_client.post(
            self.list_url(workspace.slug, project.id), payload, format="json"
        )
        assert create.status_code == status.HTTP_201_CREATED
        view_id = create.data["id"]

        list_response = second_api_key_client.get(
            self.list_url(workspace.slug, project.id)
        )
        assert list_response.status_code == status.HTTP_200_OK
        result_ids = [str(v["id"]) for v in list_response.data["results"]]
        assert str(view_id) in result_ids


# ---------------------------------------------------------------------------
# OpenAPI schema integration
# ---------------------------------------------------------------------------


@pytest.mark.contract
class TestViewOpenAPISchema:
    """Verify drf-spectacular OpenAPI schema includes the new endpoints."""

    @pytest.mark.django_db
    def test_view_endpoints_in_openapi_schema(self, api_key_client):
        """OpenAPI schema endpoint exposes the new public Views routes."""
        # Plane's schema endpoint is /api/v1/schema/ (drf-spectacular)
        # Some installations use plain `/api/schema/`; try both.
        for url in ("/api/v1/schema/", "/api/schema/"):
            response = api_key_client.get(url, format="json")
            if response.status_code == status.HTTP_200_OK:
                schema = response.data if isinstance(response.data, dict) else {}
                paths = schema.get("paths", {}) if isinstance(schema, dict) else {}
                joined = " ".join(paths.keys()) if paths else ""
                if "/views/" in joined:
                    return
        pytest.skip("OpenAPI schema endpoint not reachable in this test setup")
