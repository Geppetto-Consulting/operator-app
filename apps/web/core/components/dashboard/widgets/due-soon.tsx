/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] due_soon widget — see ENG-179 brief §4.2.
// Backend (ENG-178) filters by target_date<=horizon and excludes
// completed/cancelled state groups. NOTE per audit-findings: there's no lower
// bound, so overdue items appear here too — that's intentional ("due soon"
// includes overdue). We visually distinguish overdue rows with a red date.

import { observer } from "mobx-react";
import { Tooltip } from "@plane/propel/tooltip";
import type { TDueSoonWidgetConfig, TDueSoonWidgetData } from "@plane/types";
import { cn, renderFormattedDate } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TDueSoonWidgetConfig;
  data: TDueSoonWidgetData;
  workspaceSlug: string;
  projectId: string;
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export const DueSoonWidget = observer(function DueSoonWidget({ config, data, workspaceSlug, projectId }: Props) {
  const { setPeekIssue } = useIssueDetail();
  const issues = data.issues ?? [];

  if (issues.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="Nothing due soon." />
      </WidgetShell>
    );
  }

  const handlePeek = (issueId: string) => () => {
    setPeekIssue({ workspaceSlug, projectId, issueId });
  };

  return (
    <WidgetShell title={config.title}>
      <ul className="divide-default-100 flex flex-1 flex-col divide-y">
        {issues.map((issue) => {
          const overdue = isOverdue(issue.due_date);
          return (
            <li key={issue.id}>
              <button
                type="button"
                onClick={handlePeek(issue.id)}
                className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface-2/40"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-13 font-medium text-primary">{issue.name}</span>
                  <span className="text-11 text-placeholder">#{issue.sequence_id}</span>
                </span>
                <span
                  className={cn("flex-shrink-0 text-12 tabular-nums", {
                    "text-red-500": overdue,
                    "text-placeholder": !overdue,
                  })}
                >
                  <Tooltip tooltipContent={overdue ? "Overdue" : "Due"} position="left">
                    <span>{issue.due_date ? (renderFormattedDate(issue.due_date) ?? "—") : "—"}</span>
                  </Tooltip>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
});
