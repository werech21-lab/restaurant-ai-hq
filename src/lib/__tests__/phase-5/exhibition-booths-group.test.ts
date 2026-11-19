/**
 * Exhibition booths count in company totals as their own group «بوثات المعارض» (owner decision
 * 2026-11-18). Real data only: register ids/locations from pos-registry.json and the live
 * 2026-11-17 payload; no hand-written figures.
 */
import { describe, expect, it } from 'vitest'
import registry from '@/lib/odoo/pos-registry.json'
import {
  EXHIBITION_BRANCH_ID,
  companyPosConfigAllowed,
  companyPosRegisterIds,
  exhibitionRegisterIds,
  restaurantRegisterIds,
  schoolCanteenRegisterIds,
} from '@/lib/odoo/company-pos'
import { resolveRestaurantBranchForConfig } from '@/lib/odoo-live-connector'
import {
  DEFAULT_GLOBAL_FILTERS,
  GLOBAL_BRANCH_OPTIONS,
  computeGlobalWorkspace,
  isExhibitionGroupReported,
} from '@/lib/aether/global-filter-engine'
import { detectTargetBranchFromQuestion } from '@/lib/feryal-intent'
import { normalizeSharesTo100, sumShares } from '@/lib/aether/share-normalization'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const REG = registry as {
  allowedPosConfigIds: number[]
  registers: Record<string, { location: string }>
  locations: Record<string, { en: string; ar: string; unit: string }>
}
const registryBoothIds = REG.allowedPosConfigIds.filter((id) => REG.locations[REG.registers[String(id)].location]?.unit === 'exhibition')
const boothLabel = REG.locations.exhibitions

describe('booths are included in company registers', () => {
  it('every allowed exhibition register (e.g. 26–33, 37, 38) is a company register in its own group', () => {
    expect(registryBoothIds.length).toBeGreaterThan(0)
    expect(exhibitionRegisterIds()).toEqual(registryBoothIds)
    for (const id of registryBoothIds) {
      expect(companyPosRegisterIds()).toContain(id)
      expect(restaurantRegisterIds()).not.toContain(id)
      expect(schoolCanteenRegisterIds()).not.toContain(id)
      expect(companyPosConfigAllowed(id, boothLabel.en)).toBe(true)
      expect(resolveRestaurantBranchForConfig(id, boothLabel.en)).toBe(EXHIBITION_BRANCH_ID)
    }
    expect(boothLabel).toMatchObject({ en: 'Exhibition Booths', ar: 'بوثات المعارض', unit: 'exhibition' })
  })

  it('school canteens 41/42/43 stay included', () => {
    for (const id of [41, 42, 43]) expect(companyPosRegisterIds()).toContain(id)
  })
})

describe('exclusions are unchanged', () => {
  it('includes active Delivery (Qurain) 24, keeps archived 36 out of the active list, and keeps Jahra out', () => {
    expect(REG.allowedPosConfigIds).toContain(24)
    expect(REG.allowedPosConfigIds).not.toContain(36)
    expect(companyPosConfigAllowed(24, 'Delivery (Qurain)')).toBe(true)
    expect(companyPosConfigAllowed(36, 'Delivery (Qurain Temp)', false)).toBe(true)
    expect(companyPosConfigAllowed(16, 'E-Mall (promenade)', false)).toBe(false)
    expect(companyPosConfigAllowed(35, 'Delivery (Ardiya Temp)', false)).toBe(false)
    for (const id of [25, 39, 40]) {
      expect(REG.allowedPosConfigIds).not.toContain(id)
      expect(companyPosRegisterIds()).not.toContain(id)
    }
  })

  it('a booth id stays allowed whatever its name says, and an inactive copy stays out', () => {
    const booth = registryBoothIds[0]
    for (const name of ['Qurain booth', 'Qurain WH POS', 'Delivery (Qurain)', 'Jahra exhibition', 'Exhibition test']) {
      expect(companyPosConfigAllowed(booth, name)).toBe(true)
    }
    expect(companyPosConfigAllowed(booth, boothLabel.en, false)).toBe(false)
  })

  it('a register outside the whitelist named "exhibition" is not admitted', () => {
    const outside = Math.max(...REG.allowedPosConfigIds) + 1
    expect(companyPosConfigAllowed(outside, 'Exhibition booth')).toBe(false)
  })
})

describe('booths as a group in filters, Feryal and totals', () => {
  it('the filter options carry the «بوثات المعارض» / "Exhibition Booths" group', () => {
    expect(GLOBAL_BRANCH_OPTIONS.find((o) => o.id === 'exhibitions')).toMatchObject({ ar: 'بوثات المعارض', en: 'Exhibition Booths' })
  })

  it.each(['كم مبيعات البوثات امس؟', 'كم مبيعات المعارض هالشهر؟', 'مبيعات بوثات المعارض اليوم'])(
    'Feryal understands «%s» as the exhibition booths group',
    (q) => {
      expect(detectTargetBranchFromQuestion(q).branchId).toBe('exhibitions')
    },
  )

  it('real payload: branch rows sum to the company total, unattributed is 0, shares total 100.0%; booths are not shown as 0.000 when the payload does not report them', () => {
    const summary = loadLiveTodaySummary()
    const bucket = summary.buckets!.today!
    expect(isExhibitionGroupReported(bucket)).toBe(false) // payload predates booth counting
    const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'today' }, summary)
    const branches = ws.cascadingOptions.branches.filter((b) => b.id !== 'all')
    expect(branches.some((b) => b.id === 'exhibitions')).toBe(false)
    const locs = bucket.byLocation as Record<string, { netKwd: number }>
    const sumFils = Object.values(locs).reduce((s, l) => s + Math.round(l.netKwd * 1000), 0)
    expect(sumFils).toBe(Math.round((bucket.totals.netSalesKwd as number) * 1000))
    expect(bucket.unattributedSalesKwd ?? 0).toBe(0)
    expect(sumShares(normalizeSharesTo100(branches.map((b) => b.salesKwd ?? 0)))).toBe(100)
  })

  it('when a payload reports a booth group, it appears as its own branch option', () => {
    const summary = loadLiveTodaySummary()
    const bucket = summary.buckets!.today!
    const locs = bucket.byLocation as Record<string, unknown>
    // Move the real Ardiya entry under the booth key: same real numbers, so totals are unchanged.
    locs.exhibitions = locs.ardiya
    delete locs.ardiya
    expect(isExhibitionGroupReported(bucket)).toBe(true)
    const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'today' }, summary)
    expect(ws.cascadingOptions.branches.some((b) => b.id === 'exhibitions')).toBe(true)
  })
})
