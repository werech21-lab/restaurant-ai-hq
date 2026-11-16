import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { PAGE_SIZE, likeContains } from '@/lib/pagination'
import { HIDDEN_PANEL_PRODUCT_CODES, isHiddenPanelProduct, withVisibleProducts } from '@/lib/panel-visibility'
import { visibleWarehouseIds } from '@/lib/reports'

const hiddenProductSql = Prisma.sql`AND code NOT IN (${Prisma.join([...HIDDEN_PANEL_PRODUCT_CODES])})`

export async function countLowStock(warehouseIds: string[] = []) {
  const visibleIds = await visibleWarehouseIds(warehouseIds)
  if (warehouseIds.length && !visibleIds.length) return 0
  if (visibleIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: visibleIds }, product: { code: { notIn: [...HIDDEN_PANEL_PRODUCT_CODES] } } },
      include: { product: { select: { code: true, name: true, reorderLevel: true } } },
    })
    const byProduct = new Map<string, { qty: number; reorder: number; hidden: boolean }>()
    for (const row of stocks) {
      if (isHiddenPanelProduct(row.product.code, row.product.name)) continue
      const prev = byProduct.get(row.productId)
      if (prev) prev.qty += row.quantity
      else byProduct.set(row.productId, { qty: row.quantity, reorder: row.product.reorderLevel, hidden: false })
    }
    return Array.from(byProduct.values()).filter((row) => row.qty <= row.reorder).length
  }
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
    SELECT COUNT(*) as count FROM Product WHERE currentStock <= reorderLevel
    ${hiddenProductSql}
  `
  return Number(rows[0]?.count ?? 0)
}

export async function listLowStock(limit: number, warehouseIds: string[] = []) {
  const visibleIds = await visibleWarehouseIds(warehouseIds)
  if (warehouseIds.length && !visibleIds.length) return []
  if (visibleIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: visibleIds }, product: { code: { notIn: [...HIDDEN_PANEL_PRODUCT_CODES] } } },
      include: {
        product: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    })
    const merged = new Map<
      string,
      (typeof stocks)[number]['product'] & { currentStock: number }
    >()
    for (const row of stocks) {
      if (isHiddenPanelProduct(row.product.code, row.product.name)) continue
      const prev = merged.get(row.productId)
      if (prev) prev.currentStock += row.quantity
      else merged.set(row.productId, { ...row.product, currentStock: row.quantity })
    }
    return Array.from(merged.values())
      .filter((product) => product.currentStock <= product.reorderLevel)
      .sort((a, b) => b.reorderLevel - b.currentStock - (a.reorderLevel - a.currentStock))
      .slice(0, limit)
  }
  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Product
    WHERE currentStock <= reorderLevel
    ${hiddenProductSql}
    ORDER BY (reorderLevel - currentStock) DESC, name ASC
    LIMIT ${limit}
  `
  return hydrateProducts(ids.map((row) => row.id))
}

export async function queryProducts(options: {
  q: string
  page: number
  lowStock: boolean
  warehouseIds?: string[]
}) {
  const requested = options.warehouseIds ?? []
  const warehouseIds = await visibleWarehouseIds(requested)
  const skip = (options.page - 1) * PAGE_SIZE
  if (requested.length && !warehouseIds.length) return { total: 0, rows: [] }

  if (warehouseIds.length) {
    const stocks = await prisma.warehouseStock.findMany({
      where: { warehouseId: { in: warehouseIds } },
      include: {
        product: {
          include: { category: { select: { id: true, name: true } } },
        },
      },
    })
    const merged = new Map<string, (typeof stocks)[number]['product'] & { currentStock: number }>()
    for (const row of stocks) {
      const prev = merged.get(row.productId)
      if (prev) prev.currentStock += row.quantity
      else merged.set(row.productId, { ...row.product, currentStock: row.quantity })
    }
    let rows = Array.from(merged.values()).filter((product) => !isHiddenPanelProduct(product.code, product.name))
    if (options.q) {
      const q = options.q.toLowerCase()
      rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    }
    if (options.lowStock) rows = rows.filter((p) => p.currentStock <= p.reorderLevel)
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return { total: rows.length, rows: rows.slice(skip, skip + PAGE_SIZE) }
  }

  if (!options.lowStock) {
    const where = withVisibleProducts(
      options.q
        ? {
            OR: [{ name: { contains: options.q } }, { code: { contains: options.q } }],
          }
        : {},
    )
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
    ])
    return { total, rows }
  }

  const like = likeContains(options.q)
  const idQuery = options.q
    ? prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Product
        WHERE currentStock <= reorderLevel
          AND (name LIKE ${like} ESCAPE '\\' OR code LIKE ${like} ESCAPE '\\')
          ${hiddenProductSql}
        ORDER BY name ASC
        LIMIT ${PAGE_SIZE} OFFSET ${skip}
      `
    : prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Product
        WHERE currentStock <= reorderLevel
        ${hiddenProductSql}
        ORDER BY name ASC
        LIMIT ${PAGE_SIZE} OFFSET ${skip}
      `
  const countQuery = options.q
    ? prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
        SELECT COUNT(*) as count FROM Product
        WHERE currentStock <= reorderLevel
          AND (name LIKE ${like} ESCAPE '\\' OR code LIKE ${like} ESCAPE '\\')
          ${hiddenProductSql}
      `
    : prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
        SELECT COUNT(*) as count FROM Product WHERE currentStock <= reorderLevel
        ${hiddenProductSql}
      `
  const [idRows, countRows] = await Promise.all([idQuery, countQuery])
  const rows = await hydrateProducts(idRows.map((row) => row.id))
  return { total: Number(countRows[0]?.count ?? 0), rows }
}

async function hydrateProducts(ids: string[]) {
  if (ids.length === 0) return []
  const rows = await prisma.product.findMany({
    where: withVisibleProducts({ id: { in: ids } }),
    include: { category: { select: { id: true, name: true } } },
  })
  const order = new Map(ids.map((id, index) => [id, index]))
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}
