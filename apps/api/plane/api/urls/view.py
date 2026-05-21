# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    WorkspaceViewListCreateAPIEndpoint,
    WorkspaceViewDetailAPIEndpoint,
    ProjectViewListCreateAPIEndpoint,
    ProjectViewDetailAPIEndpoint,
)

urlpatterns = [
    # Workspace-level views
    path(
        "workspaces/<str:slug>/views/",
        WorkspaceViewListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="workspace-views",
    ),
    path(
        "workspaces/<str:slug>/views/<uuid:pk>/",
        WorkspaceViewDetailAPIEndpoint.as_view(
            http_method_names=["get", "patch", "delete"]
        ),
        name="workspace-views",
    ),
    # Project-level views
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/views/",
        ProjectViewListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project-views",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/views/<uuid:pk>/",
        ProjectViewDetailAPIEndpoint.as_view(
            http_method_names=["get", "patch", "delete"]
        ),
        name="project-views",
    ),
]
