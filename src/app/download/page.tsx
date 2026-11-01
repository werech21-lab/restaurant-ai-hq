import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { InstallCard } from "@/app/download/install-card";
import { cardClass } from "@/components/erp-ui";
import { qrDataUrl } from "@/lib/qr";

export const metadata = { title: "مركز تحميل AetherBI ERP" };

async function DownloadContent() {
  await connection();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") || "http";
  const pageUrl = `${proto}://${host}/download`;
  const qr = await qrDataUrl(pageUrl);
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold text-blue-700">AetherBI Enterprise ERP</p>
        <h1 className="mt-2 text-3xl font-bold">مركز تحميل تطبيقات AetherBI ERP</h1>
        <p className="mt-2 text-sm text-slate-600">سطح مكتب ويندوز، تثبيت فوري للجوال والكمبيوتر، ونسخة احتياطية للمدير.</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className={`${cardClass} space-y-3 p-5`}>
            <h2 className="text-lg font-bold">نسخة سطح المكتب لـ Windows</h2>
            <p className="text-sm text-slate-600">ملف bat يفتح النظام في نافذة تطبيق مستقلة بلا قوائم المتصفح.</p>
            <a href="/api/download/windows-launcher" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
              تحميل AetherBI-ERP-Desktop.bat
            </a>
          </section>
          <section className={`${cardClass} space-y-3 p-5`}>
            <h2 className="text-lg font-bold">تثبيت فوري على الجهاز</h2>
            <InstallCard />
            <img src={qr} alt="رمز صفحة التحميل" className="h-40 w-40 rounded-xl border border-slate-200 bg-white p-2" />
            <p className="text-xs text-slate-500" dir="ltr">{pageUrl}</p>
          </section>
          <section className={`${cardClass} space-y-3 p-5`}>
            <h2 className="text-lg font-bold">نسخة المشروع والبيانات</h2>
            <p className="text-sm text-slate-600">ملف JSON يتضمن بيانات الأعمال وصيغة SQL. كلمات المرور ومفاتيح البوابات غير مشمولة. التحميل لمدير النظام بعد تسجيل الدخول.</p>
            <a href="/api/download/backup" className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              تنزيل النسخة الاحتياطية
            </a>
          </section>
        </div>
        <p className="mt-6 text-sm"><a className="font-bold text-blue-700" href="/login">دخول النظام</a></p>
      </div>
    </main>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-10 text-sm font-semibold">جارٍ تحميل مركز التحميل...</main>}>
      <DownloadContent />
    </Suspense>
  );
}
