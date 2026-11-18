import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { StatementView } from "@/components/statement-view";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { customerStatement } from "@/services/ledger.service";

export const metadata = { title: "كشف حساب عميل | نظام ERP" };

async function StatementContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const locale = await getLocale();
  const uiLocale = locale === "en" ? "en" : "ar";
  const user = await requireUser();
  if (!can(user, "sales", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const statement = await customerStatement(id);
  if (!statement) {
    return (
      <div
        dir={uiLocale === "en" ? "ltr" : "rtl"}
        role="status"
        data-state-block="empty"
        className="ds-surface mx-auto max-w-xl rounded-2xl p-8 text-center"
      >
        <p className="text-base font-bold" style={{ color: "var(--ds-text-primary)" }}>
          {tx(locale, "العميل غير موجود", "Customer not found")}
        </p>
        <p className="ds-caption mt-2">
          {tx(
            locale,
            "تعذّر العثور على سجل هذا العميل في قاعدة البيانات.",
            "This customer record could not be located in the database.",
          )}
        </p>
        <a
          href="/erp/cores"
          className="ds-focus-ring mt-4 inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {tx(locale, "العودة للمبيعات والمنيو", "Back to sales & menu")}
        </a>
      </div>
    );
  }
  return (
    <div dir={uiLocale === "en" ? "ltr" : "rtl"}>
      <StatementView
        statement={statement}
        kind="customer"
        backHref="/erp/cores"
        balanceLabel={tx(locale, "الرصيد التراكمي", "Running balance")}
        hint={tx(
          locale,
          "الفاتورة تُسجَّل مديناً وسند القبض دائناً. الرصيد بعد كل حركة هو المتبقي على العميل.",
          "Invoices are debited and receipt vouchers are credited. Running balance reflects remaining amount owed by the customer.",
        )}
      />
    </div>
  );
}

export default function CustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Statement" />}>
      <StatementContent params={params} />
    </Suspense>
  );
}
