import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPglite, startDatabase, stopDatabase, testDb } from '@/lib/__tests__/support/database'
import { assertExpectedTarget, assertMigrationsCurrent, formatValidation, parseTarget, runIsolationChecks } from '../../../scripts/ops-lib.mjs'

/**
 * The staging validator, run against the in-memory database (the same migrations a staging project gets). It must pass on a
 * correct schema, fail loudly on a broken one, and leave nothing behind. It is never pointed at a real database from here.
 */

const pg = () => getPglite()
const client = {
  query: async (text: string, params?: unknown[]) => {
    const result = await pg().query(text, params)
    return { rows: result.rows as any[] }
  },
}

async function migrationFiles(): Promise<{ name: string; checksum: string }[]> {
  const directory = path.join(process.cwd(), 'database', 'migrations')
  const files = []
  for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
    files.push({ name, checksum: createHash('sha256').update(await readFile(path.join(directory, name), 'utf8')).digest('hex') })
  }
  return files
}

async function failing(runId: string): Promise<string[]> {
  return (await runIsolationChecks(client, runId)).checks.filter((check) => !check.ok).map((check) => check.name)
}

beforeAll(async () => {
  await startDatabase()
  // Supabase's real definition of auth.uid(): the claims the request carries.
  await pg().exec(`
    create or replace function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
    $$;
  `)
}, 120_000)
afterAll(stopDatabase)

describe('the isolation checks on a correctly migrated schema', () => {
  it('all pass and leave nothing behind', async () => {
    const before = (await pg().query<{ n: number }>('select count(*)::int as n from tenants')).rows[0].n
    const result = await runIsolationChecks(client, 'aaaa1111')
    expect(result.checks.filter((check) => !check.ok)).toEqual([])
    expect(result.checks.length).toBeGreaterThanOrEqual(20)
    expect((await pg().query<{ n: number }>('select count(*)::int as n from tenants')).rows[0].n).toBe(before)
    expect((await pg().query<{ n: number }>(`select count(*)::int as n from auth.users where email like '%validation.invalid'`)).rows[0].n).toBe(0)
    expect((await pg().query<{ n: number }>(`select count(*)::int as n from products where name like 'validate-%'`)).rows[0].n).toBe(0)
  })

  it('can run twice in a row', async () => {
    expect(await failing('bbbb2222')).toEqual([])
    expect(await failing('cccc3333')).toEqual([])
  })

  it('formats a readable report', async () => {
    const text = formatValidation(await runIsolationChecks(client, 'dddd4444'), { host: 'db.example.test', user: 'postgres', database: 'postgres' })
    expect(text).toContain('PASS  products: owner A sees exactly company A\'s products')
    expect(text).toContain('Everything this run wrote was rolled back.')
    expect(text).not.toContain('FAIL')
  })
})

describe('the isolation checks on a broken schema (each break is undone afterwards)', () => {
  it('catch products writable by browsers', async () => {
    // The grant alone is caught by the privilege audit (row security would still refuse the write, which is the second line).
    await pg().exec('grant insert, update, delete on products to authenticated')
    try {
      expect(await failing('eeee5554')).toEqual(['tenant tables: browsers cannot write, and anonymous callers cannot touch, any of them'])
    } finally {
      await pg().exec('revoke insert, update, delete on products from authenticated')
    }
    // With a permissive policy as well, the write really goes through, and the direct attempt is caught.
    await pg().exec('grant insert on products to authenticated; create policy leaky_insert on products for insert to authenticated with check (true)')
    try {
      expect(await failing('eeee5555')).toContain('products: owner A cannot insert directly')
    } finally {
      await pg().exec('drop policy leaky_insert on products; revoke insert on products from authenticated')
    }
    expect(await failing('eeee5556')).toEqual([])
  })

  it('catch a products policy that shows every company\'s rows', async () => {
    const policy = (await pg().query<{ policyname: string }>(`select policyname from pg_policies where tablename = 'products'`)).rows[0].policyname
    await pg().exec(`drop policy ${policy} on products; create policy leaky on products for select to authenticated using (true)`)
    try {
      const names = await failing('ffff6666')
      expect(names).toContain('products: owner A sees exactly company A\'s products')
      expect(names).toContain('products: a signed-in user with no company sees none')
      expect(names).toContain('tenant tables: no company can read another company\'s rows')
    } finally {
      await pg().exec(`drop policy leaky on products; create policy ${policy} on products for select to authenticated using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'))`)
    }
    expect(await failing('ffff6667')).toEqual([])
  })

  it('catch token_hash being readable and anonymous access being open', async () => {
    await pg().exec('grant select on tenant_invitations to authenticated; grant select on products to anon')
    try {
      const names = await failing('1111aaaa')
      expect(names).toContain('invitations: token_hash is unreadable to owners')
      expect(names).toContain('tenant tables: browsers cannot write, and anonymous callers cannot touch, any of them')
    } finally {
      await pg().exec(`revoke select on tenant_invitations from authenticated; revoke select on products from anon;
        grant select (id, tenant_id, email, role_id, status, expires_at, accepted_by, accepted_at, revoked_at, version, created_at, updated_at, created_by) on tenant_invitations to authenticated`)
    }
    expect(await failing('1111aaab')).toEqual([])
  })

  it('catch the bootstrap function being callable by browsers', async () => {
    await pg().exec('grant execute on function erp_bootstrap_tenant(text, text, uuid) to authenticated')
    try {
      expect(await failing('2222bbbb')).toContain('functions: erp_bootstrap_tenant(text, text, uuid) cannot be called by browsers')
    } finally {
      await pg().exec('revoke execute on function erp_bootstrap_tenant(text, text, uuid) from authenticated')
    }
  })
})

describe('guards before anything runs', () => {
  it('refuses a connection string that does not name the expected project, and never prints the password', () => {
    // Built piece by piece so no credential-shaped literal sits in the repository (the secret scan would rightly flag it).
    const parsed = new URL('postgresql://aws-0-eu.pooler.supabase.com:5432/postgres')
    parsed.username = 'postgres.abcdefghij'
    parsed.password = 'fake-password-for-test'
    const url = parsed.toString()
    expect(() => assertExpectedTarget(url, undefined)).toThrow(/--expect-host/)
    expect(() => assertExpectedTarget(url, 'abc')).toThrow(/at least 6/)
    expect(() => assertExpectedTarget(url, 'zzzzzzzzzz')).toThrow(/does not point at the project/)
    try {
      assertExpectedTarget(url, 'zzzzzzzzzz')
    } catch (error) {
      expect((error as Error).message).not.toContain('fake-password-for-test')
    }
    expect(() => assertExpectedTarget(url, 'abcdefghij')).not.toThrow()
    expect(parseTarget(url)).toEqual({ host: 'aws-0-eu.pooler.supabase.com', user: 'postgres.abcdefghij', database: 'postgres' })
  })

  it('refuses a database that is not exactly at the repository\'s migrations, and applies nothing', async () => {
    const files = await migrationFiles()
    await expect(assertMigrationsCurrent(testDb, files)).rejects.toThrow(/no schema_migrations/)
    await pg().exec('create table schema_migrations (name text primary key, checksum text not null)')
    for (const file of files.slice(0, -1)) await pg().query('insert into schema_migrations values ($1, $2)', [file.name, file.checksum])
    await expect(assertMigrationsCurrent(testDb, files)).rejects.toThrow(new RegExp('not applied: ' + (files.at(-1)?.name ?? '').replace('.', '\\.')))
    await pg().query('insert into schema_migrations values ($1, $2)', [files.at(-1)?.name, 'f'.repeat(64)])
    await expect(assertMigrationsCurrent(testDb, files)).rejects.toThrow(/changed since applied/)
    await pg().query('update schema_migrations set checksum = $2 where name = $1', [files.at(-1)?.name, files.at(-1)?.checksum])
    await expect(assertMigrationsCurrent(testDb, files)).resolves.toBeUndefined()
    // It only reads: the number of migration rows is what we put there.
    expect((await pg().query<{ n: number }>('select count(*)::int as n from schema_migrations')).rows[0].n).toBe(files.length)
  })
})
