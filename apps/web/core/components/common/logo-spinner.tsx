/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { PRODUCT_NAME } from "@plane/constants";

export function LogoSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="border-custom-border-200 border-t-custom-primary-100 h-8 w-8 animate-spin rounded-full border-2"
        role="status"
        aria-label="Loading"
      />
      <span className="text-xs text-custom-text-300 font-medium tracking-wide">{PRODUCT_NAME}</span>
    </div>
  );
}
