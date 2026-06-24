# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.
#
# [ours: api] Operator fork — durable page_type column on Page (ENG-411).
# Additive-only: adds one nullable CharField. Existing rows get
# `page_type = NULL` (untyped / legacy). No DB-level choices constraint —
# validation lives in the MCP / serializer layer so future type values and
# legacy nulls are both accepted. Reverse is a clean column drop.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0125_workspace_home_widget_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="page",
            name="page_type",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
    ]
