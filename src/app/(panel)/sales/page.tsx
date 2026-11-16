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
import { formatDate, formatKwd, formatQty } from "@/lib/format";
import { getLocale, tx } from "@/lib/i18n/server";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { visibleCustomerWhere, visibleInvoiceWhere, visibleProductWhere } from "@/lib/panel-visibility";
import { scopeWarehouseIds } from "@/lib/reports";
import { getActiveScope } from "@/lib/scope";
import { invoiceText, payUrl, waLink } from "@/lib/whatsapp";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";
import { SalesCommandCenter } from "@/components/sales/SalesCommandCenter";

export const metadata = { title: "Sales Command Center | AetherBI ERP" };

const statuses = new Set(["PAID", "PARTIAL", "UNPAID"]);

async function SalesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const uiLocale = locale === "en" ? "en" : "ar";
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
    items: Array<{ totalPrice: number }>;
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
    const where: Prisma.CustomerWhereInput = visibleCustomerWhere(
      query.q
        ? { OR: [{ name: { contains: query.q } }, { phone: { contains: query.q } }, { email: { contains: query.q } }] }
        : {},
    );
    const [count, rows] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({ where, orderBy: { name: "asc" }, skip, take: PAGE_SIZE }),
    ]);
    total = count;
    parties = rows;
  } else {
    const warehouseIds = await scopeWarehouseIds(scope.warehouseIds);
    const where: Prisma.SalesInvoiceWhereInput = visibleInvoiceWhere({
      AND: [
        scope.warehouseIds.length
          ? { warehouseId: { in: warehouseIds.length ? warehouseIds : ["__none__"] } }
          : { OR: [{ warehouseId: null }, { warehouseId: { in: warehouseIds.length ? warehouseIds : ["__none__"] } }] },
        ...(status ? [{ status }] : []),
        ...(query.q
          ? [{ OR: [{ invoiceNumber: { contains: query.q } }, { customer: { name: { contains: query.q } } }] }]
          : []),
      ],
    });
    const [count, rows] = await Promise.all([
      prisma.salesInvoice.count({ where }),
      prisma.salesInvoice.findMany({
        where,
        include: {
          customer: { select: { name: true } },
          items: { where: { product: visibleProductWhere() }, select: { totalPrice: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
    ]);
    total = count;
    orders = rows;
  }

  const detail = query.doc
    ? await prisma.salesInvoice.findFirst({
        where: visibleInvoiceWhere({ id: query.doc }),
        include: { customer: true, items: { where: { product: visibleProductWhere() }, include: { product: true } } },
      })
    : null;
  const visibleDetailTotal = detail ? detail.items.reduce((sum, item) => sum + item.totalPrice, 0) : 0;
  const pendingLink = detail
    ? await prisma.paymentLink.findFirst({
        where: { invoiceId: detail.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const due = detail ? Math.max(0, visibleDetailTotal - detail.paidAmount) : 0;

  const initialTab =
    query.doc || query.tab === "parties" || query.tab === "documents" || query.tab === "live-invoices"
      ? "live-invoices"
      : "scorecard";

  return (
    <SalesCommandCenter
      initialLocale={uiLocale}
      initialTab={initialTab}
      liveChildren={
        <div dir={uiLocale === "en" ? "ltr" : "rtl"} className="space-y-4">
          <div className="mb-2">
            <SmartIngestLaunchButton module="sales_delivery" locale={locale} />
          </div>
          {detail ? (
            <DocumentDetail
              closeHref={pageHref("/sales", { tab, q: query.q, status, page: query.page })}
              title={tx(locale, "فاتورة بيع", "Sales invoice")}
              number={detail.invoiceNumber}
              partyLabel={tx(locale, "العميل", "Customer")}
              party={detail.customer.name}
              dateLabel={formatDate(detail.createdAt, { locale: uiLocale })}
              status={detail.status}
              discountLabel={formatKwd(detail.discount, { locale: uiLocale })}
              totalLabel={formatKwd(visibleDetailTotal, { locale: uiLocale })}
              paidLabel={formatKwd(detail.paidAmount, { locale: uiLocale })}
              dueLabel={formatKwd(Math.max(0, visibleDetailTotal - detail.paidAmount), { locale: uiLocale })}
              printHref={`/sales/${detail.id}/print`}
              extra={
                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--ds-border-hairline)] px-5 py-4">
                  {due > 0.001 && (can(user, "payments", "create") || can(user, "sales", "create")) ? (
                    <InvoicePayLinkButton invoiceId={detail.id} existingToken={pendingLink?.token} locale={uiLocale} />
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
                          total: formatKwd(item.totalPrice, { locale: uiLocale }),
                        })),
                        total: formatKwd(visibleDetailTotal, { locale: uiLocale }),
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
                price: formatKwd(item.unitPrice, { locale: uiLocale }),
                total: formatKwd(item.totalPrice, { locale: uiLocale }),
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
              dateLabel: formatDate(row.createdAt, { locale: uiLocale }),
              totalLabel: formatKwd(row.items.reduce((sum, item) => sum + item.totalPrice, 0), { locale: uiLocale }),
              paidLabel: formatKwd(row.paidAmount, { locale: uiLocale }),
              status: row.status,
            }))}
            parties={parties.map((row) => ({
              id: row.id,
              name: row.name,
              phone: row.phone ?? "",
              email: row.email ?? "",
              balance: row.balance,
              balanceLabel: formatKwd(row.balance, { locale: uiLocale }),
              customData: row.customData,
            }))}
          />
        </div>
      }
    />
  );
}

export default function SalesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Sales" />}>
      <SalesContent searchParams={searchParams} />
    </Suspense>
  );
}
