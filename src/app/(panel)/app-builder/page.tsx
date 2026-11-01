import { Suspense } from "react";
import { connection } from "next/server";
import { AppBuilderPanel } from "@/app/(panel)/app-builder/app-builder-panel";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { LOCKED_MODULES } from "@/lib/modules";
import { isModuleEnabled } from "@/lib/modules-db";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listAppModules, listCustomFields } from "@/services/apps.service";

export const metadata = { title: "مدير التطبيقات | نظام ERP" };

async function BuilderContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "app-builder", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("app-builder"))) return <DisabledModule title="مدير التطبيقات" />;
  const [modules, fields] = await Promise.all([listAppModules(), listCustomFields()]);
  const locked = new Set<string>(LOCKED_MODULES);
  return (
    <div>
      <PageHeader
        title="مدير التطبيقات والحقول المخصصة"
        description="تفعيل الوحدات وإضافة حقول تظهر فوراً في النماذج والجداول دون كتابة كود."
      />
      <AppBuilderPanel
        canEdit={can(user, "app-builder", "edit") || can(user, "app-builder", "create")}
        modules={modules.map((module) => ({
          key: module.key,
          name: module.name,
          description: module.description,
          isEnabled: module.isEnabled,
          locked: locked.has(module.key),
        }))}
        fields={fields.map((field) => ({
          id: field.id,
          entityType: field.entityType,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          options: field.options,
        }))}
      />
    </div>
  );
}

export default function AppBuilderPage() {
  return (
    <Suspense fallback={<PageSkeleton title="مدير التطبيقات" />}>
      <BuilderContent />
    </Suspense>
  );
}
