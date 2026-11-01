import { Suspense } from "react";
import { connection } from "next/server";
import { ManualJournalForm } from "@/app/(panel)/accounting/journal-form";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { ACCOUNT_TYPE_LABEL, formatDate, formatMoney } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { chartOfAccounts, listJournals, trialBalance } from "@/services/accounting.service";

export const metadata = { title: "المحاسبة | نظام ERP" };

const TABS = [
  { key: "chart", label: "شجرة الحسابات" },
  { key: "journals", label: "قيود اليومية" },
  { key: "trial", label: "ميزان المراجعة" },
  { key: "entry", label: "قيد يدوي" },
];

async function AccountingContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const user = await requireUser();
  if (!can(user, "accounting", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("accounting"))) return <DisabledModule title="المحاسبة" />;
  const query = await readQuery(searchParams);
  const tab = TABS.some((item) => item.key === query.tab) ? query.tab : "chart";
  const [accounts, trial, journals] = await Promise.all([
    chartOfAccounts(),
    trialBalance(),
    listJournals((query.page - 1) * PAGE_SIZE, PAGE_SIZE, query.q),
  ]);
  const balanced = Math.abs(trial.debit - trial.credit) < 0.02;

  return (
    <div>
      <PageHeader title="المحاسبة" description="شجرة الحسابات، قيود اليومية المزدوجة، وميزان المراجعة." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
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
                <th className="px-4 py-3 text-right">الرمز</th>
                <th className="px-4 py-3 text-right">الحساب</th>
                <th className="px-4 py-3 text-right">النوع</th>
                <th className="px-4 py-3 text-right">الحساب الأب</th>
                <th className="px-4 py-3 text-right">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3 font-semibold" dir="ltr">
                    {account.code}
                  </td>
                  <td className="px-4 py-3">{account.parentId ? account.name : <strong>{account.name}</strong>}</td>
                  <td className="px-4 py-3">{ACCOUNT_TYPE_LABEL[account.type] ?? account.type}</td>
                  <td className="px-4 py-3">{account.parent ? `${account.parent.code} ${account.parent.name}` : "—"}</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(account.balance)}</td>
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
            <input name="q" defaultValue={query.q} placeholder="بحث برقم القيد أو الوصف" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">بحث</button>
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
                  <p>{formatDate(entry.date)}</p>
                  <p>{entry.referenceType === "MANUAL" ? "قيد يدوي" : "قيد آلي"} · {entry.createdBy.name}</p>
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-200">
                      <td className="py-2">{line.account.code} — {line.account.name}</td>
                      <td className="py-2">مدين {formatMoney(line.debit)}</td>
                      <td className="py-2">دائن {formatMoney(line.credit)}</td>
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
            {balanced ? "ميزان المراجعة متوازن" : "ميزان المراجعة غير متوازن"}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">الحساب</th>
                <th className="px-4 py-3 text-right">مدين</th>
                <th className="px-4 py-3 text-right">دائن</th>
              </tr>
            </thead>
            <tbody>
              {trial.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">{row.code} — {row.name}</td>
                  <td className="px-4 py-3">{formatMoney(row.debit)}</td>
                  <td className="px-4 py-3">{formatMoney(row.credit)}</td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white">
                <td className="px-4 py-3 font-bold">الإجمالي</td>
                <td className="px-4 py-3 font-bold">{formatMoney(trial.debit)}</td>
                <td className="px-4 py-3 font-bold">{formatMoney(trial.credit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "entry" && can(user, "accounting", "create") ? <ManualJournalForm accounts={accounts.map((account) => ({ id: account.id, code: account.code, name: account.name }))} /> : null}
    </div>
  );
}

export default function AccountingPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="المحاسبة" />}>
      <AccountingContent searchParams={searchParams} />
    </Suspense>
  );
}
