import { Suspense } from "react";
import { connection } from "next/server";
import { ManualJournalForm } from "@/app/(panel)/accounting/journal-form";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { formatDateTime, formatKwd } from "@/lib/format";
import { accountTypeLabel } from "@/lib/i18n/auto-translate";
import { getLocale, tx } from "@/lib/i18n/server";
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
  const uiLocale = locale === "en" ? "en" : "ar";
  const user = await requireUser();
  if (!can(user, "accounting", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("accounting"))) {
    return <DisabledModule title={tx(locale, "المحاسبة", "Accounting")} />;
  }
  const isAuditor = Boolean(user.isAuditor || user.sessionRole === "auditor");
  const query = await readQuery(searchParams);
  await getActiveScope(query);
  const tabs = [
    { key: "chart", label: tx(locale, "شجرة الحسابات", "Chart of accounts") },
    { key: "journals", label: tx(locale, "قيود اليومية", "Journal entries") },
    { key: "trial", label: tx(locale, "ميزان المراجعة", "Trial balance") },
    ...(!isAuditor && can(user, "accounting", "create")
      ? [{ key: "entry", label: tx(locale, "قيد يدوي", "Manual entry") }]
      : []),
  ];
  const tab = tabs.some((item) => item.key === query.tab) ? query.tab : "chart";
  const [accounts, trial, journals] = await Promise.all([
    chartOfAccounts(),
    trialBalance(),
    listJournals((query.page - 1) * PAGE_SIZE, PAGE_SIZE, query.q),
  ]);
  const balanced = Math.abs(trial.debit - trial.credit) < 0.02;

  const legacyLiveChildren = (
    <div dir={uiLocale === "en" ? "ltr" : "rtl"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ds-border-hairline)] pb-3">
        <h4 className="text-sm font-bold" style={{ color: "var(--ds-accent)" }}>
          {tx(locale, "سجلات وقيود الأستاذ العام في قاعدة البيانات (Prisma DB)", "Prisma Database Ledger & Trial Balance")}
        </h4>
        <div className="flex flex-wrap gap-2">
          {!isAuditor ? <SmartIngestLaunchButton module="accounting" locale={locale} /> : null}
          <a
            href="/accounting/reconciliation"
            className="ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl border px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: "var(--ds-accent-soft)",
              borderColor: "var(--ds-border-accent)",
              color: "var(--ds-accent)",
            }}
          >
            {tx(locale, "⚡ مطابقة NBK + طلبات", "⚡ NBK Recon")}
          </a>
        </div>
      </div>

      <nav role="tablist" aria-label={tx(locale, "تبويبات المحاسبة المحلية", "Local accounting tabs")} className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <a
              key={item.key}
              role="tab"
              aria-selected={active}
              href={pageHref("/accounting", { tab: item.key })}
              className={`ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-3.5 py-2 text-xs font-semibold ${
                active
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "ds-surface text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {tab === "chart" ? (
        <div className="ds-surface overflow-hidden rounded-2xl">
          {accounts.length === 0 ? (
            <div
              role="status"
              data-state-block="empty"
              className="px-4 py-10 text-center text-sm"
              style={{ color: "var(--ds-text-muted)" }}
            >
              {tx(locale, "لا توجد حسابات مسجلة في الشجرة المحلية.", "No accounts recorded in the local chart.")}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                  <tr style={{ color: "var(--ds-text-secondary)" }}>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الرمز", "Code")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الاسم", "Name")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "النوع", "Type")}</th>
                    <th className="px-4 py-3 text-end text-xs font-bold">{tx(locale, "الرصيد", "Balance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="ds-num px-4 py-2.5 font-mono text-xs font-bold" style={{ color: "var(--ds-accent)" }} dir="ltr">
                        {acc.code}
                      </td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                        {acc.name}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--ds-text-muted)" }}>
                        {accountTypeLabel(locale, acc.type)}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono font-bold" style={{ color: "var(--ds-text-primary)" }}>
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatKwd(acc.balance, { locale: uiLocale })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "journals" ? (
        <div className="ds-surface overflow-hidden rounded-2xl">
          {journals.rows.length === 0 ? (
            <div
              role="status"
              data-state-block="empty"
              className="px-4 py-10 text-center text-sm"
              style={{ color: "var(--ds-text-muted)" }}
            >
              {tx(locale, "لا توجد قيود يومية مطابقة في السجل المحلي.", "No matching journal entries in the local ledger.")}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                  <tr style={{ color: "var(--ds-text-secondary)" }}>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "رقم القيد", "Entry #")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "التاريخ (الكويت)", "Date (Kuwait)")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "البيان", "Description")}</th>
                    <th className="px-4 py-3 text-end text-xs font-bold">{tx(locale, "المدين", "Debit")}</th>
                    <th className="px-4 py-3 text-end text-xs font-bold">{tx(locale, "الدائن", "Credit")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {journals.rows.map((entry) => {
                    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
                    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
                    return (
                      <tr key={entry.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                        <td className="ds-num px-4 py-2.5 font-mono text-xs font-bold" style={{ color: "var(--ds-accent)" }} dir="ltr">
                          {entry.entryNumber}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "var(--ds-text-muted)" }}>
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatDateTime(entry.date, { locale: uiLocale })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--ds-text-primary)" }}>
                          {entry.description}
                        </td>
                        <td className="px-4 py-2.5 text-end font-mono font-semibold" style={{ color: "var(--ds-positive)" }}>
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatKwd(totalDebit, { locale: uiLocale })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-end font-mono font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatKwd(totalCredit, { locale: uiLocale })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar path="/accounting" params={{ tab: "journals", q: query.q }} page={query.page} total={journals.total} />
        </div>
      ) : null}

      {tab === "trial" ? (
        <div className="ds-surface overflow-hidden rounded-2xl">
          <div
            className="border-b px-4 py-2.5 text-xs font-bold"
            style={
              balanced
                ? {
                    backgroundColor: "var(--ds-positive-bg)",
                    borderColor: "var(--ds-positive-border)",
                    color: "var(--ds-positive)",
                  }
                : {
                    backgroundColor: "var(--ds-negative-bg)",
                    borderColor: "var(--ds-negative-border)",
                    color: "var(--ds-negative)",
                  }
            }
          >
            {balanced
              ? tx(locale, "ميزان المراجعة متوازن", "Trial balance is balanced")
              : tx(locale, "ميزان المراجعة غير متوازن", "Trial balance is out of balance")}
          </div>
          {trial.rows.length === 0 ? (
            <div
              role="status"
              data-state-block="empty"
              className="px-4 py-10 text-center text-sm"
              style={{ color: "var(--ds-text-muted)" }}
            >
              {tx(locale, "لا توجد أرصدة في ميزان المراجعة.", "No balances in the trial balance.")}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                  <tr className="text-xs" style={{ color: "var(--ds-text-secondary)" }}>
                    <th className="px-4 py-2.5 text-start font-bold">{tx(locale, "الحساب", "Account")}</th>
                    <th className="px-4 py-2.5 text-end font-bold">{tx(locale, "مدين", "Debit")}</th>
                    <th className="px-4 py-2.5 text-end font-bold">{tx(locale, "دائن", "Credit")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)] text-xs">
                  {trial.rows.map((row) => (
                    <tr key={row.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="px-4 py-2.5" style={{ color: "var(--ds-text-primary)" }}>
                        <span dir="ltr" className="ds-num font-mono font-semibold">{row.code}</span>
                        {" — "}
                        {row.name}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono font-semibold" style={{ color: "var(--ds-positive)" }}>
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatKwd(row.debit, { locale: uiLocale })}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatKwd(row.credit, { locale: uiLocale })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-[var(--ds-border-strong)] font-bold" style={{ backgroundColor: "var(--ds-bg-subtle)", color: "var(--ds-text-primary)" }}>
                  <tr>
                    <td className="px-4 py-3">{tx(locale, "الإجمالي", "Total")}</td>
                    <td className="px-4 py-3 text-end font-mono" style={{ color: "var(--ds-positive)" }}>
                      <span dir="ltr" className="ds-num tabular-nums">
                        {formatKwd(trial.debit, { locale: uiLocale })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end font-mono">
                      <span dir="ltr" className="ds-num tabular-nums">
                        {formatKwd(trial.credit, { locale: uiLocale })}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "entry" && !isAuditor && can(user, "accounting", "create") ? (
        <ManualJournalForm accounts={accounts.map((account) => ({ id: account.id, code: account.code, name: account.name }))} />
      ) : null}
    </div>
  );

  return (
    <VentureAccountingHub
      locale={uiLocale}
      isAuditor={isAuditor}
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
