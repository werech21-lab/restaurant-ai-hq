"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWarehouseAction, transferStockAction } from "@/app/actions/warehouses";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

type WarehouseOption = { id: string; name: string };
type ProductOption = { id: string; name: string; code: string };

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
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
      setMessage(result.message || "تم الحفظ");
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
      setMessage(result.message || "تم التحويل");
      router.refresh();
    }
  }

  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-2">
      {error ? <div className="lg:col-span-2"><Alert kind="error">{error}</Alert></div> : null}
      {message ? <div className="lg:col-span-2"><Alert kind="ok">{message}</Alert></div> : null}
      <form onSubmit={saveWarehouse} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-bold">مستودع جديد</p>
        <div>
          <label className={labelClass}>الاسم</label>
          <input name="name" className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>الموقع</label>
          <input name="location" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>المسؤول</label>
          <input name="managerName" className={fieldClass} />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input name="isDefault" type="checkbox" /> مستودع افتراضي
        </label>
        <button className={btnPrimary} disabled={pending}>حفظ المستودع</button>
      </form>
      <form onSubmit={transfer} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-bold">تحويل مخزني بين الفروع</p>
        <div>
          <label className={labelClass}>من مستودع</label>
          <select name="fromId" className={fieldClass} defaultValue={warehouses[0]?.id}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>إلى مستودع</label>
          <select name="toId" className={fieldClass} defaultValue={warehouses[1]?.id ?? warehouses[0]?.id}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>الصنف</label>
          <select name="productId" className={fieldClass}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} ({product.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>الكمية</label>
          <input name="quantity" dir="ltr" type="number" min="0.001" step="0.001" className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>ملاحظة</label>
          <input name="note" className={fieldClass} />
        </div>
        <button className={btnPrimary} disabled={pending}>تنفيذ التحويل</button>
      </form>
    </div>
  );
}
