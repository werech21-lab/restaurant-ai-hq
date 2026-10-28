// Pure planning logic for scripts/migrate.mjs. No database access here, so it can be tested without one.

/**
 * What proves a migration is already in the database, for the baseline command. A migration that is not listed here
 * cannot be baselined: add a line when you add a migration, naming an object that only that migration creates.
 * Tables are written `schema.name`, functions `fn:name(argument types)`. A migration that only replaces an existing
 * function creates no new object, so it names `def:function:text` instead: text that the new body contains and the old
 * one does not.
 */
export const baselineSentinels = {
  '0001_core.sql': ['public.tenants', 'public.audit_log'],
  '0002_crm.sql': ['public.customers'],
  '0003_inventory.sql': ['public.items'],
  '0004_finance.sql': ['public.invoices', 'public.payments'],
  '0005_bootstrap.sql': ['fn:erp_bootstrap_tenant(text, text, uuid)'],
  '0006_inventory_ops.sql': ['public.stock_balances'],
  '0007_crm_sales.sql': ['public.sales_quotations'],
  '0008_ai_automation.sql': ['public.ai_action_approvals'],
  // The legacy products table may already exist before 0009, so the sentinel is a function only 0009 creates.
  '0009_products_tenant.sql': ['fn:products_guard()'],
  '0010_iam.sql': ['public.tenant_invitations'],
  '0011_org.sql': ['public.brands', 'public.branches'],
  '0012_ledger.sql': ['public.accounts', 'public.fiscal_periods', 'public.journal_entries', 'public.journal_lines'],
  '0013_procurement.sql': ['public.suppliers', 'public.purchase_orders', 'public.goods_receipts', 'public.goods_receipt_lines'],
  '0014_procure_to_pay.sql': [
    'public.purchase_requests',
    'public.purchase_request_lines',
    'public.procurement_accounting',
    'public.supplier_invoices',
      'public.supplier_invoice_lines',
    ],
    '0015_p2p_financial_completion.sql': [
      'public.purchase_returns',
      'public.purchase_return_lines',
      'public.supplier_credit_notes',
      'public.supplier_credit_note_lines',
      'public.supplier_payments',
      'public.supplier_payment_allocations',
    ],
    '0016_freeze_invoice_notes.sql': ['def:invoices_freeze:new.notes'],
  }

/**
 * Compares the migration files with the recorded history.
 * `files` is [{ name, checksum }] in order, `applied` is a Map of name to checksum.
 */
export function planMigrations(files, applied) {
  const known = new Set(files.map((file) => file.name))
  const pending = []
  const upToDate = []
  const changed = []
  for (const file of files) {
    const previous = applied.get(file.name)
    if (previous === undefined) pending.push(file.name)
    else if (previous !== file.checksum) changed.push(file.name)
    else upToDate.push(file.name)
  }
  const unknown = [...applied.keys()].filter((name) => !known.has(name))
  // A gap means a later migration is recorded while an earlier one is not. Applying the earlier one now would run out of order.
  const lastApplied = Math.max(-1, ...files.map((file, index) => (applied.has(file.name) ? index : -1)))
  const gaps = files.filter((file, index) => index < lastApplied && !applied.has(file.name)).map((file) => file.name)
  return { pending, upToDate, changed, unknown, gaps }
}

/**
 * True when the database already holds the schema but has no migration history. That is the state of a database set up by
 * hand (for example in the Supabase SQL editor). Running the migrations on it would replay migration 0001 over live tables.
 */
export function isUnbaselined({ historyRows, hasCoreTables }) {
  return historyRows === 0 && hasCoreTables
}

/**
 * Which files a baseline up to `through` would record, and which sentinel objects must exist first.
 * Throws when the request is unsafe: unknown file, a file without a sentinel, or something already recorded out of order.
 */
export function planBaseline(files, applied, through) {
  const index = files.findIndex((file) => file.name === through)
  if (index === -1) throw new Error(`${through} is not a migration file.`)
  const covered = files.slice(0, index + 1)
  const missingSentinel = covered.filter((file) => baselineSentinels[file.name] === undefined).map((file) => file.name)
  if (missingSentinel.length > 0) {
    throw new Error(`Cannot baseline ${missingSentinel.join(', ')}: no sentinel objects are defined for it in scripts/migrate-lib.mjs.`)
  }
  const changed = covered.filter((file) => applied.has(file.name) && applied.get(file.name) !== file.checksum).map((file) => file.name)
  if (changed.length > 0) throw new Error(`${changed.join(', ')} is recorded with a different checksum. Resolve that first.`)
  const record = covered.filter((file) => !applied.has(file.name))
  const sentinels = record.flatMap((file) => baselineSentinels[file.name].map((object) => ({ migration: file.name, object })))
  return { record, sentinels }
}

/** A baseline must not skip over a migration that is not covered but is already recorded. */
export function assertNothingBeyond(files, applied, through) {
  const index = files.findIndex((file) => file.name === through)
  const beyond = files.slice(index + 1).filter((file) => applied.has(file.name)).map((file) => file.name)
  if (beyond.length > 0) throw new Error(`${beyond.join(', ')} is already recorded after ${through}. Baseline only an empty or shorter history.`)
}

/** Same rules as src/lib/db-ssl.ts, for the migration runner. */
export function sslOptions(mode, ca) {
  if (mode === 'disable') return false
  if (mode === 'require') return { rejectUnauthorized: false }
  const pem = ca?.replace(/\\n/g, '\n').trim()
  return pem ? { rejectUnauthorized: true, ca: pem } : true
}
