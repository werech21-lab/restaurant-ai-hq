"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAutomation, toggleAutomation } from "@/app/actions/automations";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

type RuleRow = { id: string; name: string; trigger: string; action: string; supplierName: string; isActive: boolean };
type SupplierOption = { id: string; name: string };

export function AutomationsPanel({ rules, suppliers, canCreate }: { rules: RuleRow[]; suppliers: SupplierOption[]; canCreate: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await createAutomation({
      name: String(form.get("name") || ""),
      trigger: "STOCK_BELOW_REORDER",
      action: "DRAFT_PURCHASE",
      supplierId: String(form.get("supplierId") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {canCreate ? (
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>اسم القاعدة</label>
            <input name="name" className={fieldClass} placeholder="إعادة طلب عند النقص" required />
          </div>
          <div>
            <label className={labelClass}>المورد الافتراضي</label>
            <select name="supplierId" className={fieldClass} required>
              <option value="">اختر المورد</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className={btnPrimary} disabled={pending}>حفظ القاعدة</button>
          </div>
          <p className="md:col-span-3 text-sm text-slate-600">
            المحفز: نزول أي صنف تحت حد الطلب. الإجراء: إنشاء مسودة أمر شراء من المورد الافتراضي وإرسال تنبيه داخل النظام.
          </p>
        </form>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3 text-right">القاعدة</th>
              <th className="px-4 py-3 text-right">المورد</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-slate-200 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-bold">{rule.name}</p>
                  <p className="text-xs text-slate-500">مخزون تحت حد الطلب ← مسودة شراء وتنبيه</p>
                </td>
                <td className="px-4 py-3">{rule.supplierName || "—"}</td>
                <td className="px-4 py-3">{rule.isActive ? "نشطة" : "متوقفة"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                    onClick={async () => {
                      const result = await toggleAutomation(rule.id, !rule.isActive);
                      if (!result.ok) setError(result.message);
                      else router.refresh();
                    }}
                  >
                    {rule.isActive ? "إيقاف" : "تفعيل"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
