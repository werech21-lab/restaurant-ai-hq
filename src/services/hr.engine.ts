import { round2 } from "@/lib/format";

export function payrollMath(input: {
  basicSalary: number;
  allowances: number;
  deductions: number;
  absentDays: number;
  lateDays: number;
}) {
  const daily = round2(input.basicSalary / 30);
  const absence = round2(daily * input.absentDays);
  const late = round2(daily * 0.25 * input.lateDays);
  const totalDeductions = round2(input.deductions + absence + late);
  const netSalary = round2(Math.max(input.basicSalary + input.allowances - totalDeductions, 0));
  return { daily, absence, late, totalDeductions, netSalary };
}
