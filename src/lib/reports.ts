import { prisma } from '@/lib/db'
import { salesWhereForScope } from '@/lib/scope'

export async function salesSummary(start?: Date, end?: Date, warehouseIds: string[] = []) {
  const where = {
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
    ...salesWhereForScope(warehouseIds),
  }
  const aggregate = await prisma.salesInvoice.aggregate({
    where,
    _sum: { totalAmount: true },
    _count: true,
  })
  return {
    total: aggregate._sum.totalAmount ?? 0,
    count: aggregate._count,
  }
}

export async function purchaseSummary(start?: Date, end?: Date, orderNumbers: string[] | null = null) {
  const where = {
    status: { not: 'DRAFT' },
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
    ...(orderNumbers ? { orderNumber: { in: orderNumbers.length ? orderNumbers : ['__none__'] } } : {}),
  }
  const aggregate = await prisma.purchaseOrder.aggregate({
    where,
    _sum: { totalAmount: true },
    _count: true,
  })
  return {
    total: aggregate._sum.totalAmount ?? 0,
    count: aggregate._count,
  }
}

export async function costOfGoods(start?: Date, end?: Date, warehouseIds: string[] = []) {
  if (warehouseIds.length) {
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        warehouseId: { in: warehouseIds },
        ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
      },
      select: { id: true },
    })
    const ids = invoices.map((row) => row.id)
    if (!ids.length) return 0
    const items = await prisma.salesInvoiceItem.findMany({
      where: { salesInvoiceId: { in: ids } },
      include: { product: { select: { costPrice: true } } },
    })
    return items.reduce((sum, item) => sum + item.quantity * item.product.costPrice, 0)
  }

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
        `
  return Number(rows[0]?.cogs ?? 0)
}

export async function inventoryValuation(warehouseIds: string[] = []) {
  if (warehouseIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: warehouseIds } },
      include: { product: { select: { costPrice: true, sellingPrice: true } } },
    })
    return {
      costValue: stocks.reduce((sum, row) => sum + row.quantity * row.product.costPrice, 0),
      sellValue: stocks.reduce((sum, row) => sum + row.quantity * row.product.sellingPrice, 0),
    }
  }
  const rows = await prisma.$queryRaw<
    Array<{ costValue: number | bigint | null; sellValue: number | bigint | null }>
  >`
    SELECT SUM(currentStock * costPrice) as costValue,
           SUM(currentStock * sellingPrice) as sellValue
    FROM Product
  `
  return {
    costValue: Number(rows[0]?.costValue ?? 0),
    sellValue: Number(rows[0]?.sellValue ?? 0),
  }
}
