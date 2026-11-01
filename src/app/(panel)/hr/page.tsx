import { Suspense } from "react";
import { connection } from "next/server";
import { HrForms } from "@/app/(panel)/hr/hr-forms";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getActiveScope, hrDepartmentTokens } from "@/lib/scope";
import { listAttendance, listEmployees, listPayroll } from "@/services/hr.service";

export const metadata = { title: "الموارد البشرية | نظام ERP" };

const ATTENDANCE_LABEL: Record<string, string> = {
  PRESENT: "حاضر",
  ABSENT: "غائب",
  LATE: "متأخر",
  LEAVE: "إجازة",
};

async function HrContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const user = await requireUser();
  if (!can(user, "hr", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("hr"))) return <DisabledModule title="الموارد البشرية" />;
  const query = await readQuery(searchParams);
  const scope = await getActiveScope(query);
  const tokens = hrDepartmentTokens(scope);
  const tab = query.tab === "attendance" || query.tab === "payroll" ? query.tab : "employees";
  const now = new Date();
  const year = Number(query.role) || now.getFullYear();
  const month = Number(query.filter) || now.getMonth() + 1;
  const scopeQuery =
    tab === "employees"
      ? [query.q, tokens[0]].filter(Boolean).join(" ").trim()
      : tokens[0] || "";
  const [employees, attendance, payroll] = await Promise.all([
    listEmployees((query.page - 1) * PAGE_SIZE, PAGE_SIZE, scopeQuery),
    listAttendance((query.page - 1) * PAGE_SIZE, PAGE_SIZE),
    listPayroll(year, month),
  ]);
  const allEmployees = tab === "employees" ? employees.rows : (await listEmployees(0, 200, tokens[0] || "")).rows;
  const scopedPayroll =
    tokens.length === 0
      ? payroll
      : payroll.filter((row) =>
          tokens.some((token) =>
            `${row.employee.department} ${row.employee.name}`.toLowerCase().includes(token.toLowerCase()),
          ),
        );

  return (
    <div>
      <PageHeader
        title="الموارد البشرية والرواتب"
        description={`ملفات الموظفين والحضور والمسير · ${scope.labelAr}`}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <a href={pageHref("/hr", { tab: "employees" })} className={tab === "employees" ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"}>الموظفون</a>
        <a href={pageHref("/hr", { tab: "attendance" })} className={tab === "attendance" ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"}>الحضور</a>
        <a href={pageHref("/hr", { tab: "payroll", filter: month, role: year })} className={tab === "payroll" ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"}>المسير</a>
      </div>
      <HrForms
        employees={allEmployees.map((employee) => ({ id: employee.id, name: employee.name }))}
        year={year}
        month={month}
        canCreate={can(user, "hr", "create")}
        canEdit={can(user, "hr", "edit")}
      />
      {tab === "employees" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <form method="get" className="flex gap-2 border-b border-slate-200 p-4">
            <input type="hidden" name="tab" value="employees" />
            <input name="q" defaultValue={query.q} placeholder="بحث بالاسم أو الرمز أو القسم" className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">بحث</button>
          </form>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">الرمز</th>
                <th className="px-4 py-3 text-right">الاسم</th>
                <th className="px-4 py-3 text-right">الوظيفة</th>
                <th className="px-4 py-3 text-right">القسم</th>
                <th className="px-4 py-3 text-right">الأساسي</th>
                <th className="px-4 py-3 text-right">البدلات</th>
                <th className="px-4 py-3 text-right">الاستقطاع</th>
              </tr>
            </thead>
            <tbody>
              {employees.rows.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-200">
                  <td className="px-4 py-3 font-semibold" dir="ltr">{employee.code}</td>
                  <td className="px-4 py-3">{employee.name}</td>
                  <td className="px-4 py-3">{employee.jobTitle}</td>
                  <td className="px-4 py-3">{employee.department}</td>
                  <td className="px-4 py-3">{formatMoney(employee.basicSalary)}</td>
                  <td className="px-4 py-3">{formatMoney(employee.allowances)}</td>
                  <td className="px-4 py-3">{formatMoney(employee.deductions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar path="/hr" params={{ tab: "employees", q: query.q }} page={query.page} total={employees.total} />
        </div>
      ) : null}
      {tab === "attendance" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">الموظف</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">الساعات</th>
              </tr>
            </thead>
            <tbody>
              {attendance.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200">
                  <td className="px-4 py-3">{row.employee.name}</td>
                  <td className="px-4 py-3">{formatDate(row.date)}</td>
                  <td className="px-4 py-3">{ATTENDANCE_LABEL[row.status] ?? row.status}</td>
                  <td className="px-4 py-3">{formatQty(row.hoursWorked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar path="/hr" params={{ tab: "attendance" }} page={query.page} total={attendance.total} />
        </div>
      ) : null}
      {tab === "payroll" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((item) => (
              <a key={item} href={pageHref("/hr", { tab: "payroll", filter: item, role: year })} className={item === month ? "rounded-lg bg-blue-600 px-3 py-1 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold"}>
                {item}
              </a>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">الموظف</th>
                <th className="px-4 py-3 text-right">الأساسي</th>
                <th className="px-4 py-3 text-right">البدلات</th>
                <th className="px-4 py-3 text-right">الاستقطاع</th>
                <th className="px-4 py-3 text-right">غياب / تأخير</th>
                <th className="px-4 py-3 text-right">الصافي</th>
                <th className="px-4 py-3 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {scopedPayroll.map((row) => (
                <tr key={row.id} className="border-b border-slate-200">
                  <td className="px-4 py-3">
                    <a className="font-semibold text-blue-700" href={`/hr/payroll/${row.id}/print`}>{row.employee.name}</a>
                  </td>
                  <td className="px-4 py-3">{formatMoney(row.basicSalary)}</td>
                  <td className="px-4 py-3">{formatMoney(row.totalAllowances)}</td>
                  <td className="px-4 py-3">{formatMoney(row.totalDeductions)}</td>
                  <td className="px-4 py-3">{row.absentDays} / {row.lateDays}</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(row.netSalary)}</td>
                  <td className="px-4 py-3">{row.status === "PAID" ? "مصروف" : "مسودة"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function HrPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="الموارد البشرية" />}>
      <HrContent searchParams={searchParams} />
    </Suspense>
  );
}
