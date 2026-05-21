/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
// services
import { IssueLinkedPagesService, type TIssueLinkedPage } from "@/services/issue/issue_linked_pages.service";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

const issueLinkedPagesService = new IssueLinkedPagesService();

/**
 * Renders the "Linked pages" section in the issue-detail sidebar — pages
 * that mention this issue via a TipTap @-mention. Backed by PageLog
 * (entity_name="issue", entity_identifier=<issue_uuid>) on the API side.
 *
 * Empty state and error state are both rendered as a single muted line
 * to keep the sidebar visually consistent with the other small property
 * sections (cycle, module, label, etc).
 */
export function IssueLinkedPages({ workspaceSlug, projectId, issueId }: Props) {
  const [pages, setPages] = useState<TIssueLinkedPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPages(null);
    issueLinkedPagesService
      .listLinkedPages(workspaceSlug, projectId, issueId)
      .then((data) => {
        if (cancelled) return undefined;
        setPages(data);
        return undefined;
      })
      .catch((err) => {
        if (cancelled) return undefined;
        setError(
          (typeof err === "object" && err && "error" in err && typeof err.error === "string"
            ? err.error
            : "Failed to load linked pages") as string
        );
        return undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueId]);

  if (error) {
    return (
      <div className="flex items-start gap-2 px-1 text-body-xs-regular text-tertiary">
        <FileText className="mt-1 size-3.5 shrink-0" />
        <span className="truncate">{error}</span>
      </div>
    );
  }

  if (pages === null) {
    return (
      <div className="flex items-center gap-2 px-1 text-body-xs-regular text-tertiary">
        <FileText className="size-3.5 shrink-0" />
        <span>Loading linked pages…</span>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 text-body-xs-regular text-tertiary">
        <FileText className="size-3.5 shrink-0" />
        <span>No linked pages yet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {pages.map((page) => (
        <a
          key={page.id}
          href={`/${workspaceSlug}/projects/${page.project_id}/pages/${page.id}`}
          className="flex items-center gap-2 truncate px-1 text-body-xs-regular text-secondary hover:text-primary"
          title={page.name || "Untitled page"}
        >
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{page.name || "Untitled page"}</span>
        </a>
      ))}
    </div>
  );
}
