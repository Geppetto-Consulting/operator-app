/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 *
 * [ours: terminology] Operator fork — per-project terminology editor (ENG-119)
 *
 * Admin can override singular / plural / verb_create for this project. Empty
 * fields fall back to operator defaults at the useTerminology() seam. Stored
 * on Project.terminology (JSONB) via the standard updateProject API.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { OPERATOR_DEFAULT_TERMINOLOGY, useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TProjectTerminology } from "@plane/types";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// local
import { TerminologyProjectSettingsHeader } from "./header";

function TerminologySettingsPage() {
  // router
  const { workspaceSlug, projectId } = useParams();
  const workspaceSlugStr = workspaceSlug?.toString() ?? "";
  const projectIdStr = projectId?.toString() ?? "";
  // store hooks
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const { currentProjectDetails: projectDetails, updateProject } = useProject();
  // i18n
  const { t } = useTranslation();

  // derived values
  const canPerformProjectAdminActions = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  const initial = projectDetails?.terminology ?? {};

  // form state
  const [singular, setSingular] = useState<string>(initial.singular ?? "");
  const [plural, setPlural] = useState<string>(initial.plural ?? "");
  const [verbCreate, setVerbCreate] = useState<string>(initial.verb_create ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pageTitle = projectDetails?.name ? `${projectDetails?.name} - Terminology` : undefined;

  const handleSave = async () => {
    if (!projectDetails || !workspaceSlugStr || !projectIdStr) return;
    const terminology: TProjectTerminology = {
      // Trim and persist; empty strings collapse to fallback at the hook layer
      singular: singular.trim(),
      plural: plural.trim(),
      verb_create: verbCreate.trim(),
    };
    try {
      setIsSubmitting(true);
      await updateProject(workspaceSlugStr, projectIdStr, { terminology });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Saved",
        message: "Project terminology updated.",
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Could not update terminology. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSingular("");
    setPlural("");
    setVerbCreate("");
  };

  if (workspaceUserInfo && !canPerformProjectAdminActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<TerminologyProjectSettingsHeader />} hugging>
      <PageHead title={pageTitle} />
      <section className={`w-full ${canPerformProjectAdminActions ? "" : "opacity-60"}`}>
        <SettingsHeading
          title={t("project_settings.terminology.heading")}
          description={t("project_settings.terminology.description")}
        />
        <div className="mt-6 flex max-w-xl flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="terminology-singular" className="text-13 font-medium">
              Singular label
            </label>
            <Input
              id="terminology-singular"
              type="text"
              value={singular}
              onChange={(e) => setSingular(e.target.value)}
              placeholder={OPERATOR_DEFAULT_TERMINOLOGY.singular}
              disabled={!canPerformProjectAdminActions || isSubmitting}
              autoComplete="off"
            />
            <span className="text-11 text-tertiary">
              Falls back to "{OPERATOR_DEFAULT_TERMINOLOGY.singular}" when empty.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="terminology-plural" className="text-13 font-medium">
              Plural label
            </label>
            <Input
              id="terminology-plural"
              type="text"
              value={plural}
              onChange={(e) => setPlural(e.target.value)}
              placeholder={OPERATOR_DEFAULT_TERMINOLOGY.plural}
              disabled={!canPerformProjectAdminActions || isSubmitting}
              autoComplete="off"
            />
            <span className="text-11 text-tertiary">
              Falls back to "{OPERATOR_DEFAULT_TERMINOLOGY.plural}" when empty.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="terminology-verb-create" className="text-13 font-medium">
              Create action label
            </label>
            <Input
              id="terminology-verb-create"
              type="text"
              value={verbCreate}
              onChange={(e) => setVerbCreate(e.target.value)}
              placeholder={OPERATOR_DEFAULT_TERMINOLOGY.verb_create}
              disabled={!canPerformProjectAdminActions || isSubmitting}
              autoComplete="off"
            />
            <span className="text-11 text-tertiary">
              Falls back to "{OPERATOR_DEFAULT_TERMINOLOGY.verb_create}" when empty.
            </span>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="primary"
              size="base"
              onClick={handleSave}
              loading={isSubmitting}
              disabled={!canPerformProjectAdminActions || isSubmitting}
            >
              Save terminology
            </Button>
            <Button
              variant="secondary"
              size="base"
              onClick={handleReset}
              disabled={!canPerformProjectAdminActions || isSubmitting}
            >
              Reset to defaults
            </Button>
          </div>
        </div>
      </section>
    </SettingsContentWrapper>
  );
}

export default observer(TerminologySettingsPage);
