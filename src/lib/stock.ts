import { prisma } from "@/lib/db";
import { PAGE_SIZE, likeContains } from "@/lib/pagination";

export async function countLowStock() {
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
    SELECT COUNT(*) as count FROM Product WHERE currentStock <= reorderLevel
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function listLowStock(limit: number) {
  const ids = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Product
    WHERE currentStock <= reorderLevel
    ORDER BY (reorderLevel - currentStock) DESC, name ASC
    LIMIT ${limit}
  `;
  return hydrateProducts(ids.map((row) => row.id));
}

export async function queryProducts(options: { q: string; page: number; lowStock: boolean }) {
  const skip = (options.page - 1) * PAGE_SIZE;
  if (!options.lowStock) {
    const where = options.q
      ? {
          OR: [{ name: { contains: options.q } }, { code: { contains: options.q } }],
        }
      : {};
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
    ]);
    return { total, rows };
  }

  const like = likeContains(options.q);
  const idQuery = options.q
    ? prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Product
        WHERE currentStock <= reorderLevel
          AND (name LIKE ${like} ESCAPE '\\' OR code LIKE ${like} ESCAPE '\\')
        ORDER BY name ASC
        LIMIT ${PAGE_SIZE} OFFSET ${skip}
      `
    : prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Product
        WHERE currentStock <= reorderLevel
        ORDER BY name ASC
        LIMIT ${PAGE_SIZE} OFFSET ${skip}
      `;
  const countQuery = options.q
    ? prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
        SELECT COUNT(*) as count FROM Product
        WHERE currentStock <= reorderLevel
          AND (name LIKE ${like} ESCAPE '\\' OR code LIKE ${like} ESCAPE '\\')
      `
    : prisma.$queryRaw<Array<{ count: number | bigint | null }>>`
        SELECT COUNT(*) as count FROM Product WHERE currentStock <= reorderLevel
      `;
  const [idRows, countRows] = await Promise.all([idQuery, countQuery]);
  const rows = await hydrateProducts(idRows.map((row) => row.id));
  return { total: Number(countRows[0]?.count ?? 0), rows };
}

async function hydrateProducts(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { category: { select: { id: true, name: true } } },
  });
  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
