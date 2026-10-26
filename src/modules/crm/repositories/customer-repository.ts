import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage, type SortColumn } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { Customer, CustomerRef } from '@/modules/crm/domain/types'
import type { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from '@/modules/crm/schemas/customer'

type CustomerRow = Omit<Customer, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

const COLUMNS = `id, name, customer_type as "customerType", email, phone, tax_id as "taxId", address,
  credit_limit_minor as "creditLimitMinor", status, notes, version,
  created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`

const sortColumns: Record<ListCustomersQuery['sort'], SortColumn> = {
  name: { sql: 'name', cast: 'text' },
  createdAt: { sql: 'created_at', cast: 'timestamptz' },
}

function toCustomer(row: CustomerRow): Customer {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

export async function findCustomerRef(tx: Queryable, tenantId: string, id: string): Promise<CustomerRef | null> {
  const result = await tx.query<CustomerRef>(
    'select id, name, status from customers where tenant_id = $1 and id = $2',
    [tenantId, id]
  )
  return result.rows[0] ?? null
}

export async function findCustomer(
  tx: Queryable,
  tenantId: string,
  id: string,
  options: { lock: boolean } = { lock: false }
): Promise<Customer | null> {
  const result = await tx.query<CustomerRow>(
    `select ${COLUMNS} from customers where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toCustomer(result.rows[0]) : null
}

export async function insertCustomer(
  tx: Queryable,
  tenantId: string,
  userId: string,
  input: CreateCustomerInput
): Promise<Customer> {
  const result = await tx.query<CustomerRow>(
    `insert into customers (tenant_id, name, customer_type, email, phone, tax_id, address, credit_limit_minor, status, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning ${COLUMNS}`,
    [
      tenantId,
      input.name,
      input.customerType,
      input.email,
      input.phone,
      input.taxId,
      input.address,
      input.creditLimitMinor,
      input.status,
      input.notes,
      userId,
    ]
  )
  return toCustomer(result.rows[0])
}

/** Returns null when the version no longer matches. */
export async function updateCustomer(
  tx: Queryable,
  tenantId: string,
  id: string,
  input: UpdateCustomerInput
): Promise<Customer | null> {
  const result = await tx.query<CustomerRow>(
    `update customers
     set name = $3, customer_type = $4, email = $5, phone = $6, tax_id = $7, address = $8,
         credit_limit_minor = $9, status = $10, notes = $11, version = version + 1
     where tenant_id = $1 and id = $2 and version = $12
     returning ${COLUMNS}`,
    [
      tenantId,
      id,
      input.name,
      input.customerType,
      input.email,
      input.phone,
      input.taxId,
      input.address,
      input.creditLimitMinor,
      input.status,
      input.notes,
      input.version,
    ]
  )
  return result.rows[0] ? toCustomer(result.rows[0]) : null
}

export async function listCustomers(tx: Queryable, tenantId: string, query: ListCustomersQuery): Promise<Page<Customer>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.q) {
    params.push(`%${query.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`)
    filters += ` and (name ilike $${params.length} or email ilike $${params.length} or phone ilike $${params.length} or tax_id ilike $${params.length})`
  }
  if (query.status) {
    params.push(query.status)
    filters += ` and status = $${params.length}`
  }
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: sortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<CustomerRow & { sortValue: string }>(
    `select ${COLUMNS}, ${keyset.selectValue}
     from customers
     where tenant_id = $1${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data.map(toCustomer), nextCursor: page.nextCursor }
}
