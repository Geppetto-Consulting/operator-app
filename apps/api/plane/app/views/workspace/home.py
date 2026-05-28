# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from ..base import BaseAPIView
from plane.db.models.workspace import WorkspaceHomePreference
from plane.app.permissions import allow_permission, ROLE
from plane.db.models import Workspace
from plane.app.serializers.workspace import WorkspaceHomePreferenceSerializer

# Third party imports
from rest_framework.response import Response
from rest_framework import status


# [ours: workspace-brand] ENG-290 — keys that are never seeded by the view
# layer. quick_tutorial + new_at_plane are upstream placeholders with no
# implemented component (HOME_WIDGETS_LIST sets component: null) so seeding
# them just clutters the manage-widgets list.
SKIP_SEED_KEYS = {"quick_tutorial", "new_at_plane"}


class WorkspaceHomePreferenceViewSet(BaseAPIView):
    model = WorkspaceHomePreference

    def get_serializer_class(self):
        return WorkspaceHomePreferenceSerializer

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        workspace = Workspace.objects.get(slug=slug)

        # [ours: workspace-brand] ENG-290 — workspace-level overrides.
        # Shape: { "<widget_key>": {"is_enabled": bool, ...}, ... }.
        # Empty dict ⇒ fall back to Plane's stock seeding (all widgets
        # enabled by default; user toggles them off via the manage UI).
        widget_defaults = workspace.home_widget_defaults or {}
        if not isinstance(widget_defaults, dict):
            widget_defaults = {}

        # Existing preference rows keyed by widget key — used both to skip
        # rows we already seeded for this user, and to fold the workspace
        # override into the returned `is_enabled` so a fresh load reflects
        # the workspace's intent without waiting on the create roundtrip.
        existing_prefs = list(
            WorkspaceHomePreference.objects.filter(
                user=request.user, workspace_id=workspace.id
            ).values_list("key", flat=True)
        )
        existing_keys = set(existing_prefs)

        # Candidate keys: union of (a) the model's choice list minus the
        # never-seed keys, and (b) any extra keys the workspace explicitly
        # configured via home_widget_defaults — that way a workspace can
        # surface a custom widget (entry_points) without us bumping the
        # choice list every time we add one.
        choice_keys = [
            key
            for key, _ in WorkspaceHomePreference.HomeWidgetKeys.choices
            if key not in SKIP_SEED_KEYS
        ]
        extra_keys = [
            key
            for key in widget_defaults.keys()
            if isinstance(key, str)
            and key not in choice_keys
            and key not in SKIP_SEED_KEYS
        ]
        candidate_keys = choice_keys + extra_keys

        # Build the rows we need to create. Sort order grants entry_points
        # the highest visual priority when present (it's the "pick where to
        # start" landing) and otherwise mirrors upstream's 1000-N decreasing
        # order so existing workspaces don't see their widget ordering
        # rearranged on next load.
        to_create = []
        sort_counter = 1
        for key in candidate_keys:
            if key in existing_keys:
                continue
            override = widget_defaults.get(key) if isinstance(widget_defaults.get(key), dict) else None
            is_enabled = True
            if override is not None and isinstance(override.get("is_enabled"), bool):
                is_enabled = override["is_enabled"]
            # entry_points: pin to the top by default — it's the curated
            # landing card row and should always render first when enabled.
            if key == "entry_points":
                sort_order = 2000.0
            else:
                sort_order = 1000 - sort_counter
                sort_counter += 1
            to_create.append(
                WorkspaceHomePreference(
                    key=key,
                    user=request.user,
                    workspace=workspace,
                    is_enabled=is_enabled,
                    sort_order=sort_order,
                )
            )

        if to_create:
            WorkspaceHomePreference.objects.bulk_create(
                to_create,
                batch_size=10,
                ignore_conflicts=True,
            )

        # Re-fetch and return — include `config` so the frontend can pick up
        # any per-widget config the seeder/admin populated (entry_points
        # cards live in workspace.home_widget_defaults but a future widget
        # could store per-user config here too).
        preference = WorkspaceHomePreference.objects.filter(
            user=request.user, workspace_id=workspace.id
        )

        return Response(
            preference.values("key", "is_enabled", "config", "sort_order"),
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def patch(self, request, slug, key):
        preference = WorkspaceHomePreference.objects.filter(key=key, workspace__slug=slug, user=request.user).first()

        if preference:
            serializer = WorkspaceHomePreferenceSerializer(preference, data=request.data, partial=True)

            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "Preference not found"}, status=status.HTTP_400_BAD_REQUEST)
