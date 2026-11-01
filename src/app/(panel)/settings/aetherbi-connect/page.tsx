import { Suspense } from "react";
import { connection } from "next/server";
import { ConnectPanel } from "@/app/(panel)/settings/aetherbi-connect/connect-panel";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { can, firstAllowedHref } from "@/lib/permissions";
import { ERP_ORIGIN } from "@/lib/site";

export const metadata = { title: "ربط AetherBI | نظام ERP" };

async function ConnectContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "saas", "view") && !can(user, "crm", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const [visits, leads] = await Promise.all([
    prisma.siteVisit.count({ where: { source: "www.aetherbi.com" } }),
    prisma.lead.count({ where: { source: "www.aetherbi.com" } }),
  ]);
  let domainMessage = "النطاق غير متصل بعد";
  try {
    const response = await fetch(`${ERP_ORIGIN}/api/health`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    domainMessage = response.ok ? "erp.aetherbi.com يستجيب لفحص الصحة" : `الاستجابة ${response.status}`;
  } catch {
    domainMessage = "تعذر الوصول إلى erp.aetherbi.com من هذا السيرفر";
  }
  return (
    <div>
      <PageHeader title="إدارة الربط مع www.aetherbi.com" description="كود الأداة، حالة الدومين، وعدد الزيارات والطلبات القادمة من الموقع." />
      <ConnectPanel visits={visits} leads={leads} domainMessage={domainMessage} />
    </div>
  );
}

export default function AetherbiConnectPage() {
  return (
    <Suspense fallback={<PageSkeleton title="الربط" />}>
      <ConnectContent />
    </Suspense>
  );
}
