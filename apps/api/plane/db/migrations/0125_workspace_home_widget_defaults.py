# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# [ours: workspace-brand] Operator fork — per-workspace home-widget defaults
# (ENG-290). Additive-only: adds an empty JSONField to Workspace. Existing rows
# get `home_widget_defaults = {}`; the workspace-home preference seeder
# falls back to Plane's stock defaults (all widgets on, except quick_tutorial /
# new_at_plane which are skipped at the view layer) when the dict is empty.
#
# Shape (when populated):
#   {
#     "quick_links":     {"is_enabled": false},
#     "recents":         {"is_enabled": false},
#     "my_stickies":     {"is_enabled": false},
#     "entry_points":    {"is_enabled": true,
#                         "cards": [{"label": "...", "description": "...",
#                                    "icon": "...", "url": "..."}, ...]},
#   }
#
# Demo workspaces (sentio / gordons / stirlight) get a populated dict so a
# first-time prospect lands on a single "pick where to start" card row instead
# of Plane's stock noise. Reverse is a clean column drop.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0124_project_dashboard_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="workspace",
            name="home_widget_defaults",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
