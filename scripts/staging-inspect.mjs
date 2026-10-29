// Read-only look at a staging database. It does not apply migrations and it does not change rows.
//
//   node --env-file=.env.staging scripts/staging-inspect.mjs --expect-host pikqnlzkoaxoxpahztvc --i-understand-this-is-staging
//
// The connection string is never printed. A project that is not in database/approved-staging-targets.json is refused
// before any connection.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { assertMigrationTarget, sslOptions } from './migrate-lib.mjs'

const args = process.argv.slice(2)
const expectIndex = args.indexOf('--expect-host')
const expectHost = expectIndex === -1 ? undefined : args[expectIndex + 1]
const acknowledged = args.includes('--i-understand-this-is-staging')
const url = process.env.DATABASE_URL
if (!url) {
  process.stderr.write('DATABASE_URL is not set.\n')
  process.exit(1)
}

const approvedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'approved-staging-targets.json')
let approved = []
try {
  approved = JSON.parse(await readFile(approvedPath, 'utf8')).projects
} catch {
  process.stderr.write('database/approved-staging-targets.json could not be read.\n')
  process.exit(1)
}
let target
try {
  target = assertMigrationTarget(url, { expectHost, acknowledged, approved })
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
if (target.scope !== 'staging') {
  process.stderr.write('This inspection is for the approved staging project, not a local database.\n')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: url,
  ssl: sslOptions(process.env.DATABASE_SSL ?? 'require', process.env.DATABASE_SSL_CA),
})
await client.connect()
try {
  await client.query('begin read only')
  const version = (await client.query('select current_setting(\'server_version\') as version')).rows[0].version
  const database = (await client.query('select current_database() as name')).rows[0].name
  const history = (await client.query(`select to_regclass('public.schema_migrations') is not null as ok`)).rows[0].ok
  const applied = history
    ? (await client.query('select name from schema_migrations order by name')).rows.map((row) => row.name)
    : []
  const counts = []
  for (const table of ['tenants', 'invoices', 'items', 'journal_entries', 'stock_movements', 'customers', 'suppliers']) {
    const exists = (await client.query('select to_regclass($1) is not null as ok', [`public.${table}`])).rows[0].ok
    if (!exists) {
      counts.push(`${table}: absent`)
      continue
    }
    const count = (await client.query(`select count(*)::int as n from public.${table}`)).rows[0].n
    counts.push(`${table}: ${count}`)
  }
  await client.query('rollback')
  process.stdout.write(
    [
      'staging inspection (read only)',
      `host: ${target.host}`,
      `database: ${database}`,
      `server_version: ${version}`,
      `schema_migrations: ${history ? applied.join(', ') || '(table empty)' : 'absent'}`,
      ...counts,
      '',
    ].join('\n')
  )
} catch (error) {
  try {
    await client.query('rollback')
  } catch {
    // The read-only transaction may already be closed.
  }
  process.stderr.write(`Inspection failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
