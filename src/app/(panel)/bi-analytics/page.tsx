import { Suspense } from "react";
import { connection } from "next/server";
import { RadarButton } from "@/app/(panel)/bi-analytics/radar-button";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { KpiCard, SectionCard, StateBlock } from "@/components/ui";
import { formatInt, formatKwd, formatPct, formatQty } from "@/lib/format";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { executiveInsights } from "@/services/bi.service";

export const metadata = { title: "ذكاء الأعمال | AetherBI" };

async function InsightsContent() {
  await connection();
  const [user, locale] = await Promise.all([requireUser(), getLocale()]);
  const resolvedLocale: "ar" | "en" = locale === "en" ? "en" : "ar";
  const isAr = resolvedLocale !== "en";

  if (!can(user, "reports", "view") && !can(user, "dashboard", "view")) {
    return <Forbidden href={firstAllowedHref(user)} />;
  }

  let data: Awaited<ReturnType<typeof executiveInsights>> | null = null;
  let loadFailed = false;
  try {
    data = await executiveInsights();
  } catch {
    loadFailed = true;
  }

  if (loadFailed || !data) {
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="space-y-4">
        <PageHeader
          title={tx(locale, "ذكاء الأعمال والتحليلات التنبؤية", "Business Intelligence & Predictive Analytics")}
          description={tx(
            locale,
            "AetherBI Insights: نمو المبيعات، هامش الأقسام، وتدفق نقدي لثلاثين يوماً.",
            "AetherBI Insights: sales growth, category margins, and 30-day cash projection."
          )}
        />
        <StateBlock
          state="error"
          locale={resolvedLocale}
          title={tx(locale, "تعذّر تحميل تحليلات ذكاء الأعمال", "Unable to load BI analytics")}
          description={tx(
            locale,
            "حدث خلل مؤقت أثناء استعلام البيانات. يرجى تحديث الصفحة والمحاولة مجدداً.",
            "A temporary error occurred while loading insights. Please refresh and try again."
          )}
        />
      </div>
    );
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="space-y-5 min-w-0">
      <PageHeader
        title={tx(locale, "ذكاء الأعمال والتحليلات التنبؤية", "Business Intelligence & Predictive Analytics")}
        description={tx(
          locale,
          "AetherBI Insights: نمو المبيعات، هامش الأقسام، وتدفق نقدي لثلاثين يوماً.",
          "AetherBI Insights: sales growth, category margins, and 30-day cash projection."
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={tx(locale, "مبيعات الشهر", "Monthly Sales")}
          value={data.salesNow}
          format="kwd"
          locale={resolvedLocale}
        />
        <KpiCard
          label={tx(locale, "نمو المبيعات", "Sales Growth")}
          value={data.growth}
          format="pct"
          signed
          locale={resolvedLocale}
        />
        <KpiCard
          label={tx(locale, "هامش الربح", "Gross Margin")}
          value={data.marginNow}
          format="pct"
          locale={resolvedLocale}
        />
        <KpiCard
          label={tx(locale, "النقد الحالي", "Current Cash")}
          value={data.cash}
          format="kwd"
          locale={resolvedLocale}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title={tx(locale, "هامش الربح حسب القسم", "Profit Margin by Category")}
          locale={resolvedLocale}
          headerDivider
        >
          {data.margins.length === 0 ? (
            <StateBlock
              state="empty"
              locale={resolvedLocale}
              compact
              title={tx(locale, "لا توجد مبيعات هذا الشهر", "No sales recorded this month")}
              description={tx(
                locale,
                "ستظهر هوامش الأقسام تلقائياً فور تسجيل فواتير مبيعات للفترة الحالية.",
                "Category margins will appear once sales invoices are recorded for this month."
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
                    <th className="px-3 py-2.5 text-start">{tx(locale, "القسم", "Category")}</th>
                    <th className="px-3 py-2.5 text-end">{tx(locale, "المبيعات", "Sales")}</th>
                    <th className="px-3 py-2.5 text-end">{tx(locale, "الهامش", "Margin")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {data.margins.map((row) => (
                    <tr key={row.name}>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{row.name}</td>
                      <td dir="ltr" className="ds-num px-3 py-2.5 text-end font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatKwd(row.sales, resolvedLocale)}
                      </td>
                      <td dir="ltr" className="ds-num px-3 py-2.5 text-end font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatPct(row.margin, resolvedLocale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={tx(locale, "تدفق نقدي متوقع لـ 30 يوماً", "30-Day Cash Flow Projection")}
          subtitle={
            <>
              {tx(locale, "صافي آخر 30 يوماً: ", "Last 30 days net: ")}
              <span dir="ltr" className="ds-num font-bold tabular-nums">
                {formatKwd(data.net30, resolvedLocale)}
              </span>
              {tx(
                locale,
                " — يوزّع التقدير على أربعة أسابيع فوق الرصيد الحالي.",
                " — projected evenly across four weeks above current cash."
              )}
            </>
          }
          locale={resolvedLocale}
          headerDivider
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
                  <th className="px-3 py-2.5 text-start">{tx(locale, "الأسبوع", "Week")}</th>
                  <th className="px-3 py-2.5 text-end">{tx(locale, "الرصيد النقدي المتوقع", "Projected Cash")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                {data.weeks.map((week) => (
                  <tr key={week.week}>
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      {tx(locale, `الأسبوع ${formatInt(week.week, resolvedLocale)}`, `Week ${formatInt(week.week, resolvedLocale)}`)}
                    </td>
                    <td dir="ltr" className="ds-num px-3 py-2.5 text-end font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatKwd(week.cash, resolvedLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title={tx(locale, "رادار المخاطر", "Risk Radar")}
        locale={resolvedLocale}
        actions={
          user.role.isAdmin || can(user, "reports", "edit") || can(user, "automations", "edit") ? (
            <RadarButton />
          ) : null
        }
        headerDivider
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">
              {tx(locale, "أصناف راكدة", "Slow-Moving Items")}
            </h3>
            {data.dead.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {tx(locale, "لا توجد أصناف راكدة.", "No slow-moving items.")}
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                {data.dead.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <span dir="ltr" className="ds-num shrink-0 font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      {formatQty(item.currentStock)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">
              {tx(locale, "عملاء متأخرون", "Overdue Customers")}
            </h3>
            {data.late.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {tx(locale, "لا توجد مديونيات متأخرة.", "No overdue receivables.")}
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                {data.late.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <span dir="ltr" className="ds-num shrink-0 font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                      {formatKwd(item.balance, resolvedLocale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">
              {tx(locale, "قرب النفاد", "Low Stock Soon")}
            </h3>
            {data.soon.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {tx(locale, "لا توجد أصناف قاربت على النفاد.", "No items near stockout.")}
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                {data.soon.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Business Intelligence" />}>
      <InsightsContent />
    </Suspense>
  );
}
