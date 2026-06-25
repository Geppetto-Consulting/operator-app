/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: presentation] ENG-389 — demo chrome is DATA-DRIVEN, not a hardcoded
// slug allowlist. A workspace gets the prospect-facing de-chromed treatment
// (the "Work items" board tab, the issue label-chip wall, the default
// project-click landing on the raw issue board are all suppressed; entity rows
// redirect to their canonical Page; pages render read-only) iff its
// server-provided `presentation_config.demo_chrome === true`.
//
// `isDemoWorkspace(slug)` keeps its slug-only signature so the ~15 call sites in
// the app are untouched (rebase-safe). It can't call a React hook from a
// constants module, so the workspace store mirrors each workspace's
// presentation_config into the module-level registry below (see
// store/workspace/index.ts → syncPresentationConfig). The gate then reads from
// that registry — config first, hardcoded list only as a transitional fallback
// for workspaces the store hasn't populated yet (pre-migration prod).
//
// CRITICAL: demo chrome is strictly OPT-IN. An empty/absent presentation_config
// means NO demo chrome. The operator's own workspace never sets demo_chrome, so
// it can never be de-chromed — exactly the anti-pattern (a literal slug list)
// that ENG-389 retires.

import type { IWorkspacePresentationConfig } from "@plane/types";

// [ours: presentation] TRANSITIONAL FALLBACK ONLY. Retained so demo chrome keeps
// working between the code landing and `set_presentation_config` being applied to
// these workspaces in prod. The config registry takes precedence; once these
// three workspaces carry `presentation_config.demo_chrome = true` this list is
// dead and can be deleted. Never add new workspaces here — set their config.
const FALLBACK_DEMO_WORKSPACE_SLUGS: readonly string[] = ["sentio", "gordons", "stirlight"];

// [ours: presentation] Module-level mirror of each workspace's
// presentation_config, keyed by slug. Populated by the workspace store on fetch
// (the store is the single owner of IWorkspace objects). Reading from here keeps
// the slug-only public API while making the gate data-driven.
const PRESENTATION_CONFIG_BY_SLUG: Record<string, IWorkspacePresentationConfig> = {};

const normalizeSlug = (slug: string | string[] | null | undefined): string | undefined => {
  if (!slug) return undefined;
  return Array.isArray(slug) ? slug[0] : slug;
};

// [ours: presentation] Called by the workspace store whenever it ingests a
// workspace, so the registry stays in lock-step with the store's config blob.
export const registerWorkspacePresentationConfig = (
  slug: string | null | undefined,
  config: IWorkspacePresentationConfig | null | undefined
): void => {
  if (!slug) return;
  PRESENTATION_CONFIG_BY_SLUG[slug] = config ?? {};
};

// [ours: presentation] The demo-chrome gate. True iff the workspace opted in via
// presentation_config.demo_chrome. Falls back to the transitional slug list ONLY
// for workspaces the store hasn't registered yet (so prod doesn't regress before
// the config is applied). Never returns true for an empty/absent config that the
// store HAS registered — opt-in is honoured exactly.
export const isDemoWorkspace = (slug: string | string[] | null | undefined): boolean => {
  const s = normalizeSlug(slug);
  if (!s) return false;
  const registered = PRESENTATION_CONFIG_BY_SLUG[s];
  if (registered !== undefined) return registered.demo_chrome === true;
  // Not yet registered by the store (e.g. pre-migration) — transitional fallback.
  return FALLBACK_DEMO_WORKSPACE_SLUGS.includes(s);
};

// [ours: presentation] ENG-298/ENG-389 — "entity substrate" projects whose rows
// resolve straight to the canonical "what we know" Page on click (not a bare
// work-item peek). Driven by presentation_config.entity_project_ids when present,
// else the transitional id list below. The StirLight action project is NOT here —
// there the work item IS the product.
const FALLBACK_DEMO_ENTITY_PROJECT_IDS: readonly string[] = [
  "ca852cb9-e2c5-4862-aa96-659730491d62", // Sentio — Targets (PIPE)
  "cccc36ea-f985-4c10-bac2-824f0291aa01", // Gordons — Clients (REL)
];

// Union of every registered workspace's entity_project_ids, for the slug-less
// id-only call site (isDemoEntityProject takes a project id, not a slug).
const registeredEntityProjectIds = (): string[] => {
  const ids: string[] = [];
  for (const cfg of Object.values(PRESENTATION_CONFIG_BY_SLUG)) {
    if (Array.isArray(cfg.entity_project_ids)) ids.push(...cfg.entity_project_ids);
  }
  return ids;
};

export const isDemoEntityProject = (projectId: string | null | undefined): boolean => {
  if (!projectId) return false;
  const fromConfig = registeredEntityProjectIds();
  if (fromConfig.length > 0) return fromConfig.includes(projectId);
  // No workspace has declared entity_project_ids yet — transitional fallback.
  return FALLBACK_DEMO_ENTITY_PROJECT_IDS.includes(projectId);
};

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
