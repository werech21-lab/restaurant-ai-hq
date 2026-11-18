import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { demoCatalogReadsHidden, demoCatalogSeedAllowed } from '@/lib/demo-catalog'
import { isExcludedOdooEntity, stripExcludedOdooTree } from '@/lib/odoo/excluded-entities'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'
import { keepStoredPinHash, pinHashForSettingsSave } from '@/lib/governance-pin'
import { readTimeCompliance } from '@/services/hr-compliance.service'
import { prisma } from '@/lib/db'
import { releaseManualRunLock, tryAcquireManualRunLock } from '@/server/ai/persist'

const root = process.cwd()

function source(relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8')
}

describe('phase 6 exclusions', () => {
  it('Hawally names are no longer excluded (owner decision 2026-11-18); lookalikes stay accepted', () => {
    expect(isExcludedOdooEntity('حولي')).toBe(false)
    expect(isExcludedOdooEntity('فرع حولي')).toBe(false)
    expect(isExcludedOdooEntity('محولين كهرباء')).toBe(false)
    expect(isExcludedOdooEntity('حوليات')).toBe(false)
    expect(isExcludedOdooEntity('مول 360')).toBe(false)
  })

  it('matches the short codes as tokens and not as a prefix', () => {
    expect(isExcludedOdooEntity('QRN')).toBe(true)
    expect(isExcludedOdooEntity('register JHR')).toBe(true)
    expect(isExcludedOdooEntity('HWL')).toBe(false)
    expect(isExcludedOdooEntity('QRNO')).toBe(false)
    expect(isExcludedOdooEntity('JHRA extra')).toBe(false)
    expect(isExcludedOdooEntity('site JHR')).toBe(true)
  })

  it('strips an excluded branch key from a warehouse payload', () => {
    const stripped = stripExcludedOdooTree({
      products: [{ name: 'Noodles', skuCode: 'N1' }, { name: 'Jahra special', skuCode: 'H1' }],
      byBranchOnHand: { avenues: { qty: 1 }, jahra: { qty: 9 } },
    })
    expect(stripped.products.map((row) => row.skuCode)).toEqual(['N1'])
    expect((stripped.byBranchOnHand as Record<string, unknown>).jahra).toBeUndefined()
    expect(stripped.byBranchOnHand.avenues.qty).toBe(1)
  })
})

describe('phase 6 invented data', () => {
  it('removes the catering totals from the CRM hub', () => {
    const hub = source('src/components/crm/VentureCrmHub.tsx')
    expect(hub).not.toContain('38,900')
    expect(hub).not.toContain('96.8')
    expect(hub).not.toContain('كيبكو')
    expect(hub).toContain('لا توجد عقود كاترينج مرتبطة')
    expect(hub).toContain('liveChildren')
  })

  it('gates the seed catalog and hides it on production reads', () => {
    expect(source('prisma/seed.ts')).toContain('demoCatalogSeedAllowed')
    expect(demoCatalogSeedAllowed({ NODE_ENV: 'development' })).toBe(true)
    expect(demoCatalogSeedAllowed({ NODE_ENV: 'production' })).toBe(false)
    expect(demoCatalogReadsHidden({ NODE_ENV: 'test', VERCEL_ENV: 'production' })).toBe(true)
    expect(source('src/app/(panel)/sales/page.tsx')).toContain('visibleInvoiceWhere')
    expect(source('src/app/(panel)/reports/page.tsx')).toContain('visibleProductWhere')
    expect(source('src/app/(panel)/warehouses/page.tsx')).toContain('visibleProductWhere')
  })

  it('hides the non-company bakery skus and drops the unused screens', () => {
    expect(isNonCompanyCatalogItem('RIFDC013', 'Cheese roll')).toBe(true)
    expect(isNonCompanyCatalogItem('N1', 'Noodles')).toBe(false)
    expect(existsSync(path.join(root, 'src/components/HomeShell.tsx'))).toBe(false)
    expect(existsSync(path.join(root, 'src/lib/assistant.ts'))).toBe(false)
    expect(source('database/migrations/0048_deactivate_non_company_items.sql')).toContain('RIFDC013')
    expect(source('database/migrations/0048_deactivate_non_company_items.sql').toLowerCase()).not.toContain('delete from')
  })

  it('flags an expiry without a document as unknown and does not show the date', () => {
    const reading = readTimeCompliance(new Date('2026-12-01T00:00:00.000Z'), false, Date.parse('2026-11-16T00:00:00.000Z'))
    expect(reading).toEqual({ band: 'unknown', daysLeft: null, expiryDate: null })
    const sourced = readTimeCompliance(new Date('2026-12-01T00:00:00.000Z'), true, Date.parse('2026-11-16T00:00:00.000Z'))
    expect(sourced.band).not.toBe('unknown')
    expect(sourced.expiryDate).toBe('2026-12-01')
    expect(source('database/migrations/0049_flag_unsourced_hr_expiries.sql')).toContain('to_regclass')
  })
})

describe('phase 6 governance pin', () => {
  it('leaves the stored hash unchanged when settings are saved', () => {
    const stored = 'vfsha256_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    expect(pinHashForSettingsSave(stored)).toBe(stored)
    expect(keepStoredPinHash(stored, 'vfh1_fallback')).toBe(stored)
    const route = source('src/app/api/erp/governance/route.ts')
    expect(route).toContain('pinHashForSettingsSave(current.pinHash)')
    expect(route).not.toContain('nextPinHash = body.pinHash')
    const client = source('src/lib/governance-compliance.ts')
    const push = client.slice(
      client.indexOf('export async function pushGovernanceStoreToServer'),
      client.indexOf('export async function pushGovernancePatchToServer'),
    )
    expect(push).not.toContain('pinHash')
    expect(client).toContain("action: 'changePin'")
    expect(client).not.toContain('updatePinHash')
  })
})

describe('phase 6 manual run lock', () => {
  it('lets one holder start and refuses a second until release', async () => {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ai_manual_run_lock WHERE id = 'manual'`)
    } catch {
      // The table is created by the first acquire.
    }
    const first = await tryAcquireManualRunLock('holder-a')
    const second = await tryAcquireManualRunLock('holder-b')
    expect(first).toBe('acquired')
    expect(second).toBe('busy')
    await releaseManualRunLock('holder-a')
    const third = await tryAcquireManualRunLock('holder-c')
    expect(third).toBe('acquired')
    await releaseManualRunLock('holder-c')
  })
})

describe('phase 6 odoo read paths', () => {
  it('routes the listed readers through the central filter', () => {
    expect(source('src/lib/feryal-odoo-agent.ts')).toContain('withCentralExclusion')
    expect(source('src/lib/feryal-odoo-agent.ts')).not.toContain('branch_scope')
    expect(source('src/lib/odoo/live-sync-core.ts')).toContain('isExcludedOdooRecord')
    expect(source('src/app/api/odoo-sync/route.ts')).toContain('stripExcludedOdooTree')
    expect(source('src/modules/odoo/domain/rpc.ts')).toContain('isExcludedOdooEntity')
    expect(source('src/modules/odoo/domain/console.ts')).toContain('exclusionDomainFragments')
    expect(source('src/app/api/erp/warehouse-chain/route.ts')).toContain('stripExcludedOdooTree')
    expect(source('src/components/erp/WarehouseDailyChainStudio.tsx')).toContain('stripExcludedOdooTree')
  })
})
