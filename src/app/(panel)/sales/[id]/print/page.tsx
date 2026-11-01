import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { STATUS_LABEL, formatDate, formatMoney, formatQty } from "@/lib/format";
import { qrDataUrl } from "@/lib/qr";
import { invoiceText, payUrl, waLink } from "@/lib/whatsapp";
import { getCompany } from "@/lib/company";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "طباعة فاتورة بيع | نظام ERP" };

async function PrintContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  await connection();
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();
  if (!can(user, "sales", "view") && !can(user, "pos", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true } } },
  });
  if (!invoice) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-bold">الفاتورة غير موجودة</p>
        <a href="/sales" className="mt-3 inline-block font-semibold text-blue-700">
          العودة للمبيعات
        </a>
      </div>
    );
  }

  const pendingPay = await prisma.paymentLink.findFirst({
    where: { invoiceId: invoice.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  const qr = await qrDataUrl(`ERP|${invoice.invoiceNumber}|${invoice.totalAmount}|${invoice.createdAt.toISOString()}`);
  const company = await getCompany();
  return (
    <InvoiceSheet
      data={{
        title: "فاتورة مبيعات",
        number: invoice.invoiceNumber,
        dateLabel: formatDate(invoice.createdAt),
        partyLabel: "العميل",
        partyName: invoice.customer.name,
        partyPhone: invoice.customer.phone ?? "",
        partyEmail: invoice.customer.email ?? "",
        statusLabel: STATUS_LABEL[invoice.status] ?? invoice.status,
        lines: invoice.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          code: item.product.code,
          quantity: formatQty(item.quantity),
          price: formatMoney(item.unitPrice),
          total: formatMoney(item.totalPrice),
        })),
        subtotalLabel: formatMoney(invoice.subtotal),
        discountLabel: formatMoney(invoice.discount),
        totalLabel: formatMoney(invoice.totalAmount),
        paidLabel: formatMoney(invoice.paidAmount),
        dueLabel: formatMoney(invoice.totalAmount - invoice.paidAmount),
        qrDataUrl: qr,
        backHref: "/sales",
        companyName: company.name,
        companyMeta: [company.taxNumber ? `الرقم الضريبي ${company.taxNumber}` : "", company.taxRate ? `ضريبة ${company.taxRate}%` : "", company.address].filter(Boolean).join(" · ") || "نظام إدارة الموارد",
        whatsappHref: waLink(
          invoice.customer.phone ?? "",
          invoiceText({
            customerName: invoice.customer.name,
            number: invoice.invoiceNumber,
            lines: invoice.items.map((item) => ({
              name: item.product.name,
              quantity: formatQty(item.quantity),
              total: formatMoney(item.totalPrice),
            })),
            total: formatMoney(invoice.totalAmount),
            payUrl: pendingPay ? payUrl(pendingPay.token) : undefined,
          }),
        ),
      }}
      initialMode={query.layout === "thermal" ? "thermal" : "a4"}
    />
  );
}

export default function SalesPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton title="فاتورة البيع" />}>
      <PrintContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
