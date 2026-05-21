/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * [ours: terminology] Operator fork — ENG-118 / Phase 6.
 *
 * Targets the pure resolver `resolveTerminology` — `useTerminology` is just a
 * `useMemo` wrapper around it, so exhaustively covering the resolver covers
 * the hook's behavioural contract too. This keeps the i18n package free of a
 * renderer / testing-library dependency for one tiny hook.
 */

import { describe, it, expect } from "vitest";
import { OPERATOR_DEFAULT_TERMINOLOGY, resolveTerminology, type TProjectTerminology } from "./use-terminology";

describe("resolveTerminology — operator defaults fallback", () => {
  it("returns full operator defaults when input is undefined", () => {
    expect(resolveTerminology(undefined)).toEqual(OPERATOR_DEFAULT_TERMINOLOGY);
  });

  it("returns full operator defaults when input is null", () => {
    expect(resolveTerminology(null)).toEqual(OPERATOR_DEFAULT_TERMINOLOGY);
  });

  it("returns full operator defaults when input is an empty object", () => {
    expect(resolveTerminology({})).toEqual(OPERATOR_DEFAULT_TERMINOLOGY);
  });

  it("returns operator defaults for any key that is an empty string", () => {
    const input: TProjectTerminology = {
      singular: "",
      plural: "",
      verb_create: "",
    };
    expect(resolveTerminology(input)).toEqual(OPERATOR_DEFAULT_TERMINOLOGY);
  });

  it("returns operator defaults for any key that is whitespace-only", () => {
    const input: TProjectTerminology = {
      singular: "   ",
      plural: "\t\n",
      verb_create: "  ",
    };
    expect(resolveTerminology(input)).toEqual(OPERATOR_DEFAULT_TERMINOLOGY);
  });
});

describe("resolveTerminology — project overrides", () => {
  it("uses project terminology when all three keys are populated", () => {
    expect(
      resolveTerminology({
        singular: "Contact",
        plural: "Contacts",
        verb_create: "Add contact",
      })
    ).toEqual({
      singular: "Contact",
      plural: "Contacts",
      verb_create: "Add contact",
    });
  });

  it("merges per-key — populated keys win, missing keys fall back", () => {
    expect(
      resolveTerminology({
        plural: "Contacts",
      })
    ).toEqual({
      singular: OPERATOR_DEFAULT_TERMINOLOGY.singular,
      plural: "Contacts",
      verb_create: OPERATOR_DEFAULT_TERMINOLOGY.verb_create,
    });
  });

  it("trims surrounding whitespace from project values", () => {
    expect(
      resolveTerminology({
        singular: "  Prospect  ",
        plural: " Prospects ",
      })
    ).toEqual({
      singular: "Prospect",
      plural: "Prospects",
      verb_create: OPERATOR_DEFAULT_TERMINOLOGY.verb_create,
    });
  });

  it("falls back per-key when only one key is empty/whitespace", () => {
    expect(
      resolveTerminology({
        singular: "Signal",
        plural: "",
        verb_create: "Add signal",
      })
    ).toEqual({
      singular: "Signal",
      plural: OPERATOR_DEFAULT_TERMINOLOGY.plural,
      verb_create: "Add signal",
    });
  });
});

describe("resolveTerminology — defaults shape", () => {
  it("operator defaults match the documented Phase 6 schema", () => {
    expect(OPERATOR_DEFAULT_TERMINOLOGY).toEqual({
      singular: "Work item",
      plural: "Work items",
      verb_create: "Add work item",
    });
  });

  it("does not mutate the operator defaults object on repeated calls", () => {
    const before = { ...OPERATOR_DEFAULT_TERMINOLOGY };
    resolveTerminology(undefined);
    resolveTerminology({ singular: "X" });
    resolveTerminology({});
    expect(OPERATOR_DEFAULT_TERMINOLOGY).toEqual(before);
  });
});
