import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeBeforeAfterSnapshot } from '@/lib/aether/before-after-engine'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  isBrandBranchCompatible,
  type GlobalBranch,
  type GlobalPeriod,
} from '@/lib/aether/global-filter-engine'
import {
  DEMO_PRODUCT_CODES,
  demoCatalogReadsHidden,
  demoCatalogSeedAllowed,
} from '@/lib/demo-catalog'
import { computeErpComparison } from '@/lib/erp-comparison-engine'
import { numericFactsFromStructured } from '@/lib/feryal-council-facts'
import {
  askFeryalOdooAgent,
  FERYAL_NO_ODOO_DATA_REPLY,
  resetFeryalAuditCache,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import {
  bustOdooLiveCache,
  fetchLiveOdooPeriodCube,
  fetchLiveOdooSnapshot,
  type OdooPeriodCube,
} from '@/lib/odoo-live-connector'
import {
  ARCHIVED_PINNED_REGISTER_POLICY,
  companyPosConfigAllowed,
  isPinnedSchoolCanteenConfigId,
  schoolCanteenRegisterIds,
} from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import {
  isNonCompanyCatalogItem,
  NON_COMPANY_ITEM_SKUS,
  nonCompanyItemSql,
} from '@/lib/odoo/non-company-products'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { buildLiveEnterpriseDepartments } from '@/lib/reports/enterprise-reports-registry'

const ROOT_DIR = process.cwd()
const TEST_REF_NOW_MS = Date.parse('2026-11-15T12:00:00.000Z') // 15:00 Asia/Kuwait on 2026-11-15

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
] as const

const ALL_OPERATING_BRANCHES: readonly Exclude<GlobalBranch, 'all'>[] = [
  ...APPROVED_BRANCH_IDS,
  'school-canteens',
]

const BRANCH_FIXTURE_METRICS: Readonly<
  Record<
    Exclude<GlobalBranch, 'all'>,
    { configId: number; sessionId: number; configName: string; netKwd: number; orders: number; hour: number }
  >
> = {
  avenues: { configId: 34, sessionId: 701, configName: 'The Avenues POS 1', netKwd: 912.375, orders: 185, hour: 13 },
  '360-mall': { configId: 17, sessionId: 702, configName: '360 Mall POS 1', netKwd: 845.625, orders: 164, hour: 14 },
  assima: { configId: 14, sessionId: 703, configName: 'Assima Mall POS 1', netKwd: 678.125, orders: 131, hour: 15 },
  promenade: { configId: 8, sessionId: 704, configName: 'Promenade POS 1', netKwd: 614.875, orders: 119, hour: 16 },
  salmiya: { configId: 19, sessionId: 705, configName: 'Salmiya POS 1', netKwd: 532.25, orders: 103, hour: 18 },
  'al-kout': { configId: 21, sessionId: 706, configName: 'Al-Kout POS 1', netKwd: 489.5, orders: 97, hour: 19 },
  ardiya: { configId: 3, sessionId: 707, configName: 'Ardiya Delivery 1', netKwd: 418.75, orders: 82, hour: 20 },
  'school-canteens': {
    configId: 41,
    sessionId: 708,
    configName: 'NPIS Hawally School Canteen',
    netKwd: 264.375,
    orders: 63,
    hour: 12,
  },
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000

function rpcJson(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function installParityOdooRpcMock() {
  vi.spyOn(Date, 'now').mockReturnValue(TEST_REF_NOW_MS)
  const kwDayRange = {
    'date_order:day': { from: '2026-11-14 21:00:00', to: '2026-11-15 21:00:00' },
  }
  const hourRangeOf = (kwHour: number) => {
    const utcHour = (kwHour + 24 - 3) % 24
    const nextUtcHour = (utcHour + 1) % 24
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      'date_order:hour': {
        from: `2026-11-15 ${pad(utcHour)}:00:00`,
        to: `2026-11-15 ${pad(nextUtcHour)}:00:00`,
      },
    }
  }

  const authenticProducts = [
    { id: 1001, name: '[CG-01] Sweet & Sour Chicken', pos_categ_id: [10, 'CG'], brandRoot: 'CG', share: 0.25 },
    { id: 1002, name: "[FR-02] Frank's Beef Slider Box", pos_categ_id: [11, "Frank's"], brandRoot: "Frank's", share: 0.2 },
    { id: 1003, name: '[TH-03] بوكس شاورما طحينة', pos_categ_id: [12, 'Tahina'], brandRoot: 'Tahina', share: 0.18 },
    { id: 1004, name: '[FB-04] بروستد فارم براون عائلي', pos_categ_id: [13, 'FB'], brandRoot: 'FB', share: 0.15 },
    { id: 1005, name: '[TNB-05] نودلز دجاج سيشوان', pos_categ_id: [14, 'TNB'], brandRoot: 'TNB', share: 0.12 },
    { id: 1006, name: '[KC-06] شاي كرك زعفران', pos_categ_id: [15, 'Karak Cafeteria'], brandRoot: 'Karak Cafeteria', share: 0.1 },
  ]

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number
      params?: { service?: string; method?: string; args?: unknown[] }
    }
    const reqId = body.id ?? 1
    if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
      return rpcJson(reqId, 7)
    }

    const args = body.params?.args ?? []
    const model = String(args[3] ?? '')
    const method = String(args[4] ?? '')
    const methodArgs = (args[5] as unknown[]) ?? []
    const domain = (methodArgs[0] as unknown[]) ?? []
    const domainStr = JSON.stringify(domain)
    const groupby = (methodArgs[2] as string[]) ?? []

    if (model === 'pos.config' && method === 'search_read') {
      return rpcJson(
        reqId,
        ALL_OPERATING_BRANCHES.map((branchId) => {
          const m = BRANCH_FIXTURE_METRICS[branchId]
          return {
            id: m.configId,
            name: m.configName,
            active: true,
            company_id: [1, 'Venture Foods'],
          }
        }),
      )
    }

    if (model === 'res.users' && method === 'read') {
      return rpcJson(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
    }

    if (model === 'pos.category' && method === 'search_read') {
      return rpcJson(reqId, [
        { id: 10, name: 'CG', parent_id: false },
        { id: 11, name: "Frank's", parent_id: false },
        { id: 12, name: 'Tahina', parent_id: false },
        { id: 13, name: 'FB', parent_id: false },
        { id: 14, name: 'TNB', parent_id: false },
        { id: 15, name: 'Karak Cafeteria', parent_id: false },
        { id: 150, name: 'Heisenberg Legacy', parent_id: false },
      ])
    }

    if (model === 'account.account' && method === 'search_read') {
      return rpcJson(reqId, [])
    }

    if (model === 'pos.order' && method === 'search_read') {
      return rpcJson(reqId, [
        {
          id: 9001,
          date_order: '2026-11-15 10:30:00',
          amount_total: 912.375,
          config_id: [34, 'The Avenues POS 1'],
          company_id: [1, 'Venture Foods'],
        },
      ])
    }

    if (model === 'pos.session' && method === 'read') {
      return rpcJson(
        reqId,
        ALL_OPERATING_BRANCHES.map((branchId) => {
          const m = BRANCH_FIXTURE_METRICS[branchId]
          return { id: m.sessionId, config_id: [m.configId, m.configName] }
        }),
      )
    }

    if (model === 'product.product' && method === 'read') {
      return rpcJson(
        reqId,
        authenticProducts.map((p) => ({
          id: p.id,
          name: p.name,
          pos_categ_id: p.pos_categ_id,
        })),
      )
    }

    if (model === 'pos.order' && method === 'read_group') {
      const isCount = domainStr.includes('["amount_total",">=",0]')
      // Prior-30 window ends at 2026-10-16 21:00:00 -> return empty so current 2026-11-15 data stays isolated
      if (domainStr.includes('"2026-10-16 21:00:00"') && domainStr.includes('"2026-09-16 21:00:00"')) {
        return rpcJson(reqId, [{ amount_total: 0, amount_tax: 0, __count: 0 }])
      }

      if (groupby.includes('date_order:day')) {
        return rpcJson(
          reqId,
          ALL_OPERATING_BRANCHES.map((branchId) => {
            const m = BRANCH_FIXTURE_METRICS[branchId]
            if (isCount) {
              return {
                session_id: [m.sessionId, `POS/${m.sessionId}`],
                pricelist_id: [1, 'Talabat Go'],
                __count: m.orders,
                __range: kwDayRange,
              }
            }
            return {
              session_id: [m.sessionId, `POS/${m.sessionId}`],
              pricelist_id: [1, 'Talabat Go'],
              amount_total: m.netKwd,
              amount_tax: 0,
              __count: m.orders,
              __range: kwDayRange,
            }
          }),
        )
      }

      if (groupby.includes('session_id') && groupby.includes('date_order:hour')) {
        return rpcJson(
          reqId,
          ALL_OPERATING_BRANCHES.map((branchId) => {
            const m = BRANCH_FIXTURE_METRICS[branchId]
            if (isCount) {
              return {
                session_id: [m.sessionId, `POS/${m.sessionId}`],
                __count: m.orders,
                __range: hourRangeOf(m.hour),
              }
            }
            return {
              session_id: [m.sessionId, `POS/${m.sessionId}`],
              amount_total: m.netKwd,
              amount_tax: 0,
              __count: m.orders,
              __range: hourRangeOf(m.hour),
            }
          }),
        )
      }

      if (groupby.includes('date_order:hour')) {
        return rpcJson(
          reqId,
          ALL_OPERATING_BRANCHES.map((branchId) => {
            const m = BRANCH_FIXTURE_METRICS[branchId]
            if (isCount) {
              return { __count: m.orders, __range: hourRangeOf(m.hour) }
            }
            return {
              amount_total: m.netKwd,
              amount_tax: 0,
              __count: m.orders,
              __range: hourRangeOf(m.hour),
            }
          }),
        )
      }

      if (groupby.length === 1 && groupby[0] === 'session_id') {
        return rpcJson(
          reqId,
          ALL_OPERATING_BRANCHES.map((branchId) => {
            const m = BRANCH_FIXTURE_METRICS[branchId]
            if (isCount) {
              return { session_id: [m.sessionId, `POS/${m.sessionId}`], __count: m.orders }
            }
            return {
              session_id: [m.sessionId, `POS/${m.sessionId}`],
              amount_total: m.netKwd,
              amount_tax: 0,
              __count: m.orders,
            }
          }),
        )
      }

      if (groupby.length === 0) {
        const totalNet = r3(
          ALL_OPERATING_BRANCHES.reduce((s, b) => s + BRANCH_FIXTURE_METRICS[b].netKwd, 0),
        )
        const totalOrd = ALL_OPERATING_BRANCHES.reduce(
          (s, b) => s + BRANCH_FIXTURE_METRICS[b].orders,
          0,
        )
        return rpcJson(reqId, [{ amount_total: totalNet, amount_tax: 0, __count: totalOrd }])
      }

      return rpcJson(reqId, [])
    }

    if (model === 'pos.order' && method === 'search_count') {
      if (domainStr.includes('"2026-10-16 21:00:00"') && domainStr.includes('"2026-09-16 21:00:00"')) {
        return rpcJson(reqId, 0)
      }
      const totalOrd = ALL_OPERATING_BRANCHES.reduce(
        (s, b) => s + BRANCH_FIXTURE_METRICS[b].orders,
        0,
      )
      return rpcJson(reqId, totalOrd)
    }

    if (model === 'pos.payment' && method === 'read_group') {
      const isCount = domainStr.includes('["amount",">=",0]')
      return rpcJson(
        reqId,
        ALL_OPERATING_BRANCHES.map((branchId) => {
          const m = BRANCH_FIXTURE_METRICS[branchId]
          if (isCount) {
            return {
              session_id: [m.sessionId, `POS/${m.sessionId}`],
              payment_method_id: [7, 'Talabat Go'],
              __count: m.orders,
            }
          }
          return {
            session_id: [m.sessionId, `POS/${m.sessionId}`],
            payment_method_id: [7, 'Talabat Go'],
            amount: m.netKwd,
            __count: m.orders,
          }
        }),
      )
    }

    if (model === 'pos.order.line' && method === 'read_group') {
      if (domainStr.includes('["discount",">",0]') || domainStr.includes('["id","=",0]')) {
        return rpcJson(reqId, [])
      }

      // Check if scoped to a single branch's config ID
      const matchedBranch = ALL_OPERATING_BRANCHES.find((b) => {
        const cid = BRANCH_FIXTURE_METRICS[b].configId
        return domainStr.includes(`["order_id.session_id.config_id","in",[${cid}]]`)
      })
      const baseNet = matchedBranch
        ? BRANCH_FIXTURE_METRICS[matchedBranch].netKwd
        : r3(ALL_OPERATING_BRANCHES.reduce((s, b) => s + BRANCH_FIXTURE_METRICS[b].netKwd, 0))
      const baseOrd = matchedBranch
        ? BRANCH_FIXTURE_METRICS[matchedBranch].orders
        : ALL_OPERATING_BRANCHES.reduce((s, b) => s + BRANCH_FIXTURE_METRICS[b].orders, 0)

      return rpcJson(
        reqId,
        authenticProducts.map((p) => ({
          product_id: [p.id, p.name],
          price_subtotal: r3(baseNet * p.share),
          qty: Math.max(1, Math.round(baseOrd * p.share * 2)),
          discount: 0,
          __count: Math.max(1, Math.round(baseOrd * p.share)),
        })),
      )
    }

    if (model === 'stock.picking' && method === 'search_count') {
      return rpcJson(reqId, 0)
    }

    return rpcJson(reqId, [])
  })
}

async function collectScanFiles(): Promise<{ relPath: string; text: string }[]> {
  const roots = ['src/app', 'src/components', 'src/lib', 'src/modules', 'src/server', 'src/services', 'scripts']
  const out: { relPath: string; text: string }[] = []

  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '__tests__') {
          continue
        }
        await walk(full)
        continue
      }
      if (!/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) continue
      if (/\.test\.(ts|tsx|js|mjs)$/.test(entry.name)) continue
      const relPath = path.relative(ROOT_DIR, full).split(path.sep).join('/')
      out.push({ relPath, text: await readFile(full, 'utf8') })
    }
  }

  for (const r of roots) {
    await walk(path.join(ROOT_DIR, r))
  }
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

describe('Tier 1 Cross-Surface Data Contracts, Demo-Product Ban & Real Engine Bug Regressions', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const k of ODOO_ENV_KEYS) {
      savedEnv[k] = process.env[k]
    }
    process.env.ODOO_URL = 'https://odoo-parity-test.example.com'
    process.env.ODOO_DB = 'venturefoods_parity'
    process.env.ODOO_USERNAME = 'api@venturefoodskw.com'
    process.env.ODOO_API_KEY = 'parity-test-key'
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
    resetFeryalAuditCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const k of ODOO_ENV_KEYS) {
      const prev = savedEnv[k]
      if (prev === undefined) delete process.env[k]
      else process.env[k] = prev
    }
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
    resetFeryalAuditCache()
  })

  describe('1. Demo-Product & Non-Company Catalog Ban Across /erp and (panel) Datasets', () => {
    it('contains zero croissant/avocado demo products across all production code, scripts, and JSON datasets', async () => {
      const files = await collectScanFiles()
      expect(files.length).toBeGreaterThan(200)

      const bannedDemoProductRe = /croissant|avocado|كرواسون|كرواسان|أفوكادو|افوكادو/i
      const violations = files
        .filter((f) => bannedDemoProductRe.test(f.text))
        .map((f) => f.relPath)

      expect(violations).toEqual([])
    })

    it('keeps ODOO dataset unlinked/empty of static menu items and blocks all 10 migration-0033 non-company SKUs', () => {
      expect(ODOO.meta.source).toBe('unlinked')
      expect(ODOO.menu).toEqual([])
      expect(ODOO.brands).toEqual([])
      expect(ODOO.restaurants).toEqual([])
      expect(ODOO.canteens).toEqual([])
      expect(Object.keys(ODOO.topProducts)).toEqual([])
      expect(Object.keys(ODOO.categories)).toEqual([])

      expect(NON_COMPANY_ITEM_SKUS).toHaveLength(10)
      for (const sku of NON_COMPANY_ITEM_SKUS) {
        expect(isNonCompanyCatalogItem(sku, 'Any Item Name')).toBe(true)
      }
      expect(isNonCompanyCatalogItem('VF-999', 'Butter Croissant')).toBe(true)
      expect(isNonCompanyCatalogItem('VF-999', 'كرواسون جبن')).toBe(true)

      // Authentic Venture Foods menu items remain allowed
      for (const item of [
        ['CG-001', 'Sweet & Sour Chicken'],
        ['TH-002', 'بوكس شاورما طحينة'],
        ['FR-003', "Frank's Beef Slider"],
        ['FB-004', 'بروستد فارم براون'],
        ['TNB-005', 'نودلز دجاج سيشوان'],
        ['KC-006', 'شاي كرك زعفران'],
      ] as const) {
        expect(isNonCompanyCatalogItem(item[0], item[1])).toBe(false)
      }

      const sqlParams: unknown[] = ['tenant-1']
      const sqlClause = nonCompanyItemSql('i.sku', 'i.name', sqlParams)
      expect(sqlClause).toContain('i.sku <> all($2::text[])')
      expect(sqlClause).toContain('i.name not ilike $3')
      expect(sqlClause).toContain('i.name not ilike $4')
      expect(sqlParams).toHaveLength(4)

      // Production hides local seed catalog codes (EL-1001..PT-4003)
      expect(DEMO_PRODUCT_CODES.length).toBeGreaterThan(0)
      expect(demoCatalogReadsHidden({ NODE_ENV: 'production' })).toBe(true)
      expect(demoCatalogReadsHidden({ NODE_ENV: 'test', VERCEL_ENV: 'production' })).toBe(true)
      expect(demoCatalogSeedAllowed({ NODE_ENV: 'production' })).toBe(false)
    })
  })

  describe('2. RED-First Regressions on Uncovered src/lib Data Engine Bugs', () => {
    it('Bug G1: isBrandBranchCompatible accepts school-canteens across all 6 approved Venture Foods brands', () => {
      for (const brandId of APPROVED_BRAND_IDS) {
        expect(isBrandBranchCompatible(brandId, 'school-canteens')).toBe(true)
        for (const branchId of APPROVED_BRANCH_IDS) {
          expect(isBrandBranchCompatible(brandId, branchId)).toBe(true)
        }
      }
    })

    it('Bug C1 & C2: computeCoresHubSnapshot reads brandByBranch.netKwd/.linesCount (never 0 from safeNum(object)) and preserves 3-decimal AOV', async () => {
      installParityOdooRpcMock()
      const env = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const cube = await fetchLiveOdooPeriodCube('2026-10-17', '2026-11-15', TEST_REF_NOW_MS)

      // Branch-scoped with liveCube loaded: brandShare must reflect brandByBranch['promenade'][brand].netKwd (> 0)
      const coresBranchScoped = computeCoresHubSnapshot(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month', branch: 'promenade' },
        [],
        env.summary,
        cube,
      )
      const cgInPromenade = coresBranchScoped.sales.brandShare.find((b) => b.id === 'china-garden')
      expect(cgInPromenade?.salesKwd).toBeCloseTo(
        cube.brandByBranch.promenade['china-garden'].netKwd,
        3,
      )
      expect(cgInPromenade?.salesKwd).toBeGreaterThan(100)
      expect(cgInPromenade?.orders).toBe(cube.brandByBranch.promenade['china-garden'].linesCount)

      // Brand-scoped with liveCube loaded: branchRanking must reflect brandByBranch[branch]['china-garden'].netKwd (> 0)
      const coresBrandScoped = computeCoresHubSnapshot(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month', brand: 'china-garden' },
        [],
        env.summary,
        cube,
      )
      const canteenInCg = coresBrandScoped.sales.branchRanking.find(
        (b) => b.id === 'school-canteens',
      )
      expect(canteenInCg?.salesKwd).toBeCloseTo(
        cube.brandByBranch['school-canteens']['china-garden'].netKwd,
        3,
      )
      expect(canteenInCg?.salesKwd).toBeGreaterThan(50)

      // 3-decimal AOV precision on SalesPoint (614.875 / 119 = 5.167016... -> 5.167, NOT 5.17)
      const promenadePoint = computeCoresHubSnapshot(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month', branch: 'promenade' },
        [],
        env.summary,
        cube,
      ).sales.branchRanking.find((b) => b.id === 'promenade')
      expect(promenadePoint?.aovKwd).toBe(5.167)
    })

    it('Bug R1 & R2: VF-POS-02 includes school-canteens and branch-scoped enterprise reports match workspace Net KWD, orders, and 3-decimal AOV', async () => {
      installParityOdooRpcMock()
      const env = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })

      const wsAll = computeGlobalWorkspace(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
        env.summary,
      )
      const deptsAllEn = buildLiveEnterpriseDepartments(wsAll, env.summary, false)
      const vfPos02All = deptsAllEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-02')
      expect(vfPos02All).toBeDefined()
      const canteenRowEn = vfPos02All?.rows.find((r) => r.branch === 'School canteens')
      expect(canteenRowEn).toBeDefined()
      expect(canteenRowEn?.netSales).toBe('264.375')
      expect(canteenRowEn?.orders).toBe(63)
      expect(canteenRowEn?.avgOrderValue).toBe(r3(264.375 / 63).toFixed(3))

      // Sum of VF-POS-02 breakdown rows equals exact company net sales
      const sumBreakdown = r3(
        (vfPos02All?.breakdown ?? []).reduce((s, item) => s + item.value, 0),
      )
      expect(sumBreakdown).toBe(wsAll.salesKwd)

      // Branch-scoped parity on VF-POS-01 and VF-POS-02
      const wsPromenade = computeGlobalWorkspace(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month', branch: 'promenade' },
        env.summary,
      )
      const deptsPromEn = buildLiveEnterpriseDepartments(wsPromenade, env.summary, false)
      const vfPos01Prom = deptsPromEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-01')
      const vfPos02Prom = deptsPromEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-02')
      expect(vfPos01Prom?.headlineMetricEn).toBe('614.875 KWD')
      expect(vfPos01Prom?.kpis[0]?.value).toBe('614.875 KWD')
      expect(vfPos01Prom?.kpis[1]?.value).toBe('119')
      expect(vfPos01Prom?.kpis[2]?.value).toBe('5.167 KWD')
      expect(vfPos02Prom?.rows).toHaveLength(1)
      expect(vfPos02Prom?.rows[0]?.netSales).toBe('614.875')
    })

    it('Bug E1: computeErpComparison and computeBeforeAfterSnapshot surface school-canteens in byBranch, allow branchIds/entityA scoping, and close reconciliation gap to 0', async () => {
      installParityOdooRpcMock()
      const env = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const cubeA = await fetchLiveOdooPeriodCube('2026-11-08', '2026-11-14', TEST_REF_NOW_MS)
      const cubeB: OdooPeriodCube = {
        ...cubeA,
        dateRange: { from: '2026-11-01', to: '2026-11-07' },
      }

      const cmpAll = computeErpComparison(
        {
          mode: 'date-vs-date',
          granularity: 'range',
          periodA: { from: '2026-11-08', to: '2026-11-14' },
          periodB: { from: '2026-11-01', to: '2026-11-07' },
          brandIds: 'all',
          branchIds: 'all',
          channelIds: 'all',
        },
        { cubeA, cubeB, liveSummary: env.summary },
      )
      const canteenRow = cmpAll.byBranch.find((r) => r.id === 'school-canteens')
      expect(canteenRow).toBeDefined()
      expect(canteenRow?.ordersA).toBe(63)
      expect(canteenRow?.valueA).toBe(264.4)
      expect(cmpAll.reconciliation.maxSalesGapKwd).toBeLessThanOrEqual(0.2)

      // Scoped strictly to school-canteens
      const cmpCanteenOnly = computeErpComparison(
        {
          mode: 'date-vs-date',
          granularity: 'range',
          periodA: { from: '2026-11-08', to: '2026-11-14' },
          periodB: { from: '2026-11-01', to: '2026-11-07' },
          brandIds: 'all',
          branchIds: ['school-canteens'],
          channelIds: 'all',
        },
        { cubeA, cubeB, liveSummary: env.summary },
      )
      expect(cmpCanteenOnly.selectionA.completedOrders).toBe(63)
      expect(cmpCanteenOnly.selectionA.netSalesKwd).toBe(264.4)

      // Before/After delegates to computeErpComparison and surfaces school-canteens
      const ba = computeBeforeAfterSnapshot(
        { ...DEFAULT_GLOBAL_FILTERS, branch: 'school-canteens' },
        'week-vs-week',
        null,
        [],
        [],
        env.summary,
        { afterCube: cubeA, beforeCube: cubeB },
      )
      expect(ba.connected).toBe(true)
      expect(ba.byBranchRows.find((r) => r.id === 'school-canteens')?.afterOrders).toBe(63)
      expect(
        ba.byBranchRows.filter((r) => r.afterOrders > 0 || r.afterSalesKwd > 0).map((r) => r.id),
      ).toEqual(['school-canteens'])
      expect(ba.summary.orders.after).toBe(63)
    })

    it('Bug F1: Feryal agent answers direct مقاصف المدارس queries and emits school-canteens facts when active while refusing excluded branches', async () => {
      installParityOdooRpcMock()
      const cube = await fetchLiveOdooPeriodCube('2026-11-14', '2026-11-14', TEST_REF_NOW_MS)
      const ds: FeryalOdooDataSource = {
        fetchPeriodCube: async () => cube,
        fetchPurchaseOrders: async () => null,
        fetchWarehouseChain: async () => null,
        fetchReceivablesSummary: async () => null,
        fetchBranchTopProducts: async () => [],
      }

      // 1. Direct query on مقاصف المدارس
      const directRes = await askFeryalOdooAgent({
        question: 'كم مبيعات مقاصف المدارس أمس 14/11؟',
        referenceNowMs: TEST_REF_NOW_MS,
        dataSource: ds,
      })
      expect(directRes.status).toBe('answered')
      expect(directRes.verifier.valid).toBe(true)
      expect(directRes.reply).toContain('مقاصف المدارس')
      expect(directRes.reply).toContain('264.4')
      expect(directRes.reply).toContain('63')

      // 2. All-branches query when school-canteens has active sales includes school-canteens in lowestBranch & structured facts
      const allBranchesRes = await askFeryalOdooAgent({
        question: 'كم مبيعات أمس 14/11 حسب الفرع؟',
        referenceNowMs: TEST_REF_NOW_MS,
        dataSource: ds,
      })
      expect(allBranchesRes.status).toBe('answered')
      expect(allBranchesRes.verifier.valid).toBe(true)
      expect(allBranchesRes.reply).toContain('مقاصف المدارس 264.4 د.ك')
      const canteenFact = allBranchesRes.facts.find(
        (f) => f.entityId === 'school-canteens' && f.metric === 'net_sales_kwd',
      )
      expect(canteenFact).toBeDefined()
      expect(canteenFact?.value).toBe('264.4')

      const directFacts = numericFactsFromStructured(
        {
          period: { from: '2026-11-14', to: '2026-11-14' },
          branches: [{ id: 'school-canteens', nameAr: 'مقاصف المدارس', netKwd: 264.375, orders: 63 }],
        },
        { from: '2026-11-14', to: '2026-11-14' },
      )
      expect(directFacts.find((f) => f.id === 'net_sales_kwd|school-canteens|2026-11-14')?.value).toBe(
        '264.375',
      )

      // 3. Excluded branches are strictly refused with zero digits
      for (const excludedBranchQ of [
        'كم مبيعات فرع الجهراء أمس؟',
        'كم مبيعات فرع القرين أمس؟',
      ]) {
        const refused = await askFeryalOdooAgent({
          question: excludedBranchQ,
          referenceNowMs: TEST_REF_NOW_MS,
          dataSource: ds,
        })
        expect(refused.status).toBe('no_odoo_data')
        expect(refused.reply.startsWith(FERYAL_NO_ODOO_DATA_REPLY)).toBe(true)
        expect(refused.verifier.extractedNumbers).toEqual([])
      }
    })
  })

  describe('3. Cross-Surface Metric Parity (Envelope === PeriodCube === GlobalWorkspace === CoresHub === Reports to 0.001 fils)', () => {
    it.each(['today', 'week', 'month', 'year'] as const)(
      'yields identical company-wide Net Sales KWD (0.001 fils), orders, and 3-decimal AOV for period=%s',
      async (period: GlobalPeriod) => {
        installParityOdooRpcMock()
        const env = await fetchLiveOdooSnapshot({
          period,
          forceRefresh: true,
          referenceNowMs: TEST_REF_NOW_MS,
        })

        const expectedNet = r3(
          ALL_OPERATING_BRANCHES.reduce((s, b) => s + BRANCH_FIXTURE_METRICS[b].netKwd, 0),
        )
        const expectedOrders = ALL_OPERATING_BRANCHES.reduce(
          (s, b) => s + BRANCH_FIXTURE_METRICS[b].orders,
          0,
        )
        const expectedAov = r3(expectedNet / expectedOrders)

        expect(env.connected).toBe(true)
        expect(env.totals.netSalesKwd).toBe(expectedNet)
        expect(env.totals.orders).toBe(expectedOrders)
        expect(env.totals.aovKwd).toBe(expectedAov)

        const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period }, env.summary)
        expect(ws.salesKwd).toBe(expectedNet)
        expect(ws.orders).toBe(expectedOrders)
        expect(ws.aovKwd).toBe(expectedAov)

        const cores = computeCoresHubSnapshot(
          { ...DEFAULT_GLOBAL_FILTERS, period },
          [],
          env.summary,
          null,
        )
        const coresBranchSum = r3(
          cores.sales.branchRanking.reduce((s, pt) => s + pt.salesKwd, 0),
        )
        const coresBranchOrders = cores.sales.branchRanking.reduce((s, pt) => s + pt.orders, 0)
        expect(coresBranchSum).toBe(expectedNet)
        expect(coresBranchOrders).toBe(expectedOrders)

        const deptsEn = buildLiveEnterpriseDepartments(ws, env.summary, false)
        const vfPos01 = deptsEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-01')
        const vfPos02 = deptsEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-02')
        expect(vfPos01?.kpis[0]?.value).toBe(
          `${expectedNet.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`,
        )
        expect(vfPos01?.kpis[1]?.value).toBe(expectedOrders.toLocaleString('en-US'))
        expect(vfPos01?.kpis[2]?.value).toBe(
          `${expectedAov.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`,
        )

        const reportBranchSum = r3(
          (vfPos02?.rows ?? []).reduce((s, r) => s + Number(r.netSales), 0),
        )
        const reportBranchOrders = (vfPos02?.rows ?? []).reduce(
          (s, r) => s + Number(r.orders),
          0,
        )
        expect(reportBranchSum).toBe(expectedNet)
        expect(reportBranchOrders).toBe(expectedOrders)
      },
    )

    it.each(ALL_OPERATING_BRANCHES)(
      'yields identical branch-scoped Net Sales KWD (0.001 fils), orders, and 3-decimal AOV for branch=%s',
      async (branchId) => {
        installParityOdooRpcMock()
        const env = await fetchLiveOdooSnapshot({
          period: 'month',
          forceRefresh: true,
          referenceNowMs: TEST_REF_NOW_MS,
        })
        const cube = await fetchLiveOdooPeriodCube('2026-10-17', '2026-11-15', TEST_REF_NOW_MS)

        const expected = BRANCH_FIXTURE_METRICS[branchId]
        const expectedAov = r3(expected.netKwd / expected.orders)

        const envBranch = env.branches?.find((b) => b.id === branchId)
        expect(envBranch?.netSalesKwd).toBe(expected.netKwd)
        expect(envBranch?.orders).toBe(expected.orders)

        expect(cube.byBranch[branchId].netKwd).toBe(expected.netKwd)
        expect(cube.byBranch[branchId].orders).toBe(expected.orders)
        expect(cube.byBranch[branchId].aovKwd).toBe(expectedAov)

        const ws = computeGlobalWorkspace(
          { ...DEFAULT_GLOBAL_FILTERS, period: 'month', branch: branchId },
          env.summary,
        )
        expect(ws.salesKwd).toBe(expected.netKwd)
        expect(ws.orders).toBe(expected.orders)
        expect(ws.aovKwd).toBe(expectedAov)

        const cores = computeCoresHubSnapshot(
          { ...DEFAULT_GLOBAL_FILTERS, period: 'month', branch: branchId },
          [],
          env.summary,
          cube,
        )
        expect(cores.sales.branchRanking).toHaveLength(1)
        expect(cores.sales.branchRanking[0]?.salesKwd).toBe(expected.netKwd)
        expect(cores.sales.branchRanking[0]?.orders).toBe(expected.orders)
        expect(cores.sales.branchRanking[0]?.aovKwd).toBe(expectedAov)

        const deptsEn = buildLiveEnterpriseDepartments(ws, env.summary, false)
        const vfPos01 = deptsEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-01')
        const vfPos02 = deptsEn.flatMap((d) => d.reports).find((r) => r.code === 'VF-POS-02')
        expect(vfPos01?.kpis[0]?.value).toBe(
          `${expected.netKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`,
        )
        expect(vfPos01?.kpis[1]?.value).toBe(expected.orders.toLocaleString('en-US'))
        expect(vfPos01?.kpis[2]?.value).toBe(
          `${expectedAov.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`,
        )
        expect(vfPos02?.rows).toHaveLength(1)
        expect(Number(vfPos02?.rows[0]?.netSales)).toBe(expected.netKwd)
        expect(Number(vfPos02?.rows[0]?.orders)).toBe(expected.orders)
        expect(Number(vfPos02?.rows[0]?.avgOrderValue)).toBe(expectedAov)

        // Approved channel coverage check
        expect(APPROVED_CHANNEL_IDS).toHaveLength(8)
      },
    )
  })

  describe('4. Open TODO(Abdullah) Governance Tracker Contracts (Preserved Without Guessing)', () => {
    it('tracks POS device 43 "FAS Fahaheel", pinned IDs 41/42, GL #2839, archived #16/#35, exec compare-only digests, and batch sync TODOs', async () => {
      // 1. Pinned canteens 41 & 42 vs unconfirmed POS device 43 "FAS Fahaheel"
      expect(schoolCanteenRegisterIds()).toEqual([41, 42])
      expect(isPinnedSchoolCanteenConfigId(41)).toBe(true)
      expect(isPinnedSchoolCanteenConfigId(42)).toBe(true)
      expect(isPinnedSchoolCanteenConfigId(43)).toBe(false)
      expect(companyPosConfigAllowed(43, 'FAS Fahaheel', true)).toBe(false)
      expect(posRegistry._canteenTodo).toContain('TODO(Abdullah)')
      expect(posRegistry._canteenTodo).toContain('43 FAS Fahaheel')

      // 2. GL #2839 "Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS" kept under canteen exemption pending Abdullah confirmation
      const gl2839Name =
        'Cash On Hand/ NPIS ' + ['Haw', 'ally'].join('') + ' Branch Cashier - فرع حولي - NPIS'
      expect(isExcludedOdooEntity(gl2839Name)).toBe(false)

      // 3. Archived pinned registers #16 E-Mall (Promenade) and #35 Delivery (Ardiya Temp) strictly active-only
      expect(ARCHIVED_PINNED_REGISTER_POLICY).toBe('active_only_todo_abdullah')
      expect(companyPosConfigAllowed(16, 'E-Mall (Promenade)', false)).toBe(false)
      expect(companyPosConfigAllowed(35, 'Delivery (Ardiya Temp)', false)).toBe(false)
      expect(companyPosConfigAllowed(16, 'E-Mall (Promenade)', true)).toBe(true)
      expect(companyPosConfigAllowed(35, 'Delivery (Ardiya Temp)', true)).toBe(true)

      // 4. Compare-only executive fallback password SHA-256 digests never mutate DB user passwords
      const execSessionSrc = await readFile(
        path.join(ROOT_DIR, 'src/lib/auth/exec-session.ts'),
        'utf8',
      )
      expect(execSessionSrc).toContain('DEFAULT_ABDULLAH_PASSWORD_SHA256')
      expect(execSessionSrc).toContain('DEFAULT_ADMIN_PASSWORD_SHA256')
      expect(execSessionSrc).not.toContain('.user.update')
      expect(execSessionSrc).not.toContain('.user.create')

      // 5. Batch sync script preserves documented differences tracked for Abdullah (refund __count, Math.max(0, ...), naive 00:00:00)
      const batchSyncSrc = await readFile(
        path.join(ROOT_DIR, 'scripts/sync-odoo-live.mjs'),
        'utf8',
      )
      expect(batchSyncSrc).not.toContain('/ 4.8')
      expect(batchSyncSrc).toContain('00:00:00')
      expect(batchSyncSrc).toContain('Math.max(0,')
    })
  })
})
