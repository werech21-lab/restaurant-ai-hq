import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { Branch, Brand } from '@/modules/org/domain/types'
import type {
  CreateBranchInput,
  CreateBrandInput,
  ListBranchesQuery,
  ListBrandsQuery,
  UpdateBranchInput,
  UpdateBrandInput,
} from '@/modules/org/schemas/org'

type Stamped<T> = Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

const BRAND_COLUMNS = `b.id, b.code, b.name, b.status, b.version,
  (select count(*)::int from branches x where x.tenant_id = b.tenant_id and x.brand_id = b.id) as "branchCount",
  b.created_at as "createdAt", b.updated_at as "updatedAt", b.created_by as "createdBy"`

const BRANCH_COLUMNS = `c.id, c.brand_id as "brandId", b.name as "brandName", c.code, c.name, c.timezone, c.status, c.version,
  c.created_at as "createdAt", c.updated_at as "updatedAt", c.created_by as "createdBy"`

const BRANCH_FROM = 'branches c join brands b on b.tenant_id = c.tenant_id and b.id = c.brand_id'

function stamp<T extends { createdAt: Date; updatedAt: Date }>(row: T): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

// ---- brands ----

export async function insertBrand(tx: Queryable, tenantId: string, userId: string, input: CreateBrandInput): Promise<Brand> {
  const inserted = await tx.query<{ id: string }>(
    'insert into brands (tenant_id, code, name, status, created_by) values ($1, $2, $3, $4, $5) returning id',
    [tenantId, input.code, input.name, input.status, userId]
  )
  const created = await findBrand(tx, tenantId, inserted.rows[0].id)
  if (!created) throw new Error('Inserted brand could not be read back')
  return created
}

export async function findBrand(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Brand | null> {
  if (options.lock) await tx.query('select 1 from brands where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<Stamped<Brand>>(`select ${BRAND_COLUMNS} from brands b where b.tenant_id = $1 and b.id = $2`, [tenantId, id])
  return result.rows[0] ? (stamp(result.rows[0]) as Brand) : null
}

export async function updateBrand(tx: Queryable, tenantId: string, id: string, input: UpdateBrandInput): Promise<boolean> {
  const result = await tx.query('update brands set name = $4, status = $5, version = version + 1 where tenant_id = $1 and id = $2 and version = $3', [
    tenantId,
    id,
    input.version,
    input.name,
    input.status,
  ])
  return (result.rowCount ?? 0) > 0
}

export async function countActiveBranches(tx: Queryable, tenantId: string, brandId: string): Promise<number> {
  const result = await tx.query<{ n: number }>(`select count(*)::int as n from branches where tenant_id = $1 and brand_id = $2 and status = 'active'`, [tenantId, brandId])
  return result.rows[0].n
}

export async function listBrands(tx: Queryable, tenantId: string, query: ListBrandsQuery): Promise<Page<Brand>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and b.status = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'name', column: { sql: 'name', cast: 'text' }, direction: 'asc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<Stamped<Brand> & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${BRAND_COLUMNS} from brands b where b.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'name', 'asc')
  return { data: page.data.map((row) => stamp(row) as Brand), nextCursor: page.nextCursor }
}

// ---- branches ----

export async function insertBranch(tx: Queryable, tenantId: string, userId: string, input: CreateBranchInput): Promise<Branch> {
  const inserted = await tx.query<{ id: string }>(
    'insert into branches (tenant_id, brand_id, code, name, timezone, status, created_by) values ($1, $2, $3, $4, $5, $6, $7) returning id',
    [tenantId, input.brandId, input.code, input.name, input.timezone, input.status, userId]
  )
  const created = await findBranch(tx, tenantId, inserted.rows[0].id)
  if (!created) throw new Error('Inserted branch could not be read back')
  return created
}

export async function findBranch(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Branch | null> {
  if (options.lock) await tx.query('select 1 from branches where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<Stamped<Branch>>(`select ${BRANCH_COLUMNS} from ${BRANCH_FROM} where c.tenant_id = $1 and c.id = $2`, [tenantId, id])
  return result.rows[0] ? (stamp(result.rows[0]) as Branch) : null
}

export async function updateBranch(tx: Queryable, tenantId: string, id: string, input: UpdateBranchInput): Promise<boolean> {
  const result = await tx.query(
    'update branches set name = $4, timezone = $5, status = $6, version = version + 1 where tenant_id = $1 and id = $2 and version = $3',
    [tenantId, id, input.version, input.name, input.timezone, input.status]
  )
  return (result.rowCount ?? 0) > 0
}

export async function listBranches(tx: Queryable, tenantId: string, query: ListBranchesQuery): Promise<Page<Branch>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and c.status = $${params.length}`
  }
  if (query.brandId) {
    params.push(query.brandId)
    filters += ` and c.brand_id = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'name', column: { sql: 'name', cast: 'text' }, direction: 'asc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<Stamped<Branch> & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${BRANCH_COLUMNS} from ${BRANCH_FROM} where c.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'name', 'asc')
  return { data: page.data.map((row) => stamp(row) as Branch), nextCursor: page.nextCursor }
}