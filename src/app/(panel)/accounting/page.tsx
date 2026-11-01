import { Suspense } from "react";
import { connection } from "next/server";
import { ManualJournalForm } from "@/app/(panel)/accounting/journal-form";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { accountTypeLabel } from "@/lib/i18n/auto-translate";
import { getLocale, moneyFor, dateFor, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getActiveScope } from "@/lib/scope";
import { chartOfAccounts, listJournals, trialBalance } from "@/services/accounting.service";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";

export const metadata = { title: "Accounting | AetherBI" };

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
  const scopeLabel = locale === "en" ? scope.labelEn : scope.labelAr;

  return (
    <div>
      <PageHeader
        title={tx(locale, "المحاسبة", "Accounting")}
        description={tx(
          locale,
          `شجرة الحسابات، قيود اليومية المزدوجة، وميزان المراجعة · ${scopeLabel}`,
          `Chart of accounts, dual-entry journals, and trial balance · ${scopeLabel}`,
        )}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SmartIngestLaunchButton module="accounting" locale={locale} />
        <a
          href="/accounting/reconciliation"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-5 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-950/50"
        >
          {tx(locale, '⚡ مركز المطابقة الذكية NBK + طلبات', '⚡ Smart NBK + Delivery Reconciliation')}
        </a>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <a
            key={item.key}
            href={pageHref("/accounting", { tab: item.key })}
            className={
              tab === item.key
                ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            }
          >
            {item.label}
          </a>
        ))}
      </div>
      {tab === "chart" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">{tx(locale, "الرمز", "Code")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الحساب", "Account")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "النوع", "Type")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الحساب الأب", "Parent")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الرصيد", "Balance")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3 font-semibold" dir="ltr">
                    {account.code}
                  </td>
                  <td className="px-4 py-3">{account.parentId ? account.name : <strong>{account.name}</strong>}</td>
                  <td className="px-4 py-3">{accountTypeLabel(locale, account.type)}</td>
                  <td className="px-4 py-3">{account.parent ? `${account.parent.code} ${account.parent.name}` : "—"}</td>
                  <td className="px-4 py-3 font-bold">{moneyFor(locale, account.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "journals" ? (
        <div className="space-y-3">
          <form method="get" className="flex gap-2">
            <input type="hidden" name="tab" value="journals" />
            <input
              name="q"
              defaultValue={query.q}
              placeholder={tx(locale, "بحث برقم القيد أو الوصف", "Search by entry number or description")}
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              {tx(locale, "بحث", "Search")}
            </button>
          </form>
          {journals.rows.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold" dir="ltr">
                    {entry.entryNumber}
                  </p>
                  <p className="text-sm text-slate-600">{entry.description}</p>
                </div>
                <div className="text-sm text-slate-500">
                  <p>{dateFor(locale, entry.date)}</p>
                  <p>
                    {entry.referenceType === "MANUAL"
                      ? tx(locale, "قيد يدوي", "Manual entry")
                      : tx(locale, "قيد آلي", "System entry")}{" "}
                    · {entry.createdBy.name}
                  </p>
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-200">
                      <td className="py-2">
                        {line.account.code} — {line.account.name}
                      </td>
                      <td className="py-2">
                        {tx(locale, "مدين", "Debit")} {moneyFor(locale, line.debit)}
                      </td>
                      <td className="py-2">
                        {tx(locale, "دائن", "Credit")} {moneyFor(locale, line.credit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
          <PaginationBar path="/accounting" params={{ tab: "journals", q: query.q }} page={query.page} total={journals.total} />
        </div>
      ) : null}
      {tab === "trial" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className={`px-4 py-3 text-sm font-bold ${balanced ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
            {balanced
              ? tx(locale, "ميزان المراجعة متوازن", "Trial balance is balanced")
              : tx(locale, "ميزان المراجعة غير متوازن", "Trial balance is out of balance")}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">{tx(locale, "الحساب", "Account")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "مدين", "Debit")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "دائن", "Credit")}</th>
              </tr>
            </thead>
            <tbody>
              {trial.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">
                    {row.code} — {row.name}
                  </td>
                  <td className="px-4 py-3">{moneyFor(locale, row.debit)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, row.credit)}</td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white">
                <td className="px-4 py-3 font-bold">{tx(locale, "الإجمالي", "Total")}</td>
                <td className="px-4 py-3 font-bold">{moneyFor(locale, trial.debit)}</td>
                <td className="px-4 py-3 font-bold">{moneyFor(locale, trial.credit)}</td>
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
}

export default function AccountingPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Accounting" />}>
      <AccountingContent searchParams={searchParams} />
    </Suspense>
  );
}
