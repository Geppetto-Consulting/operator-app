# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    PageListCreateAPIEndpoint,
    PageDetailAPIEndpoint,
    PageArchiveAPIEndpoint,
    PageUnarchiveAPIEndpoint,
)


urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/",
        PageListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="pages",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:pk>/",
        PageDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="pages",
    ),
    # [ours: pages-api] ENG-153 — archive / unarchive companion endpoints.
    # Required to satisfy the archive-before-DELETE invariant added to the
    # delete handler (mirrors internal app/views/page/base.py:308-366).
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:pk>/archive/",
        PageArchiveAPIEndpoint.as_view(http_method_names=["post"]),
        name="pages-archive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:pk>/unarchive/",
        PageUnarchiveAPIEndpoint.as_view(http_method_names=["post"]),
        name="pages-unarchive",
    ),
]
