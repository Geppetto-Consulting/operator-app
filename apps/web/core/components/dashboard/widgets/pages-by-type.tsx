/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [ours: project dashboards] ENG-270 — pages_by_type widget.
// Renders Pages partitioned into named groups (Acquisition Assessments,
// sector maps, etc.). Each row links to the Page detail. Groups with no
// pages still render (with a placeholder line) so the dashboard's visual
// shape stays stable across project lifecycle — empty group today, two
// assessments next week.

import { observer } from "mobx-react";
import Link from "next/link";
import type { TPagesByTypeWidgetConfig, TPagesByTypeWidgetData } from "@plane/types";
import { calculateTimeAgo } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TPagesByTypeWidgetConfig;
  data: TPagesByTypeWidgetData;
};

function pageHref(workspaceSlug: string | null, projectId: string, pageId: string): string {
  if (!workspaceSlug) return "#";
  return `/${workspaceSlug}/projects/${projectId}/pages/${pageId}`;
}

export const PagesByTypeWidget = observer(function PagesByTypeWidget({ config, data }: Props) {
  const groups = data.groups ?? [];
  const workspaceSlug = data.workspace_slug;
  const projectId = data.project_id;

  const totalPages = groups.reduce((sum, g) => sum + (g.pages?.length ?? 0), 0);
  if (groups.length === 0 || totalPages === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No pages yet." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      title={config.title}
      headerRight={<span className="text-12 text-placeholder">{totalPages}</span>}
    >
      <div className="flex flex-1 flex-col gap-3">
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-12 font-medium uppercase tracking-wide text-custom-text-300">
                {group.title}
              </h4>
              <span className="text-11 text-placeholder tabular-nums">{group.pages?.length ?? 0}</span>
            </div>
            {group.pages && group.pages.length > 0 ? (
              <ul className="divide-default-100 flex flex-col divide-y">
                {group.pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={pageHref(workspaceSlug, projectId, page.id)}
                      className="flex w-full items-center justify-between gap-3 py-1.5 text-left hover:bg-surface-2/40"
                    >
                      <span className="truncate text-13 text-custom-text-100">
                        {page.name || "Untitled"}
                      </span>
                      <span className="text-11 text-placeholder tabular-nums flex-shrink-0">
                        {page.updated_at ? calculateTimeAgo(page.updated_at) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-11 text-placeholder py-1">None yet.</div>
            )}
          </section>
        ))}
      </div>
    </WidgetShell>
  );
});
