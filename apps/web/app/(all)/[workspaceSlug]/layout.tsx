/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
// [ours: brand] ENG-114 — per-workspace CSS-var injection (runtime override
// of `--brand-default` based on `currentWorkspace.brand_color`).
import { WorkspaceBrandVarInjector } from "@/components/workspace/brand-var-injector";
import { WorkspaceContentWrapper } from "@/plane-web/components/workspace/content-wrapper";
import { AppRailVisibilityProvider } from "@/plane-web/hooks/app-rail";
import { GlobalModals } from "@/plane-web/components/common/modal/global";
import { WorkspaceAuthWrapper } from "@/layouts/auth-layout/workspace-wrapper";
import type { Route } from "./+types/layout";

export default function WorkspaceLayout(props: Route.ComponentProps) {
  const { workspaceSlug } = props.params;

  return (
    <AuthenticationWrapper>
      <WorkspaceAuthWrapper>
        <AppRailVisibilityProvider>
          {/* [ours: brand] Mounted inside the workspace-scoped tree so the
              effect's cleanup fires on workspace exit; mounted ABOVE the
              content wrapper so the CSS var is set before children paint. */}
          <WorkspaceBrandVarInjector />
          <WorkspaceContentWrapper>
            <GlobalModals workspaceSlug={workspaceSlug} />
            <Outlet />
          </WorkspaceContentWrapper>
        </AppRailVisibilityProvider>
      </WorkspaceAuthWrapper>
    </AuthenticationWrapper>
  );
}
