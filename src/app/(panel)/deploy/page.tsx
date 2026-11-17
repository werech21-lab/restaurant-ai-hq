import { Suspense } from "react";
import { connection } from "next/server";
import { DeployView } from "@/app/(panel)/deploy/deploy-view";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { requireUser } from "@/lib/erp-auth";
import { getLocale } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "النشر السحابي | نظام ERP" };

async function DeployContent() {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "saas", "view") && !can(user, "payments", "view")) {
    return <Forbidden href={firstAllowedHref(user)} />;
  }
  return <DeployView locale={locale === "en" ? "en" : "ar"} />;
}

export default function DeployPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Cloud Deploy" />}>
      <DeployContent />
    </Suspense>
  );
}
