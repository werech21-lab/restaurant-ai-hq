"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { btnPrimary } from "@/components/erp-ui";
import type { FormatLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export interface InstallButtonProps {
  locale?: FormatLocale;
}

function InstallButtonBody({ locale }: { locale: FormatLocale }) {
  const isAr = locale !== "en";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p
        role="status"
        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {label("التطبيق مثبت على هذا الجهاز.", "Application is installed on this device.")}
        </span>
      </p>
    );
  }

  if (!prompt) {
    return (
      <p className="text-sm leading-relaxed text-[var(--ds-text-secondary)]">
        {label(
          "من المتصفح: اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية بعد فتح النظام عبر HTTPS أو localhost.",
          "From your browser menu, choose Install App or Add to Home Screen over HTTPS or localhost.",
        )}
      </p>
    );
  }

  return (
    <button
      type="button"
      aria-label={label("تثبيت التطبيق", "Install Application")}
      className={`${btnPrimary} ds-focus-ring`}
      onClick={async () => {
        await prompt.prompt();
        setPrompt(null);
      }}
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label("تثبيت التطبيق", "Install Application")}</span>
    </button>
  );
}

function InstallButtonI18n() {
  const { locale } = useI18n();
  return <InstallButtonBody locale={locale === "en" ? "en" : "ar"} />;
}

export function InstallButton({ locale }: InstallButtonProps) {
  if (locale !== undefined) {
    return <InstallButtonBody locale={locale} />;
  }
  return <InstallButtonI18n />;
}
