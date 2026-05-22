# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# [ours: dashboards] Operator fork — ENG-178, Phase 1 of the Operator
# Dashboards programme. Computes per-widget data based on the project's
# stored dashboard_config and returns one combined response keyed by
# widget id (see ENG-177 programme-state doc for the canonical contract).
#
# The endpoint is purely a *reader* over the existing Issue / State / User
# tables; the only state it owns is whatever the agent has written into
# Project.dashboard_config. Phase 2 (frontend) reads this; Phase 3 (MCP)
# writes the config.

from datetime import timedelta

# Django imports
from django.db.models import Count, F, Q
from django.db.models.functions import Coalesce, TruncWeek
from django.utils import timezone

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectEntityPermission
from plane.app.views.base import BaseAPIView
from plane.db.models import Issue, Project, State
from plane.db.models.state import StateGroup


# ---------------------------------------------------------------------------
# Widget computations
# ---------------------------------------------------------------------------
#
# Each computation receives the resolved Project + the widget config dict and
# returns the `data` payload (the wrapper adds the `type` key). Failure modes
# (missing/invalid config) degrade to safe empty payloads rather than 500ing —
# the widget should render an empty-state, not break the whole dashboard.


def _base_issue_queryset(project: Project):
    """Live (non-draft, non-archived, non-soft-deleted) issues for a project."""
    return Issue.issue_objects.filter(project=project)


def _apply_filters(queryset, filters):
    """Apply the optional widget-level filter dict.

    Supported keys (additive — silently ignore unknown keys):
      - state_group: list[str] — restrict to issues whose state.group is in the list.
      - state_group_exclude: list[str] — drop issues with state.group in the list.
      - priority: list[str] — restrict to issues whose priority is in the list.
    """
    if not filters or not isinstance(filters, dict):
        return queryset

    state_group = filters.get("state_group")
    if isinstance(state_group, list) and state_group:
        queryset = queryset.filter(state__group__in=state_group)

    state_group_exclude = filters.get("state_group_exclude")
    if isinstance(state_group_exclude, list) and state_group_exclude:
        queryset = queryset.exclude(state__group__in=state_group_exclude)

    priority = filters.get("priority")
    if isinstance(priority, list) and priority:
        queryset = queryset.filter(priority__in=priority)

    return queryset


def _compute_count_by_state(project, widget):
    """Return per-state issue counts. Includes states with 0 issues so the
    chart axis is stable when the project has many states but few issues."""
    states = State.objects.filter(project=project).order_by("sequence")
    issues = _apply_filters(_base_issue_queryset(project), widget.get("filters"))
    counts_by_state_id = dict(
        issues.values("state_id").annotate(count=Count("id")).values_list("state_id", "count")
    )
    return {
        "counts": [
            {
                "state_id": str(state.id),
                "state": state.name,
                "color": state.color,
                "group": state.group,
                "count": counts_by_state_id.get(state.id, 0),
            }
            for state in states
        ]
    }


def _compute_count_by_priority(project, widget):
    """Return per-priority issue counts in the canonical Plane order
    (urgent → high → medium → low → none). Always emits all 5 buckets."""
    priority_order = ["urgent", "high", "medium", "low", "none"]
    issues = _apply_filters(_base_issue_queryset(project), widget.get("filters"))
    counts_by_priority = dict(
        issues.values("priority").annotate(count=Count("id")).values_list("priority", "count")
    )
    return {
        "counts": [
            {"priority": p, "count": counts_by_priority.get(p, 0)}
            for p in priority_order
        ]
    }


def _compute_due_soon(project, widget):
    """N upcoming issues by target_date inside the horizon window.

    Defaults: horizon_days=7, limit=5. Excludes completed/cancelled state
    groups so closed work doesn't crowd out actually-actionable items.
    """
    horizon_days = widget.get("horizon_days", 7)
    try:
        horizon_days = int(horizon_days)
    except (TypeError, ValueError):
        horizon_days = 7
    horizon_days = max(0, horizon_days)

    limit = widget.get("limit", 5)
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 5
    limit = max(0, min(limit, 100))

    today = timezone.now().date()
    horizon = today + timedelta(days=horizon_days)

    queryset = (
        _apply_filters(_base_issue_queryset(project), widget.get("filters"))
        .filter(target_date__isnull=False, target_date__lte=horizon)
        .exclude(
            state__group__in=[StateGroup.COMPLETED.value, StateGroup.CANCELLED.value]
        )
        .select_related("state")
        .order_by("target_date", "sequence_id")[:limit]
    )

    return {
        "issues": [
            {
                "id": str(issue.id),
                "name": issue.name,
                "sequence_id": issue.sequence_id,
                "due_date": issue.target_date.isoformat() if issue.target_date else None,
                "state": issue.state.name if issue.state_id else None,
                "state_group": issue.state.group if issue.state_id else None,
                "priority": issue.priority,
            }
            for issue in queryset
        ]
    }


def _compute_recent_activity(project, widget):
    """N most-recently-updated issues. Defaults: limit=5."""
    limit = widget.get("limit", 5)
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 5
    limit = max(0, min(limit, 100))

    queryset = (
        _apply_filters(_base_issue_queryset(project), widget.get("filters"))
        .select_related("state", "updated_by")
        .order_by("-updated_at")[:limit]
    )

    return {
        "issues": [
            {
                "id": str(issue.id),
                "name": issue.name,
                "sequence_id": issue.sequence_id,
                "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
                "updated_by": str(issue.updated_by_id) if issue.updated_by_id else None,
                "state": issue.state.name if issue.state_id else None,
                "state_group": issue.state.group if issue.state_id else None,
            }
            for issue in queryset
        ]
    }


def _compute_metric(project, widget):
    """Single big-number with optional numerator/denominator filter dicts.

    Shape:
      numerator: filter dict (same shape as widget.filters) — count of issues matching
      denominator: optional filter dict — when present, value = numerator/denominator
      format: "count" (default) | "percent" | "ratio" — purely a display hint

    Falls back to {"value": 0, "numerator": 0, "denominator": null} when
    nothing matches; the frontend renders "0" / "0%" / "—" accordingly.
    """
    fmt = widget.get("format", "count")
    if fmt not in ("count", "percent", "ratio"):
        fmt = "count"

    numerator_filters = widget.get("numerator") or {}
    denominator_filters = widget.get("denominator")

    base = _base_issue_queryset(project)
    numerator_count = _apply_filters(base, numerator_filters).count()

    if denominator_filters is None:
        return {
            "value": numerator_count,
            "numerator": numerator_count,
            "denominator": None,
            "format": fmt,
        }

    denominator_count = _apply_filters(base, denominator_filters).count()
    if denominator_count == 0:
        value = 0
    else:
        value = numerator_count / denominator_count

    return {
        "value": value,
        "numerator": numerator_count,
        "denominator": denominator_count,
        "format": fmt,
    }


# ---------------------------------------------------------------------------
# ENG-198 — Phase 2 Plane-data widgets (pipeline_funnel / velocity / touchpoint_due)
# ---------------------------------------------------------------------------
#
# Three module-shaped widgets added on top of the Phase 1 generic five. They
# share the same compute contract (project + widget dict → data payload) and
# the same dispatch table. See ENG-196 programme-state doc for the per-widget
# canonical shape; ENG-198 execution brief for the exact contract.


def _compute_pipeline_funnel(project, widget):
    """Per-state issue counts ordered by state.sequence, plus a conversion %.

    Data shape:
        {
          "stages": [{state_id, name, color, count}, ...],   # excludes triage
          "total": int,                                       # excludes cancelled
          "conversion_pct": float | None,                     # won / (total - cancelled)
        }

    Conversion is `completed / non_cancelled` so a project with only cancelled
    work doesn't get a misleading 100% number. Null when total is 0 — the
    frontend renders "—" rather than "0%" for first-impression honesty.
    """
    states = State.objects.filter(project=project).order_by("sequence")
    issues = _apply_filters(_base_issue_queryset(project), widget.get("filters"))
    counts_by_state_id = dict(
        issues.values("state_id").annotate(count=Count("id")).values_list("state_id", "count")
    )

    stages = []
    won = 0
    non_cancelled_total = 0
    for state in states:
        # The default State manager already excludes triage (state.py L65-69) so
        # we only need to think about backlog/unstarted/started/completed/cancelled.
        count = counts_by_state_id.get(state.id, 0)
        stages.append(
            {
                "state_id": str(state.id),
                "name": state.name,
                "color": state.color,
                "count": count,
            }
        )
        if state.group == StateGroup.COMPLETED.value:
            won += count
        if state.group != StateGroup.CANCELLED.value:
            non_cancelled_total += count

    conversion_pct = (won / non_cancelled_total) if non_cancelled_total > 0 else None

    return {
        "stages": stages,
        "total": non_cancelled_total,
        "conversion_pct": conversion_pct,
    }


def _compute_velocity(project, widget):
    """Per-week count of issues closed, last N weeks (Monday-anchored).

    Data shape:
        {
          "weeks": [{week_start: "YYYY-MM-DD", closed: int}, ...],  # oldest first
          "total": int,                                              # sum across window
          "trend_pct": float | None,                                 # second-half vs first-half
        }

    completed_at is the canonical close-timestamp (Issue model auto-syncs it
    when state.group transitions to/from completed — see issue.py L240-254).
    Issues currently in a completed state but without completed_at (legacy
    data, raw inserts) fall back to updated_at via Coalesce so the chart
    still reflects them.

    Trend = (avg of last N/2 weeks - avg of first N/2 weeks) / first_half_avg.
    Null when first_half_avg is 0 to avoid divide-by-zero (the audit lesson
    from ENG-178: don't hand the user a misleading 0% on empty data).

    Single GROUP BY query — no per-week Python loop with N queries. The
    blocker-protocol explicitly called this out and the execution shape here
    is one TruncWeek aggregate, then a zero-fill in Python.
    """
    weeks = widget.get("weeks", 8)
    try:
        weeks = int(weeks)
    except (TypeError, ValueError):
        weeks = 8
    weeks = max(1, min(weeks, 52))

    today = timezone.now().date()
    # Anchor the window on the ISO Monday of the current week. weekday() is
    # 0=Mon, so subtracting it gives us this week's Monday.
    current_week_start = today - timedelta(days=today.weekday())
    earliest_week_start = current_week_start - timedelta(weeks=weeks - 1)

    # close_ts := completed_at OR updated_at (only used when state is completed
    # but completed_at is null — see docstring). We post-filter in Python by
    # state group + non-null close_ts to keep the SQL simple and to make the
    # legacy-data fallback behaviour testable in isolation.
    queryset = (
        _apply_filters(_base_issue_queryset(project), widget.get("filters"))
        .filter(state__group=StateGroup.COMPLETED.value)
        .annotate(close_ts=Coalesce("completed_at", "updated_at"))
        .filter(close_ts__date__gte=earliest_week_start)
        .annotate(week=TruncWeek("close_ts"))
        .values("week")
        .annotate(count=Count("id"))
    )

    counts_by_week = {}
    for row in queryset:
        wk = row["week"]
        if wk is None:
            continue
        # TruncWeek anchors on Monday on Postgres; .date() makes it tz-naive
        # for stable JSON serialisation regardless of project timezone.
        week_key = wk.date() if hasattr(wk, "date") else wk
        counts_by_week[week_key] = counts_by_week.get(week_key, 0) + row["count"]

    week_buckets = []
    for i in range(weeks):
        wk_start = earliest_week_start + timedelta(weeks=i)
        week_buckets.append(
            {
                "week_start": wk_start.isoformat(),
                "closed": counts_by_week.get(wk_start, 0),
            }
        )

    total = sum(b["closed"] for b in week_buckets)

    half = weeks // 2
    if half > 0:
        first_half = sum(b["closed"] for b in week_buckets[:half]) / half
        second_half = sum(b["closed"] for b in week_buckets[-half:]) / half
        trend_pct = ((second_half - first_half) / first_half) if first_half > 0 else None
    else:
        # weeks == 1: no comparison possible.
        trend_pct = None

    return {
        "weeks": week_buckets,
        "total": total,
        "trend_pct": trend_pct,
    }


def _compute_touchpoint_due(project, widget):
    """Issues with no activity in N+ days, oldest-first.

    Data shape:
        {
          "issues": [{id, identifier, name, last_activity_iso, days_since}, ...],
          "stale_threshold_days": int,
        }

    Excludes completed/cancelled — closed work isn't "due a touchpoint". The
    identifier field (e.g. "REL-3") is project_identifier-sequence_id, what
    Plane shows in the UI; we compose it here so the frontend doesn't have to
    look up the project.

    Default thresholds chosen so REL / PIPE modules get useful signal out of
    the box: 14-day quiet, top 5.
    """
    stale_days = widget.get("stale_days", 14)
    try:
        stale_days = int(stale_days)
    except (TypeError, ValueError):
        stale_days = 14
    stale_days = max(0, stale_days)

    limit = widget.get("limit", 5)
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 5
    limit = max(0, min(limit, 100))

    now = timezone.now()
    threshold = now - timedelta(days=stale_days)

    queryset = (
        _apply_filters(_base_issue_queryset(project), widget.get("filters"))
        .filter(updated_at__lte=threshold)
        .exclude(
            state__group__in=[StateGroup.COMPLETED.value, StateGroup.CANCELLED.value]
        )
        .order_by("updated_at", "sequence_id")[:limit]
    )

    project_identifier = project.identifier or ""
    issues_out = []
    for issue in queryset:
        days_since = (now - issue.updated_at).days if issue.updated_at else None
        issues_out.append(
            {
                "id": str(issue.id),
                "identifier": f"{project_identifier}-{issue.sequence_id}",
                "name": issue.name,
                "last_activity_iso": (
                    issue.updated_at.isoformat() if issue.updated_at else None
                ),
                "days_since": days_since,
            }
        )

    return {
        "issues": issues_out,
        "stale_threshold_days": stale_days,
    }


# Widget-type registry. Adding a new widget type means writing the compute
# function and registering it here — no other call sites need to change.
WIDGET_REGISTRY = {
    "count_by_state": _compute_count_by_state,
    "count_by_priority": _compute_count_by_priority,
    "due_soon": _compute_due_soon,
    "recent_activity": _compute_recent_activity,
    "metric": _compute_metric,
    # ENG-198 — Phase 2 module-shaped widgets.
    "pipeline_funnel": _compute_pipeline_funnel,
    "velocity": _compute_velocity,
    "touchpoint_due": _compute_touchpoint_due,
}


class DashboardDataEndpoint(BaseAPIView):
    """GET /workspaces/<slug>/projects/<project_id>/dashboard-data/

    Returns a combined per-widget payload keyed by the widget's stable `id`.
    Frontend renders dynamically via the widget-type registry.

    Unknown widget types are surfaced as `{"type": "<type>", "error":
    "unknown_widget_type"}` rather than dropped silently — that way the
    frontend can render a recognisable placeholder and the agent gets
    feedback that the type it picked isn't supported (Phase 3 catch).
    """

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id):
        # Resolve project (also enforces workspace scoping; the permission
        # class already checks membership, but we still need the row to
        # read dashboard_config + run the per-widget queries).
        project = Project.objects.filter(workspace__slug=slug, pk=project_id).first()
        if project is None:
            return Response(
                {"error": "Project does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )

        config = project.dashboard_config or {}
        widgets = config.get("widgets") if isinstance(config, dict) else None
        if not isinstance(widgets, list):
            # Empty / malformed config → return the empty-state contract.
            # Frontend renders an "agent hasn't shaped a dashboard yet"
            # affordance rather than erroring.
            return Response({"widgets": {}}, status=status.HTTP_200_OK)

        payload = {}
        for widget in widgets:
            if not isinstance(widget, dict):
                continue
            widget_id = widget.get("id")
            widget_type = widget.get("type")
            if not widget_id or not isinstance(widget_id, str):
                continue
            if not widget_type or not isinstance(widget_type, str):
                payload[widget_id] = {"type": widget_type, "error": "missing_widget_type"}
                continue
            compute = WIDGET_REGISTRY.get(widget_type)
            if compute is None:
                payload[widget_id] = {"type": widget_type, "error": "unknown_widget_type"}
                continue
            try:
                data = compute(project, widget)
            except Exception as exc:  # pragma: no cover — defensive
                # A bad config shouldn't 500 the whole dashboard. Surface
                # the error per-widget so the rest still renders.
                payload[widget_id] = {
                    "type": widget_type,
                    "error": "compute_failed",
                    "detail": str(exc),
                }
                continue
            payload[widget_id] = {"type": widget_type, "data": data}

        return Response({"widgets": payload}, status=status.HTTP_200_OK)
