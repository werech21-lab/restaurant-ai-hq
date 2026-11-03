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
import { VENTURE_EMPLOYEES } from "@/components/hr/venture-employees-directory";

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

  const phantomCodes = new Set(['100', '200', '300', '400', '433', '500', '600', '700', '800', '900', '950', 'ENABLE-1', '10', 'VF103', 'VF104', 'VF140']);
  const sanitizedDbRows = employeesPack.rows.filter((emp) => !phantomCodes.has(emp.code));

  // Build serialized employees using VENTURE_EMPLOYEES directory for authentic bilingual quadruple names & titles
  const serializedEmployees = VENTURE_EMPLOYEES.map((ve) => {
    const dbEmp = sanitizedDbRows.find((r) => r.code === ve.code);
    const displayName = locale === 'ar' ? ve.nameAr : ve.nameEn;
    const displayJobTitle = locale === 'ar' ? ve.jobTitleAr : ve.jobTitleEn;
    const displayDept = locale === 'ar' ? ve.departmentAr : ve.department;
    return {
      id: dbEmp?.id || ve.id,
      code: ve.code,
      name: displayName,
      jobTitle: displayJobTitle,
      department: displayDept,
      phone: ve.phone,
      basicSalary: dbEmp?.basicSalary ?? ve.basicSalary,
      allowances: dbEmp?.allowances ?? ve.allowances,
      deductions: dbEmp?.deductions ?? ve.deductions,
      status: ve.status,
      hireDate: dbEmp ? (toDateStr(dbEmp.hireDate) || ve.hireDate) : ve.hireDate,
      civilId: ve.civilId,
      iban: ve.iban,
      bankName: ve.bankName,
      civilIdExpiry: ve.civilIdExpiry,
      passportExpiry: ve.passportExpiry,
      healthCardExpiry: ve.healthCardExpiry,
      workPermitExpiry: ve.workPermitExpiry,
      drivingLicenseExpiry: null,
    };
  });

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
