import { Suspense } from "react";
import { connection } from "next/server";
import { WarehouseForms } from "@/app/(panel)/warehouses/warehouse-forms";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { formatQty } from "@/lib/format";
import { datetimeFor, getLocale, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getActiveScope, warehouseWhereForScope } from "@/lib/scope";
import { listTransfers, listWarehouses, warehouseStock } from "@/services/warehouse.service";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";
import { VentureWarehousesHub } from "@/components/warehouses/VentureWarehousesHub";

export const metadata = {
  title: "المستودعات وسلاسل الإمداد | Venture Foods W.L.L.",
  description: "المطبخ المركزي بالقرين والمستودعات الـ 10 لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function WarehousesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "warehouses", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("warehouses"))) {
    return <DisabledModule title={tx(locale, "المستودعات", "Warehouses")} />;
  }
  const query = await readQuery(searchParams);
  const scope = await getActiveScope(query);
  const allWarehouses = await listWarehouses();
  const scopeFilter = warehouseWhereForScope(scope);
  const warehouses = Object.keys(scopeFilter).length
    ? allWarehouses.filter((warehouse) => {
        if ("code" in scopeFilter && scopeFilter.code) return warehouse.code === scopeFilter.code;
        if ("brandCode" in scopeFilter && scopeFilter.brandCode) return warehouse.brandCode === scopeFilter.brandCode;
        return true;
      })
    : allWarehouses;
  const selected =
    (scope.warehouseIds[0] && warehouses.find((warehouse) => warehouse.id === scope.warehouseIds[0])?.id) ||
    warehouses.find((warehouse) => warehouse.id === query.q)?.id ||
    warehouses[0]?.id ||
    "";
  const [stocks, transfers, products] = await Promise.all([
    selected ? warehouseStock(selected) : Promise.resolve([]),
    listTransfers((query.page - 1) * PAGE_SIZE, PAGE_SIZE),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
      take: 500,
    }),
  ]);

  const transferProducts = products.filter((product) => {
    const name = product.name.toLowerCase();
    const code = product.code.toUpperCase();
    if (/^\d+%\s*on\s+your\s+order/i.test(product.name)) return false;
    if (name.includes("on your order")) return false;
    if (name.includes("3rd party") || name.includes("delivery charges")) return false;
    if (/\b(10|15|20|25|30|50)%\b/.test(name) && name.includes("order")) return false;
    if (code.startsWith("DISC") || code.startsWith("CPN") || code.startsWith("PROMO")) return false;
    return true;
  });

  const legacyLiveChildren = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <h4 className="text-sm font-bold text-amber-400">
          {tx(locale, "إدارة مستودعات قاعدة البيانات الحية (Prisma DB)", "Prisma Database Warehouses & Stock")}
        </h4>
        <SmartIngestLaunchButton module="inventory" locale={locale} />
      </div>
      <WarehouseForms
        canCreate={can(user, "warehouses", "create")}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        products={transferProducts}
      />
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-4 py-3 text-right">{tx(locale, "الصنف", "Item")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "الكود", "Code")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "الكمية بالمستودع", "Quantity")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "الرصيد الكلي", "Total")}</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  {tx(locale, "لا يوجد رصيد مسجل في هذا المستودع.", "No stock recorded in this warehouse.")}
                </td>
              </tr>
            ) : (
              stocks.map((row) => (
                <tr key={row.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-semibold text-white">{row.product.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">
                    {row.product.code}
                  </td>
                  <td className="px-4 py-3 font-bold text-amber-300">{formatQty(row.quantity)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatQty(row.product.currentStock)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 font-bold text-white text-xs">
          {tx(locale, "سجل التحويلات المنفذة بقاعدة البيانات", "Database Transfer Log")}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs">
              <th className="px-4 py-2 text-right">{tx(locale, "الرقم", "Number")}</th>
              <th className="px-4 py-2 text-right">{tx(locale, "من", "From")}</th>
              <th className="px-4 py-2 text-right">{tx(locale, "إلى", "To")}</th>
              <th className="px-4 py-2 text-right">{tx(locale, "الأصناف", "Items")}</th>
              <th className="px-4 py-2 text-right">{tx(locale, "التاريخ", "Date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {transfers.rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-900/40">
                <td className="px-4 py-2 font-mono text-amber-400" dir="ltr">
                  {row.transferNumber}
                </td>
                <td className="px-4 py-2 text-slate-300">{row.fromWarehouse.name}</td>
                <td className="px-4 py-2 text-slate-300">{row.toWarehouse.name}</td>
                <td className="px-4 py-2 text-slate-400">
                  {row.items.map((item) => `${item.product.name} (${formatQty(item.quantity)})`).join(locale === "en" ? ", " : "، ")}
                </td>
                <td className="px-4 py-2 text-slate-400">{datetimeFor(locale, row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar path="/warehouses" params={{ q: selected }} page={query.page} total={transfers.total} />
      </div>
    </div>
  );

  return (
    <VentureWarehousesHub
      locale={locale === "en" ? "en" : "ar"}
      liveChildren={legacyLiveChildren}
    />
  );
}

export default function WarehousesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Warehouses" />}>
      <WarehousesContent searchParams={searchParams} />
    </Suspense>
  );
}
