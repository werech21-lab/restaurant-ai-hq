"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Layers, PlusCircle } from "lucide-react";
import { saveOrganizationAction, setOrganizationModulesAction } from "@/app/actions/saas";
import { Alert, btnPrimary } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatPct,
  getUnavailableTooltip,
  type FormatLocale,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { moduleNavLabel } from "@/lib/i18n/auto-translate";
import { MODULES } from "@/lib/modules";

export type SaasOrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  taxRate: number | null;
  taxNumber: string;
  isDefault: boolean;
  isActive: boolean;
  ends: string | null;
  modules: string[];
};

export interface SaasPanelProps {
  organizations: SaasOrgRow[];
  moduleOptions: Array<{ key: string; label: string }>;
  canEdit: boolean;
  locale?: FormatLocale;
  loading?: boolean;
  hasError?: boolean;
}

const PLAN_LABELS: Record<string, { ar: string; en: string }> = {
  STARTER: { ar: "البداية", en: "Starter" },
  PRO: { ar: "احترافية", en: "Pro" },
  ENTERPRISE: { ar: "مؤسسات", en: "Enterprise" },
  LIFETIME: { ar: "رخصة مؤسسية دائمة", en: "Enterprise Lifetime" },
};

const INPUT_CLASS =
  "ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60";

function sanitizeSaasMessage(raw: string | undefined, isAr: boolean): string {
  const fallback = isAr
    ? "تعذّر حفظ بيانات الشركة حالياً. يرجى المحاولة مجدداً."
    : "Unable to save organization settings right now. Please try again.";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed || /https?:\/\/|Error:|at\s+\S+\s*\(|DATABASE_URL|AUTH_SECRET/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function SaasPanelBody({
  organizations,
  moduleOptions,
  canEdit,
  locale,
  loading = false,
  hasError = false,
}: Omit<SaasPanelProps, "locale"> & { locale: FormatLocale }) {
  const router = useRouter();
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const unavailableTooltip = getUnavailableTooltip(locale);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState(
    organizations.find((org) => org.isDefault)?.id ?? organizations[0]?.id ?? "",
  );
  const current = organizations.find((org) => org.id === selected);

  if (loading) {
    return <StateBlock state="loading" locale={locale} skeletonRows={4} />;
  }

  if (hasError) {
    return (
      <StateBlock
        state="error"
        locale={locale}
        title={label("تعذّر تحميل بيانات المنصة", "Unable to load platform organizations")}
        onRetry={() => router.refresh()}
      />
    );
  }

  async function createOrg(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await saveOrganizationAction({
        name: String(form.get("name") || ""),
        slug: String(form.get("slug") || ""),
        plan: String(form.get("plan") || "ENTERPRISE"),
        currency: String(form.get("currency") || "KWD"),
        taxRate: Number(form.get("taxRate") || 0),
        taxNumber: String(form.get("taxNumber") || ""),
        phone: "",
        address: "",
        invoiceFooter: "",
        isDefault: false,
        isActive: true,
        subscriptionEndsAt: String(form.get("subscriptionEndsAt") || ""),
      });
      if (!result.ok) {
        setError(sanitizeSaasMessage(result.message, isAr));
      } else {
        setMessage(label("تم حفظ الشركة بنجاح", "Organization saved successfully"));
        formElement.reset();
        router.refresh();
      }
    } catch {
      setError(sanitizeSaasMessage(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  async function saveModules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = new FormData(event.currentTarget);
    const modules = moduleOptions.map((item) => item.key).filter((key) => form.get(key) === "on");
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await setOrganizationModulesAction(current.id, modules);
      if (!result.ok) {
        setError(sanitizeSaasMessage(result.message, isAr));
      } else {
        setMessage(label("تم تحديث وحدات الباقة بنجاح", "Module configuration updated"));
        router.refresh();
      }
    } catch {
      setError(sanitizeSaasMessage(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  return (
    <div dir={dir} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}

      <SectionCard
        title={label("الشركات والكيانات المسجلة", "Registered Organizations")}
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(organizations.length, locale)}
          </span>
        }
        locale={locale}
        padded={false}
      >
        {organizations.length === 0 ? (
          <div className="p-4">
            <StateBlock
              state="empty"
              locale={locale}
              title={label("لا توجد شركات مسجلة", "No organizations registered")}
              compact
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الشركة", "Organization")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الباقة", "Plan")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("العملة", "Currency")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الضريبة", "Tax")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الحالة وتاريخ الانتهاء", "Status & Expiry (Kuwait)")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {organizations.map((org) => {
                  const planPair = PLAN_LABELS[org.plan];
                  const planLabel = planPair ? label(planPair.ar, planPair.en) : org.plan;
                  const formattedEnd = org.ends ? formatDate(org.ends, locale) : UNAVAILABLE_DASH;

                  return (
                    <tr key={org.id} className="hover:bg-[var(--ds-bg-hover)]">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="ds-focus-ring cursor-pointer rounded font-bold text-emerald-700 hover:underline dark:text-emerald-300"
                          onClick={() => setSelected(org.id)}
                        >
                          {org.name}
                        </button>
                        {org.isDefault ? (
                          <span
                            className="ms-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold"
                            style={{
                              backgroundColor: "var(--ds-positive-bg)",
                              borderColor: "var(--ds-positive-border)",
                              color: "var(--ds-positive)",
                            }}
                          >
                            {label("افتراضية", "Default")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--ds-text-secondary)]">{planLabel}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--ds-text-primary)]" dir="ltr">
                        {org.currency || UNAVAILABLE_DASH}
                      </td>
                      <td className="px-4 py-3">
                        {org.taxRate !== null && org.taxRate !== undefined ? (
                          <span dir="ltr" className="ds-num tabular-nums text-[var(--ds-text-primary)]">
                            {formatPct(org.taxRate, locale)}
                          </span>
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
                      <td className="px-4 py-3 text-[var(--ds-text-secondary)]">
                        <span>{org.isActive ? label("نشطة", "Active") : label("موقوفة", "Suspended")}</span>
                        {" · "}
                        {formattedEnd === UNAVAILABLE_DASH ? (
                          <span
                            dir="ltr"
                            title={unavailableTooltip}
                            aria-label={unavailableTooltip}
                            data-unavailable="true"
                            className="ds-num tabular-nums"
                          >
                            {UNAVAILABLE_DASH}
                          </span>
                        ) : (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formattedEnd}
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
      </SectionCard>

      {canEdit ? (
        <SectionCard
          title={label("شركة مشتركة جديدة", "Add Organization")}
          icon={<PlusCircle className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <form onSubmit={createOrg} className="grid gap-3 md:grid-cols-3">
            <input
              name="name"
              aria-label={label("اسم الشركة", "Organization Name")}
              className={INPUT_CLASS}
              placeholder={label("اسم الشركة", "Organization Name")}
              required
            />
            <input
              name="slug"
              aria-label={label("المعرّف اللاتيني", "Latin Slug")}
              className={INPUT_CLASS}
              placeholder={label("المعرّف اللاتيني", "latin-slug")}
              dir="ltr"
            />
            <select
              name="plan"
              aria-label={label("الباقة", "Plan")}
              className={INPUT_CLASS}
              defaultValue="ENTERPRISE"
            >
              <option value="STARTER">{label("البداية", "Starter")}</option>
              <option value="PRO">{label("احترافية", "Pro")}</option>
              <option value="ENTERPRISE">{label("مؤسسات", "Enterprise")}</option>
            </select>
            <select
              name="currency"
              aria-label={label("العملة", "Currency")}
              className={INPUT_CLASS}
              defaultValue="KWD"
            >
              <option value="KWD">{label("دينار كويتي (د.ك)", "Kuwaiti Dinar (KWD)")}</option>
            </select>
            <input
              name="taxRate"
              aria-label={label("نسبة الضريبة", "Tax Rate %")}
              dir="ltr"
              className={INPUT_CLASS}
              placeholder={label("نسبة الضريبة", "Tax Rate %")}
              defaultValue="0"
            />
            <input
              name="taxNumber"
              aria-label={label("الرقم الضريبي", "Tax ID")}
              className={INPUT_CLASS}
              placeholder={label("الرقم الضريبي", "Tax ID")}
            />
            <input
              name="subscriptionEndsAt"
              aria-label={label("تاريخ انتهاء الاشتراك", "Subscription End Date")}
              type="date"
              dir="ltr"
              className={INPUT_CLASS}
            />
            <div className="md:col-span-2 flex items-center">
              <button type="submit" className={`${btnPrimary} ds-focus-ring`} disabled={pending}>
                {pending
                  ? label("جارٍ الحفظ...", "Saving...")
                  : label("إضافة الشركة", "Add Organization")}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      {current && canEdit ? (
        <SectionCard
          title={label(`وحدات باقة ${current.name}`, `Modules for ${current.name}`)}
          icon={<Layers className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <form onSubmit={saveModules} className="space-y-4">
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              {moduleOptions.map((item) => {
                const modMeta = MODULES.find((m) => m.key === item.key);
                const text = isAr
                  ? item.label
                  : modMeta
                    ? moduleNavLabel("en", modMeta.labelKey)
                    : item.key;

                return (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm font-semibold text-[var(--ds-text-primary)]"
                  >
                    <input
                      type="checkbox"
                      name={item.key}
                      aria-label={text}
                      className="ds-focus-ring h-4 w-4 accent-emerald-600"
                      defaultChecked={current.modules.includes(item.key)}
                    />
                    <span>{text}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="submit" className={`${btnPrimary} ds-focus-ring`} disabled={pending}>
                {label("حفظ وحدات الباقة", "Save Package Modules")}
              </button>
              <Link
                className="ds-focus-ring rounded text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                href="/settings"
              >
                {label(
                  "إعدادات الشركة الافتراضية والعملة والفاتورة الرسمية",
                  "Default Company, Currency & Invoice Settings",
                )}
              </Link>
            </div>
          </form>
        </SectionCard>
      ) : null}
    </div>
  );
}

function SaasPanelI18n(props: Omit<SaasPanelProps, "locale">) {
  const { locale } = useI18n();
  return <SaasPanelBody {...props} locale={locale === "en" ? "en" : "ar"} />;
}

export function SaasPanel({ locale, ...rest }: SaasPanelProps) {
  if (locale !== undefined) {
    return <SaasPanelBody {...rest} locale={locale} />;
  }
  return <SaasPanelI18n {...rest} />;
}
