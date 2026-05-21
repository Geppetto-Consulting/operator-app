# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from unittest import mock
from rest_framework import status
from rest_framework.test import APIClient
from uuid import uuid4

from plane.db.models import (
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.db.models.api import APIToken


@pytest.fixture(autouse=True)
def _stub_soft_delete_celery():
    """The base SoftDeleteModel.delete dispatches a Celery task via
    .delay(); tests run without a broker, so we no-op the dispatch.
    Mirrors what plane/tests/contract/api/test_labels.py would need
    if its delete test was reliable."""
    with mock.patch(
        "plane.db.mixins.soft_delete_related_objects.delay",
        return_value=None,
    ):
        yield


@pytest.fixture
def project(db, workspace, create_user):
    """Create a test project with the user as a member"""
    project = Project.objects.create(
        name="Test Project",
        identifier="TP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=create_user,
        role=20,  # Admin role
        is_active=True,
    )
    return project


@pytest.fixture
def page_data():
    """Sample page create payload"""
    return {
        "name": "Test Page",
        "description_html": "<p>hi</p>",
    }


@pytest.fixture
def create_page(db, project, create_user):
    """Create a page attached to the test project"""
    page = Page.objects.create(
        name="Existing Page",
        description_html="<p>existing</p>",
        workspace=project.workspace,
        owned_by=create_user,
        created_by=create_user,
    )
    ProjectPage.objects.create(
        project=project,
        page=page,
        workspace=project.workspace,
        created_by=create_user,
    )
    return page


def _pages_url(workspace_slug, project_id):
    return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/pages/"


def _page_detail_url(workspace_slug, project_id, page_id):
    return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/pages/{page_id}/"


@pytest.mark.contract
class TestPageListCreateAPIEndpoint:
    """Test Page List and Create API Endpoint"""

    @pytest.mark.django_db
    def test_create_page_success(self, api_key_client, workspace, project, page_data):
        """POST creates a page and attaches it to the project"""
        url = _pages_url(workspace.slug, project.id)
        response = api_key_client.post(url, page_data, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == page_data["name"]
        assert "<p>hi</p>" in response.data["description_html"]

        page = Page.objects.get(pk=response.data["id"])
        assert page.workspace_id == workspace.id
        # ProjectPage row created so the page is reachable from the project
        assert ProjectPage.objects.filter(page=page, project=project).exists()

    @pytest.mark.django_db
    def test_create_page_defaults_description(self, api_key_client, workspace, project):
        """POST without description_html defaults to <p></p>"""
        url = _pages_url(workspace.slug, project.id)
        response = api_key_client.post(url, {"name": "No body"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["description_html"] == "<p></p>"

    @pytest.mark.django_db
    def test_list_pages_returns_paginated(self, api_key_client, workspace, project, create_page):
        """GET returns paginated results that include the existing page"""
        # Add a second project page
        second = Page.objects.create(
            name="Second Page",
            workspace=workspace,
            owned_by=create_page.owned_by,
        )
        ProjectPage.objects.create(
            project=project,
            page=second,
            workspace=workspace,
        )

        url = _pages_url(workspace.slug, project.id)
        response = api_key_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        names = [p["name"] for p in response.data["results"]]
        assert "Existing Page" in names
        assert "Second Page" in names

    @pytest.mark.django_db
    def test_list_pages_filters_other_project(self, api_key_client, workspace, project, create_page, create_user):
        """A page attached only to a different project is NOT listed"""
        other_project = Project.objects.create(
            name="Other Project",
            identifier="OP",
            workspace=workspace,
            created_by=create_user,
        )
        ProjectMember.objects.create(
            project=other_project, member=create_user, role=20, is_active=True
        )
        other_page = Page.objects.create(
            name="Other Project Page",
            workspace=workspace,
            owned_by=create_user,
        )
        ProjectPage.objects.create(project=other_project, page=other_page, workspace=workspace)

        url = _pages_url(workspace.slug, project.id)
        response = api_key_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        names = [p["name"] for p in response.data["results"]]
        assert "Other Project Page" not in names

    @pytest.mark.django_db
    def test_create_page_external_id_conflict(self, api_key_client, workspace, project, create_user):
        """Re-using an (external_id, external_source) pair returns 409"""
        existing = Page.objects.create(
            name="Imported Page",
            workspace=workspace,
            owned_by=create_user,
            external_id="ext-1",
            external_source="github",
        )
        ProjectPage.objects.create(project=project, page=existing, workspace=workspace)

        url = _pages_url(workspace.slug, project.id)
        response = api_key_client.post(
            url,
            {
                "name": "Different",
                "external_id": "ext-1",
                "external_source": "github",
            },
            format="json",
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "same external id" in response.data["error"]


@pytest.mark.contract
class TestPageDetailAPIEndpoint:
    """Test Page Detail API Endpoint"""

    @pytest.mark.django_db
    def test_get_page_success(self, api_key_client, workspace, project, create_page):
        url = _page_detail_url(workspace.slug, project.id, create_page.id)
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == create_page.id
        assert response.data["name"] == create_page.name
        assert response.data["description_html"] == create_page.description_html

    @pytest.mark.django_db
    def test_get_page_not_found(self, api_key_client, workspace, project):
        url = _page_detail_url(workspace.slug, project.id, uuid4())
        response = api_key_client.get(url)
        # BaseAPIView translates ObjectDoesNotExist into 404
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.django_db
    def test_patch_page_updates_description(self, api_key_client, workspace, project, create_page):
        url = _page_detail_url(workspace.slug, project.id, create_page.id)
        response = api_key_client.patch(
            url,
            {"description_html": "<p>updated body</p>"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        create_page.refresh_from_db()
        assert "updated body" in create_page.description_html

    @pytest.mark.django_db
    def test_patch_page_locked_returns_400(self, api_key_client, workspace, project, create_page):
        create_page.is_locked = True
        create_page.save()
        url = _page_detail_url(workspace.slug, project.id, create_page.id)
        response = api_key_client.patch(url, {"name": "blocked"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "locked" in response.data["error"].lower()

    @pytest.mark.django_db
    def test_delete_page_success(self, api_key_client, workspace, project, create_page):
        url = _page_detail_url(workspace.slug, project.id, create_page.id)
        response = api_key_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Page.objects.filter(pk=create_page.id).exists()

        # Subsequent GET is 404
        response = api_key_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.contract
class TestPageAuth:
    """Auth + cross-workspace isolation"""

    @pytest.mark.django_db
    def test_no_api_key_returns_401(self, workspace, project):
        url = _pages_url(workspace.slug, project.id)
        # Fresh unauthenticated client
        unauth = APIClient()
        response = unauth.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_api_key_for_other_workspace_cannot_see_page(self, db, workspace, project, create_page):
        """An API key belonging to a different workspace gets 403/404 — not the page."""
        other_user = User.objects.create(
            email="other@plane.so",
            username=f"other-{uuid4().hex[:8]}",
        )
        other_user.set_password("pw")
        other_user.save()
        other_workspace = Workspace.objects.create(name="Other", owner=other_user, slug="other-ws")
        WorkspaceMember.objects.create(workspace=other_workspace, member=other_user, role=20)
        other_token = APIToken.objects.create(user=other_user, label="other-tok", token="other-api-key-9999")

        client = APIClient()
        client.credentials(HTTP_X_API_KEY=other_token.token)
        url = _page_detail_url(workspace.slug, project.id, create_page.id)
        response = client.get(url)
        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
