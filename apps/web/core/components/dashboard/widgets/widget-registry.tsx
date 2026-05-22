/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Widget registry — see ENG-179 brief §4.2.
// Maps widget.type → renderer. New widget types layer in here without changing
// the Dashboard shell. Unknown types fall back to a degraded tile (no crash).

import type { TDashboardWidget, TDashboardWidgetData, TDashboardWidgetType } from "@plane/types";
import { CountByPriorityWidget } from "./count-by-priority";
import { CountByStateWidget } from "./count-by-state";
import { DueSoonWidget } from "./due-soon";
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
  // ENG-198 — Phase 2 module-shaped widgets.
  "pipeline_funnel",
  "velocity",
  "touchpoint_due",
] as const;

// Widget data-source map. Phase 1 (ENG-197) orchestrator uses this to decide
// whether to fetch a widget's data from Plane's /dashboard-data/ endpoint or
// from operator-mcp's /widget-data/ endpoint. All Phase-1+Phase-2 widgets are
// "plane"; future calendar_upcoming / email_feed widgets will be "operator".
//
// Kept as a const map so Phase 3 / Phase 4 can introspect it without
// importing every widget component.
export type TWidgetDataSource = "plane" | "operator";

export const WIDGET_DATA_SOURCE: Record<TDashboardWidgetType, TWidgetDataSource> = {
  count_by_state: "plane",
  count_by_priority: "plane",
  due_soon: "plane",
  recent_activity: "plane",
  metric: "plane",
  // ENG-198 widgets are all Plane-data-sourced.
  pipeline_funnel: "plane",
  velocity: "plane",
  touchpoint_due: "plane",
};

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
