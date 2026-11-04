import { Suspense } from "react";
import { connection } from "next/server";
import { ManualJournalForm } from "@/app/(panel)/accounting/journal-form";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { accountTypeLabel } from "@/lib/i18n/auto-translate";
import { getLocale, moneyFor, dateFor, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getActiveScope } from "@/lib/scope";
import { chartOfAccounts, listJournals, trialBalance } from "@/services/accounting.service";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";
import { VentureAccountingHub } from "@/components/accounting/VentureAccountingHub";

export const metadata = {
  title: "المحاسبة والشجرة المالية | شركة فنتشر فودز ذ.م.م.",
  description: "مركز القيادة المالي ومراكز تكلفة البراندات والفروع لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function AccountingContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "accounting", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("accounting"))) {
    return <DisabledModule title={tx(locale, "المحاسبة", "Accounting")} />;
  }
  const query = await readQuery(searchParams);
  const scope = await getActiveScope(query);
  const tabs = [
    { key: "chart", label: tx(locale, "شجرة الحسابات", "Chart of accounts") },
    { key: "journals", label: tx(locale, "قيود اليومية", "Journal entries") },
    { key: "trial", label: tx(locale, "ميزان المراجعة", "Trial balance") },
    { key: "entry", label: tx(locale, "قيد يدوي", "Manual entry") },
  ];
  const tab = tabs.some((item) => item.key === query.tab) ? query.tab : "chart";
  const [accounts, trial, journals] = await Promise.all([
    chartOfAccounts(),
    trialBalance(),
    listJournals((query.page - 1) * PAGE_SIZE, PAGE_SIZE, query.q),
  ]);
  const balanced = Math.abs(trial.debit - trial.credit) < 0.02;

  const legacyLiveChildren = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <h4 className="text-sm font-bold text-emerald-400">
          {tx(locale, "سجلات وقيود الأستاذ العام في قاعدة البيانات (Prisma DB)", "Prisma Database Ledger & Trial Balance")}
        </h4>
        <div className="flex gap-2">
          <SmartIngestLaunchButton module="accounting" locale={locale} />
          <a
            href="/accounting/reconciliation"
            className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-300"
          >
            {tx(locale, "⚡ مطابقة NBK + طلبات", "⚡ NBK Recon")}
          </a>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <a
            key={item.key}
            href={pageHref("/accounting", { tab: item.key })}
            className={
              tab === item.key
                ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300"
            }
          >
            {item.label}
          </a>
        ))}
      </div>
      {tab === "chart" ? (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-4 py-3 text-right">{tx(locale, "الرمز", "Code")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الاسم", "Name")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "النوع", "Type")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الرصيد", "Balance")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
                  <td className="px-4 py-2 font-mono text-emerald-400" dir="ltr">{acc.code}</td>
                  <td className="px-4 py-2 font-semibold text-white">{acc.name}</td>
                  <td className="px-4 py-2 text-xs text-slate-400">{accountTypeLabel(locale, acc.type)}</td>
                  <td className="px-4 py-2 font-mono font-bold text-amber-300">{moneyFor(locale, acc.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "trial" ? (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className={`px-4 py-2 text-xs font-bold ${balanced ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {balanced
              ? tx(locale, "ميزان المراجعة متوازن", "Trial balance is balanced")
              : tx(locale, "ميزان المراجعة غير متوازن", "Trial balance is out of balance")}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="px-4 py-2 text-right">{tx(locale, "الحساب", "Account")}</th>
                <th className="px-4 py-2 text-right">{tx(locale, "مدين", "Debit")}</th>
                <th className="px-4 py-2 text-right">{tx(locale, "دائن", "Credit")}</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {trial.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
                  <td className="px-4 py-2 text-white">{row.code} — {row.name}</td>
                  <td className="px-4 py-2 font-mono text-emerald-400">{moneyFor(locale, row.debit)}</td>
                  <td className="px-4 py-2 font-mono text-amber-300">{moneyFor(locale, row.credit)}</td>
                </tr>
              ))}
              <tr className="bg-slate-950 font-bold text-white">
                <td className="px-4 py-2">{tx(locale, "الإجمالي", "Total")}</td>
                <td className="px-4 py-2 font-mono text-emerald-400">{moneyFor(locale, trial.debit)}</td>
                <td className="px-4 py-2 font-mono text-amber-300">{moneyFor(locale, trial.credit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "entry" && can(user, "accounting", "create") ? (
        <ManualJournalForm accounts={accounts.map((account) => ({ id: account.id, code: account.code, name: account.name }))} />
      ) : null}
    </div>
  );

  return (
    <VentureAccountingHub
      locale={locale === "en" ? "en" : "ar"}
      liveChildren={legacyLiveChildren}
    />
  );
}

export default function AccountingPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Accounting" />}>
      <AccountingContent searchParams={searchParams} />
    </Suspense>
  );
}
