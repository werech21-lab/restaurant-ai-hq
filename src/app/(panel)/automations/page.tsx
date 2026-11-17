import { Suspense } from "react";
import { connection } from "next/server";
import { VentureAutomationHub } from "@/components/automation/VentureAutomationHub";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { requireUser } from "@/lib/erp-auth";
import { getLocale } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إدارة التنبيهات والمتابعة التلقائية | شركة فنتشر فودز ذ.م.م.",
  description: "نظام التنبيهات والمتابعة التلقائية لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
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
    <div className="w-full min-w-0" suppressHydrationWarning>
      <Suspense fallback={<PageSkeleton title="Automations" />}>
        <AutomationsContent />
      </Suspense>
    </div>
  );
}
