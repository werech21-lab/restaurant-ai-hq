import { Suspense } from "react";
import { connection } from "next/server";
import { Prisma } from "@prisma/client";
import { createSalesInvoice, deleteCustomer, recordCustomerPayment, saveCustomer } from "@/app/actions/sales";
import { searchCustomers } from "@/app/actions/search";
import { requireUser } from "@/lib/erp-auth";
import { InvoicePayLinkButton } from "@/app/(panel)/payments/payment-forms";
import { DocumentDetail } from "@/components/document-detail";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { TradePanel } from "@/components/trade-panel";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { formatQty } from "@/lib/format";
import { dateFor, getLocale, moneyFor, tx } from "@/lib/i18n/server";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getActiveScope, salesWhereForScope } from "@/lib/scope";
import { invoiceText, payUrl, waLink } from "@/lib/whatsapp";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";

export const metadata = { title: "Sales | AetherBI ERP" };

const statuses = new Set(["PAID", "PARTIAL", "UNPAID"]);

async function SalesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "sales", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const scope = await getActiveScope(query);
  const tab = query.tab === "parties" ? "parties" : "documents";
  const status = statuses.has(query.status) ? query.status : "";
  const skip = (query.page - 1) * PAGE_SIZE;
  let total = 0;
  let orders: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
    createdAt: Date;
    customer: { name: string };
  }> = [];
  let parties: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    balance: number;
    customData: string;
  }> = [];

  if (tab === "parties") {
    const where: Prisma.CustomerWhereInput = query.q
      ? { OR: [{ name: { contains: query.q } }, { phone: { contains: query.q } }, { email: { contains: query.q } }] }
      : {};
    const [count, rows] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({ where, orderBy: { name: "asc" }, skip, take: PAGE_SIZE }),
    ]);
    total = count;
    parties = rows;
  } else {
    const where: Prisma.SalesInvoiceWhereInput = {
      ...salesWhereForScope(scope.warehouseIds),
      ...(status ? { status } : {}),
      ...(query.q
        ? { OR: [{ invoiceNumber: { contains: query.q } }, { customer: { name: { contains: query.q } } }] }
        : {}),
    };
    const [count, rows] = await Promise.all([
      prisma.salesInvoice.count({ where }),
      prisma.salesInvoice.findMany({
        where,
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
    ]);
    total = count;
    orders = rows;
  }

  const detail = query.doc
    ? await prisma.salesInvoice.findUnique({
        where: { id: query.doc },
        include: { customer: true, items: { include: { product: true } } },
      })
    : null;
  const pendingLink = detail
    ? await prisma.paymentLink.findFirst({
        where: { invoiceId: detail.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const due = detail ? detail.totalAmount - detail.paidAmount : 0;

  return (
    <div>
      <div className="mb-4">
        <SmartIngestLaunchButton module="sales_delivery" locale={locale} />
      </div>
      {detail ? (
        <DocumentDetail
          closeHref={pageHref("/sales", { tab, q: query.q, status, page: query.page })}
          title={tx(locale, "فاتورة بيع", "Sales invoice")}
          number={detail.invoiceNumber}
          partyLabel={tx(locale, "العميل", "Customer")}
          party={detail.customer.name}
          dateLabel={dateFor(locale, detail.createdAt)}
          status={detail.status}
          discountLabel={moneyFor(locale, detail.discount)}
          totalLabel={moneyFor(locale, detail.totalAmount)}
          paidLabel={moneyFor(locale, detail.paidAmount)}
          dueLabel={moneyFor(locale, detail.totalAmount - detail.paidAmount)}
          printHref={`/sales/${detail.id}/print`}
          extra={
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-4">
              {due > 0.001 && (can(user, "payments", "create") || can(user, "sales", "create")) ? (
                <InvoicePayLinkButton invoiceId={detail.id} existingToken={pendingLink?.token} />
              ) : null}
              <WhatsAppButton
                label={tx(locale, "إرسال الفاتورة عبر واتساب", "Send invoice via WhatsApp")}
                href={waLink(
                  detail.customer.phone ?? "",
                  invoiceText({
                    customerName: detail.customer.name,
                    number: detail.invoiceNumber,
                    lines: detail.items.map((item) => ({
                      name: item.product.name,
                      quantity: formatQty(item.quantity),
                      total: moneyFor(locale, item.totalPrice),
                    })),
                    total: moneyFor(locale, detail.totalAmount),
                    payUrl: pendingLink ? payUrl(pendingLink.token) : undefined,
                  }),
                )}
              />
            </div>
          }
          lines={detail.items.map((item) => ({
            id: item.id,
            name: item.product.name,
            code: item.product.code,
            quantity: formatQty(item.quantity),
            price: moneyFor(locale, item.unitPrice),
            total: moneyFor(locale, item.totalPrice),
          }))}
        />
      ) : null}
      <TradePanel
        basePath="/sales"
        title={tx(locale, "المبيعات والعملاء", "Sales & customers")}
        description={tx(
          locale,
          "الفاتورة تتحقق من الكمية، تخصم المخزون، وتسجل الخصم وسند القبض ومديونية العميل في معاملة واحدة.",
          "Each invoice validates stock, deducts inventory, and records discount, receipt, and customer balance in one transaction.",
        )}
        tab={tab}
        q={query.q}
        page={query.page}
        total={total}
        status={status}
        canCreate={can(user, "sales", "create")}
        canEdit={can(user, "sales", "edit")}
        canDelete={can(user, "sales", "delete")}
        createLabel={tx(locale, "فاتورة جديدة", "New invoice")}
        partyNoun={tx(locale, "العميل", "Customer")}
        partyPlural={tx(locale, "العملاء", "Customers")}
        paymentTitle={tx(locale, "تحصيل دفعة من عميل", "Collect customer payment")}
        paymentHint={tx(
          locale,
          "يُخصم التحصيل من مديونية العميل ويوزَّع على أقدم الفواتير غير المسددة.",
          "Payment reduces customer balance and applies to oldest unpaid invoices.",
        )}
        mode="sale"
        priceKey="sellingPrice"
        submitLabel={tx(locale, "حفظ فاتورة البيع", "Save sales invoice")}
        searchParties={searchCustomers}
        createDocument={createSalesInvoice}
        saveParty={saveCustomer}
        removeParty={deleteCustomer}
        recordPayment={recordCustomerPayment}
        orders={orders.map((row) => ({
          id: row.id,
          number: row.invoiceNumber,
          party: row.customer.name,
          dateLabel: dateFor(locale, row.createdAt),
          totalLabel: moneyFor(locale, row.totalAmount),
          paidLabel: moneyFor(locale, row.paidAmount),
          status: row.status,
        }))}
        parties={parties.map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone ?? "",
          email: row.email ?? "",
          balance: row.balance,
          balanceLabel: moneyFor(locale, row.balance),
          customData: row.customData,
        }))}
      />
    </div>
  );
}

export default function SalesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Sales" />}>
      <SalesContent searchParams={searchParams} />
    </Suspense>
  );
}
