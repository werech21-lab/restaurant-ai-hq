// Applies database/migrations/*.sql in order, each inside one transaction.
//
//   node --env-file=.env.local scripts/migrate.mjs                              apply pending migrations on 127.0.0.1
//   node --env-file=.env.local scripts/migrate.mjs --status                     read-only: show what is applied and pending
//   node --env-file=.env.local scripts/migrate.mjs --baseline <file>            dry run: show what would be recorded
//   node --env-file=.env.local scripts/migrate.mjs --baseline <file> --confirm  record migrations up to <file> as applied
//
// A remote database is refused unless all three hold, and the check runs before any connection:
//   --i-understand-this-is-staging
//   --expect-host <project-ref> matches the host or the pooler user
//   that same ref is listed in database/approved-staging-targets.json
//
// An applied migration whose file has changed is reported and the run stops: merged migrations are never edited.
// Baseline is for a database that was set up by hand and has no history yet. It only writes rows to schema_migrations
// and never runs a migration. It first checks that the objects each migration creates really exist.
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { assertMigrationTarget, assertNothingBeyond, isUnbaselined, planBaseline, planMigrations, sslOptions } from './migrate-lib.mjs'

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations')
const args = process.argv.slice(2)
const statusOnly = args.includes('--status')
const baselineIndex = args.indexOf('--baseline')
const baselineThrough = baselineIndex === -1 ? null : args[baselineIndex + 1]
const confirm = args.includes('--confirm')
const expectIndex = args.indexOf('--expect-host')
const expectHost = expectIndex === -1 ? undefined : args[expectIndex + 1]
const acknowledged = args.includes('--i-understand-this-is-staging')

if (baselineIndex !== -1 && (!baselineThrough || baselineThrough.startsWith('--'))) {
  process.stderr.write('--baseline needs the last migration file to record, for example 0005_bootstrap.sql\n')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  process.stderr.write('DATABASE_URL is not set.\n')
  process.exit(1)
}
const sslMode = process.env.DATABASE_SSL ?? 'require'
const ssl = sslOptions(sslMode, process.env.DATABASE_SSL_CA)

const approvedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'approved-staging-targets.json')
let approved = []
try {
  approved = JSON.parse(await readFile(approvedPath, 'utf8')).projects
} catch {
  process.stderr.write('database/approved-staging-targets.json could not be read.\n')
  process.exit(1)
}
try {
  assertMigrationTarget(url, { expectHost, acknowledged, approved })
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl })
await client.connect()

async function readFiles() {
  const names = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  const files = []
  for (const name of names) {
    const sql = (await readFile(path.join(directory, name), 'utf8')).replace(/\r\n/g, '\n')
    files.push({ name, sql, checksum: createHash('sha256').update(sql).digest('hex') })
  }
  return files
}

async function readHistory() {
  const exists = (await client.query(`select to_regclass('public.schema_migrations') is not null as ok`)).rows[0].ok
  if (!exists) return { exists: false, applied: new Map() }
  const rows = (await client.query('select name, checksum from schema_migrations')).rows
  return { exists: true, applied: new Map(rows.map((row) => [row.name, row.checksum])) }
}

async function hasCoreTables() {
  return (await client.query(`select to_regclass('public.tenants') is not null as ok`)).rows[0].ok
}

async function objectExists(object) {
  if (object.startsWith('fn:')) {
    return (await client.query('select to_regprocedure($1) is not null as ok', [object.slice(3)])).rows[0].ok
  }
  if (object.startsWith('def:')) {
    const [name, text] = [object.slice(4, object.indexOf(':', 4)), object.slice(object.indexOf(':', 4) + 1)]
    const sql = `select exists (select 1 from pg_proc where proname = $1 and pg_get_functiondef(oid) like '%' || $2 || '%') as ok`
    return (await client.query(sql, [name, text])).rows[0].ok
  }
  return (await client.query('select to_regclass($1) is not null as ok', [object])).rows[0].ok
}

function describe(plan) {
  const lines = []
  for (const name of plan.upToDate) lines.push(`applied  ${name}`)
  for (const name of plan.changed) lines.push(`CHANGED  ${name}  (file differs from what was applied)`)
  for (const name of plan.pending) lines.push(`pending  ${name}`)
  for (const name of plan.unknown) lines.push(`UNKNOWN  ${name}  (recorded in the database, no such file)`)
  return lines.join('\n') + '\n'
}

try {
  const files = await readFiles()
  const history = await readHistory()
  const plan = planMigrations(files, history.applied)
  const unbaselined = isUnbaselined({ historyRows: history.applied.size, hasCoreTables: await hasCoreTables() })

  if (statusOnly) {
    process.stdout.write(describe(plan))
    if (unbaselined) process.stdout.write('\nThe database already has tables but no migration history. Run --baseline first.\n')
    if (plan.gaps.length > 0) process.stdout.write(`\nOut of order: ${plan.gaps.join(', ')} is not applied but a later migration is.\n`)
    process.exitCode = plan.changed.length > 0 || plan.gaps.length > 0 || unbaselined ? 1 : 0
  } else if (baselineThrough) {
    if (!unbaselined && history.applied.size > 0) {
      throw new Error('This database already has a migration history. --baseline is only for a database that has none.')
    }
    assertNothingBeyond(files, history.applied, baselineThrough)
    const baseline = planBaseline(files, history.applied, baselineThrough)
    const missing = []
    for (const { migration, object } of baseline.sentinels) {
      if (!(await objectExists(object))) missing.push(`${migration}: ${object}`)
    }
    if (missing.length > 0) {
      throw new Error(`These objects do not exist, so those migrations are not really applied:\n  ${missing.join('\n  ')}`)
    }
    process.stdout.write(`Would record as applied (no SQL is run):\n${baseline.record.map((file) => `  ${file.name}`).join('\n')}\n`)
    if (!confirm) {
      process.stdout.write('\nDry run. Add --confirm to write these rows to schema_migrations.\n')
    } else {
      await client.query('begin')
      try {
        await client.query(
          `create table if not exists schema_migrations (
             name text primary key,
             checksum text not null,
             applied_at timestamptz not null default now()
           )`
        )
        for (const file of baseline.record) {
          await client.query('insert into schema_migrations (name, checksum) values ($1, $2)', [file.name, file.checksum])
        }
        await client.query('commit')
        process.stdout.write(`\nRecorded ${baseline.record.length} migration(s).\n`)
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    }
  } else {
    if (unbaselined) {
      throw new Error(
        'The database already has tables but no migration history, so migration 0001 would run over live data. ' +
          'Check it with --status, then record the migrations it already has with --baseline <file> --confirm.'
      )
    }
    if (plan.changed.length > 0) {
      throw new Error(`${plan.changed.join(', ')} was changed after it was applied. Add a new migration instead.`)
    }
    if (plan.gaps.length > 0) {
      throw new Error(`${plan.gaps.join(', ')} is not applied but a later migration is. Resolve the order by hand.`)
    }
    await client.query(
      `create table if not exists schema_migrations (
         name text primary key,
         checksum text not null,
         applied_at timestamptz not null default now()
       )`
    )
    for (const file of files) {
      if (history.applied.has(file.name)) {
        process.stdout.write(`skip   ${file.name}\n`)
        continue
      }
      await client.query('begin')
      try {
        await client.query(file.sql)
        await client.query('insert into schema_migrations (name, checksum) values ($1, $2)', [file.name, file.checksum])
        await client.query('commit')
        process.stdout.write(`apply  ${file.name}\n`)
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    }
  }
} catch (error) {
  process.stderr.write(`Migration failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
