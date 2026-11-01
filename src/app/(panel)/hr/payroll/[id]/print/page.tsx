import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { PrintButton } from "@/components/print-button";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { can, firstAllowedHref } from "@/lib/permissions";
import { qrDataUrl } from "@/lib/qr";

export const metadata = { title: "طباعة مسير راتب | نظام ERP" };

async function PrintContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireUser();
  if (!can(user, "hr", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const { id } = await params;
  const row = await prisma.payroll.findUnique({ where: { id }, include: { employee: true } });
  if (!row) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-bold">المسير غير موجود</div>;
  const company = await getCompany();
  const qr = await qrDataUrl(`ERP|PAY|${row.employee.code}|${row.netSalary}|${row.year}-${row.month}`);
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6">
      <div className="no-print mb-4 flex justify-between">
        <a href="/hr?tab=payroll" className="font-semibold text-blue-700">رجوع</a>
        <PrintButton label="طباعة القسيمة" />
      </div>
      <header className="flex items-start justify-between border-b border-slate-900 pb-4">
        <div>
          <p className="text-lg font-bold">{company.name}</p>
          <p className="text-sm text-slate-600">{company.taxNumber ? `الرقم الضريبي ${company.taxNumber}` : "مسير رواتب"}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">قسيمة راتب</p>
          <p className="text-xl font-bold">{row.month}/{row.year}</p>
        </div>
      </header>
      <section className="mt-4 text-sm">
        <p className="font-bold">{row.employee.name}</p>
        <p>{row.employee.jobTitle} · {row.employee.department}</p>
        <p dir="ltr">{row.employee.code}</p>
      </section>
      <table className="mt-4 w-full text-sm">
        <tbody>
          <tr className="border-b border-slate-200"><td className="py-2">الراتب الأساسي</td><td>{formatMoney(row.basicSalary, company.currency)}</td></tr>
          <tr className="border-b border-slate-200"><td className="py-2">البدلات</td><td>{formatMoney(row.totalAllowances, company.currency)}</td></tr>
          <tr className="border-b border-slate-200"><td className="py-2">الاستقطاعات شامل الغياب والتأخير</td><td>{formatMoney(row.totalDeductions, company.currency)}</td></tr>
          <tr className="border-b border-slate-200"><td className="py-2">أيام الغياب / التأخير</td><td>{row.absentDays} / {row.lateDays}</td></tr>
          <tr><td className="py-2 font-bold">الصافي</td><td className="font-bold">{formatMoney(row.netSalary, company.currency)}</td></tr>
        </tbody>
      </table>
      <p className="mt-3 text-sm">{row.status === "PAID" ? `مصروف ${row.paidAt ? formatDate(row.paidAt) : ""}` : "مسودة لم تُصرف"}</p>
      <img src={qr} alt="رمز QR" className="mt-4 h-28 w-28" />
      <p className="mt-4 text-sm text-slate-600">{company.invoiceFooter}</p>
    </article>
  );
}

export default function PayrollPrintPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton title="قسيمة الراتب" />}>
      <PrintContent params={params} />
    </Suspense>
  );
}
