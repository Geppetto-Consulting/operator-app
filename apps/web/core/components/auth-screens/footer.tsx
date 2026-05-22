/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: brand] AuthFooter previously rendered Plane's customer trust-badges
// (Zerodha/Sony/Dolby/Accenture). Removed — those are not our customers.
// Leaving the component in place as a no-op so consumers don't break;
// re-enable by exporting actual content here when we have real social proof.
export function AuthFooter() {
  return null;
}
