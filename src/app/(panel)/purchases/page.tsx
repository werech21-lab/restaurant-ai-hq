import { Suspense } from "react";
import { connection } from "next/server";
import { Prisma } from "@prisma/client";
import {
  confirmDraftPurchase,
  createPurchaseOrder,
  deleteSupplier,
  recordSupplierPayment,
  saveSupplier,
} from "@/app/actions/purchases";
import { searchSuppliers } from "@/app/actions/search";
import { requireUser } from "@/lib/erp-auth";
import { DocumentDetail } from "@/components/document-detail";
import { TradePanel } from "@/components/trade-panel";
import { Forbidden, PageSkeleton } from "@/components/erp-ui";
import { formatQty } from "@/lib/format";
import { dateFor, getLocale, moneyFor, tx } from "@/lib/i18n/server";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getActiveScope, purchaseOrderNumbersForScope } from "@/lib/scope";
import { SmartIngestLaunchButton } from "@/components/SmartIngestLaunchButton";

export const metadata = { title: "Purchases | AetherBI ERP" };

const statuses = new Set(["PAID", "PARTIAL", "UNPAID"]);

async function PurchasesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const locale = await getLocale();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "purchases", "view")) return <Forbidden href={firstAllowedHref(user)} />;

  const scope = await getActiveScope(query);
  const purchaseNumbers = await purchaseOrderNumbersForScope(scope.warehouseIds);
  const tab = query.tab === "parties" ? "parties" : "documents";
  const status = statuses.has(query.status) ? query.status : "";
  const skip = (query.page - 1) * PAGE_SIZE;
  let total = 0;
  let orders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
    createdAt: Date;
    supplier: { name: string };
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
    const where: Prisma.SupplierWhereInput = query.q
      ? { OR: [{ name: { contains: query.q } }, { phone: { contains: query.q } }, { email: { contains: query.q } }] }
      : {};
    const [count, rows] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({ where, orderBy: { name: "asc" }, skip, take: PAGE_SIZE }),
    ]);
    total = count;
    parties = rows;
  } else {
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(purchaseNumbers
        ? { orderNumber: { in: purchaseNumbers.length ? purchaseNumbers : ["__none__"] } }
        : {}),
      ...(status ? { status } : {}),
      ...(query.q
        ? { OR: [{ orderNumber: { contains: query.q } }, { supplier: { name: { contains: query.q } } }] }
        : {}),
    };
    const [count, rows] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
    ]);
    total = count;
    orders = rows;
  }

  const detail = query.doc
    ? await prisma.purchaseOrder.findUnique({
        where: { id: query.doc },
        include: { supplier: true, items: { include: { product: true } } },
      })
    : null;

  return (
    <div>
      <div className="mb-4">
        <SmartIngestLaunchButton module="purchases" locale={locale} />
      </div>
      {detail ? (
        <DocumentDetail
          closeHref={pageHref("/purchases", { tab, q: query.q, status, page: query.page })}
          title={tx(locale, "أمر شراء", "Purchase order")}
          number={detail.orderNumber}
          partyLabel={tx(locale, "المورد", "Supplier")}
          party={detail.supplier.name}
          dateLabel={dateFor(locale, detail.createdAt)}
          status={detail.status}
          totalLabel={moneyFor(locale, detail.totalAmount)}
          paidLabel={moneyFor(locale, detail.paidAmount)}
          dueLabel={moneyFor(locale, detail.totalAmount - detail.paidAmount)}
          printHref={`/purchases/${detail.id}/print`}
          lines={detail.items.map((item) => ({
            id: item.id,
            name: item.product.name,
            code: item.product.code,
            quantity: formatQty(item.quantity),
            price: moneyFor(locale, item.unitCost),
            total: moneyFor(locale, item.totalCost),
          }))}
        />
      ) : null}
      <TradePanel
        basePath="/purchases"
        title={tx(locale, "المشتريات والموردون", "Purchases & suppliers")}
        description={tx(
          locale,
          "أمر الشراء يزيد المخزون، يسجل حركة وارد، ويحمّل المورد بالمبلغ المتبقي.",
          "Each purchase order increases stock, records an inbound movement, and updates supplier payable balance.",
        )}
        tab={tab}
        q={query.q}
        page={query.page}
        total={total}
        status={status}
        canCreate={can(user, "purchases", "create")}
        canEdit={can(user, "purchases", "edit")}
        canDelete={can(user, "purchases", "delete")}
        createLabel={tx(locale, "أمر شراء جديد", "New purchase order")}
        partyNoun={tx(locale, "المورد", "Supplier")}
        partyPlural={tx(locale, "الموردون", "Suppliers")}
        paymentTitle={tx(locale, "تسجيل دفعة لمورد", "Record supplier payment")}
        paymentHint={tx(
          locale,
          "تُخصم الدفعة من رصيد المورد وتوزَّع على أقدم الأوامر غير المسددة.",
          "Payment reduces supplier balance and applies to oldest unpaid orders.",
        )}
        mode="purchase"
        priceKey="costPrice"
        submitLabel={tx(locale, "حفظ أمر الشراء", "Save purchase order")}
        searchParties={searchSuppliers}
        createDocument={createPurchaseOrder}
        saveParty={saveSupplier}
        removeParty={deleteSupplier}
        recordPayment={recordSupplierPayment}
        confirmDraft={confirmDraftPurchase}
        orders={orders.map((row) => ({
          id: row.id,
          number: row.orderNumber,
          party: row.supplier.name,
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

export default function PurchasesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="Purchases" />}>
      <PurchasesContent searchParams={searchParams} />
    </Suspense>
  );
}
