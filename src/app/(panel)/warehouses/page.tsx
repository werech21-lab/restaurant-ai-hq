import { Suspense } from "react";
import { connection } from "next/server";
import { WarehouseForms } from "@/app/(panel)/warehouses/warehouse-forms";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { formatQty } from "@/lib/format";
import { datetimeFor, getLocale, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getActiveScope, warehouseWhereForScope } from "@/lib/scope";
import { listTransfers, listWarehouses, warehouseStock } from "@/services/warehouse.service";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";

export const metadata = { title: "Warehouses | AetherBI ERP" };

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
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true }, take: 200 }),
  ]);

  return (
    <div>
      <PageHeader
        title={tx(locale, "المستودعات والفروع", "Warehouses & branches")}
        description={tx(
          locale,
          "رصيد كل صنف في كل مستودع، وتحويل الكميات بين الفروع دون تغيير إجمالي المخزون.",
          "Per-warehouse stock balances and branch transfers without changing company-wide totals.",
        )}
      />
      <div className="mb-4">
        <SmartIngestLaunchButton module="inventory" locale={locale} />
      </div>
      <div className="mb-4">
        <a
          href="/directory"
          className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
        >
          {tx(locale, "دليل الهواتف والبدالة للفروع", "Branch phone & PBX directory")}
        </a>
      </div>
      <WarehouseForms
        canCreate={can(user, "warehouses", "create")}
        warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name }))}
        products={products}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {warehouses.map((warehouse) => (
          <a
            key={warehouse.id}
            href={pageHref("/warehouses", { q: warehouse.id })}
            className={
              warehouse.id === selected
                ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
            }
            title={warehouse.managerName || warehouse.location || undefined}
          >
            {warehouse.name}
            {warehouse.isDefault ? tx(locale, " · افتراضي", " · Default") : ""}
            {warehouse.managerName ? (
              <span className="mt-0.5 block text-[10px] font-normal opacity-90" dir="ltr">
                {warehouse.managerName}
              </span>
            ) : null}
          </a>
        ))}
      </div>
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3 text-right">{tx(locale, "الصنف", "Item")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "الرمز", "Code")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "رصيد هذا المستودع", "This warehouse")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "إجمالي الشركة", "Company total")}</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  {tx(locale, "لا يوجد رصيد في هذا المستودع.", "No stock in this warehouse.")}
                </td>
              </tr>
            ) : (
              stocks.map((row) => (
                <tr key={row.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">{row.product.name}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {row.product.code}
                  </td>
                  <td className="px-4 py-3 font-bold">{formatQty(row.quantity)}</td>
                  <td className="px-4 py-3">{formatQty(row.product.currentStock)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-bold">
          {tx(locale, "سجل التحويلات", "Transfer log")}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3 text-right">{tx(locale, "الرقم", "Number")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "من", "From")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "إلى", "To")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "الأصناف", "Items")}</th>
              <th className="px-4 py-3 text-right">{tx(locale, "التاريخ", "Date")}</th>
            </tr>
          </thead>
          <tbody>
            {transfers.rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 last:border-0">
                <td className="px-4 py-3 font-semibold" dir="ltr">
                  {row.transferNumber}
                </td>
                <td className="px-4 py-3">{row.fromWarehouse.name}</td>
                <td className="px-4 py-3">{row.toWarehouse.name}</td>
                <td className="px-4 py-3">
                  {row.items.map((item) => `${item.product.name} (${formatQty(item.quantity)})`).join(locale === "en" ? ", " : "، ")}
                </td>
                <td className="px-4 py-3">{datetimeFor(locale, row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar path="/warehouses" params={{ q: selected }} page={query.page} total={transfers.total} />
      </div>
    </div>
  );
}

export default function WarehousesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Warehouses" />}>
      <WarehousesContent searchParams={searchParams} />
    </Suspense>
  );
}
