import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { VentureAutomationHub } from "@/components/automation/VentureAutomationHub";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "مركز قيادة مسارات الأتمتة والرادارات الحية | شركة فنتشر فودز ذ.م.م.",
  description: "محركات الأتمتة الـ 6 الحية لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function AutomationsContent() {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "automations", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  return <VentureAutomationHub locale={locale === "en" ? "en" : "ar"} />;
}

export default function AutomationsPage() {
  return (
    <main className="w-full max-w-none px-4 py-6 sm:px-6" suppressHydrationWarning>
      <Suspense fallback={<PageSkeleton title="مركز قيادة مسارات الأتمتة والرادارات الحية" />}>
        <AutomationsContent />
      </Suspense>
    </main>
  );
}
