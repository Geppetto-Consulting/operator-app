/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] ENG-198 — velocity widget.
// Tiny inline SVG line+area sparkline of items-closed per ISO week. No
// charting lib — 60-ish lines of plain SVG is more than enough and avoids
// the recharts/echarts tax. Trend chip in the header shows the headline.

import { observer } from "mobx-react";
import type { TVelocityWidgetConfig, TVelocityWidgetData } from "@plane/types";
import { cn, renderFormattedDate } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TVelocityWidgetConfig;
  data: TVelocityWidgetData;
};

// Render area onto a fixed 100×40 viewBox; SVG scales to container width.
const VIEW_W = 100;
const VIEW_H = 40;
const PAD = 2;

function formatTrend(pct: number | null): { label: string; tone: "up" | "down" | "flat" } {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return { label: "—", tone: "flat" };
  }
  const display = `${pct > 0 ? "+" : ""}${Math.round(pct * 100)}%`;
  return { label: display, tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

export const VelocityWidget = observer(function VelocityWidget({ config, data }: Props) {
  const weeks = data.weeks ?? [];
  const total = data.total ?? 0;

  if (weeks.length === 0 || total === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No closed items in window." />
      </WidgetShell>
    );
  }

  const peak = Math.max(...weeks.map((w) => w.closed), 1);
  // x positions evenly across the inner viewBox; y inverted (0 at top).
  const xStep = (VIEW_W - PAD * 2) / Math.max(weeks.length - 1, 1);
  const points = weeks.map((w, i) => ({
    x: PAD + i * xStep,
    y: VIEW_H - PAD - (w.closed / peak) * (VIEW_H - PAD * 2),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${VIEW_H - PAD} L${points[0].x.toFixed(2)},${VIEW_H - PAD} Z`;

  const trend = formatTrend(data.trend_pct);

  return (
    <WidgetShell
      title={config.title}
      headerRight={
        <span
          className={cn("rounded-sm px-1.5 py-0.5 text-11 font-medium tabular-nums", {
            "bg-green-500/10 text-green-600": trend.tone === "up",
            "bg-red-500/10 text-red-600": trend.tone === "down",
            "bg-custom-background-90 text-custom-text-200": trend.tone === "flat",
          })}
          title="Recent half vs earlier half"
        >
          {trend.label}
        </span>
      }
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="text-custom-text-100 text-24 font-semibold tabular-nums">{total}</div>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-12 w-full"
          aria-label={`Velocity over ${weeks.length} weeks`}
        >
          <path d={areaPath} fill="rgb(59 130 246 / 0.15)" />
          <path d={linePath} fill="none" stroke="rgb(59 130 246)" strokeWidth={1.25} strokeLinejoin="round" />
        </svg>
        <div className="text-custom-text-400 flex items-center justify-between text-11 tabular-nums">
          <span>{renderFormattedDate(weeks[0].week_start) ?? weeks[0].week_start}</span>
          <span>{renderFormattedDate(weeks[weeks.length - 1].week_start) ?? weeks[weeks.length - 1].week_start}</span>
        </div>
      </div>
    </WidgetShell>
  );
});
