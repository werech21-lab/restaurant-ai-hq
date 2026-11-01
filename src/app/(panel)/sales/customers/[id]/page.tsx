import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { StatementView } from "@/components/statement-view";
import { Forbidden, PageSkeleton, cardClass } from "@/components/erp-ui";
import { can, firstAllowedHref } from "@/lib/permissions";
import { customerStatement } from "@/services/ledger.service";

export const metadata = { title: "كشف حساب عميل | نظام ERP" };

async function StatementContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "sales", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const statement = await customerStatement(id);
  if (!statement) {
    return (
      <div className={`${cardClass} p-8 text-center`}>
        <p className="font-bold">العميل غير موجود</p>
        <a href="/sales?tab=parties" className="mt-3 inline-block font-semibold text-blue-700">
          العودة للعملاء
        </a>
      </div>
    );
  }
  return (
    <StatementView
      statement={statement}
      kind="customer"
      backHref="/sales?tab=parties"
      balanceLabel="الرصيد التراكمي"
      hint="الفاتورة تُسجَّل مديناً وسند القبض دائناً. الرصيد بعد كل حركة هو المتبقي على العميل."
    />
  );
}

export default function CustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton title="كشف الحساب" />}>
      <StatementContent params={params} />
    </Suspense>
  );
}
