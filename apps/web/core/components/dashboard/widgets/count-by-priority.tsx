/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] count_by_priority widget — see ENG-179 brief §4.2.
// Backend (ENG-178) returns all 5 buckets in canonical order
// (urgent → high → medium → low → none).

import { observer } from "mobx-react";
import { PriorityIcon } from "@plane/propel/icons";
import type {
  TCountByPriorityDatum,
  TCountByPriorityWidgetData,
  TCountByPriorityWidgetConfig,
  TIssuePriorities,
} from "@plane/types";
import { cn } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TCountByPriorityWidgetConfig;
  data: TCountByPriorityWidgetData;
};

const PRIORITY_LABEL: Record<TIssuePriorities, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

export const CountByPriorityWidget = observer(function CountByPriorityWidget({ config, data }: Props) {
  const counts: TCountByPriorityDatum[] = data.counts ?? [];
  const total = counts.reduce((sum, c) => sum + (c.count ?? 0), 0);

  if (total === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No items yet." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title={config.title} headerRight={<span className="text-12 text-placeholder">{total}</span>}>
      <ul className="flex flex-1 flex-col gap-1.5">
        {counts.map((c) => (
          <li key={c.priority} className="flex items-center justify-between text-13">
            <span className="flex items-center gap-2">
              <PriorityIcon priority={c.priority} withContainer size={12} />
              <span className="text-secondary">{PRIORITY_LABEL[c.priority] ?? c.priority}</span>
            </span>
            <span className={cn("font-medium text-secondary tabular-nums", { "text-placeholder": c.count === 0 })}>
              {c.count}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
});
