"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { saveGatewayAction } from "@/app/actions/payments";
import { Alert, btnPrimary } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { UNAVAILABLE_DASH, getUnavailableTooltip, type FormatLocale } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/gateways";
import { useI18n } from "@/lib/i18n";

export interface GatewayFormProps {
  provider: string;
  maskedKey: string;
  maskedSecret: string;
  isTestMode: boolean;
  isActive: boolean;
  methods: string[];
  canEdit: boolean;
  locale?: FormatLocale;
  loading?: boolean;
  hasError?: boolean;
}

const PROVIDER_LABELS: Record<string, { ar: string; en: string }> = {
  MYFATOORAH: { ar: "ماي فاتورة", en: "MyFatoorah" },
  STRIPE: { ar: "سترايب", en: "Stripe" },
  TAP: { ar: "تاب", en: "Tap Payments" },
};

const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  KNET: { ar: "كي نت", en: "KNET" },
  VISA_MASTER: { ar: "فيزا / ماستركارد", en: "Visa / Mastercard" },
  APPLE_PAY: { ar: "أبل باي", en: "Apple Pay" },
};

const INPUT_CLASS =
  "ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const LABEL_CLASS = "block text-xs font-semibold text-[var(--ds-text-secondary)]";

function sanitizeGatewayMsg(raw: string | undefined, isAr: boolean): string {
  const fallback = isAr
    ? "تعذّر حفظ إعدادات بوابة الدفع حالياً. يرجى المحاولة مجدداً."
    : "Unable to save payment gateway settings right now. Please try again.";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    /https?:\/\/|Error:|at\s+\S+\s*\(|sk_live|sk_test|Bearer|DATABASE_URL|AUTH_SECRET/i.test(
      trimmed,
    )
  ) {
    return fallback;
  }
  return trimmed;
}

function GatewayFormBody({
  provider,
  maskedKey,
  maskedSecret,
  isTestMode,
  isActive,
  methods,
  canEdit,
  locale,
  loading = false,
  hasError = false,
}: Omit<GatewayFormProps, "locale"> & { locale: FormatLocale }) {
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
        title={label("تعذّر تحميل بيانات البوابة", "Unable to load payment gateway")}
        onRetry={() => router.refresh()}
      />
    );
  }

  const providerPair = PROVIDER_LABELS[provider];
  const providerTitle = providerPair ? label(providerPair.ar, providerPair.en) : provider;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await saveGatewayAction({
        provider,
        apiKey: String(form.get("apiKey") ?? ""),
        webhookSecret: String(form.get("webhookSecret") ?? ""),
        isTestMode: form.get("isTestMode") === "on",
        isActive: form.get("isActive") === "on",
        supportedMethods: PAYMENT_METHODS.filter(
          (method) => form.get(`method_${method}`) === "on",
        ),
      });
      if (!result.ok) {
        setError(sanitizeGatewayMsg(result.message, isAr));
        return;
      }
      setMessage(
        isAr
          ? result.message || "تم حفظ إعدادات البوابة"
          : "Gateway settings saved successfully",
      );
      router.refresh();
    } catch {
      setError(sanitizeGatewayMsg(undefined, isAr));
    } finally {
      setPending(false);
    }
  }

  return (
    <SectionCard
      locale={locale}
      title={providerTitle}
      subtitle={
        <span dir="ltr" className="font-mono text-xs">
          {provider}
        </span>
      }
      icon={<CreditCard className="h-4 w-4" aria-hidden />}
      actions={
        <span
          className="rounded-full border px-2.5 py-0.5 text-xs font-bold"
          style={
            isActive
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
          {isActive ? label("مفعّلة", "Active") : label("غير مفعّلة", "Inactive")}
        </span>
      }
      headerDivider
    >
      <form dir={dir} onSubmit={onSubmit} className="space-y-3.5">
        {error ? <Alert kind="error">{error}</Alert> : null}
        {message ? <Alert kind="ok">{message}</Alert> : null}

        <div>
          <label htmlFor={`gw-key-${provider}`} className={LABEL_CLASS}>
            {label("مفتاح API", "API Secret Key")}
          </label>
          <input
            id={`gw-key-${provider}`}
            type="password"
            name="apiKey"
            aria-label={label(`مفتاح API لـ ${providerTitle}`, `${providerTitle} API Key`)}
            className={INPUT_CLASS}
            dir="ltr"
            placeholder={maskedKey || label("أدخل المفتاح السري", "Enter secret key")}
            autoComplete="off"
            disabled={!canEdit}
          />
          <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
            {label("الحالة:", "Stored:")}{" "}
            {maskedKey ? (
              <span dir="ltr" className="font-mono font-semibold">
                {maskedKey}
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
          </p>
        </div>

        <div>
          <label htmlFor={`gw-secret-${provider}`} className={LABEL_CLASS}>
            {label("سر الويب هوك (Webhook Secret)", "Webhook Signing Secret")}
          </label>
          <input
            id={`gw-secret-${provider}`}
            type="password"
            name="webhookSecret"
            aria-label={label(`سر الويب هوك لـ ${providerTitle}`, `${providerTitle} Webhook Secret`)}
            className={INPUT_CLASS}
            dir="ltr"
            placeholder={maskedSecret || label("أدخل سر التوقيع", "Enter signing secret")}
            autoComplete="off"
            disabled={!canEdit}
          />
          <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
            {label("التوقيع:", "Stored:")}{" "}
            {maskedSecret ? (
              <span dir="ltr" className="font-mono font-semibold">
                {maskedSecret}
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
          </p>
        </div>

        <p className="text-xs leading-relaxed text-[var(--ds-text-muted)]">
          {label(
            "اترك الحقل فارغاً للإبقاء على القيمة المحفوظة. المفاتيح السرية لا تُعرض أبداً بعد الحفظ.",
            "Leave fields blank to keep existing stored credentials. Secret values are never exposed again.",
          )}
        </p>

        <div className="flex flex-wrap gap-4 text-xs font-semibold text-[var(--ds-text-primary)]">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="isActive"
              aria-label={label("تفعيل البوابة", `Enable ${providerTitle}`)}
              className="ds-focus-ring h-4 w-4 accent-emerald-600"
              defaultChecked={isActive}
              disabled={!canEdit}
            />
            <span>{label("مفعّلة", "Enabled")}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="isTestMode"
              aria-label={label("وضع التجربة", `${providerTitle} Test Mode`)}
              className="ds-focus-ring h-4 w-4 accent-emerald-600"
              defaultChecked={isTestMode}
              disabled={!canEdit}
            />
            <span>{label("وضع التجربة", "Test Mode")}</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-[var(--ds-text-primary)]">
          {PAYMENT_METHODS.map((method) => {
            const methodPair = METHOD_LABELS[method];
            const methodLabel = methodPair ? label(methodPair.ar, methodPair.en) : method;
            return (
              <label key={method} className="flex cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  name={`method_${method}`}
                  aria-label={methodLabel}
                  className="ds-focus-ring h-4 w-4 accent-emerald-600"
                  defaultChecked={methods.includes(method)}
                  disabled={!canEdit}
                />
                <span>{methodLabel}</span>
              </label>
            );
          })}
        </div>

        {canEdit ? (
          <button className={`${btnPrimary} ds-focus-ring w-full sm:w-auto`} disabled={pending} type="submit">
            {pending ? label("جارٍ الحفظ...", "Saving...") : label("حفظ البوابة", "Save Gateway")}
          </button>
        ) : null}
      </form>
    </SectionCard>
  );
}

function GatewayFormI18n(props: Omit<GatewayFormProps, "locale">) {
  const { locale } = useI18n();
  return <GatewayFormBody {...props} locale={locale === "en" ? "en" : "ar"} />;
}

export function GatewayForm({ locale, ...rest }: GatewayFormProps) {
  if (locale !== undefined) {
    return <GatewayFormBody {...rest} locale={locale} />;
  }
  return <GatewayFormI18n {...rest} />;
}
