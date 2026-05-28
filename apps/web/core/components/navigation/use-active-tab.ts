/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import type { TIssue } from "@plane/types";
import type { TNavigationItem } from "@/components/navigation/tab-navigation-root";

type UseActiveTabProps = {
  navigationItems: TNavigationItem[];
  pathname: string;
  workItemId?: string;
  workItem?: TIssue;
  projectId: string;
};

export const useActiveTab = ({ navigationItems, pathname, workItemId, workItem, projectId }: UseActiveTabProps) => {
  // Raw match for a navigation item against the current pathname.
  // [ours: views] ENG-276 — this is now the "candidate" check; the public
  // `isActive` below adds longest-href precedence so nested tabs (e.g. Views
  // at /views/list) win over their parent (Dashboard at /views) when both
  // would otherwise match. Without that, two tabs would highlight on
  // /views/list and the active item would resolve to whichever came first
  // by sortOrder.
  const matchesPathname = useCallback(
    (item: TNavigationItem) => {
      const workItemCondition = workItemId && workItem && !workItem?.is_epic && workItem?.project_id === projectId;
      const epicCondition = workItemId && workItem && workItem?.is_epic && workItem?.project_id === projectId;
      const isWorkItemActive = item.key === "work_items" && workItemCondition;
      const isEpicActive = item.key === "epics" && epicCondition;
      const isPathnameActive = pathname === item.href || pathname.startsWith(item.href + "/");
      return Boolean(isWorkItemActive || isEpicActive || isPathnameActive);
    },
    [pathname, workItem, workItemId, projectId]
  );

  // Longest-matching item among candidates — only one wins.
  const longestMatch = useMemo(() => {
    const matches = navigationItems.filter((item) => matchesPathname(item));
    if (matches.length === 0) return undefined;
    // oxlint-disable-next-line eslint-plugin-unicorn(no-array-sort)
    return [...matches].sort((a, b) => b.href.length - a.href.length)[0];
  }, [navigationItems, matchesPathname]);

  const isActive = useCallback(
    (item: TNavigationItem) => longestMatch?.key === item.key,
    [longestMatch]
  );

  return { isActive, activeItem: longestMatch };
};
