/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Operator fork — see ENG-177 / ENG-178 / ENG-179.
// Shared shell for the 5 project-dashboard widget components.

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
        "border-default-100 flex flex-col gap-3 rounded-md border bg-surface-1 p-4",
        "min-h-[180px]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-14 font-semibold text-tertiary">{title}</h3>
        {headerRight}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function WidgetEmpty({ message }: { message: string }) {
  return <div className="flex flex-1 items-center justify-center py-6 text-13 text-placeholder">{message}</div>;
}
