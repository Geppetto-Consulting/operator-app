/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] ENG-198 — touchpoint_due widget.
// Lists stale issues (no activity in N+ days, default 14). Click peeks the
// issue (same pattern as due-soon / recent-activity). Empty-state messaging
// references the actual threshold so the user knows what "stale" means.

import { observer } from "mobx-react";
import type { TTouchpointDueWidgetConfig, TTouchpointDueWidgetData } from "@plane/types";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TTouchpointDueWidgetConfig;
  data: TTouchpointDueWidgetData;
  workspaceSlug: string;
  projectId: string;
};

function formatQuiet(days: number | null): string {
  if (days === null || days === undefined || Number.isNaN(days)) return "quiet";
  if (days <= 0) return "today";
  if (days === 1) return "1 day quiet";
  return `${days} days quiet`;
}

export const TouchpointDueWidget = observer(function TouchpointDueWidget({
  config,
  data,
  workspaceSlug,
  projectId,
}: Props) {
  const { setPeekIssue } = useIssueDetail();
  const issues = data.issues ?? [];
  const threshold = data.stale_threshold_days ?? config.stale_days ?? 14;

  if (issues.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message={`Nothing quiet for ${threshold}+ days.`} />
      </WidgetShell>
    );
  }

  const handlePeek = (issueId: string) => () => {
    setPeekIssue({ workspaceSlug, projectId, issueId });
  };

  return (
    <WidgetShell title={config.title}>
      <ul className="divide-default-100 flex flex-1 flex-col divide-y">
        {issues.map((issue) => (
          <li key={issue.id}>
            <button
              type="button"
              onClick={handlePeek(issue.id)}
              className="hover:bg-custom-background-80 flex w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-custom-text-100 truncate text-13 font-medium">{issue.name}</span>
                <span className="text-custom-text-400 text-11 tabular-nums">{issue.identifier}</span>
              </span>
              <span className="text-custom-text-300 flex-shrink-0 text-12 tabular-nums">
                {formatQuiet(issue.days_since)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
});
