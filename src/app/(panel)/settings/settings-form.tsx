"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCompanySettingsAction } from "@/app/actions/saas";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

export function SettingsForm({
  initial,
}: {
  initial: {
    name: string;
    currency: string;
    taxRate: number;
    taxNumber: string;
    phone: string;
    address: string;
    invoiceFooter: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await saveCompanySettingsAction({
      name: String(form.get("name") || ""),
      currency: String(form.get("currency") || "SAR"),
      taxRate: Number(form.get("taxRate") || 0),
      taxNumber: String(form.get("taxNumber") || ""),
      phone: String(form.get("phone") || ""),
      address: String(form.get("address") || ""),
      invoiceFooter: String(form.get("invoiceFooter") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم الحفظ");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <div>
        <label className={labelClass}>اسم الشركة على الفاتورة</label>
        <input name="name" defaultValue={initial.name} className={fieldClass} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>العملة</label>
          <select name="currency" defaultValue={initial.currency} className={fieldClass}>
            <option value="SAR">ريال سعودي (ر.س)</option>
            <option value="KWD">دينار كويتي (د.ك)</option>
            <option value="USD">دولار ($)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>نسبة الضريبة %</label>
          <input name="taxRate" dir="ltr" defaultValue={initial.taxRate} className={fieldClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>الرقم الضريبي</label>
        <input name="taxNumber" defaultValue={initial.taxNumber} className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>الهاتف</label>
        <input name="phone" defaultValue={initial.phone} className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>العنوان</label>
        <input name="address" defaultValue={initial.address} className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>تذييل الفاتورة الرسمية</label>
        <input name="invoiceFooter" defaultValue={initial.invoiceFooter} className={fieldClass} />
      </div>
      <button className={btnPrimary} disabled={pending}>{pending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button>
    </form>
  );
}
