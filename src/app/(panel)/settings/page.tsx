import { Suspense } from "react";
import { connection } from "next/server";
import { SettingsForm } from "@/app/(panel)/settings/settings-form";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { getCompany } from "@/lib/company";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "Company Settings | AetherBI ERP" };

async function SettingsContent() {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const company = await getCompany();
  return (
    <div>
      <PageHeader
        title={tx(locale, "إعدادات الشركة", "Company settings")}
        description={tx(
          locale,
          "عملة الطباعة الرسمية، نسبة الضريبة، الرقم الضريبي، وبيانات تظهر على الفواتير وعروض الأسعار وقسائم الرواتب.",
          "Print currency, tax rate, tax ID, and fields shown on invoices, quotes, and payslips.",
        )}
        actions={
          <div className="flex gap-4 text-sm font-semibold">
            <a className="text-blue-700" href="/settings/aetherbi-connect">
              {tx(locale, "ربط الموقع", "Website connect")}
            </a>
            <a className="text-blue-700" href="/bi-analytics">
              {tx(locale, "ذكاء الأعمال", "Business intelligence")}
            </a>
            <a className="text-blue-700" href="/settings/apps">
              {tx(locale, "التطبيقات", "Apps")}
            </a>
            <a className="text-blue-700" href="/settings/notifications">
              {tx(locale, "الإشعارات", "Notifications")}
            </a>
            <a className="text-blue-700" href="/settings/aetherbi">
              {tx(locale, "النطاق", "Domain")}
            </a>
            <a className="text-blue-700" href="/settings/odoo-data-center">
              {tx(locale, "بيانات Odoo", "Odoo data")}
            </a>
            <a className="text-blue-700" href="/settings/payments">
              {tx(locale, "بوابات الدفع", "Payment gateways")}
            </a>
            <a className="text-blue-700" href="/deploy">
              {tx(locale, "النشر السحابي", "Cloud deploy")}
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
    <Suspense fallback={<PageSkeleton title="Settings" />}>
      <SettingsContent />
    </Suspense>
  );
}
