/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [ours: project dashboards] ENG-270 — quick_actions widget.
// Renders a column of action buttons. Each button is a plain <a> with
// target="_top" so signed 🚀 trigger URLs redirect cleanly off-domain to
// mcp.* and back without getting trapped in any iframe context. Style hints
// (primary/secondary/ghost) map to bg-accent + outlined + minimal looks.

import { observer } from "mobx-react";
import { cn } from "@plane/utils";
import type { TQuickActionsWidgetConfig, TQuickActionsWidgetData } from "@plane/types";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TQuickActionsWidgetConfig;
  data: TQuickActionsWidgetData;
};

// ENG-298 — softened to defined semantic tokens. Secondary + ghost now use
// `border-subtle` (neutral-400) instead of the undefined `custom-border-200`,
// which means the borders actually render as the soft pale gray the design
// intends, not as `currentColor` (i.e. button text colour) bleeding through.
// Primary keeps the brand-default fill (`bg-accent-primary`) and inverse text
// (`text-on-color`) — those tokens ARE defined in @theme inline and will
// pick up correctly once the next build pass picks them up.
const STYLE_CLASS = {
  primary:
    "bg-accent-primary text-on-color hover:bg-accent-primary-hover border-transparent",
  secondary:
    "bg-layer-1 text-primary hover:bg-layer-1-hover border-subtle",
  ghost:
    "bg-transparent text-primary hover:bg-layer-1 border-subtle",
} as const;

export const QuickActionsWidget = observer(function QuickActionsWidget({ config, data }: Props) {
  const actions = data.actions ?? [];

  if (actions.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="No actions configured." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title={config.title}>
      <div className="flex flex-col gap-2">
        {actions.map((action, index) => {
          const styleKey = (action.style ?? "secondary") as keyof typeof STYLE_CLASS;
          const styleClass = STYLE_CLASS[styleKey] ?? STYLE_CLASS.secondary;
          return (
            <a
              // External URLs (signed 🚀 triggers redirect off-domain to mcp.*).
              // target="_top" forces a top-level navigation so the URL replaces
              // the Plane page entirely rather than getting trapped in an inner
              // frame context.
              key={`${action.url}-${index}`}
              href={action.url}
              target="_top"
              rel="noopener"
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 text-13 font-medium transition-colors",
                styleClass
              )}
            >
              {action.icon ? (
                <span className="flex-shrink-0 text-16" aria-hidden="true">
                  {action.icon}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate">{action.label}</span>
                {action.description ? (
                  <span
                    className={cn("truncate text-11 font-normal", {
                      "text-on-color/80": styleKey === "primary",
                      "text-placeholder": styleKey !== "primary",
                    })}
                  >
                    {action.description}
                  </span>
                ) : null}
              </span>
            </a>
          );
        })}
      </div>
    </WidgetShell>
  );
});
