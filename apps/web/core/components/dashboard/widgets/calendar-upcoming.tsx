/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: module-shaped dashboards / ENG-197] calendar_upcoming widget.
// Data source: operator-mcp /api/widget-data/calendar_upcoming/. Renders the
// next N events (default 5) within a horizon window (default 14 days).
//
// Visual target: apps/web/core/components/analytics/insight-card.tsx —
// flat Plane card, subtle border, text-custom-text-* tokens. Each row is
// a clickable button that opens the event's html_link in a new tab.

import { observer } from "mobx-react";
import type { TCalendarUpcomingWidgetConfig, TCalendarUpcomingWidgetData } from "@plane/types";
import { cn } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TCalendarUpcomingWidgetConfig;
  data: TCalendarUpcomingWidgetData;
  // ENG-200: workspace slug threaded through from renderWidget so the
  // needs_setup CTA links to the actual /{workspaceSlug}/settings/integrations
  // route (the un-namespaced /settings/integrations 404s — Plane settings
  // are workspace-scoped). Mirrors how due_soon + touchpoint_due already
  // receive workspaceSlug from the widget orchestrator.
  workspaceSlug: string;
};

/**
 * Format an ISO timestamp into a relative-day label for the widget row.
 * Same-day → "Today 14:00", tomorrow → "Tomorrow 09:30", further out →
 * "Wed 09:30" (weekday abbrev). Returns "—" for null / unparseable.
 *
 * Kept inline (not in @plane/utils) because every other widget formats
 * dates differently — extracting a shared helper now feels premature.
 */
function formatEventTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = d.toLocaleDateString([], { weekday: "short" });
    return `${weekday} ${time}`;
  }
  // Further out — show date + time.
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export const CalendarUpcomingWidget = observer(function CalendarUpcomingWidget({ config, data, workspaceSlug }: Props) {
  const events = data.events ?? [];

  // needs_setup → clear CTA, not a generic empty state. The user's action
  // is "go connect this" — not "nothing to show".
  if (data.needs_setup) {
    return (
      <WidgetShell title={config.title}>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <p className="text-sm text-custom-text-300">Connect Google Calendar to see upcoming events.</p>
          <a
            href={`/${workspaceSlug}/settings/integrations`}
            className="text-custom-primary-100 text-12 hover:underline"
          >
            Set up Google Calendar
          </a>
        </div>
      </WidgetShell>
    );
  }

  if (events.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="Nothing on the calendar." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title={config.title}>
      <ul className="divide-custom-border-100 flex flex-1 flex-col divide-y">
        {events.map((event) => {
          const rowContent = (
            <div className="flex w-full items-center justify-between gap-3 py-2 text-left">
              <span className="flex min-w-0 flex-col">
                <span className="text-custom-text-100 truncate text-13 font-medium">
                  {event.summary || "(no title)"}
                </span>
                {event.location && <span className="text-custom-text-400 truncate text-11">{event.location}</span>}
              </span>
              <span className="text-custom-text-300 flex-shrink-0 text-12 tabular-nums">
                {formatEventTime(event.start_iso)}
              </span>
            </div>
          );
          return (
            <li key={event.id}>
              {event.html_link ? (
                <a
                  href={event.html_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("hover:bg-custom-background-90 -mx-2 block rounded px-2 transition-colors")}
                >
                  {rowContent}
                </a>
              ) : (
                rowContent
              )}
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
});
