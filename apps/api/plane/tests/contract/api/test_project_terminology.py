# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.
#
# [ours: terminology] Operator fork — ENG-118 / Phase 6.
# Contract test for the per-project terminology field. Verifies the
# round-trip via the public REST API: create with default empty dict, PATCH
# with the operator-shaped JSON, fetch back, assert exact equality.

import pytest
from rest_framework import status

from plane.db.models import Project


@pytest.mark.contract
class TestProjectTerminologyRoundTrip:
    """Contract tests for the Project.terminology JSON field (operator fork)."""

    def list_create_url(self, workspace_slug):
        return f"/api/v1/workspaces/{workspace_slug}/projects/"

    def detail_url(self, workspace_slug, project_id):
        return f"/api/v1/workspaces/{workspace_slug}/projects/{project_id}/"

    @pytest.mark.django_db
    def test_terminology_defaults_to_empty_dict_on_create(self, api_key_client, workspace, create_user):
        """A project created without terminology in the payload persists
        terminology = {} (the model default). Empty is the signal for the
        frontend hook to fall back to OPERATOR_DEFAULT_TERMINOLOGY."""
        payload = {
            "name": "Default Terminology Project",
            "identifier": "DT",
            "project_lead": str(create_user.id),
        }
        response = api_key_client.post(self.list_create_url(workspace.slug), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED, f"Got {response.status_code}: {response.data!r}"

        project = Project.objects.get(id=response.data["id"])
        assert project.terminology == {}
        # And the API serializer surfaces the field too.
        assert response.data.get("terminology") == {}

    @pytest.mark.django_db
    def test_terminology_round_trips_through_patch(self, api_key_client, workspace, create_user):
        """PATCH project with operator-shaped terminology JSON, then GET it
        back — the value must survive verbatim."""
        # Create with default empty terminology.
        create_payload = {
            "name": "Round Trip Project",
            "identifier": "RT",
            "project_lead": str(create_user.id),
        }
        create_response = api_key_client.post(
            self.list_create_url(workspace.slug), create_payload, format="json"
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        project_id = create_response.data["id"]

        # PATCH terminology.
        terminology = {
            "singular": "Contact",
            "plural": "Contacts",
            "verb_create": "Add contact",
        }
        patch_response = api_key_client.patch(
            self.detail_url(workspace.slug, project_id),
            {"terminology": terminology},
            format="json",
        )
        assert patch_response.status_code == status.HTTP_200_OK, (
            f"Got {patch_response.status_code}: {patch_response.data!r}"
        )
        assert patch_response.data["terminology"] == terminology

        # Persistence: hit the DB directly to rule out any serializer caching.
        project = Project.objects.get(id=project_id)
        assert project.terminology == terminology

        # Fetch via the API once more to confirm GET also returns it.
        get_response = api_key_client.get(self.detail_url(workspace.slug, project_id))
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.data["terminology"] == terminology

    @pytest.mark.django_db
    def test_terminology_accepts_partial_payload(self, api_key_client, workspace, create_user):
        """Partial overrides persist as written. Per-key fallback is the
        frontend hook's job — the backend stores exactly what was sent."""
        create_response = api_key_client.post(
            self.list_create_url(workspace.slug),
            {
                "name": "Partial Terminology Project",
                "identifier": "PT",
                "project_lead": str(create_user.id),
            },
            format="json",
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        project_id = create_response.data["id"]

        # Only override plural.
        partial = {"plural": "Briefings"}
        patch_response = api_key_client.patch(
            self.detail_url(workspace.slug, project_id),
            {"terminology": partial},
            format="json",
        )
        assert patch_response.status_code == status.HTTP_200_OK
        assert patch_response.data["terminology"] == partial
        assert Project.objects.get(id=project_id).terminology == partial
