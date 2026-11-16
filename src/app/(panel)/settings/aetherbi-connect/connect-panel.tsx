"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui";
import { formatInt, getUnavailableTooltip } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const snippet = '<script src="https://erp.aetherbi.com/aetherbi-widget.js"></script>';

export function ConnectPanel({
  visits,
  leads,
  domainMessage,
}: {
  visits: number | null;
  leads: number | null;
  domainMessage: string;
}) {
  const { locale } = useI18n();
  const resolvedLocale: "ar" | "en" = locale === "en" ? "en" : "ar";
  const isAr = resolvedLocale !== "en";
  const unavailableTooltip = getUnavailableTooltip(resolvedLocale);
  const [copied, setCopied] = useState(false);

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title={isAr ? "كود التضمين في aetherbi.com" : "aetherbi.com Embed Script"}
        locale={resolvedLocale}
      >
        <div className="space-y-3">
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-white" dir="ltr">
            {snippet}
          </pre>
          <button
            type="button"
            className="ds-focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-500/50 hover:bg-slate-50 dark:border-gold-300/25 dark:bg-ink-900/70 dark:text-mist-100 dark:hover:text-gold-300"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(snippet);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? (isAr ? "تم النسخ" : "Copied") : isAr ? "نسخ الكود" : "Copy Snippet"}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title={isAr ? "حالة الاتصال والزوّار" : "Connection & Visitor Metrics"}
        locale={resolvedLocale}
      >
        <div className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
          <p>{domainMessage}</p>
          <p className="font-semibold">
            {isAr ? "زيارات الأداة: " : "Widget visits: "}
            <span
              dir="ltr"
              title={visits === null ? unavailableTooltip : undefined}
              aria-label={visits === null ? unavailableTooltip : undefined}
              data-unavailable={visits === null ? "true" : undefined}
              className="ds-num tabular-nums"
            >
              {formatInt(visits, resolvedLocale)}
            </span>
          </p>
          <p className="font-semibold">
            {isAr ? "عملاء محتملون من الموقع: " : "Website leads: "}
            <span
              dir="ltr"
              title={leads === null ? unavailableTooltip : undefined}
              aria-label={leads === null ? unavailableTooltip : undefined}
              data-unavailable={leads === null ? "true" : undefined}
              className="ds-num tabular-nums"
            >
              {formatInt(leads, resolvedLocale)}
            </span>
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
