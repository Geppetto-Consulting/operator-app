/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: module-shaped dashboards / ENG-197] email_feed widget.
// Data source: operator-mcp /api/widget-data/email_feed/. Renders the last N
// unread inbox messages (default 5). Click → opens Gmail thread URL.
//
// Visual target: matches calendar-upcoming.tsx + Plane's design tokens —
// no heavy borders, subtle dividers, text-custom-text-* tokens.

import { observer } from "mobx-react";
import type { TEmailFeedWidgetConfig, TEmailFeedWidgetData } from "@plane/types";
import { calculateTimeAgoShort, cn } from "@plane/utils";
import { WidgetShell, WidgetEmpty } from "./widget-shell";

type Props = {
  config: TEmailFeedWidgetConfig;
  data: TEmailFeedWidgetData;
  // ENG-200: workspace slug threaded through from renderWidget so the
  // needs_setup CTA links to the actual /{workspaceSlug}/settings/integrations
  // route (the un-namespaced /settings/integrations 404s — Plane settings
  // are workspace-scoped). Mirrors how due_soon + touchpoint_due already
  // receive workspaceSlug from the widget orchestrator.
  workspaceSlug: string;
};

/**
 * Extract a display name from an RFC 5322 `From:` header. Inputs look like:
 *   `"Alice Liddell" <alice@example.com>`
 *   `alice@example.com`
 *   `Alice Liddell <alice@example.com>`
 * Returns the display name when present, otherwise the local-part of the
 * email address. Kept inline — only used here.
 */
function extractSenderDisplay(from: string): string {
  if (!from) return "Unknown";
  // Try "Display Name" <email@x> or Display Name <email@x>.
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (match) {
    const display = match[1].trim();
    if (display) return display;
    // Fall through to local-part of the bracketed address.
    return match[2].split("@")[0];
  }
  // Bare email — use the local-part.
  if (from.includes("@")) return from.split("@")[0];
  return from.trim();
}

export const EmailFeedWidget = observer(function EmailFeedWidget({ config, data, workspaceSlug }: Props) {
  const messages = data.messages ?? [];

  if (data.needs_setup) {
    return (
      <WidgetShell title={config.title}>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
          <p className="text-sm text-custom-text-300">Connect Gmail to see inbox messages.</p>
          <a
            href={`/${workspaceSlug}/settings/integrations`}
            className="text-custom-primary-100 text-12 hover:underline"
          >
            Set up Gmail
          </a>
        </div>
      </WidgetShell>
    );
  }

  if (messages.length === 0) {
    return (
      <WidgetShell title={config.title}>
        <WidgetEmpty message="Inbox zero." />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title={config.title}>
      <ul className="divide-custom-border-100 flex flex-1 flex-col divide-y">
        {messages.map((message) => {
          const sender = extractSenderDisplay(message.from);
          const timeAgo = message.received_iso ? calculateTimeAgoShort(message.received_iso) : "";
          const rowContent = (
            <div className="flex w-full items-start justify-between gap-3 py-2 text-left">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline gap-2">
                  <span className="text-custom-text-100 truncate text-13 font-medium">{sender}</span>
                </span>
                <span className="text-custom-text-200 truncate text-13">{message.subject || "(no subject)"}</span>
                {message.snippet && <span className="text-custom-text-400 truncate text-11">{message.snippet}</span>}
              </span>
              {timeAgo && (
                <span className="text-custom-text-300 mt-0.5 flex-shrink-0 text-11 tabular-nums">{timeAgo}</span>
              )}
            </div>
          );
          return (
            <li key={message.id}>
              {message.thread_url ? (
                <a
                  href={message.thread_url}
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
