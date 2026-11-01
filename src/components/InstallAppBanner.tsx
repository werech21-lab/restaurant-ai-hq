"use client";

import { useEffect, useState } from "react";
import { btnPrimary } from "@/components/erp-ui";

type InstallPrompt = Event & { prompt: () => Promise<void> };

function isIos() {
  const ua = navigator.userAgent;
  const apple = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
  return apple && !standalone;
}

export function InstallAppBanner() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("aetherbi-install-hidden") === "1") setHidden(true);
    setIos(isIos());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || (!prompt && !ios)) return null;

  function dismiss() {
    sessionStorage.setItem("aetherbi-install-hidden", "1");
    setHidden(true);
  }

  return (
    <div className="no-print border-b border-slate-200 bg-white px-4 py-3 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        {ios ? (
          <p className="text-sm font-semibold text-slate-800">
            لتثبيت التطبيق على آيفون: اضغط زر المشاركة Share بالأسفل ثم اختر إضافة إلى الشاشة الرئيسية Add to Home Screen.
          </p>
        ) : (
          <p className="text-sm font-semibold text-slate-800">ثبّت AetherBI ERP على هذا الجهاز من غير متجر.</p>
        )}
        <div className="flex gap-2">
          {prompt ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={async () => {
                await prompt.prompt();
                setPrompt(null);
              }}
            >
              تثبيت التطبيق على الجهاز (Install App)
            </button>
          ) : null}
          <button type="button" className="text-sm font-semibold text-slate-500" onClick={dismiss}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
