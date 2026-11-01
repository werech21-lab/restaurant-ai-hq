import { ExportCsvButton } from "@/components/ui/export-button";
import { PrintButton } from "@/components/print-button";
import { PageHeader, cardClass } from "@/components/erp-ui";
import { formatDate, formatMoney } from "@/lib/format";
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
  return (
    <div className="statement-sheet">
      <PageHeader
        title={`كشف حساب ${statement.name}`}
        description={hint}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <a href={backHref} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
              رجوع
            </a>
            <ExportCsvButton
              kind={kind === "customer" ? "customer-statement" : "supplier-statement"}
              filename={kind === "customer" ? "customer-statement.csv" : "supplier-statement.csv"}
              query={`id=${statement.id}`}
            />
            <PrintButton label="طباعة كشف الحساب" />
            <WhatsAppButton
              label="إرسال كشف الحساب عبر واتساب"
              href={waLink(statement.phone, statementText({ name: statement.name, balance: formatMoney(statement.closingBalance) }))}
            />
          </div>
        }
      />
      <section className={`${cardClass} mb-4 grid gap-3 p-5 sm:grid-cols-4`}>
        <div>
          <p className="text-xs text-slate-500">الاسم</p>
          <p className="font-bold">{statement.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">الهاتف</p>
          <p className="font-semibold" dir="ltr">
            {statement.phone || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">البريد</p>
          <p className="font-semibold" dir="ltr">
            {statement.email || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{balanceLabel}</p>
          <p className="text-lg font-bold text-blue-700">{formatMoney(statement.closingBalance)}</p>
        </div>
      </section>
      <section className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">البيان</th>
                <th className="px-4 py-3 text-right font-semibold">المرجع</th>
                <th className="px-4 py-3 text-right font-semibold">مدين</th>
                <th className="px-4 py-3 text-right font-semibold">دائن</th>
                <th className="px-4 py-3 text-right font-semibold">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {statement.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    لا توجد حركات مالية.
                  </td>
                </tr>
              ) : (
                statement.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(line.at)}</td>
                    <td className="px-4 py-3 font-semibold">{line.kind}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {line.reference || "—"}
                    </td>
                    <td className="px-4 py-3">{line.debit ? formatMoney(line.debit) : "—"}</td>
                    <td className="px-4 py-3">{line.credit ? formatMoney(line.credit) : "—"}</td>
                    <td className="px-4 py-3 font-bold">{formatMoney(line.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-900 font-bold">
                <td className="px-4 py-3" colSpan={3}>
                  الإجمالي
                </td>
                <td className="px-4 py-3">{formatMoney(statement.totalDebit)}</td>
                <td className="px-4 py-3">{formatMoney(statement.totalCredit)}</td>
                <td className="px-4 py-3">{formatMoney(statement.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
