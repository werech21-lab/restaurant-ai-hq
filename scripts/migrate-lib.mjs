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
  '0017_inventory_valuation.sql': ['public.inventory_settings', 'public.item_cost_events'],
  '0018_kitchen_and_delivery_live.sql': ['public.recipes', 'public.kitchen_waste', 'public.delivery_orders'],
  '0019_operational_posting.sql': ['public.kitchen_productions', 'public.delivery_settlements'],
  '0020_operational_read_policies.sql': ['fn:erp_operational_read_marker()'],
  '0021_sales_revenue.sql': ['def:journal_entries_source_guard:sales_revenue'],
  '0022_admin_rbac_audit_logs.sql': ['public.audit_activity_logs'],
  '0023_permission_flag_nulls.sql': ['def:auth_has_permission:coalesce(m.permission_flags'],
  '0024_hr_operations_suite.sql': ['public.hr_employees', 'public.hr_payroll_runs', 'public.enterprise_contracts', 'public.quality_maintenance_tickets'],
  '0025_autonomous_governance_ocr_ci_suite.sql': ['public.contract_ai_analyses', 'public.regulatory_circulars', 'public.smart_archive_documents', 'public.competitive_intelligence_radar'],
  '0026_legal_admin_governance_iot_investigations.sql': ['public.gov_violations_tracker', 'public.connected_devices', 'public.legal_investigations', 'public.executive_alerts_and_tasks', 'public.hr_service_requests_appointments'],
  '0027_aggregator_5min_geo_rank_radar.sql': ['public.aggregator_geo_rank_snapshots', 'public.aggregator_top_competitors_bench', 'public.aggregator_rank_escalation_actions'],
  '0028_aggregator_rank_rescue_radar.sql': ['fn:erp_aggregator_rank_rescue_marker()'],
  '0029_venture_foods_brands_aggregator_radar.sql': ['public.venture_brands', 'fn:erp_venture_foods_brands_marker()'],
  '0030_venture_foods_exclusive_brands_radar.sql': ['fn:erp_venture_foods_exclusive_marker()'],
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

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * A remote migration needs three things before any connection: the staging acknowledgement, a project ref that appears in
 * the connection target, and that same ref in database/approved-staging-targets.json. Loopback is the local trial and
 * needs none of them. The error text never includes the connection string.
 */
export function assertMigrationTarget(url, { expectHost, acknowledged, approved }) {
  let host = ''
  let user = ''
  try {
    const parsed = new URL(url)
    host = parsed.hostname
    user = decodeURIComponent(parsed.username)
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.')
  }
  if (LOCAL_HOSTS.has(host)) return { scope: 'local', host }
  if (acknowledged !== true) {
    throw new Error('Refusing to migrate a remote database without --i-understand-this-is-staging.')
  }
  const name = typeof expectHost === 'string' ? expectHost.trim() : ''
  if (name.length < 6 || name.startsWith('--') || name.includes('YOUR_')) {
    throw new Error('--expect-host is required and must name the approved staging project.')
  }
  if (!`${user}@${host}`.includes(name)) {
    throw new Error('Refusing to migrate: the connection string does not point at the project named by --expect-host.')
  }
  if (!Array.isArray(approved) || !approved.includes(name)) {
    throw new Error('Refusing to migrate: this project is not listed in database/approved-staging-targets.json.')
  }
  return { scope: 'staging', host }
}

/** Same rules as src/lib/db-ssl.ts, for the migration runner. */
export function sslOptions(mode, ca) {
  if (mode === 'disable') return false
  if (mode === 'require') return { rejectUnauthorized: false }
  const pem = ca?.replace(/\\n/g, '\n').trim()
  return pem ? { rejectUnauthorized: true, ca: pem } : true
}
