# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.
#
# [ours: brand] Operator fork — per-workspace brand customisation
# (ENG-114, Phase 2 of the Plane-fork programme). Additive-only: adds two
# nullable CharFields to Workspace. Existing rows get `brand_color = NULL` and
# `brand_name_override = NULL`; the brand_context resolver falls back to
# BRAND_CONTEXT_DEFAULTS / packages/constants/src/brand.ts when either is null.
# Reverse is a clean column drop.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0122_project_terminology"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspace",
            name="brand_color",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="workspace",
            name="brand_name_override",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
