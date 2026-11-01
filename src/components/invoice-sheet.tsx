"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { btnGhost, btnPrimary } from "@/components/erp-ui";

export type InvoiceSheetData = {
  title: string;
  number: string;
  dateLabel: string;
  partyLabel: string;
  partyName: string;
  partyPhone: string;
  partyEmail: string;
  statusLabel: string;
  lines: Array<{ id: string; name: string; code: string; quantity: string; price: string; total: string }>;
  subtotalLabel: string;
  discountLabel: string;
  totalLabel: string;
  paidLabel: string;
  dueLabel: string;
  qrDataUrl: string;
  backHref: string;
  companyName?: string;
  companyMeta?: string;
  whatsappHref?: string;
  whatsappLabel?: string;
};

export function InvoiceSheet({ data, initialMode = "a4" }: { data: InvoiceSheetData; initialMode?: "a4" | "thermal" }) {
  const [mode, setMode] = useState<"a4" | "thermal">(initialMode);
  const thermal = mode === "thermal";

  return (
    <div>
      <style>{thermal ? "@page { size: 80mm auto; margin: 4mm; }" : "@page { size: A4; margin: 12mm; }"}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" className={mode === "a4" ? btnPrimary : btnGhost} onClick={() => setMode("a4")}>
            ورق A4
          </button>
          <button type="button" className={thermal ? btnPrimary : btnGhost} onClick={() => setMode("thermal")}>
            حراري POS
          </button>
        </div>
        <div className="flex gap-2">
          <a href={data.backHref} className={btnGhost}>
            رجوع
          </a>
          {data.whatsappHref ? (
            <a href={data.whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
              {data.whatsappLabel || "إرسال الفاتورة عبر واتساب"}
            </a>
          ) : null}
          <button type="button" className={btnPrimary} onClick={() => window.print()}>
            <Printer size={16} />
            طباعة
          </button>
        </div>
      </div>
      <article
        className={`print-sheet mx-auto border border-slate-200 bg-white p-6 text-slate-900 shadow-sm ${thermal ? "print-thermal max-w-[80mm]" : "print-a4 max-w-[210mm]"}`}
      >
        <header className={`flex items-start justify-between gap-4 border-b border-slate-900 pb-4 ${thermal ? "flex-col" : ""}`}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/venture-foods-logo.svg" alt="Venture Foods" className="h-12 w-auto object-contain" />
            <div>
              <p className="text-lg font-bold">{data.companyName || "شركة فنتشر فودز لإدارة المطاعم ذ.م.م."}</p>
              <p className="text-xs font-semibold text-slate-700">VENTURE FOODS · KUWAIT · د.ك</p>
              <p className="text-xs text-slate-600">{data.companyMeta || "AetherBI Enterprise ERP"}</p>
            </div>
          </div>
          <div className={thermal ? "" : "text-left"}>
            <p className="text-sm text-slate-500">{data.title}</p>
            <p className="text-xl font-bold" dir="ltr">
              {data.number}
            </p>
            <p className="text-sm">{data.dateLabel}</p>
          </div>
        </header>
        <section className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
          <p className="text-xs text-slate-500">{data.partyLabel}</p>
          <p className="font-bold">{data.partyName}</p>
          <p dir="ltr">{data.partyPhone || "—"}</p>
          <p dir="ltr">{data.partyEmail || "—"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">الحالة: {data.statusLabel}</p>
        </section>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-900 text-slate-600">
              <th className="py-2 text-right font-semibold">الصنف</th>
              {thermal ? null : <th className="py-2 text-right font-semibold">الرمز</th>}
              <th className="py-2 text-right font-semibold">الكمية</th>
              <th className="py-2 text-right font-semibold">السعر</th>
              <th className="py-2 text-right font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-200">
                <td className="py-2 font-semibold">
                  {line.name}
                  {thermal ? (
                    <span className="mt-0.5 block text-xs text-slate-500" dir="ltr">
                      {line.code}
                    </span>
                  ) : null}
                </td>
                {thermal ? null : (
                  <td className="py-2" dir="ltr">
                    {line.code}
                  </td>
                )}
                <td className="py-2">{line.quantity}</td>
                <td className="py-2">{line.price}</td>
                <td className="py-2 font-semibold">{line.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={`mt-4 flex gap-4 ${thermal ? "flex-col" : "items-end justify-between"}`}>
          <div className="text-center">
            <img src={data.qrDataUrl} alt="رمز QR تجريبي للفاتورة" className="mx-auto h-28 w-28" />
            <p className="text-xs text-slate-500">رمز QR تجريبي</p>
          </div>
          <dl className="min-w-48 space-y-1 text-sm">
            <div className="flex justify-between gap-6">
              <dt>المجموع</dt>
              <dd className="font-semibold">{data.subtotalLabel}</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt>الخصم</dt>
              <dd className="font-semibold">{data.discountLabel}</dd>
            </div>
            <div className="flex justify-between gap-6 border-t border-slate-900 pt-1 text-base">
              <dt className="font-bold">الصافي</dt>
              <dd className="font-bold">{data.totalLabel}</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt>المدفوع</dt>
              <dd className="font-semibold">{data.paidLabel}</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt>المتبقي</dt>
              <dd className="font-bold text-blue-700">{data.dueLabel}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-6 border-t border-slate-200 pt-3 text-center text-xs text-slate-500">AetherBI Enterprise ERP · شكراً لتعاملكم</p>
      </article>
    </div>
  );
}
