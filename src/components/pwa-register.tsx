"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem('pwa-install-dismissed');
        localStorage.removeItem('hide-pwa-prompt');
        localStorage.removeItem('active-scope-banner');
        localStorage.removeItem('scope-bar-collapsed');
      } catch {}
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.update().catch(() => {});
        }
      });
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          if (key !== "aetherbi-erp-v4-bust") {
            caches.delete(key).catch(() => {});
          }
        }
      });
    }
  }, []);
  return null;
}
