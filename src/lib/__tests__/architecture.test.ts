import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Enforces the module boundaries in .cursor/rules: a module is used only through `index.ts` (server) or `client.ts`
 * (browser), and no module reads or writes another module's tables.
 */

const srcDir = path.join(process.cwd(), 'src')
const modules = ['finance', 'crm', 'inventory', 'hr', 'ai', 'org', 'procurement', 'kitchen', 'delivery', 'admin', 'operations', 'governance', 'odoo'] as const
type ModuleName = (typeof modules)[number]

const ownedTables: Record<ModuleName, string[]> = {
  finance: ['invoices', 'invoice_lines', 'payments', 'finance_settings', 'accounts', 'fiscal_periods', 'journal_entries', 'journal_lines'],
  crm: ['customers', 'contacts', 'crm_leads_pipeline', 'sales_quotations', 'sales_quotation_lines'],
  inventory: ['items', 'warehouses', 'stock_movements', 'stock_balances', 'products', 'inventory_settings', 'item_cost_events'],
  hr: ['hr_employees', 'hr_shifts', 'hr_attendances', 'hr_leaves', 'hr_payroll_runs', 'hr_payslips', 'hr_appraisals', 'hr_expenses', 'hr_service_requests_appointments'],
  operations: ['enterprise_contracts', 'enterprise_documents', 'quality_maintenance_tickets'],
  governance: ['contract_ai_analyses', 'regulatory_circulars', 'compliance_enforcement_rules', 'compliance_blocked_attempts', 'ai_learning_memory', 'smart_archive_documents', 'employee_behavior_telemetry', 'competitive_intelligence_radar', 'gov_violations_tracker', 'connected_devices', 'iot_ai_monitoring_events', 'legal_investigations', 'executive_alerts_and_tasks', 'aggregator_geo_rank_snapshots', 'aggregator_top_competitors_bench', 'aggregator_rank_escalation_actions'],
  ai: ['ai_insights_alerts', 'ai_action_approvals', 'erp_automation_rules'],
  org: ['brands', 'branches'],
  procurement: ['suppliers', 'procurement_settings', 'purchase_orders', 'purchase_order_lines', 'goods_receipts', 'goods_receipt_lines', 'purchase_requests', 'purchase_request_lines', 'procurement_accounting', 'supplier_invoices', 'supplier_invoice_lines', 'purchase_returns', 'purchase_return_lines', 'supplier_credit_notes', 'supplier_credit_note_lines', 'supplier_payments', 'supplier_payment_allocations'],
  kitchen: ['recipes', 'recipe_lines', 'kitchen_waste', 'kitchen_productions'],
  delivery: ['delivery_partners', 'delivery_orders', 'delivery_settlements'],
  admin: ['audit_activity_logs', 'tenant_security_settings'],
  odoo: ['odoo_sync_jobs', 'odoo_imported_staging_records'],
}

type SourceFile = { file: string; relative: string; text: string; owner: ModuleName | null }

async function sources(): Promise<SourceFile[]> {
  const found: SourceFile[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        await visit(full)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const relative = path.relative(srcDir, full).split(path.sep).join('/')
        const match = /^modules\/([a-z]+)\//.exec(relative)
        found.push({ file: full, relative, text: await readFile(full, 'utf8'), owner: match ? (match[1] as ModuleName) : null })
      }
    }
  }
  await visit(srcDir)
  return found
}

const isTest = (file: SourceFile) => file.relative.includes('/__tests__/')

function imports(text: string): string[] {
  return [...text.matchAll(/(?:from|import)\s*\(?\s*['"](@\/[^'"]+)['"]/g)].map((match) => match[1])
}

function moduleImport(specifier: string): { module: ModuleName; subpath: string } | null {
  const match = /^@\/modules\/([a-z]+)(?:\/(.*))?$/.exec(specifier)
  return match ? { module: match[1] as ModuleName, subpath: match[2] ?? '' } : null
}

const isBrowserFile = (file: SourceFile) =>
  /^\s*['"]use client['"]/.test(file.text) || file.relative.includes('/ui/') || file.relative.startsWith('components/')

describe('module boundaries', () => {
  it('finds the module sources it is meant to guard', async () => {
    const files = await sources()
    for (const name of ['finance', 'crm', 'inventory', 'ai', 'org', 'procurement'] as const) {
      expect(files.some((file) => file.owner === name && !isTest(file)), name).toBe(true)
    }
  })

  it('lets code outside a module use only its index.ts, client.ts or ui screens', async () => {
    const violations: string[] = []
    for (const file of await sources()) {
      if (isTest(file)) continue
      for (const specifier of imports(file.text)) {
        const target = moduleImport(specifier)
        if (!target || target.module === file.owner) continue
        const allowed = target.subpath === '' || target.subpath === 'client' || target.subpath.startsWith('ui/')
        if (!allowed) violations.push(`${file.relative} imports ${specifier}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('keeps server entry points out of browser code', async () => {
    const violations: string[] = []
    for (const file of await sources()) {
      if (isTest(file) || !isBrowserFile(file)) continue
      if (/['"]node:crypto['"]/.test(file.text)) violations.push(`${file.relative} imports node:crypto`)
      for (const specifier of imports(file.text)) {
        const target = moduleImport(specifier)
        if (target && target.subpath === '') violations.push(`${file.relative} imports the server entry ${specifier}`)
        if (/^@\/lib\/(db|auth\/context|supabase\/server|env|iam\/tokens)$/.test(specifier)) violations.push(`${file.relative} imports server-only ${specifier}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('keeps every module free of imports from the app and component layers', async () => {
    const violations: string[] = []
    for (const file of await sources()) {
      if (isTest(file) || !file.owner || file.relative.includes('/ui/')) continue
      for (const specifier of imports(file.text)) {
        if (specifier.startsWith('@/app/') || specifier.startsWith('@/components/')) violations.push(`${file.relative} imports ${specifier}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('has no module that queries another module\'s tables', async () => {
    const violations: string[] = []
    for (const file of await sources()) {
      if (isTest(file) || !file.owner) continue
      const code = file.text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      const sqlStrings = [...code.matchAll(/`([^`]*)`/g)].map((match) => match[1]).filter((text) => /\b(select|insert|update|delete)\b/i.test(text))
      for (const [name, tables] of Object.entries(ownedTables) as [ModuleName, string[]][]) {
        if (name === file.owner) continue
        for (const table of tables) {
          const pattern = new RegExp(`\\b(from|join|into|update)\\s+${table}\\b`, 'i')
          if (sqlStrings.some((sql) => pattern.test(sql))) violations.push(`${file.relative} (${file.owner}) touches ${table} (${name})`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('never writes stock balances from code (the trigger owns them)', async () => {
    const violations: string[] = []
    for (const file of await sources()) {
      if (isTest(file)) continue
      const code = file.text.replace(/\/\/[^\n]*/g, '')
      if (/\b(insert\s+into|update|delete\s+from)\s+stock_balances\b/i.test(code)) violations.push(file.relative)
      if (/\bupdate\s+items\s+set[^`]*current_stock/i.test(code)) violations.push(`${file.relative} writes items.current_stock`)
      if (/\b(update|delete\s+from)\s+(stock_movements|payments|audit_log)\b/i.test(code)) violations.push(`${file.relative} edits an append-only table`)
    }
    expect(violations).toEqual([])
  })

  it('does not use console, any, or ts-ignore in production code', async () => {
    const violations: string[] = []
    for (const file of await sources()) {
      if (isTest(file) || file.relative === 'lib/logger.ts') continue
      if (/\bconsole\.(log|debug|info)\b/.test(file.text)) violations.push(`${file.relative}: console`)
      if (/:\s*any\b|\bas any\b|<any>/.test(file.text)) violations.push(`${file.relative}: any`)
      if (/@ts-(ignore|nocheck)/.test(file.text)) violations.push(`${file.relative}: ts-ignore`)
    }
    expect(violations).toEqual([])
  })
})
