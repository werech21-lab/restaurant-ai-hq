"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkoutPaymentAction } from "@/app/actions/payments";
import { Alert, btnPrimary, cardClass } from "@/components/erp-ui";
import { METHOD_LABEL } from "@/lib/gateways";

export function PayCheckout({
  token,
  methods,
  isTestMode,
  providerActive,
  paid,
}: {
  token: string;
  methods: string[];
  isTestMode: boolean;
  providerActive: boolean;
  paid: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");

  async function pay(method: string) {
    setError("");
    setMessage("");
    setPending(method);
    const result = await checkoutPaymentAction(token, method);
    setPending("");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || "تم تأكيد الدفع");
    router.refresh();
  }

  if (paid) {
    return <Alert kind="ok">تم استلام المبلغ. يمكن إغلاق هذه الصفحة.</Alert>;
  }

  return (
    <div className="space-y-3">
      {isTestMode ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          وضع التجربة: التأكيد محلي ويمثّل كي نت وفيزا وأبل باي دون خصم بطاقة حقيقية، ثم يُرحَّل المبلغ إلى حساب البنك.
        </p>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          التشغيل الحي ينتظر توقيع الويب هوك من البوابة. هذه الشاشة لا تجمع بيانات البطاقة.
        </p>
      )}
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <div className={`${cardClass} grid gap-2 p-4`}>
        {methods.map((method) => (
          <button
            key={method}
            type="button"
            className={btnPrimary}
            disabled={!providerActive || pending !== ""}
            onClick={() => pay(method)}
          >
            {pending === method ? "جارٍ التأكيد..." : `ادفع عبر ${METHOD_LABEL[method] ?? method}`}
          </button>
        ))}
      </div>
    </div>
  );
}
