import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { runTx, txError } from "@/lib/tx";
import { fail, ok } from "@/lib/types";
import { postPayrollJournal } from "@/services/accounting.engine";
import { payrollMath } from "@/services/hr.engine";

export async function listEmployees(skip: number, take: number, q: string) {
  const where = q
    ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { department: { contains: q } }, { jobTitle: { contains: q } }] }
    : {};
  const [rows, total] = await Promise.all([
    prisma.employee.findMany({ where, skip, take, orderBy: { name: "asc" } }),
    prisma.employee.count({ where }),
  ]);
  return { rows, total };
}

export async function listAttendance(skip: number, take: number) {
  const [rows, total] = await Promise.all([
    prisma.attendance.findMany({
      skip,
      take,
      orderBy: { date: "desc" },
      include: { employee: { select: { name: true, code: true } } },
    }),
    prisma.attendance.count(),
  ]);
  return { rows, total };
}

export async function listPayroll(year: number, month: number) {
  return prisma.payroll.findMany({
    where: { year, month },
    orderBy: { employee: { name: "asc" } },
    include: { employee: true },
  });
}

export async function saveEmployee(input: {
  id?: string;
  code: string;
  name: string;
  jobTitle: string;
  department: string;
  phone: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  status: string;
  civilId?: string;
  iban?: string;
  bankName?: string;
  hireDate?: string;
  civilIdExpiry?: string;
  passportExpiry?: string;
  healthCardExpiry?: string;
  workPermitExpiry?: string;
  drivingLicenseExpiry?: string;
}) {
  const gate = await checkPermission("hr", input.id ? "edit" : "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  if (!(await isModuleEnabled("hr"))) return fail("وحدة الموارد البشرية معطلة");
  const code = cleanText(input.code, 30).toUpperCase();
  const name = cleanText(input.name, 120);
  if (code.length < 2 || name.length < 2) return fail("رمز الموظف والاسم مطلوبان");
  const parseDateOpt = (val?: string) => {
    if (!val) return undefined;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const data = {
    code,
    name,
    jobTitle: cleanText(input.jobTitle, 80) || "موظف",
    department: cleanText(input.department, 80) || "عام",
    phone: cleanText(input.phone, 30),
    basicSalary: round2(Number(input.basicSalary) || 0),
    allowances: round2(Number(input.allowances) || 0),
    deductions: round2(Number(input.deductions) || 0),
    status: ["ACTIVE", "INACTIVE", "ON_VACATION", "OVERSEAS_PIPELINE"].includes(input.status) ? input.status : "ACTIVE",
    ...(input.civilId !== undefined ? { civilId: cleanText(input.civilId, 20) } : {}),
    ...(input.iban !== undefined ? { iban: cleanText(input.iban, 34).toUpperCase() } : {}),
    ...(input.bankName !== undefined ? { bankName: cleanText(input.bankName, 80) } : {}),
    ...(parseDateOpt(input.hireDate) ? { hireDate: parseDateOpt(input.hireDate) } : {}),
    ...(parseDateOpt(input.civilIdExpiry) ? { civilIdExpiry: parseDateOpt(input.civilIdExpiry) } : {}),
    ...(parseDateOpt(input.passportExpiry) ? { passportExpiry: parseDateOpt(input.passportExpiry) } : {}),
    ...(parseDateOpt(input.healthCardExpiry) ? { healthCardExpiry: parseDateOpt(input.healthCardExpiry) } : {}),
    ...(parseDateOpt(input.workPermitExpiry) ? { workPermitExpiry: parseDateOpt(input.workPermitExpiry) } : {}),
    ...(parseDateOpt(input.drivingLicenseExpiry) ? { drivingLicenseExpiry: parseDateOpt(input.drivingLicenseExpiry) } : {}),
  };
  if (input.id) await prisma.employee.update({ where: { id: input.id }, data });
  else await prisma.employee.create({ data });
  await prisma.activityLog.create({
    data: { userId: gate.user.id, action: input.id ? "EDIT" : "CREATE", module: "hr", details: `${input.id ? "تعديل" : "إنشاء"} موظف ${name}` },
  });
  return ok("تم حفظ ملف الموظف");
}

export async function recordAttendance(input: {
  employeeId: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
}) {
  const gate = await checkPermission("hr", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const status = ["PRESENT", "ABSENT", "LATE", "LEAVE"].includes(input.status) ? input.status : "PRESENT";
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const checkIn = input.checkIn ? new Date(`${stamp}T${input.checkIn}:00`) : null;
  const checkOut = input.checkOut ? new Date(`${stamp}T${input.checkOut}:00`) : null;
  let hoursWorked = 0;
  if (checkIn && checkOut && checkOut > checkIn) hoursWorked = round2((checkOut.getTime() - checkIn.getTime()) / 3600000);
  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: input.employeeId, date } },
    update: { status, checkIn, checkOut, hoursWorked },
    create: { employeeId: input.employeeId, date, status, checkIn, checkOut, hoursWorked },
  });
  await prisma.activityLog.create({
    data: { userId: gate.user.id, action: "CREATE", module: "hr", details: `تسجيل حضور ${status}` },
  });
  return ok("تم تسجيل الحركة اليومية");
}

export async function generatePayroll(year: number, month: number) {
  const gate = await checkPermission("hr", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" } });
  let created = 0;
  for (const employee of employees) {
    const existing = await prisma.payroll.findUnique({
      where: { employeeId_month_year: { employeeId: employee.id, month, year } },
    });
    if (existing) continue;
    const rows = await prisma.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: start, lt: end } },
    });
    const absentDays = rows.filter((row) => row.status === "ABSENT").length;
    const lateDays = rows.filter((row) => row.status === "LATE").length;
    const math = payrollMath({
      basicSalary: employee.basicSalary,
      allowances: employee.allowances,
      deductions: employee.deductions,
      absentDays,
      lateDays,
    });
    await prisma.payroll.create({
      data: {
        month,
        year,
        employeeId: employee.id,
        basicSalary: employee.basicSalary,
        totalAllowances: employee.allowances,
        totalDeductions: math.totalDeductions,
        netSalary: math.netSalary,
        absentDays,
        lateDays,
        status: "DRAFT",
      },
    });
    created += 1;
  }
  await prisma.activityLog.create({
    data: {
      userId: gate.user.id,
      action: "CREATE",
      module: "hr",
      details: `توليد مسير ${month}/${year} لعدد ${created} موظف`,
    },
  });
  return ok(created === 0 ? "المسير موجود مسبقاً لهذا الشهر" : `تم إنشاء ${created} قيداً في المسير`);
}

export async function payPayroll(year: number, month: number, method: "CASH" | "BANK") {
  const gate = await checkPermission("hr", "edit");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const userId = gate.user.id;
  return runTx(async (tx) => {
    const rows = await tx.payroll.findMany({ where: { year, month, status: "DRAFT" }, include: { employee: true } });
    if (rows.length === 0) txError("لا توجد رواتب مسودة لهذا الشهر");
    const total = round2(rows.reduce((sum, row) => sum + row.netSalary, 0));
    if (total <= 0.001) txError("صافي المسير صفر");
    await postPayrollJournal(tx, {
      amount: total,
      reference: `${year}-${String(month).padStart(2, "0")}`,
      createdById: userId,
      method,
      referenceId: `${year}-${month}`,
    });
    await tx.payroll.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { status: "PAID", paidAt: new Date() },
    });
    await writeActivity(tx, {
      userId,
      action: "CREATE",
      module: "hr",
      details: `صرف رواتب ${month}/${year} بصافي ${total} عبر ${method === "BANK" ? "البنك" : "الصندوق"}`,
    });
  });
}
