"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOrganizationAction, setOrganizationModulesAction } from "@/app/actions/saas";
import { Alert, btnPrimary, fieldClass } from "@/components/erp-ui";
import { PLAN_LABEL } from "@/lib/plans";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  taxRate: number;
  taxNumber: string;
  isDefault: boolean;
  isActive: boolean;
  ends: string;
  modules: string[];
};

export function SaasPanel({
  organizations,
  moduleOptions,
  canEdit,
}: {
  organizations: OrgRow[];
  moduleOptions: Array<{ key: string; label: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState(organizations.find((org) => org.isDefault)?.id ?? organizations[0]?.id ?? "");
  const current = organizations.find((org) => org.id === selected);

  async function createOrg(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await saveOrganizationAction({
      name: String(form.get("name") || ""),
      slug: String(form.get("slug") || ""),
      plan: String(form.get("plan") || "STARTER"),
      currency: String(form.get("currency") || "SAR"),
      taxRate: Number(form.get("taxRate") || 0),
      taxNumber: String(form.get("taxNumber") || ""),
      phone: "",
      address: "",
      invoiceFooter: "",
      isDefault: false,
      isActive: true,
      subscriptionEndsAt: String(form.get("subscriptionEndsAt") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم الحفظ");
      router.refresh();
    }
  }

  async function saveModules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = new FormData(event.currentTarget);
    const modules = moduleOptions.map((item) => item.key).filter((key) => form.get(key) === "on");
    setPending(true);
    const result = await setOrganizationModulesAction(current.id, modules);
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم التحديث");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-4 py-3 text-right">الشركة</th>
              <th className="px-4 py-3 text-right">الباقة</th>
              <th className="px-4 py-3 text-right">العملة</th>
              <th className="px-4 py-3 text-right">الضريبة</th>
              <th className="px-4 py-3 text-right">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id} className="border-b border-slate-200">
                <td className="px-4 py-3">
                  <button type="button" className="font-bold text-blue-700" onClick={() => setSelected(org.id)}>{org.name}</button>
                  {org.isDefault ? <span className="mr-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">افتراضية</span> : null}
                </td>
                <td className="px-4 py-3">{PLAN_LABEL[org.plan] ?? org.plan}</td>
                <td className="px-4 py-3" dir="ltr">{org.currency}</td>
                <td className="px-4 py-3">{org.taxRate}%</td>
                <td className="px-4 py-3">{org.isActive ? "نشطة" : "موقوفة"} · {org.ends || "بدون تاريخ"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <form onSubmit={createOrg} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <p className="font-bold md:col-span-3">شركة مشتركة جديدة</p>
          <input name="name" className={fieldClass} placeholder="اسم الشركة" required />
          <input name="slug" className={fieldClass} placeholder="المعرّف اللاتيني" dir="ltr" />
          <select name="plan" className={fieldClass} defaultValue="PRO">
            <option value="STARTER">البداية</option>
            <option value="PRO">احترافية</option>
            <option value="ENTERPRISE">مؤسسات</option>
          </select>
          <select name="currency" className={fieldClass} defaultValue="KWD">
            <option value="KWD">دينار كويتي</option>
            <option value="SAR">ريال سعودي</option>
            <option value="USD">دولار</option>
          </select>
          <input name="taxRate" dir="ltr" className={fieldClass} placeholder="نسبة الضريبة" defaultValue="0" />
          <input name="taxNumber" className={fieldClass} placeholder="الرقم الضريبي" />
          <input name="subscriptionEndsAt" type="date" className={fieldClass} />
          <button className={btnPrimary} disabled={pending}>إضافة الشركة</button>
        </form>
      ) : null}
      {current && canEdit ? (
        <form onSubmit={saveModules} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-bold">وحدات باقة {current.name}</p>
          <div className="grid gap-2 md:grid-cols-3">
            {moduleOptions.map((item) => (
              <label key={item.key} className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name={item.key} defaultChecked={current.modules.includes(item.key)} />
                {item.label}
              </label>
            ))}
          </div>
          <button className={`${btnPrimary} mt-3`} disabled={pending}>حفظ وحدات الباقة</button>
          <p className="mt-2 text-sm text-slate-600">
            <a className="font-semibold text-blue-700" href="/settings">إعدادات الشركة الافتراضية والعملة والفاتورة الرسمية</a>
          </p>
        </form>
      ) : null}
    </div>
  );
}
