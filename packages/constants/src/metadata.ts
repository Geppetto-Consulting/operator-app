/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * Promptable Operator fork: brand strings are sourced from ./brand.ts so future
 * upstream rebases touch a single seam. See ENG-113 + ENG-42 programme.
 */

import { COMPANY_NAME, MARKETING_URL, PRODUCT_NAME, TWITTER_HANDLE } from "./brand";

const SITE_TAGLINE = `${PRODUCT_NAME} | The agent-native operator stack for high-velocity teams.`;

export const SITE_NAME = SITE_TAGLINE;
export const SITE_TITLE = SITE_TAGLINE;
export const SITE_DESCRIPTION = `${PRODUCT_NAME} — manage work items, cycles, and product roadmaps with an agent-friendly operator surface.`;
export const SITE_KEYWORDS =
  "operator tooling, agent native, project management, work items tracking, agile, scrum, kanban, collaboration, automation";
export const SITE_URL = MARKETING_URL;
export const TWITTER_USER_NAME = SITE_TAGLINE;

// Publish Sites Metadata (formerly "Plane Sites")
export const SPACE_SITE_NAME = `${PRODUCT_NAME} Publish | Share boards and roadmaps publicly with one click.`;
export const SPACE_SITE_TITLE = `${PRODUCT_NAME} Publish | Share boards publicly with one click`;
export const SPACE_SITE_DESCRIPTION = `${PRODUCT_NAME} Publish is a customer feedback management surface built on ${COMPANY_NAME}'s operator stack.`;
export const SPACE_SITE_KEYWORDS =
  "operator tooling, customer feedback, project management, work items tracking, agile, scrum, kanban, collaboration";
export const SPACE_SITE_URL = MARKETING_URL;
export const SPACE_TWITTER_USER_NAME = TWITTER_HANDLE.replace(/^@/, "");
