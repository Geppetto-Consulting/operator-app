/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Dashboard root — see ENG-179 brief §4.3.
// Reads project.dashboard_config from the store, fetches per-widget data from
// /dashboard-data/, lays widgets out on a 3-col grid honouring widget.size.
// Empty config (or backend short-circuit) renders the agent-prompted empty state.

import { useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import type { TDashboardWidget, TDashboardWidgetSize } from "@plane/types";
import { cn } from "@plane/utils";
import { useProject } from "@/hooks/store/use-project";
import { ProjectDashboardService } from "@/services/project";
import { renderWidget, WidgetErrorTile } from "./widgets/widget-registry";

const projectDashboardService = new ProjectDashboardService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

const SIZE_CLASS: Record<TDashboardWidgetSize, string> = {
  small: "lg:col-span-1",
  medium: "lg:col-span-2",
  large: "lg:col-span-3",
};

export const Dashboard = observer(function Dashboard({ workspaceSlug, projectId }: Props) {
  const { getProjectById } = useProject();
  const project = getProjectById(projectId);

  // dashboard_config is on IPartialProject (added in this phase) — read defensively.
  const dashboardConfig = project?.dashboard_config ?? null;
  const widgets: TDashboardWidget[] = useMemo(() => {
    const raw = dashboardConfig?.widgets;
    return Array.isArray(raw) ? raw : [];
  }, [dashboardConfig]);

  const swrKey =
    workspaceSlug && projectId && widgets.length > 0 ? `PROJECT_DASHBOARD_DATA_${workspaceSlug}_${projectId}` : null;

  const { data, isLoading, error } = useSWR(
    swrKey,
    swrKey ? () => projectDashboardService.fetchDashboardData(workspaceSlug, projectId) : null,
    {
      revalidateIfStale: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  // Empty dashboard_config (or backend signalled empty) — agent-prompted setup.
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

  if (error) {
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
          const widgetData = data?.widgets?.[widget.id];

          // Loading: skeleton-ish placeholder
          if (isLoading || !widgetData) {
            return (
              <div
                key={widget.id}
                className={cn(
                  "border-default-100 min-h-[180px] animate-pulse rounded-md border bg-surface-1",
                  SIZE_CLASS[size]
                )}
              />
            );
          }

          // Backend signalled a per-widget error (e.g. unknown type, compute_failed)
          if ("error" in widgetData) {
            return (
              <div key={widget.id} className={SIZE_CLASS[size]}>
                <WidgetErrorTile title={widget.title} error={widgetData.error} />
              </div>
            );
          }

          return (
            <div key={widget.id} className={SIZE_CLASS[size]}>
              {renderWidget({
                config: widget,
                data: widgetData.data,
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
