/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { FileText } from "lucide-react";
// plane imports
import { renderFormattedDate } from "@plane/utils";
// services
import {
  PageSiblingOutputsService,
  type TPageSiblingOutput,
} from "@/services/page/page_sibling_outputs.service";

type Props = {
  workspaceSlug: string;
  projectId: string;
  pageId: string;
};

const pageSiblingOutputsService = new PageSiblingOutputsService();

/**
 * [ours: demo-chrome] Renders the "Generated outputs" panel beneath an entity
 * ("— what we know") Page on the prospect-facing demo desks. Lists the docs
 * produced about the same entity — assessments, briefings — resolved at
 * render-time from the doc naming convention ("<DocType> — <Entity>"), so new
 * generations appear the instant they land with no editor/Yjs writes. Errors
 * fail silent so a flaky lookup never breaks the page.
 */
export const PageGeneratedOutputs = observer(function PageGeneratedOutputs({
  workspaceSlug,
  projectId,
  pageId,
}: Props) {
  const [pages, setPages] = useState<TPageSiblingOutput[] | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setPages(null);
    pageSiblingOutputsService
      .listSiblingOutputs(workspaceSlug, projectId, pageId)
      .then((data) => {
        if (cancelled) return undefined;
        setPages(data);
        return undefined;
      })
      .catch(() => {
        if (cancelled) return undefined;
        setError(true);
        return undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, pageId]);

  // Fail silent: never render anything if the lookup errored or is still loading.
  if (error || pages === null) return null;

  return (
    <div className="flex flex-col gap-2 pt-4">
      <h3 className="px-1 text-body-sm-semibold text-secondary">Generated outputs</h3>
      {pages.length === 0 ? (
        <div className="flex items-start gap-2 px-1 text-body-xs-regular text-tertiary">
          <FileText className="mt-0.5 size-3.5 shrink-0" />
          <span>
            No documents generated about this yet — use the Generate button above to produce one.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {pages.map((page) => (
            <a
              key={page.id}
              href={`/${workspaceSlug}/projects/${page.project_id}/pages/${page.id}/`}
              className="flex items-center gap-2 truncate px-1 text-body-xs-regular text-secondary hover:text-primary"
              title={page.name || "Untitled page"}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{page.name || "Untitled page"}</span>
              <span className="shrink-0 text-tertiary">generated {renderFormattedDate(page.created_at)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
});
