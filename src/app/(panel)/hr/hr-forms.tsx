"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generatePayrollAction, payPayrollAction, recordAttendanceAction, saveEmployeeAction } from "@/app/actions/hr";
import { Alert, btnPrimary, fieldClass } from "@/components/erp-ui";

export function HrForms({
  employees,
  year,
  month,
  canCreate,
  canEdit,
}: {
  employees: Array<{ id: string; name: string }>;
  year: number;
  month: number;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function saveEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await saveEmployeeAction({
      code: String(form.get("code") || ""),
      name: String(form.get("name") || ""),
      jobTitle: String(form.get("jobTitle") || ""),
      department: String(form.get("department") || ""),
      phone: String(form.get("phone") || ""),
      basicSalary: Number(form.get("basicSalary") || 0),
      allowances: Number(form.get("allowances") || 0),
      deductions: Number(form.get("deductions") || 0),
      status: "ACTIVE",
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم الحفظ");
      router.refresh();
    }
  }

  async function attend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await recordAttendanceAction({
      employeeId: String(form.get("employeeId") || ""),
      status: String(form.get("status") || "PRESENT"),
      checkIn: String(form.get("checkIn") || ""),
      checkOut: String(form.get("checkOut") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم التسجيل");
      router.refresh();
    }
  }

  return (
    <div className="mb-4 space-y-3">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {canCreate ? (
          <form onSubmit={saveEmployee} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
            <p className="font-bold md:col-span-2">موظف جديد</p>
            <input name="code" className={fieldClass} placeholder="الرمز" required />
            <input name="name" className={fieldClass} placeholder="الاسم" required />
            <input name="jobTitle" className={fieldClass} placeholder="المسمى" />
            <input name="department" className={fieldClass} placeholder="القسم" />
            <input name="phone" className={fieldClass} placeholder="الهاتف" />
            <input name="basicSalary" dir="ltr" className={fieldClass} placeholder="الراتب الأساسي" defaultValue="0" />
            <input name="allowances" dir="ltr" className={fieldClass} placeholder="البدلات" defaultValue="0" />
            <input name="deductions" dir="ltr" className={fieldClass} placeholder="الاستقطاعات الثابتة" defaultValue="0" />
            <button className={btnPrimary} disabled={pending}>حفظ الموظف</button>
          </form>
        ) : null}
        {canCreate ? (
          <form onSubmit={attend} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold">حضور اليوم</p>
            <select name="employeeId" className={fieldClass} required>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
            <select name="status" className={fieldClass} defaultValue="PRESENT">
              <option value="PRESENT">حاضر</option>
              <option value="LATE">متأخر</option>
              <option value="ABSENT">غائب</option>
              <option value="LEAVE">إجازة</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input name="checkIn" type="time" className={fieldClass} defaultValue="08:00" />
              <input name="checkOut" type="time" className={fieldClass} defaultValue="16:00" />
            </div>
            <button className={btnPrimary} disabled={pending}>تسجيل الحركة</button>
          </form>
        ) : null}
      </div>
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={pending} onClick={async () => {
            const result = await generatePayrollAction(year, month);
            if (!result.ok) setError(result.message);
            else {
              setMessage(result.message || "تم التوليد");
              router.refresh();
            }
          }}>توليد مسير {month}/{year}</button>
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold" onClick={async () => {
            const result = await payPayrollAction(year, month, "CASH");
            if (!result.ok) setError(result.message);
            else {
              setMessage(result.message || "تم الصرف");
              router.refresh();
            }
          }}>صرف من الصندوق</button>
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold" onClick={async () => {
            const result = await payPayrollAction(year, month, "BANK");
            if (!result.ok) setError(result.message);
            else {
              setMessage(result.message || "تم الصرف");
              router.refresh();
            }
          }}>صرف من البنك</button>
        </div>
      ) : null}
    </div>
  );
}
