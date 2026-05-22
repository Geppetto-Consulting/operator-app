/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Operator fork — see ENG-177 / ENG-179.
// The legacy /projects/<id>/views/ route now renders the project Dashboard.
// The Plane saved-views (IssueView) substrate is kept intact (ENG-116 schema)
// and is still reachable via the detail route at /views/<viewId>/.

import { observer } from "mobx-react";
// plane imports
import { useTheme } from "next-themes";
// hooks
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EUserProjectRoles } from "@plane/types";
// assets
import darkViewsAsset from "@/app/assets/empty-state/disabled-feature/views-dark.webp?url";
import lightViewsAsset from "@/app/assets/empty-state/disabled-feature/views-light.webp?url";
// components
import { PageHead } from "@/components/core/page-title";
import { Dashboard } from "@/components/dashboard/root";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { Route } from "./+types/page";

function ProjectDashboardPage({ params }: Route.ComponentProps) {
  // router
  const router = useAppRouter();
  const { workspaceSlug, projectId } = params;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // store
  const { getProjectById, currentProjectDetails } = useProject();
  const { allowPermissions } = useUserPermissions();
  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project?.name} - Dashboard` : undefined;
  const canPerformEmptyStateActions = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);
  const resolvedPath = resolvedTheme === "light" ? lightViewsAsset : darkViewsAsset;

  // The project feature flag is still keyed `issue_views_view` (Plane upstream);
  // we reuse it as the gating flag for the Dashboard feature in this operator
  // fork. If a workspace disabled "Views" upstream, they get the disabled empty
  // state — no surprise change in behaviour.
  if (currentProjectDetails?.issue_views_view === false)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <DetailedEmptyState
          title={t("disabled_project.empty_state.view.title")}
          description={t("disabled_project.empty_state.view.description")}
          assetPath={resolvedPath}
          primaryButton={{
            text: t("disabled_project.empty_state.view.primary_button.text"),
            onClick: () => {
              router.push(`/${workspaceSlug}/settings/projects/${projectId}/features`);
            },
            disabled: !canPerformEmptyStateActions,
          }}
        />
      </div>
    );

  return (
    <>
      <PageHead title={pageTitle} />
      <Dashboard workspaceSlug={workspaceSlug} projectId={projectId} />
    </>
  );
}

export default observer(ProjectDashboardPage);
