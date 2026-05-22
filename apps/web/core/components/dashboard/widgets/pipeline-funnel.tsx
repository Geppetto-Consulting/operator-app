/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] ENG-198 — pipeline_funnel widget.
// Horizontal stacked bar, one segment per state, sized by share of the
// non-cancelled total. A conversion % chip in the header gives the headline
// number. Conversion is null when total = 0 — render "—", not "0%".

import { observer } from "mobx-react";
import type { TPipelineFunnelWidgetConfig, TPipelineFunnelWidgetData } from "@plane/types";
import { cn } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TPipelineFunnelWidgetConfig;
  data: TPipelineFunnelWidgetData;
};

function formatConversion(pct: number | null): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
  return `${Math.round(pct * 100)}%`;
}

export const PipelineFunnelWidget = observer(function PipelineFunnelWidget({ config, data }: Props) {
  const stages = data.stages ?? [];
  const total = data.total ?? 0;

  if (total === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No items in pipeline yet." />
      </WidgetShell>
    );
  }

  const conversionLabel = formatConversion(data.conversion_pct);

  return (
    <WidgetShell
      title={config.title}
      headerRight={
        <span
          className="bg-custom-background-90 text-custom-text-200 rounded-sm px-1.5 py-0.5 text-11 font-medium tabular-nums"
          title="Won / non-cancelled"
        >
          {conversionLabel}
        </span>
      }
    >
      <div className="flex flex-1 flex-col gap-3">
        {/* stacked funnel bar — sized by share of non-cancelled total */}
        <div className="bg-custom-background-90 flex h-2 w-full overflow-hidden rounded-sm">
          {stages.map((stage) => {
            const pct = total > 0 ? (stage.count / total) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={stage.state_id}
                title={`${stage.name}: ${stage.count}`}
                style={{ width: `${pct}%`, backgroundColor: stage.color || "#a3a3a3" }}
                className="h-full"
              />
            );
          })}
        </div>
        {/* per-stage breakdown */}
        <ul className="flex flex-col gap-1.5">
          {stages.map((stage) => (
            <li key={stage.state_id} className="flex items-center justify-between text-13">
              <span className="flex items-center gap-2">
                <span
                  className={cn("inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm", {
                    "opacity-30": (stage.count ?? 0) === 0,
                  })}
                  style={{ backgroundColor: stage.color || "#a3a3a3" }}
                />
                <span className="text-custom-text-200 truncate">{stage.name}</span>
              </span>
              <span
                className={cn("text-custom-text-200 font-medium tabular-nums", {
                  "text-custom-text-400": stage.count === 0,
                })}
              >
                {stage.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetShell>
  );
});
