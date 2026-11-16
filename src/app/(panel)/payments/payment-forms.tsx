"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvoicePayLinkAction, createInvoicePayLinkByNumberAction, createSubscriptionPayLinkAction } from "@/app/actions/payments";
import { Alert, btnPrimary, labelClass } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";

const inputCls =
  "ds-surface-subtle ds-focus-ring mt-1 w-full rounded-xl px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]";

export function InvoicePayLinkButton({
  invoiceId,
  existingToken,
  locale = "ar",
}: {
  invoiceId: string;
  existingToken?: string;
  locale?: "ar" | "en";
}) {
  const router = useRouter();
  const isAr = locale !== "en";
  const [token, setToken] = useState(existingToken ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    setError("");
    const result = await createInvoicePayLinkAction(invoiceId);
    setPending(false);
    if (!result.ok || !result.token) {
      setError(result.ok ? (isAr ? "تعذر إنشاء الرابط" : "Unable to generate link") : result.message);
      return;
    }
    setToken(result.token);
    router.refresh();
  }

  return (
    <div>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {token ? (
        <a
          className="ds-focus-ring text-sm font-bold hover:underline"
          style={{ color: "var(--ds-accent)" }}
          href={`/pay/${token}`}
        >
          {isAr ? "رابط الدفع الإلكتروني" : "Online payment link"}
        </a>
      ) : (
        <button type="button" className={`${btnPrimary} ds-focus-ring min-h-10`} disabled={pending} onClick={create}>
          {pending
            ? isAr
              ? "جارٍ التوليد..."
              : "Generating..."
            : isAr
              ? "توليد رابط دفع إلكتروني"
              : "Generate payment link"}
        </button>
      )}
    </div>
  );
}

export function PaymentsEmptyBlock({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const isAr = locale !== "en";
  return (
    <StateBlock
      state="empty"
      locale={isAr ? "ar" : "en"}
      title={isAr ? "لا توجد روابط دفع بعد" : "No payment links yet"}
      description={
        isAr
          ? "أنشئ رابط دفع لفاتورة مبيعات أو اشتراك شركة باستخدام النماذج أعلاه."
          : "Create a payment link for a sales invoice or organization subscription using the forms above."
      }
    />
  );
}

export function PaymentCreateForms({
  organizations,
  locale = "ar",
}: {
  organizations: Array<{ id: string; name: string }>;
  locale?: "ar" | "en";
}) {
  const router = useRouter();
  const isAr = locale !== "en";
  const resolvedLocale = isAr ? "ar" : "en";
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);

  async function invoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = String(new FormData(event.currentTarget).get("invoiceNumber") ?? "");
    setPending(true);
    setError("");
    const result = await createInvoicePayLinkByNumberAction(number.trim());
    setPending(false);
    if (!result.ok || !result.token) {
      setError(result.ok ? (isAr ? "تعذر إنشاء الرابط" : "Unable to generate link") : result.message);
      return;
    }
    setLink(`/pay/${result.token}`);
    router.refresh();
  }

  async function subscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await createSubscriptionPayLinkAction(
      String(form.get("organizationId") ?? ""),
      Number(form.get("amount")),
    );
    setPending(false);
    if (!result.ok || !result.token) {
      setError(result.ok ? (isAr ? "تعذر إنشاء الرابط" : "Unable to generate link") : result.message);
      return;
    }
    setLink(`/pay/${result.token}`);
    router.refresh();
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="mb-5 grid gap-4 lg:grid-cols-2">
      <SectionCard locale={resolvedLocale} title={isAr ? "رابط فاتورة مبيعات" : "Sales invoice payment link"}>
        <form onSubmit={invoice} className="space-y-3">
          <label className={labelClass}>
            {isAr ? "رقم الفاتورة" : "Invoice number"}
            <input name="invoiceNumber" className={inputCls} placeholder="INV-00003" dir="ltr" required />
          </label>
          <button className={`${btnPrimary} ds-focus-ring min-h-10`} disabled={pending} type="submit">
            {isAr ? "توليد الرابط" : "Generate link"}
          </button>
        </form>
      </SectionCard>

      <SectionCard locale={resolvedLocale} title={isAr ? "رابط اشتراك شركة" : "Organization subscription link"}>
        <form onSubmit={subscription} className="space-y-3">
          <label className={labelClass}>
            {isAr ? "الشركة" : "Organization"}
            <select name="organizationId" className={inputCls} required>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {isAr ? "المبلغ (د.ك)" : "Amount (KWD)"}
            <input
              name="amount"
              type="number"
              dir="ltr"
              min="0.001"
              step="0.001"
              placeholder="0.000"
              className={inputCls}
              required
            />
          </label>
          <button className={`${btnPrimary} ds-focus-ring min-h-10`} disabled={pending} type="submit">
            {isAr ? "توليد رابط الاشتراك" : "Generate subscription link"}
          </button>
        </form>
      </SectionCard>

      {error ? (
        <div className="lg:col-span-2">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      {link ? (
        <a
          className="ds-focus-ring font-bold hover:underline lg:col-span-2"
          style={{ color: "var(--ds-accent)" }}
          href={link}
        >
          {isAr ? "فتح رابط الدفع" : "Open payment link"}
        </a>
      ) : null}
    </div>
  );
}
