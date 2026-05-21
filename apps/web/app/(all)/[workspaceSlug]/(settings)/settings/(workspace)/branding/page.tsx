/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * [ours: brand] Operator fork — ENG-114 / Phase 2 of the Plane-fork programme.
 * Workspace settings Branding tab. Admin-only — gated server-side by the
 * WorkSpaceBasePermission and client-side by EUserPermissions.ADMIN.
 */

import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { WorkspaceBranding } from "@/components/workspace/settings/workspace-branding";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { BrandingWorkspaceSettingsHeader } from "./header";

function BrandingPage() {
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();

  // derived values
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const pageTitle = currentWorkspace?.name ? `${currentWorkspace.name} - Branding` : "Branding";

  if (workspaceUserInfo && !isAdmin) {
    return <NotAuthorizedView section="settings" className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<BrandingWorkspaceSettingsHeader />} hugging>
      <PageHead title={pageTitle} />
      <div
        className={cn("flex w-full flex-col gap-y-6", {
          "opacity-60": !isAdmin,
        })}
      >
        <SettingsHeading
          title={t("workspace_settings.settings.branding.heading")}
          description={t("workspace_settings.settings.branding.description")}
        />
        <WorkspaceBranding />
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(BrandingPage);
