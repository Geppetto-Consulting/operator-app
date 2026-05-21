# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# [ours: brand] Operator fork — ENG-114 / Phase 2 of the Plane-fork programme.
# Contract test for the per-workspace branding fields (brand_color +
# brand_name_override) added to the Workspace model. Verifies:
#   - Defaults: both fields persist as NULL on a fresh workspace.
#   - Serializer round-trip: PATCH the workspace via the app API, fields are
#     surfaced on GET, persisted on the model row.
#   - Reset semantics: PATCH with null clears the field; the brand_context
#     resolver then falls back to BRAND_CONTEXT_DEFAULTS.

import pytest
from rest_framework import status

from plane.db.models import Workspace
from plane.utils.brand_context import BRAND_CONTEXT_DEFAULTS, workspace_brand_context


@pytest.mark.contract
class TestWorkspaceBranding:
    """Contract tests for per-workspace brand overrides."""

    def detail_url(self, workspace_slug):
        # Workspace settings PATCH endpoint — same URL the General settings UI
        # writes to. WorkSpaceViewSet.partial_update routes here.
        return f"/api/workspaces/{workspace_slug}/"

    @pytest.mark.django_db
    def test_brand_fields_default_to_null_on_create(self, workspace):
        """A workspace created without brand_* values has them as NULL."""
        # The `workspace` fixture creates one directly via the model.
        # Re-fetch to be sure no setters fired side effects.
        ws = Workspace.objects.get(pk=workspace.pk)
        assert ws.brand_color is None
        assert ws.brand_name_override is None

    @pytest.mark.django_db
    def test_brand_fields_round_trip_through_patch(self, session_client, workspace):
        """PATCH workspace with brand overrides → values persist + surface on GET."""
        oklch_color = "oklch(0.5 0.2 28)"
        override = "Acme Operator"

        patch_response = session_client.patch(
            self.detail_url(workspace.slug),
            {"brand_color": oklch_color, "brand_name_override": override},
            format="json",
        )
        assert patch_response.status_code == status.HTTP_200_OK, (
            f"Got {patch_response.status_code}: {patch_response.data!r}"
        )
        assert patch_response.data["brand_color"] == oklch_color
        assert patch_response.data["brand_name_override"] == override

        # Persistence: hit the DB to rule out serializer caching.
        ws = Workspace.objects.get(pk=workspace.pk)
        assert ws.brand_color == oklch_color
        assert ws.brand_name_override == override

        # GET surfaces the same values.
        get_response = session_client.get(self.detail_url(workspace.slug))
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.data["brand_color"] == oklch_color
        assert get_response.data["brand_name_override"] == override

    @pytest.mark.django_db
    def test_brand_fields_reset_to_null(self, session_client, workspace):
        """Setting brand_color back to null clears the override."""
        # First set a value.
        session_client.patch(
            self.detail_url(workspace.slug),
            {"brand_color": "#1080bc", "brand_name_override": "Acme"},
            format="json",
        )
        # Then clear it.
        clear_response = session_client.patch(
            self.detail_url(workspace.slug),
            {"brand_color": None, "brand_name_override": None},
            format="json",
        )
        assert clear_response.status_code == status.HTTP_200_OK
        assert clear_response.data["brand_color"] is None
        assert clear_response.data["brand_name_override"] is None

        ws = Workspace.objects.get(pk=workspace.pk)
        assert ws.brand_color is None
        assert ws.brand_name_override is None

    @pytest.mark.django_db
    def test_workspace_brand_context_uses_defaults_when_unset(self, workspace):
        """workspace_brand_context() falls back to BRAND_CONTEXT_DEFAULTS when
        the per-workspace overrides are NULL (the operator-default code path)."""
        ws = Workspace.objects.get(pk=workspace.pk)
        ctx = workspace_brand_context(ws)
        assert ctx["brand_name"] == BRAND_CONTEXT_DEFAULTS["brand_name"]
        assert ctx["brand_color"] == BRAND_CONTEXT_DEFAULTS["brand_color"]
        # logo_url falls back to the BRAND_CONTEXT_DEFAULTS value, which is
        # None by default — meaning the email templates render the brand_name
        # text wordmark instead.
        assert ctx["brand_logo_url"] == BRAND_CONTEXT_DEFAULTS["brand_logo_url"]

    @pytest.mark.django_db
    def test_workspace_brand_context_uses_overrides_when_set(self, workspace):
        """workspace_brand_context() returns the per-workspace values when set."""
        workspace.brand_color = "oklch(0.7 0.15 145)"
        workspace.brand_name_override = "Acme Operator"
        workspace.save()
        ws = Workspace.objects.get(pk=workspace.pk)
        ctx = workspace_brand_context(ws)
        assert ctx["brand_name"] == "Acme Operator"
        assert ctx["brand_color"] == "oklch(0.7 0.15 145)"

    def test_workspace_brand_context_handles_none_workspace(self):
        """Callers (e.g. system emails not bound to a workspace) can pass None
        and receive an empty dict — safe to splat into render context."""
        assert workspace_brand_context(None) == {}
