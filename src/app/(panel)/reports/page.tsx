import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { DataCard, Forbidden, PageHeader, PageSkeleton, PaginationBar, btnGhost, btnPrimary } from "@/components/erp-ui";
import { ExportCsvButton } from "@/components/ui/export-button";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate, formatMoney, formatMonth, formatQty, monthRange } from "@/lib/format";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { costOfGoods, inventoryValuation, salesSummary } from "@/lib/reports";
import { getActiveScope } from "@/lib/scope";
import { listPayments } from "@/services/report.service";
import { forecastLabels } from "@/services/forecast.service";

export const metadata = { title: "التقارير | نظام ERP" };

async function ReportsContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "reports", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const scope = await getActiveScope(query);
  const tab = ["stock", "customers", "suppliers", "payments"].includes(query.tab) ? query.tab : "pnl";
  const now = new Date();
  const { start, end } = monthRange(now);
  const skip = (query.page - 1) * PAGE_SIZE;

  return (
    <div>
      <PageHeader
        title="التقارير"
        description={`أرباح وتكلفة مخزون وأرصدة الديون · ${scope.labelAr}`}
        actions={<ExportCsvButton kind="reports" filename="reports.csv" />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/reports?tab=pnl" className={tab === "pnl" ? btnPrimary : btnGhost}>
          الأرباح والخسائر
        </a>
        <a href="/reports?tab=stock" className={tab === "stock" ? btnPrimary : btnGhost}>
          تقييم المخزون
        </a>
        <a href="/reports?tab=customers" className={tab === "customers" ? btnPrimary : btnGhost}>
          ديون العملاء
        </a>
        <a href="/reports?tab=suppliers" className={tab === "suppliers" ? btnPrimary : btnGhost}>
          ديون الموردين
        </a>
        <a href="/reports?tab=payments" className={tab === "payments" ? btnPrimary : btnGhost}>
          سندات القبض والصرف
        </a>
      </div>
      {tab === "pnl" ? (
        <ProfitReport start={start} end={end} monthLabel={formatMonth(now)} warehouseIds={scope.warehouseIds} />
      ) : null}
      {tab === "stock" ? (
        <StockReport q={query.q} page={query.page} skip={skip} warehouseIds={scope.warehouseIds} />
      ) : null}
      {tab === "customers" ? <DebtReport kind="customers" q={query.q} page={query.page} skip={skip} /> : null}
      {tab === "suppliers" ? <DebtReport kind="suppliers" q={query.q} page={query.page} skip={skip} /> : null}
      {tab === "payments" ? <PaymentsReport q={query.q} page={query.page} skip={skip} /> : null}
    </div>
  );
}

async function ProfitReport({
  start,
  end,
  monthLabel,
  warehouseIds,
}: {
  start: Date
  end: Date
  monthLabel: string
  warehouseIds: string[]
}) {
  const [monthSales, allSales, monthCogs, allCogs] = await Promise.all([
    salesSummary(start, end, warehouseIds),
    salesSummary(undefined, undefined, warehouseIds),
    costOfGoods(start, end, warehouseIds),
    costOfGoods(undefined, undefined, warehouseIds),
  ]);
  const blocks = [
    { label: `مبيعات ${monthLabel}`, value: monthSales.total },
    { label: `تكلفة البضاعة ${monthLabel}`, value: monthCogs },
    { label: `مجمل الربح ${monthLabel}`, value: monthSales.total - monthCogs },
    { label: "إجمالي المبيعات", value: allSales.total },
    { label: "إجمالي تكلفة البضاعة المباعة", value: allCogs },
    { label: "مجمل الربح التراكمي", value: allSales.total - allCogs },
  ];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {blocks.map((block) => (
          <StatCard key={block.label} label={block.label} value={formatMoney(block.value)} />
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-600">
        مجمل الربح = المبيعات − تكلفة الكميات المباعة بسعر تكلفة الصنف الحالي. عدد فواتير {monthLabel}: {monthSales.count}.
      </p>
    </div>
  );
}

async function StockReport({
  q,
  page,
  skip,
  warehouseIds,
}: {
  q: string
  page: number
  skip: number
  warehouseIds: string[]
}) {
  const valuation = await inventoryValuation(warehouseIds)
  let rows: Array<{
    id: string
    code: string
    name: string
    currentStock: number
    costPrice: number
    sellingPrice: number
  }> = []
  let total = 0
  if (warehouseIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: warehouseIds } },
      include: { product: { select: { id: true, code: true, name: true, costPrice: true, sellingPrice: true } } },
    })
    const merged = new Map<string, (typeof rows)[number]>()
    for (const row of stocks) {
      const prev = merged.get(row.productId)
      if (prev) prev.currentStock += row.quantity
      else {
        merged.set(row.productId, {
          id: row.product.id,
          code: row.product.code,
          name: row.product.name,
          currentStock: row.quantity,
          costPrice: row.product.costPrice,
          sellingPrice: row.product.sellingPrice,
        })
      }
    }
    rows = Array.from(merged.values())
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter((row) => row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle))
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    total = rows.length
    rows = rows.slice(skip, skip + PAGE_SIZE)
  } else {
    const where = q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {}
    const [count, productRows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: PAGE_SIZE,
        select: { id: true, code: true, name: true, currentStock: true, costPrice: true, sellingPrice: true },
      }),
    ])
    total = count
    rows = productRows
  }
  const forecasts = await forecastLabels(
    rows.map((row) => ({ id: row.id, currentStock: row.currentStock })),
    new Date(),
  )
  return (
    <div>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">قيمة المخزون بسعر التكلفة</p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(valuation.costValue)}</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">قيمة المخزون بسعر البيع</p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(valuation.sellValue)}</p>
        </section>
      </div>
      <DataCard>
        <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value="stock" />
          <input name="q" defaultValue={q} placeholder="بحث عن صنف" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          <button className={btnPrimary}>بحث</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">الصنف</th>
                <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                <th className="px-4 py-3 text-right font-semibold">التكلفة</th>
                <th className="px-4 py-3 text-right font-semibold">البيع</th>
                <th className="px-4 py-3 text-right font-semibold">قيمة التكلفة</th>
                <th className="px-4 py-3 text-right font-semibold">قيمة البيع</th>
                <th className="px-4 py-3 text-right font-semibold" title="الرصيد الحالي مقسوماً على متوسط الصادر اليومي منذ أول حركة صادر">
                  التوقع الذكي للنفاد
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
                  <td className="px-4 py-3">{formatMoney(row.costPrice)}</td>
                  <td className="px-4 py-3">{formatMoney(row.sellingPrice)}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(row.currentStock * row.costPrice)}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(row.currentStock * row.sellingPrice)}</td>
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
  kind,
  q,
  page,
  skip,
}: {
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
        <p className="text-sm text-slate-600">{isCustomer ? "إجمالي مديونية العملاء" : "إجمالي المستحق للموردين"}</p>
        <p className="mt-2 text-2xl font-bold">{formatMoney(totalSum._sum.balance ?? 0)}</p>
      </section>
      <DataCard>
        <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value={kind} />
          <input name="q" defaultValue={q} placeholder="بحث بالاسم أو الهاتف" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          <button className={btnPrimary}>بحث</button>
          <a href={pageHref("/reports", { tab: kind })} className={btnGhost}>
            مسح
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                <th className="px-4 py-3 text-right font-semibold">الهاتف</th>
                <th className="px-4 py-3 text-right font-semibold">البريد</th>
                <th className="px-4 py-3 text-right font-semibold">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    لا توجد أرصدة مستحقة.
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
                    <td className="px-4 py-3 font-bold">{formatMoney(row.balance)}</td>
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

async function PaymentsReport({ q, page, skip }: { q: string; page: number; skip: number }) {
  const data = await listPayments({ q, skip, take: PAGE_SIZE });
  return (
    <div>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <StatCard label="إجمالي سندات القبض" value={formatMoney(data.receipts)} />
        <StatCard label="إجمالي سندات الصرف" value={formatMoney(data.payments)} />
      </div>
      <DataCard>
        <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value="payments" />
          <input name="q" defaultValue={q} placeholder="بحث بالمرجع أو البيان" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          <button className={btnPrimary}>بحث</button>
          <a href={pageHref("/reports", { tab: "payments" })} className={btnGhost}>
            مسح
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">النوع</th>
                <th className="px-4 py-3 text-right font-semibold">الطرف</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold">المرجع</th>
                <th className="px-4 py-3 text-right font-semibold">المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    لا توجد سندات مطابقة.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{row.type === "RECEIPT" ? "سند قبض" : "سند صرف"}</td>
                    <td className="px-4 py-3">{row.partyName}</td>
                    <td className="px-4 py-3 font-bold">{formatMoney(row.amount)}</td>
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
    <Suspense fallback={<PageSkeleton title="التقارير" />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
