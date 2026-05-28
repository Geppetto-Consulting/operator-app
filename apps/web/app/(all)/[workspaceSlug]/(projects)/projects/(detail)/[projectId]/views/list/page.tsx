/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: views] Operator fork — see ENG-179 / ENG-276.
// The legacy /projects/<id>/views/ route was repurposed to render the project
// Dashboard. This route brings back the upstream saved-Views list at a distinct
// path (`/views/list/`) so the sidebar can offer it as its own tab without
// stepping on the dashboard. The underlying IssueView substrate is unchanged.

import { observer } from "mobx-react";
import { useTheme } from "next-themes";
// plane imports
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EUserProjectRoles } from "@plane/types";
// assets
import darkViewsAsset from "@/app/assets/empty-state/disabled-feature/views-dark.webp?url";
import lightViewsAsset from "@/app/assets/empty-state/disabled-feature/views-light.webp?url";
// components
import { PageHead } from "@/components/core/page-title";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { ProjectViewsList } from "@/components/views/views-list";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import type { Route } from "./+types/page";

function ProjectSavedViewsPage({ params }: Route.ComponentProps) {
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
  const pageTitle = project?.name ? `${project?.name} - Views` : undefined;
  const canPerformEmptyStateActions = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);
  const resolvedPath = resolvedTheme === "light" ? lightViewsAsset : darkViewsAsset;

  // The `issue_views_view` project feature flag also gates the Views list page.
  // Same flag is reused for the Dashboard repurpose, so the two tabs co-light
  // and co-hide. See `use-navigation-items.ts` `shouldRender` for the matching
  // sidebar gate.
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
      <ProjectViewsList />
    </>
  );
}

export default observer(ProjectSavedViewsPage);
