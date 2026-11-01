"use client";

import { useState } from "react";
import { btnGhost, cardClass } from "@/components/erp-ui";

const snippet = '<script src="https://erp.aetherbi.com/aetherbi-widget.js"></script>';

export function ConnectPanel({ visits, leads, domainMessage }: { visits: number; leads: number; domainMessage: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${cardClass} space-y-3 p-5`}>
        <h2 className="font-bold">كود التضمين في www.aetherbi.com</h2>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-white" dir="ltr">{snippet}</pre>
        <button
          type="button"
          className={btnGhost}
          onClick={async () => {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
          }}
        >
          {copied ? "تم النسخ" : "نسخ الكود"}
        </button>
      </section>
      <section className={`${cardClass} space-y-3 p-5`}>
        <h2 className="font-bold">حالة الاتصال والزوّار</h2>
        <p className="text-sm text-slate-700">{domainMessage}</p>
        <p className="text-sm font-semibold">زيارات الأداة: {visits}</p>
        <p className="text-sm font-semibold">عملاء محتملون من الموقع: {leads}</p>
      </section>
    </div>
  );
}
