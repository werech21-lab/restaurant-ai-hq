import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { runScan } from '@/modules/ai'
import { createCustomer, createLead, createQuotation } from '@/modules/crm'
import { createInvoice, submitInvoice } from '@/modules/finance'
import { createItem, createWarehouse, recordMovement } from '@/modules/inventory'

/**
 * Row level security and privileges, exercised as the real Supabase roles. The test support stub grants every new
 * table, sequence and function to `anon` and `authenticated` the way Supabase does by default, so a passing test proves
 * the migrations revoke what they must. The API uses the owner connection (it bypasses RLS), so these policies are the
 * second line of defence for anything that reaches the database through Supabase's own API.
 */

const pg = () => getPglite()

/** Tables nobody but the server may read: RLS is on and there is deliberately no policy. */
const DENY_ALL_TABLES = ['idempotency_keys', 'tenant_sequences'] as const
/** Functions that signed-in users may execute. Everything else that is not a trigger function must be closed. */
const CALLABLE_BY_AUTHENTICATED = ['auth_has_permission', 'auth_tenant_ids']

type Tenant = { auth: AuthContext; label: string; noPermissionUser: string; customerOnlyUser: string }

let keyCounter = 0
const nextKey = () => `sec-key-${String(++keyCounter).padStart(8, '0')}`
let counter = 0
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

let tenantA: Tenant
let tenantB: Tenant

async function asRole<T>(role: 'anon' | 'authenticated', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await pg().exec(`select set_config('test.uid', '${uid ?? ''}', false); set role ${role}`)
  try {
    return await fn()
  } finally {
    await pg().exec(`reset role; select set_config('test.uid', '', false)`)
  }
}

async function count(table: string): Promise<number> {
  const result = await pg().query<{ n: number }>(`select count(*)::int as n from ${table}`)
  return result.rows[0].n
}

async function tenantIds(table: string): Promise<string[]> {
  const result = await pg().query<{ tenant_id: string }>(`select distinct tenant_id from ${table}`)
  return result.rows.map((row) => row.tenant_id)
}

async function addRoleMember(tenantId: string, ownerId: string, granted: string[]): Promise<string> {
  const userId = randomUUID()
  await createUser(userId)
  const role = await pg().query<{ id: string }>(`insert into roles (tenant_id, name, created_by) values ($1, $2, $3) returning id`, [
    tenantId,
    `rls-${randomUUID()}`,
    ownerId,
  ])
  for (const permission of granted) {
    await pg().query(`insert into role_permissions (tenant_id, role_id, permission, created_by) values ($1, $2, $3, $4)`, [
      tenantId,
      role.rows[0].id,
      permission,
      ownerId,
    ])
  }
  await pg().query(`insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)`, [
    tenantId,
    userId,
    role.rows[0].id,
    ownerId,
  ])
  return userId
}

async function seedTenant(label: string): Promise<Tenant> {
  const userId = randomUUID()
  await createUser(userId)
  const tenantId = await bootstrapTenant(`Tenant ${label}`, `sec-${label}-${++counter}`, userId)
  const auth: AuthContext = { userId, tenantId, permissions: new Set<string>(allPermissions) }

  const warehouse = (await createWarehouse(auth, nextKey(), { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' })).body.data
  const item = (
    await createItem(auth, nextKey(), {
      sku: `SKU-${label}`,
      name: `Item ${label}`,
      unit: 'piece',
      unitCostMinor: 500,
      sellingPriceMinor: 1_000,
      reorderLevel: 10,
      isActive: true,
    })
  ).body.data
  await recordMovement(auth, nextKey(), { type: 'IN', itemId: item.id, warehouseId: warehouse.id, quantity: 8, note: null })
  const customer = await createCustomer(auth, {
    name: `Customer ${label}`,
    customerType: 'company',
    email: null,
    phone: null,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    status: 'active',
    notes: null,
  })
  const invoice = (
    await createInvoice(auth, nextKey(), {
      customerId: customer.id,
      issueDate: day(0),
      dueDate: day(30),
      notes: null,
      lines: [{ description: 'Sale', quantity: 1, unitPriceMinor: 1_000, taxRateBps: 500, itemId: item.id, warehouseId: warehouse.id }],
    })
  ).body.data
  await submitInvoice(auth, invoice.id, { version: invoice.version })
  const lead = (
    await createLead(auth, nextKey(), {
      customerId: customer.id,
      title: `Lead ${label}`,
      stage: 'qualified',
      expectedRevenueMinor: 5_000,
      probability: 70,
      assignedTo: null,
      expectedCloseDate: null,
      notes: null,
    })
  ).body.data
  await createQuotation(auth, nextKey(), {
    customerId: customer.id,
    leadId: lead.id,
    validUntil: day(30),
    notes: null,
    lines: [{ description: 'Quote', quantity: 1, unitPriceMinor: 2_000, taxRateBps: 0, itemId: null, warehouseId: null }],
  })
  await runScan(auth, { trigger: null, itemIds: null })

  return {
    auth,
    label,
    noPermissionUser: await addRoleMember(tenantId, userId, []),
    customerOnlyUser: await addRoleMember(tenantId, userId, ['crm.customer.read']),
  }
}

async function publicTables(): Promise<{ name: string; hasTenantId: boolean }[]> {
  const result = await pg().query<{ name: string; has_tenant_id: boolean }>(
    `select c.relname as name,
            exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped) as has_tenant_id
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     order by c.relname`
  )
  return result.rows.map((row) => ({ name: row.name, hasTenantId: row.has_tenant_id }))
}

beforeAll(async () => {
  await startDatabase()
  // The stub's auth.uid() always returns null. Let the test choose the signed-in user the way a Supabase JWT would.
  await pg().exec(`
    create or replace function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  `)
  tenantA = await seedTenant('a')
  tenantB = await seedTenant('b')
}, 120_000)
afterAll(stopDatabase)

describe('table privileges (as Supabase grants them by default)', () => {
  it('leaves anon with no access to any public table or view', async () => {
    const offenders: string[] = []
    for (const table of await publicTables()) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const result = await pg().query<{ ok: boolean }>(`select has_table_privilege('anon', $1, $2) as ok`, [`public.${table.name}`, privilege])
        if (result.rows[0].ok) offenders.push(`${table.name}:${privilege}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('lets authenticated users read at most, never write, any public table or view', async () => {
    const offenders: string[] = []
    for (const table of await publicTables()) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const result = await pg().query<{ ok: boolean }>(`select has_table_privilege('authenticated', $1, $2) as ok`, [
          `public.${table.name}`,
          privilege,
        ])
        if (result.rows[0].ok) offenders.push(`${table.name}:${privilege}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('does not let authenticated users read the deny-all tables at all', async () => {
    for (const table of DENY_ALL_TABLES) {
      const result = await pg().query<{ ok: boolean }>(`select has_table_privilege('authenticated', $1, 'SELECT') as ok`, [`public.${table}`])
      expect(result.rows[0].ok, table).toBe(false)
    }
  })

  it('closes every callable function to anon and all but the two RLS helpers to authenticated', async () => {
    const functions = await pg().query<{ name: string; anon: boolean; authenticated: boolean }>(
      `select p.proname as name,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prorettype <> 'pg_catalog.trigger'::regtype`
    )
    const names = functions.rows.map((row) => row.name)
    expect(names).toEqual(expect.arrayContaining(['erp_bootstrap_tenant', 'erp_seed_ai_rules', ...CALLABLE_BY_AUTHENTICATED]))
    expect(functions.rows.filter((row) => row.anon).map((row) => row.name)).toEqual([])
    expect(functions.rows.filter((row) => row.authenticated && !CALLABLE_BY_AUTHENTICATED.includes(row.name)).map((row) => row.name)).toEqual([])
  })

  it('refuses to create a tenant or seed rules when a signed-in user calls the privileged functions', async () => {
    const user = tenantA.auth.userId
    await asRole('authenticated', user, async () => {
      await expect(pg().query(`select erp_bootstrap_tenant('Evil', 'evil', $1)`, [user])).rejects.toThrow(/permission denied/i)
      await expect(pg().query(`select erp_seed_ai_rules($1, $2)`, [tenantA.auth.tenantId, user])).rejects.toThrow(/permission denied/i)
    })
  })
})

describe('row level security configuration', () => {
  it('enables RLS on every public table', async () => {
    const result = await pg().query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`
    )
    expect(result.rows.map((row) => row.name)).toEqual([])
  })

  it('defines only SELECT policies, only for authenticated, and every one is tenant scoped', async () => {
    const policies = await pg().query<{ tablename: string; policyname: string; cmd: string; roles: string; qual: string | null }>(
      `select tablename, policyname, cmd, roles::text as roles, qual from pg_policies where schemaname = 'public'`
    )
    expect(policies.rows.length).toBeGreaterThan(15)
    for (const policy of policies.rows) {
      expect(policy.cmd, `${policy.tablename}.${policy.policyname}`).toBe('SELECT')
      expect(policy.roles, `${policy.tablename}.${policy.policyname}`).toBe('{authenticated}')
      expect(policy.qual ?? '', `${policy.tablename}.${policy.policyname}`).toMatch(/auth_tenant_ids|auth\.uid|auth_has_permission/)
    }
  })

  it('has a SELECT policy on every table except the two deny-all tables', async () => {
    const withoutPolicy = await pg().query<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
       order by c.relname`
    )
    expect(withoutPolicy.rows.map((row) => row.name)).toEqual([...DENY_ALL_TABLES].sort())
  })

  it('gates every tenant table by permission, not only by membership, except identity tables', async () => {
    // Identity tables: any member may read their own tenant's membership and role definitions (by design, see 0001_core.sql).
    const membershipOnly = new Set(['tenants', 'profiles', 'tenant_members', 'roles', 'role_permissions'])
    const policies = await pg().query<{ tablename: string; qual: string | null }>(`select tablename, qual from pg_policies where schemaname = 'public'`)
    const weak = policies.rows.filter((policy) => !membershipOnly.has(policy.tablename) && !(policy.qual ?? '').includes('auth_has_permission'))
    expect(weak.map((policy) => policy.tablename)).toEqual([])
  })
})

describe('row level security behaviour', () => {
  it('shows a tenant\'s owner only that tenant\'s rows in every tenant table', async () => {
    const gated = (await publicTables()).filter((table) => table.hasTenantId && !DENY_ALL_TABLES.includes(table.name as (typeof DENY_ALL_TABLES)[number]))
    expect(gated.length).toBeGreaterThan(15)
    for (const tenant of [tenantA, tenantB]) {
      await asRole('authenticated', tenant.auth.userId, async () => {
        for (const table of gated) {
          const seen = await tenantIds(table.name)
          expect(seen.filter((id) => id !== tenant.auth.tenantId), `${table.name} leaked to tenant ${tenant.label}`).toEqual([])
        }
      })
    }
  })

  it('actually returns the seeded rows to their own tenant (the isolation checks are not vacuous)', async () => {
    const seeded = [
      'customers',
      'items',
      'warehouses',
      'stock_movements',
      'stock_balances',
      'invoices',
      'invoice_lines',
      'finance_settings',
      'crm_leads_pipeline',
      'sales_quotations',
      'audit_log',
      'ai_insights_alerts',
      'erp_automation_rules',
      'roles',
      'role_permissions',
      'tenant_members',
    ]
    await asRole('authenticated', tenantA.auth.userId, async () => {
      for (const table of seeded) expect(await count(table), table).toBeGreaterThan(0)
    })
  })

  it('shows different totals to different tenants for the same query', async () => {
    const owners = [tenantA, tenantB]
    const visible: string[][] = []
    for (const tenant of owners) {
      visible.push(await asRole('authenticated', tenant.auth.userId, async () => (await pg().query<{ id: string }>('select id from invoices')).rows.map((row) => row.id)))
    }
    expect(visible[0].length).toBe(1)
    expect(visible[1].length).toBe(1)
    expect(visible[0][0]).not.toBe(visible[1][0])
  })

  it('hides every permission-gated table from a member whose role has no permissions', async () => {
    const policies = await pg().query<{ tablename: string }>(
      `select distinct tablename from pg_policies where schemaname = 'public' and qual like '%auth_has_permission%'`
    )
    expect(policies.rows.length).toBeGreaterThan(10)
    await asRole('authenticated', tenantA.noPermissionUser, async () => {
      for (const { tablename } of policies.rows) expect(await count(tablename), tablename).toBe(0)
    })
  })

  it('applies permissions one by one: customer.read shows customers but not invoices, stock or insights', async () => {
    await asRole('authenticated', tenantA.customerOnlyUser, async () => {
      expect(await count('customers')).toBe(1)
      expect(await count('invoices')).toBe(0)
      expect(await count('stock_movements')).toBe(0)
      expect(await count('ai_insights_alerts')).toBe(0)
      expect(await count('audit_log')).toBe(0)
    })
  })

  it('does not reveal another tenant\'s membership, roles or tenant row', async () => {
    await asRole('authenticated', tenantA.auth.userId, async () => {
      const tenants = await pg().query<{ id: string }>('select id from tenants')
      expect(tenants.rows.map((row) => row.id)).toEqual([tenantA.auth.tenantId])
      const members = await pg().query<{ user_id: string }>('select user_id from tenant_members where tenant_id = $1', [tenantB.auth.tenantId])
      expect(members.rows).toEqual([])
    })
  })

  it('blocks all writes and deletes from signed-in users, including against their own tenant', async () => {
    const owner = tenantA.auth
    await asRole('authenticated', owner.userId, async () => {
      await expect(pg().query(`update invoices set total_minor = 0 where tenant_id = $1`, [owner.tenantId])).rejects.toThrow(/permission denied/i)
      await expect(pg().query(`delete from audit_log where tenant_id = $1`, [owner.tenantId])).rejects.toThrow(/permission denied/i)
      await expect(pg().query(`delete from stock_movements where tenant_id = $1`, [owner.tenantId])).rejects.toThrow(/permission denied/i)
      await expect(pg().query(`update stock_balances set on_hand = 999 where tenant_id = $1`, [owner.tenantId])).rejects.toThrow(/permission denied/i)
      await expect(pg().query(`insert into roles (tenant_id, name, created_by) values ($1, 'god', $2)`, [owner.tenantId, owner.userId])).rejects.toThrow(
        /permission denied/i
      )
      await expect(pg().query(`insert into role_permissions (tenant_id, role_id, permission, created_by) select tenant_id, id, 'ai.action.approve', created_by from roles limit 1`)).rejects.toThrow(
        /permission denied/i
      )
    })
    expect(await count('audit_log')).toBeGreaterThan(0)
  })

  it('gives anon nothing, and an unknown signed-in user nothing', async () => {
    await asRole('anon', null, async () => {
      await expect(pg().query('select * from invoices')).rejects.toThrow(/permission denied/i)
      await expect(pg().query('select * from tenants')).rejects.toThrow(/permission denied/i)
    })
    const stranger = randomUUID()
    await createUser(stranger)
    await asRole('authenticated', stranger, async () => {
      for (const table of ['tenants', 'invoices', 'customers', 'items', 'audit_log', 'ai_action_approvals', 'roles']) {
        expect(await count(table), table).toBe(0)
      }
    })
  })

  it('hides every row when no user is signed in but the role is authenticated', async () => {
    await asRole('authenticated', null, async () => {
      for (const table of ['tenants', 'invoices', 'customers', 'items', 'audit_log']) expect(await count(table), table).toBe(0)
    })
  })

  it('reports that a user holds a permission only in their own tenant', async () => {
    await asRole('authenticated', tenantA.auth.userId, async () => {
      const own = await pg().query<{ ok: boolean }>(`select auth_has_permission($1, 'finance.invoice.approve') as ok`, [tenantA.auth.tenantId])
      const other = await pg().query<{ ok: boolean }>(`select auth_has_permission($1, 'finance.invoice.approve') as ok`, [tenantB.auth.tenantId])
      expect([own.rows[0].ok, other.rows[0].ok]).toEqual([true, false])
    })
  })
})
