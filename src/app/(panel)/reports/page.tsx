import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { DataCard, Forbidden, PageSkeleton, PaginationBar, btnGhost, btnPrimary } from "@/components/erp-ui";
import { KpiCard, StateBlock } from "@/components/ui";
import { formatKwd, formatKuwaitDateTime, formatQty, monthRange } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { paymentVoucherLabel } from "@/lib/i18n/auto-translate";
import { getLocale, monthFor, tx } from "@/lib/i18n/server";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isHiddenPanelProduct, visibleCustomerWhere, visibleProductWhere, visibleSupplierWhere, withVisibleProducts } from "@/lib/panel-visibility";
import { costOfGoods, inventoryValuation, salesSummary, scopeWarehouseIds } from "@/lib/reports";
import { getActiveScope } from "@/lib/scope";
import { listPayments } from "@/services/report.service";
import { forecastLabels } from "@/services/forecast.service";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";
import { DepartmentalReportsHub } from "@/components/reports/DepartmentalReportsHub";

export const metadata = {
  title: "مركز التقارير المؤسسية الشامل | Venture Foods W.L.L.",
  description: "تقارير المبيعات والأرباح والذمم المرتبطة بـ Odoo لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function LiveDbReportsSection({
  locale,
  query,
  warehouseIds,
}: {
  locale: Locale;
  query: Awaited<ReturnType<typeof readQuery>>;
  warehouseIds: string[];
}) {
  const tab = ["stock", "customers", "suppliers", "payments"].includes(query.tab) ? query.tab : "pnl";
  const now = new Date();
  const { start, end } = monthRange(now);
  const skip = (query.page - 1) * PAGE_SIZE;
  const monthLabel = monthFor(locale, now);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700/60">
        <div className="flex flex-wrap gap-2">
          <Link href="/reports?tab=pnl" aria-current={tab === "pnl" ? "page" : undefined} className={`${tab === "pnl" ? btnPrimary : btnGhost} ds-focus-ring`}>
            {tx(locale, "الأرباح والخسائر", "Profit & loss")}
          </Link>
          <Link href="/reports?tab=stock" aria-current={tab === "stock" ? "page" : undefined} className={`${tab === "stock" ? btnPrimary : btnGhost} ds-focus-ring`}>
            {tx(locale, "تقييم المخزون", "Inventory valuation")}
          </Link>
          <Link href="/reports?tab=customers" aria-current={tab === "customers" ? "page" : undefined} className={`${tab === "customers" ? btnPrimary : btnGhost} ds-focus-ring`}>
            {tx(locale, "ديون العملاء", "Customer receivables")}
          </Link>
          <Link href="/reports?tab=suppliers" aria-current={tab === "suppliers" ? "page" : undefined} className={`${tab === "suppliers" ? btnPrimary : btnGhost} ds-focus-ring`}>
            {tx(locale, "ديون الموردين", "Supplier payables")}
          </Link>
          <Link href="/reports?tab=payments" aria-current={tab === "payments" ? "page" : undefined} className={`${tab === "payments" ? btnPrimary : btnGhost} ds-focus-ring`}>
            {tx(locale, "سندات القبض والصرف", "Receipts & payments")}
          </Link>
        </div>
        <SmartIngestLaunchButton module="accounting" locale={locale} />
      </div>

      {tab === "pnl" ? (
        <ProfitReport locale={locale} start={start} end={end} monthLabel={monthLabel} warehouseIds={warehouseIds} />
      ) : null}
      {tab === "stock" ? (
        <StockReport locale={locale} q={query.q} page={query.page} skip={skip} warehouseIds={warehouseIds} />
      ) : null}
      {tab === "customers" ? <DebtReport locale={locale} kind="customers" q={query.q} page={query.page} skip={skip} /> : null}
      {tab === "suppliers" ? <DebtReport locale={locale} kind="suppliers" q={query.q} page={query.page} skip={skip} /> : null}
      {tab === "payments" ? <PaymentsReport locale={locale} q={query.q} page={query.page} skip={skip} /> : null}
    </div>
  );
}

async function ProfitReport({
  locale,
  start,
  end,
  monthLabel,
  warehouseIds,
}: {
  locale: Locale;
  start: Date;
  end: Date;
  monthLabel: string;
  warehouseIds: string[];
}) {
  const resolvedLocale: "ar" | "en" = locale === "en" ? "en" : "ar";
  const [monthSales, allSales, monthCogs, allCogs] = await Promise.all([
    salesSummary(start, end, warehouseIds),
    salesSummary(undefined, undefined, warehouseIds),
    costOfGoods(start, end, warehouseIds),
    costOfGoods(undefined, undefined, warehouseIds),
  ]);

  if (monthSales.total === 0 && allSales.total === 0) {
    return (
      <StateBlock
        state="empty"
        locale={resolvedLocale}
        compact
        title={tx(locale, "لا توجد بيانات محلية لهذه الفترة", "No local database entries for this period")}
        description={tx(
          locale,
          "لا توجد بيانات مسجلة في الجداول المحلية لهذه الفترة — راجع تقارير Odoo 17 أعلاه.",
          "No local database entries recorded for this period — refer to the Odoo 17 reports above."
        )}
      />
    );
  }

  const blocks = [
    { label: tx(locale, `مبيعات ${monthLabel}`, `Sales · ${monthLabel}`), value: monthSales.total },
    { label: tx(locale, `تكلفة البضاعة ${monthLabel}`, `COGS · ${monthLabel}`), value: monthCogs },
    { label: tx(locale, `مجمل الربح ${monthLabel}`, `Gross profit · ${monthLabel}`), value: monthSales.total - monthCogs },
    { label: tx(locale, "إجمالي المبيعات التراكمية", "Total cumulative sales"), value: allSales.total },
    { label: tx(locale, "إجمالي تكلفة البضاعة المباعة", "Total COGS"), value: allCogs },
    { label: tx(locale, "مجمل الربح التراكمي", "Cumulative gross profit"), value: allSales.total - allCogs },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {blocks.map((block) => (
        <KpiCard key={block.label} label={block.label} value={block.value} format="kwd" locale={resolvedLocale} />
      ))}
    </div>
  );
}

async function StockReport({
  locale,
  q,
  page,
  skip,
  warehouseIds,
}: {
  locale: Locale;
  q: string;
  page: number;
  skip: number;
  warehouseIds: string[];
}) {
  const resolvedLocale: "ar" | "en" = locale === "en" ? "en" : "ar";
  const valuationIds = await scopeWarehouseIds(warehouseIds);
  const valuation = await inventoryValuation(warehouseIds);
  let rows: Array<{
    id: string;
    code: string;
    name: string;
    currentStock: number;
    costPrice: number;
    sellingPrice: number;
  }> = [];
  let total = 0;

  if (warehouseIds.length && !valuationIds.length) {
    rows = [];
    total = 0;
  } else if (valuationIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: {
        warehouseId: { in: valuationIds },
        product: visibleProductWhere(),
      },
      include: { product: { select: { id: true, code: true, name: true, costPrice: true, sellingPrice: true } } },
    });
    const merged = new Map<string, (typeof rows)[number]>();
    for (const row of stocks) {
      const prev = merged.get(row.productId);
      if (prev) prev.currentStock += row.quantity;
      else if (!isHiddenPanelProduct(row.product.code, row.product.name)) {
        merged.set(row.productId, {
          id: row.product.id,
          code: row.product.code,
          name: row.product.name,
          currentStock: row.quantity,
          costPrice: row.product.costPrice,
          sellingPrice: row.product.sellingPrice,
        });
      }
    }
    rows = Array.from(merged.values());
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) => row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle));
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, locale === "en" ? "en" : "ar"));
    total = rows.length;
    rows = rows.slice(skip, skip + PAGE_SIZE);
  } else {
    const where = withVisibleProducts(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {});
    const [count, productRows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: PAGE_SIZE,
        select: { id: true, code: true, name: true, currentStock: true, costPrice: true, sellingPrice: true },
      }),
    ]);
    total = count;
    rows = productRows;
  }

  const forecasts = await forecastLabels(
    rows.map((row) => ({ id: row.id, currentStock: row.currentStock })),
    new Date()
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard
          label={tx(locale, "قيمة المخزون بسعر التكلفة", "Inventory at cost")}
          value={valuation.costValue}
          format="kwd"
          locale={resolvedLocale}
        />
        <KpiCard
          label={tx(locale, "قيمة المخزون بسعر البيع", "Inventory at sell price")}
          value={valuation.sellValue}
          format="kwd"
          locale={resolvedLocale}
        />
      </div>
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
          <input type="hidden" name="tab" value="stock" />
          <input
            name="q"
            defaultValue={q}
            aria-label={tx(locale, "بحث عن صنف", "Search items")}
            placeholder={tx(locale, "بحث عن صنف", "Search items")}
            className="ds-focus-ring w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <button type="submit" className={`${btnPrimary} ds-focus-ring`}>{tx(locale, "بحث", "Search")}</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <th className="px-4 py-3 text-start">{tx(locale, "الصنف", "Item")}</th>
                <th className="px-4 py-3 text-end">{tx(locale, "الكمية", "Qty")}</th>
                <th className="px-4 py-3 text-end">{tx(locale, "التكلفة", "Cost")}</th>
                <th className="px-4 py-3 text-end">{tx(locale, "البيع", "Sell")}</th>
                <th className="px-4 py-3 text-end">{tx(locale, "قيمة التكلفة", "Cost value")}</th>
                <th className="px-4 py-3 text-end">{tx(locale, "قيمة البيع", "Sell value")}</th>
                <th className="px-4 py-3 text-start">{tx(locale, "التوقع الذكي", "Forecast")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-600 dark:text-slate-300">
                    {tx(locale, "لا توجد بيانات مخزون محلية مسجلة.", "No local inventory records found.")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200/70 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400" dir="ltr">
                        {row.code}
                      </p>
                    </td>
                    <td dir="ltr" className="ds-num px-4 py-3 text-end tabular-nums">{formatQty(row.currentStock)}</td>
                    <td dir="ltr" className="ds-num px-4 py-3 text-end tabular-nums">{formatKwd(row.costPrice, resolvedLocale)}</td>
                    <td dir="ltr" className="ds-num px-4 py-3 text-end tabular-nums">{formatKwd(row.sellingPrice, resolvedLocale)}</td>
                    <td dir="ltr" className="ds-num px-4 py-3 text-end font-semibold tabular-nums text-amber-700 dark:text-amber-300">{formatKwd(row.currentStock * row.costPrice, resolvedLocale)}</td>
                    <td dir="ltr" className="ds-num px-4 py-3 text-end font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatKwd(row.currentStock * row.sellingPrice, resolvedLocale)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-blue-700 dark:text-blue-400">{forecasts.get(row.id) ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar path="/reports" params={{ tab: "stock", q }} page={page} total={total} />
      </DataCard>
    </div>
  );
}

async function DebtReport({
  locale,
  kind,
  q,
  page,
  skip,
}: {
  locale: Locale;
  kind: "customers" | "suppliers";
  q: string;
  page: number;
  skip: number;
}) {
  const resolvedLocale: "ar" | "en" = locale === "en" ? "en" : "ar";
  const isCustomer = kind === "customers";
  const partyWhere = {
    balance: { gt: 0 },
    ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}),
  };
  const [totalSum, total, rows] = isCustomer
    ? await Promise.all([
        prisma.customer.aggregate({ where: visibleCustomerWhere(partyWhere), _sum: { balance: true } }),
        prisma.customer.count({ where: visibleCustomerWhere(partyWhere) }),
        prisma.customer.findMany({
          where: visibleCustomerWhere(partyWhere),
          orderBy: { balance: "desc" },
          skip,
          take: PAGE_SIZE,
        }),
      ])
    : await Promise.all([
        prisma.supplier.aggregate({ where: visibleSupplierWhere(partyWhere), _sum: { balance: true } }),
        prisma.supplier.count({ where: visibleSupplierWhere(partyWhere) }),
        prisma.supplier.findMany({
          where: visibleSupplierWhere(partyWhere),
          orderBy: { balance: "desc" },
          skip,
          take: PAGE_SIZE,
        }),
      ]);

  const actualTotal = totalSum._sum?.balance ?? 0;

  return (
    <div className="space-y-4">
      <KpiCard
        label={
          isCustomer
            ? tx(locale, "إجمالي مديونية العملاء المسجلة محلياً", "Total local customer receivables")
            : tx(locale, "إجمالي المستحق للموردين المسجل محلياً", "Total local supplier payables")
        }
        value={actualTotal}
        format="kwd"
        locale={resolvedLocale}
      />
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
          <input type="hidden" name="tab" value={kind} />
          <input
            name="q"
            defaultValue={q}
            aria-label={tx(locale, "بحث بالاسم أو الهاتف", "Search by name or phone")}
            placeholder={tx(locale, "بحث بالاسم أو الهاتف", "Search by name or phone")}
            className="ds-focus-ring w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <button type="submit" className={`${btnPrimary} ds-focus-ring`}>{tx(locale, "بحث", "Search")}</button>
          <Link href={pageHref("/reports", { tab: kind })} className={`${btnGhost} ds-focus-ring`}>
            {tx(locale, "مسح", "Clear")}
          </Link>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <th className="px-4 py-3 text-start">{tx(locale, "الاسم", "Name")}</th>
                <th className="px-4 py-3 text-start">{tx(locale, "الهاتف", "Phone")}</th>
                <th className="px-4 py-3 text-start">{tx(locale, "البريد", "Email")}</th>
                <th className="px-4 py-3 text-end">{tx(locale, "الرصيد", "Balance")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-600 dark:text-slate-300">
                    {tx(locale, "لا توجد أرصدة محلية مسجلة — راجع تقرير الذمم المدينة من Odoo 17 أعلاه.", "No local balances recorded — refer to the Odoo 17 receivables report above.")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200/70 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400" dir="ltr">
                      {row.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400" dir="ltr">
                      {row.email || "—"}
                    </td>
                    <td dir="ltr" className="ds-num px-4 py-3 text-end font-bold tabular-nums text-amber-700 dark:text-amber-300">{formatKwd(row.balance, resolvedLocale)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar path="/reports" params={{ tab: kind, q }} page={page} total={total} />
      </DataCard>
    </div>
  );
}

async function PaymentsReport({ locale, q, page, skip }: { locale: Locale; q: string; page: number; skip: number }) {
  const resolvedLocale: "ar" | "en" = locale === "en" ? "en" : "ar";
  const data = await listPayments({ q, skip, take: PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard label={tx(locale, "إجمالي سندات القبض المسجلة محلياً", "Total Local Receipts")} value={data.receipts} format="kwd" locale={resolvedLocale} />
        <KpiCard label={tx(locale, "إجمالي سندات الصرف المسجلة محلياً", "Total Local Payments")} value={data.payments} format="kwd" locale={resolvedLocale} />
      </div>
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-slate-200 p-4 dark:border-slate-800">
          <input type="hidden" name="tab" value="payments" />
          <input
            name="q"
            defaultValue={q}
            aria-label={tx(locale, "بحث بالمرجع أو البيان", "Search by reference or description")}
            placeholder={tx(locale, "بحث بالمرجع أو البيان", "Search by reference or description")}
            className="ds-focus-ring w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <button type="submit" className={`${btnPrimary} ds-focus-ring`}>{tx(locale, "بحث", "Search")}</button>
          <Link href={pageHref("/reports", { tab: "payments" })} className={`${btnGhost} ds-focus-ring`}>
            {tx(locale, "مسح", "Clear")}
          </Link>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <th className="px-4 py-3 text-start">{tx(locale, "التاريخ", "Date")}</th>
                <th className="px-4 py-3 text-start">{tx(locale, "النوع", "Type")}</th>
                <th className="px-4 py-3 text-start">{tx(locale, "الطرف", "Party")}</th>
                <th className="px-4 py-3 text-end">{tx(locale, "المبلغ", "Amount")}</th>
                <th className="px-4 py-3 text-start">{tx(locale, "المرجع", "Reference")}</th>
                <th className="px-4 py-3 text-start">{tx(locale, "المستخدم", "User")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-600 dark:text-slate-300">
                    {tx(locale, "لا توجد سندات محلية مسجلة لهذه الفترة.", "No local payment vouchers recorded for this period.")}
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200/70 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-900/40">
                    <td dir="ltr" className="ds-num px-4 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{formatKuwaitDateTime(row.createdAt, resolvedLocale)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{paymentVoucherLabel(locale, row.type)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.partyName}</td>
                    <td dir="ltr" className="ds-num px-4 py-3 text-end font-bold tabular-nums text-amber-700 dark:text-amber-300">{formatKwd(row.amount, resolvedLocale)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400" dir="ltr">
                      {row.reference || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.createdBy.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar path="/reports" params={{ tab: "payments", q }} page={page} total={data.total} />
      </DataCard>
    </div>
  );
}

type ReportsSearchParams = RawQuery & {
  reportId?: string | string[];
  report?: string | string[];
};

async function ReportsContent({ searchParams }: { searchParams: Promise<ReportsSearchParams> }) {
  await connection();
  const locale = await getLocale();
  const rawParams = await searchParams;
  const query = await readQuery(rawParams);
  const user = await requireUser();
  if (!can(user, "reports", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const scope = await getActiveScope(query);
  const rawReportId = rawParams.reportId ?? rawParams.report;
  const initialReportId = typeof rawReportId === "string" ? rawReportId : undefined;

  const liveDbChildren = (
    <LiveDbReportsSection locale={locale} query={query} warehouseIds={scope.warehouseIds} />
  );

  return (
    <DepartmentalReportsHub
      initialReportId={initialReportId}
      locale={locale === "en" ? "en" : "ar"}
      liveDbChildren={liveDbChildren}
    />
  );
}

export default function ReportsPage({ searchParams }: { searchParams: Promise<ReportsSearchParams> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Reports" />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
