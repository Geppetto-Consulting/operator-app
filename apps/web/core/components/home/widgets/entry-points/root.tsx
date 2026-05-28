/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [ours: workspace-brand] ENG-290 — Entry Points widget.
//
// Renders a row of LARGE clickable cards for the workspace Home page. Used by
// customer demo workspaces (sentio / gordons / stirlight) to replace Plane's
// stock home noise (Stickies, Recents, "New at Plane", Quick tutorial) with a
// single curated "pick where to start" landing.
//
// Data source: workspace.home_widget_defaults.entry_points.cards — that's the
// canonical store; we read it off the current workspace from the workspace
// store rather than fetching another endpoint. Empty / missing config ⇒ the
// widget renders nothing (no empty-state — there's already a fallback in
// home-dashboard-widgets when no widget is enabled).
//
// Sizing: 2 cards per row at the standard 800px home width; auto-wraps to 1
// per row on narrower viewports. Each card is `min-h-[112px]` with generous
// padding so it reads as a primary navigation target, not a sidebar pill. Per
// Andrew: "these are the FIRST thing the prospect sees, so they should be
// substantial cards — NOT small-icon-tile-grid."
//
// Cards are next/link <a> tags so navigation stays SPA-fast and within the
// app context (per-project Dashboards live inside the same Plane shell).
// URLs in config can be absolute paths (`/sentio/projects/.../views/`) or
// workspace-relative (`projects/.../views/` — the widget prefixes the
// current workspace slug). We default to "/" if the URL is missing entirely
// so a misconfigured card still renders without breaking the link.

import { observer } from "mobx-react";
import Link from "next/link";
import type { THomeWidgetProps, IWorkspaceHomeEntryPointCard } from "@plane/types";
import { cn } from "@plane/utils";
import { useWorkspace } from "@/hooks/store/use-workspace";

const resolveCardUrl = (workspaceSlug: string, url: string | undefined): string => {
  if (typeof url !== "string" || url.length === 0) return `/${workspaceSlug}/`;
  // Absolute path (starts with `/`): trust it as-is. Orchestrators that
  // populate this dict typically include the workspace slug for clarity.
  if (url.startsWith("/")) return url;
  // External (http/https) URLs: pass through verbatim. Useful for off-domain
  // entry points (e.g. signed 🚀 triggers).
  if (/^https?:\/\//i.test(url)) return url;
  // Bare relative path: prefix the workspace slug.
  return `/${workspaceSlug}/${url.replace(/^\/+/, "")}`;
};

const isExternalUrl = (url: string): boolean => /^https?:\/\//i.test(url);

export const EntryPointsWidget = observer(function EntryPointsWidget(props: THomeWidgetProps) {
  const { workspaceSlug } = props;
  const { getWorkspaceBySlug } = useWorkspace();
  const workspace = getWorkspaceBySlug(workspaceSlug);

  const defaults = workspace?.home_widget_defaults ?? {};
  const entryPointsConfig = (defaults as Record<string, unknown>)["entry_points"];
  const cards: IWorkspaceHomeEntryPointCard[] =
    entryPointsConfig &&
    typeof entryPointsConfig === "object" &&
    Array.isArray((entryPointsConfig as { cards?: unknown }).cards)
      ? ((entryPointsConfig as { cards: IWorkspaceHomeEntryPointCard[] }).cards.filter(
          (c) => c && typeof c === "object" && typeof c.label === "string" && c.label.length > 0
        ) as IWorkspaceHomeEntryPointCard[])
      : [];

  if (cards.length === 0) {
    // No cards configured → render nothing. The parent renderer will fall
    // back to the empty-widgets state when nothing else is enabled either.
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card, index) => {
          const href = resolveCardUrl(workspaceSlug, card.url);
          const external = isExternalUrl(href);
          const cardInner = (
            <div
              className={cn(
                "group flex h-full min-h-[112px] flex-col gap-2 rounded-xl border p-5",
                "border-custom-border-200 bg-custom-background-100",
                "transition-all duration-150",
                "hover:border-custom-primary-100/40 hover:bg-custom-background-90",
                "hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
              )}
            >
              {card.icon ? (
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    "bg-custom-primary-100/10 text-18",
                    "transition-colors group-hover:bg-custom-primary-100/15"
                  )}
                  aria-hidden="true"
                >
                  {card.icon}
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="text-15 font-semibold text-custom-text-100">{card.label}</h3>
                {card.description ? (
                  <p className="text-13 text-custom-text-300">{card.description}</p>
                ) : null}
              </div>
            </div>
          );

          // External URLs (rare for entry_points; included for completeness)
          // use a plain anchor with target=_top so they navigate out of the
          // Plane shell cleanly. Internal links use next/link for SPA nav.
          return external ? (
            <a
              key={`${href}-${index}`}
              href={href}
              target="_top"
              rel="noopener"
              className="block h-full no-underline"
            >
              {cardInner}
            </a>
          ) : (
            <Link key={`${href}-${index}`} href={href} className="block h-full no-underline">
              {cardInner}
            </Link>
          );
        })}
      </div>
    </div>
  );
});
