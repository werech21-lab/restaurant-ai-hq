import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertMigrationTarget, assertNothingBeyond, baselineSentinels, isUnbaselined, planBaseline, planMigrations } from '../../../scripts/migrate-lib.mjs'

/** The migration planner is pure. Nothing here connects to a real database. */

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })

const migrationsDir = path.join(process.cwd(), 'database', 'migrations')

const stub = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role anon;
  create role authenticated;
`

const files = ['0001_a.sql', '0002_b.sql', '0003_c.sql', '0004_d.sql'].map((name) => ({ name, checksum: `sum-${name}` }))
const history = (names: string[]) => new Map(names.map((name) => [name, `sum-${name}`]))

let current: PGlite | null = null
afterEach(async () => {
  await current?.close()
  current = null
})

describe('planMigrations', () => {
  it('lists pending files after the applied ones', () => {
    const plan = planMigrations(files, history(['0001_a.sql', '0002_b.sql']))
    expect(plan).toEqual({ pending: ['0003_c.sql', '0004_d.sql'], upToDate: ['0001_a.sql', '0002_b.sql'], changed: [], unknown: [], gaps: [] })
  })

  it('reports an applied file whose content changed', () => {
    const applied = history(['0001_a.sql', '0002_b.sql'])
    applied.set('0002_b.sql', 'something-else')
    expect(planMigrations(files, applied).changed).toEqual(['0002_b.sql'])
  })

  it('reports history that has no file, and an out-of-order gap', () => {
    const applied = history(['0001_a.sql', '0003_c.sql', '0009_gone.sql'])
    const plan = planMigrations(files, applied)
    expect(plan.unknown).toEqual(['0009_gone.sql'])
    expect(plan.gaps).toEqual(['0002_b.sql'])
  })

  it('treats an empty history as everything pending', () => {
    expect(planMigrations(files, new Map()).pending).toHaveLength(4)
    expect(planMigrations([], new Map())).toEqual({ pending: [], upToDate: [], changed: [], unknown: [], gaps: [] })
  })
})

describe('assertMigrationTarget', () => {
  function remote(ref: string): string {
    const parsed = new URL('postgresql://aws-0-region.pooler.supabase.com:5432/postgres')
    parsed.username = `postgres.${ref}`
    parsed.password = 'not-a-real-secret'
    return parsed.toString()
  }

  it('allows loopback and refuses every remote project that is not approved', () => {
    expect(assertMigrationTarget('postgresql://127.0.0.1:5432/postgres', { expectHost: undefined, acknowledged: false, approved: [] })).toEqual({
      scope: 'local',
      host: '127.0.0.1',
    })
    expect(assertMigrationTarget('postgresql://localhost/postgres', { expectHost: undefined, acknowledged: false, approved: [] }).scope).toBe('local')
    const url = remote('stagingref')
    expect(() => assertMigrationTarget(url, { expectHost: 'stagingref', acknowledged: false, approved: ['stagingref'] })).toThrow(/without --i-understand-this-is-staging/)
    expect(() => assertMigrationTarget(url, { expectHost: undefined, acknowledged: true, approved: ['stagingref'] })).toThrow(/--expect-host/)
    expect(() => assertMigrationTarget(url, { expectHost: 'YOUR_STAGING_PROJECT', acknowledged: true, approved: ['YOUR_STAGING_PROJECT'] })).toThrow(/--expect-host/)
    expect(() => assertMigrationTarget(url, { expectHost: 'otherref', acknowledged: true, approved: ['otherref'] })).toThrow(/does not point at the project/)
    expect(() => assertMigrationTarget(url, { expectHost: 'stagingref', acknowledged: true, approved: [] })).toThrow(/not listed/)
    try {
      assertMigrationTarget(url, { expectHost: 'stagingref', acknowledged: true, approved: [] })
    } catch (error) {
      expect((error as Error).message).not.toContain('not-a-real-secret')
    }
    expect(assertMigrationTarget(url, { expectHost: 'stagingref', acknowledged: true, approved: ['stagingref'] })).toEqual({
      scope: 'staging',
      host: 'aws-0-region.pooler.supabase.com',
    })
  })

  it('allows only the named staging project', async () => {
    const listed = JSON.parse(await readFile(path.join(process.cwd(), 'database', 'approved-staging-targets.json'), 'utf8')) as { projects: string[] }
    expect(listed.projects).toEqual(['pikqnlzkoaxoxpahztvc'])
  })
})

describe('isUnbaselined', () => {
  it('flags a database that has tables but no history', () => {
    expect(isUnbaselined({ historyRows: 0, hasCoreTables: true })).toBe(true)
    expect(isUnbaselined({ historyRows: 0, hasCoreTables: false })).toBe(false)
    expect(isUnbaselined({ historyRows: 3, hasCoreTables: true })).toBe(false)
  })
})

describe('planBaseline', () => {
  const sentinelFiles = Object.keys(baselineSentinels).map((name) => ({ name, checksum: `sum-${name}` }))

  it('records every file up to the named one that is not recorded yet', () => {
    const plan = planBaseline(sentinelFiles, new Map(), '0003_inventory.sql')
    expect(plan.record.map((file) => file.name)).toEqual(['0001_core.sql', '0002_crm.sql', '0003_inventory.sql'])
    expect(plan.sentinels.length).toBeGreaterThanOrEqual(3)
  })

  it('rejects an unknown file, a file without sentinels, and a changed checksum', () => {
    expect(() => planBaseline(sentinelFiles, new Map(), '9999_x.sql')).toThrow(/not a migration file/)
    const withNew = [...sentinelFiles, { name: '0099_new.sql', checksum: 'x' }]
    expect(() => planBaseline(withNew, new Map(), '0099_new.sql')).toThrow(/no sentinel/)
    expect(() => planBaseline(sentinelFiles, new Map([['0001_core.sql', 'different']]), '0002_crm.sql')).toThrow(/different checksum/)
  })

  it('refuses a baseline that would skip over something already recorded', () => {
    const applied = new Map([['0004_finance.sql', 'sum-0004_finance.sql']])
    expect(() => assertNothingBeyond(sentinelFiles, applied, '0002_crm.sql')).toThrow(/already recorded/)
    expect(() => assertNothingBeyond(sentinelFiles, new Map(), '0002_crm.sql')).not.toThrow()
  })
})

describe('baseline sentinels against the real migrations', () => {
  async function names(): Promise<string[]> {
    return (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
  }

  async function exists(db: PGlite, object: string): Promise<boolean> {
    if (object.startsWith('def:')) {
      const split = object.indexOf(':', 4)
      const sql = `select exists (select 1 from pg_proc where proname = $1 and pg_get_functiondef(oid) like '%' || $2 || '%') as ok`
      const found = await db.query<{ ok: boolean }>(sql, [object.slice(4, split), object.slice(split + 1)])
      return found.rows[0].ok
    }
    const result = object.startsWith('fn:')
      ? await db.query<{ ok: boolean }>('select to_regprocedure($1) is not null as ok', [object.slice(3)])
      : await db.query<{ ok: boolean }>('select to_regclass($1) is not null as ok', [object])
    return result.rows[0].ok
  }

  it('defines sentinels for exactly the migration files that exist', async () => {
    expect(Object.keys(baselineSentinels).sort()).toEqual(await names())
  })

  it('plans 0001 through 0027 in filename order for an empty database, then only the remainder', async () => {
    const all = await names()
    expect(all).toHaveLength(38)
    expect(all[0]).toBe('0001_core.sql')
    expect(all[27]).toBe('0028_aggregator_rank_rescue_radar.sql')
    expect(all[28]).toBe('0029_venture_foods_brands_aggregator_radar.sql')
    expect(all[29]).toBe('0030_venture_foods_exclusive_brands_radar.sql')
    expect(all[30]).toBe('0031_odoo_migration_engine.sql')
    expect(all[31]).toBe('0032_odoo_venturefoods_extractor.sql')
    expect(all[32]).toBe('0033_purge_demo_placeholders_keep_odoo.sql')
    expect(all[33]).toBe('0034_odoo_six_divisions_suite.sql')
    expect(all[34]).toBe('0035_deep_venture_foods_hr_payroll_rebuild.sql')
    expect(all[35]).toBe('0036_venture_foods_warehouses_branches_analytic.sql')
    expect(all[36]).toBe('0037_hr_deep_tables_rls.sql')
    expect(all[37]).toBe('0038_revoke_hr_deep_marker_grants.sql')
    const described = all.map((name) => ({ name, checksum: 'same' }))
    expect(planMigrations(described, new Map())).toEqual({ pending: all, upToDate: [], changed: [], unknown: [], gaps: [] })
    const prefix = new Map(all.slice(0, 10).map((name) => [name, 'same']))
    const rest = planMigrations(described, prefix)
    expect(rest.pending).toEqual(all.slice(10))
    expect(rest.gaps).toEqual([])
    expect(rest.changed).toEqual([])
  })

  it('finds every sentinel after all migrations, and none of the later ones after 0005', async () => {
    const all = await names()
    const db = new PGlite()
    current = db
    await db.exec(stub)
    for (const file of all.slice(0, 5)) await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'))

    for (const file of all.slice(0, 5)) {
      for (const object of baselineSentinels[file]) expect(await exists(db, object), `${file} ${object}`).toBe(true)
    }
    for (const file of all.slice(5)) {
      const own = baselineSentinels[file].filter((object) => !object.startsWith('fn:'))
      for (const object of own) expect(await exists(db, object), `${file} ${object} must not exist yet`).toBe(false)
    }

    for (const file of all.slice(5)) await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'))
    for (const file of all) {
      for (const object of baselineSentinels[file]) expect(await exists(db, object), `${file} ${object}`).toBe(true)
    }
  })
})
