/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: demo-chrome] ENG-298 — single source of truth for the prospect-facing
// demo workspaces. These workspaces are shown to external prospects as polished,
// product-shaped intelligence/chief-of-staff desks, so we suppress raw
// project-management chrome (the "Work items" board tab, the issue label-chip
// wall, and the default project-click landing on the raw issue board) for them.
// Reachability of individual work items is NOT removed — only the dev-tooling
// clothing. Internal/customer-admin workspaces are unaffected.
export const DEMO_WORKSPACE_SLUGS: readonly string[] = ["sentio", "gordons", "stirlight"];

export const isDemoWorkspace = (slug: string | string[] | null | undefined): boolean => {
  if (!slug) return false;
  const s = Array.isArray(slug) ? slug[0] : slug;
  return DEMO_WORKSPACE_SLUGS.includes(s);
};
