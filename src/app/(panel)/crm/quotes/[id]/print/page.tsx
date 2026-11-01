import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { isModuleEnabled } from "@/lib/modules-db";
import { can, firstAllowedHref } from "@/lib/permissions";
import { qrDataUrl } from "@/lib/qr";
import { quoteText, waLink } from "@/lib/whatsapp";

export const metadata = { title: "طباعة عرض سعر | نظام ERP" };

const QUOTE_STATUS: Record<string, string> = {
  DRAFT: "مسودة",
  SENT: "مُرسل",
  ACCEPTED: "مقبول",
  CONVERTED: "محوّل لفاتورة",
};

async function PrintContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await requireUser();
  if (!can(user, "crm", "view") && !can(user, "sales", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  if (!(await isModuleEnabled("crm"))) return <Forbidden href="/crm" />;
  const { id } = await params;
  const quote = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: true, lead: true, items: { include: { product: true } } },
  });
  if (!quote) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-bold">عرض السعر غير موجود</div>;
  const company = await getCompany();
  const partyName = quote.customer?.name || quote.lead?.contactName || "عميل محتمل";
  const qr = await qrDataUrl(`ERP|${quote.quoteNumber}|${quote.totalAmount}|${quote.createdAt.toISOString()}`);
  return (
    <InvoiceSheet
      data={{
        title: "عرض سعر",
        number: quote.quoteNumber,
        dateLabel: formatDate(quote.createdAt),
        partyLabel: "موجه إلى",
        partyName,
        partyPhone: quote.customer?.phone || quote.lead?.phone || "",
        partyEmail: quote.customer?.email || quote.lead?.email || "",
        statusLabel: QUOTE_STATUS[quote.status] ?? quote.status,
        lines: quote.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          code: item.product.code,
          quantity: formatQty(item.quantity),
          price: formatMoney(item.unitPrice, company.currency),
          total: formatMoney(item.totalPrice, company.currency),
        })),
        subtotalLabel: formatMoney(quote.totalAmount, company.currency),
        discountLabel: formatMoney(0, company.currency),
        totalLabel: formatMoney(quote.totalAmount, company.currency),
        paidLabel: company.taxRate ? `ضريبة الشركة ${company.taxRate}% غير مضافة` : formatMoney(0, company.currency),
        dueLabel: quote.validUntil ? `ساري حتى ${formatDate(quote.validUntil)}` : "بدون تاريخ انتهاء",
        qrDataUrl: qr,
        backHref: "/crm?tab=quotes",
        companyName: company.name,
        companyMeta: [company.taxNumber ? `الرقم الضريبي ${company.taxNumber}` : "", company.invoiceFooter].filter(Boolean).join(" · "),
        whatsappLabel: "إرسال العرض عبر واتساب",
        whatsappHref: waLink(
          quote.customer?.phone || quote.lead?.phone || "",
          quoteText({
            name: partyName,
            number: quote.quoteNumber,
            lines: quote.items.map((item) => ({
              name: item.product.name,
              quantity: formatQty(item.quantity),
              total: formatMoney(item.totalPrice, company.currency),
            })),
            total: formatMoney(quote.totalAmount, company.currency),
          }),
        ),
      }}
    />
  );
}

export default function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton title="عرض السعر" />}>
      <PrintContent params={params} />
    </Suspense>
  );
}
