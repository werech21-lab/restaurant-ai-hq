import { Suspense } from "react";
import { connection } from "next/server";
import { PaymentCreateForms } from "@/app/(panel)/payments/payment-forms";
import { requireUser } from "@/lib/erp-auth";
import { DataCard, DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar, StatusBadge } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { PROVIDER_LABEL } from "@/lib/gateways";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { payLinkText, payUrl, waLink } from "@/lib/whatsapp";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listPaymentLinks } from "@/services/payment-gateway.service";

export const metadata = { title: "المدفوعات الإلكترونية | نظام ERP" };

async function PaymentsContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const user = await requireUser();
  if (!can(user, "payments", "view") && !can(user, "sales", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("payments"))) return <DisabledModule title="المدفوعات" />;
  const query = await readQuery(searchParams);
  const [links, organizations] = await Promise.all([
    listPaymentLinks((query.page - 1) * PAGE_SIZE, PAGE_SIZE, query.q),
    prisma.organization.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, take: 25, select: { id: true, name: true } }),
  ]);
  const canCreate = can(user, "payments", "create") || can(user, "sales", "create");
  return (
    <div>
      <PageHeader
        title="روابط الدفع الإلكتروني"
        description="رابط عام للفاتورة أو لاشتراك الشركة. الدفع التجريبي يرحّل قيد البنك ويحدّث الفاتورة أو تاريخ الاشتراك."
        actions={
          <a href="/settings/payments" className="text-sm font-semibold text-blue-700">
            إعداد البوابات
          </a>
        }
      />
      {canCreate ? <PaymentCreateForms organizations={organizations} /> : null}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-semibold">البيان</th>
                <th className="px-4 py-3 text-right font-semibold">البوابة</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {links.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-4 py-3">
                    <a className="font-bold text-blue-700" href={`/pay/${row.token}`}>
                      {row.invoice?.invoiceNumber ?? row.organization?.name ?? "رابط دفع"}
                    </a>
                    {row.invoice?.customer.phone ? (
                      <div className="mt-1">
                        <WhatsAppButton
                          label="إرسال رابط الدفع عبر واتساب"
                          href={waLink(
                            row.invoice.customer.phone,
                            payLinkText({
                              name: row.invoice.customer.name,
                              number: row.invoice.invoiceNumber,
                              amount: formatMoney(row.amount, row.currency),
                              url: payUrl(row.token),
                            }),
                          )}
                        />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{PROVIDER_LABEL[row.gatewayProvider] ?? row.gatewayProvider}</td>
                  <td className="px-4 py-3 font-semibold">{formatMoney(row.amount, row.currency)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">{formatDate(row.paidAt ?? row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar path="/payments" params={{ q: query.q }} page={query.page} total={links.total} />
      </DataCard>
    </div>
  );
}

export default function PaymentsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="المدفوعات" />}>
      <PaymentsContent searchParams={searchParams} />
    </Suspense>
  );
}
