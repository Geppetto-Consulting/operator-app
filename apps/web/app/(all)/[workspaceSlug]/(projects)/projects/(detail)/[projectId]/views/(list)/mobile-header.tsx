/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { Row } from "@plane/ui";

// [ours: project dashboards] mobile header for the (renamed) Dashboard route.
// The legacy filter/sort controls don't apply to an agent-controlled dashboard
// — we just expose the page title on mobile. ENG-179.
export const ViewMobileHeader = observer(function ViewMobileHeader() {
  return (
    <div className="z-[13] flex justify-center border-b border-subtle bg-surface-1 py-2 md:hidden">
      <Row className="flex items-center justify-center text-13 font-medium text-secondary">Dashboard</Row>
    </div>
  );
});
