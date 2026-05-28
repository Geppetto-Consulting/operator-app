/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [ours: project dashboards] ENG-270 — banner widget.
// Renders an operator-configured workspace-purpose header card. Title is an
// h2 (semantic heading; the dashboard root provides the page h1). body_html
// is rendered via dangerouslySetInnerHTML — the content lands in dashboard
// config via the MCP write path (set_project_dashboard / add_dashboard_widget),
// not via user input from the Plane UI. Treat it as trusted operator markup.

import { observer } from "mobx-react";
import { cn } from "@plane/utils";
import type { TBannerWidgetConfig, TBannerWidgetData } from "@plane/types";

type Props = {
  config: TBannerWidgetConfig;
  data: TBannerWidgetData;
};

const TONE_CLASS = {
  neutral: "bg-custom-background-100 border-custom-border-200",
  info: "bg-accent-subtle border-custom-border-200",
  success: "bg-green-50/40 dark:bg-green-900/10 border-green-200/60 dark:border-green-800/40",
  warning:
    "bg-yellow-50/40 dark:bg-yellow-900/10 border-yellow-200/60 dark:border-yellow-800/40",
} as const;

export const BannerWidget = observer(function BannerWidget({ config, data }: Props) {
  // Prefer the per-widget computed title (operator may rewrite at runtime);
  // fall back to the config-level title (always present) so we never render
  // a heading-less card.
  const heading = data.title || config.title;
  const tone = data.tone ?? "neutral";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-5",
        TONE_CLASS[tone] ?? TONE_CLASS.neutral
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-18 font-semibold text-custom-text-100">{heading}</h2>
        {data.subtitle ? (
          <p className="text-13 text-custom-text-300">{data.subtitle}</p>
        ) : null}
      </div>
      {data.body_html ? (
        <div
          // body_html is operator-trusted markup populated via MCP, not user
          // input. Same trust posture as Page descriptions elsewhere in the
          // fork. See ENG-270 brief — orchestrator owns the config shape.
          className="text-13 leading-relaxed text-custom-text-200 [&_a]:text-accent-primary [&_a]:underline [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          dangerouslySetInnerHTML={{ __html: data.body_html }}
        />
      ) : null}
    </div>
  );
});
