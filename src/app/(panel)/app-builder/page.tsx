import { Suspense } from "react";
import { connection } from "next/server";
import { AppBuilderPanel } from "@/app/(panel)/app-builder/app-builder-panel";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { LOCKED_MODULES } from "@/lib/modules";
import { isModuleEnabled } from "@/lib/modules-db";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listAppModules, listCustomFields } from "@/services/apps.service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "مدير التطبيقات والحقول المخصصة | شركة فنتشر فودز ذ.م.م.",
  description: "تفعيل وحدات النظام وإدارة الحقول المخصصة لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function BuilderContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "app-builder", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("app-builder"))) return <DisabledModule title="مدير التطبيقات والحقول المخصصة" />;
  const [modules, fields] = await Promise.all([listAppModules(), listCustomFields()]);
  const locked = new Set<string>(LOCKED_MODULES);
  return (
    <div className="w-full max-w-none space-y-5">
      <PageHeader
        title="مدير التطبيقات والحقول المخصصة"
        description="تفعيل وحدات النظام وإضافة الحقول المخصصة التي تظهر فوراً في النماذج والجداول دون كتابة كود برمجي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م."
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
    <div className="w-full max-w-none">
      <Suspense fallback={<PageSkeleton title="مدير التطبيقات والحقول المخصصة" />}>
        <BuilderContent />
      </Suspense>
    </div>
  );
}
