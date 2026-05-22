# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# [ours: dashboards] Operator fork — ENG-178 / Phase 1 of the Operator
# Dashboards programme. Contract tests for the per-project dashboard-data
# endpoint. Verifies:
#   - All 5 widget types compute the documented shape.
#   - Permission gating (non-member is rejected; unauthenticated is 401).
#   - Empty / missing config returns the empty-state contract.
#   - Unknown widget types degrade to per-widget error rather than 500.
#   - The dashboard_config field round-trips through PATCH on the
#     project endpoint (proves the model + serializer plumbing wired up).

import uuid

import pytest
from rest_framework import status

from plane.db.models import (
    Issue,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)


@pytest.fixture
def project(db, workspace, create_user):
    """Create a project the test user is admin of."""
    proj = Project.objects.create(
        name="Dashboard Test Project",
        identifier="DTP",
        workspace=workspace,
    )
    ProjectMember.objects.create(project=proj, member=create_user, role=20, is_active=True)
    return proj


@pytest.fixture
def states(db, workspace, project, create_user):
    """Create the canonical 5-state set (backlog/unstarted/started/completed/cancelled)
    so the count_by_state widget has something interesting to bucket."""
    out = {}
    for name, group, color in [
        ("Backlog", "backlog", "#a3a3a3"),
        ("Todo", "unstarted", "#3b82f6"),
        ("In Progress", "started", "#f59e0b"),
        ("Done", "completed", "#10b981"),
        ("Cancelled", "cancelled", "#ef4444"),
    ]:
        out[group] = State.objects.create(
            name=name,
            color=color,
            group=group,
            workspace=workspace,
            project=project,
            created_by=create_user,
            default=(group == "backlog"),
        )
    return out


def _dashboard_url(workspace_slug, project_id):
    return f"/api/workspaces/{workspace_slug}/projects/{project_id}/dashboard-data/"


@pytest.mark.contract
class TestDashboardConfigPersistence:
    """Project.dashboard_config writes through PATCH and surfaces on GET — proves
    the migration + 4 serializer locations are wired up."""

    @pytest.mark.django_db
    def test_dashboard_config_defaults_to_empty_dict(self, project):
        """Fresh projects have dashboard_config = {} (additive migration default)."""
        proj = Project.objects.get(pk=project.pk)
        assert proj.dashboard_config == {}

    @pytest.mark.django_db
    def test_dashboard_config_round_trip_through_patch(self, session_client, workspace, project):
        """PATCH the project with a dashboard_config payload → it persists +
        surfaces on the project detail GET."""
        config = {
            "widgets": [
                {"id": "w1", "type": "count_by_state", "title": "By state"},
            ],
            "layout": "grid-3",
        }
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/"
        patch_response = session_client.patch(url, {"dashboard_config": config}, format="json")
        assert patch_response.status_code == status.HTTP_200_OK, (
            f"Got {patch_response.status_code}: {patch_response.data!r}"
        )

        # DB persistence
        proj = Project.objects.get(pk=project.pk)
        assert proj.dashboard_config == config

        # Detail GET surfaces it
        get_response = session_client.get(url)
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.data["dashboard_config"] == config

    @pytest.mark.django_db
    def test_dashboard_config_present_on_list_payload(self, session_client, workspace, project):
        """The list_detail (.values projection) branch includes dashboard_config —
        ENG-118 → ENG-114 lesson; the projection has to name the field explicitly."""
        config = {"widgets": [], "layout": "grid-1"}
        project.dashboard_config = config
        project.save(update_fields=["dashboard_config"])

        url = f"/api/workspaces/{workspace.slug}/projects/details/"
        response = session_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        rows = response.json()
        assert len(rows) == 1
        assert "dashboard_config" in rows[0]
        assert rows[0]["dashboard_config"] == config


@pytest.mark.contract
class TestDashboardDataEmpty:
    """The empty / missing-config code path."""

    @pytest.mark.django_db
    def test_empty_config_returns_empty_widgets(self, session_client, workspace, project):
        """No config → 200 OK with `{"widgets": {}}` (frontend renders empty-state)."""
        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"widgets": {}}

    @pytest.mark.django_db
    def test_malformed_config_returns_empty_widgets(self, session_client, workspace, project):
        """A config that isn't shape-compatible (widgets not a list) is treated
        as empty rather than crashing."""
        project.dashboard_config = {"widgets": "not-a-list"}
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"widgets": {}}

    @pytest.mark.django_db
    def test_unknown_widget_type_degrades_gracefully(self, session_client, workspace, project):
        """An unknown widget type doesn't 500; it returns a per-widget error
        so the rest of the dashboard still renders."""
        project.dashboard_config = {
            "widgets": [{"id": "wx", "type": "made_up_type", "title": "?"}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["widgets"]["wx"]["error"] == "unknown_widget_type"
        assert response.data["widgets"]["wx"]["type"] == "made_up_type"


@pytest.mark.contract
class TestDashboardDataWidgets:
    """The 5 widget computations."""

    @pytest.mark.django_db
    def test_count_by_state_buckets_issues(
        self, session_client, workspace, project, states, create_user
    ):
        """count_by_state returns one row per state with the actual issue count
        (states with zero issues still appear, ordered by State.sequence)."""
        # 3 issues in Backlog, 1 in Done.
        for i in range(3):
            Issue.objects.create(
                name=f"Backlog issue {i}",
                workspace=workspace,
                project=project,
                state=states["backlog"],
                created_by=create_user,
            )
        Issue.objects.create(
            name="Done issue",
            workspace=workspace,
            project=project,
            state=states["completed"],
            created_by=create_user,
        )

        project.dashboard_config = {
            "widgets": [{"id": "wstate", "type": "count_by_state", "title": "By state"}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wstate"]
        assert widget["type"] == "count_by_state"
        counts = {row["group"]: row["count"] for row in widget["data"]["counts"]}
        assert counts["backlog"] == 3
        assert counts["completed"] == 1
        assert counts["unstarted"] == 0
        # Colors + state names round-trip.
        for row in widget["data"]["counts"]:
            assert "state" in row and "color" in row

    @pytest.mark.django_db
    def test_count_by_priority_emits_all_buckets(
        self, session_client, workspace, project, states, create_user
    ):
        """count_by_priority emits all 5 priority buckets in canonical order
        even when some have zero matches."""
        Issue.objects.create(
            name="urgent issue",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            priority="urgent",
            created_by=create_user,
        )
        Issue.objects.create(
            name="urgent issue 2",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            priority="urgent",
            created_by=create_user,
        )
        Issue.objects.create(
            name="medium issue",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            priority="medium",
            created_by=create_user,
        )

        project.dashboard_config = {
            "widgets": [{"id": "wprio", "type": "count_by_priority", "title": "Priority"}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wprio"]
        assert widget["type"] == "count_by_priority"
        priorities = [row["priority"] for row in widget["data"]["counts"]]
        assert priorities == ["urgent", "high", "medium", "low", "none"]
        counts = {row["priority"]: row["count"] for row in widget["data"]["counts"]}
        assert counts["urgent"] == 2
        assert counts["medium"] == 1
        assert counts["high"] == 0

    @pytest.mark.django_db
    def test_due_soon_returns_upcoming_issues(
        self, session_client, workspace, project, states, create_user
    ):
        """due_soon returns issues whose target_date falls inside horizon_days,
        excluding completed/cancelled. Limited to N items."""
        from datetime import timedelta

        from django.utils import timezone

        today = timezone.now().date()

        # In-window: due in 2 days, backlog state.
        soon = Issue.objects.create(
            name="Soon",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            target_date=today + timedelta(days=2),
            created_by=create_user,
        )
        # Out-of-window: due in 30 days.
        Issue.objects.create(
            name="Far",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            target_date=today + timedelta(days=30),
            created_by=create_user,
        )
        # In-window but completed — should be filtered out.
        Issue.objects.create(
            name="Done already",
            workspace=workspace,
            project=project,
            state=states["completed"],
            target_date=today + timedelta(days=1),
            created_by=create_user,
        )
        # No target_date — should be filtered out.
        Issue.objects.create(
            name="No date",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            created_by=create_user,
        )

        project.dashboard_config = {
            "widgets": [
                {
                    "id": "wdue",
                    "type": "due_soon",
                    "title": "Closing this week",
                    "horizon_days": 7,
                    "limit": 5,
                }
            ],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wdue"]
        assert widget["type"] == "due_soon"
        issues = widget["data"]["issues"]
        # Only the "Soon" issue qualifies.
        assert len(issues) == 1
        assert issues[0]["id"] == str(soon.id)
        assert issues[0]["state"] == "Backlog"
        assert issues[0]["due_date"] is not None

    @pytest.mark.django_db
    def test_recent_activity_orders_by_updated_at(
        self, session_client, workspace, project, states, create_user
    ):
        """recent_activity returns the N most recently updated issues, newest first."""
        from django.utils import timezone

        # Create three issues then touch the middle one so it becomes "most recent".
        a = Issue.objects.create(
            name="First",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            created_by=create_user,
        )
        b = Issue.objects.create(
            name="Second",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            created_by=create_user,
        )
        c = Issue.objects.create(
            name="Third",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            created_by=create_user,
        )
        # Touch b so it becomes most recent (re-fetch to read updated_at
        # ordering deterministically).
        b.name = "Second (updated)"
        b.save()

        project.dashboard_config = {
            "widgets": [
                {"id": "wact", "type": "recent_activity", "title": "Recent", "limit": 2}
            ],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wact"]
        assert widget["type"] == "recent_activity"
        issues = widget["data"]["issues"]
        # limit=2; newest first, so b (touched last) is at the head.
        assert len(issues) == 2
        assert issues[0]["id"] == str(b.id)
        # updated_by + state surfaced.
        assert issues[0]["state"] == "Backlog"
        assert issues[0]["updated_at"] is not None

    @pytest.mark.django_db
    def test_metric_with_denominator_returns_ratio(
        self, session_client, workspace, project, states, create_user
    ):
        """metric with numerator + denominator returns the divided value plus
        the raw counts. format defaults are honored."""
        # 1 completed, 3 backlog, 1 cancelled.
        Issue.objects.create(
            name="Done",
            workspace=workspace,
            project=project,
            state=states["completed"],
            created_by=create_user,
        )
        for i in range(3):
            Issue.objects.create(
                name=f"Backlog {i}",
                workspace=workspace,
                project=project,
                state=states["backlog"],
                created_by=create_user,
            )
        Issue.objects.create(
            name="Cancelled",
            workspace=workspace,
            project=project,
            state=states["cancelled"],
            created_by=create_user,
        )

        project.dashboard_config = {
            "widgets": [
                {
                    "id": "wmet",
                    "type": "metric",
                    "title": "Conversion",
                    "numerator": {"state_group": ["completed"]},
                    "denominator": {"state_group_exclude": ["cancelled"]},
                    "format": "percent",
                }
            ],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wmet"]
        assert widget["type"] == "metric"
        data = widget["data"]
        # 1 completed / 4 not-cancelled = 0.25
        assert data["numerator"] == 1
        assert data["denominator"] == 4
        assert abs(data["value"] - 0.25) < 1e-9
        assert data["format"] == "percent"

    @pytest.mark.django_db
    def test_metric_without_denominator_returns_count(
        self, session_client, workspace, project, states, create_user
    ):
        """metric without a denominator returns numerator as the value (count mode)."""
        for i in range(4):
            Issue.objects.create(
                name=f"Backlog {i}",
                workspace=workspace,
                project=project,
                state=states["backlog"],
                created_by=create_user,
            )

        project.dashboard_config = {
            "widgets": [
                {
                    "id": "wcount",
                    "type": "metric",
                    "title": "Open work",
                    "numerator": {"state_group": ["backlog"]},
                }
            ],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        data = response.data["widgets"]["wcount"]["data"]
        assert data["value"] == 4
        assert data["numerator"] == 4
        assert data["denominator"] is None
        assert data["format"] == "count"


@pytest.mark.contract
class TestDashboardPermissions:
    """Permission gating on the dashboard-data endpoint."""

    @pytest.mark.django_db
    def test_unauthenticated_returns_401(self, client, workspace, project):
        """No auth header → 401."""
        response = client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.django_db
    def test_non_member_returns_403(self, session_client, workspace, project):
        """A workspace user who isn't a project member is rejected."""
        outsider = User.objects.create_user(email="outsider@example.com", username="outsider")
        WorkspaceMember.objects.create(workspace=workspace, member=outsider, role=15, is_active=True)
        # Note: NOT a ProjectMember of `project`.
        session_client.force_authenticate(user=outsider)

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_member_can_read(self, session_client, workspace, project):
        """A project member sees the empty-state contract (no config)."""
        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"widgets": {}}

    @pytest.mark.django_db
    def test_nonexistent_project_returns_404_or_403(self, session_client, workspace):
        """A made-up project UUID returns 403 (permission check fires first)
        or 404 (project lookup fails) — both are acceptable; we only assert
        it doesn't leak a 200."""
        bogus = uuid.uuid4()
        response = session_client.get(_dashboard_url(workspace.slug, bogus))
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        )
