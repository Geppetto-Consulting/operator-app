/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";

import { useTranslation } from "@plane/i18n";
import { PlusIcon } from "@plane/propel/icons";
// [ours: terminology] Operator fork — per-project label override (ENG-119)
import { useProjectTerminology } from "@/hooks/use-project-terminology";
import type { TQuickAddIssueButton } from "../root";

export const SpreadsheetAddIssueButton = observer(function SpreadsheetAddIssueButton(props: TQuickAddIssueButton) {
  const { onClick, isEpic = false } = props;
  const { t } = useTranslation();
  // [ours: terminology] per-project label override (ENG-119)
  const term = useProjectTerminology();
  return (
    <div className="flex items-center">
      <button
        type="button"
        className="flex w-full items-center gap-x-[6px] bg-layer-transparent px-2 py-2 transition-colors hover:bg-layer-transparent-hover"
        onClick={onClick}
      >
        <PlusIcon className="h-3.5 w-3.5 stroke-2" />
        {/* [ours: terminology] per-project verb_create label for non-epic (ENG-119) */}
        <span className="text-13 font-medium">{isEpic ? t("epic.add.label") : term.verb_create}</span>
      </button>
    </div>
  );
});
