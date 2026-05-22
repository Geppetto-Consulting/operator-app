/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// [ours: project dashboards] Operator fork — frontend service for the
// GET /api/workspaces/<slug>/projects/<pid>/dashboard-data/ endpoint
// shipped in ENG-178 Phase 1 (apps/api/plane/app/views/project/dashboard.py).
// See ENG-179 execution brief.

import { API_BASE_URL } from "@plane/constants";
import type { TDashboardDataResponse } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class ProjectDashboardService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async fetchDashboardData(workspaceSlug: string, projectId: string): Promise<TDashboardDataResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/dashboard-data/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response;
      });
  }
}
