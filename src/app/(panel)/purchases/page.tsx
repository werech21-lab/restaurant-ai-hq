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
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { PAGE_SIZE, pageHref, readQuery, type RawQuery } from "@/lib/pagination";
import { can, firstAllowedHref } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export const metadata = { title: "المشتريات | نظام ERP" };

const statuses = new Set(["PAID", "PARTIAL", "UNPAID"]);

async function PurchasesContent({ searchParams }: { searchParams: Promise<RawQuery> }) {
  await connection();
  const query = await readQuery(searchParams);
  const user = await requireUser();
  if (!can(user, "purchases", "view")) return <Forbidden href={firstAllowedHref(user)} />;

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
      {detail ? (
        <DocumentDetail
          closeHref={pageHref("/purchases", { tab, q: query.q, status, page: query.page })}
          title="أمر شراء"
          number={detail.orderNumber}
          partyLabel="المورد"
          party={detail.supplier.name}
          dateLabel={formatDate(detail.createdAt)}
          status={detail.status}
          totalLabel={formatMoney(detail.totalAmount)}
          paidLabel={formatMoney(detail.paidAmount)}
          dueLabel={formatMoney(detail.totalAmount - detail.paidAmount)}
          printHref={`/purchases/${detail.id}/print`}
          lines={detail.items.map((item) => ({
            id: item.id,
            name: item.product.name,
            code: item.product.code,
            quantity: formatQty(item.quantity),
            price: formatMoney(item.unitCost),
            total: formatMoney(item.totalCost),
          }))}
        />
      ) : null}
      <TradePanel
        basePath="/purchases"
        title="المشتريات والموردون"
        description="أمر الشراء يزيد المخزون، يسجل حركة وارد، ويحمّل المورد بالمبلغ المتبقي."
        tab={tab}
        q={query.q}
        page={query.page}
        total={total}
        status={status}
        canCreate={can(user, "purchases", "create")}
        canEdit={can(user, "purchases", "edit")}
        canDelete={can(user, "purchases", "delete")}
        createLabel="أمر شراء جديد"
        partyNoun="المورد"
        partyPlural="الموردون"
        paymentTitle="تسجيل دفعة لمورد"
        paymentHint="تُخصم الدفعة من رصيد المورد وتوزَّع على أقدم الأوامر غير المسددة."
        mode="purchase"
        priceKey="costPrice"
        submitLabel="حفظ أمر الشراء"
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
          dateLabel: formatDate(row.createdAt),
          totalLabel: formatMoney(row.totalAmount),
          paidLabel: formatMoney(row.paidAmount),
          status: row.status,
        }))}
        parties={parties.map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone ?? "",
          email: row.email ?? "",
          balance: row.balance,
          balanceLabel: formatMoney(row.balance),
          customData: row.customData,
        }))}
      />
    </div>
  );
}

export default function PurchasesPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  return (
    <Suspense fallback={<PageSkeleton title="المشتريات" />}>
      <PurchasesContent searchParams={searchParams} />
    </Suspense>
  );
}
