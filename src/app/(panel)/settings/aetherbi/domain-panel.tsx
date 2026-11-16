"use client";

import { useState } from "react";
import { checkDomainAction } from "@/app/actions/notifications";
import { Alert, btnPrimary } from "@/components/erp-ui";
import { SectionCard } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { ERP_ORIGIN, MARKETING_ORIGIN } from "@/lib/site";

const records = [
  {
    type: "CNAME",
    name: "erp",
    value: "cname.vercel-dns.com",
    noteAr: "عند النشر على Vercel",
    noteEn: "When hosting on Vercel",
  },
  {
    type: "CNAME",
    name: "erp",
    value: "YOUR-APP.up.railway.app",
    noteAr: "عند النشر على Railway، استبدل اسم التطبيق",
    noteEn: "When hosting on Railway, replace app subdomain",
  },
  {
    type: "A",
    name: "erp",
    value: "YOUR_SERVER_IP",
    noteAr: "عند الرفع على VPS مع ملف Nginx",
    noteEn: "When hosting on a VPS behind Nginx",
  },
];

const embed = `<a href="${ERP_ORIGIN}/login" style="position:fixed;top:16px;left:16px;z-index:50;background:#2563eb;color:#fff;padding:12px 16px;border-radius:12px;font-weight:700;text-decoration:none">الدخول إلى نظام AetherBI ERP</a>
<form id="aetherbi-lead">
  <input name="contactName" placeholder="الاسم" required />
  <input name="phone" placeholder="الهاتف" required />
  <input name="email" placeholder="البريد" />
  <input name="title" placeholder="الاهتمام" />
  <button type="submit">إرسال</button>
</form>
<script>
document.getElementById("aetherbi-lead").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(event.target));
  const response = await fetch("${ERP_ORIGIN}/api/public/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  event.target.innerHTML = response.ok ? "تم استلام طلبكم" : "تعذر الإرسال";
});
</script>`;

function CopyButton({ value, isAr }: { value: string; isAr: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ds-focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-500/50 hover:bg-slate-50 dark:border-gold-300/25 dark:bg-ink-900/70 dark:text-mist-100 dark:hover:text-gold-300"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? (isAr ? "تم النسخ" : "Copied") : isAr ? "نسخ" : "Copy"}
    </button>
  );
}

export function DomainPanel() {
  const { locale } = useI18n();
  const resolvedLocale: "ar" | "en" = locale === "en" ? "en" : "ar";
  const isAr = resolvedLocale !== "en";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function check() {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await checkDomainAction();
      if (!result.ok) {
        setError(
          isAr
            ? "النطاق غير متصل بعد أو الشهادة غير جاهزة."
            : "Domain is not connected yet or TLS certificate is pending."
        );
        return;
      }
      setMessage(
        isAr
          ? "النطاق متصل ويستجيب لفحص الصحة بنجاح."
          : "Domain is connected and responding to health check."
      );
    } catch {
      setError(
        isAr
          ? "تعذّر التحقق من حالة النطاق حالياً."
          : "Unable to verify domain connectivity right now."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="space-y-4">
      <SectionCard
        title={isAr ? "سجلات DNS لنطاق aetherbi.com" : "DNS Records for aetherbi.com"}
        subtitle={
          isAr
            ? "أضف سجلاً واحداً فقط حسب مكان الاستضافة. الاسم دائماً erp."
            : "Configure one record matching your hosting provider. Host is always erp."
        }
        locale={resolvedLocale}
        headerDivider
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
                <th className="px-4 py-3 text-start">{isAr ? "النوع" : "Type"}</th>
                <th className="px-4 py-3 text-start">{isAr ? "الاسم" : "Host"}</th>
                <th className="px-4 py-3 text-start">{isAr ? "القيمة" : "Value"}</th>
                <th className="px-4 py-3 text-start">{isAr ? "ملاحظة" : "Note"}</th>
                <th className="px-4 py-3 text-start">{isAr ? "نسخ" : "Copy"}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={`${row.type}-${row.value}`} className="border-b border-slate-200/80 last:border-0 dark:border-white/10">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.type}</td>
                  <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200" dir="ltr">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200" dir="ltr">{row.value}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{isAr ? row.noteAr : row.noteEn}</td>
                  <td className="px-4 py-3">
                    <CopyButton value={row.value} isAr={isAr} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title={isAr ? "فحص حالة اتصال الدومين" : "Domain Connectivity Check"}
        subtitle={
          isAr
            ? `يطلب ${ERP_ORIGIN}/api/health ويتأكد أن الربط يعمل.`
            : `Requests ${ERP_ORIGIN}/api/health and verifies connectivity.`
        }
        locale={resolvedLocale}
      >
        <div className="space-y-3">
          <button
            type="button"
            className={`${btnPrimary} ds-focus-ring`}
            disabled={pending}
            onClick={() => void check()}
          >
            {pending
              ? isAr
                ? "جارٍ الفحص..."
                : "Checking..."
              : isAr
                ? "فحص حالة اتصال الدومين (DNS & Ping Checker)"
                : "Check Domain Health (DNS & Ping)"}
          </button>
          {error ? <Alert kind="error">{error}</Alert> : null}
          {message ? <Alert kind="ok">{message}</Alert> : null}
        </div>
      </SectionCard>

      <SectionCard
        title={isAr ? `كود موقع ${MARKETING_ORIGIN}` : `${MARKETING_ORIGIN} Embed Code`}
        subtitle={
          isAr
            ? "زر الدخول العائم ونموذج يرسل العملاء المحتملين إلى CRM."
            : "Floating login button and lead capture form connected to CRM."
        }
        actions={<CopyButton value={embed} isAr={isAr} />}
        locale={resolvedLocale}
      >
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-white" dir="ltr">
          {embed}
        </pre>
      </SectionCard>
    </div>
  );
}
