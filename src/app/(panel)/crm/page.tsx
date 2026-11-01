import { Suspense } from "react";
import { connection } from "next/server";
import { CrmBoard, QuoteActions } from "@/app/(panel)/crm/crm-board";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { quoteStatusLabel } from "@/lib/i18n/auto-translate";
import { dateFor, getLocale, moneyFor, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listLeads, listQuotations } from "@/services/crm.service";

export const metadata = { title: "CRM | AetherBI ERP" };

async function CrmContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
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
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, sellingPrice: true }, take: 100 }),
  ]);

  return (
    <div>
      <PageHeader
        title={tx(locale, "علاقات العملاء وعروض الأسعار", "CRM & quotations")}
        description={tx(
          locale,
          "مسار الفرص البيعية وتحويل العرض المقبول إلى فاتورة مخزون وقيد في حركة واحدة.",
          "Sales pipeline and one-step conversion of accepted quotes to stock and ledger entries.",
        )}
      />
      <div className="mb-4 flex gap-2">
        <a
          href={pageHref("/crm", { tab: "board" })}
          className={
            tab === "board"
              ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          }
        >
          {tx(locale, "لوحة الفرص", "Pipeline board")}
        </a>
        <a
          href={pageHref("/crm", { tab: "quotes" })}
          className={
            tab === "quotes"
              ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          }
        >
          {tx(locale, "عروض الأسعار", "Quotations")}
        </a>
      </div>
      {tab === "board" ? (
        <CrmBoard
          canEdit={can(user, "crm", "edit")}
          canCreate={can(user, "crm", "create")}
          customers={customers}
          products={products.map((product) => ({ id: product.id, name: product.name, price: product.sellingPrice }))}
          leads={leads.map((lead) => ({
            id: lead.id,
            title: lead.title,
            contactName: lead.contactName,
            phone: lead.phone ?? "",
            expectedLabel: moneyFor(locale, lead.expectedValue),
            stage: lead.stage,
            owner: lead.assignedTo?.name ?? tx(locale, "غير مسنَد", "Unassigned"),
          }))}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
            <input type="hidden" name="tab" value="quotes" />
            <input
              name="q"
              defaultValue={query.q}
              placeholder={tx(locale, "بحث برقم العرض أو العميل", "Search by quote number or customer")}
              className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              {tx(locale, "بحث", "Search")}
            </button>
          </form>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">{tx(locale, "الرقم", "Number")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الجهة", "Party")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الإجمالي", "Total")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الصلاحية", "Valid until")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الحالة", "Status")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "إجراءات", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {quotes.rows.map((quote) => (
                <tr key={quote.id} className="border-b border-slate-200">
                  <td className="px-4 py-3 font-semibold" dir="ltr">
                    {quote.quoteNumber}
                  </td>
                  <td className="px-4 py-3">{quote.customer?.name || quote.lead?.title || "—"}</td>
                  <td className="px-4 py-3">{moneyFor(locale, quote.totalAmount)}</td>
                  <td className="px-4 py-3">{quote.validUntil ? dateFor(locale, quote.validUntil) : "—"}</td>
                  <td className="px-4 py-3">{quoteStatusLabel(locale, quote.status)}</td>
                  <td className="px-4 py-3">
                    {can(user, "crm", "create") ? (
                      <QuoteActions id={quote.id} status={quote.status} />
                    ) : (
                      <a className="font-semibold text-blue-700" href={`/crm/quotes/${quote.id}/print`}>
                        {tx(locale, "طباعة", "Print")}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar path="/crm" params={{ tab: "quotes", q: query.q }} page={query.page} total={quotes.total} />
        </div>
      )}
    </div>
  );
}

export default function CrmPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="CRM" />}>
      <CrmContent searchParams={searchParams} />
    </Suspense>
  );
}
