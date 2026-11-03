import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { VentureAutomationHub } from "@/components/automation/VentureAutomationHub";

export const metadata = {
  title: "محرك الأتمتة والرادارات | Venture Foods W.L.L.",
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
    <Suspense fallback={<PageSkeleton title="Automations" />}>
      <AutomationsContent />
    </Suspense>
  );
}
