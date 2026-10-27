// Shared, testable parts of the operator scripts (products-report.mjs, staging-validate.mjs). Nothing here connects by itself:
// every function takes a client with `query(text, params)`, so the same code runs against pg and against the in-memory test database.
//
// These scripts never run a migration and never keep a write. The first one reads inside a read-only transaction. The second
// writes synthetic rows inside one transaction that is always rolled back.
import { planMigrations } from './migrate-lib.mjs'

/** Host and user of a connection string, never the password. */
export function parseTarget(url) {
  const parsed = new URL(url)
  return { host: parsed.hostname, user: decodeURIComponent(parsed.username), database: parsed.pathname.replace(/^\//, '') }
}

/**
 * The operator names the project they mean to touch (for Supabase, the project ref appears in the host or in the pooler
 * user name). A connection string that points anywhere else is refused before a connection is made.
 */
export function assertExpectedTarget(url, expected) {
  if (!expected || expected.trim().length < 6) {
    throw new Error('--expect-host is required and must name the project (at least 6 characters), so a wrong connection string is refused.')
  }
  const { host, user } = parseTarget(url)
  if (!`${user}@${host}`.includes(expected.trim())) {
    throw new Error('Refusing to connect: the connection string does not point at the project named by --expect-host.')
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// products report
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Counts, never rows: no product name, price or id leaves the database. Runs in a read-only transaction that is rolled back.
 * `state` tells which side of migration 0009 the table is on.
 */
export async function collectProductsReport(client) {
  await client.query('begin read only')
  try {
    const exists = (await client.query(`select to_regclass('public.products') is not null as ok`)).rows[0].ok
    if (!exists) return { state: 'no_table', total: 0, withoutTenant: 0, withTenant: 0, withoutCreator: 0, tenants: 0, byTenant: [] }
    const columns = new Set(
      (await client.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'products'`)).rows.map(
        (row) => row.column_name
      )
    )
    const total = (await client.query('select count(*)::int as n from public.products')).rows[0].n
    if (!columns.has('tenant_id')) {
      return { state: 'before_0009', total, withoutTenant: total, withTenant: 0, withoutCreator: total, tenants: 0, byTenant: [] }
    }
    const summary = (
      await client.query(
        `select count(*) filter (where tenant_id is null)::int as without_tenant,
                count(*) filter (where tenant_id is not null)::int as with_tenant,
                count(*) filter (where created_by is null)::int as without_creator,
                count(distinct tenant_id)::int as tenants
         from public.products`
      )
    ).rows[0]
    const byTenant = (
      await client.query(
        `select tenant_id, count(*)::int as products from public.products where tenant_id is not null group by tenant_id order by products desc, tenant_id limit 50`
      )
    ).rows.map((row) => ({ tenantId: row.tenant_id, products: row.products }))
    return {
      state: 'after_0009',
      total,
      withoutTenant: summary.without_tenant,
      withTenant: summary.with_tenant,
      withoutCreator: summary.without_creator,
      tenants: summary.tenants,
      byTenant,
    }
  } finally {
    await client.query('rollback')
  }
}

const STATE_TEXT = {
  no_table: 'The products table does not exist in this database.',
  before_0009: 'Migration 0009 is NOT applied: the products table has no tenant_id column, so every row is without a tenant.',
  after_0009: 'Migration 0009 is applied: the products table has a tenant_id column.',
}

export function formatProductsReport(report, target) {
  const lines = [
    `products report (read only, nothing was changed)`,
    `target: ${target.user}@${target.host}/${target.database}`,
    STATE_TEXT[report.state],
    `total rows:                 ${report.total}`,
    `rows WITHOUT tenant_id:     ${report.withoutTenant}`,
    `rows with tenant_id:        ${report.withTenant}`,
    `rows without created_by:    ${report.withoutCreator}`,
    `distinct tenants in use:    ${report.tenants}`,
  ]
  if (report.byTenant.length > 0) {
    lines.push('rows per tenant (tenant id, count):')
    for (const row of report.byTenant) lines.push(`  ${row.tenantId}  ${row.products}`)
  }
  if (report.withoutTenant > 0) {
    lines.push('', `${report.withoutTenant} row(s) have no company. Nobody can read them through the app until an operator decides, per row or per batch, which company owns them.`)
  }
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------------------------------------------------
// staging validation
// ---------------------------------------------------------------------------------------------------------------------

/** The database must already be exactly at the repository's migrations. The validator never applies one. */
export async function assertMigrationsCurrent(client, files) {
  const exists = (await client.query(`select to_regclass('public.schema_migrations') is not null as ok`)).rows[0].ok
  if (!exists) throw new Error('This database has no schema_migrations table. Baseline or migrate it first (outside this script).')
  const applied = new Map((await client.query('select name, checksum from schema_migrations')).rows.map((row) => [row.name, row.checksum]))
  const plan = planMigrations(files, applied)
  const problems = []
  if (plan.pending.length > 0) problems.push(`not applied: ${plan.pending.join(', ')}`)
  if (plan.changed.length > 0) problems.push(`changed since applied: ${plan.changed.join(', ')}`)
  if (plan.unknown.length > 0) problems.push(`recorded but no file: ${plan.unknown.join(', ')}`)
  if (plan.gaps.length > 0) problems.push(`out of order: ${plan.gaps.join(', ')}`)
  if (problems.length > 0) throw new Error(`The database is not at the repository's migrations (${problems.join('; ')}).`)
}

const DENIED = /permission denied|row-level security|violates|must be owner|not allowed/i

/**
 * Isolation checks against a real Postgres with Supabase roles. One transaction, always rolled back; every statement that is
 * meant to fail runs inside a savepoint. Synthetic users, companies and products are made up for this run and removed by the
 * rollback. Returns `{ ok, checks }`, where each check is `{ name, ok, detail }`.
 */
export async function runIsolationChecks(client, runId) {
  const checks = []
  const record = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail: ok ? '' : String(detail) })
  const q = (text, params) => client.query(text, params)
  const uuid = async () => (await q('select gen_random_uuid() as id')).rows[0].id

  async function as(role, uid, fn) {
    await q(`set local role ${role}`)
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid, role } : { role })])
    try {
      return await fn()
    } finally {
      await q('reset role')
      await q(`select set_config('request.jwt.claims', '', true)`)
    }
  }

  let savepoints = 0
  async function attempt(text, params) {
    const name = `v${(savepoints += 1)}`
    await q(`savepoint ${name}`)
    try {
      const result = await q(text, params)
      await q(`rollback to savepoint ${name}`)
      return { succeeded: true, rows: result.rows, message: '' }
    } catch (error) {
      await q(`rollback to savepoint ${name}`)
      return { succeeded: false, rows: [], message: error instanceof Error ? error.message : String(error) }
    }
  }
  async function expectDenied(name, role, uid, text, params) {
    const result = await as(role, uid, () => attempt(text, params))
    // A write that row security filters away raises no error: it changes zero rows. That counts as refused, but only for statements that ask for the changed rows back.
    const filteredAway = result.succeeded && result.rows.length === 0 && /\breturning\b/i.test(text)
    record(name, filteredAway || (!result.succeeded && DENIED.test(result.message)), result.succeeded ? 'the statement was allowed' : result.message)
  }
  async function visible(role, uid, text, params) {
    return as(role, uid, async () => (await q(text, params)).rows)
  }

  await q('begin')
  try {
    // ---- synthetic data: two companies, five people ----
    const people = {}
    for (const key of ['ownerA', 'readerA', 'noPermissionA', 'ownerB', 'stranger']) {
      people[key] = await uuid()
      await q('insert into auth.users (id, email) values ($1, $2)', [people[key], `${key}.${runId}@validation.invalid`])
    }
    const tenantA = (await q('select erp_bootstrap_tenant($1, $2, $3) as id', [`Validation A ${runId}`, `zz-validate-a-${runId}`, people.ownerA])).rows[0].id
    const tenantB = (await q('select erp_bootstrap_tenant($1, $2, $3) as id', [`Validation B ${runId}`, `zz-validate-b-${runId}`, people.ownerB])).rows[0].id
    async function memberWith(tenantId, ownerId, userId, granted) {
      const role = (await q('insert into roles (tenant_id, name, created_by) values ($1, $2, $3) returning id', [tenantId, `validate-${await uuid()}`, ownerId])).rows[0].id
      for (const permission of granted) {
        await q('insert into role_permissions (tenant_id, role_id, permission, created_by) values ($1, $2, $3, $4)', [tenantId, role, permission, ownerId])
      }
      await q('insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)', [tenantId, userId, role, ownerId])
    }
    await memberWith(tenantA, people.ownerA, people.readerA, ['inventory.item.read'])
    await memberWith(tenantA, people.ownerA, people.noPermissionA, ['finance.invoice.read'])
    const productIds = { a: [], b: [] }
    for (const [label, tenantId, owner, names] of [
      ['a', tenantA, people.ownerA, ['validate-a-1', 'validate-a-2']],
      ['b', tenantB, people.ownerB, ['validate-b-1']],
    ]) {
      for (const name of names) {
        productIds[label].push(
          (await q(`insert into products (tenant_id, created_by, name, price) values ($1, $2, $3, 1.5) returning id`, [tenantId, owner, name])).rows[0].id
        )
      }
    }
    const viewerA = (await q(`select id from roles where tenant_id = $1 and name = 'viewer'`, [tenantA])).rows[0].id
    const invitationA = (
      await q(
        `insert into tenant_invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, $3, $4, now() + interval '1 day', $5) returning id`,
        [tenantA, `invitee.${runId}@validation.invalid`, viewerA, 'a'.repeat(64), people.ownerA]
      )
    ).rows[0].id

    // ---- products: who sees what ----
    const names = (rows) => rows.map((row) => row.name).sort()
    const readProducts = (uid) => visible('authenticated', uid, 'select name from products order by name')
    record('products: owner A sees exactly company A\'s products', JSON.stringify(names(await readProducts(people.ownerA))) === JSON.stringify(['validate-a-1', 'validate-a-2']), 'unexpected rows')
    record('products: owner B sees exactly company B\'s products', JSON.stringify(names(await readProducts(people.ownerB))) === JSON.stringify(['validate-b-1']), 'unexpected rows')
    record('products: a member holding inventory.item.read sees company A\'s products', (await readProducts(people.readerA)).length === 2, 'wrong count')
    record('products: a member without inventory.item.read sees none', (await readProducts(people.noPermissionA)).length === 0, 'rows leaked')
    record('products: a signed-in user with no company sees none', (await readProducts(people.stranger)).length === 0, 'rows leaked')
    record(
      'products: owner A cannot read company B\'s product by id',
      (await visible('authenticated', people.ownerA, 'select id from products where id = $1', [productIds.b[0]])).length === 0,
      'cross-tenant read'
    )
    await expectDenied('products: anonymous callers are refused', 'anon', null, 'select name from products')
    await expectDenied('products: owner A cannot insert directly', 'authenticated', people.ownerA, `insert into products (tenant_id, created_by, name, price) values ($1, $2, 'x', 1)`, [tenantA, people.ownerA])
    await expectDenied('products: owner A cannot update company B\'s product', 'authenticated', people.ownerA, `update products set name = 'hacked' where id = $1 returning id`, [productIds.b[0]])
    await expectDenied('products: owner A cannot update their own company\'s product directly', 'authenticated', people.ownerA, `update products set name = 'hacked' where id = $1 returning id`, [productIds.a[0]])
    await expectDenied('products: owner A cannot delete a product directly', 'authenticated', people.ownerA, 'delete from products where id = $1 returning id', [productIds.a[0]])

    // ---- invitations ----
    record(
      'invitations: an owner sees their own company\'s invitation',
      (await visible('authenticated', people.ownerA, 'select id from tenant_invitations')).map((row) => row.id).join() === invitationA,
      'unexpected visibility'
    )
    record('invitations: a member without iam.member.read sees none', (await visible('authenticated', people.readerA, 'select id from tenant_invitations')).length === 0, 'rows leaked')
    record('invitations: owner B sees none of company A\'s', (await visible('authenticated', people.ownerB, 'select id from tenant_invitations where tenant_id = $1', [tenantA])).length === 0, 'cross-tenant read')
    await expectDenied('invitations: token_hash is unreadable to owners', 'authenticated', people.ownerA, 'select token_hash from tenant_invitations')
    await expectDenied('invitations: browsers cannot write', 'authenticated', people.ownerA, `update tenant_invitations set status = 'accepted' where id = $1 returning id`, [invitationA])

    // ---- every tenant table ----
    const tenantTables = (
      await q(
        `select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
         where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE' order by c.table_name`
      )
    ).rows.map((row) => row.table_name)
    record('tenant tables: at least the core tables are present', ['tenant_members', 'roles', 'role_permissions', 'products', 'audit_log', 'tenant_invitations'].every((name) => tenantTables.includes(name)), `found ${tenantTables.join(', ')}`)
    const leaks = []
    const writable = []
    for (const table of tenantTables) {
      const canRead = (await q(`select has_column_privilege('authenticated', $1, 'tenant_id', 'select') as ok`, [`public.${table}`])).rows[0].ok
      if (canRead) {
        const rowsOfB = await visible('authenticated', people.ownerA, `select count(*)::int as n from public.${table} where tenant_id = $1`, [tenantB])
        if (rowsOfB[0].n > 0) leaks.push(`${table}: owner A reads ${rowsOfB[0].n} row(s) of company B`)
        const rowsOfStranger = await visible('authenticated', people.stranger, `select count(*)::int as n from public.${table} where tenant_id in ($1, $2)`, [tenantA, tenantB])
        if (rowsOfStranger[0].n > 0) leaks.push(`${table}: a user with no company reads ${rowsOfStranger[0].n} row(s)`)
      }
      const privileges = (
        await q(
          `select has_table_privilege('authenticated', $1, 'insert') or has_table_privilege('authenticated', $1, 'update') or has_table_privilege('authenticated', $1, 'delete')
                 or has_table_privilege('anon', $1, 'select') or has_table_privilege('anon', $1, 'insert') or has_table_privilege('anon', $1, 'update') or has_table_privilege('anon', $1, 'delete') as open`,
          [`public.${table}`]
        )
      ).rows[0].open
      if (privileges) writable.push(table)
    }
    record('tenant tables: no company can read another company\'s rows', leaks.length === 0, leaks.join('; '))
    record('tenant tables: browsers cannot write, and anonymous callers cannot touch, any of them', writable.length === 0, `open to browsers: ${writable.join(', ')}`)

    // ---- functions that must stay server-only ----
    for (const signature of ['erp_bootstrap_tenant(text, text, uuid)']) {
      const exposed = (await q(`select has_function_privilege('authenticated', $1, 'execute') or has_function_privilege('anon', $1, 'execute') as open`, [signature])).rows[0].open
      record(`functions: ${signature} cannot be called by browsers`, !exposed, 'execute is granted to anon or authenticated')
    }
  } finally {
    await q('rollback')
  }

  // The synthetic data must be gone.
  const leftovers = (await q(`select count(*)::int as n from tenants where slug like $1`, [`zz-validate-%-${runId}`])).rows[0].n
  record('cleanup: the synthetic companies were rolled back', leftovers === 0, `${leftovers} left behind`)
  return { ok: checks.every((check) => check.ok), checks }
}

export function formatValidation(result, target) {
  const lines = [`staging validation`, `target: ${target.user}@${target.host}/${target.database}`, '']
  for (const check of result.checks) lines.push(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}${check.ok ? '' : `  -> ${check.detail}`}`)
  lines.push('', result.ok ? `All ${result.checks.length} checks passed. Everything this run wrote was rolled back.` : `${result.checks.filter((check) => !check.ok).length} of ${result.checks.length} checks FAILED.`)
  return lines.join('\n') + '\n'
}
