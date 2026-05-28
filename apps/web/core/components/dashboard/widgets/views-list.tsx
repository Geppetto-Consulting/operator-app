/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [ours: project dashboards] ENG-270 — views_list widget.
// Renders saved IssueViews as a clickable list. Each row links to the View's
// detail page so the dashboard becomes a navigable entry point into the
// per-business cuts (sectors, partners, deadlines) configured for a workspace.
//
// URL shape comes from apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/views/(detail)/[viewId]/.
// Workspace-level Views (no project_id) route to /<slug>/workspace-views/<id>/.

import { observer } from "mobx-react";
import Link from "next/link";
import type { TViewsListWidgetConfig, TViewsListWidgetData } from "@plane/types";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TViewsListWidgetConfig;
  data: TViewsListWidgetData;
};

function viewHref(workspaceSlug: string | null, projectId: string | null, viewId: string): string {
  if (!workspaceSlug) return "#";
  if (projectId) return `/${workspaceSlug}/projects/${projectId}/views/${viewId}`;
  // Workspace-level Views — the fork exposes them under /workspace-views/.
  return `/${workspaceSlug}/workspace-views/${viewId}`;
}

export const ViewsListWidget = observer(function ViewsListWidget({ config, data }: Props) {
  const views = data.views ?? [];

  if (views.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No saved Views yet." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      title={config.title}
      headerRight={<span className="text-12 text-placeholder">{views.length}</span>}
    >
      <ul className="divide-default-100 flex flex-1 flex-col divide-y">
        {views.map((view) => {
          const href = viewHref(view.workspace_slug, view.project_id, view.id);
          return (
            <li key={view.id}>
              <Link
                href={href}
                className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface-2/40"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-13 font-medium text-custom-text-100">{view.name}</span>
                  {view.description ? (
                    <span className="truncate text-11 text-placeholder">{view.description}</span>
                  ) : null}
                </span>
                <span className="text-custom-text-300 flex-shrink-0 text-12" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
});
