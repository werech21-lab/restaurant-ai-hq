import { Suspense } from "react";
import { connection } from "next/server";
import { InstallButton } from "@/app/(panel)/deploy/install-button";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton, cardClass } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "النشر السحابي | نظام ERP" };

const steps = [
  "انسخ env.sample إلى بيئة التشغيل واضبط AUTH_SECRET بطول كافٍ وDATABASE_URL.",
  "ابنِ الصورة من Dockerfile ثم شغّل docker compose up --build.",
  "افحص الجاهزية على /api/health ويجب أن تعيد ok: true.",
  "ثبّت الواجهة كتطبيق من manifest وservice worker على HTTPS أو localhost.",
  "فعّل بوابة الدفع من إعدادات المدفوعات، واترك وضع التجربة حتى يصل توقيع الويب هوك الحي.",
];

async function DeployContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "saas", "view") && !can(user, "payments", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  return (
    <div>
      <PageHeader
        title="حزمة النشر السحابي"
        description="صورة Docker، فحص الصحة، وتطبيق ويب قابل للتثبيت. البيانات التجريبية تبقى على SQLite داخل حجم التخزين."
      />
      <section className={`${cardClass} mb-4 p-5`}>
        <h2 className="font-bold">تثبيت التطبيق</h2>
        <div className="mt-3">
          <InstallButton />
        </div>
      </section>
      <section className={`${cardClass} p-5`}>
        <h2 className="mb-3 font-bold">خطوات التشغيل</h2>
        <ol className="list-decimal space-y-2 pr-5 text-sm text-slate-700">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
          <a className="text-blue-700" href="/api/health">
            فحص الصحة
          </a>
          <a className="text-blue-700" href="/settings/payments">
            بوابات الدفع
          </a>
          <a className="text-blue-700" href="/payments">
            روابط الدفع
          </a>
        </div>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-white" dir="ltr">
{`docker compose up --build
# health: http://localhost:3000/api/health`}
        </pre>
      </section>
    </div>
  );
}

export default function DeployPage() {
  return (
    <Suspense fallback={<PageSkeleton title="النشر" />}>
      <DeployContent />
    </Suspense>
  );
}
