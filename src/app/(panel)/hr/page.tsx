import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageSkeleton } from "@/components/erp-ui";
import { StateBlock } from "@/components/ui";
import { isExcludedOdooEntity } from "@/lib/aether/period-delta";
import { UNAVAILABLE_DASH, formatDate } from "@/lib/format";
import { getLocale, tx } from "@/lib/i18n/server";
import { isModuleEnabled } from "@/lib/modules-db";
import { readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listAttendance, listEmployees, listPayroll } from "@/services/hr.service";
import { EnterpriseHrCommandHub } from "@/components/hr/EnterpriseHrCommandHub";

export const metadata = { title: "الموارد البشرية وشؤون العاملين | شركة فنتشر فودز ذ.م.م." };

function kuwaitYearMonthNow(): { year: number; month: number } {
  const kwDate = formatDate(new Date(), "en");
  const parts = kwDate.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
    return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

async function HrContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const user = await requireUser();
  if (!can(user, "hr", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("hr"))) {
    return <DisabledModule title={tx(locale, "الموارد البشرية", "HR & payroll")} />;
  }

  const query = await readQuery(searchParams);
  const kwNow = kuwaitYearMonthNow();
  const rawYear = Number(query.role);
  const rawMonth = Number(query.filter);
  const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : kwNow.year;
  const month = Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : kwNow.month;

  let employeesPack: Awaited<ReturnType<typeof listEmployees>>;
  let attendancePack: Awaited<ReturnType<typeof listAttendance>>;
  let payrollRows: Awaited<ReturnType<typeof listPayroll>>;

  try {
    [employeesPack, attendancePack, payrollRows] = await Promise.all([
      listEmployees(0, 300, ""),
      listAttendance(0, 120),
      listPayroll(year, month),
    ]);
  } catch {
    return (
      <div className="w-full max-w-none min-w-0 py-6">
        <StateBlock
          state="error"
          locale={locale}
          title={tx(locale, "تعذّر تحميل بيانات الموارد البشرية", "Unable to load HR data")}
          description={tx(
            locale,
            "حدث خلل مؤقت أثناء قراءة سجلات الموارد البشرية. يرجى إعادة المحاولة.",
            "A temporary issue occurred while reading HR records. Please try again.",
          )}
        />
      </div>
    );
  }

  const toKuwaitDateOrNull = (d: Date | null | undefined) => {
    if (!d) return null;
    const formatted = formatDate(d, "en");
    return formatted === UNAVAILABLE_DASH ? null : formatted;
  };

  const phantomCodes = new Set([
    "100",
    "200",
    "300",
    "400",
    "433",
    "500",
    "600",
    "700",
    "800",
    "900",
    "950",
    "ENABLE-1",
    "10",
    "VF103",
    "VF104",
    "VF140",
  ]);

  const sanitizedDbRows = employeesPack.rows.filter(
    (emp) =>
      !phantomCodes.has(emp.code) &&
      !isExcludedOdooEntity(emp.name) &&
      !isExcludedOdooEntity(emp.department),
  );

  const serializedEmployees = sanitizedDbRows.map((dbEmp) => ({
    id: dbEmp.id,
    code: dbEmp.code,
    name: dbEmp.name,
    jobTitle: dbEmp.jobTitle ?? "",
    department: dbEmp.department ?? "",
    phone: dbEmp.phone ?? null,
    basicSalary: dbEmp.basicSalary,
    allowances: dbEmp.allowances,
    deductions: dbEmp.deductions,
    status: dbEmp.status,
    hireDate: toKuwaitDateOrNull(dbEmp.hireDate) ?? "",
    civilId: dbEmp.civilId ?? null,
    iban: dbEmp.iban ?? null,
    bankName: dbEmp.bankName ?? null,
    civilIdExpiry: toKuwaitDateOrNull(dbEmp.civilIdExpiry),
    passportExpiry: toKuwaitDateOrNull(dbEmp.passportExpiry),
    healthCardExpiry: toKuwaitDateOrNull(dbEmp.healthCardExpiry),
    workPermitExpiry: toKuwaitDateOrNull(dbEmp.workPermitExpiry),
    drivingLicenseExpiry: toKuwaitDateOrNull(dbEmp.drivingLicenseExpiry),
  }));

  const serializedPayroll = payrollRows
    .filter(
      (row) =>
        !phantomCodes.has(row.employee.code) &&
        !isExcludedOdooEntity(row.employee.name) &&
        !isExcludedOdooEntity(row.employee.department),
    )
    .map((row) => ({
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

  const serializedAttendance = attendancePack.rows
    .filter(
      (row) =>
        !phantomCodes.has(row.employee.code) &&
        !isExcludedOdooEntity(row.employee.name),
    )
    .map((row) => ({
      id: row.id,
      employeeCode: row.employee.code,
      employeeName: row.employee.name,
      date: toKuwaitDateOrNull(row.date) ?? "",
      status: row.status,
      hoursWorked: row.hoursWorked,
    }));

  return (
    <div className="w-full max-w-none min-w-0">
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
    <Suspense fallback={<PageSkeleton title="HR & Payroll" />}>
      <HrContent searchParams={searchParams} />
    </Suspense>
  );
}
