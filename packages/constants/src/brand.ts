/**
 * Promptable Operator brand seam.
 *
 * This file is intentionally the SINGLE source of truth for product / company / URL
 * brand strings across the fork. Upstream rebases against makeplane/plane should
 * touch this file (and *only* this file) for brand swaps — every other surface
 * imports from here.
 *
 * Phase 1 ships fixed defaults. Phase 2 (per-workspace branding, see ENG-114)
 * adds runtime override resolution; the defaults exported here remain the
 * fallback when no workspace override is set.
 *
 * Rebase notes (operator-app fork — see ENG-42 programme):
 *   - [ours: brand] tag any commit that touches this file
 *   - never delete the upstream copyright preamble — only add ours
 */
export const PRODUCT_NAME = "Operator";
export const PRODUCT_NAME_SHORT = "Operator";
export const COMPANY_NAME = "Promptable";
export const COMPANY_LEGAL_NAME = "Promptable Ltd";
export const MARKETING_URL = "https://promptable.co.uk";
export const DOCS_URL = "https://promptable.co.uk/docs";
// Support-email default. `SUPPORT_EMAIL` is re-exported from ./endpoints
// because it's already env-overridable there. Keep this as the brand default
// the endpoints loader falls back to.
export const SUPPORT_EMAIL = "support@promptable.co.uk";
export const TWITTER_HANDLE = "@promptablehq";

export const BRAND = {
  productName: PRODUCT_NAME,
  productNameShort: PRODUCT_NAME_SHORT,
  companyName: COMPANY_NAME,
  companyLegalName: COMPANY_LEGAL_NAME,
  marketingUrl: MARKETING_URL,
  docsUrl: DOCS_URL,
  supportEmail: SUPPORT_EMAIL,
  twitterHandle: TWITTER_HANDLE,
} as const;

export type Brand = typeof BRAND;
