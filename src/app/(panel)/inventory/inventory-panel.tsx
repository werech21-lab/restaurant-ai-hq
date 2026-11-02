"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCategory, deleteProduct, saveCategory, saveProduct } from "@/app/actions/inventory";
import { searchCategories } from "@/app/actions/search";
import { CustomFields } from "@/components/custom-fields";
import { Modal } from "@/components/modal";
import { customSummary, parseCustom, readCustom } from "@/lib/custom";
import { ExportCsvButton } from "@/components/ui/export-button";
import { SearchSelect } from "@/components/search-select";
import {
  Alert,
  DataCard,
  LowStockBadge,
  PageHeader,
  PaginationBar,
  btnDanger,
  btnGhost,
  btnPrimary,
  fieldClass,
  labelClass,
} from "@/components/erp-ui";
import { useI18n } from "@/lib/i18n";
import { pageHref } from "@/lib/pagination";
import type { SearchHit } from "@/lib/types";
import { SmartIngestLink } from "@/components/SmartIngestLink";

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
};

export function InventoryPanel({
  tab,
  q,
  page,
  total,
  filter,
  products,
  categories,
  movements,
  canCreate,
  canEdit,
  canDelete,
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
  const router = useRouter();
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [product, setProduct] = useState<ProductRow | "new" | null>(null);
  const [category, setCategory] = useState<CategoryRow | "new" | null>(null);
  const active = tab === "categories" || tab === "movements" ? tab : "products";
  const params = { tab: active, q, filter: active === "products" ? filter : "" };

  return (
    <div>
      <PageHeader
        title={en ? "Inventory & items" : "المخزون والأصناف"}
        description={
          en
            ? "Categories, items, opening stock, and stock movements with server-side paging."
            : "الأقسام والأصناف والرصيد الافتتاحي وحركات المخزون بترقيم من الخادم."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <SmartIngestLink module="inventory" />
            <ExportCsvButton kind="inventory" filename="inventory.csv" />
            {active === "categories" && canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setCategory("new")}>
                <Plus size={16} />
                {en ? "New category" : "قسم جديد"}
              </button>
            ) : null}
            {active === "products" && canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setProduct("new")}>
                <Plus size={16} />
                {en ? "New item" : "صنف جديد"}
              </button>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Tab href="/inventory?tab=products" active={active === "products"} label={en ? "Items" : "الأصناف"} />
        <Tab href="/inventory?tab=categories" active={active === "categories"} label={en ? "Categories" : "الأقسام"} />
        <Tab href="/inventory?tab=movements" active={active === "movements"} label={t("inv.tab.movements")} />
        <a href="/erp/food-safety" className={btnGhost}>
          {en ? "Food Safety & FEFO" : "سلامة الغذاء وFEFO"}
        </a>
      </div>
      <DataCard>
        <form method="get" className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value={active} />
          {filter && active === "products" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder={t("inv.search")}
            className={`${fieldClass} max-w-sm`}
          />
          <button className={btnPrimary}>{t("admin.searchButton")}</button>
          <a href={pageHref("/inventory", { tab: active })} className={btnGhost}>
            {t("action.clear")}
          </a>
          {active === "products" ? (
            <a
              href={filter === "low_stock" ? "/inventory?tab=products" : "/inventory?tab=products&filter=low_stock"}
              className={filter === "low_stock" ? btnDanger : btnGhost}
            >
              {t("inv.filter.lowOnly")}
            </a>
          ) : null}
        </form>
        {active === "products" && filter === "low_stock" ? (
          <p className="border-b border-slate-200 bg-red-600 px-4 py-2 text-sm font-bold text-white">
            {en
              ? "Showing items at or below reorder level."
              : "يتم عرض الأصناف التي وصلت كميتها إلى حد الطلب أو أقل."}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          {active === "products" ? (
            <ProductsTable
              rows={products}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={setProduct}
              onDelete={async (row) => {
                if (!confirm(en ? `Delete ${row.name}?` : `حذف ${row.name}؟`)) return;
                const result = await deleteProduct(row.id);
                if (!result.ok) alert(result.message);
                else router.refresh();
              }}
            />
          ) : null}
          {active === "categories" ? (
            <CategoriesTable
              rows={categories}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={setCategory}
              onDelete={async (row) => {
                if (!confirm(en ? `Delete category ${row.name}?` : `حذف قسم ${row.name}؟`)) return;
                const result = await deleteCategory(row.id);
                if (!result.ok) alert(result.message);
                else router.refresh();
              }}
            />
          ) : null}
          {active === "movements" ? <MovementsTable rows={movements} /> : null}
        </div>
        <PaginationBar path="/inventory" params={params} page={page} total={total} />
      </DataCard>
      {product ? (
        <ProductDialog
          row={product === "new" ? null : product}
          onClose={() => setProduct(null)}
          onSaved={() => {
            setProduct(null);
            router.refresh();
          }}
        />
      ) : null}
      {category ? (
        <CategoryDialog
          row={category === "new" ? null : category}
          onClose={() => setCategory(null)}
          onSaved={() => {
            setCategory(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a href={href} className={active ? btnPrimary : btnGhost}>
      {label}
    </a>
  );
}

function ProductsTable({
  rows,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: ProductRow[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: ProductRow) => void;
  onDelete: (row: ProductRow) => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="px-4 py-3 text-right font-semibold">{en ? "Code" : "الرمز"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Item" : "الصنف"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Category" : "القسم"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Cost" : "التكلفة"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Sell" : "البيع"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Qty" : "الكمية"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Reorder" : "حد الطلب"}</th>
          <th
            className="px-4 py-3 text-right font-semibold"
            title={
              en
                ? "On-hand divided by average daily outbound since first OUT movement"
                : "الرصيد الحالي مقسوماً على متوسط الصادر اليومي منذ أول حركة صادر"
            }
          >
            {en ? "Smart stockout forecast" : "التوقع الذكي للنفاد"}
          </th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Status" : "الحالة"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Actions" : "إجراءات"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
              {en ? "No matching items." : "لا توجد أصناف مطابقة."}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-200 last:border-0">
              <td className="px-4 py-3 font-semibold" dir="ltr">
                {row.code}
              </td>
              <td className="px-4 py-3">
                {row.name}
                {customSummary(row.customData) ? <p className="text-xs text-slate-500">{customSummary(row.customData)}</p> : null}
              </td>
              <td className="px-4 py-3">{row.categoryName}</td>
              <td className="px-4 py-3">{row.costLabel}</td>
              <td className="px-4 py-3">{row.sellLabel}</td>
              <td className="px-4 py-3 font-bold">{row.stockLabel}</td>
              <td className="px-4 py-3">{row.reorderLabel}</td>
              <td className="px-4 py-3 text-xs font-semibold text-slate-700">{row.forecastLabel}</td>
              <td className="px-4 py-3">
                {row.low ? <LowStockBadge /> : <span className="text-emerald-700">{en ? "In stock" : "متوفر"}</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {canEdit ? (
                    <button type="button" className={btnGhost} onClick={() => onEdit(row)}>
                      <Pencil size={14} />
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button type="button" className={btnDanger} onClick={() => onDelete(row)}>
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function CategoriesTable({
  rows,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: CategoryRow[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: CategoryRow) => void;
  onDelete: (row: CategoryRow) => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="px-4 py-3 text-right font-semibold">{en ? "Category" : "القسم"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Description" : "الوصف"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Items" : "عدد الأصناف"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Actions" : "إجراءات"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
              {en ? "No categories." : "لا توجد أقسام."}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-200 last:border-0">
              <td className="px-4 py-3 font-semibold">{row.name}</td>
              <td className="px-4 py-3">{row.description || "—"}</td>
              <td className="px-4 py-3">{row.productCount}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {canEdit ? (
                    <button type="button" className={btnGhost} onClick={() => onEdit(row)}>
                      <Pencil size={14} />
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button type="button" className={btnDanger} onClick={() => onDelete(row)}>
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function MovementsTable({ rows }: { rows: MovementRow[] }) {
  const { locale } = useI18n();
  const en = locale === "en";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="px-4 py-3 text-right font-semibold">{en ? "Date" : "التاريخ"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Item" : "الصنف"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Type" : "النوع"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Qty" : "الكمية"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Balance after" : "الرصيد بعد الحركة"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "Note" : "البيان"}</th>
          <th className="px-4 py-3 text-right font-semibold">{en ? "User" : "المستخدم"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
              {en ? "No matching movements." : "لا توجد حركات مطابقة."}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-200 last:border-0">
              <td className="px-4 py-3">{row.dateLabel}</td>
              <td className="px-4 py-3">
                <p className="font-semibold">{row.productName}</p>
                <p className="text-xs text-slate-500" dir="ltr">
                  {row.code}
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${
                    row.type === "IN" ? "bg-emerald-600" : row.type === "OUT" ? "bg-red-600" : "bg-blue-600"
                  }`}
                >
                  {row.typeLabel}
                </span>
              </td>
              <td className="px-4 py-3 font-bold">{row.quantityLabel}</td>
              <td className="px-4 py-3 font-semibold">{row.balanceLabel}</td>
              <td className="px-4 py-3">{row.note || "—"}</td>
              <td className="px-4 py-3">{row.userName}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ProductDialog({
  row,
  onClose,
  onSaved,
}: {
  row: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const savingLabel = t("trade.saving");
  const [category, setCategory] = useState<SearchHit | null>(
    row ? { id: row.categoryId, label: row.categoryName } : null,
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customData = readCustom(form);
    setPending(true);
    const result = await saveProduct({
      id: row?.id,
      code: String(form.get("code") || ""),
      name: String(form.get("name") || ""),
      categoryId: category?.id ?? "",
      costPrice: Number(form.get("costPrice")),
      sellingPrice: Number(form.get("sellingPrice")),
      openingStock: row ? undefined : Number(form.get("openingStock")),
      reorderLevel: Number(form.get("reorderLevel")),
      ...(Object.keys(customData).length > 0 ? { customData } : {}),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else onSaved();
  }

  return (
    <Modal title={row ? (en ? "Edit item" : "تعديل صنف") : en ? "New item" : "صنف جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{en ? "Code" : "الرمز"}</label>
            <input name="code" dir="ltr" defaultValue={row?.code ?? ""} className={`${fieldClass} text-left`} required />
          </div>
          <div>
            <label className={labelClass}>{en ? "Name" : "الاسم"}</label>
            <input name="name" defaultValue={row?.name ?? ""} className={fieldClass} required />
          </div>
        </div>
        <SearchSelect
          label={en ? "Category" : "القسم"}
          placeholder={en ? "Search category" : "ابحث عن قسم"}
          selectedLabel={category?.label}
          search={searchCategories}
          onSelect={setCategory}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{en ? "Cost price" : "سعر التكلفة"}</label>
            <input name="costPrice" dir="ltr" defaultValue={row?.costPrice ?? 0} className={fieldClass} required />
          </div>
          <div>
            <label className={labelClass}>{en ? "Sell price" : "سعر البيع"}</label>
            <input name="sellingPrice" dir="ltr" defaultValue={row?.sellingPrice ?? 0} className={fieldClass} required />
          </div>
          {row ? null : (
            <div>
              <label className={labelClass}>{en ? "Opening stock" : "الرصيد الافتتاحي"}</label>
              <input name="openingStock" dir="ltr" defaultValue={0} className={fieldClass} required />
            </div>
          )}
          <div>
            <label className={labelClass}>{en ? "Reorder level" : "حد الطلب"}</label>
            <input name="reorderLevel" dir="ltr" defaultValue={row?.reorderLevel ?? 0} className={fieldClass} required />
          </div>
        </div>
        <CustomFields entityType="PRODUCT" initial={parseCustom(row?.customData)} />
        {row ? (
          <p className="text-xs text-slate-500">
            {en
              ? "Current quantity is not edited here — it changes via purchases and sales."
              : "الكمية الحالية لا تُعدَّل من هنا، بل عبر الشراء والبيع."}
          </p>
        ) : null}
        <button className={btnPrimary} disabled={pending}>
          {pending ? savingLabel : en ? "Save item" : "حفظ الصنف"}
        </button>
      </form>
    </Modal>
  );
}

function CategoryDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CategoryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const savingLabel = t("trade.saving");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await saveCategory({
      id: row?.id,
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else onSaved();
  }
  return (
    <Modal title={row ? (en ? "Edit category" : "تعديل قسم") : en ? "New category" : "قسم جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={labelClass}>{en ? "Name" : "الاسم"}</label>
          <input name="name" defaultValue={row?.name ?? ""} className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>{en ? "Description" : "الوصف"}</label>
          <input name="description" defaultValue={row?.description ?? ""} className={fieldClass} />
        </div>
        <button className={btnPrimary} disabled={pending}>
          {pending ? savingLabel : en ? "Save category" : "حفظ القسم"}
        </button>
      </form>
    </Modal>
  );
}
