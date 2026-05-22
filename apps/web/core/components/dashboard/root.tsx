/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Dashboard root — orchestrator pattern.
// See ENG-179 brief §4.3 (initial shape) + ENG-197 brief §4.3 (orchestrator
// extension for connector-data widgets).
//
// The root partitions widgets by data source via WIDGET_DATA_SOURCE:
//   - "plane" widgets → fetched via /api/workspaces/<slug>/projects/<pid>/dashboard-data/
//   - "operator-mcp" widgets → fetched per-widget via operator-mcp /api/widget-data/<type>/
//
// Both fetches run in PARALLEL (two SWR keys). Each widget renders the moment
// ITS group's data lands — operator-mcp is typically slower (round-trip via
// gcal/gmail) so the Plane widgets paint first.

import { useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import type { TDashboardWidget, TDashboardWidgetData, TDashboardWidgetSize } from "@plane/types";
import { cn } from "@plane/utils";
import { useProject } from "@/hooks/store/use-project";
import { ProjectDashboardService } from "@/services/project";
import {
  OperatorMcpWidgetDataService,
  type TOperatorMcpWidgetPayload,
  type TOperatorMcpWidgetType,
} from "@/services/operator-mcp";
import { getWidgetDataSource, renderWidget, WidgetErrorTile } from "./widgets/widget-registry";

const projectDashboardService = new ProjectDashboardService();
const operatorMcpWidgetDataService = new OperatorMcpWidgetDataService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

const SIZE_CLASS: Record<TDashboardWidgetSize, string> = {
  small: "lg:col-span-1",
  medium: "lg:col-span-2",
  large: "lg:col-span-3",
};

/**
 * Pull operator-mcp widget params off the widget config. Each connector
 * widget has a small set of config knobs (limit, horizon_days) that the
 * server's compute function consumes. We forward all we know about;
 * the server ignores extras.
 */
function operatorMcpWidgetParams(widget: TDashboardWidget): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if ("limit" in widget && typeof widget.limit === "number") params.limit = widget.limit;
  if ("horizon_days" in widget && typeof widget.horizon_days === "number") params.horizon_days = widget.horizon_days;
  return params;
}

export const Dashboard = observer(function Dashboard({ workspaceSlug, projectId }: Props) {
  const { getProjectById } = useProject();
  const project = getProjectById(projectId);

  const dashboardConfig = project?.dashboard_config ?? null;
  const widgets: TDashboardWidget[] = useMemo(() => {
    const raw = dashboardConfig?.widgets;
    return Array.isArray(raw) ? raw : [];
  }, [dashboardConfig]);

  // Partition widgets by source. Stable per render — SWR keys are derived
  // from the type-id list, not the array identity, so re-renders don't
  // re-fire fetches.
  const { planeWidgets, operatorWidgets } = useMemo(() => {
    const plane: TDashboardWidget[] = [];
    const op: TDashboardWidget[] = [];
    for (const w of widgets) {
      if (getWidgetDataSource(w.type) === "operator-mcp") op.push(w);
      else plane.push(w);
    }
    return { planeWidgets: plane, operatorWidgets: op };
  }, [widgets]);

  // Plane SWR — only fires when there's at least one Plane-data widget.
  const planeSwrKey =
    workspaceSlug && projectId && planeWidgets.length > 0
      ? `PROJECT_DASHBOARD_DATA_${workspaceSlug}_${projectId}`
      : null;

  const {
    data: planeData,
    isLoading: planeLoading,
    error: planeError,
  } = useSWR(
    planeSwrKey,
    planeSwrKey ? () => projectDashboardService.fetchDashboardData(workspaceSlug, projectId) : null,
    {
      revalidateIfStale: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  // Operator-mcp SWR — independent of the Plane key. The id+type list is
  // folded into the key so adding/removing a connector widget re-fires the
  // fetch (without re-firing Plane).
  const operatorIds = operatorWidgets.map((w) => `${w.id}:${w.type}`).join(",");
  const operatorSwrKey =
    workspaceSlug && projectId && operatorWidgets.length > 0
      ? `OPERATOR_MCP_WIDGET_DATA_${workspaceSlug}_${projectId}_${operatorIds}`
      : null;

  const {
    data: operatorData,
    isLoading: operatorLoading,
    error: operatorError,
  } = useSWR(
    operatorSwrKey,
    operatorSwrKey
      ? () =>
          operatorMcpWidgetDataService.fetchManyWidgets(
            operatorWidgets.map((w) => ({
              id: w.id,
              type: w.type as TOperatorMcpWidgetType,
              params: operatorMcpWidgetParams(w),
            }))
          )
      : null,
    {
      revalidateIfStale: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      // Operator-mcp fetch hits live calendar / inbox APIs — bias toward
      // fewer revalidations than the Plane batch.
      dedupingInterval: 60_000,
    }
  );

  // Empty dashboard_config — agent-prompted setup. No SWR fires (both keys
  // are null because both widget partitions are empty).
  if (widgets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-16 font-semibold text-tertiary">No dashboard yet</h2>
          <p className="text-13 text-placeholder">
            This project doesn&apos;t have a dashboard yet. Ask the agent to configure one for you.
          </p>
        </div>
      </div>
    );
  }

  // Top-level error: fire only when BOTH fetches that should have run failed,
  // i.e. there's nothing to show. A single-source failure falls through to
  // the per-widget error tile path.
  const planeAvailable = planeWidgets.length === 0 || (!planeError && (planeData || planeLoading));
  const operatorAvailable = operatorWidgets.length === 0 || (!operatorError && (operatorData || operatorLoading));
  if (!planeAvailable && !operatorAvailable) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-16 font-semibold text-tertiary">Couldn&apos;t load dashboard</h2>
          <p className="text-13 text-placeholder">Try refreshing the page or come back in a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-page-x py-page-y">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {widgets.map((widget) => {
          const size = (widget.size ?? "small") as TDashboardWidgetSize;
          const source = getWidgetDataSource(widget.type);

          // Resolve the data payload for this widget based on its source.
          let widgetData: TDashboardWidgetData | undefined;
          let widgetError: string | undefined;
          let isLoading = false;

          if (source === "plane") {
            isLoading = planeLoading;
            const entry = planeData?.widgets?.[widget.id];
            if (entry) {
              if ("error" in entry) widgetError = entry.error;
              else widgetData = entry.data;
            } else if (planeError) {
              widgetError = "compute_failed";
            }
          } else {
            isLoading = operatorLoading;
            const entry = operatorData?.[widget.id] as TOperatorMcpWidgetPayload | { error: string } | undefined;
            if (entry) {
              if ("error" in entry) widgetError = entry.error;
              else widgetData = entry.data as TDashboardWidgetData;
            } else if (operatorError) {
              widgetError = "compute_failed";
            }
          }

          // Loading: skeleton-ish placeholder
          if (isLoading && !widgetData && !widgetError) {
            return (
              <div
                key={widget.id}
                className={cn(
                  "border-custom-border-200 bg-custom-background-90 min-h-[180px] animate-pulse rounded-lg border",
                  SIZE_CLASS[size]
                )}
              />
            );
          }

          if (widgetError) {
            return (
              <div key={widget.id} className={SIZE_CLASS[size]}>
                <WidgetErrorTile title={widget.title} error={widgetError} />
              </div>
            );
          }

          // Defensive fallback if data is missing for some reason — show a
          // skeleton rather than crashing the whole grid.
          if (!widgetData) {
            return (
              <div
                key={widget.id}
                className={cn(
                  "border-custom-border-200 bg-custom-background-90 min-h-[180px] animate-pulse rounded-lg border",
                  SIZE_CLASS[size]
                )}
              />
            );
          }

          return (
            <div key={widget.id} className={SIZE_CLASS[size]}>
              {renderWidget({
                config: widget,
                data: widgetData,
                workspaceSlug,
                projectId,
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
