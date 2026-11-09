"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

// Main navigation stations for mobile
const links = [
  { href: "/dashboard", ar: "الملخص", en: "Summary" },
  { href: "/erp/feryal-ai", ar: "فريال AI", en: "Feryal AI" },
  { href: "/erp/sales-scorecard", ar: "المبيعات", en: "Sales" },
  { href: "/erp/aggregator-radar", ar: "التوصيل", en: "Delivery" },
  { href: "/automations", ar: "التنبيهات", en: "Alerts" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { locale } = useI18n();
  if (pathname === "/login" || pathname === "/" || pathname === "/download" || pathname === "/home") return null;
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
        {links.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`px-1 py-3 text-center text-xs font-bold ${active ? "text-[#1E3A8A]" : "text-slate-500"}`}
            >
              {locale === "ar" ? item.ar : item.en}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
