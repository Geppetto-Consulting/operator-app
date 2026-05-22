/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: module-shaped dashboards / ENG-197] Frontend service for the
// operator-mcp `/api/widget-data/<type>/` endpoint. The operator-mcp runs
// out-of-process (separate container; default http://localhost:8723 in
// local dev) and is workspace-token authenticated via a per-workspace bearer.
//
// We DON'T extend APIService here because:
//   - operator-mcp lives on a different origin → no shared session cookie
//   - operator-mcp uses Bearer auth, not the Plane CSRF session
//   - APIService's 401 interceptor would redirect to /login on every
//     unauthenticated widget call — wrong UX for the connector-not-setup case
//
// Auth model (Phase 1): the bearer is read from `VITE_OPERATOR_MCP_BEARER`
// at build time. This embeds the workspace bearer into the browser bundle —
// fine for self-hosted single-tenant deploys (the typical operator dogfood),
// not fine for multi-tenant. Phase 3+ should switch to a server-side proxy
// route that injects the bearer from the user's session.

import type { TCalendarUpcomingWidgetData, TEmailFeedWidgetData } from "@plane/types";

/**
 * Discriminated union of every widget data shape the operator-mcp endpoint
 * can return. Mirrors widget-data.ts on the server (mcp-server/src/widget-data.ts).
 */
export type TOperatorMcpWidgetPayload =
  | { type: "calendar_upcoming"; data: TCalendarUpcomingWidgetData }
  | { type: "email_feed"; data: TEmailFeedWidgetData };

/**
 * Widget types we expect to ask operator-mcp for. Kept stable + parallel
 * to SUPPORTED_WIDGET_TYPES on the server. If you add a widget here, update:
 *   - WIDGET_DATA_SOURCE in dashboard/widgets/widget-registry.tsx (route to mcp)
 *   - SUPPORTED_WIDGET_TYPES in mcp-server/src/widget-data.ts (server-side allow)
 *   - The TDashboardWidgetData union in @plane/types/src/dashboard.ts
 */
export type TOperatorMcpWidgetType = TOperatorMcpWidgetPayload["type"];

const OPERATOR_MCP_BASE_URL: string = (process.env.VITE_OPERATOR_MCP_BASE_URL ?? "http://localhost:8723").replace(
  /\/+$/,
  ""
);
const OPERATOR_MCP_BEARER: string = process.env.VITE_OPERATOR_MCP_BEARER ?? "";

export class OperatorMcpWidgetDataService {
  private baseURL: string;
  private bearer: string;

  constructor(baseURL: string = OPERATOR_MCP_BASE_URL, bearer: string = OPERATOR_MCP_BEARER) {
    this.baseURL = baseURL;
    this.bearer = bearer;
  }

  /**
   * Fetch a widget payload from operator-mcp. The Promise resolves to a
   * payload (which may carry needs_setup=true — that's the connector-not-
   * configured signal, NOT a fetch failure) OR rejects with a JS Error
   * (which is what the SWR error path renders).
   *
   * `params` carries widget config — limit, horizon_days, etc — query-stringed.
   * Unknown keys are forwarded; the server ignores extras.
   */
  async fetchWidgetData<T extends TOperatorMcpWidgetType>(
    widgetType: T,
    params: Record<string, string | number | undefined> = {}
  ): Promise<Extract<TOperatorMcpWidgetPayload, { type: T }>> {
    if (!this.bearer) {
      throw new Error(
        "operator-mcp bearer not configured. Set VITE_OPERATOR_MCP_BEARER in apps/web/.env (see .env.example)."
      );
    }

    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") query.set(k, String(v));
    }
    const qs = query.toString();
    const url = `${this.baseURL}/api/widget-data/${widgetType}${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.bearer}`,
        Accept: "application/json",
      },
      // Operator-mcp is a separate origin; CORS preflight handled by mcp-server.
      // Credentials omitted on purpose — bearer carries identity.
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`operator-mcp ${widgetType} ${res.status}: ${body.slice(0, 200)}`);
    }

    return (await res.json()) as Extract<TOperatorMcpWidgetPayload, { type: T }>;
  }

  /**
   * Fetch many widget payloads in one call (parallel `Promise.allSettled`).
   * Returns a `Record<widget.id, payload | { error }>` mirroring Plane's
   * `/dashboard-data/` response shape — so the Dashboard orchestrator can
   * compose Plane + operator-mcp responses without per-source if/else.
   *
   * Each individual fetch is INDEPENDENT — one connector being down
   * (e.g. needs_setup, or gcal returning 500) doesn't block the other.
   */
  async fetchManyWidgets(
    widgets: Array<{ id: string; type: TOperatorMcpWidgetType; params?: Record<string, string | number | undefined> }>
  ): Promise<Record<string, TOperatorMcpWidgetPayload | { type: string; error: string }>> {
    const settled = await Promise.allSettled(
      widgets.map((w) => this.fetchWidgetData(w.type, w.params ?? {}).then((payload) => ({ id: w.id, payload })))
    );
    const out: Record<string, TOperatorMcpWidgetPayload | { type: string; error: string }> = {};
    settled.forEach((result, i) => {
      const w = widgets[i];
      if (result.status === "fulfilled") {
        out[w.id] = result.value.payload;
      } else {
        out[w.id] = {
          type: w.type,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
    });
    return out;
  }
}
