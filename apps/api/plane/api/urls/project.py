# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    ProjectListCreateAPIEndpoint,
    ProjectDetailAPIEndpoint,
    ProjectArchiveUnarchiveAPIEndpoint,
    ProjectSummaryAPIEndpoint,
    ProjectSortOrderAPIEndpoint,
    WorkspaceQuickLinkAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/",
        ProjectListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:pk>/",
        ProjectDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/archive/",
        ProjectArchiveUnarchiveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="project-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/summary/",
        ProjectSummaryAPIEndpoint.as_view(http_method_names=["get"]),
        name="project-summary",
    ),
    # ours: api — operator demo-deploy automation
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/sort-order/",
        ProjectSortOrderAPIEndpoint.as_view(http_method_names=["post"]),
        name="project-sort-order",
    ),
    path(
        "workspaces/<str:slug>/quick-links/",
        WorkspaceQuickLinkAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="workspace-quick-links",
    ),
    path(
        "workspaces/<str:slug>/quick-links/<uuid:pk>/",
        WorkspaceQuickLinkAPIEndpoint.as_view(http_method_names=["patch", "delete"]),
        name="workspace-quick-link-detail",
    ),
]
