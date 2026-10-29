// Posts the missing sales-revenue journals against the local server on Staging, then prints counts only.
//
//   node --env-file=.env.staging scripts/staging-phase4.mjs --expect-host pikqnlzkoaxoxpahztvc --i-understand-this-is-staging
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { assertMigrationTarget, sslOptions } from './migrate-lib.mjs'

const expectIndex = process.argv.indexOf('--expect-host')
const expectHost = expectIndex === -1 ? undefined : process.argv[expectIndex + 1]
const acknowledged = process.argv.includes('--i-understand-this-is-staging')
const url = process.env.DATABASE_URL
if (!url) {
  process.stderr.write('DATABASE_URL is not set.\n')
  process.exit(1)
}
const approvedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'approved-staging-targets.json')
const approved = JSON.parse(await readFile(approvedPath, 'utf8')).projects
try {
  assertMigrationTarget(url, { expectHost, acknowledged, approved })
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

const base = 'http://127.0.0.1:4020'
const login = await fetch(`${base}/dev/owner?next=/erp/finance`, { redirect: 'manual' })
const setCookie = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : []
const cookie = setCookie.map((value) => value.split(';')[0]).join('; ')
if (login.status !== 307 || !cookie.includes('aether_dev_owner=')) {
  process.stderr.write(`Owner session was not issued (status ${login.status}).\n`)
  process.exit(1)
}

const response = await fetch(`${base}/api/v1/finance/revenue-journals`, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json', cookie, 'Idempotency-Key': 'staging-phase4-revenue-v1' },
  body: '{}',
})
const payload = await response.json().catch(() => null)
if (![200, 201].includes(response.status)) {
  const code = payload?.error?.code ?? 'unknown'
  process.stderr.write(`revenue ${code} (${response.status})\n`)
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: sslOptions(process.env.DATABASE_SSL ?? 'require', process.env.DATABASE_SSL_CA) })
await client.connect()
try {
  const counts = await client.query(
    `select
       (select count(*)::int from schema_migrations) as migrations,
       (select count(*)::int from journal_entries where status = 'posted') as posted,
       (select count(*)::int from journal_entries where status = 'posted' and source_type = 'sales_revenue') as sales_revenue,
       (select coalesce(sum(l.credit_minor), 0)::bigint
          from journal_lines l
          join journal_entries e on e.tenant_id = l.tenant_id and e.id = l.entry_id
         where e.status = 'posted' and e.source_type = 'sales_revenue') as revenue_credit,
       (select count(*)::int from journal_entries e
         where e.status = 'posted'
           and (select coalesce(sum(debit_minor), 0) from journal_lines l where l.entry_id = e.id)
             <> (select coalesce(sum(credit_minor), 0) from journal_lines l where l.entry_id = e.id)) as unbalanced,
       (select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
          from journal_lines l
          join accounts a on a.tenant_id = l.tenant_id and a.id = l.account_id
         where a.code = '1100') as ar_net,
       (select number from invoices where number = 'INV-000001' limit 1) as invoice_number`
  )
  const row = counts.rows[0]
  process.stdout.write(
    `revenue_posted ${payload?.data?.posted ?? 0}\n` +
      `migrations ${row.migrations}\n` +
      `posted ${row.posted}\n` +
      `sales_revenue ${row.sales_revenue}\n` +
      `revenue_credit ${row.revenue_credit}\n` +
      `unbalanced ${row.unbalanced}\n` +
      `ar_net ${row.ar_net}\n` +
      `invoice ${row.invoice_number}\n`
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Phase 4 counts failed: ${message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
