import { Suspense } from "react";
import { connection } from "next/server";
import { DomainPanel } from "@/app/(panel)/settings/aetherbi/domain-panel";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { ERP_ORIGIN } from "@/lib/site";

export const metadata = { title: "نطاق AetherBI | نظام ERP" };

async function DomainContent() {
  await connection();
  const [user, locale] = await Promise.all([requireUser(), getLocale()]);
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  return (
    <div dir={locale === "en" ? "ltr" : "rtl"}>
      <PageHeader
        title={tx(
          locale,
          "لوحة إعداد الدومين الفرعي (erp.aetherbi.com)",
          "Subdomain Configuration (erp.aetherbi.com)"
        )}
        description={tx(
          locale,
          `النظام يستقبل الزوار على ${ERP_ORIGIN} ويرتبط بموقع aetherbi.com لنموذج العملاء وزر الدخول.`,
          `The platform serves visitors at ${ERP_ORIGIN} and integrates with aetherbi.com for lead capture and login.`
        )}
      />
      <DomainPanel />
    </div>
  );
}

export default function AetherbiPage() {
  return (
    <Suspense fallback={<PageSkeleton title="AetherBI Domain" />}>
      <DomainContent />
    </Suspense>
  );
}
