"use client";

import { ExportCsvButton } from "@/components/ui/export-button";
import { PrintButton } from "@/components/print-button";
import { PageHeader, cardClass } from "@/components/erp-ui";
import { useI18n } from "@/lib/i18n";
import { statementText, waLink } from "@/lib/whatsapp";
import { WhatsAppButton } from "@/components/whatsapp-button";
import type { Statement } from "@/services/ledger.service";

export function StatementView({
  statement,
  kind,
  backHref,
  balanceLabel,
  hint,
}: {
  statement: Statement;
  kind: "customer" | "supplier";
  backHref: string;
  balanceLabel: string;
  hint: string;
}) {
  const { locale, money } = useI18n();
  const en = locale === "en";
  const dateLabel = (value: Date | string) =>
    new Intl.DateTimeFormat(en ? "en-US" : "ar-KW", {
      timeZone: "Asia/Kuwait",
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(value instanceof Date ? value : new Date(value));

  return (
    <div className="statement-sheet">
      <PageHeader
        title={en ? `Account statement · ${statement.name}` : `كشف حساب ${statement.name}`}
        description={hint}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <a href={backHref} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
              {en ? "Back" : "رجوع"}
            </a>
            <ExportCsvButton
              kind={kind === "customer" ? "customer-statement" : "supplier-statement"}
              filename={kind === "customer" ? "customer-statement.csv" : "supplier-statement.csv"}
              query={`id=${statement.id}`}
            />
            <PrintButton label={en ? "Print statement" : "طباعة كشف الحساب"} />
            <WhatsAppButton
              label={en ? "Send statement via WhatsApp" : "إرسال كشف الحساب عبر واتساب"}
              href={waLink(statement.phone, statementText({ name: statement.name, balance: money(statement.closingBalance) }))}
            />
          </div>
        }
      />
      <section className={`${cardClass} mb-4 grid gap-3 p-5 sm:grid-cols-4`}>
        <div>
          <p className="text-xs text-slate-500">{en ? "Name" : "الاسم"}</p>
          <p className="font-bold">{statement.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{en ? "Phone" : "الهاتف"}</p>
          <p className="font-semibold" dir="ltr">
            {statement.phone || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{en ? "Email" : "البريد"}</p>
          <p className="font-semibold" dir="ltr">
            {statement.email || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{balanceLabel}</p>
          <p className="text-lg font-bold text-blue-700">{money(statement.closingBalance)}</p>
        </div>
      </section>
      <section className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">{en ? "Date" : "التاريخ"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Description" : "البيان"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Reference" : "المرجع"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Debit" : "مدين"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Credit" : "دائن"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Balance" : "الرصيد"}</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    {en ? "No ledger movements." : "لا توجد حركات مالية."}
                  </td>
                </tr>
              ) : (
                statement.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{dateLabel(line.at)}</td>
                    <td className="px-4 py-3 font-semibold">{line.kind}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {line.reference || "—"}
                    </td>
                    <td className="px-4 py-3">{line.debit ? money(line.debit) : "—"}</td>
                    <td className="px-4 py-3">{line.credit ? money(line.credit) : "—"}</td>
                    <td className="px-4 py-3 font-bold">{money(line.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-900 font-bold">
                <td className="px-4 py-3" colSpan={3}>
                  {en ? "Total" : "الإجمالي"}
                </td>
                <td className="px-4 py-3">{money(statement.totalDebit)}</td>
                <td className="px-4 py-3">{money(statement.totalCredit)}</td>
                <td className="px-4 py-3">{money(statement.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
