/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * [ours: brand] Operator fork — ENG-114 / Phase 2 of the Plane-fork programme.
 *
 * Runtime CSS-var injector. Watches `currentWorkspace.brand_color` (an oklch()
 * string or a hex value persisted on the Workspace row) and writes
 * `--brand-default` to `document.documentElement` for the lifetime of the
 * workspace. When the value is null/empty (operator default), the var is
 * removed so the static value from `packages/tailwind-config/variables.css`
 * is used.
 *
 * Why a CSS variable and not a per-page <style> tag:
 *   - `--brand-default` is the single seam through which the whole token
 *     system (bg-accent-primary, border-accent-strong, etc.) reads from.
 *   - Setting it on the documentElement avoids a hydration/flash race
 *     because `<style>` injection in the document head requires server-side
 *     coordination we don't have here (the workspace isn't known until the
 *     auth store hydrates).
 *   - On workspace switch (e.g. tab navigation), the effect re-runs and the
 *     value is overwritten in place — no global CSS state leaks because we
 *     unconditionally restore on unmount.
 *
 * Isolation note: each tab has its own document, so opening Workspace A in
 * tab 1 and Workspace B in tab 2 does NOT cross-leak — they're disjoint
 * documents. The "global state" concern only matters across rapid
 * workspace switches in the same tab, which this effect handles.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";

const BRAND_DEFAULT_VAR = "--brand-default";

export const WorkspaceBrandVarInjector = observer(function WorkspaceBrandVarInjector() {
  const { currentWorkspace } = useWorkspace();
  const brandColor = currentWorkspace?.brand_color ?? null;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    if (brandColor && brandColor.trim() !== "") {
      root.style.setProperty(BRAND_DEFAULT_VAR, brandColor);
    } else {
      // Restore the static default from variables.css.
      root.style.removeProperty(BRAND_DEFAULT_VAR);
    }
    return () => {
      // On unmount (leaving the workspace-scoped tree), restore the default
      // so unbranded surfaces (e.g. the sign-in page) don't inherit the
      // previous workspace's accent colour.
      root.style.removeProperty(BRAND_DEFAULT_VAR);
    };
  }, [brandColor]);

  return null;
});
