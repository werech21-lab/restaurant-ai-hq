import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { DataCard, Forbidden, PageHeader, PageSkeleton, PaginationBar, btnGhost, btnPrimary } from "@/components/erp-ui";
import { ExportCsvButton } from "@/components/ui/export-button";
import { StatCard } from "@/components/ui/stat-card";
import { formatQty, monthRange } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { paymentVoucherLabel } from "@/lib/i18n/auto-translate";
import { datetimeFor, getLocale, moneyFor, monthFor, tx } from "@/lib/i18n/server";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { costOfGoods, inventoryValuation, salesSummary } from "@/lib/reports";
import { getActiveScope } from "@/lib/scope";
import { listPayments } from "@/services/report.service";
import { forecastLabels } from "@/services/forecast.service";

export const metadata = { title: "Reports | AetherBI ERP" };

async function ReportsContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "reports", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const scope = await getActiveScope(query);
  const scopeLabel = locale === "en" ? scope.labelEn : scope.labelAr;
  const tab = ["stock", "customers", "suppliers", "payments"].includes(query.tab) ? query.tab : "pnl";
  const now = new Date();
  const { start, end } = monthRange(now);
  const skip = (query.page - 1) * PAGE_SIZE;
  const monthLabel = monthFor(locale, now);

  return (
    <div>
      <PageHeader
        title={tx(locale, "التقارير", "Reports")}
        description={tx(locale, `أرباح وتكلفة مخزون وأرصدة الديون · ${scopeLabel}`, `P&L, inventory valuation, and balances · ${scopeLabel}`)}
        actions={<ExportCsvButton kind="reports" filename="reports.csv" />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/reports?tab=pnl" className={tab === "pnl" ? btnPrimary : btnGhost}>
          {tx(locale, "الأرباح والخسائر", "Profit & loss")}
        </a>
        <a href="/reports?tab=stock" className={tab === "stock" ? btnPrimary : btnGhost}>
          {tx(locale, "تقييم المخزون", "Inventory valuation")}
        </a>
        <a href="/reports?tab=customers" className={tab === "customers" ? btnPrimary : btnGhost}>
          {tx(locale, "ديون العملاء", "Customer receivables")}
        </a>
        <a href="/reports?tab=suppliers" className={tab === "suppliers" ? btnPrimary : btnGhost}>
          {tx(locale, "ديون الموردين", "Supplier payables")}
        </a>
        <a href="/reports?tab=payments" className={tab === "payments" ? btnPrimary : btnGhost}>
          {tx(locale, "سندات القبض والصرف", "Receipts & payments")}
        </a>
      </div>
      {tab === "pnl" ? (
        <ProfitReport locale={locale} start={start} end={end} monthLabel={monthLabel} warehouseIds={scope.warehouseIds} />
      ) : null}
      {tab === "stock" ? (
        <StockReport locale={locale} q={query.q} page={query.page} skip={skip} warehouseIds={scope.warehouseIds} />
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
  const [monthSales, allSales, monthCogs, allCogs] = await Promise.all([
    salesSummary(start, end, warehouseIds),
    salesSummary(undefined, undefined, warehouseIds),
    costOfGoods(start, end, warehouseIds),
    costOfGoods(undefined, undefined, warehouseIds),
  ]);
  const blocks = [
    { label: tx(locale, `مبيعات ${monthLabel}`, `Sales · ${monthLabel}`), value: monthSales.total },
    { label: tx(locale, `تكلفة البضاعة ${monthLabel}`, `COGS · ${monthLabel}`), value: monthCogs },
    { label: tx(locale, `مجمل الربح ${monthLabel}`, `Gross profit · ${monthLabel}`), value: monthSales.total - monthCogs },
    { label: tx(locale, "إجمالي المبيعات", "Total sales"), value: allSales.total },
    { label: tx(locale, "إجمالي تكلفة البضاعة المباعة", "Total COGS"), value: allCogs },
    { label: tx(locale, "مجمل الربح التراكمي", "Cumulative gross profit"), value: allSales.total - allCogs },
  ];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {blocks.map((block) => (
          <StatCard key={block.label} label={block.label} value={moneyFor(locale, block.value)} />
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-600">
        {tx(
          locale,
          `مجمل الربح = المبيعات − تكلفة الكميات المباعة بسعر تكلفة الصنف الحالي. عدد فواتير ${monthLabel}: ${monthSales.count}.`,
          `Gross profit = sales minus COGS at current item cost. Invoices in ${monthLabel}: ${monthSales.count}.`,
        )}
      </p>
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
  if (warehouseIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: warehouseIds } },
      include: { product: { select: { id: true, code: true, name: true, costPrice: true, sellingPrice: true } } },
    });
    const merged = new Map<string, (typeof rows)[number]>();
    for (const row of stocks) {
      const prev = merged.get(row.productId);
      if (prev) prev.currentStock += row.quantity;
      else {
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
    const where = q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {};
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
    new Date(),
  );
  return (
    <div>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">{tx(locale, "قيمة المخزون بسعر التكلفة", "Inventory at cost")}</p>
          <p className="mt-2 text-2xl font-bold">{moneyFor(locale, valuation.costValue)}</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">{tx(locale, "قيمة المخزون بسعر البيع", "Inventory at sell price")}</p>
          <p className="mt-2 text-2xl font-bold">{moneyFor(locale, valuation.sellValue)}</p>
        </section>
      </div>
      <DataCard>
        <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value="stock" />
          <input
            name="q"
            defaultValue={q}
            placeholder={tx(locale, "بحث عن صنف", "Search items")}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button className={btnPrimary}>{tx(locale, "بحث", "Search")}</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الصنف", "Item")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الكمية", "Qty")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "التكلفة", "Cost")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "البيع", "Sell")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "قيمة التكلفة", "Cost value")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "قيمة البيع", "Sell value")}</th>
                <th
                  className="px-4 py-3 text-right font-semibold"
                  title={tx(
                    locale,
                    "الرصيد الحالي مقسوماً على متوسط الصادر اليومي منذ أول حركة صادر",
                    "Current stock divided by average daily outbound since first OUT movement",
                  )}
                >
                  {tx(locale, "التوقع الذكي للنفاد", "Smart depletion forecast")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-slate-500" dir="ltr">
                      {row.code}
                    </p>
                  </td>
                  <td className="px-4 py-3">{formatQty(row.currentStock)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, row.costPrice)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, row.sellingPrice)}</td>
                  <td className="px-4 py-3 font-semibold">{moneyFor(locale, row.currentStock * row.costPrice)}</td>
                  <td className="px-4 py-3 font-semibold">{moneyFor(locale, row.currentStock * row.sellingPrice)}</td>
                  <td className="px-4 py-3 text-xs font-semibold">{forecasts.get(row.id) ?? "—"}</td>
                </tr>
              ))}
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
  const where = {
    balance: { gt: 0 },
    ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}),
  };
  const isCustomer = kind === "customers";
  const [totalSum, total, rows] = isCustomer
    ? await Promise.all([
        prisma.customer.aggregate({ where, _sum: { balance: true } }),
        prisma.customer.count({ where }),
        prisma.customer.findMany({ where, orderBy: { balance: "desc" }, skip, take: PAGE_SIZE }),
      ])
    : await Promise.all([
        prisma.supplier.aggregate({ where, _sum: { balance: true } }),
        prisma.supplier.count({ where }),
        prisma.supplier.findMany({ where, orderBy: { balance: "desc" }, skip, take: PAGE_SIZE }),
      ]);

  return (
    <div>
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          {isCustomer
            ? tx(locale, "إجمالي مديونية العملاء", "Total customer receivables")
            : tx(locale, "إجمالي المستحق للموردين", "Total supplier payables")}
        </p>
        <p className="mt-2 text-2xl font-bold">{moneyFor(locale, totalSum._sum.balance ?? 0)}</p>
      </section>
      <DataCard>
        <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value={kind} />
          <input
            name="q"
            defaultValue={q}
            placeholder={tx(locale, "بحث بالاسم أو الهاتف", "Search by name or phone")}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button className={btnPrimary}>{tx(locale, "بحث", "Search")}</button>
          <a href={pageHref("/reports", { tab: kind })} className={btnGhost}>
            {tx(locale, "مسح", "Clear")}
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الاسم", "Name")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الهاتف", "Phone")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "البريد", "Email")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الرصيد", "Balance")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    {tx(locale, "لا توجد أرصدة مستحقة.", "No outstanding balances.")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {row.phone || "—"}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {row.email || "—"}
                    </td>
                    <td className="px-4 py-3 font-bold">{moneyFor(locale, row.balance)}</td>
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
  const data = await listPayments({ q, skip, take: PAGE_SIZE });
  return (
    <div>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <StatCard label={tx(locale, "إجمالي سندات القبض", "Total receipts")} value={moneyFor(locale, data.receipts)} />
        <StatCard label={tx(locale, "إجمالي سندات الصرف", "Total payments")} value={moneyFor(locale, data.payments)} />
      </div>
      <DataCard>
        <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value="payments" />
          <input
            name="q"
            defaultValue={q}
            placeholder={tx(locale, "بحث بالمرجع أو البيان", "Search by reference or description")}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button className={btnPrimary}>{tx(locale, "بحث", "Search")}</button>
          <a href={pageHref("/reports", { tab: "payments" })} className={btnGhost}>
            {tx(locale, "مسح", "Clear")}
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "التاريخ", "Date")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "النوع", "Type")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الطرف", "Party")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "المبلغ", "Amount")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "المرجع", "Reference")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "المستخدم", "User")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {tx(locale, "لا توجد سندات مطابقة.", "No matching vouchers.")}
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3">{datetimeFor(locale, row.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{paymentVoucherLabel(locale, row.type)}</td>
                    <td className="px-4 py-3">{row.partyName}</td>
                    <td className="px-4 py-3 font-bold">{moneyFor(locale, row.amount)}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {row.reference || "—"}
                    </td>
                    <td className="px-4 py-3">{row.createdBy.name}</td>
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

export default function ReportsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Reports" />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
