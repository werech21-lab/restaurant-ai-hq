"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveWarehouseAction, transferStockAction } from "@/app/actions/warehouses";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";
import { useI18n } from "@/lib/i18n";

type WarehouseOption = { id: string; name: string };
type ProductOption = { id: string; name: string; code: string };

/** Exclude Odoo promo/coupon/service lines from stock transfer pickers. */
export function isStockTransferProduct(product: ProductOption): boolean {
  const name = product.name.toLowerCase();
  const code = product.code.toUpperCase();
  if (/^\d+%\s*on\s+your\s+order/i.test(product.name)) return false;
  if (name.includes("on your order")) return false;
  if (name.includes("3rd party") || name.includes("delivery charges")) return false;
  if (/\b(10|15|20|25|30|50)%\b/.test(name) && name.includes("order")) return false;
  if (code.startsWith("DISC") || code.startsWith("CPN") || code.startsWith("PROMO")) return false;
  // Prefer real stock SKUs when present; still allow menu items without those prefixes.
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
    <div className="mb-4 grid gap-4 lg:grid-cols-2">
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
      <form onSubmit={saveWarehouse} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-bold">{en ? "New Warehouse / Branch" : "مستودع جديد"}</p>
        <div>
          <label className={labelClass}>{en ? "Name" : "الاسم"}</label>
          <input name="name" className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>{en ? "Location / Address" : "الموقع"}</label>
          <input name="location" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>{en ? "Manager / Person in Charge" : "المسؤول"}</label>
          <input name="managerName" className={fieldClass} />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input name="isDefault" type="checkbox" /> {en ? "Default Warehouse" : "مستودع افتراضي"}
        </label>
        <button className={btnPrimary} disabled={pending}>
          {en ? "Save Warehouse" : "حفظ المستودع"}
        </button>
      </form>
      <form onSubmit={transfer} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-bold">{en ? "Inter-Branch Stock Transfer" : "تحويل مخزني بين الفروع"}</p>
        <div>
          <label className={labelClass}>{en ? "From Warehouse / Branch" : "من مستودع"}</label>
          <select name="fromId" className={fieldClass} defaultValue={warehouses[0]?.id}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{en ? "To Warehouse / Branch" : "إلى مستودع"}</label>
          <select name="toId" className={fieldClass} defaultValue={warehouses[1]?.id ?? warehouses[0]?.id}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{en ? "Item" : "الصنف"}</label>
          <select name="productId" className={fieldClass}>
            {stockProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{en ? "Qty" : "الكمية"}</label>
          <input name="quantity" dir="ltr" type="number" min="0.001" step="0.001" className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>{en ? "Notes / Remarks" : "ملاحظة"}</label>
          <input name="note" className={fieldClass} />
        </div>
        <button className={btnPrimary} disabled={pending}>
          {en ? "Execute Stock Transfer" : "تنفيذ التحويل"}
        </button>
      </form>
    </div>
  );
}
