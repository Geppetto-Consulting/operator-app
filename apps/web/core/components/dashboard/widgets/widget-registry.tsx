/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Widget registry — see ENG-179 brief §4.2 +
// ENG-197 (orchestrator pattern). Maps widget.type → renderer and widget.type
// → data source. Unknown types fall back to a degraded tile (no crash).

import type { TDashboardWidget, TDashboardWidgetData, TDashboardWidgetType } from "@plane/types";
import { CalendarUpcomingWidget } from "./calendar-upcoming";
import { CountByPriorityWidget } from "./count-by-priority";
import { CountByStateWidget } from "./count-by-state";
import { DueSoonWidget } from "./due-soon";
import { EmailFeedWidget } from "./email-feed";
import { MetricWidget } from "./metric";
import { PipelineFunnelWidget } from "./pipeline-funnel";
import { RecentActivityWidget } from "./recent-activity";
import { TouchpointDueWidget } from "./touchpoint-due";
import { VelocityWidget } from "./velocity";
import { WidgetShell } from "./widget-shell";

export type TWidgetRenderProps = {
  config: TDashboardWidget;
  data: TDashboardWidgetData;
  workspaceSlug: string;
  projectId: string;
};

// Stable list of supported widget types — also used by MCP-side validation in
// Phase 3.
export const SUPPORTED_WIDGET_TYPES: readonly TDashboardWidgetType[] = [
  "count_by_state",
  "count_by_priority",
  "due_soon",
  "recent_activity",
  "metric",
  // ENG-198 — Phase 2 module-shaped widgets (plane source).
  "pipeline_funnel",
  "velocity",
  "touchpoint_due",
  // ENG-197 — Phase 1 connector widgets (operator-mcp source).
  "calendar_upcoming",
  "email_feed",
] as const;

/**
 * Widget data source registry. The Dashboard root partitions widgets by
 * source: "plane" → fetch from Plane /dashboard-data/, "operator-mcp" →
 * fetch from operator-mcp /api/widget-data/. Unknown widget types default
 * to "plane" (fail-safe — Plane will return an unknown_widget_type error
 * that renders via WidgetErrorTile).
 *
 * Adding a new widget: register here AND in widget-data.ts on the server
 * (matching SUPPORTED_WIDGET_TYPES). Both sides must stay in sync.
 */
export type TWidgetDataSource = "plane" | "operator-mcp";

export const WIDGET_DATA_SOURCE: Record<TDashboardWidgetType, TWidgetDataSource> = {
  count_by_state: "plane",
  count_by_priority: "plane",
  due_soon: "plane",
  recent_activity: "plane",
  metric: "plane",
  // ENG-198 — Phase 2 Plane-data widgets.
  pipeline_funnel: "plane",
  velocity: "plane",
  touchpoint_due: "plane",
  // ENG-197 — Phase 1 operator-mcp connector widgets.
  calendar_upcoming: "operator-mcp",
  email_feed: "operator-mcp",
};

export function getWidgetDataSource(type: string): TWidgetDataSource {
  return WIDGET_DATA_SOURCE[type as TDashboardWidgetType] ?? "plane";
}

export function renderWidget(props: TWidgetRenderProps): React.ReactNode {
  const { config, data, workspaceSlug, projectId } = props;
  switch (config.type) {
    case "count_by_state":
      return <CountByStateWidget config={config} data={data as never} />;
    case "count_by_priority":
      return <CountByPriorityWidget config={config} data={data as never} />;
    case "due_soon":
      return <DueSoonWidget config={config} data={data as never} workspaceSlug={workspaceSlug} projectId={projectId} />;
    case "recent_activity":
      return (
        <RecentActivityWidget
          config={config}
          data={data as never}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      );
    case "metric":
      return <MetricWidget config={config} data={data as never} />;
    case "pipeline_funnel":
      return <PipelineFunnelWidget config={config} data={data as never} />;
    case "velocity":
      return <VelocityWidget config={config} data={data as never} />;
    case "touchpoint_due":
      return (
        <TouchpointDueWidget config={config} data={data as never} workspaceSlug={workspaceSlug} projectId={projectId} />
      );
    case "calendar_upcoming":
      return <CalendarUpcomingWidget config={config} data={data as never} />;
    case "email_feed":
      return <EmailFeedWidget config={config} data={data as never} />;
    default:
      return <UnsupportedWidget type={(config as { type?: string }).type} />;
  }
}

export function UnsupportedWidget({ type }: { type?: string }) {
  return (
    <WidgetShell title={`Unsupported widget`}>
      <div className="flex flex-1 items-center justify-center text-12 text-placeholder">
        {type ? `Unsupported widget type: ${type}` : "Unknown widget"}
      </div>
    </WidgetShell>
  );
}

export function WidgetErrorTile({ title, error }: { title: string; error: string }) {
  return (
    <WidgetShell title={title}>
      <div className="flex flex-1 items-center justify-center text-12 text-placeholder">
        {error === "missing_widget_type"
          ? "Widget is missing a type."
          : error === "unknown_widget_type"
            ? "Unknown widget type."
            : error === "compute_failed"
              ? "Failed to load widget data."
              : `Widget error: ${error}`}
      </div>
    </WidgetShell>
  );
}
