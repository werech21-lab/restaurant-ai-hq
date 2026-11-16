import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEMO_CUSTOMER_EMAILS,
  DEMO_INVOICE_NUMBERS,
  DEMO_PRODUCT_CODES,
  DEMO_PURCHASE_NUMBERS,
  demoCatalogReadsHidden,
} from '@/lib/demo-catalog'
import { salesWhereForScope } from '@/lib/scope'

function hideDemoSales() {
  if (!demoCatalogReadsHidden()) return {}
  return {
    invoiceNumber: { notIn: [...DEMO_INVOICE_NUMBERS] },
    customer: { email: { notIn: [...DEMO_CUSTOMER_EMAILS] } },
  }
}

function hideDemoProducts() {
  if (!demoCatalogReadsHidden()) return {}
  return { code: { notIn: [...DEMO_PRODUCT_CODES] } }
}

export async function salesSummary(start?: Date, end?: Date, warehouseIds: string[] = []) {
  const where = {
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
    ...salesWhereForScope(warehouseIds),
    ...hideDemoSales(),
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

function excludedProductSql(column: string): Prisma.Sql {
  if (!demoCatalogReadsHidden()) return Prisma.sql``
  return Prisma.sql`AND ${Prisma.raw(column)} NOT IN (${Prisma.join([...DEMO_PRODUCT_CODES])})`
}

export async function purchaseSummary(start?: Date, end?: Date, orderNumbers: string[] | null = null) {
  const hidden: string[] = demoCatalogReadsHidden() ? [...DEMO_PURCHASE_NUMBERS] : []
  const limited = orderNumbers ? orderNumbers.filter((number) => !hidden.includes(number)) : null
  const where = {
    status: { not: 'DRAFT' },
    ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
    ...(limited ? { orderNumber: { in: limited.length ? limited : ['__none__'] } } : {}),
    ...(!limited && hidden.length ? { orderNumber: { notIn: hidden } } : {}),
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
        ...hideDemoSales(),
      },
      select: { id: true },
    })
    const ids = invoices.map((row) => row.id)
    if (!ids.length) return 0
    const items = await prisma.salesInvoiceItem.findMany({
      where: { salesInvoiceId: { in: ids }, product: hideDemoProducts() },
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
  if (warehouseIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: warehouseIds }, product: hideDemoProducts() },
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
