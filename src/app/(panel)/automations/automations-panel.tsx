"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Workflow } from "lucide-react";
import { createAutomation, toggleAutomation } from "@/app/actions/automations";
import { Alert, btnPrimary } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { UNAVAILABLE_DASH, formatInt, getUnavailableTooltip, type FormatLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export type AutomationRuleRow = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  supplierName: string;
  isActive: boolean;
};

export type AutomationSupplierOption = {
  id: string;
  name: string;
};

export interface AutomationsPanelProps {
  rules: AutomationRuleRow[];
  suppliers: AutomationSupplierOption[];
  canCreate: boolean;
  locale?: FormatLocale;
  loading?: boolean;
  hasError?: boolean;
}

const INPUT_CLASS =
  "ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const LABEL_CLASS = "mb-1.5 block text-xs font-semibold text-[var(--ds-text-secondary)]";

function sanitizeMessage(raw: string | undefined, isAr: boolean): string {
  const fallback = isAr
    ? "تعذّر حفظ قاعدة الأتمتة حالياً. يرجى المحاولة مجدداً."
    : "Unable to save automation rule right now. Please try again.";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed || /https?:\/\/|Error:|at\s+\S+\s*\(|DATABASE_URL|AUTH_SECRET/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function AutomationsPanelBody({
  rules,
  suppliers,
  canCreate,
  locale,
  loading = false,
  hasError = false,
}: Omit<AutomationsPanelProps, "locale"> & { locale: FormatLocale }) {
  const router = useRouter();
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const unavailableTooltip = getUnavailableTooltip(locale);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (loading) {
    return <StateBlock state="loading" locale={locale} skeletonRows={4} />;
  }

  if (hasError) {
    return (
      <StateBlock
        state="error"
        locale={locale}
        title={label("تعذّر تحميل قواعد الأتمتة", "Unable to load automation rules")}
        onRetry={() => router.refresh()}
      />
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await createAutomation({
        name: String(form.get("name") || ""),
        trigger: "STOCK_BELOW_REORDER",
        action: "DRAFT_PURCHASE",
        supplierId: String(form.get("supplierId") || ""),
      });
      if (!result.ok) {
        setError(sanitizeMessage(result.message, isAr));
      } else {
        setMessage(label("تم حفظ القاعدة بنجاح", "Rule saved successfully"));
        formElement.reset();
        router.refresh();
      }
    } catch {
      setError(sanitizeMessage(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  async function handleToggle(rule: AutomationRuleRow) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await toggleAutomation(rule.id, !rule.isActive);
      if (!result.ok) {
        setError(sanitizeMessage(result.message, isAr));
      } else {
        setMessage(label("تم تحديث حالة القاعدة", "Rule status updated"));
        router.refresh();
      }
    } catch {
      setError(sanitizeMessage(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  return (
    <div dir={dir} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}

      {canCreate ? (
        <SectionCard
          title={label("إنشاء قاعدة إعادة طلب", "Create Reorder Automation Rule")}
          subtitle={label(
            "المحفز: نزول أي صنف تحت حد الطلب. الإجراء: إنشاء مسودة أمر شراء من المورد الافتراضي وإرسال تنبيه داخل النظام.",
            "Trigger: item falls below reorder level. Action: draft a purchase order for the default supplier and emit an internal alert.",
          )}
          icon={<Workflow className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="auto-rule-name" className={LABEL_CLASS}>
                {label("اسم القاعدة", "Rule Name")}
              </label>
              <input
                id="auto-rule-name"
                name="name"
                aria-label={label("اسم القاعدة", "Rule Name")}
                className={INPUT_CLASS}
                placeholder={label("إعادة طلب عند النقص", "Reorder below threshold")}
                required
              />
            </div>
            <div>
              <label htmlFor="auto-rule-supplier" className={LABEL_CLASS}>
                {label("المورد الافتراضي", "Default Supplier")}
              </label>
              <select
                id="auto-rule-supplier"
                name="supplierId"
                aria-label={label("المورد الافتراضي", "Default Supplier")}
                className={INPUT_CLASS}
                required
              >
                <option value="">{label("اختر المورد", "Select supplier")}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className={`${btnPrimary} ds-focus-ring w-full md:w-auto`} disabled={pending}>
                {pending ? label("جارٍ الحفظ...", "Saving...") : label("حفظ القاعدة", "Save Rule")}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        title={label("القواعد المسجلة", "Configured Rules")}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(rules.length, locale)}
          </span>
        }
        locale={locale}
        padded={false}
      >
        {rules.length === 0 ? (
          <div className="p-4">
            <StateBlock
              state="empty"
              locale={locale}
              title={label("لا توجد قواعد أتمتة مسجلة", "No automation rules configured")}
              description={label(
                "أنشئ قاعدة إعادة طلب أعلاه أو استخدم قواعد الحوكمة المباشرة.",
                "Create a reorder rule above or configure live governance thresholds.",
              )}
              compact
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("القاعدة", "Rule")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("المورد", "Supplier")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الحالة", "Status")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الإجراء", "Action")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-4 py-3">
                      <p className="font-bold text-[var(--ds-text-primary)]">{rule.name}</p>
                      <p className="text-xs text-[var(--ds-text-muted)]">
                        {label(
                          "مخزون تحت حد الطلب ← مسودة شراء وتنبيه",
                          "Stock below reorder → Draft PO & alert",
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[var(--ds-text-secondary)]">
                      {rule.supplierName || (
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
                      <span
                        className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold"
                        style={
                          rule.isActive
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
                        {rule.isActive ? label("نشطة", "Active") : label("متوقفة", "Paused")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`${rule.name} — ${rule.isActive ? label("إيقاف", "Pause") : label("تفعيل", "Enable")}`}
                        className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)] disabled:opacity-50"
                        onClick={() => void handleToggle(rule)}
                      >
                        {rule.isActive ? label("إيقاف", "Pause") : label("تفعيل", "Enable")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function AutomationsPanelI18n(props: Omit<AutomationsPanelProps, "locale">) {
  const { locale } = useI18n();
  return <AutomationsPanelBody {...props} locale={locale === "en" ? "en" : "ar"} />;
}

export function AutomationsPanel({ locale, ...rest }: AutomationsPanelProps) {
  if (locale !== undefined) {
    return <AutomationsPanelBody {...rest} locale={locale} />;
  }
  return <AutomationsPanelI18n {...rest} />;
}
