"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomField, removeCustomField, toggleModule } from "@/app/actions/apps";
import { Alert, btnDanger, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

type ModuleCard = { key: string; name: string; description: string; isEnabled: boolean; locked: boolean };
type FieldRow = { id: string; entityType: string; fieldName: string; fieldType: string; options: string };

const ENTITY_LABEL: Record<string, string> = {
  PRODUCT: "منتج",
  CUSTOMER: "عميل",
  SUPPLIER: "مورد",
  INVOICE: "فاتورة",
};

export function AppBuilderPanel({ modules, fields, canEdit }: { modules: ModuleCard[]; fields: FieldRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function toggle(key: string, isEnabled: boolean) {
    setPending(true);
    setError("");
    const result = await toggleModule(key, isEnabled);
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم التحديث");
      router.refresh();
    }
  }

  async function addField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await createCustomField({
      entityType: String(form.get("entityType") || ""),
      fieldName: String(form.get("fieldName") || ""),
      fieldType: String(form.get("fieldType") || ""),
      options: String(form.get("options") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تمت الإضافة");
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <section>
        <h2 className="mb-3 text-lg font-bold">وحدات النظام</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <article key={module.key} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{module.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{module.description}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-bold text-white ${module.isEnabled ? "bg-emerald-600" : "bg-slate-900"}`}>
                  {module.isEnabled ? "مفعّلة" : "معطلة"}
                </span>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={pending || (module.locked && module.isEnabled)}
                  onClick={() => toggle(module.key, !module.isEnabled)}
                >
                  {module.locked && module.isEnabled ? "وحدة أساسية" : module.isEnabled ? "تعطيل" : "تفعيل"}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-bold">حقل مخصص جديد</h2>
        {canEdit ? (
          <form onSubmit={addField} className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>الكيان</label>
              <select name="entityType" className={fieldClass} defaultValue="PRODUCT">
                <option value="PRODUCT">منتج</option>
                <option value="CUSTOMER">عميل</option>
                <option value="SUPPLIER">مورد</option>
                <option value="INVOICE">فاتورة</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>اسم الحقل</label>
              <input name="fieldName" className={fieldClass} placeholder="مثال: الرقم الضريبي" required />
            </div>
            <div>
              <label className={labelClass}>النوع</label>
              <select name="fieldType" className={fieldClass} defaultValue="TEXT">
                <option value="TEXT">نص</option>
                <option value="NUMBER">رقم</option>
                <option value="DATE">تاريخ</option>
                <option value="SELECT">قائمة</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>خيارات القائمة</label>
              <input name="options" className={fieldClass} placeholder="خيار 1, خيار 2" />
            </div>
            <button className={btnPrimary} disabled={pending}>إضافة الحقل</button>
          </form>
        ) : null}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2 text-right">الكيان</th>
              <th className="px-2 py-2 text-right">الحقل</th>
              <th className="px-2 py-2 text-right">النوع</th>
              <th className="px-2 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.id} className="border-b border-slate-200">
                <td className="px-2 py-2">{ENTITY_LABEL[field.entityType] ?? field.entityType}</td>
                <td className="px-2 py-2 font-semibold">{field.fieldName}</td>
                <td className="px-2 py-2">{field.fieldType}</td>
                <td className="px-2 py-2">
                  {canEdit ? (
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={async () => {
                        const result = await removeCustomField(field.id);
                        if (!result.ok) setError(result.message);
                        else router.refresh();
                      }}
                    >
                      حذف
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
