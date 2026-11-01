"use client";

import { useState } from "react";
import { checkDomainAction } from "@/app/actions/notifications";
import { Alert, btnGhost, btnPrimary, cardClass } from "@/components/erp-ui";
import { ERP_ORIGIN, MARKETING_ORIGIN } from "@/lib/site";

const records = [
  { type: "CNAME", name: "erp", value: "cname.vercel-dns.com", note: "عند النشر على Vercel" },
  { type: "CNAME", name: "erp", value: "YOUR-APP.up.railway.app", note: "عند النشر على Railway، استبدل اسم التطبيق" },
  { type: "A", name: "erp", value: "YOUR_SERVER_IP", note: "عند الرفع على VPS مع ملف Nginx" },
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

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btnGhost}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
      }}
    >
      {done ? "تم النسخ" : "نسخ"}
    </button>
  );
}

export function DomainPanel() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function check() {
    setPending(true);
    setError("");
    setMessage("");
    const result = await checkDomainAction();
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(`النطاق متصل: ${result.message}`);
  }

  return (
    <div className="space-y-4">
      <section className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold">سجلات DNS لنطاق aetherbi.com</h2>
          <p className="mt-1 text-sm text-slate-600">أضف سجلاً واحداً فقط حسب مكان الاستضافة. الاسم دائماً erp.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">النوع</th>
                <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                <th className="px-4 py-3 text-right font-semibold">القيمة</th>
                <th className="px-4 py-3 text-right font-semibold">ملاحظة</th>
                <th className="px-4 py-3 text-right font-semibold">نسخ</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={`${row.type}-${row.value}`} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3 font-bold">{row.type}</td>
                  <td className="px-4 py-3" dir="ltr">{row.name}</td>
                  <td className="px-4 py-3" dir="ltr">{row.value}</td>
                  <td className="px-4 py-3 text-slate-600">{row.note}</td>
                  <td className="px-4 py-3">
                    <CopyButton value={row.value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${cardClass} space-y-3 p-5`}>
        <h2 className="font-bold">فحص حالة اتصال الدومين الحي</h2>
        <p className="text-sm text-slate-600">يطلب {ERP_ORIGIN}/api/health ويتأكد أن الربط يعمل.</p>
        <button type="button" className={btnPrimary} disabled={pending} onClick={check}>
          {pending ? "جارٍ الفحص..." : "فحص حالة اتصال الدومين الحي (Live DNS & Ping Checker)"}
        </button>
        {error ? <Alert kind="error">{error}</Alert> : null}
        {message ? <Alert kind="ok">{message}</Alert> : null}
      </section>
      <section className={`${cardClass} space-y-3 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">كود موقع {MARKETING_ORIGIN}</h2>
          <CopyButton value={embed} />
        </div>
        <p className="text-sm text-slate-600">زر الدخول العائم ونموذج يرسل العملاء المحتملين إلى CRM.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-white" dir="ltr">{embed}</pre>
      </section>
    </div>
  );
}
