# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from plane.db.models import IssueView


class IssueViewAPISerializer(BaseSerializer):
    """
    Public REST API serializer for saved views (IssueView).

    Mirrors the internal IssueViewSerializer but treats `owned_by` as read-only —
    it is set automatically from the API key's user on create and cannot be
    changed via the API. Filter / display payloads are kept opaque JSON; the
    public surface does not validate Plane-UI-specific shapes.

    The model's `save()` derives `query` from `filters` automatically, so we
    do not duplicate that work here.
    """

    class Meta:
        model = IssueView
        fields = [
            "id",
            "name",
            "description",
            "filters",
            "display_filters",
            "display_properties",
            "access",
            "owned_by",
            "is_locked",
            "logo_props",
            "sort_order",
            "workspace",
            "project",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "project",
            "owned_by",
            "is_locked",
            "sort_order",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
