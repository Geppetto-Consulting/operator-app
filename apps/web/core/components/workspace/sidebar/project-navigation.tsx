/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { EUserPermissionsLevel, EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import {
  CycleIcon,
  DashboardIcon,
  IntakeIcon,
  ModuleIcon,
  PageIcon,
  WorkItemsIcon,
} from "@plane/propel/icons";
import type { EUserProjectRoles } from "@plane/types";
// plane ui
// components
import { SidebarNavItem } from "@/components/sidebar/sidebar-navigation";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// [ours: terminology] Operator fork — per-project work-item label override (ENG-119)
import { useProjectTerminology } from "@/hooks/use-project-terminology";

export type TNavigationItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  access: EUserPermissions[] | EUserProjectRoles[];
  shouldRender: boolean;
  sortOrder: number;
  i18n_key: string;
  key: string;
};

type TProjectItemsProps = {
  workspaceSlug: string;
  projectId: string;
  additionalNavigationItems?: (workspaceSlug: string, projectId: string) => TNavigationItem[];
};

export const ProjectNavigation = observer(function ProjectNavigation(props: TProjectItemsProps) {
  const { workspaceSlug, projectId, additionalNavigationItems } = props;
  const { workItem: workItemIdentifierFromRoute } = useParams();
  // store hooks
  const { t } = useTranslation();
  // [ours: terminology] resolve per-project label for the "Work items" nav entry (ENG-119)
  const term = useProjectTerminology(projectId);
  const { isExtendedProjectSidebarOpened, toggleExtendedProjectSidebar, toggleSidebar } = useAppTheme();
  const { getPartialProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  const {
    issue: { getIssueIdByIdentifier, getIssueById },
  } = useIssueDetail();
  // pathname
  const pathname = usePathname();
  // derived values
  const workItemId = workItemIdentifierFromRoute
    ? getIssueIdByIdentifier(workItemIdentifierFromRoute?.toString())
    : undefined;
  const workItem = workItemId ? getIssueById(workItemId) : undefined;
  const project = getPartialProjectById(projectId);
  // handlers
  const handleProjectClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
    // close the extended sidebar if it is open
    if (isExtendedProjectSidebarOpened) {
      toggleExtendedProjectSidebar(false);
    }
  };

  const baseNavigation = useCallback(
    (wsSlug: string, pId: string): TNavigationItem[] => [
      {
        i18n_key: "sidebar.work_items",
        key: "work_items",
        name: "Work items",
        href: `/${wsSlug}/projects/${pId}/issues`,
        icon: WorkItemsIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: true,
        sortOrder: 1,
      },
      {
        i18n_key: "sidebar.cycles",
        key: "cycles",
        name: "Cycles",
        href: `/${wsSlug}/projects/${pId}/cycles`,
        icon: CycleIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
        shouldRender: project?.cycle_view ?? false,
        sortOrder: 2,
      },
      {
        i18n_key: "sidebar.modules",
        key: "modules",
        name: "Modules",
        href: `/${wsSlug}/projects/${pId}/modules`,
        icon: ModuleIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
        shouldRender: project?.module_view ?? false,
        sortOrder: 3,
      },
      {
        // [ours: project dashboards] ENG-179 — Views→Dashboard rename.
        // Icon swapped to DashboardIcon in ENG-276 so it's visually distinct
        // from the restored Views tab below.
        i18n_key: "sidebar.views",
        key: "views",
        name: "Dashboard",
        href: `/${wsSlug}/projects/${pId}/views`,
        icon: DashboardIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: project?.issue_views_view ?? false,
        sortOrder: 4,
      },
      // [ours: views] ENG-298 — hide saved-Views list sidebar tab across all
      // projects in all workspaces. Dashboard tab above stays (it surfaces the
      // views_list widget when configured). Route /views/list/ remains reachable
      // by direct URL for admin/dev use.
      {
        i18n_key: "sidebar.pages",
        key: "pages",
        name: "Pages",
        href: `/${wsSlug}/projects/${pId}/pages`,
        icon: PageIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: project?.page_view ?? false,
        sortOrder: 6,
      },
      {
        i18n_key: "sidebar.intake",
        key: "intake",
        name: "Intake",
        href: `/${wsSlug}/projects/${pId}/intake`,
        icon: IntakeIcon,
        access: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.GUEST],
        shouldRender: project?.inbox_view ?? false,
        sortOrder: 7,
      },
    ],
    [project]
  );

  // memoized navigation items and adding additional navigation items
  const navigationItemsMemo = useMemo(() => {
    const buildNavigationItems = (wsSlug: string, pId: string): TNavigationItem[] => {
      const navItems = baseNavigation(wsSlug, pId);

      if (additionalNavigationItems) {
        navItems.push(...additionalNavigationItems(wsSlug, pId));
      }

      return navItems;
    };

    // sort navigation items by sortOrder
    // [ours] toSorted would be tidier but the apps/web tsconfig targets ES2022,
    // which doesn't include Array.prototype.toSorted in its lib. Spread-then-sort
    // keeps the result non-mutating without bumping the lib target.
    // oxlint-disable-next-line eslint-plugin-unicorn(no-array-sort)
    const sortedNavigationItems = [...buildNavigationItems(workspaceSlug, projectId)].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
    );

    return sortedNavigationItems;
  }, [workspaceSlug, projectId, baseNavigation, additionalNavigationItems]);

  // Raw match — the public `isActive` below adds longest-href precedence so
  // nested sidebar entries (Views at /views/list) win over their parent
  // (Dashboard at /views) when both would otherwise match. ENG-276.
  const matchesPathname = useCallback(
    (item: TNavigationItem) => {
      const workItemCondition = workItemId && workItem && !workItem?.is_epic && workItem?.project_id === projectId;
      const epicCondition = workItemId && workItem && workItem?.is_epic && workItem?.project_id === projectId;
      const isWorkItemActive = item.key === "work_items" && workItemCondition;
      const isEpicActive = item.key === "epics" && epicCondition;
      const isPathnameActive = pathname.includes(item.href);
      return Boolean(isWorkItemActive || isEpicActive || isPathnameActive);
    },
    [pathname, workItem, workItemId, projectId]
  );

  const longestMatchKey = useMemo(() => {
    const matches = navigationItemsMemo.filter((item) => matchesPathname(item));
    if (matches.length === 0) return undefined;
    // oxlint-disable-next-line eslint-plugin-unicorn(no-array-sort)
    return [...matches].sort((a, b) => b.href.length - a.href.length)[0].key;
  }, [navigationItemsMemo, matchesPathname]);

  const isActive = useCallback(
    (item: TNavigationItem) => longestMatchKey === item.key,
    [longestMatchKey]
  );

  if (!project) return null;

  return (
    <>
      {navigationItemsMemo.map((item) => {
        if (!item.shouldRender) return;

        const hasAccess = allowPermissions(item.access, EUserPermissionsLevel.PROJECT, workspaceSlug, project.id);
        if (!hasAccess) return null;

        const shouldShowCount = item.key === "intake" && (project.intake_count ?? 0) > 0;

        return (
          <Link key={item.key} href={item.href} onClick={handleProjectClick}>
            <SidebarNavItem isActive={!!isActive(item)}>
              <div className="flex w-full items-center justify-between gap-1.5 py-[1px]">
                <div className="flex items-center gap-1.5">
                  <item.icon
                    className={`size-4 flex-shrink-0 ${item.name === "Intake" ? "stroke-1" : "stroke-[1.5]"}`}
                  />
                  {/* [ours: terminology] override work_items label per-project (ENG-119) */}
                  <span className="text-11 font-medium">
                    {item.key === "work_items" ? term.plural : t(item.i18n_key)}
                  </span>
                </div>
                {shouldShowCount && <span className="text-11 font-medium text-tertiary">{project.intake_count}</span>}
              </div>
            </SidebarNavItem>
          </Link>
        );
      })}
    </>
  );
});
