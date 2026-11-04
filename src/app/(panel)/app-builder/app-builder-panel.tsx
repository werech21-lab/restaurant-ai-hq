"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomField, removeCustomField, toggleModule } from "@/app/actions/apps";
import { Alert, btnDanger, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

type ModuleCard = { key: string; name: string; description: string; isEnabled: boolean; locked: boolean };
type FieldRow = { id: string; entityType: string; fieldName: string; fieldType: string; options: string };

const ENTITY_LABEL: Record<string, string> = {
  PRODUCT: "المنتجات والأصناف",
  CUSTOMER: "العملاء والشركات",
  SUPPLIER: "الموردون والشركاء",
  INVOICE: "الفواتير وسندات الصرف",
};

const FIELD_TYPE_LABEL: Record<string, string> = {
  TEXT: "نص عادي",
  NUMBER: "رقم عددي",
  DATE: "تاريخ معتمد",
  SELECT: "قائمة اختيارات",
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
      setMessage(result.message || "تم تحديث حالة الوحدة بنجاح");
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
      setMessage(result.message || "تمت إضافة الحقل المخصص بنجاح");
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      
      {/* 1. Modules Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-mist-100">وحدات وتطبيقات النظام التشغيلية</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <article
              key={module.key}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-gold-300/15 bg-white dark:bg-ink-900/80 p-5 shadow-[var(--shadow-card)]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900 dark:text-mist-100">{module.name}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-mist-400">{module.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white ${
                      module.isEnabled ? "bg-emerald-600" : "bg-slate-700"
                    }`}
                  >
                    {module.isEnabled ? "مفعّلة" : "معطلة"}
                  </span>
                </div>
              </div>
              {canEdit ? (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                    disabled={pending || (module.locked && module.isEnabled)}
                    onClick={() => toggle(module.key, !module.isEnabled)}
                  >
                    {module.locked && module.isEnabled
                      ? "وحدة أساسية معتمدة"
                      : module.isEnabled
                      ? "تعطيل الوحدة"
                      : "تفعيل الوحدة"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {/* 2. Custom Fields Builder Section */}
      <section className="w-full max-w-none rounded-2xl border border-slate-200 dark:border-gold-300/15 bg-white dark:bg-ink-900/80 p-5 shadow-[var(--shadow-card)] space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-mist-100">إضافة حقل مخصص جديد للنظام</h2>
        {canEdit ? (
          <form onSubmit={addField} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>الكيان المستهدف</label>
              <select name="entityType" className={fieldClass} defaultValue="PRODUCT">
                <option value="PRODUCT">المنتجات والأصناف</option>
                <option value="CUSTOMER">العملاء والشركات</option>
                <option value="SUPPLIER">الموردون والشركاء</option>
                <option value="INVOICE">الفواتير وسندات الصرف</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>اسم الحقل المخصص</label>
              <input
                name="fieldName"
                className={fieldClass}
                placeholder="مثال: الرقم الضريبي / الرمز الجمركي"
                required
              />
            </div>
            <div>
              <label className={labelClass}>نوع البيانات</label>
              <select name="fieldType" className={fieldClass} defaultValue="TEXT">
                <option value="TEXT">نص عادي</option>
                <option value="NUMBER">رقم عددي</option>
                <option value="DATE">تاريخ معتمد</option>
                <option value="SELECT">قائمة اختيارات متعددة</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>خيارات القائمة (مفصولة بفواصل في حال اختيار قائمة)</label>
              <input name="options" className={fieldClass} placeholder="خيار 1، خيار 2، خيار 3" />
            </div>
            <div className="md:col-span-2">
              <button className={btnPrimary} disabled={pending}>
                {pending ? "جارٍ حفظ الحقل..." : "إضافة الحقل المخصص"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="pt-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-mist-100 mb-3">الحقول المخصصة الحالية</h3>
          {fields.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-mist-400">
              لا توجد حقول مخصصة مضافة حالياً.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-mist-400">
                    <th className="px-4 py-3 text-right font-semibold">الكيان المستهدف</th>
                    <th className="px-4 py-3 text-right font-semibold">اسم الحقل المخصص</th>
                    <th className="px-4 py-3 text-right font-semibold">نوع البيانات</th>
                    <th className="px-4 py-3 text-right font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10 text-slate-900 dark:text-mist-200">
                  {fields.map((field) => (
                    <tr key={field.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-mist-100">{ENTITY_LABEL[field.entityType] ?? field.entityType}</td>
                      <td className="px-4 py-3 font-semibold text-amber-700 dark:text-gold-300">{field.fieldName}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-mist-200">{FIELD_TYPE_LABEL[field.fieldType] ?? field.fieldType}</td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <button
                            type="button"
                            className={btnDanger}
                            onClick={async () => {
                              if (!confirm(`هل أنت متأكد من حذف الحقل "${field.fieldName}"؟`)) return;
                              const result = await removeCustomField(field.id);
                              if (!result.ok) setError(result.message);
                              else router.refresh();
                            }}
                          >
                            حذف الحقل
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
