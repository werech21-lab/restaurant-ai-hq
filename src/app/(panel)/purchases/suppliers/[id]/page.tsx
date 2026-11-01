import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { StatementView } from "@/components/statement-view";
import { Forbidden, PageSkeleton, cardClass } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";
import { supplierStatement } from "@/services/ledger.service";

export const metadata = { title: "كشف حساب مورد | نظام ERP" };

async function StatementContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "purchases", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const statement = await supplierStatement(id);
  if (!statement) {
    return (
      <div className={`${cardClass} p-8 text-center`}>
        <p className="font-bold">المورد غير موجود</p>
        <a href="/purchases?tab=parties" className="mt-3 inline-block font-semibold text-blue-700">
          العودة للموردين
        </a>
      </div>
    );
  }
  return (
    <StatementView
      statement={statement}
      kind="supplier"
      backHref="/purchases?tab=parties"
      balanceLabel="الرصيد التراكمي"
      hint="أمر الشراء يُسجَّل دائناً وسند الصرف مديناً. الرصيد بعد كل حركة هو المستحق للمورد."
    />
  );
}

export default function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton title="كشف الحساب" />}>
      <StatementContent params={params} />
    </Suspense>
  );
}
