/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: views] Layout for the restored Project Views (saved-views) list page.
// Sister of /views/(list)/layout.tsx (which now hosts the Dashboard repurpose).
// See ENG-276.

import { Outlet } from "react-router";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
// local components
import { ProjectSavedViewsHeader } from "./header";

export default function ProjectSavedViewsLayout() {
  return (
    <>
      <AppHeader header={<ProjectSavedViewsHeader />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </>
  );
}
