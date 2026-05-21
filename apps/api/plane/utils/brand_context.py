# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# Promptable Operator fork (ENG-113) — single brand seam for the Django side.
# Mirrors packages/constants/src/brand.ts. Future per-workspace branding
# (Phase 2 / ENG-114) resolves overrides on top of these defaults via the same dict.

from django.template.loader import render_to_string

BRAND_CONTEXT_DEFAULTS = {
    "brand_name": "Promptable Operator",
    "brand_name_short": "Operator",
    "company_name": "Promptable",
    "company_legal_name": "Promptable Ltd",
    "marketing_url": "https://promptable.co.uk",
    "docs_url": "https://promptable.co.uk/docs",
    "support_email": "support@promptable.co.uk",
}


def render_email_template(template_name, context=None):
    """
    Render an email template with brand-context defaults pre-injected.

    Background tasks render emails outside the request cycle, so Django's
    `context_processors` never fire. This helper merges brand defaults into the
    caller's context (caller wins on conflicts) so every email template can rely
    on ``{{ brand_name }}``, ``{{ support_email }}``, etc.

    Args:
        template_name (str): Template path, e.g. ``"emails/auth/forgot_password.html"``.
        context (dict | None): Caller-supplied context. Merged on top of defaults.

    Returns:
        str: Rendered HTML.
    """
    merged = {**BRAND_CONTEXT_DEFAULTS, **(context or {})}
    return render_to_string(template_name, merged)
