"use server";

import { revalidatePath } from "next/cache";
import { generatePayroll, payPayroll, recordAttendance, saveEmployee } from "@/services/hr.service";

async function done<T extends { ok: boolean }>(result: T) {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveEmployeeAction(input: {
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
  return done(await saveEmployee(input));
}

export async function recordAttendanceAction(input: { employeeId: string; status: string; checkIn?: string; checkOut?: string }) {
  return done(await recordAttendance(input));
}

export async function generatePayrollAction(year: number, month: number) {
  return done(await generatePayroll(year, month));
}

export async function payPayrollAction(year: number, month: number, method: "CASH" | "BANK") {
  return done(await payPayroll(year, month, method));
}
