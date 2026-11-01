import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton, cardClass } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";
import { qrDataUrl } from "@/lib/qr";

export const metadata = { title: "تطبيقات AetherBI | نظام ERP" };

async function AppsContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") || "http";
  const installUrl = `${proto}://${host}/dashboard`;
  const qr = await qrDataUrl(installUrl);
  return (
    <div>
      <PageHeader
        title="تطبيق سطح المكتب والجوال"
        description="ثبّت AetherBI كبرنامج ويندوز أو كتطبيق على الجوال من الشاشة الرئيسية."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-bold">نسخة سطح المكتب لويندوز</h2>
          <p className="text-sm text-slate-600">اضغط مرتين على الملف Run-AetherBI-Desktop.bat في مجلد المشروع. يفتح النظام في نافذة مستقلة بلا شريط متصفح.</p>
          <p className="text-sm text-slate-700">لتشغيل Electron مباشرة: npm run desktop:dev</p>
          <p className="text-sm text-slate-700">لتجهيز ملف التنصيب exe: npm run desktop:build</p>
          <p className="text-sm text-slate-600">الاختصارات داخل البرنامج: F1 فاتورة جديدة، F2 بحث صنف، Ctrl+P طباعة الإيصال.</p>
        </section>
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-bold">تثبيت الجوال بمسح الرمز</h2>
          <p className="text-sm text-slate-600">من أندرويد أو الكمبيوتر اضغط تثبيت التطبيق. من آيفون استخدم زر المشاركة ثم إضافة إلى الشاشة الرئيسية.</p>
          <img src={qr} alt="رمز تثبيت AetherBI" className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2" />
          <p className="text-sm font-semibold" dir="ltr">{installUrl}</p>
          <p className="text-sm text-slate-600">حزمة أندرويد الجاهزة للبناء: com.aetherbi.erp عبر capacitor.config.ts بعد أمر npx cap add android.</p>
        </section>
      </div>
    </div>
  );
}

export default function AppsSettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="التطبيقات" />}>
      <AppsContent />
    </Suspense>
  );
}
