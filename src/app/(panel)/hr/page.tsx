import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageSkeleton } from "@/components/erp-ui";
import { getLocale, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listAttendance, listEmployees, listPayroll } from "@/services/hr.service";
import { ensureComplianceBaselines } from "@/services/hr-compliance.service";
import { EnterpriseHrCommandHub } from "@/components/hr/EnterpriseHrCommandHub";

export const metadata = { title: "Enterprise HRMS & Overseas Recruitment | AetherBI ERP" };

async function HrContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "hr", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("hr"))) {
    return <DisabledModule title={tx(locale, "الموارد البشرية", "HR & payroll")} />;
  }

  const query = await readQuery(searchParams);
  const now = new Date();
  const year = Number(query.role) || now.getFullYear();
  const month = Number(query.filter) || now.getMonth() + 1;

  await ensureComplianceBaselines().catch(() => null);

  const [employeesPack, attendancePack, payrollRows] = await Promise.all([
    listEmployees(0, 300, ""),
    listAttendance(0, 120),
    listPayroll(year, month),
  ]);

  const toDateStr = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

  const serializedEmployees = employeesPack.rows.map((emp) => ({
    id: emp.id,
    code: emp.code,
    name: emp.name,
    jobTitle: emp.jobTitle,
    department: emp.department,
    phone: emp.phone,
    basicSalary: emp.basicSalary,
    allowances: emp.allowances,
    deductions: emp.deductions,
    status: emp.status,
    hireDate: toDateStr(emp.hireDate) || "2021-01-01",
    civilId: emp.civilId,
    iban: emp.iban,
    bankName: emp.bankName,
    civilIdExpiry: toDateStr(emp.civilIdExpiry),
    passportExpiry: toDateStr(emp.passportExpiry),
    healthCardExpiry: toDateStr(emp.healthCardExpiry),
    workPermitExpiry: toDateStr(emp.workPermitExpiry),
    drivingLicenseExpiry: toDateStr(emp.drivingLicenseExpiry),
  }));

  const serializedPayroll = payrollRows.map((row) => ({
    id: row.id,
    month: row.month,
    year: row.year,
    employeeId: row.employeeId,
    employeeCode: row.employee.code,
    employeeName: row.employee.name,
    department: row.employee.department,
    basicSalary: row.basicSalary,
    totalAllowances: row.totalAllowances,
    totalDeductions: row.totalDeductions,
    netSalary: row.netSalary,
    absentDays: row.absentDays,
    lateDays: row.lateDays,
    status: row.status,
  }));

  const serializedAttendance = attendancePack.rows.map((row) => ({
    id: row.id,
    employeeCode: row.employee.code,
    employeeName: row.employee.name,
    date: row.date.toISOString().slice(0, 10),
    status: row.status,
    hoursWorked: row.hoursWorked,
  }));

  return (
    <div style={{ background: "#0a0d12" }} className="min-h-screen">
      <EnterpriseHrCommandHub
        locale={locale}
        initialTab={query.tab}
        employees={serializedEmployees}
        payrollRows={serializedPayroll}
        attendanceRows={serializedAttendance}
        year={year}
        month={month}
        canCreate={can(user, "hr", "create")}
        canEdit={can(user, "hr", "edit")}
      />
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
