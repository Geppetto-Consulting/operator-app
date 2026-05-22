/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Operator fork — shared shell for dashboard widgets.
// Matches Plane's existing card pattern (bg-custom-background-100, subtle
// border, soft typography) rather than the heavy black borders of the
// initial ENG-179 ship.

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
        "border-custom-border-200 bg-custom-background-100 flex flex-col gap-2.5 rounded-lg border p-4",
        "hover:border-custom-border-300 transition-colors",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm text-custom-text-200 font-medium">{title}</h3>
        {headerRight}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function WidgetEmpty({ message }: { message: string }) {
  return <div className="text-sm text-custom-text-400 flex flex-1 items-center justify-center py-6">{message}</div>;
}
