/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [ours: project dashboards] ENG-270 — recent_pages widget.
// Timeline-style list of newest N Pages with an optional name filter. Each
// row links to the Page detail. Shares the shape of recent_activity but
// targets the Pages table — workspace-purpose surface for "what content
// have we produced lately."

import { observer } from "mobx-react";
import Link from "next/link";
import type { TRecentPagesWidgetConfig, TRecentPagesWidgetData } from "@plane/types";
import { calculateTimeAgo } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TRecentPagesWidgetConfig;
  data: TRecentPagesWidgetData;
};

function pageHref(workspaceSlug: string | null, projectId: string, pageId: string): string {
  if (!workspaceSlug) return "#";
  return `/${workspaceSlug}/projects/${projectId}/pages/${pageId}`;
}

export const RecentPagesWidget = observer(function RecentPagesWidget({ config, data }: Props) {
  const pages = data.pages ?? [];
  const workspaceSlug = data.workspace_slug;
  const projectId = data.project_id;

  if (pages.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No recent pages." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      title={config.title}
      headerRight={<span className="text-12 text-placeholder">{pages.length}</span>}
    >
      <ul className="divide-default-100 flex flex-1 flex-col divide-y">
        {pages.map((page) => (
          <li key={page.id}>
            <Link
              href={pageHref(workspaceSlug, projectId, page.id)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface-2/40"
            >
              <span className="truncate text-13 font-medium text-custom-text-100">
                {page.name || "Untitled"}
              </span>
              <span className="text-11 text-placeholder tabular-nums flex-shrink-0">
                {page.updated_at ? calculateTimeAgo(page.updated_at) : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
});
