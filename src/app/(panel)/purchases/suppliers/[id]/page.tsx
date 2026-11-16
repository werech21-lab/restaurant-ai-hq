import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { StatementView } from "@/components/statement-view";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { supplierStatement } from "@/services/ledger.service";

export const metadata = { title: "كشف حساب مورد | نظام ERP" };

async function StatementContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const locale = await getLocale();
  const uiLocale = locale === "en" ? "en" : "ar";
  const user = await requireUser();
  if (!can(user, "purchases", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const statement = await supplierStatement(id);
  if (!statement) {
    return (
      <div
        dir={uiLocale === "en" ? "ltr" : "rtl"}
        role="status"
        data-state-block="empty"
        className="ds-surface mx-auto max-w-xl rounded-2xl p-8 text-center"
      >
        <p className="text-base font-bold" style={{ color: "var(--ds-text-primary)" }}>
          {tx(locale, "المورد غير موجود", "Supplier not found")}
        </p>
        <p className="ds-caption mt-2">
          {tx(
            locale,
            "تعذّر العثور على سجل هذا المورد في قاعدة البيانات.",
            "This supplier record could not be located in the database.",
          )}
        </p>
        <a
          href="/purchases?tab=parties"
          className="ds-focus-ring mt-4 inline-flex min-h-10 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {tx(locale, "العودة للموردين", "Back to suppliers")}
        </a>
      </div>
    );
  }
  return (
    <div dir={uiLocale === "en" ? "ltr" : "rtl"}>
      <StatementView
        statement={statement}
        kind="supplier"
        backHref="/purchases?tab=parties"
        balanceLabel={tx(locale, "الرصيد التراكمي", "Running balance")}
        hint={tx(
          locale,
          "أمر الشراء يُسجَّل دائناً وسند الصرف مديناً. الرصيد بعد كل حركة هو المستحق للمورد.",
          "Purchase orders are credited and payment vouchers are debited. Running balance reflects payable amount due to the supplier.",
        )}
      />
    </div>
  );
}

export default function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Statement" />}>
      <StatementContent params={params} />
    </Suspense>
  );
}
