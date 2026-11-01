// Read-only DEMO token scan across public text columns on staging.
//   node --env-file=.env.staging scripts/staging-demo-scan.mjs --expect-host pikqnlzkoaxoxpahztvc --i-understand-this-is-staging
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
const approved = JSON.parse(await readFile(approvedPath, 'utf8')).projects
const target = assertMigrationTarget(url, { expectHost, acknowledged, approved })
if (target.scope !== 'staging') {
  process.stderr.write('Staging only.\n')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: url,
  ssl: sslOptions(process.env.DATABASE_SSL ?? 'require', process.env.DATABASE_SSL_CA),
})
await client.connect()
try {
  await client.query('begin read only')
  const tables = (
    await client.query(`select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations' order by tablename`)
  ).rows.map((row) => row.tablename)
  const hits = []
  for (const table of tables) {
    const cols = (
      await client.query(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1
           and data_type in ('text', 'character varying', 'jsonb')
         order by ordinal_position`,
        [table],
      )
    ).rows.map((row) => row.column_name)
    if (cols.length === 0) continue
    const safePredicate = cols.map((col) => `"${col.replace(/"/g, '""')}"::text ilike '%DEMO%'`).join(' or ')
    const result = await client.query(`select count(*)::int as n from public."${table.replace(/"/g, '""')}" where ${safePredicate}`)
    const n = result.rows[0].n
    if (n > 0) hits.push({ table, n })
  }
  await client.query('rollback')
  process.stdout.write(JSON.stringify({ host: target.host, demoHits: hits, demoTotal: hits.reduce((sum, row) => sum + row.n, 0) }, null, 2) + '\n')
} catch (error) {
  try {
    await client.query('rollback')
  } catch {
    /* ignore */
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
} finally {
  await client.end()
}
