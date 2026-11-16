import { Suspense } from "react";
import { connection } from "next/server";
import { PaymentCreateForms, PaymentsEmptyBlock } from "@/app/(panel)/payments/payment-forms";
import { requireUser } from "@/lib/erp-auth";
import { DisabledModule, Forbidden, PageHeader, PageSkeleton, PaginationBar, StatusBadge } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { formatDateTime, formatKwd, getUnavailableTooltip, UNAVAILABLE_DASH } from "@/lib/format";
import { PROVIDER_LABEL } from "@/lib/gateways";
import { getLocale, tx } from "@/lib/i18n/server";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { payLinkText, payUrl, waLink } from "@/lib/whatsapp";
import { isModuleEnabled } from "@/lib/modules-db";
import { PAGE_SIZE, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listPaymentLinks } from "@/services/payment-gateway.service";

export const metadata = { title: "Online Payments | AetherBI ERP" };

async function PaymentsContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const uiLocale = locale === "en" ? "en" : "ar";
  const unavailableTip = getUnavailableTooltip(uiLocale);
  const user = await requireUser();
  if (!can(user, "payments", "view") && !can(user, "sales", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("payments"))) {
    return <DisabledModule title={tx(locale, "المدفوعات", "Payments")} />;
  }
  const query = await readQuery(searchParams);
  const [links, organizations] = await Promise.all([
    listPaymentLinks((query.page - 1) * PAGE_SIZE, PAGE_SIZE, query.q),
    prisma.organization.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, take: 25, select: { id: true, name: true } }),
  ]);
  const canCreate = can(user, "payments", "create") || can(user, "sales", "create");
  return (
    <div dir={uiLocale === "en" ? "ltr" : "rtl"} className="space-y-4">
      <PageHeader
        title={tx(locale, "روابط الدفع الإلكتروني", "Online payment links")}
        description={tx(
          locale,
          "رابط عام للفاتورة أو لاشتراك الشركة. الدفع التجريبي يرحّل قيد البنك ويحدّث الفاتورة أو تاريخ الاشتراك.",
          "Public links for invoices or subscriptions. Test payments post bank entries and update invoices or subscription dates.",
        )}
        actions={
          <a
            href="/settings/payments"
            className="ds-surface ds-motion ds-focus-ring inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[var(--ds-bg-hover)]"
            style={{ color: "var(--ds-accent)" }}
          >
            {tx(locale, "إعداد البوابات", "Gateway settings")}
          </a>
        }
      />
      {canCreate ? <PaymentCreateForms organizations={organizations} locale={uiLocale} /> : null}
      <div className="ds-surface overflow-hidden rounded-2xl">
        {links.rows.length === 0 ? (
          <div className="p-4">
            <PaymentsEmptyBlock locale={uiLocale} />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)]" style={{ backgroundColor: "var(--ds-bg-subtle)" }}>
                <tr style={{ color: "var(--ds-text-secondary)" }}>
                  <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "البيان", "Description")}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "البوابة", "Gateway")}</th>
                  <th className="px-4 py-3 text-end text-xs font-bold">{tx(locale, "المبلغ", "Amount")}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "الحالة", "Status")}</th>
                  <th className="px-4 py-3 text-start text-xs font-bold">{tx(locale, "التاريخ (الكويت)", "Date (Kuwait)")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {links.rows.map((row) => {
                  const formattedAmount = formatKwd(row.amount, { locale: uiLocale });
                  const dt = formatDateTime(row.paidAt ?? row.createdAt, { locale: uiLocale });
                  return (
                    <tr key={row.id} className="ds-motion hover:bg-[var(--ds-bg-hover)]">
                      <td className="px-4 py-3">
                        <a
                          className="ds-focus-ring font-bold hover:underline"
                          style={{ color: "var(--ds-accent)" }}
                          href={`/pay/${row.token}`}
                        >
                          {row.invoice?.invoiceNumber ?? row.organization?.name ?? tx(locale, "رابط دفع", "Payment link")}
                        </a>
                        {row.invoice?.customer.phone ? (
                          <div className="mt-1">
                            <WhatsAppButton
                              label={tx(locale, "إرسال رابط الدفع عبر واتساب", "Send payment link via WhatsApp")}
                              href={waLink(
                                row.invoice.customer.phone,
                                payLinkText({
                                  name: row.invoice.customer.name,
                                  number: row.invoice.invoiceNumber,
                                  amount: formattedAmount,
                                  url: payUrl(row.token),
                                }),
                              )}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--ds-text-secondary)" }}>
                        {PROVIDER_LABEL[row.gatewayProvider] ?? row.gatewayProvider}
                      </td>
                      <td className="px-4 py-3 text-end font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formattedAmount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--ds-text-muted)" }}>
                        {dt === UNAVAILABLE_DASH ? (
                          <span title={unavailableTip} aria-label={unavailableTip}>
                            {UNAVAILABLE_DASH}
                          </span>
                        ) : (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {dt}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar path="/payments" params={{ q: query.q }} page={query.page} total={links.total} />
      </div>
    </div>
  );
}

export default function PaymentsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Payments" />}>
      <PaymentsContent searchParams={searchParams} />
    </Suspense>
  );
}
