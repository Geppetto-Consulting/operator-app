# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Sibling-outputs reverse-lookup endpoint (app-internal, session-authed).

Surfaces, on an entity "… — what we know" Page, the documents produced about
that entity (assessments, briefings, digests) — rendered live at request time,
with NO editor/Yjs writes and no mention-component bookkeeping.

The join key is the document naming convention the generation pipeline already
enforces:

    entity page : "<Entity> — what we know"
    output docs : "<DocType> — <Entity>"   e.g. "Opportunity Assessment — <Entity>"

So the siblings of "Harmony Fire Limited — what we know" are every Page in the
same workspace whose name ends with "— Harmony Fire Limited". This is robust for
our pipeline (docLabel + " — " + target_name) and needs zero per-document
linking, so it reflects new generations the instant they land — including on
already-opened (Yjs-persisted) entity pages, where a write-back would never
surface.
"""

# Third-party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from ..base import BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Page

ENTITY_SUFFIX = "— what we know"


class PageSiblingOutputsEndpoint(BaseAPIView):
    """GET the generated docs whose name targets this entity page's subject."""

    permission_classes = [ProjectEntityPermission]

    def get(self, request, slug, project_id, page_id):
        # 404 fast on a bad page id rather than returning an empty array.
        page = Page.objects.get(workspace__slug=slug, pk=page_id)

        name = (page.name or "").strip()
        if not name.endswith(ENTITY_SUFFIX):
            return Response([], status=status.HTTP_200_OK)
        entity = name[: -len(ENTITY_SUFFIX)].strip()
        if not entity:
            return Response([], status=status.HTTP_200_OK)

        # Generated docs are named "<DocType> — <Entity>". The "— " anchor keeps
        # this from matching a company whose name is a bare suffix of another.
        siblings = (
            Page.objects.filter(
                workspace__slug=slug,
                deleted_at__isnull=True,
                name__endswith=f"— {entity}",
            )
            .exclude(pk=page_id)
            .order_by("-created_at")
            .distinct()
            .prefetch_related("projects")
        )

        out = []
        for p in siblings:
            proj = p.projects.first()
            out.append(
                {
                    "id": str(p.id),
                    "name": p.name,
                    # Each doc lives in its OWN project (outputs are in COS/REL,
                    # not the entity page's PIPE) — return the real one so the
                    # frontend builds a non-404 deep link.
                    "project_id": str(proj.id) if proj else str(project_id),
                    "created_at": p.created_at,
                    "updated_at": p.updated_at,
                }
            )

        return Response(out, status=status.HTTP_200_OK)
