/**
 * Copyright (c) 2026-present Promptable Ltd and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * [ours: brand] Operator fork — ENG-114 / Phase 2 of the Plane-fork programme.
 * Per-workspace brand customisation form: logo upload (reuses the existing
 * `WorkspaceImageUploadModal` widget — the same primitive the General tab uses
 * for the workspace icon), brand colour text input, and an optional name
 * override. Accepts either an `oklch(...)` string OR a hex value; both render
 * as a CSS `background-color`. Writes via `updateWorkspace` (PATCH) — the
 * Django serializer surfaces `brand_color` and `brand_name_override` as
 * writable fields via `fields = "__all__"`.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
// Plane Imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { EditIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IWorkspace } from "@plane/types";
import { Input } from "@plane/ui";
import { cn, getFileURL } from "@plane/utils";
// components
import { WorkspaceImageUploadModal } from "@/components/core/modals/workspace-image-upload-modal";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUserPermissions } from "@/hooks/store/user";

// Operator-default brand colour (mirrors `--brand-default` from
// `packages/tailwind-config/variables.css` and `BRAND_CONTEXT_DEFAULTS`
// in `apps/api/plane/utils/brand_context.py`). The preview chip falls back to
// this when no override is set, so the user sees Promptable defaults rather
// than a transparent square.
const OPERATOR_DEFAULT_BRAND_COLOR = "oklch(0.4799 0.1158 242.91)";

// Permissive but tight enough to catch typos:
//   - hex:  #rgb / #rrggbb / #rrggbbaa
//   - oklch(L C H) / oklch(L C H / a) — L can be a number OR a percentage.
//     We deliberately do NOT enforce ranges (oklch arguments are open-ended
//     in some CSS specs); the browser will refuse genuinely invalid values
//     at render time, and that's fine for an admin-only setting.
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// oklch( <L> <C> <H> [/ <A>] ) — whitespace lenient.
const OKLCH_RE = /^oklch\(\s*[0-9.]+%?\s+[0-9.]+%?\s+[0-9.]+(?:deg)?(?:\s*\/\s*[0-9.]+%?)?\s*\)$/i;

function isValidBrandColor(value: string | null | undefined): boolean {
  if (!value) return true; // empty/null is valid (resets to operator default)
  const trimmed = value.trim();
  return HEX_RE.test(trimmed) || OKLCH_RE.test(trimmed);
}

type BrandingFormValues = {
  brand_color: string;
  brand_name_override: string;
  logo_url: string | null;
};

export const WorkspaceBranding = observer(function WorkspaceBranding() {
  // states
  const [isLoading, setIsLoading] = useState(false);
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  // store hooks
  const { currentWorkspace, updateWorkspace, updateWorkspaceLogo } = useWorkspace();
  const { allowPermissions } = useUserPermissions();

  // form
  const {
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<BrandingFormValues>({
    defaultValues: {
      brand_color: currentWorkspace?.brand_color ?? "",
      brand_name_override: currentWorkspace?.brand_name_override ?? "",
      logo_url: currentWorkspace?.logo_url ?? null,
    },
  });

  // derived values
  const brandColor = watch("brand_color");
  const workspaceLogo = watch("logo_url");
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  useEffect(() => {
    if (currentWorkspace) {
      reset({
        brand_color: currentWorkspace.brand_color ?? "",
        brand_name_override: currentWorkspace.brand_name_override ?? "",
        logo_url: currentWorkspace.logo_url ?? null,
      });
    }
  }, [currentWorkspace, reset]);

  const onSubmit = async (data: BrandingFormValues) => {
    if (!currentWorkspace) return;
    // Empty-string → null on the wire so the backend stores NULL and the
    // resolver falls back cleanly to BRAND_CONTEXT_DEFAULTS.
    const payload: Partial<IWorkspace> = {
      brand_color: data.brand_color.trim() === "" ? null : data.brand_color.trim(),
      brand_name_override: data.brand_name_override.trim() === "" ? null : data.brand_name_override.trim(),
    };
    setIsLoading(true);
    try {
      await updateWorkspace(currentWorkspace.slug, payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Saved",
        message: "Workspace branding updated.",
      });
    } catch (err) {
      console.error(err);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Save failed",
        message: "Could not update workspace branding. Try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentWorkspace) return;
    // The WorkspaceImageUploadModal already deletes the underlying asset
    // (`deleteWorkspaceAsset`) and the backend's `entity_asset_delete` clears
    // `workspace.logo_asset_id`. `logo_url` is a read-only computed property
    // on the serializer (resolves from the asset), so PATCH-ing it silently
    // no-ops — we just refresh local store state so the UI reflects the now-
    // null asset.
    try {
      updateWorkspaceLogo(currentWorkspace.slug, "");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Logo removed",
        message: "Workspace logo cleared. Defaults will be used in branded surfaces.",
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Could not remove logo",
        message: "Please try again.",
      });
    }
  };

  if (!currentWorkspace) return null;

  const previewColor = brandColor && isValidBrandColor(brandColor) ? brandColor : OPERATOR_DEFAULT_BRAND_COLOR;

  return (
    <>
      <Controller
        control={control}
        name="logo_url"
        render={({ field: { onChange, value } }) => (
          <WorkspaceImageUploadModal
            isOpen={isImageUploadModalOpen}
            onClose={() => setIsImageUploadModalOpen(false)}
            handleRemove={handleRemoveLogo}
            onSuccess={(imageUrl) => {
              onChange(imageUrl);
              setIsImageUploadModalOpen(false);
            }}
            value={value}
          />
        )}
      />

      <div className={cn("flex w-full flex-col gap-y-8", { "opacity-60": !isAdmin })}>
        {/* Logo */}
        <section className="flex flex-col gap-3">
          <h3 className="text-h6-semibold">Logo</h3>
          <p className="text-body-sm-regular text-tertiary">
            Shown in the workspace switcher and at the top of transactional emails sent from this workspace.
          </p>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => setIsImageUploadModalOpen(true)} disabled={!isAdmin}>
              {workspaceLogo && workspaceLogo !== "" ? (
                <div className="relative flex size-14">
                  <img
                    src={getFileURL(workspaceLogo)}
                    className="absolute top-0 left-0 size-full rounded-md object-cover"
                    alt="Workspace Logo"
                  />
                </div>
              ) : (
                <div className="relative grid size-14 place-items-center rounded-md bg-accent-primary text-24 text-on-color uppercase">
                  {currentWorkspace?.name?.charAt(0) ?? "N"}
                </div>
              )}
            </button>
            {isAdmin && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-left text-caption-sm-medium text-accent-primary"
                onClick={() => setIsImageUploadModalOpen(true)}
              >
                {workspaceLogo && workspaceLogo !== "" ? (
                  <>
                    <EditIcon className="h-3 w-3" />
                    Replace logo
                  </>
                ) : (
                  "Upload logo"
                )}
              </button>
            )}
          </div>
        </section>

        {/* Brand colour */}
        <section className="flex flex-col gap-3">
          <h3 className="text-h6-semibold">Brand colour</h3>
          <p className="text-body-sm-regular text-tertiary">
            Used for accents in the UI and the header bar in transactional emails. Accepts either a hex value (
            <code>#1080bc</code>) or an oklch() value (<code>oklch(0.5 0.2 28)</code>). Leave blank to use Promptable
            defaults.
          </p>
          <div className="grid grid-cols-1 items-end gap-5 xl:grid-cols-[1fr_auto]">
            <Controller
              control={control}
              name="brand_color"
              rules={{
                validate: (value) =>
                  isValidBrandColor(value) ||
                  "Enter a valid hex (#aabbcc) or oklch() value, or leave blank for the default.",
              }}
              render={({ field: { value, onChange, ref } }) => (
                <Input
                  id="brand_color"
                  name="brand_color"
                  type="text"
                  value={value ?? ""}
                  onChange={onChange}
                  ref={ref}
                  hasError={Boolean(errors.brand_color)}
                  placeholder="oklch(0.5 0.2 28)  /  #1080bc"
                  className="w-full rounded-md"
                  disabled={!isAdmin}
                />
              )}
            />
            <div
              className="size-14 shrink-0 rounded-md border border-subtle"
              style={{ backgroundColor: previewColor }}
              aria-label="Brand colour preview"
              title={previewColor}
            />
          </div>
          {errors.brand_color && (
            <p className="text-caption-sm-regular text-danger-primary">{errors.brand_color.message}</p>
          )}
        </section>

        {/* Name override */}
        <section className="flex flex-col gap-3">
          <h3 className="text-h6-semibold">Product name override (optional)</h3>
          <p className="text-body-sm-regular text-tertiary">
            Override the &ldquo;Operator&rdquo; product name in transactional emails for users in this
            workspace. Leave blank to use the default.
          </p>
          <Controller
            control={control}
            name="brand_name_override"
            render={({ field: { value, onChange, ref } }) => (
              <Input
                id="brand_name_override"
                name="brand_name_override"
                type="text"
                value={value ?? ""}
                onChange={onChange}
                ref={ref}
                placeholder="Operator"
                className="w-full rounded-md"
                disabled={!isAdmin}
              />
            )}
          />
        </section>

        {isAdmin && (
          <div className="flex items-center justify-between py-2">
            <Button
              variant="primary"
              size="lg"
              onClick={(e) => {
                void handleSubmit(onSubmit)(e);
              }}
              loading={isLoading}
              disabled={!isDirty || isLoading}
            >
              {isLoading ? "Saving..." : "Save branding"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
});
