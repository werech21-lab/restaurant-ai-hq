"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runRadarAction } from "@/app/actions/bi";
import { Alert, btnPrimary } from "@/components/erp-ui";
import { useI18n } from "@/lib/i18n";

export function RadarButton() {
  const router = useRouter();
  const { locale } = useI18n();
  const isAr = locale !== "en";
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <button
        type="button"
        className={`${btnPrimary} ds-focus-ring`}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          setMessage("");
          try {
            const result = await runRadarAction();
            if (!result.ok) {
              setError(
                isAr
                  ? "تعذّر تنفيذ الإجراء الآلي حالياً."
                  : "Unable to execute the automated action right now."
              );
              return;
            }
            setMessage(isAr ? "تم تنفيذ الإجراء الآلي بنجاح" : "Automated action executed");
            router.refresh();
          } catch {
            setError(
              isAr
                ? "تعذّر تنفيذ الإجراء الآلي حالياً."
                : "Unable to execute the automated action right now."
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending
          ? isAr
            ? "جارٍ التنفيذ..."
            : "Running..."
          : isAr
            ? "اتخاذ إجراء آلي"
            : "Run Automated Action"}
      </button>
    </div>
  );
}
