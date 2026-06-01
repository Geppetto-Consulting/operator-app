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

// [ours: demo-chrome] ENG-298 — "entity substrate" projects on the intelligence desks
// (Sentio Targets, Gordons Clients). Each issue here is a thin work-item that exists
// only to carry an entity and link to its canonical "what we know" Page. Every persona
// review said the same thing: clicking the row should open that Page directly, not a
// bare work-item peek. For issues in these projects we resolve the peek straight to the
// canonical page. NOT the StirLight action project — there the work item IS the product.
export const DEMO_ENTITY_PROJECT_IDS: readonly string[] = [
  "ca852cb9-e2c5-4862-aa96-659730491d62", // Sentio — Targets (PIPE)
  "cccc36ea-f985-4c10-bac2-824f0291aa01", // Gordons — Clients (REL)
];

export const isDemoEntityProject = (projectId: string | null | undefined): boolean =>
  !!projectId && DEMO_ENTITY_PROJECT_IDS.includes(projectId);

// Extract the canonical page URL from an entity issue's description_html — the first
// in-workspace "/<ws>/projects/<pid>/pages/<uuid>/" link. Returns null if absent.
export const canonicalPageHrefFromDescription = (html: string | null | undefined): string | null => {
  if (!html) return null;
  const m = html.match(/href="((?:https?:\/\/[^"]+)?\/[^"/]+\/projects\/[0-9a-f-]+\/pages\/[0-9a-f-]+\/?)"/i);
  if (!m) return null;
  try {
    // normalise to a path (strip origin) so the SPA router handles it
    return m[1].replace(/^https?:\/\/[^/]+/i, "");
  } catch {
    return null;
  }
};
