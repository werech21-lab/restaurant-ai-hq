// Isolation checks for a Supabase STAGING database: two synthetic companies, products, invitations, RLS and grants, as the
// real `authenticated` and `anon` roles. Everything runs in one transaction that is always rolled back.
//
//   node --env-file=.env.staging scripts/staging-validate.mjs --expect-host <staging-project-ref> --i-understand-this-is-staging
//
// It never applies a migration: if the database is not exactly at the repository's migrations it stops and says so.
// It only ever uses made-up users and companies. It refuses to run without --expect-host and the acknowledgement flag.
import { createHash, randomBytes } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { sslOptions } from './migrate-lib.mjs'
import { assertExpectedTarget, assertMigrationsCurrent, formatValidation, parseTarget, runIsolationChecks } from './ops-lib.mjs'

const args = process.argv.slice(2)
const expectIndex = args.indexOf('--expect-host')
const expected = expectIndex === -1 ? undefined : args[expectIndex + 1]

if (!args.includes('--i-understand-this-is-staging')) {
  process.stderr.write('Add --i-understand-this-is-staging to confirm the target is a staging database, not production.\n')
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) {
  process.stderr.write('DATABASE_URL is not set.\n')
  process.exit(1)
}
try {
  assertExpectedTarget(url, expected)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
}

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'migrations')
const files = []
for (const name of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
  const sql = await readFile(path.join(directory, name), 'utf8')
  files.push({ name, checksum: createHash('sha256').update(sql).digest('hex') })
}

const client = new pg.Client({ connectionString: url, ssl: sslOptions(process.env.DATABASE_SSL ?? 'require', process.env.DATABASE_SSL_CA) })
try {
  await client.connect()
  await assertMigrationsCurrent(client, files)
  const result = await runIsolationChecks(client, randomBytes(4).toString('hex'))
  process.stdout.write(formatValidation(result, parseTarget(url)))
  process.exitCode = result.ok ? 0 : 1
} catch (error) {
  process.stderr.write(`Validation could not run: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => undefined)
}