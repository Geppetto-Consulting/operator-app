/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { PRODUCT_NAME_SHORT } from "@plane/constants";

// [ours: brand] ENG-248 — operator-icon + "Operator" wordmark loading screen.
// Replaces the upstream GIF spinner. Same animation as the web app for
// consistency across surfaces.
export function LogoSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <style>{`
        @keyframes operator-brand-flip {
          0%   { transform: perspective(420px) rotateY(0deg); }
          35%  { transform: perspective(420px) rotateY(0deg); }
          65%  { transform: perspective(420px) rotateY(180deg); }
          100% { transform: perspective(420px) rotateY(360deg); }
        }
        .operator-brand-flip {
          animation: operator-brand-flip 2.4s ease-in-out infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }
      `}</style>
      <div
        className="operator-brand-flip h-20 w-20"
        role="status"
        aria-label={`Loading ${PRODUCT_NAME_SHORT}`}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 244 237"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <rect width="244" height="237" rx="50" fill="#1A101D" />
          <path
            d="M122.109 175.262C96.7871 175.262 76.5508 170.337 61.4006 160.488C46.4669 150.497 39 136.437 39 118.31C39 107.176 42.4629 97.3987 49.3887 88.9772C56.3145 80.5558 65.9457 73.9899 78.2822 69.2796C90.8352 64.4265 105.444 62 122.109 62C140.723 62 156.197 64.4265 168.534 69.2796C180.871 73.9899 190.069 80.5558 196.129 88.9772C202.405 97.3987 205.544 107.176 205.544 118.31C205.544 136.437 198.618 150.497 184.766 160.488C171.131 170.337 150.246 175.262 122.109 175.262ZM77.6329 114.67C77.6329 119.095 80.9876 122.235 87.697 124.091C94.4063 125.803 105.877 126.66 122.109 126.66C138.342 126.66 149.813 125.803 156.522 124.091C163.231 122.235 166.586 119.095 166.586 114.67C166.586 110.388 163.231 107.39 156.522 105.677C149.813 103.965 138.342 103.108 122.109 103.108C105.877 103.108 94.4063 103.965 87.697 105.677C80.9876 107.39 77.6329 110.388 77.6329 114.67Z"
            fill="#ECAFFF"
          />
        </svg>
      </div>
      <span className="text-sm text-custom-text-200 font-semibold tracking-wide">{PRODUCT_NAME_SHORT}</span>
    </div>
  );
}
