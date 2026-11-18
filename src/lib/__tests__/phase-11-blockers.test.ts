import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { claimResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import { assembleBriefReport, parseStoredBrief, reviewModelText } from '@/server/ai/consensus'
import type { BriefFact } from '@/server/ai/brief-types'
import { comparisonMatchesFacts, type ComparableFact } from '@/server/ai/structured-claim'
import {
  companyPosConfigAllowed,
  companyPosRegisterIds,
  companyPosSearchDomain,
  posOrderCount,
  posOrderNet,
  restaurantRegisterIds,
  schoolCanteenRegisterIds,
} from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { describePosOrderQuery } from '@/lib/odoo/pos-order-query'
import { resolveRestaurantBranchForConfig } from '@/lib/odoo-live-connector'
import { VF_TEAM } from '@/lib/venture-foods-team'

const closedBranch = ['haw', 'ally'].join('')
const npisCanteen = `NPIS ${closedBranch}`

function fact(id: string, value: string, unit: BriefFact['unit'] = 'KWD'): BriefFact {
  const [metric, scope, period] = id.split('|')
  return { id, metric, period, scope, value, unit }
}

function comparable(
  input: Partial<ComparableFact> & Pick<ComparableFact, 'id' | 'entityId' | 'value'>,
): ComparableFact {
  return {
    metric: 'net_sales_kwd',
    period: '2026-11-15',
    date: '2026-11-15',
    unit: 'KWD',
    entityType: 'branch',
    entityName: input.entityId,
    ...input,
  }
}

describe('phase 11 blocker 1: feryal best/worst ranking against all active branches', () => {
  it('rejects "Salmiya 400 is best" citing only Salmiya and Kout while Avenues has 1000, and rejects self-only citations', () => {
    const salmiya = comparable({ id: 'net_sales_kwd|salmiya|2026-11-15', entityId: 'salmiya', value: '400' })
    const kout = comparable({ id: 'net_sales_kwd|al-kout|2026-11-15', entityId: 'al-kout', value: '300' })
    const avenues = comparable({ id: 'net_sales_kwd|avenues|2026-11-15', entityId: 'avenues', value: '1000' })
    const allFacts = [salmiya, kout, avenues]

    // Uncited Avenues (1000) beats Salmiya (400) -> MUST be rejected
    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'salmiya',
          relation: 'best',
          object_id: null,
          metric: 'net_sales_kwd',
          cited_fact_ids: [salmiya.id, kout.id],
        },
        allFacts,
      ),
    ).toBe(false)

    // Uncited Kout (300) is lower than Salmiya (400) -> "Salmiya is worst" MUST be rejected
    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'salmiya',
          relation: 'worst',
          object_id: null,
          metric: 'net_sales_kwd',
          cited_fact_ids: [salmiya.id, avenues.id],
        },
        allFacts,
      ),
    ).toBe(false)

    // Citing only itself -> MUST be rejected even when Avenues actually has the highest figure
    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'avenues',
          relation: 'best',
          object_id: null,
          metric: 'net_sales_kwd',
          cited_fact_ids: [avenues.id],
        },
        allFacts,
      ),
    ).toBe(false)

    // True best citing at least one peer while beating every branch in allFacts -> accepted
    expect(
      comparisonMatchesFacts(
        {
          subject_id: 'avenues',
          relation: 'best',
          object_id: null,
          metric: 'net_sales_kwd',
          cited_fact_ids: [avenues.id, salmiya.id],
        },
        allFacts,
      ),
    ).toBe(true)
  })
})

describe('phase 11 blocker 2: contradictory recommendations across any metric', () => {
  it('adopts neither side and marks disagreed when models propose Close Avenues (sales) vs Expand Avenues (orders)', () => {
    const sales = fact('net_sales_kwd|avenues|2026-11-15', '1000', 'KWD')
    const orders = fact('orders|avenues|2026-11-15', '50', 'orders')
    const closeSales = claimResponse({
      recommendations: [
        structuredClaim([sales], { action: 'close', targetType: 'branch', targetName: 'avenues' }),
      ],
    })
    const expandOrders = claimResponse({
      recommendations: [
        structuredClaim([orders], { action: 'expand', targetType: 'branch', targetName: 'avenues' }),
      ],
    })

    // Two models: Close Avenues (sales) vs Expand Avenues (orders)
    const twoModels = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales, orders],
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'claude', text: closeSales, facts: [sales, orders] }),
        reviewModelText({ provider: 'google', modelId: 'gemini', text: expandOrders, facts: [sales, orders] }),
      ],
    })
    expect(twoModels.recommendations).toEqual([])
    expect(twoModels.disputed).toHaveLength(1)

    // Three models: 2 agree on Close Avenues (sales), 1 says Expand Avenues (orders) -> neither adopted
    const threeModels = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales, orders],
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'claude', text: closeSales, facts: [sales, orders] }),
        reviewModelText({ provider: 'google', modelId: 'gemini', text: closeSales, facts: [sales, orders] }),
        reviewModelText({ provider: 'xai', modelId: 'grok', text: expandOrders, facts: [sales, orders] }),
      ],
    })
    expect(threeModels.recommendations).toEqual([])
    expect(threeModels.disputed).toHaveLength(1)

    // Cut vs Increase on the same target across different metrics -> neither adopted
    const cutSales = claimResponse({
      recommendations: [
        structuredClaim([sales], { action: 'cut', targetType: 'branch', targetName: 'avenues' }),
      ],
    })
    const increaseOrders = claimResponse({
      recommendations: [
        structuredClaim([orders], { action: 'increase', targetType: 'branch', targetName: 'avenues' }),
      ],
    })
    const cutVsIncrease = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [sales, orders],
      models: [
        reviewModelText({ provider: 'anthropic', modelId: 'claude', text: cutSales, facts: [sales, orders] }),
        reviewModelText({ provider: 'google', modelId: 'gemini', text: cutSales, facts: [sales, orders] }),
        reviewModelText({ provider: 'xai', modelId: 'grok', text: increaseOrders, facts: [sales, orders] }),
      ],
    })
    expect(cutVsIncrease.recommendations).toEqual([])
    expect(cutVsIncrease.disputed).toHaveLength(1)
  })
})

describe('phase 11 blocker 3 & should-fix 1 & should-fix 3: pinned canteen ids, exclusions, tooltip', () => {
  it('pins canteens by explicit POS config ids, excludes archived configs, Exhibition School Fair and Test canteen; Hawally names are accepted on whitelisted ids', () => {
    const pinnedCanteens = schoolCanteenRegisterIds()
    expect(pinnedCanteens.length).toBeGreaterThan(0)
    for (const id of pinnedCanteens) {
      expect(restaurantRegisterIds()).not.toContain(id)
      expect(companyPosRegisterIds()).toContain(id)
    }

    // Pinned active canteens stay included
    expect(companyPosConfigAllowed(pinnedCanteens[0]!, npisCanteen, true)).toBe(true)
    expect(companyPosConfigAllowed(pinnedCanteens[1] ?? pinnedCanteens[0]!, 'FAIPS Ahmadi', true)).toBe(true)
    expect(resolveRestaurantBranchForConfig(pinnedCanteens[0]!, npisCanteen)).toBe('school-canteens')

    // Archived configs are never included
    expect(companyPosConfigAllowed(pinnedCanteens[0]!, npisCanteen, false)).toBe(false)
    expect(companyPosConfigAllowed(3, 'Ardiya', false)).toBe(false)
    const searchDomain = companyPosSearchDomain(companyPosRegisterIds())
    expect(JSON.stringify(searchDomain)).not.toContain('[true,false]')
    expect(JSON.stringify(searchDomain)).not.toContain('ilike')
    expect(searchDomain).toContainEqual(['active', '=', true])

    // Unpinned school/canteen keywords are NOT included
    expect(companyPosConfigAllowed(999, 'Exhibition School Fair', true)).toBe(false)
    expect(companyPosConfigAllowed(998, 'Test canteen', true)).toBe(false)
    expect(companyPosConfigAllowed(997, 'NPIS Unpinned Register', true)).toBe(false)
    expect(companyPosConfigAllowed(996, 'مقصف مدرسة تجريبي', true)).toBe(false)
    expect(resolveRestaurantBranchForConfig(999, 'Exhibition School Fair')).toBeNull()
    expect(resolveRestaurantBranchForConfig(998, 'Test canteen')).toBeNull()

    // Owner decision 2026-11-18: no closed Hawally restaurant, so a Hawally name is not excluded;
    // Jahra names still lose on any id.
    const streetBranch = `${closedBranch[0]?.toUpperCase()}${closedBranch.slice(1)} School Street Branch`
    expect(isExcludedOdooEntity(streetBranch)).toBe(false)
    expect(companyPosConfigAllowed(3, streetBranch, true)).toBe(true)
    expect(companyPosConfigAllowed(3, 'Jahra School Street Branch', true)).toBe(false)
    expect(companyPosConfigAllowed(pinnedCanteens[0]!, streetBranch, true)).toBe(true)
    expect(resolveRestaurantBranchForConfig(pinnedCanteens[0]!, streetBranch)).toBe('school-canteens')
  })

  it('includes pinned canteen device ids in the tooltip query by default', () => {
    const query = describePosOrderQuery({
      fromKuwaitDate: '2026-11-16',
      toInclusiveKuwaitDate: '2026-11-16',
      companyId: 1,
      aggregate: 'read_group',
    })
    for (const id of schoolCanteenRegisterIds()) {
      expect(query).toContain(String(id))
    }
    for (const id of restaurantRegisterIds()) {
      expect(query).toContain(String(id))
    }
  })

  it('catches joined exclusion names without catching Shawali, Qurainy Dates, Hawally, or the canteens', () => {
    const haw2 = `${closedBranch[0]?.toUpperCase()}${closedBranch.slice(1)}2`
    expect(isExcludedOdooEntity('Jahra01')).toBe(true)
    expect(isExcludedOdooEntity(haw2)).toBe(false) // Hawally not excluded (owner decision 2026-11-18)
    expect(isExcludedOdooEntity('AlJahra')).toBe(true)
    expect(isExcludedOdooEntity('HeisenbergKW')).toBe(true)

    expect(isExcludedOdooEntity('Shawali')).toBe(false)
    expect(isExcludedOdooEntity('Qurainy Dates')).toBe(false)
    expect(isExcludedOdooEntity(npisCanteen)).toBe(false)
    expect(isExcludedOdooEntity('FAIPS Ahmadi')).toBe(false)
  })
})

describe('phase 11 should-fix 2: hide stored single-model free-text recommendations from old rows', () => {
  it('hides single-model and free-text recommendations, dropped items, and findings in parseStoredBrief', () => {
    const freeText = 'أغلق فرع السالمية فوراً وقلّص العمالة بنسبة 30%'
    const stored = parseStoredBrief(
      JSON.stringify({
        generatedAt: '2026-11-01T03:00:00.000Z',
        trigger: 'schedule',
        configuration: 'configured',
        missingKeys: [],
        odoo: 'linked',
        periods: { yesterday: '2026-10-31', prior: '2026-10-30' },
        sections: [],
        findings: [
          {
            factIds: ['f1'],
            citations: [{ metric: 'net_sales_kwd', period: '2026-10-31', scope: 'salmiya', value: '400', unit: 'KWD' }],
            notes: [{ provider: 'anthropic', modelId: 'claude', text: freeText }],
          },
        ],
        recommendations: [
          {
            factIds: ['f1'],
            citations: [{ metric: 'net_sales_kwd', period: '2026-10-31', scope: 'salmiya', value: '400', unit: 'KWD' }],
            supporters: [{ provider: 'anthropic', modelId: 'claude', solution: freeText }],
          },
        ],
        dropped: [
          {
            factIds: ['f1'],
            citations: [{ metric: 'net_sales_kwd', period: '2026-10-31', scope: 'salmiya', value: '400', unit: 'KWD' }],
            provider: 'anthropic',
            modelId: 'claude',
            solution: freeText,
          },
        ],
        disputed: [
          {
            factIds: ['f1'],
            citations: [],
            support: [{ provider: 'anthropic', modelId: 'claude', solution: freeText }],
            dispute: [],
          },
        ],
        unadoptedFindings: [
          {
            factIds: ['f1'],
            citations: [],
            provider: 'anthropic',
            modelId: 'claude',
            text: freeText,
          },
        ],
        models: [{ provider: 'anthropic', modelId: 'claude', status: 'ran', errorCode: null }],
      }),
    )

    expect(stored).not.toBeNull()
    expect(stored?.recommendations).toEqual([])
    expect(stored?.dropped).toEqual([])
    expect(stored?.disputed).toEqual([])
    expect(stored?.findings).toEqual([])
    expect(stored?.unadoptedFindings).toEqual([])
    expect(JSON.stringify(stored)).not.toContain(freeText)
  })
})

describe('phase 11 should-fix 4: refunds do not add +1 to order count', () => {
  it('keeps refund KWD negative while contributing 0 to the order count and excludes negative orders from search_count', () => {
    expect(posOrderNet(-12.5, 0)).toBe(-12.5)
    expect(posOrderCount(1, -12.5, 0)).toBe(0)
    expect(() => posOrderCount(3, -30, -1.5)).toThrow(RangeError)
    expect(posOrderCount(1, 100, 5)).toBe(1)

    const countQuery = describePosOrderQuery({
      fromKuwaitDate: '2026-11-16',
      toInclusiveKuwaitDate: '2026-11-16',
      companyId: 1,
      aggregate: 'search_count',
    })
    expect(countQuery).toContain('["amount_total",">=",0]')
  })
})

describe('phase 11 should-fix 6 & 7: /tmp test db cleanup and no default 123456 leadership password', () => {
  it('removes the /tmp vitest sqlite copy when a test process exits', () => {
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        `
        process.env.VITEST = 'true';
        process.env.NODE_ENV = 'test';
        const { prisma } = await import('./src/lib/db.ts');
        await prisma.role.count();
        console.log('CHILD_PID=' + process.pid);
        `,
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    expect(child.status).toBe(0)
    const match = /CHILD_PID=(\d+)/.exec(child.stdout)
    expect(match).not.toBeNull()
    const childDb = path.join('/tmp', `aetherbi-vitest-${match![1]}.db`)
    expect(existsSync(childDb)).toBe(false)
    expect(existsSync(`${childDb}-wal`)).toBe(false)
    expect(existsSync(`${childDb}-shm`)).toBe(false)
  })

  it('does not embed default password 123456 in leadership team definitions or provisioning scripts', () => {
    for (const member of VF_TEAM) {
      expect(member.password).toBeUndefined()
    }
    const ensureSrc = readFileSync('src/lib/ensure-venture-foods-team.ts', 'utf8')
    const syncSrc = readFileSync('scripts/sync-vf-users.ts', 'utf8')
    expect(ensureSrc).not.toContain("'123456'")
    expect(ensureSrc).not.toContain('"123456"')
    expect(syncSrc).not.toContain("'123456'")
    expect(syncSrc).not.toContain('"123456"')
  })
})
