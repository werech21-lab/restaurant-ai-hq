import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Building2 } from "lucide-react";
import { SettingsForm } from "@/app/(panel)/settings/settings-form";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { getCompany } from "@/lib/company";
import { requireUser } from "@/lib/erp-auth";
import { UNAVAILABLE_DASH, formatPct, getUnavailableTooltip } from "@/lib/format";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "Company Settings | AetherBI ERP" };

const SETTINGS_LINKS = [
  { href: "/settings/aetherbi-connect", ar: "ربط الموقع", en: "Website Connect" },
  { href: "/bi-analytics", ar: "ذكاء الأعمال", en: "Business Intelligence" },
  { href: "/settings/apps", ar: "التطبيقات", en: "Apps" },
  { href: "/settings/notifications", ar: "الإشعارات", en: "Notifications" },
  { href: "/settings/aetherbi", ar: "النطاق", en: "Domain" },
  { href: "/settings/odoo-data-center", ar: "بيانات أودو", en: "Odoo Data" },
  { href: "/settings/payments", ar: "بوابات الدفع", en: "Payment Gateways" },
  { href: "/deploy", ar: "النشر السحابي", en: "Cloud Deploy" },
] as const;

async function SettingsContent() {
  await connection();
  const locale = await getLocale();
  const resolvedLocale = locale === "en" ? "en" : "ar";
  const isAr = resolvedLocale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale);
  const user = await requireUser();
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  let company: Awaited<ReturnType<typeof getCompany>> | null = null;
  let hasError = false;
  try {
    company = await getCompany();
  } catch {
    hasError = true;
  }

  if (hasError || !company) {
    return (
      <div dir={dir} className="space-y-4">
        <PageHeader
          title={tx(resolvedLocale, "إعدادات الشركة", "Company Settings")}
          description={tx(
            resolvedLocale,
            "عملة الطباعة الرسمية، نسبة الضريبة، الرقم الضريبي، وبيانات تظهر على الفواتير وعروض الأسعار وقسائم الرواتب.",
            "Official print currency, tax rate, tax ID, and details displayed on invoices, quotes, and payslips.",
          )}
        />
        <StateBlock
          state="error"
          locale={resolvedLocale}
          title={tx(resolvedLocale, "تعذّر تحميل إعدادات الشركة", "Unable to load company settings")}
        />
      </div>
    );
  }

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={tx(resolvedLocale, "إعدادات الشركة", "Company Settings")}
        description={tx(
          resolvedLocale,
          "عملة الطباعة الرسمية، نسبة الضريبة، الرقم الضريبي، وبيانات تظهر على الفواتير وعروض الأسعار وقسائم الرواتب.",
          "Official print currency, tax rate, tax ID, and details displayed on invoices, quotes, and payslips.",
        )}
        actions={
          <nav
            aria-label={tx(resolvedLocale, "روابط الإعدادات الفرعية", "Settings sub-navigation")}
            className="flex flex-wrap gap-2 text-xs font-semibold"
          >
            {SETTINGS_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3 py-1.5 text-emerald-700 transition hover:border-emerald-500/45 dark:text-emerald-300"
              >
                {isAr ? item.ar : item.en}
              </Link>
            ))}
          </nav>
        }
      />

      <SectionCard
        title={tx(resolvedLocale, "ملخص الهوية الضريبية والمالية", "Active Fiscal Profile")}
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        locale={resolvedLocale}
        headerDivider
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
              {tx(resolvedLocale, "عملة الطباعة", "Print Currency")}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ds-text-primary)]" dir="ltr">
              {company.currency || "KWD"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
              {tx(resolvedLocale, "نسبة الضريبة", "Tax Rate")}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ds-text-primary)]">
              {Number.isFinite(company.taxRate) ? (
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatPct(company.taxRate, resolvedLocale)}
                </span>
              ) : (
                <span
                  dir="ltr"
                  title={unavailableTooltip}
                  aria-label={unavailableTooltip}
                  data-unavailable="true"
                >
                  {UNAVAILABLE_DASH}
                </span>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3">
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
              {tx(resolvedLocale, "الرقم الضريبي", "Tax Registration ID")}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ds-text-primary)]">
              {company.taxNumber ? (
                <span dir="ltr" className="ds-num tabular-nums">
                  {company.taxNumber}
                </span>
              ) : (
                <span
                  dir="ltr"
                  title={unavailableTooltip}
                  aria-label={unavailableTooltip}
                  data-unavailable="true"
                >
                  {UNAVAILABLE_DASH}
                </span>
              )}
            </p>
          </div>
        </div>
      </SectionCard>

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
