"use client";

import { useEffect, useState } from "react";
import { btnPrimary } from "@/components/erp-ui";

export function InstallButton() {
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

  if (installed) return <p className="text-sm font-semibold text-emerald-700">التطبيق مثبت على هذا الجهاز.</p>;
  if (!prompt) return <p className="text-sm text-slate-600">من المتصفح: تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية بعد فتح النظام عبر HTTPS أو localhost.</p>;

  return (
    <button
      type="button"
      className={btnPrimary}
      onClick={async () => {
        await prompt.prompt();
        setPrompt(null);
      }}
    >
      تثبيت التطبيق
    </button>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};
