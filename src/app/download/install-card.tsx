"use client";

import { useEffect, useState } from "react";
import { btnPrimary } from "@/components/erp-ui";

type InstallPrompt = Event & { prompt: () => Promise<void> };

export function InstallCard() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const apple = /iPad|iPhone|iPod/.test(ua);
    const nav = navigator as Navigator & { standalone?: boolean };
    setIos(apple && !nav.standalone);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="space-y-3">
      {prompt ? (
        <button type="button" className={btnPrimary} onClick={async () => { await prompt.prompt(); setPrompt(null); }}>
          تثبيت التطبيق الآن
        </button>
      ) : (
        <p className="text-sm text-slate-600">من أندرويد أو الكمبيوتر افتح الصفحة في Chrome أو Edge ثم اضغط تثبيت التطبيق عندما يظهر.</p>
      )}
      {ios ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
          على آيفون: اضغط زر المشاركة Share بالأسفل، ثم اختر Add to Home Screen إضافة إلى الشاشة الرئيسية.
        </p>
      ) : null}
    </div>
  );
}
