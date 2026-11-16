import { Suspense } from "react";
import { connection } from "next/server";
import { CrmBoard, QuoteActions } from "@/app/(panel)/crm/crm-board";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { formatDate, formatKwd, getUnavailableTooltip, UNAVAILABLE_DASH } from "@/lib/format";
import { quoteStatusLabel } from "@/lib/i18n/auto-translate";
import { getLocale, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { visibleProductWhere } from "@/lib/panel-visibility";
import { listLeads, listQuotations } from "@/services/crm.service";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";
import { VentureCrmHub } from "@/components/crm/VentureCrmHub";

export const metadata = {
  title: "علاقات العملاء والكاترينج وعقود الشركات | شركة فنتشر فودز ذ.م.م.",
  description: "منظومة علاقات العملاء، عقود الكاترينج والشركات، وبرامج الولاء لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
};

async function CrmContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const uiLocale = locale === "en" ? "en" : "ar";
  const unavailableTip = getUnavailableTooltip(uiLocale);
  const user = await requireUser();
  if (!can(user, "crm", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("crm"))) {
    return <DisabledModule title={tx(locale, "علاقات العملاء", "CRM")} />;
  }
  const query = await readQuery(searchParams);
  const tab = query.tab === "quotes" ? "quotes" : "board";
  const [leads, quotes, customers, products] = await Promise.all([
    listLeads(),
    listQuotations((query.page - 1) * PAGE_SIZE, PAGE_SIZE, tab === "quotes" ? query.q : ""),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 100 }),
    prisma.product.findMany({ where: visibleProductWhere(), orderBy: { name: "asc" }, select: { id: true, name: true, sellingPrice: true }, take: 100 }),
  ]);

  const legacyLiveChildren = (
    <div dir={uiLocale === "en" ? "ltr" : "rtl"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ds-border-hairline)] pb-3">
        <h4 className="text-sm font-bold" style={{ color: "var(--ds-accent)" }}>
          {tx(locale, "لوحة الفرص وعروض الأسعار المعتمدة", "CRM Leads & Quotations")}
        </h4>
        <SmartIngestLaunchButton module="crm_projects" locale={locale} />
      </div>
      <nav role="tablist" aria-label={tx(locale, "تبويبات الفرص وعروض الأسعار", "Leads and quotes tabs")} className="mb-4 flex flex-wrap gap-2">
        <a
          role="tab"
          aria-selected={tab === "board"}
          href={pageHref("/crm", { tab: "board" })}
          className={`ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-xs font-semibold ${
            tab === "board"
              ? "bg-emerald-600 text-white shadow-xs"
              : "ds-surface text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]"
          }`}
        >
          {tx(locale, "لوحة الفرص", "Pipeline board")}
        </a>
        <a
          role="tab"
          aria-selected={tab === "quotes"}
          href={pageHref("/crm", { tab: "quotes" })}
          className={`ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-xs font-semibold ${
            tab === "quotes"
              ? "bg-emerald-600 text-white shadow-xs"
              : "ds-surface text-[var(--ds-text-secondary)] hover:bg-[var(--ds-bg-hover)]"
          }`}
        >
          {tx(locale, "عروض الأسعار", "Quotations")}
        </a>
      </nav>
      {tab === "board" ? (
        <CrmBoard
          locale={uiLocale}
          canCreate={can(user, "crm", "create")}
          canEdit={can(user, "crm", "edit")}
          customers={customers}
          products={products.map((p) => ({ id: p.id, name: p.name, price: p.sellingPrice }))}
          leads={leads.map((lead) => ({
            id: lead.id,
            title: lead.title,
            contactName: lead.contactName || tx(locale, "عميل محتمل", "Prospect"),
            phone: lead.phone || "",
            expectedLabel: formatKwd(lead.expectedValue, { locale: uiLocale }),
            stage: lead.stage,
            owner: lead.assignedTo?.name ?? tx(locale, "غير مسنَد", "Unassigned"),
          }))}
        />
      ) : (
        <div className="ds-surface overflow-hidden rounded-2xl">
          <form method="get" className="flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] p-4">
            <input type="hidden" name="tab" value="quotes" />
            <input
              name="q"
              defaultValue={query.q}
              aria-label={tx(locale, "بحث برقم العرض أو العميل", "Search by quote number or customer")}
              placeholder={tx(locale, "بحث برقم العرض أو العميل", "Search by quote number or customer")}
              className="ds-surface-subtle ds-focus-ring min-h-10 w-full max-w-sm rounded-xl px-3 py-2 text-sm text-[var(--ds-text-primary)]"
            />
            <button
              type="submit"
              className="ds-motion ds-focus-ring min-h-10 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              {tx(locale, "بحث", "Search")}
            </button>
          </form>
          {quotes.rows.length === 0 ? (
            <div
              role="status"
              data-state-block="empty"
              className="px-4 py-10 text-center text-sm"
              style={{ color: "var(--ds-text-muted)" }}
            >
              {tx(locale, "لا توجد عروض أسعار مطابقة.", "No matching quotations found.")}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                  <tr style={{ color: "var(--ds-text-secondary)" }}>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الرقم", "Number")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الجهة", "Party")}</th>
                    <th className="px-4 py-3 text-end text-xs font-bold">{tx(locale, "الإجمالي", "Total")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الصلاحية", "Valid until")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الحالة", "Status")}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "إجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                  {quotes.rows.map((quote) => (
                    <tr key={quote.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="ds-num px-4 py-3 font-mono text-xs font-bold" style={{ color: "var(--ds-accent)" }} dir="ltr">
                        {quote.quoteNumber}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                        {quote.customer?.name || quote.lead?.title || (
                          <span title={unavailableTip} aria-label={unavailableTip}>
                            {UNAVAILABLE_DASH}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold" style={{ color: "var(--ds-text-primary)" }}>
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatKwd(quote.totalAmount, { locale: uiLocale })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--ds-text-muted)" }}>
                        {quote.validUntil ? (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatDate(quote.validUntil, { locale: uiLocale })}
                          </span>
                        ) : (
                          <span title={unavailableTip} aria-label={unavailableTip}>
                            {UNAVAILABLE_DASH}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--ds-text-secondary)" }}>
                        {quoteStatusLabel(locale, quote.status)}
                      </td>
                      <td className="px-4 py-3">
                        {can(user, "crm", "create") ? (
                          <QuoteActions id={quote.id} status={quote.status} locale={uiLocale} />
                        ) : (
                          <a
                            className="ds-focus-ring font-semibold hover:underline"
                            style={{ color: "var(--ds-accent)" }}
                            href={`/crm/quotes/${quote.id}/print`}
                          >
                            {tx(locale, "طباعة", "Print")}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PaginationBar path="/crm" params={{ tab: "quotes", q: query.q }} page={query.page} total={quotes.total} />
        </div>
      )}
    </div>
  );

  return (
    <VentureCrmHub
      locale={uiLocale}
      liveChildren={legacyLiveChildren}
    />
  );
}

export default function CrmPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="CRM" />}>
      <CrmContent searchParams={searchParams} />
    </Suspense>
  );
}
