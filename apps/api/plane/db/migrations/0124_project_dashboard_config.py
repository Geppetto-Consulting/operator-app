# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# [ours: dashboards] Operator fork — per-project dashboard configuration
# (ENG-178, Phase 1 of the Operator Dashboards programme). Additive-only:
# adds an empty JSONField to Project. Existing rows get
# `dashboard_config = {}`; the dashboard-data endpoint short-circuits to
# `{ "widgets": {} }` when the config is empty / unparseable, so the
# frontend can render an empty-state. Reverse is a clean column drop.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0123_workspace_brand_color_brand_name_override"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="dashboard_config",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
