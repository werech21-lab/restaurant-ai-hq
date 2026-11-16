import { Suspense } from "react";
import { connection } from "next/server";
import { ConnectPanel } from "@/app/(panel)/settings/aetherbi-connect/connect-panel";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { ERP_ORIGIN } from "@/lib/site";

export const metadata = { title: "ربط AetherBI | نظام ERP" };

async function ConnectContent() {
  await connection();
  const [user, locale] = await Promise.all([requireUser(), getLocale()]);
  if (!can(user, "saas", "view") && !can(user, "crm", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  let visits: number | null = null;
  let leads: number | null = null;
  try {
    const [visitCount, leadCount] = await Promise.all([
      prisma.siteVisit.count({ where: { source: { in: ["www.aetherbi.com", "aetherbi.com"] } } }),
      prisma.lead.count({ where: { source: { in: ["www.aetherbi.com", "aetherbi.com"] } } }),
    ]);
    visits = visitCount;
    leads = leadCount;
  } catch {
    visits = null;
    leads = null;
  }

  let domainMessage = tx(locale, "النطاق غير متصل بعد", "Domain not connected yet");
  try {
    const response = await fetch(`${ERP_ORIGIN}/api/health`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    domainMessage = response.ok
      ? tx(locale, "erp.aetherbi.com يستجيب لفحص الصحة", "erp.aetherbi.com is responding to health checks")
      : tx(locale, `استجابة غير مكتملة (${response.status})`, `Health check returned status ${response.status}`);
  } catch {
    domainMessage = tx(
      locale,
      "تعذر الوصول إلى erp.aetherbi.com من هذا السيرفر",
      "Unable to reach erp.aetherbi.com from this server"
    );
  }
  return (
    <div dir={locale === "en" ? "ltr" : "rtl"}>
      <PageHeader
        title={tx(locale, "إدارة الربط مع aetherbi.com", "aetherbi.com Integration")}
        description={tx(
          locale,
          "كود الأداة، حالة الدومين، وعدد الزيارات والطلبات القادمة من الموقع.",
          "Widget embed snippet, domain health status, and incoming website traffic and leads."
        )}
      />
      <ConnectPanel visits={visits} leads={leads} domainMessage={domainMessage} />
    </div>
  );
}

export default function AetherbiConnectPage() {
  return (
    <Suspense fallback={<PageSkeleton title="AetherBI Connect" />}>
      <ConnectContent />
    </Suspense>
  );
}
