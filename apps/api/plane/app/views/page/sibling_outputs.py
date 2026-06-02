# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sibling-outputs reverse-lookup endpoint (app-internal, session-authed).

Mirrors ``plane.app.views.issue.linked_pages.IssueLinkedPagesEndpoint`` but
walks the PageLog substrate one hop further: instead of "which pages mention
this issue?" it answers "which OTHER pages mention the same beads this page
mentions?".

The entity ("what we know") Page and each generated output doc (assessment,
briefing) both carry a ``<mention-component entity_name="issue"
entity_identifier="<bead-uuid>">`` that the ``page_transaction`` Celery task
records as a PageLog row. So two pages that reference the same bead are
siblings — the entity page and the docs produced about that entity. This
endpoint surfaces those sibling docs on the entity page at render-time, with
no editor/Yjs writes.
"""

# Third-party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from ..base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Page, PageLog


class PageSiblingOutputsEndpoint(BaseAPIView):
    """GET other pages that mention the same beads this page mentions."""

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, page_id):
        # 404 fast on a bad page id rather than returning an empty array.
        Page.objects.get(workspace__slug=slug, pk=page_id)

        # Beads (issues) this page mentions.
        bead_ids = PageLog.objects.filter(
            page_id=page_id,
            entity_name="issue",
        ).values_list("entity_identifier", flat=True)

        # OTHER pages that mention any of those beads.
        sibling_page_ids = (
            PageLog.objects.filter(
                entity_name="issue",
                entity_identifier__in=list(bead_ids),
            )
            .exclude(page_id=page_id)
            .values_list("page_id", flat=True)
            .distinct()
        )

        pages = (
            Page.objects.filter(
                pk__in=sibling_page_ids,
                workspace__slug=slug,
                deleted_at__isnull=True,
            )
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
