/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * [ours: terminology] Operator fork — apps/web convenience wrapper.
 *
 * Phase 7 of the Plane-fork programme (ENG-119). The lower-level
 * useTerminology(arg) in @plane/i18n is decoupled from any store; this thin
 * wrapper bridges it to the project store so call sites don't repeat
 * `useProject().currentProjectDetails?.terminology` at every leaf.
 *
 * Usage:
 *   const term = useProjectTerminology();                 // current project from router
 *   const term = useProjectTerminology(projectId);        // explicit project (sidebar entries, etc.)
 *   return <h1>{term.plural}</h1>;
 *
 * Falls back to OPERATOR_DEFAULT_TERMINOLOGY ("Work item" / "Work items" /
 * "Add work item") on a per-key basis when the project has no overrides,
 * or when called outside a project context (e.g. workspace-level views).
 */

import { useTerminology, type TResolvedTerminology } from "@plane/i18n";
// hooks
import { useProject } from "@/hooks/store/use-project";

export const useProjectTerminology = (projectId?: string | null): TResolvedTerminology => {
  const { currentProjectDetails, getPartialProjectById } = useProject();
  // Prefer explicit projectId (workspace-sidebar surfaces render entries for
  // arbitrary projects, not necessarily the one in the URL). Fall back to the
  // currently-routed project. Fall back to operator defaults when neither.
  const terminology = projectId
    ? getPartialProjectById(projectId)?.terminology
    : currentProjectDetails?.terminology;
  return useTerminology(terminology);
};
