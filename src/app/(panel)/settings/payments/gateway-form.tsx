"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveGatewayAction } from "@/app/actions/payments";
import { Alert, btnPrimary, cardClass, fieldClass, labelClass } from "@/components/erp-ui";
import { METHOD_LABEL, PAYMENT_METHODS, PROVIDER_LABEL } from "@/lib/gateways";

export function GatewayForm({
  provider,
  maskedKey,
  maskedSecret,
  isTestMode,
  isActive,
  methods,
  canEdit,
}: {
  provider: string;
  maskedKey: string;
  maskedSecret: string;
  isTestMode: boolean;
  isActive: boolean;
  methods: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    const result = await saveGatewayAction({
      provider,
      apiKey: String(form.get("apiKey") ?? ""),
      webhookSecret: String(form.get("webhookSecret") ?? ""),
      isTestMode: form.get("isTestMode") === "on",
      isActive: form.get("isActive") === "on",
      supportedMethods: PAYMENT_METHODS.filter((method) => form.get(`method_${method}`) === "on"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || "تم الحفظ");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={`${cardClass} space-y-3 p-4`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-900">{PROVIDER_LABEL[provider] ?? provider}</h2>
        <span className="text-xs font-semibold text-slate-500" dir="ltr">
          {provider}
        </span>
      </div>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <label className={labelClass}>
        مفتاح API
        <input name="apiKey" className={fieldClass} placeholder={maskedKey || "مفتاح التجربة"} autoComplete="off" disabled={!canEdit} />
      </label>
      <label className={labelClass}>
        سر الويب هوك
        <input name="webhookSecret" className={fieldClass} placeholder={maskedSecret || "سر التوقيع"} autoComplete="off" disabled={!canEdit} />
      </label>
      <p className="text-xs text-slate-500">اترك الحقل فارغاً للإبقاء على القيمة المحفوظة. المفتاح الكامل لا يُعرض مرة أخرى.</p>
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={isActive} disabled={!canEdit} />
          مفعّلة
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isTestMode" defaultChecked={isTestMode} disabled={!canEdit} />
          وضع التجربة
        </label>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {PAYMENT_METHODS.map((method) => (
          <label key={method} className="flex items-center gap-2 font-semibold">
            <input type="checkbox" name={`method_${method}`} defaultChecked={methods.includes(method)} disabled={!canEdit} />
            {METHOD_LABEL[method]}
          </label>
        ))}
      </div>
      {canEdit ? (
        <button className={btnPrimary} disabled={pending} type="submit">
          {pending ? "جارٍ الحفظ..." : "حفظ البوابة"}
        </button>
      ) : null}
    </form>
  );
}
