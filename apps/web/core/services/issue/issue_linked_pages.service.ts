/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";

export type TIssueLinkedPage = {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Reverse-lookup: which pages mention this issue? Backed by the PageLog
 * entity-reference table. Surfaces in the issue-detail sidebar.
 *
 * Endpoint: GET /api/workspaces/<slug>/projects/<pid>/issues/<iid>/linked-pages/
 * Equivalent x-api-key endpoint: GET /api/v1/workspaces/<slug>/projects/<pid>/issues/<iid>/linked-pages/
 */
export class IssueLinkedPagesService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async listLinkedPages(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueLinkedPage[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/linked-pages/`)
      .then((response) => response?.data ?? [])
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
