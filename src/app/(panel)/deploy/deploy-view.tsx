import Link from "next/link";
import { CloudUpload, ServerCog } from "lucide-react";
import { InstallButton } from "@/app/(panel)/deploy/install-button";
import { PageHeader } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { formatInt, type FormatLocale } from "@/lib/format";

export interface DeployViewProps {
  locale: FormatLocale;
  loading?: boolean;
  hasError?: boolean;
}

const DEPLOY_STEPS = [
  {
    ar: "اضبط متغيرات بيئة التشغيل المطلوبة على الخادم الآمن قبل بدء الحاوية.",
    en: "Configure required server environment variables in your secure runtime before starting the container.",
  },
  {
    ar: "ابنِ الصورة من Dockerfile ثم شغّل الحاويات عبر docker compose up --build.",
    en: "Build the image from the Dockerfile and launch services with docker compose up --build.",
  },
  {
    ar: "افحص الجاهزية على المسار /api/health وتأكد من استجابة ok: true.",
    en: "Verify readiness at /api/health and confirm the service returns ok: true.",
  },
  {
    ar: "ثبّت الواجهة كتطبيق من manifest وservice worker عبر HTTPS أو localhost.",
    en: "Install the PWA client via manifest and service worker over HTTPS or localhost.",
  },
  {
    ar: "فعّل بوابة الدفع من إعدادات المدفوعات واترك وضع الاختبار حتى التحقق من توقيع الويب هوك الحي.",
    en: "Enable your payment gateway in Payment Settings and keep test mode active until live webhook signatures are verified.",
  },
] as const;

export function DeployView({ locale, loading = false, hasError = false }: DeployViewProps) {
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);

  if (loading) {
    return (
      <div dir={dir} className="space-y-4">
        <StateBlock state="loading" locale={locale} skeletonRows={4} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div dir={dir} className="space-y-4">
        <StateBlock
          state="error"
          locale={locale}
          title={label("تعذّر تحميل حزمة النشر", "Unable to load deployment guide")}
        />
      </div>
    );
  }

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={label("حزمة النشر السحابي", "Cloud Deployment Package")}
        description={label(
          "صورة Docker، فحص الجاهزية، وتطبيق ويب قابل للتثبيت مع حفظ التخزين التشغيلي داخل مجلد البيانات المعتمد.",
          "Docker container, health verification, and installable web client with persistent runtime storage.",
        )}
      />

      <SectionCard
        title={label("تثبيت التطبيق", "Install Application")}
        subtitle={label(
          "تثبيت سريع على أجهزة سطح المكتب والجوال عبر المتصفح.",
          "Quick browser-based install for desktop and mobile workstations.",
        )}
        icon={<CloudUpload className="h-4 w-4" aria-hidden />}
        locale={locale}
        headerDivider
      >
        <InstallButton locale={locale} />
      </SectionCard>

      <SectionCard
        title={label("خطوات التشغيل", "Deployment Steps")}
        subtitle={label(
          "دليل التشغيل والتحقق من جاهزية الخدمة بعد النشر.",
          "Step-by-step launch and post-deploy verification checklist.",
        )}
        icon={<ServerCog className="h-4 w-4" aria-hidden />}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-1 text-xs font-bold tabular-nums text-[var(--ds-text-primary)]"
          >
            {formatInt(DEPLOY_STEPS.length, locale)}
          </span>
        }
        locale={locale}
        headerDivider
      >
        <ol className="list-decimal space-y-2.5 ps-5 text-sm leading-relaxed text-[var(--ds-text-secondary)]">
          {DEPLOY_STEPS.map((step, index) => (
            <li key={index}>{isAr ? step.ar : step.en}</li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap gap-2.5 text-xs font-semibold">
          <Link
            className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3.5 py-2 text-emerald-700 transition hover:border-emerald-500/45 dark:text-emerald-300"
            href="/api/health"
          >
            {label("فحص الصحة (/api/health)", "Health Check (/api/health)")}
          </Link>
          <Link
            className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3.5 py-2 text-emerald-700 transition hover:border-emerald-500/45 dark:text-emerald-300"
            href="/settings/payments"
          >
            {label("بوابات الدفع", "Payment Gateways")}
          </Link>
          <Link
            className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3.5 py-2 text-emerald-700 transition hover:border-emerald-500/45 dark:text-emerald-300"
            href="/payments"
          >
            {label("روابط الدفع", "Payment Links")}
          </Link>
        </div>

        <pre
          dir="ltr"
          className="mt-4 overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)] bg-slate-900 p-4 text-xs text-slate-100"
        >
          {`docker compose up --build\n# health: /api/health`}
        </pre>
      </SectionCard>
    </div>
  );
}
