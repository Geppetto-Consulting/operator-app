/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] recent_activity widget — see ENG-179 brief §4.2.
// Per ENG-178 audit-findings: backend returns updated_by as a UUID string (not
// {id, display_name}). We resolve display via the member store; fall back to
// "Unknown" if the member isn't in scope. The select_related on the backend is
// wasted work today but keeps the API surface stable for a future shape change.

import { observer } from "mobx-react";
import { Avatar } from "@plane/propel/avatar";
import { Tooltip } from "@plane/propel/tooltip";
import type { TRecentActivityWidgetConfig, TRecentActivityWidgetData } from "@plane/types";
import { calculateTimeAgo } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TRecentActivityWidgetConfig;
  data: TRecentActivityWidgetData;
  workspaceSlug: string;
  projectId: string;
};

export const RecentActivityWidget = observer(function RecentActivityWidget({
  config,
  data,
  workspaceSlug,
  projectId,
}: Props) {
  const { setPeekIssue } = useIssueDetail();
  const { getUserDetails } = useMember();
  const issues = data.issues ?? [];

  if (issues.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No recent activity." />
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
          const updater = issue.updated_by ? getUserDetails(issue.updated_by) : undefined;
          const updaterName = updater?.display_name ?? "Unknown";
          const updaterAvatar = updater?.avatar_url;
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
                <span className="flex flex-shrink-0 items-center gap-2">
                  <Tooltip tooltipContent={`Updated by ${updaterName}`} position="left">
                    <Avatar name={updaterName} src={updaterAvatar} size="sm" showTooltip={false} />
                  </Tooltip>
                  <span className="text-11 text-placeholder tabular-nums">{calculateTimeAgo(issue.updated_at)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
});
