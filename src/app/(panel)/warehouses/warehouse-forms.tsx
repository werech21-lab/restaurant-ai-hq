"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveWarehouseAction, transferStockAction } from "@/app/actions/warehouses";
import { Alert, btnPrimary, labelClass } from "@/components/erp-ui";
import { SectionCard } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

type WarehouseOption = { id: string; name: string };
type ProductOption = { id: string; name: string; code: string };

const inputCls =
  "ds-surface-subtle ds-focus-ring w-full rounded-xl px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]";

/** Exclude Odoo promo/coupon/service lines from stock transfer pickers. */
export function isStockTransferProduct(product: ProductOption): boolean {
  const name = product.name.toLowerCase();
  const code = product.code.toUpperCase();
  if (/^\d+%\s*on\s+your\s+order/i.test(product.name)) return false;
  if (name.includes("on your order")) return false;
  if (name.includes("3rd party") || name.includes("delivery charges")) return false;
  if (/\b(10|15|20|25|30|50)%\b/.test(name) && name.includes("order")) return false;
  if (code.startsWith("DISC") || code.startsWith("CPN") || code.startsWith("PROMO")) return false;
  if (code.startsWith("RW") || code.startsWith("PI") || code.startsWith("PP")) return true;
  if (code.startsWith("ODOO-") && /%\s*on\s+your\s+order/i.test(product.name)) return false;
  return true;
}

export function WarehouseForms({
  warehouses,
  products,
  canCreate,
}: {
  warehouses: WarehouseOption[];
  products: ProductOption[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const en = locale === "en";
  const uiLocale = en ? "en" : "ar";
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const stockProducts = useMemo(() => products.filter(isStockTransferProduct), [products]);

  if (!canCreate) return null;

  async function saveWarehouse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await saveWarehouseAction({
      name: String(form.get("name") || ""),
      location: String(form.get("location") || ""),
      managerName: String(form.get("managerName") || ""),
      isDefault: form.get("isDefault") === "on",
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || (en ? "Saved" : "تم الحفظ"));
      router.refresh();
    }
  }

  async function transfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await transferStockAction({
      fromId: String(form.get("fromId") || ""),
      toId: String(form.get("toId") || ""),
      productId: String(form.get("productId") || ""),
      quantity: Number(form.get("quantity")),
      note: String(form.get("note") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || (en ? "Transfer completed" : "تم التحويل"));
      router.refresh();
    }
  }

  return (
    <div dir={en ? "ltr" : "rtl"} className="mb-4 grid gap-4 lg:grid-cols-2">
      {error ? (
        <div className="lg:col-span-2">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      {message ? (
        <div className="lg:col-span-2">
          <Alert kind="ok">{message}</Alert>
        </div>
      ) : null}

      <SectionCard locale={uiLocale} title={en ? "New Warehouse / Branch" : "مستودع جديد"}>
        <form onSubmit={saveWarehouse} className="space-y-3">
          <div>
            <label htmlFor="wh-name" className={labelClass}>
              {en ? "Name" : "الاسم"}
            </label>
            <input id="wh-name" name="name" className={inputCls} required />
          </div>
          <div>
            <label htmlFor="wh-location" className={labelClass}>
              {en ? "Location / Address" : "الموقع"}
            </label>
            <input id="wh-location" name="location" className={inputCls} />
          </div>
          <div>
            <label htmlFor="wh-manager" className={labelClass}>
              {en ? "Manager / Person in Charge" : "المسؤول"}
            </label>
            <input id="wh-manager" name="managerName" className={inputCls} />
          </div>
          <label className="flex min-h-10 items-center gap-2 text-sm font-semibold" style={{ color: "var(--ds-text-primary)" }}>
            <input name="isDefault" type="checkbox" className="ds-focus-ring h-4 w-4 rounded" />{" "}
            {en ? "Default Warehouse" : "مستودع افتراضي"}
          </label>
          <button className={`${btnPrimary} ds-focus-ring min-h-10`} disabled={pending}>
            {en ? "Save Warehouse" : "حفظ المستودع"}
          </button>
        </form>
      </SectionCard>

      <SectionCard locale={uiLocale} title={en ? "Inter-Branch Stock Transfer" : "تحويل مخزني بين الفروع"}>
        <form onSubmit={transfer} className="space-y-3">
          <div>
            <label htmlFor="tr-from" className={labelClass}>
              {en ? "From Warehouse / Branch" : "من مستودع"}
            </label>
            <select id="tr-from" name="fromId" className={inputCls} defaultValue={warehouses[0]?.id}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tr-to" className={labelClass}>
              {en ? "To Warehouse / Branch" : "إلى مستودع"}
            </label>
            <select id="tr-to" name="toId" className={inputCls} defaultValue={warehouses[1]?.id ?? warehouses[0]?.id}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tr-product" className={labelClass}>
              {en ? "Item" : "الصنف"}
            </label>
            <select id="tr-product" name="productId" className={inputCls}>
              {stockProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tr-qty" className={labelClass}>
              {en ? "Qty" : "الكمية"}
            </label>
            <input id="tr-qty" name="quantity" dir="ltr" type="number" min="0.001" step="0.001" className={inputCls} required />
          </div>
          <div>
            <label htmlFor="tr-note" className={labelClass}>
              {en ? "Notes / Remarks" : "ملاحظة"}
            </label>
            <input id="tr-note" name="note" className={inputCls} />
          </div>
          <button className={`${btnPrimary} ds-focus-ring min-h-10`} disabled={pending}>
            {en ? "Execute Stock Transfer" : "تنفيذ التحويل"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
