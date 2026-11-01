"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/pos", label: "الكاشير" },
  { href: "/sales", label: "المبيعات" },
  { href: "/inventory", label: "المخزون" },
];

const more = [
  { href: "/purchases", label: "المشتريات" },
  { href: "/crm", label: "العملاء" },
  { href: "/accounting", label: "المحاسبة" },
  { href: "/settings/apps", label: "التطبيقات" },
  { href: "/download", label: "التحميل" },
  { href: "/bi-analytics", label: "الذكاء" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === "/login" || pathname === "/" || pathname === "/download" || pathname === "/home") return null;
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/80 md:hidden">
      {open ? (
        <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-3">
          {more.map((item) => (
            <a key={item.href} href={item.href} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-mist-100">
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-5">
        {links.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <a key={item.href} href={item.href} className={`px-1 py-3 text-center text-xs font-bold ${active ? "text-[#8cc63f]" : "text-mist-400"}`}>
              {item.label}
            </a>
          );
        })}
        <button type="button" className="px-1 py-3 text-center text-xs font-bold text-mist-400" onClick={() => setOpen((value) => !value)}>
          القائمة
        </button>
      </div>
    </nav>
  );
}
