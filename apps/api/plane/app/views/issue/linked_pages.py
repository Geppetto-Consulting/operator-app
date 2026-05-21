# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Linked-pages reverse-lookup endpoint (app-internal, session-authed).

Mirrors the public x-api-key endpoint at
``plane.api.views.issue.IssueLinkedPagesAPIEndpoint`` so the web app's
issue-detail sidebar can ask: which pages mention this issue? Both use the
same PageLog substrate (entity_name="issue", entity_identifier=<issue_uuid>).
"""

# Third-party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Issue, Page, PageLog


class IssueLinkedPagesEndpoint(BaseAPIView):
    """GET pages that mention this issue (PageLog reverse lookup)."""

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, issue_id):
        # 404 fast on bad issue id rather than returning an empty array.
        Issue.issue_objects.get(workspace__slug=slug, project_id=project_id, pk=issue_id)

        page_ids = PageLog.objects.filter(
            workspace__slug=slug,
            entity_name="issue",
            entity_identifier=issue_id,
        ).values_list("page_id", flat=True)

        pages = (
            Page.objects.filter(pk__in=page_ids)
            .filter(workspace__slug=slug)
            .filter(projects__id=project_id)
            .filter(project_pages__deleted_at__isnull=True)
            .order_by("-created_at")
            .distinct()
            .values("id", "name", "created_at", "updated_at")
        )

        return Response(
            [
                {
                    "id": str(p["id"]),
                    "name": p["name"],
                    "project_id": str(project_id),
                    "created_at": p["created_at"],
                    "updated_at": p["updated_at"],
                }
                for p in pages
            ],
            status=status.HTTP_200_OK,
        )
