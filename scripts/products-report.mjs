// Read-only report on the legacy `products` table: how many rows have no tenant_id. Prints counts only, never a product.
// It does not move, assign or change anything, and runs inside a read-only transaction that is rolled back.
//
//   node --env-file=.env.staging scripts/products-report.mjs --expect-host <project-ref>
//
// DATABASE_URL must point at the database you mean to inspect. --expect-host names the project (its ref appears in the host
// or in the pooler user name) and the script refuses to connect to anything else. Point it at staging first.
import pg from 'pg'
import { assertExpectedTarget, collectProductsReport, formatProductsReport, parseTarget } from './ops-lib.mjs'
import { sslOptions } from './migrate-lib.mjs'

const args = process.argv.slice(2)
const expectIndex = args.indexOf('--expect-host')
const expected = expectIndex === -1 ? undefined : args[expectIndex + 1]
const json = args.includes('--json')

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

const client = new pg.Client({ connectionString: url, ssl: sslOptions(process.env.DATABASE_SSL ?? 'require', process.env.DATABASE_SSL_CA) })
try {
  await client.connect()
  const report = await collectProductsReport(client)
  process.stdout.write(json ? JSON.stringify({ target: parseTarget(url), ...report }, null, 2) + '\n' : formatProductsReport(report, parseTarget(url)))
} catch (error) {
  process.stderr.write(`Report failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => undefined)
}