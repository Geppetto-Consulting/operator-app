/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * [ours: terminology] Operator fork — per-project terminology hook.
 *
 * Phase 6 of the Plane-fork programme (ENG-118). This hook is the SINGLE seam
 * components reach for when they want to render the per-project "Work item"
 * label (e.g. "Contact" in REL, "Prospect" in PIPE, "Briefing" in COS). Phase 7
 * (ENG-119) does the component-by-component rollout that calls this hook.
 *
 * Design decisions:
 * - The hook is decoupled from any store: callers pass the project terminology
 *   object explicitly. This keeps @plane/i18n free of an apps/web (or any
 *   peer) store dependency and makes the hook trivially testable.
 * - Callers wire it up like:
 *     const project = useProject().currentProjectDetails;
 *     const term = useTerminology(project?.terminology);
 *     return <h1>{term.plural}</h1>;
 * - Empty / partial / undefined input falls back per-key to
 *   OPERATOR_DEFAULT_TERMINOLOGY so missing keys never render undefined.
 */

import { useMemo } from "react";

export type TProjectTerminology = {
  singular?: string;
  plural?: string;
  verb_create?: string;
};

export type TResolvedTerminology = Required<TProjectTerminology>;

export const OPERATOR_DEFAULT_TERMINOLOGY: TResolvedTerminology = {
  singular: "Work item",
  plural: "Work items",
  verb_create: "Add work item",
};

/**
 * useTerminology — returns the resolved terminology for a project, merging
 * the project's overrides (if any) with the operator defaults on a per-key
 * basis. Pass `undefined` (or omit) when the caller is outside any project
 * context — you'll get the operator defaults back.
 *
 * Examples:
 *   useTerminology()                                          // → defaults
 *   useTerminology({})                                        // → defaults
 *   useTerminology({ plural: "Contacts" })                    // → { singular: "Work item", plural: "Contacts", verb_create: "Add work item" }
 *   useTerminology({ singular: "Contact", plural: "Contacts", verb_create: "Add contact" })
 *                                                             // → exactly those three values
 */
export function useTerminology(projectTerminology?: TProjectTerminology | null): TResolvedTerminology {
  return useMemo(() => resolveTerminology(projectTerminology), [projectTerminology]);
}

/**
 * resolveTerminology — pure, framework-free resolver. Exported for non-React
 * callers (utilities, server-rendered paths) that need the same fallback
 * logic without the useMemo wrapper. Also used internally by useTerminology()
 * so both paths share the merge rule.
 */
export function resolveTerminology(projectTerminology?: TProjectTerminology | null): TResolvedTerminology {
  if (!projectTerminology) return { ...OPERATOR_DEFAULT_TERMINOLOGY };
  return {
    singular: nonEmpty(projectTerminology.singular) ?? OPERATOR_DEFAULT_TERMINOLOGY.singular,
    plural: nonEmpty(projectTerminology.plural) ?? OPERATOR_DEFAULT_TERMINOLOGY.plural,
    verb_create: nonEmpty(projectTerminology.verb_create) ?? OPERATOR_DEFAULT_TERMINOLOGY.verb_create,
  };
}

// Treat empty strings the same as missing keys — operators shouldn't have to
// distinguish "explicitly cleared" from "never set" when the resolved render
// would be an empty label either way.
function nonEmpty(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
