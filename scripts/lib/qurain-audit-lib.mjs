/**
 * Pure helpers for the read-only Qurain monthly audit.
 * Qurain stays excluded from company totals; this file only classifies and groups rows
 * the CLI already read from Odoo.
 */

export const QURAIN_RE =
  /(?:^|[^a-z])(?:al-?)?(?:qurain|qurein|kurain|gurain|qrn\d*)(?![a-z])|(?:^|[\s(«])(?:بال|لل|ال|ب|و|ل)?قرين(?=$|[\s)»،.:-])/i

export function isQurainLabel(name) {
  return QURAIN_RE.test(String(name ?? ''))
}

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000

/** Keeps an Odoo month label. ISO dates collapse to YYYY-MM. Empty labels are dropped. */
export function monthKey(label) {
  const text = String(label ?? '').trim()
  if (!text || text === 'false') return null
  const iso = /^(\d{4})-(\d{2})/.exec(text)
  return iso ? `${iso[1]}-${iso[2]}` : text
}

/**
 * @param {{ configs: Array<{id:number,name:string,active?:boolean}>, sales: Array<{month:string,configId:number,configName:string,orders:number,netKwd:number}>, accounts: Array<{month:string,accountId:number,accountName:string,debitKwd:number,creditKwd:number}> | null }} input
 */
export function buildQurainMonthlyReport(input) {
  const configs = (input.configs ?? [])
    .filter((row) => isQurainLabel(row.name))
    .map((row) => ({
      id: row.id,
      name: String(row.name),
      active: row.active !== false,
    }))
    .sort((a, b) => a.id - b.id)

  const sales = (input.sales ?? [])
    .map((row) => ({
      month: monthKey(row.month),
      configId: row.configId,
      configName: String(row.configName ?? ''),
      orders: Math.round(Number(row.orders) || 0),
      netKwd: r3(row.netKwd),
    }))
    .filter((row) => row.month)
    .sort((a, b) => a.month.localeCompare(b.month) || a.configId - b.configId)

  const accounts =
    input.accounts == null
      ? null
      : input.accounts
          .map((row) => ({
            month: monthKey(row.month),
            accountId: row.accountId,
            accountName: String(row.accountName ?? ''),
            debitKwd: r3(row.debitKwd),
            creditKwd: r3(row.creditKwd),
          }))
          .filter((row) => row.month)
          .sort((a, b) => a.month.localeCompare(b.month) || a.accountId - b.accountId)

  return { configs, sales, accounts }
}

const fmt = (n) =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function renderQurainMonthlyMarkdown(report, meta) {
  const lines = [
    `# Qurain monthly audit ${meta.fromIso} → ${meta.toIso}`,
    '',
    'Read-only Odoo listing. Qurain is still excluded from company totals. This report does not add it.',
    `Generated ${meta.generatedAt}.`,
    '',
    '## POS configs',
    '',
  ]
  if (report.configs.length === 0) {
    lines.push('No pos.config name matched Qurain.')
  } else {
    lines.push('| id | name | active |', '|---:|---|---|')
    for (const row of report.configs) {
      lines.push(`| ${row.id} | ${row.name} | ${row.active ? 'yes' : 'no'} |`)
    }
  }
  lines.push('', '## Sales by month', '')
  if (report.sales.length === 0) {
    lines.push('No paid/done/invoiced pos.order rows on those configs in this window.')
  } else {
    lines.push('| month | config | orders | net KWD |', '|---|---|---:|---:|')
    for (const row of report.sales) {
      lines.push(`| ${row.month} | #${row.configId} ${row.configName} | ${row.orders} | ${fmt(row.netKwd)} |`)
    }
  }
  lines.push('', '## Accounts by month', '')
  if (report.accounts == null) {
    lines.push('Account lines were not readable in this Odoo database, so this section is omitted.')
  } else if (report.accounts.length === 0) {
    lines.push('No posted move lines on accounts whose name matches Qurain in this window.')
  } else {
    lines.push('| month | account | debit KWD | credit KWD |', '|---|---|---:|---:|')
    for (const row of report.accounts) {
      lines.push(`| ${row.month} | #${row.accountId} ${row.accountName} | ${fmt(row.debitKwd)} | ${fmt(row.creditKwd)} |`)
    }
  }
  lines.push('')
  return lines.join('\n')
}
