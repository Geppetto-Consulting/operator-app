/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";

import { useTranslation } from "@plane/i18n";
import { PlusIcon } from "@plane/propel/icons";
import { Row } from "@plane/ui";
// [ours: terminology] Operator fork — per-project label override (ENG-119)
import { useProjectTerminology } from "@/hooks/use-project-terminology";
import type { TQuickAddIssueButton } from "../root";

export const GanttQuickAddIssueButton = observer(function GanttQuickAddIssueButton(props: TQuickAddIssueButton) {
  const { onClick, isEpic = false } = props;
  const { t } = useTranslation();
  // [ours: terminology] per-project label override (ENG-119)
  const term = useProjectTerminology();
  return (
    <button
      type="button"
      className="sticky bottom-0 z-[1] flex w-full cursor-pointer items-center border-t-[1px] border-subtle bg-layer-transparent hover:bg-layer-transparent-hover"
      onClick={onClick}
    >
      <Row className="flex gap-2 py-2">
        <PlusIcon className="my-auto h-3.5 w-3.5 stroke-2" />
        {/* [ours: terminology] per-project label for non-epic (ENG-119) */}
        <span className="text-13 font-medium">{isEpic ? t("epic.new") : `New ${term.singular.toLowerCase()}`}</span>
      </Row>
    </button>
  );
});
