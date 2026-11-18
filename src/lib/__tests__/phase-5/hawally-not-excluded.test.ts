/**
 * There is no closed Hawally restaurant (owner, 2026-11-18). Hawally names (both English "Hawally"
 * and Arabic «حولي») are accepted across POS registers, extra context / stock locations, and analytic
 * accounts; only explicit pos.config ids 24 (decommissioned), 25 / 39 (Jahra) and 40 (inactive) are
 * excluded by id, and the Jahra name rule stays. Real registry + live 2026-11-17 payload only.
 */
import { describe, expect, it } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  companyPosConfigAllowed,
  companyPosRegisterIds,
  SCHOOL_CANTEEN_BRANCH_ID,
} from '@/lib/odoo/company-pos'
import {
  appendOdooNameExclusion,
  isExcludedOdooEntity,
  isExcludedOdooRecord,
  isExcludedRecordId,
} from '@/lib/odoo/excluded-entities'
import {
  isDecommissionedWarehouseRecord,
  resolveRestaurantBranchForConfig,
  resolveStockLocationRole,
} from '@/lib/odoo-live-connector'
import { DEFAULT_GLOBAL_FILTERS, computeGlobalWorkspace } from '@/lib/aether/global-filter-engine'
import { normalizeSharesTo100, sumShares } from '@/lib/aether/share-normalization'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

describe('Hawally is an active district, not an exclusion (Phase 1.3 · C4)', () => {
  it('Promenade shop configs 8–11 are accepted with English "Hawally" and Arabic «حولي» in register names and stock context', () => {
    const promenadeHawallyLabels = [
      'E-Mall Promenade Hawally',
      'Promenade (Hawally)',
      'بروميناد حولي',
      'مجمع البروميناد - حولي',
    ]
    const extraContexts = [
      '',
      'Venture Foods PRM/POS Orders (Hawally)',
      'شركة فنتشر فودز مخزن حولي',
    ]
    for (const id of [8, 9, 10, 11]) {
      for (const label of promenadeHawallyLabels) {
        expect(companyPosConfigAllowed(id, label)).toBe(true)
        for (const extra of extraContexts) {
          expect(resolveRestaurantBranchForConfig(id, label, extra)).toBe('promenade')
        }
      }
    }
    for (const name of ['Promenade Hawally', 'Hawally', 'حولي', 'بروميناد حولي', 'شارع تونس حولي']) {
      expect(isExcludedOdooEntity(name)).toBe(false)
      expect(isDecommissionedWarehouseRecord(name)).toBe(false)
    }
  })

  it('NPIS Hawally school canteen (41) is accepted with English "Hawally" and Arabic «حولي»', () => {
    for (const label of [
      'NPIS Hawally',
      'NPIS School Canteen - Hawally',
      'مقصف مدرسة NPIS حولي',
      'مقصف حولي المدرسي',
    ]) {
      expect(companyPosConfigAllowed(41, label)).toBe(true)
      expect(resolveRestaurantBranchForConfig(41, label, 'Hawally Canteen Stock / حولي')).toBe(
        SCHOOL_CANTEEN_BRANCH_ID,
      )
    }
  })

  it('analytic accounts and Odoo search domains do not exclude Hawally / «حولي»', () => {
    const promenadeAnalyticId = posRegistry.locations.promenade.analyticId
    expect(posRegistry.excludedBranchAnalyticIds).not.toContain(promenadeAnalyticId)

    for (const analyticLabel of [
      'Promenade Mall - Hawally',
      'NPIS Hawally School Canteen',
      'مركز تكلفة بروميناد حولي',
      'مقصف مدرسة حولي',
    ]) {
      expect(
        isExcludedOdooRecord({ id: promenadeAnalyticId, name: analyticLabel, kind: 'analytic' }),
      ).toBe(false)
    }

    const domain: unknown[] = []
    appendOdooNameExclusion(domain, 'name')
    const serializedDomain = JSON.stringify(domain)
    expect(serializedDomain).not.toMatch(/hawally|hawalli|حولي|NPIS|FAIPS/i)
  })

  it('stock locations referencing Hawally / «حولي» map to promenade or school-canteens (never ck or excluded)', () => {
    for (const loc of [
      'PRM/Stock (Hawally)',
      'Promenade Hawally/Stock',
      'Hawally/Stock',
      'Hawally Restaurant/Stock',
      'مخزن بروميناد حولي',
      'حولي/المخزن',
    ]) {
      const role = resolveStockLocationRole(loc, 'internal')
      expect(role.excluded, loc).toBe(false)
      expect(role.role, loc).toBe('branch')
      expect(role.branchId, loc).toBe('promenade')
    }

    for (const canteenLoc of [
      'NPIS Hawally School Canteen/Stock',
      'مقصف مدرسة NPIS حولي/المخزن',
      'مقصف حولي/Stock',
    ]) {
      const role = resolveStockLocationRole(canteenLoc, 'internal')
      expect(role.excluded, canteenLoc).toBe(false)
      expect(role.role, canteenLoc).toBe('branch')
      expect(role.branchId, canteenLoc).toBe(SCHOOL_CANTEEN_BRANCH_ID)
    }
  })

  it('explicit id exclusions: 24, 25, 39, 40 remain strictly excluded', () => {
    for (const id of [24, 25, 39, 40]) {
      expect(isExcludedRecordId('pos_config', id)).toBe(true)
      expect(companyPosConfigAllowed(id, 'Promenade Hawally')).toBe(false)
      expect(companyPosConfigAllowed(id, 'مقصف حولي')).toBe(false)
      expect(resolveRestaurantBranchForConfig(id, 'Promenade Hawally')).toBeNull()
      expect(companyPosRegisterIds()).not.toContain(id)
    }
  })

  it('Jahra is still rejected by name across POS, analytic, and stock locations', () => {
    for (const name of ['Delivery (Jahra)', 'Tasty Snacks(Jahra)', 'الجهراء', 'بالجهراء', 'JHR/Stock']) {
      expect(isExcludedOdooEntity(name)).toBe(true)
      expect(isDecommissionedWarehouseRecord(name)).toBe(true)
    }
    expect(companyPosConfigAllowed(8, 'Promenade Jahra')).toBe(false)
    expect(companyPosConfigAllowed(41, 'NPIS Jahra')).toBe(false)
    expect(resolveStockLocationRole('Jahra Branch/Stock', 'internal').excluded).toBe(true)
    expect(resolveStockLocationRole('مخزن الجهراء', 'internal').excluded).toBe(true)
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
