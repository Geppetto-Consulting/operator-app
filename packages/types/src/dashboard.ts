/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { EDurationFilters } from "./enums";
import type { IIssueActivity, TIssuePriorities } from "./issues";
import type { TIssue } from "./issues/issue";
import type { TIssueRelationTypes } from "./issues/issue_relation";
import type { TStateGroups } from "./state";

export type TWidgetKeys =
  | "overview_stats"
  | "assigned_issues"
  | "created_issues"
  | "issues_by_state_groups"
  | "issues_by_priority"
  | "recent_activity"
  | "recent_projects"
  | "recent_collaborators";

export type TIssuesListTypes = "pending" | "upcoming" | "overdue" | "completed";

// widget filters
export type TAssignedIssuesWidgetFilters = {
  custom_dates?: string[];
  duration?: EDurationFilters;
  tab?: TIssuesListTypes;
};

export type TCreatedIssuesWidgetFilters = {
  custom_dates?: string[];
  duration?: EDurationFilters;
  tab?: TIssuesListTypes;
};

export type TIssuesByStateGroupsWidgetFilters = {
  duration?: EDurationFilters;
  custom_dates?: string[];
};

export type TIssuesByPriorityWidgetFilters = {
  custom_dates?: string[];
  duration?: EDurationFilters;
};

export type TWidgetFiltersFormData =
  | {
      widgetKey: "assigned_issues";
      filters: Partial<TAssignedIssuesWidgetFilters>;
    }
  | {
      widgetKey: "created_issues";
      filters: Partial<TCreatedIssuesWidgetFilters>;
    }
  | {
      widgetKey: "issues_by_state_groups";
      filters: Partial<TIssuesByStateGroupsWidgetFilters>;
    }
  | {
      widgetKey: "issues_by_priority";
      filters: Partial<TIssuesByPriorityWidgetFilters>;
    };

export type TWidget = {
  id: string;
  is_visible: boolean;
  key: TWidgetKeys;
  readonly widget_filters: // only for read
  TAssignedIssuesWidgetFilters &
    TCreatedIssuesWidgetFilters &
    TIssuesByStateGroupsWidgetFilters &
    TIssuesByPriorityWidgetFilters;
  filters: // only for write
  TAssignedIssuesWidgetFilters &
    TCreatedIssuesWidgetFilters &
    TIssuesByStateGroupsWidgetFilters &
    TIssuesByPriorityWidgetFilters;
};

export type TWidgetStatsRequestParams =
  | {
      widget_key: TWidgetKeys;
    }
  | {
      target_date: string;
      issue_type: TIssuesListTypes;
      widget_key: "assigned_issues";
      expand?: "issue_relation";
    }
  | {
      target_date: string;
      issue_type: TIssuesListTypes;
      widget_key: "created_issues";
    }
  | {
      target_date: string;
      widget_key: "issues_by_state_groups";
    }
  | {
      target_date: string;
      widget_key: "issues_by_priority";
    }
  | {
      cursor: string;
      per_page: number;
      search?: string;
      widget_key: "recent_collaborators";
    };

export type TWidgetIssue = TIssue & {
  issue_relation: {
    id: string;
    project_id: string;
    relation_type: TIssueRelationTypes;
    sequence_id: number;
    type_id: string | null;
  }[];
};

// widget stats responses
export type TOverviewStatsWidgetResponse = {
  assigned_issues_count: number;
  completed_issues_count: number;
  created_issues_count: number;
  pending_issues_count: number;
};

export type TAssignedIssuesWidgetResponse = {
  issues: TWidgetIssue[];
  count: number;
};

export type TCreatedIssuesWidgetResponse = {
  issues: TWidgetIssue[];
  count: number;
};

export type TIssuesByStateGroupsWidgetResponse = {
  count: number;
  state: TStateGroups;
};

export type TIssuesByPriorityWidgetResponse = {
  count: number;
  priority: TIssuePriorities;
};

export type TRecentActivityWidgetResponse = IIssueActivity;

export type TRecentProjectsWidgetResponse = string[];

export type TRecentCollaboratorsWidgetResponse = {
  active_issue_count: number;
  user_id: string;
};

export type TWidgetStatsResponse =
  | TOverviewStatsWidgetResponse
  | TIssuesByStateGroupsWidgetResponse[]
  | TIssuesByPriorityWidgetResponse[]
  | TAssignedIssuesWidgetResponse
  | TCreatedIssuesWidgetResponse
  | TRecentActivityWidgetResponse[]
  | TRecentProjectsWidgetResponse
  | TRecentCollaboratorsWidgetResponse[];

// dashboard
export type TDeprecatedDashboard = {
  created_at: string;
  created_by: string | null;
  description_html: string;
  id: string;
  identifier: string | null;
  is_default: boolean;
  name: string;
  owned_by: string;
  type: string;
  updated_at: string;
  updated_by: string | null;
};

export type THomeDashboardResponse = {
  dashboard: TDeprecatedDashboard;
  widgets: TWidget[];
};

// =============================================================================
// [ours: project dashboards] Operator fork — agent-controlled project dashboards
//
// See ENG-177 programme tracker for the schema canonical, ENG-178 for backend
// (Project.dashboard_config JSONField + GET /dashboard-data/), ENG-179 for the
// frontend render (this contract), ENG-180 for MCP write paths (Phase 3 consumes
// these types via packages/types). Project.dashboard_config is the source of
// truth; the dashboard-data endpoint computes per-widget payloads from it.
// =============================================================================

export type TDashboardWidgetSize = "small" | "medium" | "large";

export type TDashboardLayout = "grid-3" | string;

export type TDashboardWidgetFilters = {
  state_group?: string[];
  state_group_exclude?: string[];
  priority?: string[];
};

export type TDashboardWidgetBase = {
  id: string;
  title: string;
  size?: TDashboardWidgetSize;
};

export type TCountByStateWidgetConfig = TDashboardWidgetBase & {
  type: "count_by_state";
  filters?: TDashboardWidgetFilters;
};

export type TCountByPriorityWidgetConfig = TDashboardWidgetBase & {
  type: "count_by_priority";
  filters?: TDashboardWidgetFilters;
};

export type TDueSoonWidgetConfig = TDashboardWidgetBase & {
  type: "due_soon";
  horizon_days?: number;
  limit?: number;
  filters?: TDashboardWidgetFilters;
};

export type TRecentActivityWidgetConfig = TDashboardWidgetBase & {
  type: "recent_activity";
  limit?: number;
  filters?: TDashboardWidgetFilters;
};

export type TMetricFormat = "int" | "count" | "percent" | "ratio";

export type TMetricWidgetConfig = TDashboardWidgetBase & {
  type: "metric";
  numerator: TDashboardWidgetFilters;
  denominator?: TDashboardWidgetFilters;
  format?: TMetricFormat;
};

export type TDashboardWidget =
  | TCountByStateWidgetConfig
  | TCountByPriorityWidgetConfig
  | TDueSoonWidgetConfig
  | TRecentActivityWidgetConfig
  | TMetricWidgetConfig;

export type TDashboardWidgetType = TDashboardWidget["type"];

export type TDashboardConfig = {
  widgets: TDashboardWidget[];
  layout?: TDashboardLayout;
};

// --- Per-widget computed-data shapes (response from /dashboard-data/) ---

export type TCountByStateDatum = {
  state_id: string;
  state: string;
  color: string;
  group: TStateGroups | null;
  count: number;
};

export type TCountByStateWidgetData = {
  counts: TCountByStateDatum[];
};

export type TCountByPriorityDatum = {
  priority: TIssuePriorities;
  count: number;
};

export type TCountByPriorityWidgetData = {
  counts: TCountByPriorityDatum[];
};

export type TDashboardIssueRef = {
  id: string;
  name: string;
  sequence_id: number;
  state: string | null;
  state_group: TStateGroups | null;
  priority?: TIssuePriorities;
};

export type TDueSoonWidgetData = {
  issues: (TDashboardIssueRef & { due_date: string | null })[];
};

export type TRecentActivityIssue = TDashboardIssueRef & {
  updated_at: string;
  // [ours: backend returns UUID string; renderer resolves via member store]
  // See ENG-178 audit (recent_activity.updated_by shape decision — Phase 2).
  updated_by: string | null;
};

export type TRecentActivityWidgetData = {
  issues: TRecentActivityIssue[];
};

export type TMetricWidgetData = {
  value: number;
  numerator: number;
  denominator?: number | null;
  format: TMetricFormat;
};

export type TDashboardWidgetData =
  | TCountByStateWidgetData
  | TCountByPriorityWidgetData
  | TDueSoonWidgetData
  | TRecentActivityWidgetData
  | TMetricWidgetData;

// Per-widget error payload (backend may return error keys instead of `data`
// when a widget is malformed or its compute path fails). See dashboard.py
// L262-L294 in apps/api.
export type TDashboardWidgetError = {
  error: "missing_widget_type" | "unknown_widget_type" | "compute_failed" | string;
};

export type TDashboardWidgetResponseEntry =
  | { type: TDashboardWidgetType; data: TDashboardWidgetData }
  | (TDashboardWidgetError & { type?: string });

export type TDashboardDataResponse = {
  widgets: Record<string, TDashboardWidgetResponseEntry>;
};
