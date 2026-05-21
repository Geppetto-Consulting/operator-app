# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.
#
# [ours: terminology] Operator fork — per-project terminology infrastructure
# (ENG-118, Phase 6 of the Plane-fork programme). Additive-only: adds an empty
# JSONField to Project. Existing rows get `terminology = {}`; the frontend
# useTerminology() hook falls back to OPERATOR_DEFAULT_TERMINOLOGY when the
# field is empty or partially populated. Reverse is a clean column drop.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0121_alter_estimate_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="terminology",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
