/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";

export type TPageSiblingOutput = {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Sibling-outputs reverse-lookup: which OTHER pages mention the same beads
 * this page mentions? Backed by the PageLog entity-reference table — the
 * entity ("what we know") page and each generated output doc both carry a
 * mention of the same issue/bead, so they are siblings.
 *
 * Endpoint: GET /api/workspaces/<slug>/projects/<pid>/pages/<page_id>/sibling-outputs/
 */
export class PageSiblingOutputsService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async listSiblingOutputs(
    workspaceSlug: string,
    projectId: string,
    pageId: string
  ): Promise<TPageSiblingOutput[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/sibling-outputs/`)
      .then((response) => response?.data ?? [])
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
