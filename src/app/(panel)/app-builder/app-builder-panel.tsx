"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, PlusCircle, Trash2 } from "lucide-react";
import { createCustomField, removeCustomField, toggleModule } from "@/app/actions/apps";
import { Alert, btnPrimary } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { UNAVAILABLE_DASH, formatInt, getUnavailableTooltip, type FormatLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { moduleNavLabel } from "@/lib/i18n/auto-translate";
import { MODULES } from "@/lib/modules";

export type AppBuilderModuleCard = {
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  locked: boolean;
};

export type AppBuilderFieldRow = {
  id: string;
  entityType: string;
  fieldName: string;
  fieldType: string;
  options: string;
};

export interface AppBuilderPanelProps {
  modules: AppBuilderModuleCard[];
  fields: AppBuilderFieldRow[];
  canEdit: boolean;
  locale?: FormatLocale;
  loading?: boolean;
  hasError?: boolean;
}

const ENTITY_LABELS: Record<string, { ar: string; en: string }> = {
  PRODUCT: { ar: "المنتجات والأصناف", en: "Products & Items" },
  CUSTOMER: { ar: "العملاء والشركات", en: "Customers & Accounts" },
  SUPPLIER: { ar: "الموردون والشركاء", en: "Suppliers & Partners" },
  INVOICE: { ar: "الفواتير وسندات الصرف", en: "Invoices & Vouchers" },
};

const FIELD_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  TEXT: { ar: "نص", en: "Text" },
  NUMBER: { ar: "رقم عددي", en: "Number" },
  DATE: { ar: "تاريخ", en: "Date" },
  SELECT: { ar: "قائمة اختيارات", en: "Select list" },
};

const INPUT_CLASS =
  "ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const LABEL_CLASS = "mb-1.5 block text-xs font-semibold text-[var(--ds-text-secondary)]";

function sanitizeActionMessage(raw: string | undefined, isAr: boolean): string {
  const fallback = isAr
    ? "تعذّر تنفيذ العملية حالياً. يرجى المحاولة مجدداً."
    : "Unable to complete the operation right now. Please try again.";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (/https?:\/\/|ODOO_|AUTH_SECRET|DATABASE_URL|Error:|at\s+\S+\s*\(/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function AppBuilderPanelBody({
  modules,
  fields,
  canEdit,
  locale,
  loading = false,
  hasError = false,
}: Omit<AppBuilderPanelProps, "locale"> & { locale: FormatLocale }) {
  const router = useRouter();
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const unavailableTooltip = getUnavailableTooltip(locale);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (loading) {
    return <StateBlock state="loading" locale={locale} skeletonRows={4} />;
  }

  if (hasError) {
    return (
      <StateBlock
        state="error"
        locale={locale}
        title={label("تعذّر تحميل إعدادات التطبيقات", "Unable to load App Builder configuration")}
        description={label(
          "حدث خلل مؤقت أثناء قراءة الوحدات والحقول المخصصة.",
          "A temporary issue occurred while reading system modules and custom fields.",
        )}
        onRetry={() => router.refresh()}
      />
    );
  }

  async function toggle(key: string, isEnabled: boolean) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await toggleModule(key, isEnabled);
      if (!result.ok) {
        setError(sanitizeActionMessage(result.message, isAr));
      } else {
        setMessage(
          isAr
            ? result.message || "تم تحديث حالة الوحدة بنجاح"
            : "Module status updated successfully",
        );
        router.refresh();
      }
    } catch {
      setError(sanitizeActionMessage(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  async function addField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await createCustomField({
        entityType: String(form.get("entityType") || ""),
        fieldName: String(form.get("fieldName") || ""),
        fieldType: String(form.get("fieldType") || ""),
        options: String(form.get("options") || ""),
      });
      if (!result.ok) {
        setError(sanitizeActionMessage(result.message, isAr));
      } else {
        setMessage(
          isAr
            ? result.message || "تمت إضافة الحقل المخصص بنجاح"
            : "Custom field added successfully",
        );
        formElement.reset();
        router.refresh();
      }
    } catch {
      setError(sanitizeActionMessage(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteField(id: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await removeCustomField(id);
      setConfirmDeleteId(null);
      if (!result.ok) {
        setError(sanitizeActionMessage(result.message, isAr));
      } else {
        setMessage(isAr ? "تم حذف الحقل المخصص" : "Custom field removed");
        router.refresh();
      }
    } catch {
      setError(sanitizeActionMessage(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  const enabledCount = modules.filter((m) => m.isEnabled).length;

  return (
    <div dir={dir} className="w-full max-w-none space-y-6">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}

      <SectionCard
        title={label("وحدات وتطبيقات النظام التشغيلية", "Operational System Modules")}
        subtitle={label(
          "تحكم في الوحدات الظاهرة ضمن لوحة التحكم. الوحدات الأساسية تبقى مفعّلة دائماً.",
          "Control which modules appear across the workspace. Core system modules remain locked on.",
        )}
        icon={<Layers className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(enabledCount, locale)} / {formatInt(modules.length, locale)}
          </span>
        }
        locale={locale}
        headerDivider
      >
        {modules.length === 0 ? (
          <StateBlock
            state="empty"
            locale={locale}
            title={label("لا توجد وحدات مسجلة", "No system modules found")}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => {
              const modMeta = MODULES.find((item) => item.key === module.key);
              const displayName = isAr
                ? module.name
                : modMeta
                  ? moduleNavLabel("en", modMeta.labelKey)
                  : module.key;
              const displayDesc = isAr
                ? module.description
                : modMeta
                  ? `${moduleNavLabel("en", modMeta.labelKey)} module`
                  : module.key;

              return (
                <article
                  key={module.key}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--ds-text-primary)] break-words">
                          {displayName}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--ds-text-muted)] break-words">
                          {displayDesc}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold"
                        style={
                          module.isEnabled
                            ? {
                                backgroundColor: "var(--ds-positive-bg)",
                                borderColor: "var(--ds-positive-border)",
                                color: "var(--ds-positive)",
                              }
                            : {
                                backgroundColor: "var(--ds-unavailable-bg)",
                                borderColor: "var(--ds-unavailable-border)",
                                color: "var(--ds-text-secondary)",
                              }
                        }
                      >
                        {module.isEnabled
                          ? label("مفعّلة", "Enabled")
                          : label("معطلة", "Disabled")}
                      </span>
                    </div>
                  </div>
                  {canEdit ? (
                    <div className="mt-4 border-t border-[var(--ds-border-hairline)] pt-3">
                      <button
                        type="button"
                        aria-label={`${displayName} — ${
                          module.locked && module.isEnabled
                            ? label("وحدة أساسية معتمدة", "Core locked module")
                            : module.isEnabled
                              ? label("تعطيل الوحدة", "Disable module")
                              : label("تفعيل الوحدة", "Enable module")
                        }`}
                        className={`ds-focus-ring rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                          module.locked && module.isEnabled
                            ? "cursor-not-allowed border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-surface)] text-[var(--ds-text-muted)]"
                            : module.isEnabled
                              ? "btn-colored cursor-pointer bg-rose-600 text-white hover:bg-rose-700"
                              : "btn-colored cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                        disabled={pending || (module.locked && module.isEnabled)}
                        onClick={() => void toggle(module.key, !module.isEnabled)}
                      >
                        {module.locked && module.isEnabled
                          ? label("وحدة أساسية معتمدة", "Core Locked Module")
                          : module.isEnabled
                            ? label("تعطيل الوحدة", "Disable Module")
                            : label("تفعيل الوحدة", "Enable Module")}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={label("إضافة حقل مخصص جديد للنظام", "Add Custom Field")}
        subtitle={label(
          "أضف حقولاً مخصصة للمنتجات أو العملاء أو الموردين أو الفواتير دون تعديل قاعدة البيانات.",
          "Define dynamic fields for products, customers, suppliers, or invoices.",
        )}
        icon={<PlusCircle className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(fields.length, locale)}
          </span>
        }
        locale={locale}
        headerDivider
      >
        {canEdit ? (
          <form onSubmit={addField} className="mb-6 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="ab-entity" className={LABEL_CLASS}>
                {label("الكيان المستهدف", "Target Entity")}
              </label>
              <select
                id="ab-entity"
                name="entityType"
                aria-label={label("الكيان المستهدف", "Target Entity")}
                className={INPUT_CLASS}
                defaultValue="PRODUCT"
              >
                <option value="PRODUCT">{label("المنتجات والأصناف", "Products & Items")}</option>
                <option value="CUSTOMER">{label("العملاء والشركات", "Customers & Accounts")}</option>
                <option value="SUPPLIER">{label("الموردون والشركاء", "Suppliers & Partners")}</option>
                <option value="INVOICE">{label("الفواتير وسندات الصرف", "Invoices & Vouchers")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="ab-name" className={LABEL_CLASS}>
                {label("اسم الحقل المخصص", "Field Name")}
              </label>
              <input
                id="ab-name"
                name="fieldName"
                aria-label={label("اسم الحقل المخصص", "Field Name")}
                className={INPUT_CLASS}
                placeholder={label("مثال: الرقم الضريبي / الرمز الجمركي", "e.g. Tax Code / Customs ID")}
                required
              />
            </div>
            <div>
              <label htmlFor="ab-type" className={LABEL_CLASS}>
                {label("نوع البيانات", "Data Type")}
              </label>
              <select
                id="ab-type"
                name="fieldType"
                aria-label={label("نوع البيانات", "Data Type")}
                className={INPUT_CLASS}
                defaultValue="TEXT"
              >
                <option value="TEXT">{label("نص عادي", "Text")}</option>
                <option value="NUMBER">{label("رقم عددي", "Number")}</option>
                <option value="DATE">{label("تاريخ معتمد", "Date")}</option>
                <option value="SELECT">{label("قائمة اختيارات متعددة", "Select List")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="ab-options" className={LABEL_CLASS}>
                {label(
                  "خيارات القائمة (مفصولة بفواصل في حال اختيار قائمة)",
                  "List Options (comma-separated for Select type)",
                )}
              </label>
              <input
                id="ab-options"
                name="options"
                aria-label={label("خيارات القائمة", "List Options")}
                className={INPUT_CLASS}
                placeholder={label("خيار 1، خيار 2، خيار 3", "Option 1, Option 2, Option 3")}
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className={`${btnPrimary} ds-focus-ring`} disabled={pending}>
                {pending
                  ? label("جارٍ حفظ الحقل...", "Saving field...")
                  : label("إضافة الحقل المخصص", "Add Custom Field")}
              </button>
            </div>
          </form>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)]">
            {label("الحقول المخصصة الحالية", "Configured Custom Fields")}
          </h3>
          {fields.length === 0 ? (
            <StateBlock
              state="empty"
              locale={locale}
              title={label("لا توجد حقول مخصصة مضافة حالياً", "No custom fields configured yet")}
              description={label(
                "أضف حقلاً مخصصاً من النموذج أعلاه ليظهر مباشرة في الجداول والنماذج.",
                "Add a custom field using the form above to surface it across forms and tables.",
              )}
              compact
            />
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("الكيان المستهدف", "Target Entity")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("اسم الحقل المخصص", "Field Name")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("نوع البيانات", "Data Type")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("الخيارات", "Options")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                      {label("الإجراءات", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {fields.map((field) => {
                    const entityPair = ENTITY_LABELS[field.entityType];
                    const typePair = FIELD_TYPE_LABELS[field.fieldType.toUpperCase()];
                    const entityText = entityPair
                      ? label(entityPair.ar, entityPair.en)
                      : field.entityType;
                    const typeText = typePair
                      ? label(typePair.ar, typePair.en)
                      : field.fieldType;
                    const isConfirming = confirmDeleteId === field.id;

                    return (
                      <tr key={field.id} className="hover:bg-[var(--ds-bg-hover)]">
                        <td className="px-4 py-3 font-semibold text-[var(--ds-text-primary)]">
                          {entityText}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--ds-accent)]">
                          {field.fieldName}
                        </td>
                        <td className="px-4 py-3 text-[var(--ds-text-secondary)]">{typeText}</td>
                        <td className="px-4 py-3 text-xs text-[var(--ds-text-muted)]">
                          {field.options ? (
                            field.options
                          ) : (
                            <span
                              dir="ltr"
                              title={unavailableTooltip}
                              aria-label={unavailableTooltip}
                              data-unavailable="true"
                              className="ds-num tabular-nums"
                            >
                              {UNAVAILABLE_DASH}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            isConfirming ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => void handleDeleteField(field.id)}
                                  aria-label={label(`تأكيد حذف ${field.fieldName}`, `Confirm delete ${field.fieldName}`)}
                                  className="btn-colored ds-focus-ring cursor-pointer rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {label("تأكيد الحذف", "Confirm Delete")}
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="ds-focus-ring cursor-pointer rounded-lg border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)]"
                                >
                                  {label("إلغاء", "Cancel")}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={pending}
                                aria-label={label(`حذف الحقل ${field.fieldName}`, `Delete field ${field.fieldName}`)}
                                onClick={() => setConfirmDeleteId(field.id)}
                                className="ds-focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                <span>{label("حذف الحقل", "Delete")}</span>
                              </button>
                            )
                          ) : (
                            <span
                              dir="ltr"
                              title={unavailableTooltip}
                              aria-label={unavailableTooltip}
                              data-unavailable="true"
                            >
                              {UNAVAILABLE_DASH}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function AppBuilderPanelI18n(props: Omit<AppBuilderPanelProps, "locale">) {
  const { locale } = useI18n();
  return <AppBuilderPanelBody {...props} locale={locale === "en" ? "en" : "ar"} />;
}

export function AppBuilderPanel({ locale, ...rest }: AppBuilderPanelProps) {
  if (locale !== undefined) {
    return <AppBuilderPanelBody {...rest} locale={locale} />;
  }
  return <AppBuilderPanelI18n {...rest} />;
}
