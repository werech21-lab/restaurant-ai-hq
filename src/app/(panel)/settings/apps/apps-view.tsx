import Image from "next/image";
import { Laptop, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import type { FormatLocale } from "@/lib/format";

export interface AppsViewProps {
  locale: FormatLocale;
  qrDataUrlValue: string | null;
  installUrl: string;
  loading?: boolean;
  hasError?: boolean;
}

export function AppsView({
  locale,
  qrDataUrlValue,
  installUrl,
  loading = false,
  hasError = false,
}: AppsViewProps) {
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
        <PageHeader
          title={label("تطبيق سطح المكتب والجوال", "Desktop & Mobile Apps")}
          description={label(
            "ثبّت AetherBI كبرنامج ويندوز أو كتطبيق على الجوال من الشاشة الرئيسية.",
            "Install AetherBI as a Windows desktop client or mobile home-screen app.",
          )}
        />
        <StateBlock
          state="error"
          locale={locale}
          title={label("تعذّر تحميل صفحة التطبيقات", "Unable to load app distribution tools")}
        />
      </div>
    );
  }

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={label("تطبيق سطح المكتب والجوال", "Desktop & Mobile Apps")}
        description={label(
          "ثبّت AetherBI كبرنامج ويندوز أو كتطبيق على الجوال من الشاشة الرئيسية.",
          "Install AetherBI as a Windows desktop client or mobile home-screen app.",
        )}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={label("نسخة سطح المكتب لويندوز", "Windows Desktop Client")}
          icon={<Laptop className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <div className="space-y-3 text-sm text-[var(--ds-text-secondary)]">
            <p className="leading-relaxed">
              {label(
                "اضغط مرتين على الملف Run-AetherBI-Desktop.bat في مجلد المشروع لفتح النظام في نافذة مستقلة.",
                "Double-click Run-AetherBI-Desktop.bat in the project directory to launch the standalone desktop window.",
              )}
            </p>
            <div className="space-y-2 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-3.5 text-xs">
              <p className="font-semibold text-[var(--ds-text-primary)]">
                {label("تشغيل بيئة Electron مباشرة:", "Run Electron directly:")}{" "}
                <code dir="ltr" className="rounded bg-[var(--ds-bg-surface)] px-1.5 py-0.5 font-mono">
                  npm run desktop:dev
                </code>
              </p>
              <p className="font-semibold text-[var(--ds-text-primary)]">
                {label("تجهيز حزمة التنصيب (.exe):", "Build Windows installer (.exe):")}{" "}
                <code dir="ltr" className="rounded bg-[var(--ds-bg-surface)] px-1.5 py-0.5 font-mono">
                  npm run desktop:build
                </code>
              </p>
            </div>
            <p className="text-xs text-[var(--ds-text-muted)]">
              {label(
                "الاختصارات داخل البرنامج: F1 فاتورة جديدة، F2 بحث صنف، Ctrl+P طباعة الإيصال.",
                "Keyboard shortcuts: F1 New Invoice, F2 Search Item, Ctrl+P Print Receipt.",
              )}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title={label("تثبيت الجوال بمسح الرمز", "Mobile Install via QR Code")}
          icon={<Smartphone className="h-4 w-4" aria-hidden />}
          locale={locale}
          headerDivider
        >
          <div className="space-y-3 text-sm text-[var(--ds-text-secondary)]">
            <p className="leading-relaxed">
              {label(
                "من أندرويد أو الكمبيوتر اضغط تثبيت التطبيق. من آيفون استخدم زر المشاركة ثم إضافة إلى الشاشة الرئيسية.",
                "On Android or Desktop, tap Install App. On iPhone, tap Share then Add to Home Screen.",
              )}
            </p>
            {qrDataUrlValue ? (
              <div className="inline-flex rounded-2xl border border-[var(--ds-border-hairline)] bg-white p-2.5 shadow-sm">
                <Image
                  src={qrDataUrlValue}
                  alt={label("رمز تثبيت AetherBI", "AetherBI mobile install QR code")}
                  width={176}
                  height={176}
                  unoptimized
                  className="h-44 w-44 rounded-lg"
                />
              </div>
            ) : (
              <StateBlock
                state="unavailable"
                locale={locale}
                title={label("رمز QR غير متاح حالياً", "Install QR code unavailable")}
                compact
              />
            )}
            <p
              className="break-all rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3 py-2 font-mono text-xs font-semibold text-[var(--ds-text-primary)]"
              dir="ltr"
            >
              {installUrl}
            </p>
            <p className="text-xs text-[var(--ds-text-muted)]">
              {label(
                "حزمة أندرويد: com.aetherbi.erp عبر capacitor.config.ts بعد أمر npx cap add android.",
                "Android bundle ID: com.aetherbi.erp via capacitor.config.ts after npx cap add android.",
              )}
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
