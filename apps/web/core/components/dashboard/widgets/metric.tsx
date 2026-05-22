/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] metric widget — see ENG-179 brief §4.2.
// Backend (ENG-178) computes value = numerator/denominator when denominator is
// present (with the audit-flagged divide-by-zero quirk: 0/0 returns value=0).
// Frontend treats null/undefined value as "—"; format ∈ {int, count, percent, ratio}.

import { observer } from "mobx-react";
import type { TMetricFormat, TMetricWidgetConfig, TMetricWidgetData } from "@plane/types";
import { WidgetShell } from "./widget-shell";

type Props = {
  config: TMetricWidgetConfig;
  data: TMetricWidgetData;
};

function formatValue(value: number | null | undefined, format: TMetricFormat | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (format) {
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "ratio":
      return value.toFixed(2);
    case "int":
    case "count":
    default:
      return String(Math.round(value));
  }
}

export const MetricWidget = observer(function MetricWidget({ config, data }: Props) {
  const format = data.format ?? config.format ?? "int";
  const valueString = formatValue(data.value, format);
  const subline =
    data.denominator !== null && data.denominator !== undefined ? `${data.numerator} / ${data.denominator}` : null;

  return (
    <WidgetShell title={config.title} className="min-h-[140px]">
      <div className="flex flex-1 flex-col justify-center gap-1">
        <div className="text-32 font-semibold text-primary tabular-nums">{valueString}</div>
        {subline && <div className="text-12 text-placeholder tabular-nums">{subline}</div>}
      </div>
    </WidgetShell>
  );
});
