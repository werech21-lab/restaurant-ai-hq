import { Suspense } from "react";
import { connection } from "next/server";
import { HrForms } from "@/app/(panel)/hr/hr-forms";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar } from "@/components/erp-ui";
import { formatQty } from "@/lib/format";
import { attendanceLabel, payrollStatusLabel } from "@/lib/i18n/auto-translate";
import { datetimeFor, getLocale, moneyFor, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { getActiveScope, hrDepartmentTokens } from "@/lib/scope";
import { listAttendance, listEmployees, listPayroll } from "@/services/hr.service";
import { HrDigitalDossier } from "@/components/hr-digital-dossier";
import { HrWpsToolbar } from "@/components/hr-wps-toolbar";

export const metadata = { title: "HR & Payroll | AetherBI ERP" };

async function HrContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "hr", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("hr"))) {
    return <DisabledModule title={tx(locale, "الموارد البشرية", "HR & payroll")} />;
  }
  const query = await readQuery(searchParams);
  const scope = await getActiveScope(query);
  const scopeLabel = locale === "en" ? scope.labelEn : scope.labelAr;
  const tokens = hrDepartmentTokens(scope);
  const tab = query.tab === "attendance" || query.tab === "payroll" ? query.tab : "employees";
  const selectedDossier = query.doc;
  const now = new Date();
  const year = Number(query.role) || now.getFullYear();
  const month = Number(query.filter) || now.getMonth() + 1;
  const scopeQuery =
    tab === "employees" ? [query.q, tokens[0]].filter(Boolean).join(" ").trim() : tokens[0] || "";
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
        title={tx(locale, "الموارد البشرية والرواتب", "HR & payroll")}
        description={tx(locale, `ملفات الموظفين والحضور والمسير · ${scopeLabel}`, `Employee records, attendance, and payroll · ${scopeLabel}`)}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href="/hr/smart-folder-upload"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
        >
          {tx(
            locale,
            "📁 رفع مجلد الموظفين الذكي (توزيع تلقائي بالـ AI)",
            "📁 Smart HR Folder Upload (Auto-Distribute)",
          )}
        </a>
        <a
          href="/hr/compliance-radar"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-amber-600"
        >
          {tx(locale, "🛡️ رادار الإقامات وكروت البلدية", "🛡️ Residency & Health Card Radar")}
        </a>
        <a
          href="/ess"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800"
        >
          {tx(locale, "بوابة الموظف /ess", "Employee portal /ess")}
        </a>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href={pageHref("/hr", { tab: "employees" })}
          className={
            tab === "employees"
              ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          }
        >
          {tx(locale, "الموظفون", "Employees")}
        </a>
        <a
          href={pageHref("/hr", { tab: "attendance" })}
          className={
            tab === "attendance"
              ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          }
        >
          {tx(locale, "الحضور", "Attendance")}
        </a>
        <a
          href={pageHref("/hr", { tab: "payroll", filter: month, role: year })}
          className={
            tab === "payroll"
              ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          }
        >
          {tx(locale, "المسير", "Payroll")}
        </a>
        <a
          href="/directory"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
        >
          {tx(locale, "دليل الهواتف والبدالة", "Phone & PBX Directory")}
        </a>
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
            <input
              name="q"
              defaultValue={query.q}
              placeholder={tx(locale, "بحث بالاسم أو الرمز أو القسم", "Search by name, code, or department")}
              className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              {tx(locale, "بحث", "Search")}
            </button>
          </form>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">{tx(locale, "الرمز", "Code")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الاسم", "Name")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الوظيفة", "Job title")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "القسم", "Department")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "موبايل / بريد", "Mobile / email")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الأساسي", "Basic")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "البدلات", "Allowances")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الاستقطاع", "Deductions")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.rows.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-200">
                  <td className="px-4 py-3 font-semibold" dir="ltr">
                    {employee.code}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={pageHref("/hr", { tab: "employees", q: query.q, doc: employee.id, page: query.page })}
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      {employee.name}
                    </a>
                  </td>
                  <td className="px-4 py-3">{employee.jobTitle}</td>
                  <td className="px-4 py-3">{employee.department}</td>
                  <td className="px-4 py-3 text-xs" dir="ltr">
                    {employee.phone || "—"}
                  </td>
                  <td className="px-4 py-3">{moneyFor(locale, employee.basicSalary)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, employee.allowances)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, employee.deductions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar path="/hr" params={{ tab: "employees", q: query.q }} page={query.page} total={employees.total} />
        </div>
      ) : null}
      {tab === "employees" && selectedDossier ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            {tx(locale, "الخزانة الرقمية ومستندات الموظف", "Digital HR Dossier")}
            {" · "}
            {employees.rows.find((row) => row.id === selectedDossier)?.name ||
              allEmployees.find((row) => row.id === selectedDossier)?.name ||
              selectedDossier}
          </p>
          <HrDigitalDossier employeeId={selectedDossier} locale={locale} />
        </div>
      ) : null}
      {tab === "attendance" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">{tx(locale, "الموظف", "Employee")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "التاريخ", "Date")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الحالة", "Status")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الساعات", "Hours")}</th>
              </tr>
            </thead>
            <tbody>
              {attendance.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200">
                  <td className="px-4 py-3">{row.employee.name}</td>
                  <td className="px-4 py-3">{datetimeFor(locale, row.date)}</td>
                  <td className="px-4 py-3">{attendanceLabel(locale, row.status)}</td>
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
          <div className="border-b border-slate-200 p-4">
            <HrWpsToolbar month={month} year={year} locale={locale} />
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((item) => (
              <a
                key={item}
                href={pageHref("/hr", { tab: "payroll", filter: item, role: year })}
                className={
                  item === month
                    ? "rounded-lg bg-blue-600 px-3 py-1 text-sm font-semibold text-white"
                    : "rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold"
                }
              >
                {item}
              </a>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right">{tx(locale, "الموظف", "Employee")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الأساسي", "Basic")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "البدلات", "Allowances")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الاستقطاع", "Deductions")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "غياب / تأخير", "Absent / late")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الصافي", "Net")}</th>
                <th className="px-4 py-3 text-right">{tx(locale, "الحالة", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {scopedPayroll.map((row) => (
                <tr key={row.id} className="border-b border-slate-200">
                  <td className="px-4 py-3">
                    <a className="font-semibold text-blue-700" href={`/hr/payroll/${row.id}/print`}>
                      {row.employee.name}
                    </a>
                  </td>
                  <td className="px-4 py-3">{moneyFor(locale, row.basicSalary)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, row.totalAllowances)}</td>
                  <td className="px-4 py-3">{moneyFor(locale, row.totalDeductions)}</td>
                  <td className="px-4 py-3">
                    {row.absentDays} / {row.lateDays}
                  </td>
                  <td className="px-4 py-3 font-bold">{moneyFor(locale, row.netSalary)}</td>
                  <td className="px-4 py-3">{payrollStatusLabel(locale, row.status)}</td>
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
    <Suspense fallback={<PageSkeleton title="HR" />}>
      <HrContent searchParams={searchParams} />
    </Suspense>
  );
}
