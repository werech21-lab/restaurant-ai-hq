import { Suspense } from "react";
import { connection } from "next/server";
import { WarehouseForms } from "@/app/(panel)/warehouses/warehouse-forms";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { formatDate, formatQty } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listTransfers, listWarehouses, warehouseStock } from "@/services/warehouse.service";

export const metadata = { title: "المستودعات | نظام ERP" };

async function WarehousesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const user = await requireUser();
  if (!can(user, "warehouses", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("warehouses"))) return <DisabledModule title="المستودعات" />;
  const query = await readQuery(searchParams);
  const warehouses = await listWarehouses();
  const selected = warehouses.find((warehouse) => warehouse.id === query.q)?.id ?? warehouses[0]?.id ?? "";
  const [stocks, transfers, products] = await Promise.all([
    selected ? warehouseStock(selected) : Promise.resolve([]),
    listTransfers((query.page - 1) * PAGE_SIZE, PAGE_SIZE),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true }, take: 200 }),
  ]);

  return (
    <div>
      <PageHeader title="المستودعات والفروع" description="رصيد كل صنف في كل مستودع، وتحويل الكميات بين الفروع دون تغيير إجمالي المخزون." />
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
          >
            {warehouse.name}
            {warehouse.isDefault ? " · افتراضي" : ""}
          </a>
        ))}
      </div>
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3 text-right">الصنف</th>
              <th className="px-4 py-3 text-right">الرمز</th>
              <th className="px-4 py-3 text-right">رصيد هذا المستودع</th>
              <th className="px-4 py-3 text-right">إجمالي الشركة</th>
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">لا يوجد رصيد في هذا المستودع.</td>
              </tr>
            ) : (
              stocks.map((row) => (
                <tr key={row.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">{row.product.name}</td>
                  <td className="px-4 py-3" dir="ltr">{row.product.code}</td>
                  <td className="px-4 py-3 font-bold">{formatQty(row.quantity)}</td>
                  <td className="px-4 py-3">{formatQty(row.product.currentStock)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-bold">سجل التحويلات</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3 text-right">الرقم</th>
              <th className="px-4 py-3 text-right">من</th>
              <th className="px-4 py-3 text-right">إلى</th>
              <th className="px-4 py-3 text-right">الأصناف</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {transfers.rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 last:border-0">
                <td className="px-4 py-3 font-semibold" dir="ltr">{row.transferNumber}</td>
                <td className="px-4 py-3">{row.fromWarehouse.name}</td>
                <td className="px-4 py-3">{row.toWarehouse.name}</td>
                <td className="px-4 py-3">{row.items.map((item) => `${item.product.name} (${formatQty(item.quantity)})`).join("، ")}</td>
                <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
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
    <Suspense fallback={<PageSkeleton title="المستودعات" />}>
      <WarehousesContent searchParams={searchParams} />
    </Suspense>
  );
}
