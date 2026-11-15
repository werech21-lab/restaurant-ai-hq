"use client";

import Link from "next/link";
import { DataCard, LowStockBadge, PaginationBar, btnGhost, btnPrimary, fieldClass } from "@/components/erp-ui";
import { UnlinkedSourceNotice } from "@/components/erp/UnlinkedSourceNotice";
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
  const active = tab === "categories" || tab === "movements" || tab === "fefo" ? tab : "products";

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {en ? "Inventory & Materials" : "المخزون وحركات المواد"}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {en
              ? "Displays only stored database items without any static seed stock or hardcoded valuation cards."
              : "يعرض فقط الأصناف والحركات الفعلية المخزنة دون أي أرصدة أو تقييمات ثابتة مختلقة."}
          </p>
        </div>
        <Link
          href="/erp/warehouse-chain"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
        >
          {en ? "Odoo 17 Warehouse Moves" : "حركات مخازن Odoo 17"}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        {[
          { id: "products", ar: "الأصناف", en: "Items" },
          { id: "categories", ar: "الأقسام", en: "Categories" },
          { id: "movements", ar: "الحركات", en: "Movements" },
          { id: "fefo", ar: "الصلاحيات (FEFO)", en: "Expiry & FEFO" },
        ].map((item) => (
          <a
            key={item.id}
            href={`/inventory?tab=${item.id}`}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              active === item.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {en ? item.en : item.ar}
          </a>
        ))}
      </div>

      {active === "products" &&
        (products.length === 0 ? (
          <UnlinkedSourceNotice
            isAr={isAr}
            titleAr="غير مربوط بمصدر — أرصدة الأصناف المحلية"
            titleEn="غير مربوط بمصدر — Local Stock Balances"
            reasonAr="لا توجد أصناف مخزنة في الجدول المحلي، وتم حذف جميع الأرصدة والتقييمات الثابتة. لمتابعة حركات الاستلام والصرف الفعلية من Odoo 17 انتقل إلى /erp/warehouse-chain."
            reasonEn="No items exist in the local table and all static stock seed rows have been removed. Open /erp/warehouse-chain for Odoo 17 stock moves."
            requiredSourceAr="ربط أرصدة stock.quant في Odoo 17 أو استخدام /erp/warehouse-chain."
            requiredSourceEn="Link Odoo 17 stock.quant or use /erp/warehouse-chain."
          />
        ) : (
          <DataCard>
            <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <form method="get" className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
                <input type="hidden" name="tab" value="products" />
                {filter ? <input type="hidden" name="filter" value={filter} /> : null}
                <input
                  name="q"
                  defaultValue={q}
                  placeholder={en ? "Search by item name or code..." : "ابحث باسم الصنف أو رمزه..."}
                  className={`${fieldClass} flex-1`}
                />
                <button type="submit" className={btnPrimary}>
                  {en ? "Search" : "بحث"}
                </button>
                {q ? (
                  <a href="/inventory?tab=products" className={btnGhost}>
                    {en ? "Clear" : "مسح"}
                  </a>
                ) : null}
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3 text-start">{en ? "Code" : "الرمز"}</th>
                    <th className="p-3 text-start">{en ? "Item" : "الصنف"}</th>
                    <th className="p-3 text-start">{en ? "Category" : "القسم"}</th>
                    <th className="p-3 text-end">{en ? "Cost" : "التكلفة"}</th>
                    <th className="p-3 text-end">{en ? "Stock" : "الرصيد"}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/60">
                      <td className="p-3 font-mono">{p.code}</td>
                      <td className="p-3 font-semibold">
                        {p.name} {p.low ? <LowStockBadge /> : null}
                      </td>
                      <td className="p-3">{p.categoryName}</td>
                      <td className="p-3 text-end font-mono">{p.costLabel}</td>
                      <td className="p-3 text-end font-mono">{p.stockLabel}</td>
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
          <UnlinkedSourceNotice
            isAr={isAr}
            titleAr="غير مربوط بمصدر — أقسام المخزون"
            titleEn="غير مربوط بمصدر — Inventory Categories"
            requiredSourceAr="ربط فئات product.category من Odoo 17."
            requiredSourceEn="Link product.category from Odoo 17."
          />
        ) : (
          <DataCard>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3 text-start">{en ? "Category" : "القسم"}</th>
                    <th className="p-3 text-end">{en ? "Items" : "عدد الأصناف"}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/60">
                      <td className="p-3 font-semibold">{c.name}</td>
                      <td className="p-3 text-end font-mono">{c.productCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        ))}

      {active === "movements" &&
        (movements.length === 0 ? (
          <UnlinkedSourceNotice
            isAr={isAr}
            titleAr="غير مربوط بمصدر — حركات المخزون المحلية"
            titleEn="غير مربوط بمصدر — Local Stock Movements"
            reasonAr="لا توجد حركات مسجلة محلياً. لعرض حركات الاستلام والصرف والتالف الفعلية من Odoo 17 انتقل إلى /erp/warehouse-chain."
            reasonEn="No local stock movements recorded. Open /erp/warehouse-chain for Odoo 17 stock.move records."
            requiredSourceAr="استخدم /erp/warehouse-chain لقراءة stock.move من Odoo 17."
            requiredSourceEn="Use /erp/warehouse-chain to read stock.move from Odoo 17."
          />
        ) : (
          <DataCard>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3 text-start">{en ? "Date" : "التاريخ"}</th>
                    <th className="p-3 text-start">{en ? "Item" : "الصنف"}</th>
                    <th className="p-3 text-start">{en ? "Type" : "النوع"}</th>
                    <th className="p-3 text-end">{en ? "Quantity" : "الكمية"}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-800/60">
                      <td className="p-3 font-mono">{m.dateLabel}</td>
                      <td className="p-3">{m.productName}</td>
                      <td className="p-3">{m.typeLabel}</td>
                      <td className="p-3 text-end font-mono">{m.quantityLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        ))}

      {active === "fefo" && (
        <UnlinkedSourceNotice
          isAr={isAr}
          titleAr="غير مربوط بمصدر — تتبع تواريخ الصلاحية والتشغيلات (FEFO)"
          titleEn="غير مربوط بمصدر — Batch Expiry & FEFO Tracking"
          reasonAr="تتبع أرقام التشغيلات وتواريخ انتهاء الصلاحية غير مربوط بمصدر بيانات فعلي حالياً."
          reasonEn="Batch lot numbers and expiry dates are not currently linked to an active data source."
          requiredSourceAr="ربط نموذج stock.lot وتواريخ الصلاحية في Odoo 17."
          requiredSourceEn="Link Odoo 17 stock.lot and expiration_date fields."
        />
      )}
    </div>
  );
}
