"use client";

import Link from "next/link";
import { DataCard, LowStockBadge, PaginationBar, btnGhost, btnPrimary } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { formatInt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  low: boolean;
  costLabel: string;
  sellLabel: string;
  stockLabel: string;
  reorderLabel: string;
  forecastLabel: string;
  warehouseName?: string;
  customData?: string;
};

export type CategoryRow = { id: string; name: string; description: string; productCount: number };

export type MovementRow = {
  id: string;
  dateLabel: string;
  productName: string;
  code: string;
  type: string;
  typeLabel: string;
  quantityLabel: string;
  note: string;
  balanceLabel: string;
  userName: string;
  fromLocation?: string;
  toLocation?: string;
  statusLabel?: string;
};

export const VENTURE_STOCK_SEED: ProductRow[] = [];

export function InventoryPanel({
  tab,
  q,
  page,
  total,
  filter,
  products,
  categories,
  movements,
}: {
  tab: string;
  q: string;
  page: number;
  total: number;
  filter: string;
  products: ProductRow[];
  categories: CategoryRow[];
  movements: MovementRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  const isAr = !en;
  const uiLocale = en ? "en" : "ar";
  const active = tab === "categories" || tab === "movements" || tab === "fefo" ? tab : "products";

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ds-border-hairline)] pb-4">
        <div>
          <h1 className="ds-page-title" style={{ color: "var(--ds-text-primary)" }}>
            {en ? "Inventory & Materials" : "المخزون وحركات المواد"}
          </h1>
          <p className="ds-caption mt-1">
            {en
              ? "Displays only stored database items without any static seed stock or hardcoded valuation cards."
              : "يعرض فقط الأصناف والحركات الفعلية المخزنة دون أي أرصدة أو تقييمات ثابتة مختلقة."}
          </p>
        </div>
        <Link
          href="/erp/warehouse-chain"
          className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
        >
          {en ? "Odoo 17 Warehouse Moves" : "حركات مخازن Odoo 17"}
        </Link>
      </div>

      <nav
        role="tablist"
        aria-label={en ? "Inventory sections" : "أقسام المخزون"}
        className="flex flex-wrap items-center gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
      >
        {[
          { id: "products", ar: "الأصناف", en: "Items" },
          { id: "categories", ar: "الأقسام", en: "Categories" },
          { id: "movements", ar: "الحركات", en: "Movements" },
          { id: "fefo", ar: "الصلاحيات (FEFO)", en: "Expiry & FEFO" },
        ].map((item) => {
          const selected = active === item.id;
          return (
            <a
              key={item.id}
              role="tab"
              aria-selected={selected}
              href={`/inventory?tab=${item.id}`}
              className={`ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-xs font-bold ${
                selected
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "ds-surface text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]"
              }`}
            >
              {en ? item.en : item.ar}
            </a>
          );
        })}
      </nav>

      {active === "products" &&
        (products.length === 0 ? (
          <SectionCard locale={uiLocale} title={en ? "Local Stock Balances" : "أرصدة الأصناف المحلية"}>
            <StateBlock
              state="unlinked"
              locale={uiLocale}
              title={en ? "Local Stock Balances Not Connected" : "أرصدة الأصناف المحلية غير مربوطة"}
              description={
                en
                  ? "No items exist in the local table and all static stock seed rows have been removed. Open /erp/warehouse-chain for Odoo 17 stock moves."
                  : "لا توجد أصناف مخزنة في الجدول المحلي، وتم حذف جميع الأرصدة والتقييمات الثابتة. لمتابعة حركات الاستلام والصرف الفعلية من Odoo 17 انتقل إلى /erp/warehouse-chain."
              }
            />
          </SectionCard>
        ) : (
          <DataCard>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ds-border-hairline)] p-4">
              <form method="get" className="flex max-w-lg flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="tab" value="products" />
                {filter ? <input type="hidden" name="filter" value={filter} /> : null}
                <input
                  name="q"
                  defaultValue={q}
                  aria-label={en ? "Search by item name or code" : "ابحث باسم الصنف أو رمزه"}
                  placeholder={en ? "Search by item name or code..." : "ابحث باسم الصنف أو رمزه..."}
                  className="ds-surface-subtle ds-focus-ring min-h-10 flex-1 rounded-xl px-3 py-2 text-sm text-[var(--ds-text-primary)]"
                />
                <button type="submit" className={`${btnPrimary} ds-focus-ring min-h-10`}>
                  {en ? "Search" : "بحث"}
                </button>
                {q ? (
                  <a href="/inventory?tab=products" className={`${btnGhost} ds-focus-ring min-h-10`}>
                    {en ? "Clear" : "مسح"}
                  </a>
                ) : null}
              </form>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[540px] text-xs">
                <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                  <tr style={{ color: "var(--ds-text-secondary)" }}>
                    <th className="p-3 text-start font-bold">{en ? "Code" : "الرمز"}</th>
                    <th className="p-3 text-start font-bold">{en ? "Item" : "الصنف"}</th>
                    <th className="p-3 text-start font-bold">{en ? "Category" : "القسم"}</th>
                    <th className="p-3 text-end font-bold">{en ? "Cost" : "التكلفة"}</th>
                    <th className="p-3 text-end font-bold">{en ? "Stock" : "الرصيد"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {products.map((p) => (
                    <tr key={p.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="p-3 font-mono" dir="ltr">
                        <span className="ds-num">{p.code}</span>
                      </td>
                      <td className="p-3 font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                        {p.name} {p.low ? <LowStockBadge /> : null}
                      </td>
                      <td className="p-3" style={{ color: "var(--ds-text-secondary)" }}>
                        {p.categoryName}
                      </td>
                      <td className="p-3 text-end font-mono">
                        <span dir="ltr" className="ds-num tabular-nums">
                          {p.costLabel}
                        </span>
                      </td>
                      <td className="p-3 text-end font-mono">
                        <span dir="ltr" className="ds-num tabular-nums">
                          {p.stockLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              path="/inventory"
              params={{ tab: "products", q, filter }}
              page={page}
              total={total}
            />
          </DataCard>
        ))}

      {active === "categories" &&
        (categories.length === 0 ? (
          <SectionCard locale={uiLocale} title={en ? "Inventory Categories" : "أقسام المخزون"}>
            <StateBlock
              state="unlinked"
              locale={uiLocale}
              title={en ? "Inventory Categories Not Connected" : "أقسام المخزون غير مربوطة"}
              description={
                en
                  ? "Link product.category from Odoo 17 to inspect category groups."
                  : "يتطلب ربط فئات product.category من Odoo 17."
              }
            />
          </SectionCard>
        ) : (
          <DataCard>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[360px] text-xs">
                <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                  <tr style={{ color: "var(--ds-text-secondary)" }}>
                    <th className="p-3 text-start font-bold">{en ? "Category" : "القسم"}</th>
                    <th className="p-3 text-end font-bold">{en ? "Items" : "عدد الأصناف"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {categories.map((c) => (
                    <tr key={c.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="p-3 font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                        {c.name}
                      </td>
                      <td className="p-3 text-end font-mono">
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatInt(c.productCount, uiLocale)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        ))}

      {active === "movements" &&
        (movements.length === 0 ? (
          <SectionCard locale={uiLocale} title={en ? "Local Stock Movements" : "حركات المخزون المحلية"}>
            <StateBlock
              state="unlinked"
              locale={uiLocale}
              title={en ? "Local Stock Movements Not Connected" : "حركات المخزون المحلية غير مربوطة"}
              description={
                en
                  ? "No local stock movements recorded. Open /erp/warehouse-chain for Odoo 17 stock.move records."
                  : "لا توجد حركات مسجلة محلياً. لعرض حركات الاستلام والصرف والتالف الفعلية من Odoo 17 انتقل إلى /erp/warehouse-chain."
              }
            />
          </SectionCard>
        ) : (
          <DataCard>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[540px] text-xs">
                <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                  <tr style={{ color: "var(--ds-text-secondary)" }}>
                    <th className="p-3 text-start font-bold">{en ? "Date (Kuwait)" : "التاريخ (الكويت)"}</th>
                    <th className="p-3 text-start font-bold">{en ? "Item" : "الصنف"}</th>
                    <th className="p-3 text-start font-bold">{en ? "Type" : "النوع"}</th>
                    <th className="p-3 text-end font-bold">{en ? "Quantity" : "الكمية"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {movements.map((m) => (
                    <tr key={m.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="p-3 font-mono" dir="ltr">
                        <span className="ds-num tabular-nums">{m.dateLabel}</span>
                      </td>
                      <td className="p-3" style={{ color: "var(--ds-text-primary)" }}>
                        {m.productName}
                      </td>
                      <td className="p-3" style={{ color: "var(--ds-text-secondary)" }}>
                        {m.typeLabel}
                      </td>
                      <td className="p-3 text-end font-mono">
                        <span dir="ltr" className="ds-num tabular-nums">
                          {m.quantityLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        ))}

      {active === "fefo" && (
        <SectionCard locale={uiLocale} title={en ? "Batch Expiry & FEFO Tracking" : "تتبع تواريخ الصلاحية والتشغيلات (FEFO)"}>
          <StateBlock
            state="unlinked"
            locale={uiLocale}
            title={en ? "Batch Expiry & FEFO Tracking Not Connected" : "تتبع الصلاحية (FEFO) غير مربوط بمصدر"}
            description={
              en
                ? "Batch lot numbers and expiry dates are not currently linked to an active data source. Link Odoo 17 stock.lot and expiration_date fields."
                : "تتبع أرقام التشغيلات وتواريخ انتهاء الصلاحية غير مربوط بمصدر بيانات فعلي حالياً. يتطلب ربط نموذج stock.lot وتواريخ الصلاحية في Odoo 17."
            }
          />
        </SectionCard>
      )}
    </div>
  );
}
