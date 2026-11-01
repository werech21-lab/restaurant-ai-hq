import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { DataCard, Forbidden, PageHeader, PageSkeleton, PaginationBar, btnGhost, btnPrimary, fieldClass } from "@/components/erp-ui";
import { ExportCsvButton } from "@/components/ui/export-button";
import { moduleNavLabel } from "@/lib/i18n/auto-translate";
import { datetimeFor, getLocale, tx } from "@/lib/i18n/server";
import { MODULES } from "@/lib/modules";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listAudit } from "@/services/report.service";

export const metadata = { title: "Audit Log | AetherBI ERP" };

async function AuditContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "audit", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const moduleKey = MODULES.some((item) => item.key === query.filter) ? query.filter : "";
  const skip = (query.page - 1) * PAGE_SIZE;
  const data = await listAudit({ q: query.q, module: moduleKey, skip, take: PAGE_SIZE });

  return (
    <div>
      <PageHeader
        title={tx(locale, "سجل الرقابة", "Audit log")}
        description={tx(
          locale,
          "كل عملية ينفذها الموظفون: إنشاء وتعديل وحذف وفواتير وسندات.",
          "Every action by staff: create, update, delete, invoices, and vouchers.",
        )}
        actions={<ExportCsvButton kind="audit" filename="audit.csv" />}
      />
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
          <input
            name="q"
            defaultValue={query.q}
            placeholder={tx(locale, "بحث بالموظف أو التفاصيل", "Search by user or details")}
            className={`${fieldClass} max-w-sm`}
          />
          <select name="filter" defaultValue={moduleKey} className={`${fieldClass} max-w-52`}>
            <option value="">{tx(locale, "كل الأقسام", "All modules")}</option>
            {MODULES.map((item) => (
              <option key={item.key} value={item.key}>
                {moduleNavLabel(locale, item.labelKey)}
              </option>
            ))}
          </select>
          <button className={btnPrimary}>{tx(locale, "بحث", "Search")}</button>
          <a href="/audit" className={btnGhost}>
            {tx(locale, "مسح", "Clear")}
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "التاريخ", "Date")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الموظف", "User")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "القسم", "Module")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "الإجراء", "Action")}</th>
                <th className="px-4 py-3 text-right font-semibold">{tx(locale, "التفاصيل", "Details")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {tx(locale, "لا توجد عمليات مطابقة.", "No matching entries.")}
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{datetimeFor(locale, row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.user.name}</p>
                      <p className="text-xs text-slate-500" dir="ltr">
                        {row.user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {MODULES.find((item) => item.key === row.module)
                        ? moduleNavLabel(locale, MODULES.find((item) => item.key === row.module)!.labelKey)
                        : row.module}
                    </td>
                    <td className="px-4 py-3 font-semibold">{row.action}</td>
                    <td className="px-4 py-3">{row.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar path="/audit" params={{ q: query.q, filter: moduleKey }} page={query.page} total={data.total} />
      </DataCard>
    </div>
  );
}

export default function AuditPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Audit" />}>
      <AuditContent searchParams={searchParams} />
    </Suspense>
  );
}
