import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { DataCard, Forbidden, PageHeader, PageSkeleton, PaginationBar, btnGhost, btnPrimary, fieldClass } from "@/components/erp-ui";
import { ExportCsvButton } from "@/components/ui/export-button";
import { formatDate } from "@/lib/format";
import { MODULES } from "@/lib/modules";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listAudit } from "@/services/report.service";

export const metadata = { title: "سجل الرقابة | نظام ERP" };

const labels = Object.fromEntries(MODULES.map((item) => [item.key, item.label]));

async function AuditContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "audit", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const moduleKey = MODULES.some((item) => item.key === query.filter) ? query.filter : "";
  const skip = (query.page - 1) * PAGE_SIZE;
  const data = await listAudit({ q: query.q, module: moduleKey, skip, take: PAGE_SIZE });

  return (
    <div>
      <PageHeader
        title="سجل الرقابة"
        description="كل عملية ينفذها الموظفون: إنشاء وتعديل وحذف وفواتير وسندات."
        actions={<ExportCsvButton kind="audit" filename="audit.csv" />}
      />
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
          <input name="q" defaultValue={query.q} placeholder="بحث بالموظف أو التفاصيل" className={`${fieldClass} max-w-sm`} />
          <select name="filter" defaultValue={moduleKey} className={`${fieldClass} max-w-52`}>
            <option value="">كل الأقسام</option>
            {MODULES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <button className={btnPrimary}>بحث</button>
          <a href="/audit" className={btnGhost}>
            مسح
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right font-semibold">القسم</th>
                <th className="px-4 py-3 text-right font-semibold">الإجراء</th>
                <th className="px-4 py-3 text-right font-semibold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    لا توجد عمليات مطابقة.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.user.name}</p>
                      <p className="text-xs text-slate-500" dir="ltr">
                        {row.user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">{labels[row.module] ?? row.module}</td>
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
    <Suspense fallback={<PageSkeleton title="سجل الرقابة" />}>
      <AuditContent searchParams={searchParams} />
    </Suspense>
  );
}
