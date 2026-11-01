"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runRadarAction } from "@/app/actions/bi";
import { Alert, btnPrimary } from "@/components/erp-ui";

export function RadarButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <button
        type="button"
        className={btnPrimary}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          setMessage("");
          const result = await runRadarAction();
          setPending(false);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setMessage(result.message || "تم التنفيذ");
          router.refresh();
        }}
      >
        {pending ? "جارٍ التنفيذ..." : "اتخاذ إجراء آلي"}
      </button>
    </div>
  );
}
