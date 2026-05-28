# Copyright (c) 2026-present Promptable Ltd and contributors
# SPDX-License-Identifier: AGPL-3.0-only
#
# Operator fork (ENG-113) — single brand seam for the Django side.
# Mirrors packages/constants/src/brand.ts. Future per-workspace branding
# (Phase 2 / ENG-114) resolves overrides on top of these defaults via the same dict.

from django.template.loader import render_to_string

BRAND_CONTEXT_DEFAULTS = {
    "brand_name": "Operator",
    "brand_name_short": "Operator",
    "company_name": "Promptable",
    "company_legal_name": "Promptable Ltd",
    "marketing_url": "https://promptable.co.uk",
    "docs_url": "https://promptable.co.uk/docs",
    "support_email": "support@promptable.co.uk",
    # [ours: brand] Phase 2 (ENG-114) — operator-default brand colour + logo.
    # `brand_color` is an oklch() string; templates inline it as a CSS color and
    # the document <head> reads it for the runtime CSS-var override on the web
    # app. `brand_logo_url` may be None — templates SHOULD fall back to the text
    # `brand_name` when no logo is set.
    "brand_color": "oklch(0.4799 0.1158 242.91)",
    "brand_logo_url": None,
}


def workspace_brand_context(workspace) -> dict:
    """Resolve brand-context overrides for a single workspace.

    Phase 2 (ENG-114) per-workspace branding seam. Reads ``brand_color``,
    ``brand_name_override`` and the existing ``logo_url`` property from the
    Workspace row, falling back to ``BRAND_CONTEXT_DEFAULTS`` whenever a
    workspace-level value is unset (``None`` or empty string). Returns a dict
    suitable for splatting into ``render_email_template`` context.

    Args:
        workspace: A ``plane.db.models.Workspace`` instance, or ``None``. When
            ``None`` (e.g. system emails not bound to a workspace), the function
            returns an empty dict so callers can splat unconditionally.

    Returns:
        dict: Brand keys (``brand_name``, ``brand_color``, ``brand_logo_url``)
        populated from the workspace override OR from the operator defaults.
    """
    if workspace is None:
        return {}
    return {
        "brand_name": workspace.brand_name_override or BRAND_CONTEXT_DEFAULTS["brand_name"],
        "brand_color": workspace.brand_color or BRAND_CONTEXT_DEFAULTS["brand_color"],
        # Workspace.logo_url is a @property that resolves logo_asset (S3) OR the
        # legacy textual ``logo`` field, returning None when neither is set.
        "brand_logo_url": workspace.logo_url or BRAND_CONTEXT_DEFAULTS["brand_logo_url"],
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
