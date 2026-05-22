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
class TestPipelineFunnelWidget:
    """ENG-198 — pipeline_funnel: per-state counts ordered by State.sequence
    + a conversion % (completed / non-cancelled). Conversion is null when
    total is 0 (don't lie about empty data)."""

    @pytest.mark.django_db
    def test_pipeline_funnel_returns_stages_ordered_by_sequence(
        self, session_client, workspace, project, states, create_user
    ):
        """Stages emit one entry per state, ordered by State.sequence (Plane's
        canonical pipeline order). Counts include 0 so the chart axis is stable."""
        # 2 in Backlog, 1 in In Progress, 1 in Done.
        for _ in range(2):
            Issue.objects.create(
                name="b", workspace=workspace, project=project,
                state=states["backlog"], created_by=create_user,
            )
        Issue.objects.create(
            name="ip", workspace=workspace, project=project,
            state=states["started"], created_by=create_user,
        )
        Issue.objects.create(
            name="d", workspace=workspace, project=project,
            state=states["completed"], created_by=create_user,
        )

        project.dashboard_config = {
            "widgets": [{"id": "wf", "type": "pipeline_funnel", "title": "Funnel"}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wf"]
        assert widget["type"] == "pipeline_funnel"
        data = widget["data"]

        # 5 states, all surfaced (incl. cancelled even with 0 count).
        names = [s["name"] for s in data["stages"]]
        assert names == ["Backlog", "Todo", "In Progress", "Done", "Cancelled"]
        counts = {s["name"]: s["count"] for s in data["stages"]}
        assert counts == {"Backlog": 2, "Todo": 0, "In Progress": 1, "Done": 1, "Cancelled": 0}
        # total excludes cancelled (0 here so equal to all), conversion = 1/4 = 0.25.
        assert data["total"] == 4
        assert abs(data["conversion_pct"] - 0.25) < 1e-9
        # Stages carry state_id + color for the frontend stacked-bar render.
        for s in data["stages"]:
            assert "state_id" in s and "color" in s

    @pytest.mark.django_db
    def test_pipeline_funnel_conversion_null_when_empty(
        self, session_client, workspace, project, states
    ):
        """No issues at all → conversion_pct is null, not 0 (audit-trail honesty
        about empty data)."""
        project.dashboard_config = {
            "widgets": [{"id": "wf", "type": "pipeline_funnel", "title": "Funnel"}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        data = response.data["widgets"]["wf"]["data"]
        assert data["total"] == 0
        assert data["conversion_pct"] is None
        # Stages still emitted (zero-fill) so the frontend can render an
        # empty funnel rather than nothing.
        assert len(data["stages"]) == 5

    @pytest.mark.django_db
    def test_pipeline_funnel_excludes_cancelled_from_conversion(
        self, session_client, workspace, project, states, create_user
    ):
        """Conversion uses non-cancelled total — a project with 1 won and 1
        cancelled should not appear as 50% conversion."""
        Issue.objects.create(
            name="won", workspace=workspace, project=project,
            state=states["completed"], created_by=create_user,
        )
        Issue.objects.create(
            name="lost", workspace=workspace, project=project,
            state=states["cancelled"], created_by=create_user,
        )

        project.dashboard_config = {
            "widgets": [{"id": "wf", "type": "pipeline_funnel", "title": "Funnel"}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        data = response.data["widgets"]["wf"]["data"]
        # total excludes cancelled → 1; conversion = 1/1 = 1.0.
        assert data["total"] == 1
        assert abs(data["conversion_pct"] - 1.0) < 1e-9


@pytest.mark.contract
class TestVelocityWidget:
    """ENG-198 — velocity: per-week count of closed issues, trend across halves."""

    @pytest.mark.django_db
    def test_velocity_buckets_completed_issues_by_week(
        self, session_client, workspace, project, states, create_user
    ):
        """Issues with state.group=completed are bucketed by completed_at's
        ISO week. Issues without completed_at fall back to updated_at."""
        from datetime import timedelta
        from django.utils import timezone

        now = timezone.now()

        # 2 closed in current week (auto-stamped completed_at), 1 in week-1.
        for _ in range(2):
            Issue.objects.create(
                name="this-week",
                workspace=workspace,
                project=project,
                state=states["completed"],
                created_by=create_user,
            )

        old = Issue.objects.create(
            name="last-week",
            workspace=workspace,
            project=project,
            state=states["completed"],
            created_by=create_user,
        )
        # Override completed_at to last week so the bucketing is testable
        # without depending on real wall-clock drift across runs.
        Issue.objects.filter(pk=old.pk).update(completed_at=now - timedelta(days=8))

        project.dashboard_config = {
            "widgets": [{"id": "wv", "type": "velocity", "title": "Velocity", "weeks": 4}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wv"]
        assert widget["type"] == "velocity"
        data = widget["data"]
        # 4 week-buckets requested, all returned (oldest first).
        assert len(data["weeks"]) == 4
        # Each bucket has the expected keys.
        for wk in data["weeks"]:
            assert set(wk.keys()) == {"week_start", "closed"}
        # Total = 3 (2 this-week + 1 last-week).
        assert data["total"] == 3

    @pytest.mark.django_db
    def test_velocity_trend_null_when_first_half_empty(
        self, session_client, workspace, project, states, create_user
    ):
        """If the first half of the window has 0 closed issues, trend_pct is
        null (don't return infinity, don't return a misleading 100%)."""
        from datetime import timedelta
        from django.utils import timezone

        now = timezone.now()
        # Only close one issue in the very recent week; first half remains 0.
        Issue.objects.create(
            name="recent",
            workspace=workspace,
            project=project,
            state=states["completed"],
            created_by=create_user,
        )

        project.dashboard_config = {
            "widgets": [{"id": "wv", "type": "velocity", "title": "Velocity", "weeks": 4}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        data = response.data["widgets"]["wv"]["data"]
        assert data["total"] >= 1
        # First half (oldest 2 weeks) is 0 — trend should be null.
        assert data["trend_pct"] is None

    @pytest.mark.django_db
    def test_velocity_empty_returns_zero_buckets(
        self, session_client, workspace, project, states
    ):
        """No closed issues at all → all buckets are 0, total is 0, trend is null."""
        project.dashboard_config = {
            "widgets": [{"id": "wv", "type": "velocity", "title": "Velocity", "weeks": 6}],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        data = response.data["widgets"]["wv"]["data"]
        assert data["total"] == 0
        assert data["trend_pct"] is None
        assert len(data["weeks"]) == 6
        assert all(wk["closed"] == 0 for wk in data["weeks"])


@pytest.mark.contract
class TestTouchpointDueWidget:
    """ENG-198 — touchpoint_due: stale items, oldest-first, capped at limit."""

    @pytest.mark.django_db
    def test_touchpoint_due_returns_stale_issues_oldest_first(
        self, session_client, workspace, project, states, create_user
    ):
        """Issues whose updated_at is older than now-stale_days surface,
        ordered oldest-first."""
        from datetime import timedelta
        from django.utils import timezone

        now = timezone.now()

        # Fresh (1 day ago) — shouldn't surface.
        fresh = Issue.objects.create(
            name="Fresh",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            created_by=create_user,
        )
        # Stale 20 days, stale 40 days.
        stale_20 = Issue.objects.create(
            name="Stale 20",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            created_by=create_user,
        )
        stale_40 = Issue.objects.create(
            name="Stale 40",
            workspace=workspace,
            project=project,
            state=states["backlog"],
            created_by=create_user,
        )
        # Done — even if stale, should be excluded.
        Issue.objects.create(
            name="Stale but done",
            workspace=workspace,
            project=project,
            state=states["completed"],
            created_by=create_user,
        )

        # Backfill updated_at via .update() to skip the auto_now bump.
        Issue.objects.filter(pk=fresh.pk).update(updated_at=now - timedelta(days=1))
        Issue.objects.filter(pk=stale_20.pk).update(updated_at=now - timedelta(days=20))
        Issue.objects.filter(pk=stale_40.pk).update(updated_at=now - timedelta(days=40))

        project.dashboard_config = {
            "widgets": [
                {
                    "id": "wt",
                    "type": "touchpoint_due",
                    "title": "Stale items",
                    "stale_days": 14,
                    "limit": 10,
                }
            ],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        widget = response.data["widgets"]["wt"]
        assert widget["type"] == "touchpoint_due"
        data = widget["data"]
        assert data["stale_threshold_days"] == 14

        issues = data["issues"]
        # Only the 2 backlog stale issues — completed excluded, fresh excluded.
        assert len(issues) == 2
        # Oldest first.
        assert issues[0]["id"] == str(stale_40.id)
        assert issues[1]["id"] == str(stale_20.id)
        # Shape: identifier composed from project.identifier + sequence_id.
        assert issues[0]["identifier"].startswith("DTP-")
        assert issues[0]["days_since"] >= 39
        assert issues[0]["last_activity_iso"] is not None

    @pytest.mark.django_db
    def test_touchpoint_due_respects_stale_days_threshold(
        self, session_client, workspace, project, states, create_user
    ):
        """An issue 10 days old should appear with stale_days=7 but not with stale_days=14."""
        from datetime import timedelta
        from django.utils import timezone

        now = timezone.now()
        issue = Issue.objects.create(
            name="10-day", workspace=workspace, project=project,
            state=states["backlog"], created_by=create_user,
        )
        Issue.objects.filter(pk=issue.pk).update(updated_at=now - timedelta(days=10))

        # stale_days=7 → surfaces
        project.dashboard_config = {
            "widgets": [
                {"id": "wt", "type": "touchpoint_due", "title": "T",
                 "stale_days": 7, "limit": 5}
            ],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert len(response.data["widgets"]["wt"]["data"]["issues"]) == 1

        # stale_days=14 → does not surface
        project.dashboard_config["widgets"][0]["stale_days"] = 14
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.data["widgets"]["wt"]["data"]["issues"] == []

    @pytest.mark.django_db
    def test_touchpoint_due_empty_returns_empty_list(
        self, session_client, workspace, project, states
    ):
        """No items at all → empty issues list, threshold echoed, no error."""
        project.dashboard_config = {
            "widgets": [
                {"id": "wt", "type": "touchpoint_due", "title": "T",
                 "stale_days": 14, "limit": 5}
            ],
        }
        project.save(update_fields=["dashboard_config"])

        response = session_client.get(_dashboard_url(workspace.slug, project.id))
        assert response.status_code == status.HTTP_200_OK
        data = response.data["widgets"]["wt"]["data"]
        assert data["issues"] == []
        assert data["stale_threshold_days"] == 14


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
