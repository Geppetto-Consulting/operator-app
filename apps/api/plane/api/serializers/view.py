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

    [ours: api] ENG-264 — `rich_filters` is exposed as a writable JSON field.
    The web UI reads `rich_filters` directly (no fallback to `filters`), so
    public REST callers must be able to set it for an API-created View to
    actually filter issues. The model's save() does NOT populate
    `rich_filters` from `filters` — that conversion only ran once in
    migration 0107_migrate_filters_to_rich_filters. Callers (operator MCP,
    etc.) construct the rich_filters payload using the converter's output
    shape (see plane.utils.filters.converters.LegacyToRichFiltersConverter);
    we accept it as opaque JSON here (defaults to {} per the model column
    default).
    """

    class Meta:
        model = IssueView
        fields = [
            "id",
            "name",
            "description",
            "filters",
            "rich_filters",
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
