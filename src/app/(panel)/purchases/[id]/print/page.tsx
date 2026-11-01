import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { prisma } from "@/lib/db";
import { STATUS_LABEL, formatDate, formatMoney, formatQty } from "@/lib/format";
import { qrDataUrl } from "@/lib/qr";
import { getCompany } from "@/lib/company";
import { can, firstAllowedHref } from "@/lib/permissions";

export const metadata = { title: "طباعة أمر شراء | نظام ERP" };

async function PrintContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "purchases", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: true } } },
  });
  if (!order) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-bold">أمر الشراء غير موجود</p>
        <a href="/purchases" className="mt-3 inline-block font-semibold text-blue-700">
          العودة للمشتريات
        </a>
      </div>
    );
  }

  const qr = await qrDataUrl(`ERP|${order.orderNumber}|${order.totalAmount}|${order.createdAt.toISOString()}`);
  const company = await getCompany();
  return (
    <InvoiceSheet
      data={{
        title: "أمر شراء",
        number: order.orderNumber,
        dateLabel: formatDate(order.createdAt),
        partyLabel: "المورد",
        partyName: order.supplier.name,
        partyPhone: order.supplier.phone ?? "",
        partyEmail: order.supplier.email ?? "",
        statusLabel: STATUS_LABEL[order.status] ?? order.status,
        lines: order.items.map((item) => ({
          id: item.id,
          name: item.product.name,
          code: item.product.code,
          quantity: formatQty(item.quantity),
          price: formatMoney(item.unitCost),
          total: formatMoney(item.totalCost),
        })),
        subtotalLabel: formatMoney(order.totalAmount),
        discountLabel: formatMoney(0),
        totalLabel: formatMoney(order.totalAmount),
        paidLabel: formatMoney(order.paidAmount),
        dueLabel: formatMoney(order.totalAmount - order.paidAmount),
        qrDataUrl: qr,
        backHref: "/purchases",
        companyName: company.name,
        companyMeta: [company.taxNumber ? `الرقم الضريبي ${company.taxNumber}` : "", company.address].filter(Boolean).join(" · ") || "نظام إدارة الموارد",
      }}
    />
  );
}

export default function PurchasePrintPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton title="أمر الشراء" />}>
      <PrintContent params={params} />
    </Suspense>
  );
}
