import { Suspense } from "react";
import { connection } from "next/server";
import { DomainPanel } from "@/app/(panel)/settings/aetherbi/domain-panel";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";
import { ERP_ORIGIN } from "@/lib/site";

export const metadata = { title: "نطاق AetherBI | نظام ERP" };

async function DomainContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  return (
    <div>
      <PageHeader
        title="لوحة إعداد الدومين الفرعي (erp.aetherbi.com)"
        description={`النظام يستقبل الزوار على ${ERP_ORIGIN} ويرتبط بموقع aetherbi.com لنموذج العملاء وزر الدخول.`}
      />
      <DomainPanel />
    </div>
  );
}

export default function AetherbiPage() {
  return (
    <Suspense fallback={<PageSkeleton title="النطاق" />}>
      <DomainContent />
    </Suspense>
  );
}
