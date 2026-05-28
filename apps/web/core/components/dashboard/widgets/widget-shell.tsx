/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Operator fork — shared shell for dashboard widgets.
// Matches Plane's CURRENT semantic token set (border-subtle / bg-layer-2 /
// text-secondary) — the legacy `custom-border-*` / `custom-background-*` /
// `custom-text-*` classes from the pre-Tailwind-v4 era no longer resolve in
// this fork (verified: their class rules are absent from the deployed CSS,
// causing the `border` shorthand to fall through to `currentColor` — which is
// the "dark and harsh border" Andrew reported in ENG-298). Swapping to the
// defined semantic tokens gives us the soft `--neutral-400` borders the
// design system intends, in both light and dark themes.

import type { ReactNode } from "react";
import { cn } from "@plane/utils";

export type TWidgetShellProps = {
  title: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
};

export function WidgetShell({ title, children, className, headerRight }: TWidgetShellProps) {
  return (
    <div
      className={cn(
        // Soft card: bg-layer-2 (the standard card surface in the new design
        // system) + border-subtle (neutral-400 in light, neutral-1200 in
        // dark). No hover border darkening — the surface should sit quietly
        // rather than reacting on cursor pass.
        "border-subtle bg-layer-2 flex flex-col gap-2.5 rounded-lg border p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-secondary font-medium">{title}</h3>
        {headerRight}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function WidgetEmpty({ message }: { message: string }) {
  return <div className="text-sm text-placeholder flex flex-1 items-center justify-center py-6">{message}</div>;
}
