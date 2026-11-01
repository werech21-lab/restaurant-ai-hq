"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvoicePayLinkAction, createInvoicePayLinkByNumberAction, createSubscriptionPayLinkAction } from "@/app/actions/payments";
import { Alert, btnPrimary, cardClass, fieldClass, labelClass } from "@/components/erp-ui";

export function InvoicePayLinkButton({ invoiceId, existingToken }: { invoiceId: string; existingToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(existingToken ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    setError("");
    const result = await createInvoicePayLinkAction(invoiceId);
    setPending(false);
    if (!result.ok || !result.token) {
      setError(result.ok ? "تعذر إنشاء الرابط" : result.message);
      return;
    }
    setToken(result.token);
    router.refresh();
  }

  return (
    <div>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {token ? (
        <a className="text-sm font-bold text-blue-700" href={`/pay/${token}`}>
          رابط الدفع الإلكتروني
        </a>
      ) : (
        <button type="button" className={btnPrimary} disabled={pending} onClick={create}>
          {pending ? "جارٍ التوليد..." : "توليد رابط دفع إلكتروني"}
        </button>
      )}
    </div>
  );
}

export function PaymentCreateForms({ organizations }: { organizations: Array<{ id: string; name: string }> }) {
  const router = useRouter();
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
      setError(result.ok ? "تعذر إنشاء الرابط" : result.message);
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
    const result = await createSubscriptionPayLinkAction(String(form.get("organizationId") ?? ""), Number(form.get("amount")));
    setPending(false);
    if (!result.ok || !result.token) {
      setError(result.ok ? "تعذر إنشاء الرابط" : result.message);
      return;
    }
    setLink(`/pay/${result.token}`);
    router.refresh();
  }

  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-2">
      <form onSubmit={invoice} className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-bold">رابط فاتورة مبيعات</h2>
        <label className={labelClass}>
          رقم الفاتورة
          <input name="invoiceNumber" className={fieldClass} placeholder="INV-00003" dir="ltr" required />
        </label>
        <button className={btnPrimary} disabled={pending} type="submit">
          توليد الرابط
        </button>
      </form>
      <form onSubmit={subscription} className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-bold">رابط اشتراك شركة</h2>
        <label className={labelClass}>
          الشركة
          <select name="organizationId" className={fieldClass} required>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          المبلغ
          <input name="amount" type="number" min="0.01" step="0.01" className={fieldClass} required />
        </label>
        <button className={btnPrimary} disabled={pending} type="submit">
          توليد رابط الاشتراك
        </button>
      </form>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {link ? (
        <a className="font-bold text-blue-700 lg:col-span-2" href={link}>
          فتح رابط الدفع
        </a>
      ) : null}
    </div>
  );
}
