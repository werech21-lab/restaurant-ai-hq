import { prisma } from '@/lib/db'
import { isHiddenWarehouseLabel, visibleInvoiceWhere, visibleProductWhere, visiblePurchaseWhere } from '@/lib/panel-visibility'

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

/** The default All view is every warehouse that is not on the exclusion list. */
export async function scopeWarehouseIds(requested: string[] = []): Promise<string[]> {
  if (requested.length) return visibleWarehouseIds(requested)
  const rows = await prisma.warehouse.findMany({
    select: { id: true, code: true, name: true, location: true },
  })
  return rows.filter((row) => !isHiddenWarehouseLabel([row.code, row.name, row.location])).map((row) => row.id)
}

function warehouseClause(requested: string[], visibleIds: string[]): { warehouseId?: { in: string[] }; OR?: Array<{ warehouseId: string | null } | { warehouseId: { in: string[] } }> } {
  if (!visibleIds.length) return { warehouseId: { in: ['__none__'] } }
  if (requested.length) return { warehouseId: { in: visibleIds } }
  return { OR: [{ warehouseId: null }, { warehouseId: { in: visibleIds } }] }
}

export async function salesSummary(start?: Date, end?: Date, warehouseIds: string[] = []) {
  const visibleIds = await scopeWarehouseIds(warehouseIds)
  if (!visibleIds.length) return { total: 0, count: 0 }
  const invoices = await prisma.salesInvoice.findMany({
    where: visibleInvoiceWhere({
      ...(start && end ? { createdAt: { gte: start, lt: end } } : {}),
      ...warehouseClause(warehouseIds, visibleIds),
    }),
    select: { id: true },
  })
  if (!invoices.length) return { total: 0, count: 0 }
  const items = await prisma.salesInvoiceItem.findMany({
    where: { salesInvoiceId: { in: invoices.map((row) => row.id) }, product: visibleProductWhere() },
    select: { quantity: true, unitPrice: true },
  })
  return {
    total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    count: invoices.length,
  }
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
  const visibleIds = await scopeWarehouseIds(warehouseIds)
  if (!visibleIds.length) return 0
  const invoices = await prisma.salesInvoice.findMany({
    where: visibleInvoiceWhere({
      ...warehouseClause(warehouseIds, visibleIds),
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

export async function inventoryValuation(warehouseIds: string[] = []) {
  const visibleIds = await scopeWarehouseIds(warehouseIds)
  if (!visibleIds.length) return { costValue: 0, sellValue: 0 }
  const stocks = await prisma.warehouseStock.findMany({
    where: { warehouseId: { in: visibleIds }, product: visibleProductWhere() },
    include: { product: { select: { code: true, costPrice: true, sellingPrice: true } } },
  })
  return {
    costValue: stocks.reduce((sum, row) => sum + row.quantity * row.product.costPrice, 0),
    sellValue: stocks.reduce((sum, row) => sum + row.quantity * row.product.sellingPrice, 0),
  }
}
