# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db.models import Q

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse

# Module imports
from plane.api.serializers import IssueViewAPISerializer
from plane.app.permissions import ProjectEntityPermission, WorkspaceEntityPermission
from plane.db.models import IssueView, Workspace, WorkspaceMember, ProjectMember
from .base import BaseAPIView
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    create_paginated_response,
    DELETED_RESPONSE,
    INVALID_REQUEST_RESPONSE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _visible_views_q(user):
    # A view is visible to a user when it's public (access=1) OR they own it.
    return Q(owned_by=user) | Q(access=1)


# ---------------------------------------------------------------------------
# Workspace-level (project IS NULL) views
# ---------------------------------------------------------------------------


class WorkspaceViewListCreateAPIEndpoint(BaseAPIView):
    """Workspace-level saved view list / create endpoint.

    Saved views whose `project` is NULL — they belong to the workspace,
    not to a specific project. Mirrors the internal WorkspaceViewViewSet
    semantics but exposed via the x-api-key surface.
    """

    serializer_class = IssueViewAPISerializer
    model = IssueView
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueView.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project__isnull=True)
            .filter(_visible_views_q(self.request.user))
            .select_related("workspace", "owned_by")
            .distinct()
        )

    @extend_schema(
        operation_id="list_workspace_views",
        summary="List workspace views",
        description="List saved workspace-level views visible to the requesting API key user. Includes public views and the user's own private views.",  # noqa: E501
        tags=["Views"],
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                IssueViewAPISerializer,
                "PaginatedWorkspaceViewResponse",
                "Paginated list of workspace views",
                "Paginated Workspace Views",
            ),
        },
    )
    def get(self, request, slug):
        """List workspace views."""
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda views: IssueViewAPISerializer(
                views, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    @extend_schema(
        operation_id="create_workspace_view",
        summary="Create workspace view",
        description="Create a new workspace-level saved view. `owned_by` is set from the API key's user.",
        tags=["Views"],
        request=IssueViewAPISerializer,
        responses={
            201: OpenApiResponse(
                description="View created",
                response=IssueViewAPISerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug):
        """Create workspace view."""
        workspace = Workspace.objects.get(slug=slug)
        serializer = IssueViewAPISerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(workspace_id=workspace.id, owned_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkspaceViewDetailAPIEndpoint(BaseAPIView):
    """Workspace-level saved view retrieve / update / delete endpoint."""

    serializer_class = IssueViewAPISerializer
    model = IssueView
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueView.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project__isnull=True)
            .filter(_visible_views_q(self.request.user))
            .select_related("workspace", "owned_by")
            .distinct()
        )

    @extend_schema(
        operation_id="retrieve_workspace_view",
        summary="Retrieve workspace view",
        description="Retrieve a workspace-level saved view by id.",
        tags=["Views"],
        responses={
            200: OpenApiResponse(
                description="View retrieved",
                response=IssueViewAPISerializer,
            ),
        },
    )
    def get(self, request, slug, pk):
        """Retrieve workspace view."""
        view = self.get_queryset().get(pk=pk)
        serializer = IssueViewAPISerializer(view, fields=self.fields, expand=self.expand)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="update_workspace_view",
        summary="Update workspace view",
        description="Partially update a workspace-level saved view. Only the owner may update.",
        tags=["Views"],
        request=IssueViewAPISerializer,
        responses={
            200: OpenApiResponse(
                description="View updated",
                response=IssueViewAPISerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, pk):
        """Update workspace view (owner only)."""
        view = IssueView.objects.get(
            pk=pk, workspace__slug=slug, project__isnull=True
        )

        if view.is_locked:
            return Response(
                {"error": "view is locked"}, status=status.HTTP_400_BAD_REQUEST
            )

        if view.owned_by_id != request.user.id:
            return Response(
                {"error": "Only the owner of the view can update the view"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = IssueViewAPISerializer(view, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        operation_id="delete_workspace_view",
        summary="Delete workspace view",
        description="Delete a workspace-level saved view. Owner or workspace admin only.",
        tags=["Views"],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, pk):
        """Delete workspace view (owner or workspace admin)."""
        view = IssueView.objects.get(
            pk=pk, workspace__slug=slug, project__isnull=True
        )

        is_admin = WorkspaceMember.objects.filter(
            workspace__slug=slug,
            member=request.user,
            role=20,
            is_active=True,
        ).exists()

        if not is_admin and view.owned_by_id != request.user.id:
            return Response(
                {"error": "Only the owner or workspace admin can delete the view"},
                status=status.HTTP_403_FORBIDDEN,
            )

        view.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Project-level views
# ---------------------------------------------------------------------------


class ProjectViewListCreateAPIEndpoint(BaseAPIView):
    """Project-level saved view list / create endpoint."""

    serializer_class = IssueViewAPISerializer
    model = IssueView
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueView.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .filter(_visible_views_q(self.request.user))
            .select_related("project", "workspace", "owned_by")
            .distinct()
        )

    @extend_schema(
        operation_id="list_project_views",
        summary="List project views",
        description="List saved project-level views visible to the requesting API key user.",
        tags=["Views"],
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                IssueViewAPISerializer,
                "PaginatedProjectViewResponse",
                "Paginated list of project views",
                "Paginated Project Views",
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List project views."""
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda views: IssueViewAPISerializer(
                views, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    @extend_schema(
        operation_id="create_project_view",
        summary="Create project view",
        description="Create a new project-level saved view. `owned_by` is set from the API key's user.",
        tags=["Views"],
        request=IssueViewAPISerializer,
        responses={
            201: OpenApiResponse(
                description="View created",
                response=IssueViewAPISerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        """Create project view."""
        serializer = IssueViewAPISerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(project_id=project_id, owned_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProjectViewDetailAPIEndpoint(BaseAPIView):
    """Project-level saved view retrieve / update / delete endpoint."""

    serializer_class = IssueViewAPISerializer
    model = IssueView
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueView.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .filter(_visible_views_q(self.request.user))
            .select_related("project", "workspace", "owned_by")
            .distinct()
        )

    @extend_schema(
        operation_id="retrieve_project_view",
        summary="Retrieve project view",
        description="Retrieve a project-level saved view by id.",
        tags=["Views"],
        responses={
            200: OpenApiResponse(
                description="View retrieved",
                response=IssueViewAPISerializer,
            ),
        },
    )
    def get(self, request, slug, project_id, pk):
        """Retrieve project view."""
        view = self.get_queryset().get(pk=pk)
        serializer = IssueViewAPISerializer(view, fields=self.fields, expand=self.expand)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="update_project_view",
        summary="Update project view",
        description="Partially update a project-level saved view. Only the owner may update.",
        tags=["Views"],
        request=IssueViewAPISerializer,
        responses={
            200: OpenApiResponse(
                description="View updated",
                response=IssueViewAPISerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, pk):
        """Update project view (owner only)."""
        view = IssueView.objects.get(
            pk=pk, workspace__slug=slug, project_id=project_id
        )

        if view.is_locked:
            return Response(
                {"error": "view is locked"}, status=status.HTTP_400_BAD_REQUEST
            )

        if view.owned_by_id != request.user.id:
            return Response(
                {"error": "Only the owner of the view can update the view"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = IssueViewAPISerializer(view, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        operation_id="delete_project_view",
        summary="Delete project view",
        description="Delete a project-level saved view. Owner or project admin only.",
        tags=["Views"],
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, pk):
        """Delete project view (owner or project admin)."""
        view = IssueView.objects.get(
            pk=pk, workspace__slug=slug, project_id=project_id
        )

        is_admin = ProjectMember.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            member=request.user,
            role=20,
            is_active=True,
        ).exists()

        if not is_admin and view.owned_by_id != request.user.id:
            return Response(
                {"error": "Only the owner or project admin can delete the view"},
                status=status.HTTP_403_FORBIDDEN,
            )

        view.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
