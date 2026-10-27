import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * The legacy `products` table, before and after migration 0009. The database is an in-memory PGlite built the way a live
 * Supabase project could look: migrations 0001 to 0008, then the old supabase/schema.sql with its permissive policies and
 * Supabase's default grants, with rows already in it. Nothing here can reach a real database.
 */

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })

const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
const MIGRATION = '0009_products_tenant.sql'

// What supabase/schema.sql said before 0009. Kept verbatim here so the "before" state stays testable.
const legacySchema = `
  create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text not null default 'عام',
    price numeric(10, 3) not null check (price >= 0),
    available boolean not null default true,
    created_at timestamptz not null default now()
  );
  alter table public.products enable row level security;
  create policy "products_select_authenticated" on public.products for select to authenticated using (true);
  create policy "products_insert_authenticated" on public.products for insert to authenticated with check (true);
  create policy "products_update_authenticated" on public.products for update to authenticated using (true) with check (true);
  create policy "products_delete_authenticated" on public.products for delete to authenticated using (true);
`

const stub = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
`

let db: PGlite
let legacyWasOpenToAnyUser = false
let legacyHash = ''

type Company = { tenantId: string; owner: string; reader: string; noPermission: string; customerOnly: string }
let a: Company
let b: Company
let stranger: string

async function asRole<T>(role: 'anon' | 'authenticated', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('test.uid', '${uid ?? ''}', false); set role ${role}`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('test.uid', '', false)`)
  }
}

async function visibleProducts(uid: string | null): Promise<string[]> {
  return asRole('authenticated', uid, async () => (await db.query<{ name: string }>('select name from products order by name')).rows.map((row) => row.name))
}

async function addUser(): Promise<string> {
  const id = randomUUID()
  await db.query('insert into auth.users (id) values ($1)', [id])
  return id
}

async function memberWith(tenantId: string, ownerId: string, granted: string[]): Promise<string> {
  const userId = await addUser()
  const role = await db.query<{ id: string }>('insert into roles (tenant_id, name, created_by) values ($1, $2, $3) returning id', [
    tenantId,
    `r-${randomUUID()}`,
    ownerId,
  ])
  for (const permission of granted) {
    await db.query('insert into role_permissions (tenant_id, role_id, permission, created_by) values ($1, $2, $3, $4)', [tenantId, role.rows[0].id, permission, ownerId])
  }
  await db.query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [tenantId, userId, role.rows[0].id, ownerId])
  return userId
}

async function company(label: string): Promise<Company> {
  const owner = await addUser()
  const tenantId = (await db.query<{ id: string }>('select erp_bootstrap_tenant($1, $2, $3) as id', [`Company ${label}`, `rls-${label}`, owner])).rows[0].id
  return {
    tenantId,
    owner,
    reader: await memberWith(tenantId, owner, ['inventory.item.read']),
    noPermission: await memberWith(tenantId, owner, []),
    customerOnly: await memberWith(tenantId, owner, ['crm.customer.read']),
  }
}

async function snapshotLegacy(): Promise<string> {
  const result = await db.query<{ hash: string }>(
    `select md5(coalesce(string_agg(id::text || name || category || price::text || available::text || created_at::text, '|' order by id), '')) as hash
     from products where name like 'legacy-%'`
  )
  return result.rows[0].hash
}

async function files(): Promise<string[]> {
  return (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
}

beforeAll(async () => {
  db = new PGlite({ parsers: { 20: (value: string) => Number(value), 1082: (value: string) => value } })
  await db.exec(stub)
  const all = await files()
  expect(all).toContain(MIGRATION)
  for (const file of all.filter((name) => name < MIGRATION)) await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'))
  await db.exec(legacySchema)

  a = await company('a')
  b = await company('b')
  stranger = await addUser()

  // Rows that existed before the migration.
  for (const [name, price] of [['legacy-1', '1.500'], ['legacy-2', '0.001'], ['legacy-3', '12.250']]) {
    await db.query('insert into products (name, price) values ($1, $2)', [name, price])
  }

  // Prove the "before" state: a signed-in user with no company at all can change products.
  await asRole('authenticated', stranger, async () => {
    await db.query(`insert into products (name, price) values ('planted-by-stranger', 1)`)
    const changed = await db.query(`update products set price = 99 where name = 'legacy-1' returning id`)
    await db.query(`update products set price = 1.5 where name = 'legacy-1'`)
    legacyWasOpenToAnyUser = changed.rows.length === 1
  })
  await db.query(`delete from products where name = 'planted-by-stranger'`)
  legacyHash = await snapshotLegacy()

  await db.exec(await readFile(path.join(migrationsDir, MIGRATION), 'utf8'))

  // Products of two companies, written the way the server writes them (owner connection).
  for (const [company_, label] of [[a, 'A'], [b, 'B']] as const) {
    for (const index of [1, 2]) {
      await db.query(`insert into products (tenant_id, created_by, name, price) values ($1, $2, $3, $4)`, [company_.tenantId, company_.owner, `${label}-product-${index}`, '2.000'])
    }
  }
})

afterAll(async () => {
  await db?.close()
})

describe('before the migration (what was wrong)', () => {
  it('let a signed-in user with no company read, insert and change any product', () => {
    expect(legacyWasOpenToAnyUser).toBe(true)
  })
})

describe('the migration on a database that already holds products', () => {
  it('keeps every legacy row byte for byte and gives none of them a tenant', async () => {
    expect(await snapshotLegacy()).toBe(legacyHash)
    const rows = await db.query<{ n: number; orphaned: number }>(`select count(*)::int as n, count(*) filter (where tenant_id is null)::int as orphaned from products where name like 'legacy-%'`)
    expect(rows.rows[0]).toEqual({ n: 3, orphaned: 3 })
  })

  it('hides legacy rows from every signed-in user, including company owners', async () => {
    for (const uid of [a.owner, b.owner, a.reader, stranger]) {
      expect((await visibleProducts(uid)).filter((name) => name.startsWith('legacy-')), uid).toEqual([])
    }
  })

  it('replaces the four permissive policies with a single tenant and permission scoped SELECT policy', async () => {
    const policies = await db.query<{ policyname: string; cmd: string; roles: string; qual: string }>(
      `select policyname, cmd, roles::text as roles, qual from pg_policies where schemaname = 'public' and tablename = 'products'`
    )
    expect(policies.rows).toHaveLength(1)
    expect(policies.rows[0]).toMatchObject({ policyname: 'products_select', cmd: 'SELECT', roles: '{authenticated}' })
    expect(policies.rows[0].qual).toMatch(/auth_tenant_ids/)
    expect(policies.rows[0].qual).toMatch(/auth_has_permission\(tenant_id, 'inventory\.item\.read'(::text)?\)/)
    expect(policies.rows[0].qual).not.toMatch(/\btrue\b/)
  })

  it('leaves anon with no privilege and authenticated with SELECT only', async () => {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const anon = await db.query<{ ok: boolean }>(`select has_table_privilege('anon', 'public.products', $1) as ok`, [privilege])
      const authenticated = await db.query<{ ok: boolean }>(`select has_table_privilege('authenticated', 'public.products', $1) as ok`, [privilege])
      expect(anon.rows[0].ok, `anon ${privilege}`).toBe(false)
      expect(authenticated.rows[0].ok, `authenticated ${privilege}`).toBe(privilege === 'SELECT')
    }
    const columns = await db.query<{ ok: boolean }>(
      `select bool_or(has_column_privilege('authenticated', 'public.products', attname, 'INSERT') or has_column_privilege('authenticated', 'public.products', attname, 'UPDATE')) as ok
       from pg_attribute where attrelid = 'public.products'::regclass and attnum > 0 and not attisdropped`
    )
    expect(columns.rows[0].ok).toBe(false)
  })
})

describe('isolation between two companies', () => {
  it('shows each company owner only their own products', async () => {
    expect(await visibleProducts(a.owner)).toEqual(['A-product-1', 'A-product-2'])
    expect(await visibleProducts(b.owner)).toEqual(['B-product-1', 'B-product-2'])
  })

  it('does not return another company\'s rows even when the query names its tenant_id', async () => {
    await asRole('authenticated', a.owner, async () => {
      const direct = await db.query('select * from products where tenant_id = $1', [b.tenantId])
      expect(direct.rows).toEqual([])
      const byName = await db.query(`select * from products where name = 'B-product-1'`)
      expect(byName.rows).toEqual([])
      const union = await db.query(`select name from products where tenant_id = $1 or true`, [b.tenantId])
      expect(union.rows.map((row) => (row as { name: string }).name)).toEqual(['A-product-1', 'A-product-2'])
    })
  })

  it('reports permissions per company only', async () => {
    await asRole('authenticated', a.owner, async () => {
      const own = await db.query<{ ok: boolean }>(`select auth_has_permission($1, 'inventory.item.create') as ok`, [a.tenantId])
      const other = await db.query<{ ok: boolean }>(`select auth_has_permission($1, 'inventory.item.create') as ok`, [b.tenantId])
      expect([own.rows[0].ok, other.rows[0].ok]).toEqual([true, false])
    })
  })
})

describe('permissions inside one company', () => {
  it('shows products to a member whose role holds inventory.item.read', async () => {
    expect(await visibleProducts(a.reader)).toEqual(['A-product-1', 'A-product-2'])
  })

  it('shows nothing to a member with no permission, or only an unrelated one', async () => {
    expect(await visibleProducts(a.noPermission)).toEqual([])
    expect(await visibleProducts(a.customerOnly)).toEqual([])
  })

  it('shows nothing to a signed-in user with no company, to no user at all, and denies anon', async () => {
    expect(await visibleProducts(stranger)).toEqual([])
    expect(await visibleProducts(null)).toEqual([])
    await asRole('anon', null, async () => {
      await expect(db.query('select * from products')).rejects.toThrow(/permission denied/i)
    })
  })

  it('refuses every write to a signed-in user, including a company owner on their own products', async () => {
    for (const uid of [a.owner, a.reader, stranger]) {
      await asRole('authenticated', uid, async () => {
        await expect(db.query(`insert into products (tenant_id, name, price) values ($1, 'x', 1)`, [a.tenantId])).rejects.toThrow(/permission denied/i)
        await expect(db.query(`update products set name = 'x' where tenant_id = $1`, [a.tenantId])).rejects.toThrow(/permission denied/i)
        await expect(db.query('delete from products where tenant_id = $1', [a.tenantId])).rejects.toThrow(/permission denied/i)
        await expect(db.query('truncate products')).rejects.toThrow(/permission denied/i)
      })
    }
    expect((await db.query<{ n: number }>(`select count(*)::int as n from products where tenant_id = $1`, [a.tenantId])).rows[0].n).toBe(2)
  })
})

describe('no privilege escalation', () => {
  it('gives nothing to a new account created by public sign-up: no company, role, membership or profile', async () => {
    const counts = async () =>
      (
        await db.query<Record<string, number>>(
          `select (select count(*) from tenants)::int as tenants, (select count(*) from roles)::int as roles,
                  (select count(*) from role_permissions)::int as role_permissions, (select count(*) from tenant_members)::int as members,
                  (select count(*) from profiles)::int as profiles`
        )
      ).rows[0]
    const before = await counts()
    const signedUp = await addUser()
    expect(await counts()).toEqual(before)
    expect(await visibleProducts(signedUp)).toEqual([])
    await asRole('authenticated', signedUp, async () => {
      for (const table of ['tenants', 'roles', 'role_permissions', 'tenant_members', 'audit_log']) {
        expect((await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n, table).toBe(0)
      }
    })
  })

  it('refuses to let a signed-in user join a company, create a role or grant themselves a permission', async () => {
    const attacker = stranger
    const role = (await db.query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'owner'`, [a.tenantId])).rows[0].id
    await asRole('authenticated', attacker, async () => {
      await expect(db.query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $2)', [a.tenantId, attacker, role])).rejects.toThrow(/permission denied/i)
      await expect(db.query(`insert into roles (tenant_id, name, created_by) values ($1, 'root', $2)`, [a.tenantId, attacker])).rejects.toThrow(/permission denied/i)
      await expect(db.query(`insert into role_permissions (tenant_id, role_id, permission, created_by) values ($1, $2, 'inventory.item.read', $3)`, [a.tenantId, role, attacker])).rejects.toThrow(/permission denied/i)
      await expect(db.query('update tenant_members set role_id = $1 where user_id = $2', [role, a.reader])).rejects.toThrow(/permission denied/i)
      await expect(db.query(`insert into tenants (name, slug, created_by) values ('Mine', 'mine', $1)`, [attacker])).rejects.toThrow(/permission denied/i)
    })
    expect(await visibleProducts(attacker)).toEqual([])
  })

  it('does not let a member of company A use their membership against company B', async () => {
    const roleB = (await db.query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'owner'`, [b.tenantId])).rows[0].id
    await asRole('authenticated', a.owner, async () => {
      await expect(db.query('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $2)', [b.tenantId, a.owner, roleB])).rejects.toThrow(/permission denied/i)
      expect((await db.query('select * from tenant_members where tenant_id = $1', [b.tenantId])).rows).toEqual([])
    })
  })

  it('keeps the privileged functions closed and does not let a user turn RLS off', async () => {
    await asRole('authenticated', a.owner, async () => {
      await expect(db.query(`select erp_bootstrap_tenant('Evil', 'evil', $1)`, [a.owner])).rejects.toThrow(/permission denied/i)
      let leaked = 0
      try {
        await db.exec('set row_security = off')
        leaked = (await db.query<{ n: number }>('select count(*)::int as n from products')).rows[0].n
      } catch {
        leaked = 0
      } finally {
        await db.exec('reset row_security')
      }
      expect(leaked).toBeLessThanOrEqual(2)
    })
  })

  it('does not let a forged user id change what a real user sees: the policy reads the membership table', async () => {
    // A user id with no membership has no access, whatever tenant the query names.
    const forged = randomUUID()
    expect(await visibleProducts(forged)).toEqual([])
  })
})

describe('the owner connection (server) rules', () => {
  it('refuses a product without a tenant or creator, and refuses to move a product between companies', async () => {
    await expect(db.query(`insert into products (name, price) values ('orphan', 1)`)).rejects.toThrow(/products_owner_required/)
    await expect(db.query(`update products set tenant_id = $1 where tenant_id = $2`, [b.tenantId, a.tenantId])).rejects.toThrow(/cannot be changed/)
  })

  it('lets an operator assign the legacy rows to a company; then only that company sees them, and the constraint can be validated', async () => {
    await db.query(`update products set tenant_id = $1, created_by = $2 where tenant_id is null`, [a.tenantId, a.owner])
    await db.exec('alter table products validate constraint products_owner_required')
    expect((await visibleProducts(a.owner)).filter((name) => name.startsWith('legacy-'))).toEqual(['legacy-1', 'legacy-2', 'legacy-3'])
    expect((await visibleProducts(b.owner)).filter((name) => name.startsWith('legacy-'))).toEqual([])
    const prices = await db.query<{ price: string }>(`select price::text from products where name like 'legacy-%' order by name`)
    expect(prices.rows.map((row) => row.price)).toEqual(['1.500', '0.001', '12.250'])
  })
})

describe('no permissive policy can come back through a SQL file', () => {
  it('has no `(true)` policy and no insert, update, delete or all policy for authenticated in any migration or supabase file', async () => {
    const targets = [path.join(process.cwd(), 'supabase', 'schema.sql'), ...(await files()).map((file) => path.join(migrationsDir, file))]
    for (const target of targets) {
      const sql = (await readFile(target, 'utf8')).replace(/--[^\n]*/g, '')
      expect(sql, target).not.toMatch(/(using|with\s+check)\s*\(\s*true\s*\)/i)
      for (const match of sql.matchAll(/create\s+policy\s+\S+\s+on\s+\S+\s+for\s+(\w+)/gi)) {
        expect(match[1].toLowerCase(), `${target}: ${match[0]}`).toBe('select')
      }
      expect(sql, target).not.toMatch(/create\s+policy\s+\S+\s+on\s+\S+\s+(?!for\s)/i)
    }
  })

  it('has no browser or Supabase-client code that writes products: every write goes through the server service', async () => {
    const offenders: string[] = []
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') await visit(full)
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const text = await readFile(full, 'utf8')
          if (/\.from\(\s*['\"]products['\"]\s*\)\s*\.\s*(insert|update|upsert|delete)/.test(text)) offenders.push(full)
        }
      }
    }
    await visit(path.join(process.cwd(), 'src'))
    expect(offenders).toEqual([])
  })
})
