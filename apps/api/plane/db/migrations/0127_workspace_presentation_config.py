# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# [ours: presentation] Operator fork — per-workspace presentation_config
# (ENG-389). Additive-only: adds one empty JSONField to Workspace. Existing
# rows get `presentation_config = {}` ⇒ NO demo chrome (strictly opt-in per
# workspace; the operator's own workspace never sets it and can never be
# de-chromed). This retires the hardcoded demo-chrome allowlist
# `["sentio","gordons","stirlight"]` that previously lived as a literal in
# apps/web/core/constants/demo-workspaces.ts — demo chrome is now data-driven.
#
# Shape (when populated):
#   {
#     "demo_chrome": true,
#     "entity_project_ids": ["<uuid>", ...],   # optional
#   }
#
# Written by the MCP `set_presentation_config` admin tool. Reverse is a clean
# column drop.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0126_page_page_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspace",
            name="presentation_config",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
