/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

import type { ISvgIcons } from "../type";

// [ours: brand] operator-icon + "Operator" wordmark lockup (ENG-248).
// Preserves the original 253x53 viewBox so existing consumers (sidebar header,
// sign-in screen, setup flows) keep their layout intact.
//
// Geometry:
//   - icon: 44x44 rounded-rect (#1A101D) on the left, with the lavender mark
//     path (#ECAFFF) scaled from the canonical operator-icon.svg (244x237).
//   - wordmark: "Operator" in semibold, vertically centred next to the icon.
//
// The `color` prop drives the wordmark fill so consumers can recolor it via
// className (text-primary etc). The icon stays brand-coloured.
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
      {/* icon: 44x44 rounded-rect with lavender mark */}
      <g transform="translate(0 4.5)">
        <rect width="44" height="44" rx="9" fill="#1A101D" />
        {/* scaled from operator-icon.svg (source path on 244x237 canvas)
            scale = 44/244 ≈ 0.18033 */}
        <g transform="translate(0 0) scale(0.18033 0.18565)">
          <path
            d="M122.109 175.262C96.7871 175.262 76.5508 170.337 61.4006 160.488C46.4669 150.497 39 136.437 39 118.31C39 107.176 42.4629 97.3987 49.3887 88.9772C56.3145 80.5558 65.9457 73.9899 78.2822 69.2796C90.8352 64.4265 105.444 62 122.109 62C140.723 62 156.197 64.4265 168.534 69.2796C180.871 73.9899 190.069 80.5558 196.129 88.9772C202.405 97.3987 205.544 107.176 205.544 118.31C205.544 136.437 198.618 150.497 184.766 160.488C171.131 170.337 150.246 175.262 122.109 175.262ZM77.6329 114.67C77.6329 119.095 80.9876 122.235 87.697 124.091C94.4063 125.803 105.877 126.66 122.109 126.66C138.342 126.66 149.813 125.803 156.522 124.091C163.231 122.235 166.586 119.095 166.586 114.67C166.586 110.388 163.231 107.39 156.522 105.677C149.813 103.965 138.342 103.108 122.109 103.108C105.877 103.108 94.4063 103.965 87.697 105.677C80.9876 107.39 77.6329 110.388 77.6329 114.67Z"
            fill="#ECAFFF"
          />
        </g>
      </g>
      {/* wordmark: "Operator" */}
      <text
        x="56"
        y="34"
        fill={color}
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.02em"
      >
        Operator
      </text>
    </svg>
  );
}
