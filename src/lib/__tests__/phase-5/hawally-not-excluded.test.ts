/**
 * There is no closed Hawally restaurant (owner, 2026-11-18). Hawally names are accepted; only the
 * explicit pos.config ids 24 (decommissioned), 25 / 39 (Jahra) and 40 (inactive) are excluded by id,
 * and the Jahra name rule stays. Real registry + live 2026-11-17 payload only.
 */
import { describe, expect, it } from 'vitest'
import { companyPosConfigAllowed, companyPosRegisterIds } from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity, isExcludedRecordId } from '@/lib/odoo/excluded-entities'
import { resolveRestaurantBranchForConfig } from '@/lib/odoo-live-connector'
import { DEFAULT_GLOBAL_FILTERS, computeGlobalWorkspace } from '@/lib/aether/global-filter-engine'
import { normalizeSharesTo100, sumShares } from '@/lib/aether/share-normalization'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

describe('Hawally is an active district, not an exclusion', () => {
  it('Promenade shop names containing Hawally are accepted (configs 8–11)', () => {
    for (const id of [8, 9, 10, 11]) {
      expect(companyPosConfigAllowed(id, 'E-Mall Promenade Hawally')).toBe(true)
      expect(resolveRestaurantBranchForConfig(id, 'E-Mall Promenade Hawally')).toBe('promenade')
    }
    for (const name of ['Promenade Hawally', 'Hawally', 'حولي', 'بروميناد حولي']) {
      expect(isExcludedOdooEntity(name)).toBe(false)
    }
  })

  it('the NPIS Hawally school canteen (41) is accepted', () => {
    expect(companyPosConfigAllowed(41, 'NPIS Hawally')).toBe(true)
    expect(resolveRestaurantBranchForConfig(41, 'NPIS Hawally')).toBe('school-canteens')
  })

  it('explicit id exclusions: 25, 39, 40; Delivery (Qurain) 24 stays in', () => {
    expect(isExcludedRecordId('pos_config', 24)).toBe(false)
    expect(companyPosConfigAllowed(24, 'Delivery (Qurain)')).toBe(true)
    for (const id of [25, 39, 40]) {
      expect(isExcludedRecordId('pos_config', id)).toBe(true)
      expect(companyPosConfigAllowed(id, 'any name')).toBe(false)
      expect(companyPosRegisterIds()).not.toContain(id)
    }
  })

  it('a Jahra name does not remove an allowlisted register id', () => {
    for (const name of ['Delivery (Jahra)', 'Tasty Snacks(Jahra)', 'الجهراء']) {
      expect(isExcludedOdooEntity(name)).toBe(true)
    }
    expect(companyPosConfigAllowed(8, 'Promenade Jahra')).toBe(true)
    expect(resolveRestaurantBranchForConfig(8, 'Promenade Jahra')).toBe('promenade')
  })

  it('real payload: branch rows sum to the total, unattributed is 0, Scorecard shares total 100.0%', () => {
    const summary = loadLiveTodaySummary()
    const bucket = summary.buckets!.today!
    const locs = bucket.byLocation as Record<string, { netKwd: number }>
    const sum = Object.values(locs).reduce((s, l) => s + Math.round(l.netKwd * 1000), 0)
    expect(sum).toBe(Math.round((bucket.totals.netSalesKwd as number) * 1000))
    expect(bucket.unattributedSalesKwd ?? 0).toBe(0)
    const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'today' }, summary)
    const branches = ws.cascadingOptions.branches.filter((b) => b.id !== 'all')
    expect(sumShares(normalizeSharesTo100(branches.map((b) => b.salesKwd ?? 0)))).toBe(100)
  })
})
