import Link from "next/link";
import { Award, Building2, Layers, ShieldCheck, Store, Users } from "lucide-react";
import { PageHeader } from "@/components/erp-ui";
import { KpiCard, SectionCard, StateBlock } from "@/components/ui";
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatPct,
  getUnavailableTooltip,
  type FormatLocale,
} from "@/lib/format";
import { isExcludedOdooEntity } from "@/lib/odoo/excluded-entities";
import { VENTURE_BRANCHES, VENTURE_BRANDS } from "@/lib/venture-hierarchy";

export type SaasBrandItem = {
  id: string;
  nameAr: string;
  nameEn: string;
  cuisineAr: string;
  cuisineEn: string;
};

export type SaasBranchItem = {
  id: string;
  brandId: string;
  nameAr: string;
  nameEn: string;
  areaAr: string;
  areaEn: string;
  linkedWarehouseName: string | null;
};

export interface SaasViewProps {
  locale: FormatLocale;
  companyName: string;
  companyCurrency: string;
  companyTaxRate: number | null;
  activeEmployeesCount: number | null;
  enabledModulesCount: number | null;
  brands?: readonly SaasBrandItem[];
  branches?: readonly SaasBranchItem[];
  loading?: boolean;
  hasError?: boolean;
}

export function SaasView({
  locale,
  companyName,
  companyCurrency,
  companyTaxRate,
  activeEmployeesCount,
  enabledModulesCount,
  brands = VENTURE_BRANDS,
  branches = VENTURE_BRANCHES.map((b) => ({ ...b, linkedWarehouseName: null })),
  loading = false,
  hasError = false,
}: SaasViewProps) {
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const unavailableTooltip = getUnavailableTooltip(locale);

  const safeBrands = brands.filter(
    (b) => !isExcludedOdooEntity(b.nameEn) && !isExcludedOdooEntity(b.nameAr) && !isExcludedOdooEntity(b.id),
  );
  const safeBranches = branches.filter(
    (br) =>
      !isExcludedOdooEntity(br.nameEn) &&
      !isExcludedOdooEntity(br.nameAr) &&
      !isExcludedOdooEntity(br.areaEn) &&
      !isExcludedOdooEntity(br.id),
  );

  if (loading) {
    return (
      <div dir={dir} className="space-y-4">
        <StateBlock state="loading" locale={locale} skeletonRows={5} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div dir={dir} className="space-y-4">
        <PageHeader
          title={label("الهيكل المؤسسي والترخيص", "Corporate Structure & Licensing")}
          description={label(
            "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. — 6 علامات تجارية • 7 فروع • 8 قنوات",
            "Venture Foods Restaurant Management Co. W.L.L. — 6 Brands • 7 Branches • 8 Channels",
          )}
        />
        <StateBlock
          state="error"
          locale={locale}
          title={label("تعذّر تحميل بيانات الهيكل المؤسسي", "Unable to load corporate profile")}
        />
      </div>
    );
  }

  const normalizedCurrency = companyCurrency || "KWD";
  const displayCurrency = isAr
    ? normalizedCurrency === "KWD"
      ? "دينار كويتي (د.ك)"
      : normalizedCurrency
    : normalizedCurrency;

  return (
    <div dir={dir} className="w-full max-w-none space-y-6 pb-8">
      <PageHeader
        title={label("الهيكل المؤسسي والترخيص", "Corporate Structure & Licensing")}
        description={label(
          "الهيكل المؤسسي الرسمي لشركة فنتشر فودز لإدارة المطاعم ذ.م.م. — 6 علامات تجارية • 7 فروع • 8 قنوات",
          "Official corporate structure for Venture Foods Restaurant Management Co. W.L.L. — 6 Brands • 7 Branches • 8 Channels",
        )}
        actions={
          <Link
            href="/settings"
            className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--ds-text-primary)] transition hover:border-emerald-500/45"
          >
            {label("إعدادات الشركة", "Company Settings")}
          </Link>
        }
      />

      {/* Executive Entity Summary Card */}
      <SectionCard
        locale={locale}
        title={companyName || label("شركة فنتشر فودز لإدارة المطاعم ذ.م.م.", "Venture Foods Restaurant Management Co. W.L.L.")}
        subtitle={
          <span dir="ltr" className="inline-block">
            Venture Foods Restaurant Management Co. W.L.L. · CR 412891 · Kuwait
          </span>
        }
        icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        actions={
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
            style={{
              backgroundColor: "var(--ds-positive-bg)",
              borderColor: "var(--ds-positive-border)",
              color: "var(--ds-positive)",
            }}
          >
            {label("رخصة مؤسسية دائمة", "Enterprise Lifetime License")}
          </span>
        }
        headerDivider
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3.5">
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
              {label("الكيان القانوني", "Legal Entity")}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ds-text-primary)]">
              {label("ذ.م.م. كويتية (W.L.L.)", "Kuwaiti W.L.L.")}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3.5">
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
              {label("العملة الرسمية", "Official Currency")}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ds-text-primary)]">
              {displayCurrency}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3.5">
            <p className="text-xs font-semibold text-[var(--ds-text-muted)]">
              {label("نسبة الضريبة المطبقة", "Configured Tax Rate")}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--ds-text-primary)]">
              {companyTaxRate !== null ? (
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatPct(companyTaxRate, locale)}
                </span>
              ) : (
                <span
                  dir="ltr"
                  title={unavailableTooltip}
                  aria-label={unavailableTooltip}
                  data-unavailable="true"
                  className="ds-num tabular-nums"
                >
                  {UNAVAILABLE_DASH}
                </span>
              )}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Honest KPI Cards (zero fabricated numbers) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={label("العلامات التجارية المعتمدة", "Approved Brands")}
          value={safeBrands.length}
          format="int"
          unit={label("علامات", "brands")}
          subtitle={label("مملوكة بالكامل للمجموعة", "Fully group-owned")}
          icon={<Building2 className="h-4 w-4" aria-hidden />}
          locale={locale}
        />
        <KpiCard
          label={label("الفروع التشغيلية المعتمدة", "Active Operating Branches")}
          value={safeBranches.length}
          format="int"
          unit={label("فروع", "branches")}
          subtitle={label("تغطية تشغيلية في الكويت", "Kuwait operating footprint")}
          icon={<Store className="h-4 w-4" aria-hidden />}
          locale={locale}
        />
        <KpiCard
          label={label("الموظفون النشطون (HR)", "Active Workforce (HR)")}
          value={activeEmployeesCount}
          format="int"
          unit={activeEmployeesCount !== null ? label("موظفاً", "staff") : undefined}
          subtitle={
            activeEmployeesCount !== null
              ? label("مسجلون في قاعدة الموارد البشرية", "Verified in HR database")
              : label("غير متاح حالياً", "Unavailable right now")
          }
          icon={<Users className="h-4 w-4" aria-hidden />}
          locale={locale}
        />
        <KpiCard
          label={label("وحدات النظام المفعّلة", "Enabled System Modules")}
          value={enabledModulesCount}
          format="int"
          unit={enabledModulesCount !== null ? label("وحدة", "modules") : undefined}
          subtitle={
            enabledModulesCount !== null
              ? label("من مدير التطبيقات", "Configured via App Builder")
              : label("غير متاح حالياً", "Unavailable right now")
          }
          icon={<Layers className="h-4 w-4" aria-hidden />}
          locale={locale}
        />
      </div>

      {/* Brands Directory */}
      <SectionCard
        title={label("العلامات التجارية لشركة فنتشر فودز (6 Brands)", "Venture Foods Brands (6 Brands)")}
        subtitle={label(
          "العلامات المعتمدة حصرياً ضمن تقارير المبيعات والتشغيل.",
          "Approved brands included in sales and operational reporting.",
        )}
        icon={<Layers className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(safeBrands.length, locale)}
          </span>
        }
        locale={locale}
        headerDivider
      >
        {safeBrands.length === 0 ? (
          <StateBlock state="empty" locale={locale} compact />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {safeBrands.map((b) => (
              <article
                key={b.id}
                className="flex flex-col justify-between rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[var(--ds-text-primary)]">
                      {isAr ? b.nameAr : b.nameEn}
                    </h3>
                    <span
                      dir="ltr"
                      className="rounded-lg border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--ds-text-secondary)]"
                    >
                      {b.id}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ds-text-muted)]" dir="ltr">
                    {isAr ? b.nameEn : b.nameAr}
                  </p>
                  <p className="mt-2.5 text-xs text-[var(--ds-text-secondary)]">
                    {isAr ? b.cuisineAr : b.cuisineEn}
                  </p>
                </div>
                <div className="mt-4 border-t border-[var(--ds-border-hairline)] pt-3">
                  <Link
                    href="/erp/cores"
                    className="ds-focus-ring inline-flex rounded text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    {label(`استعراض مبيعات ${b.nameAr}`, `View ${b.nameEn} Sales`)}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Operating Branches */}
      <SectionCard
        title={label("شبكة الفروع التشغيلية المعتمدة (7 Branches)", "Approved Operating Branches (7 Branches)")}
        subtitle={label(
          "المواقع التشغيلية المعتمدة المرتبطة بنقاط البيع والمستودعات.",
          "Verified restaurant locations linked to POS registers and warehouses.",
        )}
        icon={<Store className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(safeBranches.length, locale)}
          </span>
        }
        locale={locale}
        padded={false}
        headerDivider
      >
        {safeBranches.length === 0 ? (
          <div className="p-4">
            <StateBlock state="empty" locale={locale} compact />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("كود الفرع", "Branch Code")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("اسم الفرع", "Branch Name")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("المنطقة الجغرافية", "District / Mall")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("البراند الرئيسي", "Primary Brand")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("المستودع المرتبط", "Linked Warehouse")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {safeBranches.map((br) => (
                  <tr key={br.id} className="hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[var(--ds-text-secondary)]" dir="ltr">
                      {br.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[var(--ds-text-primary)]">
                        {isAr ? br.nameAr : br.nameEn}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--ds-text-muted)]" dir="ltr">
                        {isAr ? br.nameEn : br.nameAr}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--ds-text-secondary)]">
                      <span>{isAr ? br.areaAr : br.areaEn}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--ds-accent)]" dir="ltr">
                      {br.brandId}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ds-text-secondary)]">
                      {br.linkedWarehouseName ? (
                        br.linkedWarehouseName
                      ) : (
                        <span
                          dir="ltr"
                          title={unavailableTooltip}
                          aria-label={unavailableTooltip}
                          data-unavailable="true"
                          className="ds-num tabular-nums"
                        >
                          {UNAVAILABLE_DASH}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        locale={locale}
        title={label("بيان الملكية والترخيص الحصري", "Exclusive Ownership & License Statement")}
        icon={<Award className="h-4 w-4" aria-hidden />}
      >
        <p className="text-xs leading-relaxed text-[var(--ds-text-secondary)]">
          {label(
            "نظام AetherBI ERP مهيأ ومخصص حصرياً لعمليات شركة فنتشر فودز لإدارة المطاعم ذ.م.م. (سجل تجاري 412891). تتمتع الشركة بصلاحية الوصول المؤسسي الكامل والدائم (Enterprise Lifetime License) دون قيود على عدد المستخدمين أو الفروع المعتمدة.",
            "AetherBI ERP is provisioned exclusively for Venture Foods Restaurant Management Co. W.L.L. (CR 412891) under a full Enterprise Lifetime License with unrestricted seats across all approved brands and branches.",
          )}
        </p>
      </SectionCard>
    </div>
  );
}
