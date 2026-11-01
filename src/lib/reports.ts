import { prisma } from "@/lib/db";

export async function salesSummary(start?: Date, end?: Date) {
  const where = start && end ? { createdAt: { gte: start, lt: end } } : {};
  const aggregate = await prisma.salesInvoice.aggregate({
    where,
    _sum: { totalAmount: true },
    _count: true,
  });
  return {
    total: aggregate._sum.totalAmount ?? 0,
    count: aggregate._count,
  };
}

export async function purchaseSummary(start?: Date, end?: Date) {
  const where = {
    status: { not: "DRAFT" },
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
  };
  const aggregate = await prisma.purchaseOrder.aggregate({
    where,
    _sum: { totalAmount: true },
    _count: true,
  });
  return {
    total: aggregate._sum.totalAmount ?? 0,
    count: aggregate._count,
  };
}

export async function costOfGoods(start?: Date, end?: Date) {
  const rows =
    start && end
      ? await prisma.$queryRaw<Array<{ cogs: number | bigint | null }>>`
          SELECT SUM(i.quantity * p.costPrice) as cogs
          FROM SalesInvoiceItem i
          JOIN Product p ON p.id = i.productId
          JOIN SalesInvoice s ON s.id = i.salesInvoiceId
          WHERE s.createdAt >= ${start} AND s.createdAt < ${end}
        `
      : await prisma.$queryRaw<Array<{ cogs: number | bigint | null }>>`
          SELECT SUM(i.quantity * p.costPrice) as cogs
          FROM SalesInvoiceItem i
          JOIN Product p ON p.id = i.productId
        `;
  return Number(rows[0]?.cogs ?? 0);
}

export async function inventoryValuation() {
  const rows = await prisma.$queryRaw<
    Array<{ costValue: number | bigint | null; sellValue: number | bigint | null }>
  >`
    SELECT SUM(currentStock * costPrice) as costValue,
           SUM(currentStock * sellingPrice) as sellValue
    FROM Product
  `;
  return {
    costValue: Number(rows[0]?.costValue ?? 0),
    sellValue: Number(rows[0]?.sellValue ?? 0),
  };
}
