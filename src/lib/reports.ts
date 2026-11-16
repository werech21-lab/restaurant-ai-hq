import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isHiddenWarehouseLabel, HIDDEN_PANEL_PRODUCT_CODES, visibleInvoiceWhere, visibleProductWhere, visiblePurchaseWhere } from '@/lib/panel-visibility'
import { salesWhereForScope } from '@/lib/scope'

export async function visibleWarehouseIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const rows = await prisma.warehouse.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, name: true, location: true },
  })
  const allowed = new Set(
    rows
      .filter((row) => !isHiddenWarehouseLabel([row.code, row.name, row.location]))
      .map((row) => row.id),
  )
  return ids.filter((id) => allowed.has(id))
}

export async function salesSummary(start?: Date, end?: Date, warehouseIds: string[] = []) {
  const visibleIds = await visibleWarehouseIds(warehouseIds)
  if (warehouseIds.length && !visibleIds.length) return { total: 0, count: 0 }
  const where = visibleInvoiceWhere({
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
    ...salesWhereForScope(visibleIds),
  })
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

function excludedProductSql(column: string): Prisma.Sql {
  return Prisma.sql`AND ${Prisma.raw(column)} NOT IN (${Prisma.join([...HIDDEN_PANEL_PRODUCT_CODES])})`
}

export async function purchaseSummary(start?: Date, end?: Date, orderNumbers: string[] | null = null) {
  const where = visiblePurchaseWhere({
    status: { not: 'DRAFT' },
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
    ...(orderNumbers ? { orderNumber: { in: orderNumbers.length ? orderNumbers : ['__none__'] } } : {}),
  })
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
  const visibleIds = await visibleWarehouseIds(warehouseIds)
  if (warehouseIds.length && !visibleIds.length) return 0
  if (visibleIds.length) {
    const invoices = await prisma.salesInvoice.findMany({
      where: visibleInvoiceWhere({
        warehouseId: { in: visibleIds },
        ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
      }),
      select: { id: true },
    })
    const ids = invoices.map((row) => row.id)
    if (!ids.length) return 0
    const items = await prisma.salesInvoiceItem.findMany({
      where: { salesInvoiceId: { in: ids }, product: visibleProductWhere() },
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
          ${excludedProductSql('p.code')}
        `
      : await prisma.$queryRaw<Array<{ cogs: number | bigint | null }>>`
          SELECT SUM(i.quantity * p.costPrice) as cogs
          FROM SalesInvoiceItem i
          JOIN Product p ON p.id = i.productId
          WHERE 1 = 1
          ${excludedProductSql('p.code')}
        `
  return Number(rows[0]?.cogs ?? 0)
}

export async function inventoryValuation(warehouseIds: string[] = []) {
  const visibleIds = await visibleWarehouseIds(warehouseIds)
  if (warehouseIds.length && !visibleIds.length) return { costValue: 0, sellValue: 0 }
  if (visibleIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: visibleIds }, product: visibleProductWhere() },
      include: { product: { select: { code: true, costPrice: true, sellingPrice: true } } },
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
    WHERE 1 = 1
    ${excludedProductSql('code')}
  `
  return {
    costValue: Number(rows[0]?.costValue ?? 0),
    sellValue: Number(rows[0]?.sellValue ?? 0),
  }
}
