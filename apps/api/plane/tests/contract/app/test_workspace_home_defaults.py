# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# [ours: workspace-brand] Operator fork — ENG-290 contract tests for the
# per-workspace home_widget_defaults field + the workspace-home preference
# seed pass that consumes it.
#
# Covers:
#   - Default: home_widget_defaults persists as {} on a fresh workspace.
#   - Seed (empty defaults): the GET endpoint seeds quick_links / recents /
#     my_stickies with is_enabled=True (Plane's stock behaviour) and skips
#     quick_tutorial + new_at_plane (no implemented component).
#   - Seed (populated defaults): is_enabled honors the workspace override —
#     stickies + recents come back disabled if the dict says so.
#   - Entry points: an extra widget key declared in home_widget_defaults but
#     NOT in the model's choice list gets seeded with the same override
#     semantics — this is the path the entry_points widget rides.
#   - Idempotency: calling GET twice does not duplicate rows or reshuffle
#     existing user preferences.

import pytest
from rest_framework import status

from plane.db.models import Workspace
from plane.db.models.workspace import WorkspaceHomePreference


@pytest.mark.contract
class TestWorkspaceHomeDefaults:
    """Contract tests for workspace-level Home widget defaults."""

    def url(self, workspace_slug):
        return f"/api/workspaces/{workspace_slug}/home-preferences/"

    @pytest.mark.django_db
    def test_default_is_empty_dict(self, workspace):
        """home_widget_defaults persists as `{}` on a fresh workspace."""
        ws = Workspace.objects.get(pk=workspace.pk)
        assert ws.home_widget_defaults == {}

    @pytest.mark.django_db
    def test_seed_with_empty_defaults_uses_plane_defaults(self, session_client, workspace):
        """Empty home_widget_defaults ⇒ standard Plane seeding: the 3 widgets
        with real components (quick_links/recents/my_stickies) are created
        with is_enabled=True; quick_tutorial + new_at_plane are skipped."""
        response = session_client.get(self.url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK, response.data

        keys_to_state = {row["key"]: row["is_enabled"] for row in response.data}
        assert "quick_links" in keys_to_state
        assert "recents" in keys_to_state
        assert "my_stickies" in keys_to_state
        assert keys_to_state["quick_links"] is True
        assert keys_to_state["recents"] is True
        assert keys_to_state["my_stickies"] is True
        # The two upstream placeholder widgets never get a preference row —
        # they have no implemented component on the frontend.
        assert "quick_tutorial" not in keys_to_state
        assert "new_at_plane" not in keys_to_state

    @pytest.mark.django_db
    def test_seed_honors_workspace_overrides(self, session_client, workspace):
        """Workspace can default stickies/recents OFF for new users via
        home_widget_defaults — the seed pass picks them up."""
        workspace.home_widget_defaults = {
            "recents": {"is_enabled": False},
            "my_stickies": {"is_enabled": False},
            "quick_links": {"is_enabled": False},
        }
        workspace.save(update_fields=["home_widget_defaults"])

        response = session_client.get(self.url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        keys_to_state = {row["key"]: row["is_enabled"] for row in response.data}
        assert keys_to_state["recents"] is False
        assert keys_to_state["my_stickies"] is False
        assert keys_to_state["quick_links"] is False

    @pytest.mark.django_db
    def test_seed_creates_entry_points_widget(self, session_client, workspace):
        """A workspace can declare entry_points (not in the model's choice
        list) via home_widget_defaults and have it seeded as enabled, with
        a sort_order high enough to render at the top of the Home page."""
        workspace.home_widget_defaults = {
            "entry_points": {
                "is_enabled": True,
                "cards": [
                    {"label": "Targets", "url": "/test-workspace/projects/abc/views/"},
                ],
            },
            "recents": {"is_enabled": False},
            "my_stickies": {"is_enabled": False},
        }
        workspace.save(update_fields=["home_widget_defaults"])

        response = session_client.get(self.url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        rows = {row["key"]: row for row in response.data}
        assert "entry_points" in rows
        assert rows["entry_points"]["is_enabled"] is True
        # entry_points pinned above the 1000-N range used for stock keys so
        # it renders at the top of the page when enabled.
        assert rows["entry_points"]["sort_order"] > 1000

    @pytest.mark.django_db
    def test_seed_is_idempotent(self, session_client, workspace):
        """Hitting the endpoint twice does not duplicate preference rows."""
        first = session_client.get(self.url(workspace.slug))
        assert first.status_code == status.HTTP_200_OK
        first_count = WorkspaceHomePreference.objects.filter(workspace=workspace).count()

        second = session_client.get(self.url(workspace.slug))
        assert second.status_code == status.HTTP_200_OK
        second_count = WorkspaceHomePreference.objects.filter(workspace=workspace).count()

        assert first_count == second_count
        # And the response shape is stable across calls.
        assert {row["key"] for row in first.data} == {row["key"] for row in second.data}

    @pytest.mark.django_db
    def test_seed_does_not_override_existing_user_toggles(
        self, session_client, workspace
    ):
        """Once a user has a preference row, subsequent workspace-default
        changes do NOT clobber it — user toggles win on existing rows. (The
        operator promotes new defaults by bulk-UPDATEing existing rows out-
        of-band; the seed pass only fills the gaps.)"""
        # First load — seeds with defaults (recents=True).
        session_client.get(self.url(workspace.slug))
        pref = WorkspaceHomePreference.objects.get(workspace=workspace, key="recents")
        assert pref.is_enabled is True

        # User flips recents off.
        pref.is_enabled = False
        pref.save(update_fields=["is_enabled"])

        # Workspace defaults change to is_enabled=True. The user's choice
        # must win on the next load — the seed pass only touches missing
        # keys, never existing rows.
        workspace.home_widget_defaults = {"recents": {"is_enabled": True}}
        workspace.save(update_fields=["home_widget_defaults"])
        response = session_client.get(self.url(workspace.slug))
        assert response.status_code == status.HTTP_200_OK
        keys_to_state = {row["key"]: row["is_enabled"] for row in response.data}
        assert keys_to_state["recents"] is False  # user's choice preserved
