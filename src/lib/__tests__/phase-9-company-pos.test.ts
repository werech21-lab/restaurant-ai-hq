import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveTopBranchCard } from '@/lib/aether/period-delta'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { formatKwdAmount } from '@/lib/format-kwd'
import {
  anchorKuwaitDay,
  companyPosConfigAllowed,
  isPinnedSchoolCanteenConfigId,
  posOrderNet,
  restaurantRegisterIds,
  schoolCanteenRegisterIds,
} from '@/lib/odoo/company-pos'
import {
  appendOdooNameExclusion,
  isExcludedOdooEntity,
} from '@/lib/odoo/excluded-entities'
import { describePosOrderQuery } from '@/lib/odoo/pos-order-query'
import { resolveRestaurantBranchForConfig } from '@/lib/odoo-live-connector'
import {
  clearAdminPosTerminalMappingMemoryForTests,
  getAdminPosTerminalBranch,
  hydrateAdminPosTerminalMappings,
  resetAdminPosTerminalMappingsForTests,
  sanitizePosTerminalDisplayName,
  setAdminPosTerminalMapping,
} from '@/lib/odoo-terminal-mappings'

const closedBranch = ['haw', 'ally'].join('')
const nipsCanteen = `NPIS ${closedBranch}`
const closedArabic = ['\u062d', '\u0648', '\u0644', '\u064a'].join('')

describe('phase 9 company POS', () => {
  it('keeps NPIS Hawally and FAIPS Ahmadi and excludes the closed branch and Jahra devices', () => {
    expect(isPinnedSchoolCanteenConfigId(41)).toBe(true)
    expect(isPinnedSchoolCanteenConfigId(42)).toBe(true)
    expect(isPinnedSchoolCanteenConfigId(99)).toBe(false)
    expect(isExcludedOdooEntity(nipsCanteen)).toBe(false)
    expect(isExcludedOdooEntity('FAIPS Ahmadi')).toBe(false)
    expect(isExcludedOdooEntity(closedBranch)).toBe(true)
    expect(isExcludedOdooEntity(closedArabic)).toBe(true)
    expect(isExcludedOdooEntity(`\u0628${closedArabic}`)).toBe(true)
    expect(isExcludedOdooEntity(`\u0643${closedArabic}`)).toBe(false)
    expect(isExcludedOdooEntity('Delivery (Jahra)')).toBe(true)
    expect(isExcludedOdooEntity('Tasty Snacks(Jahra)')).toBe(true)
    expect(isExcludedOdooEntity('NPIS Jahra')).toBe(true)
    expect(companyPosConfigAllowed(41, nipsCanteen)).toBe(true)
    expect(companyPosConfigAllowed(42, 'FAIPS Ahmadi')).toBe(true)
    expect(companyPosConfigAllowed(40, `${nipsCanteen} (Inactive)`, false)).toBe(false)
    expect(companyPosConfigAllowed(25, 'Delivery (Jahra)')).toBe(false)
    expect(companyPosConfigAllowed(39, 'Tasty Snacks(Jahra)')).toBe(false)
    expect(companyPosConfigAllowed(26, 'Exhibition booth')).toBe(false)
    expect(companyPosConfigAllowed(3, 'Ardiya')).toBe(true)
    expect(restaurantRegisterIds()).toContain(3)
    expect(restaurantRegisterIds()).not.toContain(26)
    expect(restaurantRegisterIds()).not.toContain(41)
    expect(schoolCanteenRegisterIds()).toContain(41)
    expect(schoolCanteenRegisterIds()).toContain(42)
  })

  it('maps school canteens to their own branch and leaves the closed branch and central kitchen unmapped', async () => {
    expect(resolveRestaurantBranchForConfig(41, nipsCanteen)).toBe('school-canteens')
    expect(resolveRestaurantBranchForConfig(42, 'FAIPS Ahmadi')).toBe('school-canteens')
    expect(resolveRestaurantBranchForConfig(25, 'Delivery (Jahra)')).toBeNull()
    expect(resolveRestaurantBranchForConfig(0, closedBranch)).toBeNull()
    expect(resolveRestaurantBranchForConfig(0, 'Central Kitchen')).toBeNull()
    expect(resolveRestaurantBranchForConfig(0, 'Ardiya Main')).toBe('ardiya')
    expect(resolveRestaurantBranchForConfig(26, 'Summer exhibition')).toBeNull()
    await setAdminPosTerminalMapping({
      terminalId: 41,
      branchId: 'salmiya',
      updatedBy: 'phase9',
    })
    expect(resolveRestaurantBranchForConfig(41, nipsCanteen)).toBe('school-canteens')
    await resetAdminPosTerminalMappingsForTests()
  })

  it('keeps a school canteen on the top-branch card and drops the closed branch', () => {
    const card = resolveTopBranchCard({
      period: 'today',
      branches: [
        { id: 'school-canteens', name: nipsCanteen, netSalesKwd: 12.5, orders: 4 },
        { id: closedBranch, name: closedBranch, netSalesKwd: 90, orders: 20 },
      ],
    })
    expect(card?.id).toBe('school-canteens')
    expect(card?.netSalesKwd).toBe(12.5)
    expect(
      resolveTopBranchCard({
        period: 'today',
        branches: [{ id: closedBranch, name: closedArabic, netSalesKwd: 90, orders: 3 }],
      }),
    ).toBeNull()
  })

  it('does not drop a school canteen with a blind name exclusion', () => {
    const domain: unknown[] = []
    appendOdooNameExclusion(domain, 'name')
    expect(domain.some((part) => part === '|')).toBe(true)
    expect(
      domain.some((part) => Array.isArray(part) && part[1] === 'ilike' && part[2] === 'NPIS'),
    ).toBe(true)
    expect(
      domain.some((part) => Array.isArray(part) && part[1] === 'ilike' && part[2] === 'school'),
    ).toBe(false)
  })

  it('keeps refunds signed, anchors today on the Kuwait date, and formats KWD to 3 decimals', () => {
    expect(posOrderNet(100, 5)).toBe(95)
    expect(posOrderNet(-12.5, 0)).toBe(-12.5)
    expect(posOrderNet(0, 0)).toBe(0)
    expect(anchorKuwaitDay('2026-11-16', '2026-11-15')).toBe('2026-11-16')
    expect(formatKwdAmount(35.05)).toBe('35.050')
    expect(formatKwdAmount(18.95)).toBe('18.950')
    expect(formatKwdAmount(200.05)).toBe('200.050')
  })

  it('builds the POS query from Kuwait UTC bounds, the company filter, and the config list', () => {
    const query = describePosOrderQuery({
      fromKuwaitDate: '2026-11-16',
      toInclusiveKuwaitDate: '2026-11-16',
      companyId: 1,
      configIds: [3, 41],
      aggregate: 'read_group',
    })
    expect(query).toContain('2026-11-15 21:00:00')
    expect(query).toContain('2026-11-16 21:00:00')
    expect(query).toContain('"<"')
    expect(query).not.toContain('<=')
    expect(query).toContain('"company_id","=",1')
    expect(query).toContain('session_id.config_id')
    expect(query).toContain('41')
  })

  it('stores an admin terminal mapping in the database across a cold cache', async () => {
    await resetAdminPosTerminalMappingsForTests()
    await setAdminPosTerminalMapping({
      terminalId: 19,
      branchId: 'avenues',
      updatedBy: 'phase9',
    })
    clearAdminPosTerminalMappingMemoryForTests()
    expect(getAdminPosTerminalBranch(19)).toBeNull()
    await hydrateAdminPosTerminalMappings({ required: true })
    expect(getAdminPosTerminalBranch(19)).toBe('avenues')
    await resetAdminPosTerminalMappingsForTests()
    expect(getAdminPosTerminalBranch(19)).toBeNull()
  })

  it('does not label a closed-branch device as a school canteen', () => {
    const hidden = sanitizePosTerminalDisplayName(8, `${closedBranch} POS`)
    expect(hidden).toBe('POS #8')
    expect(hidden).not.toContain('NPIS')
    const canteen = sanitizePosTerminalDisplayName(41, 'NPIS Canteen #41')
    expect(canteen).toContain('NPIS')
  })

  it('keeps the orders title, the tooltip, and the two POS paths on the shared rules', () => {
    const journey = readFileSync('src/components/aether/FullJourney360.tsx', 'utf8')
    expect(journey).toContain("T('Total Orders', 'إجمالي الطلبات')")
    expect(journey).not.toContain('Orders & Before Rent')
    expect(journey).not.toContain('الطلبات والباقي قبل الإيجار')
    const connector = readFileSync('src/lib/odoo-live-connector.ts', 'utf8')
    const core = readFileSync('src/lib/odoo/live-sync-core.ts', 'utf8')
    const mappings = readFileSync('src/lib/odoo-terminal-mappings.ts', 'utf8')
    expect(connector).toContain('companyPosConfigAllowed')
    expect(core).toContain('companyPosConfigAllowed')
    expect(connector).not.toMatch(/resolveUiChannelHint\([^)]*,\s*true\s*\)/)
    expect(mappings).not.toContain('tmpdir')
    const html = renderToStaticMarkup(
      createElement(KpiProvenanceBadge, {
        odooModel: 'pos.order',
        dateRange: { from: '2026-11-16', to: '2026-11-16' },
        lastSyncAt: null,
        kind: 'actual',
        queryOrFormula: 'pos.order.read_group',
        isAr: false,
      }),
    )
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('title=')
    expect(html).not.toContain('bottom-full')
    expect(html).toContain('pos.order')
  })
})
