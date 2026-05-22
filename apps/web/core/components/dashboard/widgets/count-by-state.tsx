/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] count_by_state widget — see ENG-179 brief §4.2.
// Renders a horizontal-bar / pill row, one segment per state, sized by count
// relative to the project total. 0-count states are rendered (backend zero-fills
// for chart stability) but as a thin grey tick to communicate "no items in this
// state" without dominating the bar.

import { observer } from "mobx-react";
import type { TCountByStateDatum, TCountByStateWidgetData, TCountByStateWidgetConfig } from "@plane/types";
import { cn } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TCountByStateWidgetConfig;
  data: TCountByStateWidgetData;
};

export const CountByStateWidget = observer(function CountByStateWidget({ config, data }: Props) {
  const counts: TCountByStateDatum[] = data.counts ?? [];
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
      <div className="flex flex-1 flex-col gap-3">
        {/* horizontal bar */}
        <div className="flex h-2 w-full overflow-hidden rounded-sm bg-surface-2">
          {counts.map((c) => {
            const pct = total > 0 ? (c.count / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={c.state_id}
                title={`${c.state}: ${c.count}`}
                style={{ width: `${pct}%`, backgroundColor: c.color || "#a3a3a3" }}
                className="h-full"
              />
            );
          })}
        </div>
        {/* legend */}
        <ul className="flex flex-col gap-1.5">
          {counts.map((c) => (
            <li key={c.state_id} className="flex items-center justify-between text-13">
              <span className="flex items-center gap-2">
                <span
                  className={cn("inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm", {
                    "opacity-30": (c.count ?? 0) === 0,
                  })}
                  style={{ backgroundColor: c.color || "#a3a3a3" }}
                />
                <span className="truncate text-secondary">{c.state}</span>
              </span>
              <span className={cn("font-medium text-secondary tabular-nums", { "text-placeholder": c.count === 0 })}>
                {c.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetShell>
  );
});
