import type { Queryable } from '@/lib/db'
import type { Product } from '@/modules/inventory/domain/types'
import {
  PRODUCT_PAGE_SIZE,
  type CreateProductInput,
  type ListProductsQuery,
  type UpdateProductInput,
} from '@/modules/inventory/schemas/product'

type ProductRow = Omit<Product, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

// price is numeric(10,3) in KWD. Multiplying by 1000 is exact, so no float is involved.
const PRODUCT_COLUMNS = `id, name, category, (price * 1000)::bigint as "priceMinor", 'KWD'::text as currency, available, version,
  created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`

function toProduct(row: ProductRow): Product {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

export async function insertProduct(tx: Queryable, tenantId: string, userId: string, input: CreateProductInput): Promise<Product> {
  const result = await tx.query<ProductRow>(
    `insert into products (tenant_id, name, category, price, available, created_by)
     values ($1, $2, $3, $4::bigint::numeric / 1000, $5, $6)
     returning ${PRODUCT_COLUMNS}`,
    [tenantId, input.name, input.category, input.priceMinor, input.available, userId]
  )
  return toProduct(result.rows[0])
}

export async function findProduct(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Product | null> {
  const result = await tx.query<ProductRow>(
    `select ${PRODUCT_COLUMNS} from products where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toProduct(result.rows[0]) : null
}

export async function updateProduct(tx: Queryable, tenantId: string, id: string, input: UpdateProductInput): Promise<Product | null> {
  const result = await tx.query<ProductRow>(
    `update products set name = $4, category = $5, price = $6::bigint::numeric / 1000, available = $7, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3
     returning ${PRODUCT_COLUMNS}`,
    [tenantId, id, input.version, input.name, input.category, input.priceMinor, input.available]
  )
  return result.rows[0] ? toProduct(result.rows[0]) : null
}

export async function removeProduct(tx: Queryable, tenantId: string, id: string, version: number): Promise<boolean> {
  const result = await tx.query('delete from products where tenant_id = $1 and id = $2 and version = $3', [tenantId, id, version])
  return (result.rowCount ?? 0) > 0
}

export async function listProducts(tx: Queryable, tenantId: string, query: ListProductsQuery): Promise<{ rows: Product[]; total: number }> {
  const params: unknown[] = [tenantId]
  let filter = ''
  if (query.q) {
    params.push(likePattern(query.q))
    filter = ` and (name ilike $${params.length} or category ilike $${params.length})`
  }
  const total = await tx.query<{ total: number }>(`select count(*)::bigint as total from products where tenant_id = $1${filter}`, params)
  params.push(PRODUCT_PAGE_SIZE, (query.page - 1) * PRODUCT_PAGE_SIZE)
  const rows = await tx.query<ProductRow>(
    `select ${PRODUCT_COLUMNS} from products where tenant_id = $1${filter}
     order by created_at desc, id desc limit $${params.length - 1} offset $${params.length}`,
    params
  )
  return { rows: rows.rows.map(toProduct), total: total.rows[0].total }
}
