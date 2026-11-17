import { Suspense } from "react";
import { connection } from "next/server";
import { WarehouseForms } from "@/app/(panel)/warehouses/warehouse-forms";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { visibleProductWhere } from "@/lib/panel-visibility";
import { formatDateTime, formatQty, getUnavailableTooltip, UNAVAILABLE_DASH } from "@/lib/format";
import { getLocale, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getActiveScope, warehouseWhereForScope } from "@/lib/scope";
import { listTransfers, listWarehouses, warehouseStock } from "@/services/warehouse.service";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";
import { VentureWarehousesHub } from "@/components/warehouses/VentureWarehousesHub";

export const metadata = {
  title: "المستودعات ومخازن الفروع | شركة فنتشر فودز ذ.م.م.",
  description: "المطبخ المركزي والمستودع الرئيسي بالمطبخ المركزي ومخازن الفروع الـ 7 النشطة لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function WarehousesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const uiLocale = locale === "en" ? "en" : "ar";
  const unavailableTip = getUnavailableTooltip(uiLocale);
  const user = await requireUser();
  if (!can(user, "warehouses", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("warehouses"))) {
    return <DisabledModule title={tx(locale, "المستودعات", "Warehouses")} />;
  }
  const query = await readQuery(searchParams);
  const scope = await getActiveScope(query);
  const allRawWarehouses = await listWarehouses();
  const allWarehouses = allRawWarehouses.filter((w) => ALLOWED_WAREHOUSE_CODES.has(String(w.code ?? "").toUpperCase()));
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
      where: visibleProductWhere(),
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
    <div dir={uiLocale === "en" ? "ltr" : "rtl"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ds-border-hairline)] pb-3">
        <h4 className="text-sm font-bold" style={{ color: "var(--ds-accent)" }}>
          {tx(locale, "إدارة مستودعات قاعدة البيانات الحية (Prisma DB)", "Prisma Database Warehouses & Stock")}
        </h4>
        <SmartIngestLaunchButton module="inventory" locale={locale} />
      </div>
      <WarehouseForms
        canCreate={can(user, "warehouses", "create")}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
        products={transferProducts}
      />
      <div className="ds-surface overflow-hidden rounded-2xl">
        {stocks.length === 0 ? (
          <div
            role="status"
            data-state-block="empty"
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--ds-text-muted)" }}
          >
            {tx(locale, "لا يوجد رصيد مسجل في هذا المستودع.", "No stock recorded in this warehouse.")}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                <tr style={{ color: "var(--ds-text-secondary)" }}>
                  <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الصنف", "Item")}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الكود", "Code")}</th>
                  <th className="px-4 py-3 text-end text-xs font-bold">{tx(locale, "الكمية بالمستودع", "Quantity")}</th>
                  <th className="px-4 py-3 text-end text-xs font-bold">{tx(locale, "الرصيد الكلي", "Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {stocks.map((row) => (
                  <tr key={row.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-4 py-3 font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                      {row.product.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--ds-text-muted)" }} dir="ltr">
                      <span className="ds-num">{row.product.code}</span>
                    </td>
                    <td className="px-4 py-3 text-end font-bold" style={{ color: "var(--ds-accent)" }}>
                      <span dir="ltr" className="ds-num tabular-nums">
                        {formatQty(row.quantity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end" style={{ color: "var(--ds-text-secondary)" }}>
                      <span dir="ltr" className="ds-num tabular-nums">
                        {formatQty(row.product.currentStock)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="ds-surface overflow-hidden rounded-2xl">
        <div className="border-b border-[var(--ds-border-hairline)] px-4 py-3 text-xs font-bold" style={{ color: "var(--ds-text-primary)" }}>
          {tx(locale, "سجل التحويلات المنفذة بقاعدة البيانات", "Database Transfer Log")}
        </div>
        {transfers.rows.length === 0 ? (
          <div
            role="status"
            data-state-block="empty"
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--ds-text-muted)" }}
          >
            {tx(locale, "لا توجد تحويلات مخزنية مسجلة بعد.", "No stock transfers recorded yet.")}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                <tr className="text-xs" style={{ color: "var(--ds-text-secondary)" }}>
                  <th className="px-4 py-2.5 text-start font-bold">{tx(locale, "الرقم", "Number")}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{tx(locale, "من", "From")}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{tx(locale, "إلى", "To")}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{tx(locale, "الأصناف", "Items")}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{tx(locale, "التاريخ (الكويت)", "Date (Kuwait)")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)] text-xs">
                {transfers.rows.map((row) => {
                  const dt = formatDateTime(row.createdAt, { locale: uiLocale });
                  return (
                    <tr key={row.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="px-4 py-2.5 font-mono font-bold" style={{ color: "var(--ds-accent)" }} dir="ltr">
                        <span className="ds-num">{row.transferNumber}</span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--ds-text-primary)" }}>
                        {row.fromWarehouse.name}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--ds-text-primary)" }}>
                        {row.toWarehouse.name}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--ds-text-secondary)" }}>
                        {row.items.map((item) => `${item.product.name} (${formatQty(item.quantity)})`).join(locale === "en" ? ", " : "، ")}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--ds-text-muted)" }}>
                        {dt === UNAVAILABLE_DASH ? (
                          <span title={unavailableTip} aria-label={unavailableTip}>
                            {UNAVAILABLE_DASH}
                          </span>
                        ) : (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {dt}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar path="/warehouses" params={{ q: selected }} page={query.page} total={transfers.total} />
      </div>
    </div>
  );

  return (
    <VentureWarehousesHub
      locale={uiLocale}
      liveChildren={legacyLiveChildren}
    />
  );
}

/** Warehouse codes (Odoo stock.warehouse + ERP seed) mapped to whitelisted Odoo POS locations. */
const ALLOWED_WAREHOUSE_CODES = new Set([
  "PRM", "360", "ASM", "KOUT", "SAL", "SMIA", "ARD", "ARDB", "AR", "ARTMP", "AVE", "AVNS", "CK", "MH", "SN", "MBAK", "EXB", "NPISH", "FAIPS", "FASFH",
  "WH-ARDIYA", "WH-360", "WH-KOUT", "WH-AVENUES", "WH-SALM1", "WH-SHARQ", "WH-PROM", "WH-ALRAI", "WH-OUT", "WH-MAK",
]);

export default function WarehousesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <main className="w-full max-w-none px-4 py-6 sm:px-6" suppressHydrationWarning>
      <Suspense fallback={<PageSkeleton title="Warehouses" />}>
        <WarehousesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
