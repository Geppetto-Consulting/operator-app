/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import type { TCycleEstimateType } from "@plane/types";
import { EEstimateSystem } from "@plane/types";
import { CustomSelect } from "@plane/ui";
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useCycle } from "@/hooks/store/use-cycle";
// [ours: terminology] project-aware label for the "issues" option (ENG-157)
import { useProjectTerminology } from "@/hooks/use-project-terminology";
// local imports
import { cycleEstimateOptions } from "../analytics-sidebar/issue-progress";

type TProps = {
  value: TCycleEstimateType;
  onChange: (value: TCycleEstimateType) => Promise<void>;
  showDefault?: boolean;
  projectId: string;
  cycleId: string;
};

export const EstimateTypeDropdown = observer(function EstimateTypeDropdown(props: TProps) {
  const { value, onChange, projectId, cycleId, showDefault = false } = props;
  const { getIsPointsDataAvailable } = useCycle();
  const { areEstimateEnabledByProjectId, currentProjectEstimateType } = useProjectEstimates();
  const isCurrentProjectEstimateEnabled = projectId && areEstimateEnabledByProjectId(projectId) ? true : false;
  // [ours: terminology] swap label for the "issues" option with project terminology
  const term = useProjectTerminology(projectId);
  const options = cycleEstimateOptions.map((opt) => (opt.value === "issues" ? { ...opt, label: term.plural } : opt));
  return (getIsPointsDataAvailable(cycleId) || isCurrentProjectEstimateEnabled) &&
    currentProjectEstimateType !== EEstimateSystem.CATEGORIES ? (
    <div className="relative flex items-center gap-2">
      <CustomSelect
        value={value}
        label={<span>{options.find((v) => v.value === value)?.label ?? "None"}</span>}
        onChange={onChange}
        maxHeight="lg"
        buttonClassName="bg-surface-2 border-none rounded-sm text-13 font-medium "
      >
        {options.map((item) => (
          <CustomSelect.Option key={item.value} value={item.value}>
            {item.label}
          </CustomSelect.Option>
        ))}
      </CustomSelect>
    </div>
  ) : showDefault ? (
    <span className="capitalize">{options.find((v) => v.value === value)?.label ?? value}</span>
  ) : null;
});
