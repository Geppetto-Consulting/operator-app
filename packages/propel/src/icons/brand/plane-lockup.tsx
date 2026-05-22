/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "../type";

// [ours: brand] interim text-based lockup — original Plane-cube + Plane-letter
// paths replaced pending designer art (ENG-145). Renders "Promptable Operator"
// in the SVG via system font; preserves the original 253x53 viewBox so
// existing consumers (sidebar header, sign-in screen, setup flows) keep their
// layout intact.
export function BrandLockup({ width = "253", height = "53", className, color = "currentColor" }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 253 53"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <text
        x="0"
        y="36"
        fill={color}
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="28"
        fontWeight="600"
        letterSpacing="-0.02em"
      >
        Promptable Operator
      </text>
    </svg>
  );
}
