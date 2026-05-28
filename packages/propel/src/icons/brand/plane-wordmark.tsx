/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "../type";

// [ours: brand] text-based wordmark — original Plane-letter paths replaced
// (ENG-145, refreshed ENG-248). Renders "Operator" in the SVG via system font
// so we don't ship Plane branding on the wordmark surface.
export function PlaneWordmark({ width = "200", height = "24", className, color = "currentColor" }: ISvgIcons) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <text
        x="0"
        y="18"
        fill={color}
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="18"
        fontWeight="600"
        letterSpacing="-0.01em"
      >
        Operator
      </text>
    </svg>
  );
}
