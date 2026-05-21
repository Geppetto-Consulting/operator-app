# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers
from lxml import html

# Module imports
from .base import BaseSerializer
from plane.db.models import Page, Project, ProjectPage
from plane.utils.content_validator import validate_html_content


class PageAPISerializer(BaseSerializer):
    """
    Public REST API serializer for Pages.

    Mirrors the internal PageSerializer but strips internal-only fields
    (access flags, favorite state, project/label many-to-many, view/logo props,
    binary description) and keeps the surface focused on agent-friendly
    HTML/JSON content management.

    Binary Yjs content (description_binary) is intentionally NOT exposed —
    clients write HTML and the live-service syncs the binary representation.
    """

    description_html = serializers.CharField(required=False, allow_blank=True)
    description_json = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "description_html",
            "description_json",
            "owned_by",
            "is_locked",
            "archived_at",
            "color",
            "external_id",
            "external_source",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "owned_by",
            "is_locked",
            "archived_at",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]

    def validate(self, data):
        # Normalise + validate HTML content if present
        description_html = data.get("description_html")
        if description_html:
            try:
                parsed = html.fromstring(description_html)
                data["description_html"] = html.tostring(parsed, encoding="unicode")
            except Exception:
                raise serializers.ValidationError({"description_html": "Invalid HTML passed"})

            is_valid, error_msg, sanitized_html = validate_html_content(data["description_html"])
            if not is_valid:
                raise serializers.ValidationError({"description_html": "html content is not valid"})
            if sanitized_html is not None:
                data["description_html"] = sanitized_html

        return data

    def create(self, validated_data):
        project_id = self.context["project_id"]
        owned_by_id = self.context["owned_by_id"]

        # Get the workspace id from the project
        project = Project.objects.get(pk=project_id)

        # Default description_html to <p></p> when blank to mirror internal behavior
        if "description_html" not in validated_data or not validated_data.get("description_html"):
            validated_data["description_html"] = "<p></p>"

        # Default description_json to {} when null/missing
        if "description_json" not in validated_data or validated_data.get("description_json") is None:
            validated_data["description_json"] = {}

        page = Page.objects.create(
            **validated_data,
            owned_by_id=owned_by_id,
            workspace_id=project.workspace_id,
        )

        # Attach the page to the project
        ProjectPage.objects.create(
            workspace_id=page.workspace_id,
            project_id=project_id,
            page_id=page.id,
            created_by_id=page.created_by_id,
            updated_by_id=page.updated_by_id,
        )

        return page
