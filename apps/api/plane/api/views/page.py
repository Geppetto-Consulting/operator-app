# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# drf-spectacular imports
from drf_spectacular.utils import OpenApiResponse, OpenApiRequest

# Module imports
from plane.api.serializers import PageAPISerializer
from plane.app.permissions import ProjectEntityPermission
from plane.bgtasks.page_transaction_task import page_transaction
from plane.db.models import Page, Project, ProjectPage
from .base import BaseAPIView
from plane.utils.openapi import (
    page_docs,
    PAGE_ID_PARAMETER,
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    EXTERNAL_ID_PARAMETER,
    EXTERNAL_SOURCE_PARAMETER,
    ORDER_BY_PARAMETER,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    create_paginated_response,
    INVALID_REQUEST_RESPONSE,
    EXTERNAL_ID_EXISTS_RESPONSE,
    DELETED_RESPONSE,
    PROJECT_NOT_FOUND_RESPONSE,
)


class PageListCreateAPIEndpoint(BaseAPIView):
    """Page List and Create Endpoint

    Public REST API for listing and creating pages within a project.
    Mirrors the Issues API shape (BaseAPIView + ProjectEntityPermission +
    cursor pagination + external_id deduplication).
    """

    model = Page
    serializer_class = PageAPISerializer
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(projects__id=self.kwargs.get("project_id"))
            .filter(project_pages__deleted_at__isnull=True)
            .select_related("workspace")
            .select_related("owned_by")
            .order_by(self.kwargs.get("order_by", "-created_at"))
            .distinct()
        )

    @page_docs(
        operation_id="list_pages",
        summary="List pages",
        description="Retrieve a paginated list of pages in a project. Supports cursor pagination and external_id lookup.",  # noqa: E501
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            EXTERNAL_ID_PARAMETER,
            EXTERNAL_SOURCE_PARAMETER,
            ORDER_BY_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                PageAPISerializer,
                "PaginatedPageResponse",
                "Paginated list of pages",
                "Paginated Pages",
            ),
            400: INVALID_REQUEST_RESPONSE,
            404: PROJECT_NOT_FOUND_RESPONSE,
        },
    )
    def get(self, request, slug, project_id):
        """List pages in a project."""
        external_id = request.GET.get("external_id")
        external_source = request.GET.get("external_source")

        if external_id and external_source:
            page = self.get_queryset().get(
                external_id=external_id,
                external_source=external_source,
            )
            return Response(
                PageAPISerializer(page, fields=self.fields, expand=self.expand).data,
                status=status.HTTP_200_OK,
            )

        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda pages: PageAPISerializer(
                pages, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    @page_docs(
        operation_id="create_page",
        summary="Create page",
        description="Create a new page in the specified project with optional HTML/JSON description content.",
        request=OpenApiRequest(request=PageAPISerializer),
        responses={
            201: OpenApiResponse(
                description="Page created successfully",
                response=PageAPISerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
            404: PROJECT_NOT_FOUND_RESPONSE,
            409: EXTERNAL_ID_EXISTS_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        """Create a page in the specified project."""
        # Verify the project exists in the workspace
        Project.objects.get(workspace__slug=slug, pk=project_id)

        # External-id de-duplication
        if (
            request.data.get("external_id")
            and request.data.get("external_source")
            and Page.objects.filter(
                workspace__slug=slug,
                projects__id=project_id,
                project_pages__deleted_at__isnull=True,
                external_source=request.data.get("external_source"),
                external_id=request.data.get("external_id"),
            ).exists()
        ):
            page = Page.objects.filter(
                workspace__slug=slug,
                projects__id=project_id,
                project_pages__deleted_at__isnull=True,
                external_source=request.data.get("external_source"),
                external_id=request.data.get("external_id"),
            ).first()
            return Response(
                {
                    "error": "Page with the same external id and external source already exists",
                    "id": str(page.id),
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = PageAPISerializer(
            data=request.data,
            context={
                "project_id": project_id,
                "owned_by_id": request.user.id,
            },
        )
        if serializer.is_valid():
            serializer.save()
            # Capture the page transaction so PageLog tracks mentions / embeds.
            # Mirrors the internal PageViewSet.create — without this hop, pages
            # created via the public API would never populate PageLog, breaking
            # the reverse-lookup that Phase 8 (ENG-120) depends on.
            # Dispatched via transaction.on_commit(robust=True) so a broker
            # outage absorbs as a swallowed log rather than a 5xx (matches the
            # project / label / etc. dispatch pattern across the public API).
            new_html = request.data.get("description_html", "<p></p>")
            page_id = str(serializer.data["id"])

            def _dispatch_page_transaction_create():
                page_transaction.delay(
                    new_description_html=new_html,
                    old_description_html=None,
                    page_id=page_id,
                )

            transaction.on_commit(_dispatch_page_transaction_create, robust=True)

            page = self.get_queryset().get(pk=serializer.data["id"])
            return Response(
                PageAPISerializer(page).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PageDetailAPIEndpoint(BaseAPIView):
    """Page Detail Endpoint

    Public REST API for retrieving, updating, and deleting a single page.
    Lock/unlock/archive/access/versioning/hierarchy are NOT exposed here —
    those remain on the internal app surface. Locked pages cannot be patched
    (mirrors the internal viewset rule).
    """

    model = Page
    serializer_class = PageAPISerializer
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(projects__id=self.kwargs.get("project_id"))
            .filter(project_pages__deleted_at__isnull=True)
            .select_related("workspace")
            .select_related("owned_by")
            .distinct()
        )

    @page_docs(
        operation_id="retrieve_page",
        summary="Retrieve page",
        description="Retrieve details of a specific page including its HTML/JSON description content.",
        parameters=[PAGE_ID_PARAMETER, FIELDS_PARAMETER, EXPAND_PARAMETER],
        responses={
            200: OpenApiResponse(description="Page retrieved", response=PageAPISerializer),
            404: PROJECT_NOT_FOUND_RESPONSE,
        },
    )
    def get(self, request, slug, project_id, pk):
        """Retrieve a single page."""
        page = self.get_queryset().get(pk=pk)
        return Response(
            PageAPISerializer(page, fields=self.fields, expand=self.expand).data,
            status=status.HTTP_200_OK,
        )

    @page_docs(
        operation_id="update_page",
        summary="Partially update page",
        description="Partially update an existing page. Locked pages return 400. Supports external_id validation.",
        parameters=[PAGE_ID_PARAMETER],
        request=OpenApiRequest(request=PageAPISerializer),
        responses={
            200: OpenApiResponse(description="Page updated", response=PageAPISerializer),
            400: INVALID_REQUEST_RESPONSE,
            404: PROJECT_NOT_FOUND_RESPONSE,
            409: EXTERNAL_ID_EXISTS_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, pk):
        """Update a page."""
        page = self.get_queryset().get(pk=pk)

        if page.is_locked:
            return Response(
                {"error": "Page is locked"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # External-id conflict guard (only when the caller is changing it)
        if (
            request.data.get("external_id")
            and (page.external_id != str(request.data.get("external_id")))
            and Page.objects.filter(
                workspace__slug=slug,
                projects__id=project_id,
                project_pages__deleted_at__isnull=True,
                external_source=request.data.get("external_source", page.external_source),
                external_id=request.data.get("external_id"),
            )
            .exclude(id=pk)
            .exists()
        ):
            return Response(
                {
                    "error": "Page with the same external id and external source already exists",
                    "id": str(page.id),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Snapshot the pre-update description so page_transaction can diff
        # the mention components and write the delta to PageLog.
        previous_description_html = page.description_html

        serializer = PageAPISerializer(page, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Only fire page_transaction when the description actually changed,
            # mirroring the internal PageViewSet.partial_update. Dispatched via
            # on_commit(robust=True) so broker failures absorb cleanly.
            if request.data.get("description_html") is not None:
                new_html = request.data.get("description_html", "<p></p>")
                page_pk = str(page.id)

                def _dispatch_page_transaction_update():
                    page_transaction.delay(
                        new_description_html=new_html,
                        old_description_html=previous_description_html,
                        page_id=page_pk,
                    )

                transaction.on_commit(_dispatch_page_transaction_update, robust=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @page_docs(
        operation_id="delete_page",
        summary="Delete page",
        description="Permanently delete a page from the project. Only the page owner or a project admin can delete.",
        parameters=[PAGE_ID_PARAMETER],
        responses={
            204: DELETED_RESPONSE,
            403: OpenApiResponse(description="Only the owner or a project admin can delete the page."),
            404: PROJECT_NOT_FOUND_RESPONSE,
        },
    )
    def delete(self, request, slug, project_id, pk):
        """Delete a page."""
        from plane.db.models import ProjectMember

        page = self.get_queryset().get(pk=pk)

        if page.owned_by_id != request.user.id and not ProjectMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            role=20,
            project_id=project_id,
            is_active=True,
        ).exists():
            return Response(
                {"error": "Only the owner or a project admin can delete the page"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Detach children to avoid CASCADE wiping unrelated descendants
        Page.objects.filter(parent_id=pk).update(parent=None)
        page.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
