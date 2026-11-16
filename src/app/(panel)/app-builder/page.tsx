import { Suspense } from "react";
import { connection } from "next/server";
import { AppBuilderPanel } from "@/app/(panel)/app-builder/app-builder-panel";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { requireUser } from "@/lib/erp-auth";
import { getLocale, tx } from "@/lib/i18n/server";
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
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "app-builder", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("app-builder"))) {
    return (
      <DisabledModule
        title={tx(locale, "مدير التطبيقات والحقول المخصصة", "App Builder & Custom Fields")}
      />
    );
  }

  let modules: Awaited<ReturnType<typeof listAppModules>> = [];
  let fields: Awaited<ReturnType<typeof listCustomFields>> = [];
  let hasError = false;

  try {
    [modules, fields] = await Promise.all([listAppModules(), listCustomFields()]);
  } catch {
    hasError = true;
  }

  const locked = new Set<string>(LOCKED_MODULES);
  return (
    <div dir={locale === "en" ? "ltr" : "rtl"} className="w-full max-w-none space-y-5">
      <PageHeader
        title={tx(locale, "مدير التطبيقات والحقول المخصصة", "App Builder & Custom Fields")}
        description={tx(
          locale,
          "تفعيل وحدات النظام وإضافة الحقول المخصصة التي تظهر فوراً في النماذج والجداول لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
          "Enable system modules and manage custom fields across Venture Foods ERP forms and tables.",
        )}
      />
      <AppBuilderPanel
        locale={locale}
        hasError={hasError}
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
      <Suspense fallback={<PageSkeleton title="App Builder" />}>
        <BuilderContent />
      </Suspense>
    </div>
  );
}
