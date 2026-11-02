"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type AlertItem = {
  id: string;
  name: string;
  code: string;
  stockLabel: string;
  reorderLabel: string;
};

export function NotificationBell({
  count,
  items,
  notices = [],
}: {
  count: number;
  items: AlertItem[];
  notices?: Array<{ id: string; title: string; body: string; href: string }>;
}) {
  const [open, setOpen] = useState(false);
  const { locale } = useI18n();
  const en = locale === "en";

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-800"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={en ? "Inventory alerts" : "تنبيهات المخزون"}
      >
        <Bell size={18} />
        {count > 0 ? (
          <span className="absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="font-bold text-slate-900">{en ? "Items below reorder" : "أصناف تحت حد الطلب"}</p>
            <p className="text-xs text-slate-500">
              {count === 0
                ? en
                  ? "No alerts"
                  : "لا توجد تنبيهات"
                : en
                  ? `${count} item(s) need reorder`
                  : `${count} صنفاً يحتاج إعادة طلب`}
            </p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-600">
              {en ? "Stock is above reorder levels." : "المخزون فوق حد الطلب."}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="border-b border-slate-200 last:border-0">
                  <a href={`/inventory?filter=low_stock&q=${encodeURIComponent(item.code)}`} className="block px-4 py-3 hover:bg-slate-50">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500" dir="ltr">
                      {item.code}
                    </p>
                    <p className="mt-1 text-sm font-bold text-red-600">
                      {item.stockLabel} / {en ? "ROP" : "حد"} {item.reorderLabel}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a href="/inventory?filter=low_stock" className="block border-t border-slate-200 px-4 py-3 text-center text-sm font-semibold text-blue-700">
            {en ? "View all shortages" : "عرض كل النواقص"}
          </a>
          {notices.length > 0 ? (
            <div className="border-t border-slate-200">
              <p className="px-4 py-2 text-xs font-bold text-slate-500">{en ? "Automation alerts" : "تنبيهات الأتمتة"}</p>
              <ul>
                {notices.map((notice) => (
                  <li key={notice.id} className="border-t border-slate-200">
                    <a href={notice.href} className="block px-4 py-3 hover:bg-slate-50">
                      <p className="font-semibold text-slate-900">{notice.title}</p>
                      <p className="text-sm text-slate-600">{notice.body}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
