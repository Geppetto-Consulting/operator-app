/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { ViewsIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { ViewListHeader } from "@/components/views/view-list-header";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// plane web imports
import { CommonProjectBreadcrumbs } from "@/plane-web/components/breadcrumbs/common";

// [ours: views] header for the restored Project Views (saved-views) list page.
// Sits at /projects/<id>/views/list/ to coexist with the project Dashboard at
// /projects/<id>/views/ (ENG-179). See ENG-276.
export const ProjectSavedViewsHeader = observer(function ProjectSavedViewsHeader() {
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { loader, currentProjectDetails } = useProject();
  const { toggleCreateViewModal } = useCommandPalette();
  const { allowPermissions } = useUserPermissions();

  const canCreateView = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  return (
    <Header>
      <Header.LeftItem>
        <Breadcrumbs isLoading={loader === "init-loader"}>
          <CommonProjectBreadcrumbs workspaceSlug={workspaceSlug?.toString()} projectId={projectId?.toString()} />
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label="Views"
                href={`/${workspaceSlug}/projects/${projectId}/views/list/`}
                icon={<ViewsIcon className="h-4 w-4 text-tertiary" />}
                isLast
              />
            }
            isLast
          />
        </Breadcrumbs>
      </Header.LeftItem>
      <Header.RightItem>
        <ViewListHeader />
        {canCreateView && currentProjectDetails?.issue_views_view && (
          <Button variant="primary" size="lg" onClick={() => toggleCreateViewModal(true)}>
            Add view
          </Button>
        )}
      </Header.RightItem>
    </Header>
  );
});
