/**
 * Read-only check of per-bucket receivable aging against an owner export.
 *
 * Looks for local-dropzone/aged-receivable.csv (gitignored). Does not call a
 * remote database write, does not flip PER_CUSTOMER_DUE_DATE_AGING_VERIFIED,
 * and does not print credentials.
 *
 * CSV columns: bucket,total_kwd
 * bucket is one of 0_30, 31_60, over_60.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const file = path.join(process.cwd(), 'local-dropzone', 'aged-receivable.csv')

function main(): void {
  if (!existsSync(file)) {
    process.stdout.write(
      'ar-aging: no local-dropzone/aged-receivable.csv; flag stays false\n',
    )
    return
  }
  const lines = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('bucket'))
  const totals = new Map<string, number>()
  for (const line of lines) {
    const [bucket, raw] = line.split(',')
    if (!bucket || raw === undefined) continue
    totals.set(bucket.trim(), Number(raw))
  }
  const keys = ['0_30', '31_60', 'over_60']
  const missing = keys.filter((key) => !Number.isFinite(totals.get(key) ?? Number.NaN))
  if (missing.length) {
    process.stdout.write(`ar-aging: export missing buckets ${missing.join(',')}; flag stays false\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(
    `ar-aging: export buckets present (${keys.map((key) => `${key}=${totals.get(key)}`).join(', ')}); compare with account.move.line before flipping the flag\n`,
  )
}

main()
