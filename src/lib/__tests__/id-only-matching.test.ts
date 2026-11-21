/**
 * Registers, branches and accounts are classified by Odoo id or account code.
 * A display name must not decide inclusion, exclusion or classification.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { companyPosConfigAllowed, isQurainPosConfigId } from '@/lib/odoo/company-pos'
import { isExcludedRecordId } from '@/lib/odoo/excluded-entities'
import { buildPosOrderUtcDomain } from '@/lib/odoo/pos-order-query'
import { classifyPlatformExpenseAccount } from '@/lib/odoo/platform-expense-accounts'
import { isPosClearingRow, POS_CLEARING_ACCOUNT_ID } from '@/lib/odoo/receivable-domain'
import { isDecommissionedWarehouseRecord } from '@/lib/odoo-live-connector'

const ROOT = process.cwd()
const WATCHED = [
  'src/lib/odoo/company-pos.ts',
  'src/lib/odoo/platform-expense-accounts.ts',
  'src/lib/odoo/live-sync-core.ts',
  'src/lib/odoo/excluded-entities.ts',
  'src/lib/odoo-live-connector.ts',
]

function sourceWithoutDiagnostic(rel: string): string {
  const raw = readFileSync(path.join(ROOT, rel), 'utf8')
  return raw.replace(/\/\* id-match-diagnostic-start \*\/[\s\S]*?\/\* id-match-diagnostic-end \*\//g, '')
}

describe('id-only register and account matching', () => {
  it('does not classify a register or account from a name, substring, or ilike', () => {
    const forbidden = [
      /\['name',\s*'=?ilike'/,
      /accName\.includes\(/,
      /account receivable \(pos\)/i,
      /\|\|\s*\/(?:talabat|deliveroo|jahez|keeta|pos)\//,
    ]
    for (const rel of WATCHED) {
      const src = sourceWithoutDiagnostic(rel)
      for (const pattern of forbidden) {
        expect(src, `${rel} matched ${pattern}`).not.toMatch(pattern)
      }
    }
  })

  it('includes pos.config 24 by id even when archived, and keeps Jahra ids out', () => {
    expect(isQurainPosConfigId(24)).toBe(true)
    expect(isExcludedRecordId('pos_config', 24)).toBe(false)
    expect(companyPosConfigAllowed(24, 'Delivery (Qurain)', true)).toBe(true)
    expect(companyPosConfigAllowed(36, 'Delivery (Qurain Temp)', false)).toBe(true)
    expect(companyPosConfigAllowed(16, 'E-Mall (promenade)', false)).toBe(false)
    expect(companyPosConfigAllowed(35, 'Delivery (Ardiya Temp)', false)).toBe(false)
    expect(companyPosConfigAllowed(99, 'Delivery (Qurain)')).toBe(false)
    for (const id of [25, 39, 40]) {
      expect(isExcludedRecordId('pos_config', id)).toBe(true)
      expect(companyPosConfigAllowed(id, 'Jahra')).toBe(false)
    }
  })

  it('lets a Qurain register in another company into the POS domain without a stock picking', () => {
    const domain = buildPosOrderUtcDomain({
      fromUtc: '2026-01-01 00:00:00',
      toExclusiveUtc: '2026-11-20 00:00:00',
      companyId: 1,
      configIds: [8, 24],
    })
    expect(domain).not.toContain('|')
    expect(JSON.stringify(domain)).toContain('[8,24]')
    expect(JSON.stringify(domain)).not.toContain('stock.picking')
    expect(JSON.stringify(domain)).not.toContain('stock.move')
  })

  it('classifies warehouses and expense accounts by code, and POS clearing by account id', () => {
    const nonClearingAccountId = 777
    expect(isPosClearingRow({ accountId: POS_CLEARING_ACCOUNT_ID })).toBe(true)
    expect(isPosClearingRow({ accountId: nonClearingAccountId })).toBe(false)
    expect(isDecommissionedWarehouseRecord('9950473 Heisenberg')).toBe(true)
    expect(isDecommissionedWarehouseRecord('Heisenberg Kitchen')).toBe(false)
    expect(classifyPlatformExpenseAccount('40866', 'Carriage fee', 'expense')).toBe('platform_commission')
    expect(classifyPlatformExpenseAccount('1', 'Carriage commission talabat', 'expense')).toBe('other')
  })
})
