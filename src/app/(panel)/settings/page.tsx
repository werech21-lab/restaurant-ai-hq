import { Suspense } from "react";
import { connection } from "next/server";
import { SettingsForm } from "@/app/(panel)/settings/settings-form";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { getCompany } from "@/lib/company";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "إعدادات الشركة | نظام ERP" };

async function SettingsContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const company = await getCompany();
  return (
    <div>
      <PageHeader
        title="إعدادات الشركة"
        description="عملة الطباعة الرسمية، نسبة الضريبة، الرقم الضريبي، وبيانات تظهر على الفواتير وعروض الأسعار وقسائم الرواتب."
        actions={
          <div className="flex gap-4 text-sm font-semibold">
            <a className="text-blue-700" href="/settings/aetherbi-connect">
              ربط الموقع
            </a>
            <a className="text-blue-700" href="/bi-analytics">
              ذكاء الأعمال
            </a>
            <a className="text-blue-700" href="/settings/apps">
              التطبيقات
            </a>
            <a className="text-blue-700" href="/settings/notifications">
              الإشعارات
            </a>
            <a className="text-blue-700" href="/settings/aetherbi">
              النطاق
            </a>
            <a className="text-blue-700" href="/settings/payments">
              بوابات الدفع
            </a>
            <a className="text-blue-700" href="/deploy">
              النشر السحابي
            </a>
          </div>
        }
      />
      <SettingsForm
        initial={{
          name: company.name,
          currency: company.currency,
          taxRate: company.taxRate,
          taxNumber: company.taxNumber,
          phone: company.phone,
          address: company.address,
          invoiceFooter: company.invoiceFooter,
        }}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="الإعدادات" />}>
      <SettingsContent />
    </Suspense>
  );
}
