import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { AppsView } from "@/app/(panel)/settings/apps/apps-view";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { requireUser } from "@/lib/erp-auth";
import { getLocale } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { qrDataUrl } from "@/lib/qr";

export const metadata = { title: "تطبيقات AetherBI | نظام ERP" };

async function AppsContent() {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") || "http";
  const installUrl = `${proto}://${host}/dashboard`;

  let qr: string | null = null;
  try {
    qr = await qrDataUrl(installUrl);
  } catch {
    qr = null;
  }

  return (
    <AppsView
      locale={locale === "en" ? "en" : "ar"}
      qrDataUrlValue={qr}
      installUrl={installUrl}
    />
  );
}

export default function AppsSettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Apps" />}>
      <AppsContent />
    </Suspense>
  );
}
