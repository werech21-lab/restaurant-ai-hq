import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeBeforeAfterSnapshot } from '@/lib/aether/before-after-engine'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  GLOBAL_BRANCH_OPTIONS,
  isBrandBranchCompatible,
  type GlobalBranch,
} from '@/lib/aether/global-filter-engine'
import { computeErpComparison } from '@/lib/erp-comparison-engine'
import { numericFactsFromStructured } from '@/lib/feryal-council-facts'
import {
  askFeryalOdooAgent,
  resetFeryalAuditCache,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import {
  bustOdooLiveCache,
  fetchLiveOdooPeriodCube,
  fetchLiveOdooSnapshot,
  resolveRestaurantBranchForConfig,
  type OdooPeriodCube,
} from '@/lib/odoo-live-connector'
import { sanitizePosTerminalDisplayName } from '@/lib/odoo-terminal-mappings'
import {
  companyPosConfigAllowed,
  companyPosRegisterIds,
  companyPosSearchDomain,
  isPinnedSchoolCanteenConfigId,
  restaurantRegisterIds,
  SCHOOL_CANTEEN_BRANCH_ID,
  schoolCanteenRegisterIds,
} from '@/lib/odoo/company-pos'
import {
  appendOdooNameExclusion,
  isExcludedOdooEntity,
  isExcludedOdooRecord,
  isExcludedRecordId,
  isPeriodSaleProduct,
  rowsWithoutExcludedEntities,
  stripExcludedOdooTree,
  sumWithoutExcludedEntities,
} from '@/lib/odoo/excluded-entities'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { buildLiveEnterpriseDepartments } from '@/lib/reports/enterprise-reports-registry'
import { odooConsoleExtractor } from '@/modules/odoo/domain/console'
import { buildBriefFactPack } from '@/server/ai/facts'

const TEST_REF_NOW_MS = Date.parse('2026-11-15T12:00:00.000Z') // 15:00 Asia/Kuwait on 2026-11-15

const ODOO_ENV_KEYS = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_LOGIN',
  'ODOO_API_KEY',
] as const

const r3 = (v: number): number => Math.round(v * 1000) / 1000

// ---------------------------------------------------------------------------
// Dynamic Derivation of Active Branches & Registers from pos-registry.json
// ---------------------------------------------------------------------------
type RegistryLocationMeta = {
  en: string
  ar: string
  code: string
  unit: 'restaurant' | 'canteen' | 'exhibition'
}

const REGISTRY_LOCATIONS = posRegistry.locations as Record<string, RegistryLocationMeta>
const REGISTRY_REGISTERS = posRegistry.registers as Record<string, { location: string }>

const DYNAMIC_RESTAURANT_BRANCH_IDS = Object.entries(REGISTRY_LOCATIONS)
  .filter(([, meta]) => meta.unit === 'restaurant')
  .map(([id]) => id as Exclude<GlobalBranch, 'all'>)

const DYNAMIC_CANTEEN_BRANCH_IDS = Object.entries(REGISTRY_LOCATIONS)
  .filter(([, meta]) => meta.unit === 'canteen')
  .map(([id]) => id as Exclude<GlobalBranch, 'all'>)

const DYNAMIC_OPERATING_BRANCH_IDS: readonly Exclude<GlobalBranch, 'all'>[] = [
  ...DYNAMIC_RESTAURANT_BRANCH_IDS,
  ...DYNAMIC_CANTEEN_BRANCH_IDS,
]

function activeRegistersForLocation(locationId: string): number[] {
  return Object.entries(REGISTRY_REGISTERS)
    .filter(([, meta]) => meta.location === locationId)
    .map(([idStr]) => Number(idStr))
    .filter((n) => Number.isInteger(n) && n > 0)
}

// ---------------------------------------------------------------------------
// Odoo Polish-Notation Domain & Console Extractor Evaluators
// ---------------------------------------------------------------------------
function evalOdooLeaf(record: Record<string, string>, leaf: unknown): boolean {
  if (!Array.isArray(leaf) || leaf.length !== 3) {
    throw new Error(`Invalid Odoo domain leaf: ${JSON.stringify(leaf)}`)
  }
  const [field, op, rhs] = leaf as [string, string, string]
  const value = String(record[field] ?? '')
  if (op === 'ilike') {
    return value.toLowerCase().includes(String(rhs).toLowerCase())
  }
  if (op === '=ilike') {
    const escaped = String(rhs)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/%/g, '.*')
    return new RegExp(`^${escaped}$`, 'i').test(value)
  }
  throw new Error(`Unsupported Odoo operator: ${op}`)
}

function evalOdooDomain(domain: readonly unknown[], name: string): boolean {
  const record = { name }
  function evalExpr(idx: number): [boolean, number] {
    if (idx >= domain.length) {
      throw new Error(`Unexpected end of Odoo domain at index ${idx}`)
    }
    const tok = domain[idx]
    if (tok === '!') {
      const [val, next] = evalExpr(idx + 1)
      return [!val, next]
    }
    if (tok === '&' || tok === '|') {
      const [left, mid] = evalExpr(idx + 1)
      const [right, next] = evalExpr(mid)
      return [tok === '&' ? left && right : left || right, next]
    }
    return [evalOdooLeaf(record, tok), idx + 1]
  }

  let cursor = 0
  let result = true
  while (cursor < domain.length) {
    const [val, next] = evalExpr(cursor)
    result = result && val
    cursor = next
  }
  return result
}

function compileConsoleRowKept(): (row: Record<string, unknown>) => boolean {
  const script = odooConsoleExtractor()
  const start = script.indexOf('const excluded =')
  const end = script.indexOf('const company =')
  const body = `${script.slice(start, end)}\nreturn rowKept;`
  return new Function(body)() as (row: Record<string, unknown>) => boolean
}

const NAME_EXCLUSION_DOMAIN: unknown[] = (() => {
  const d: unknown[] = []
  appendOdooNameExclusion(d, 'name')
  return d
})()

const CONSOLE_ROW_KEPT = compileConsoleRowKept()

// ---------------------------------------------------------------------------
// Deterministic Multi-Day, Multi-Hour Mocked Odoo RPC Fixture Builder
// (Includes ALL 8 Active Branches, Canteens 41 & 42, AND Poisoned Excluded Entities)
// ---------------------------------------------------------------------------
interface BranchScheduleSpec {
  registers: { configId: number; sessionId: number; name: string; day1Net: number; day1Ord: number; day2Net: number; day2Ord: number; kwHour: number }[]
}

const BRANCH_SCHEDULES: Readonly<Record<Exclude<GlobalBranch, 'all'>, BranchScheduleSpec>> = {
  promenade: {
    registers: [
      { configId: 8, sessionId: 801, name: 'Promenade Main 1', day1Net: 312.125, day1Ord: 61, day2Net: 348.25, day2Ord: 68, kwHour: 12 },
    ],
  },
  '360-mall': {
    registers: [
      { configId: 17, sessionId: 802, name: '360 Mall Food Court 1', day1Net: 455.375, day1Ord: 89, day2Net: 492.5, day2Ord: 95, kwHour: 13 },
    ],
  },
  ardiya: {
    registers: [
      { configId: 3, sessionId: 803, name: 'Ardiya Central Delivery', day1Net: 268.625, day1Ord: 53, day2Net: 291.75, day2Ord: 58, kwHour: 14 },
    ],
  },
  assima: {
    registers: [
      { configId: 14, sessionId: 804, name: 'Assima Mall Register 1', day1Net: 334.875, day1Ord: 67, day2Net: 365.125, day2Ord: 73, kwHour: 15 },
    ],
  },
  salmiya: {
    registers: [
      { configId: 19, sessionId: 805, name: 'Salmiya High Street 1', day1Net: 289.25, day1Ord: 59, day2Net: 314.625, day2Ord: 64, kwHour: 18 },
    ],
  },
  'al-kout': {
    registers: [
      { configId: 21, sessionId: 806, name: 'Al-Kout Mall Register 1', day1Net: 241.5, day1Ord: 48, day2Net: 266.875, day2Ord: 53, kwHour: 19 },
    ],
  },
  avenues: {
    registers: [
      { configId: 34, sessionId: 807, name: 'The Avenues Phase 4', day1Net: 518.75, day1Ord: 102, day2Net: 564.375, day2Ord: 111, kwHour: 20 },
    ],
  },
  'school-canteens': {
    registers: [
      { configId: 41, sessionId: 841, name: 'NPIS Hawally School Canteen', day1Net: 92.125, day1Ord: 21, day2Net: 92.25, day2Ord: 21, kwHour: 11 },
      { configId: 42, sessionId: 842, name: 'FAIPS Ahmadi', day1Net: 68.125, day1Ord: 16, day2Net: 68.125, day2Ord: 17, kwHour: 10 },
      { configId: 43, sessionId: 843, name: 'FAS Fahaheel', day1Net: 30.125, day1Ord: 8, day2Net: 28.375, day2Ord: 7, kwHour: 9 },
    ],
  },
}

function expectedBranchTotals(branchId: Exclude<GlobalBranch, 'all'>): {
  netKwd: number
  orders: number
  aovKwd: number
  day1Net: number
  day1Ord: number
  day2Net: number
  day2Ord: number
} {
  const regs = BRANCH_SCHEDULES[branchId].registers
  const day1Net = r3(regs.reduce((s, r) => s + r.day1Net, 0))
  const day1Ord = regs.reduce((s, r) => s + r.day1Ord, 0)
  const day2Net = r3(regs.reduce((s, r) => s + r.day2Net, 0))
  const day2Ord = regs.reduce((s, r) => s + r.day2Ord, 0)
  const netKwd = r3(day1Net + day2Net)
  const orders = day1Ord + day2Ord
  const aovKwd = orders > 0 ? r3(netKwd / orders) : 0
  return { netKwd, orders, aovKwd, day1Net, day1Ord, day2Net, day2Ord }
}

function rpcOk(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function extractConfigFilterIds(domain: readonly unknown[]): Set<number> | null {
  for (const clause of domain) {
    if (
      Array.isArray(clause) &&
      clause.length === 3 &&
      (clause[0] === 'session_id.config_id' || clause[0] === 'order_id.session_id.config_id') &&
      clause[1] === 'in' &&
      Array.isArray(clause[2])
    ) {
      return new Set((clause[2] as unknown[]).map((n) => Number(n)))
    }
  }
  return null
}

function extractExcludedPosCategoryIds(domain: readonly unknown[]): Set<number> {
  const out = new Set<number>()
  for (const clause of domain) {
    if (
      Array.isArray(clause) &&
      clause.length === 3 &&
      clause[0] === 'product_id.pos_categ_id' &&
      clause[1] === 'not in' &&
      Array.isArray(clause[2])
    ) {
      for (const id of clause[2] as unknown[]) out.add(Number(id))
    }
  }
  return out
}

function installMatrixOdooRpcMock(options?: {
  canteenActive?: boolean
  vetoCanteen41Label?: string
}) {
  vi.spyOn(Date, 'now').mockReturnValue(TEST_REF_NOW_MS)
  const canteenActive = options?.canteenActive ?? true
  const kwDayNov14 = {
    'date_order:day': { from: '2026-11-13 21:00:00', to: '2026-11-14 21:00:00' },
  }
  const kwDayNov15 = {
    'date_order:day': { from: '2026-11-14 21:00:00', to: '2026-11-15 21:00:00' },
  }
  const hourRange = (utcDate: string, kwHour: number) => {
    const utcHour = (kwHour + 24 - 3) % 24
    const nextUtcHour = (utcHour + 1) % 24
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      'date_order:hour': {
        from: `${utcDate} ${pad(utcHour)}:00:00`,
        to: `${utcDate} ${pad(nextUtcHour)}:00:00`,
      },
    }
  }

  // Poisoned excluded POS configs that MUST NEVER enter companyConfigIds
  const poisonedConfigs = [
    { id: 91, name: 'HeisenbergKW Burger Bar', active: true, sessionId: 991, poisonNet: 4100.5, poisonOrd: 310 },
    { id: 92, name: 'Qurain WH POS', active: true, sessionId: 992, poisonNet: 3200.25, poisonOrd: 240 },
    { id: 93, name: 'Hawally Restaurant', active: true, sessionId: 993, poisonNet: 2800.125, poisonOrd: 190 },
    { id: 94, name: 'Delivery (Jahra)', active: true, sessionId: 994, poisonNet: 1950.75, poisonOrd: 145 },
    { id: 16, name: 'E-Mall (Promenade)', active: false, sessionId: 916, poisonNet: 880.0, poisonOrd: 70 },
    { id: 35, name: 'Delivery (Ardiya Temp)', active: false, sessionId: 935, poisonNet: 640.0, poisonOrd: 55 },
    { id: 26, name: 'Exhibition Booth 1', active: true, sessionId: 926, poisonNet: 1500.0, poisonOrd: 120 },
  ]

  const allOperatingRegs = DYNAMIC_OPERATING_BRANCH_IDS.flatMap((b) =>
    BRANCH_SCHEDULES[b].registers.map((r) => ({
      ...r,
      name: r.configId === 41 && options?.vetoCanteen41Label ? options.vetoCanteen41Label : r.name,
      active: b === SCHOOL_CANTEEN_BRANCH_ID ? canteenActive : true,
    })),
  )

  const authenticProducts = [
    { id: 2001, name: '[CG-10] دجاج سويت آند ساور', pos_categ_id: [10, 'CG'], share: 0.3 },
    { id: 2002, name: '[TH-20] شاورما طحينة دبل', pos_categ_id: [12, 'Tahina'], share: 0.25 },
    { id: 2003, name: "[FR-30] Frank's Classic Slider", pos_categ_id: [11, "Frank's"], share: 0.2 },
    { id: 2004, name: '[FB-40] بروستد فارم براون', pos_categ_id: [13, 'FB'], share: 0.15 },
    { id: 2005, name: '[TNB-50] نودلز ترياكي', pos_categ_id: [14, 'TNB'], share: 0.06 },
    { id: 2006, name: '[KC-60] كرك زعفران', pos_categ_id: [15, 'Karak Cafeteria'], share: 0.04 },
  ]

  const poisonedProducts = [
    { id: 2901, name: 'Heisenberg Blue Burger', pos_categ_id: [150, 'Heisenberg'], poisonNet: 999.5, qty: 88 },
    { id: 2902, name: 'هايزنبرغ دبل', pos_categ_id: [10, 'CG'], poisonNet: 777.25, qty: 66 },
    { id: 2903, name: 'وجبة فرع حولي القديم', pos_categ_id: [12, 'Tahina'], poisonNet: 555.125, qty: 44 },
    { id: 2904, name: 'وجبة الجهراء الخاصة', pos_categ_id: [13, 'FB'], poisonNet: 444.0, qty: 33 },
    { id: 2905, name: 'صنف مستودع القرين', pos_categ_id: [14, 'TNB'], poisonNet: 333.0, qty: 22 },
  ]

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      id?: number
      params?: { service?: string; method?: string; args?: unknown[] }
    }
    const reqId = body.id ?? 1
    if (body.params?.service === 'common' && body.params?.method === 'authenticate') {
      return rpcOk(reqId, 7)
    }

    const args = body.params?.args ?? []
    const model = String(args[3] ?? '')
    const method = String(args[4] ?? '')
    const methodArgs = (args[5] as unknown[]) ?? []
    const domain = (methodArgs[0] as unknown[]) ?? []
    const domainStr = JSON.stringify(domain)
    const groupby = (methodArgs[2] as string[]) ?? []

    if (model === 'pos.config' && method === 'search_read') {
      const activeOnly = domainStr.includes('["active","=",true]')
      const combined = [
        ...allOperatingRegs.map((r) => ({
          id: r.configId,
          name: r.name,
          active: r.active,
          company_id: [1, 'Venture Foods'],
        })),
        ...poisonedConfigs.map((p) => ({
          id: p.id,
          name: p.name,
          active: p.active,
          company_id: [1, 'Venture Foods'],
        })),
      ]
      return rpcOk(reqId, activeOnly ? combined.filter((c) => c.active) : combined)
    }

    if (model === 'res.users' && method === 'read') {
      return rpcOk(reqId, [{ id: 7, company_id: [1, 'Venture Foods'] }])
    }

    if (model === 'pos.category' && method === 'search_read') {
      return rpcOk(reqId, [
        { id: 10, name: 'CG', parent_id: false },
        { id: 11, name: "Frank's", parent_id: false },
        { id: 12, name: 'Tahina', parent_id: false },
        { id: 13, name: 'FB', parent_id: false },
        { id: 14, name: 'TNB', parent_id: false },
        { id: 15, name: 'Karak Cafeteria', parent_id: false },
        { id: 150, name: 'Heisenberg Brand Category', parent_id: false },
        { id: 151, name: 'Heisenberg Sub-Menu', parent_id: [150, 'Heisenberg Brand Category'] },
      ])
    }

    if (model === 'account.account' && method === 'search_read') {
      return rpcOk(reqId, [
        { id: 4001, code: '410100', name: 'POS Food Sales', account_type: 'income' },
        { id: 2839, code: '1012839', name: 'Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS', account_type: 'income_other' },
        { id: 4999, code: '419999', name: 'Qurain WH Legacy Revenue', account_type: 'income' },
      ])
    }

    if (model === 'pos.order' && method === 'search_read') {
      return rpcOk(reqId, [
        {
          id: 9501,
          date_order: '2026-11-15 11:00:00',
          amount_total: 564.375,
          config_id: [34, 'The Avenues Phase 4'],
          company_id: [1, 'Venture Foods'],
        },
      ])
    }

    if (model === 'pos.session' && method === 'read') {
      return rpcOk(reqId, [
        ...allOperatingRegs.map((r) => ({ id: r.sessionId, config_id: [r.configId, r.name] })),
        ...poisonedConfigs.map((p) => ({ id: p.sessionId, config_id: [p.id, p.name] })),
      ])
    }

    if (model === 'product.product' && method === 'read') {
      return rpcOk(reqId, [
        ...authenticProducts.map((p) => ({ id: p.id, name: p.name, pos_categ_id: p.pos_categ_id })),
        ...poisonedProducts.map((p) => ({ id: p.id, name: p.name, pos_categ_id: p.pos_categ_id })),
      ])
    }

    const allowedCfgFilter = extractConfigFilterIds(domain)
    const isPrior30Window =
      domainStr.includes('"2026-10-16 21:00:00"') && domainStr.includes('"2026-09-16 21:00:00"')
    const isTodayOnlyWindow =
      domainStr.includes('["date_order",">=","2026-11-14 21:00:00"]') &&
      domainStr.includes('["date_order","<","2026-11-15 21:00:00"]')

    const matchingOperatingRegs = allOperatingRegs.filter((r) =>
      allowedCfgFilter ? allowedCfgFilter.has(r.configId) : true,
    )
    const matchingPoisonedRegs = poisonedConfigs.filter((p) =>
      allowedCfgFilter ? allowedCfgFilter.has(p.id) : false,
    )

    if (model === 'pos.order' && method === 'read_group') {
      if (domainStr.includes('["id","=",0]') || isPrior30Window) {
        return rpcOk(reqId, groupby.length === 0 ? [{ amount_total: 0, amount_tax: 0, __count: 0 }] : [])
      }
      const isCount = domainStr.includes('["amount_total",">=",0]')

      if (groupby.includes('date_order:day')) {
        const rows: unknown[] = []
        for (const r of matchingOperatingRegs) {
          if (!isTodayOnlyWindow) {
            rows.push(
              isCount
                ? { session_id: [r.sessionId, `POS/${r.sessionId}`], pricelist_id: [1, 'Talabat Go'], __count: r.day1Ord, __range: kwDayNov14 }
                : { session_id: [r.sessionId, `POS/${r.sessionId}`], pricelist_id: [1, 'Talabat Go'], amount_total: r.day1Net, amount_tax: 0, __count: r.day1Ord, __range: kwDayNov14 },
            )
          }
          rows.push(
            isCount
              ? { session_id: [r.sessionId, `POS/${r.sessionId}`], pricelist_id: [1, 'Talabat Go'], __count: r.day2Ord, __range: kwDayNov15 }
              : { session_id: [r.sessionId, `POS/${r.sessionId}`], pricelist_id: [1, 'Talabat Go'], amount_total: r.day2Net, amount_tax: 0, __count: r.day2Ord, __range: kwDayNov15 },
          )
        }
        for (const p of matchingPoisonedRegs) {
          rows.push(
            isCount
              ? { session_id: [p.sessionId, `POS/${p.sessionId}`], pricelist_id: [1, 'Talabat Go'], __count: p.poisonOrd, __range: kwDayNov15 }
              : { session_id: [p.sessionId, `POS/${p.sessionId}`], pricelist_id: [1, 'Talabat Go'], amount_total: p.poisonNet, amount_tax: 0, __count: p.poisonOrd, __range: kwDayNov15 },
          )
        }
        return rpcOk(reqId, rows)
      }

      if (groupby.includes('session_id') && groupby.includes('date_order:hour')) {
        const rows: unknown[] = []
        for (const r of matchingOperatingRegs) {
          const totalNet = isTodayOnlyWindow ? r.day2Net : r3(r.day1Net + r.day2Net)
          const totalOrd = isTodayOnlyWindow ? r.day2Ord : r.day1Ord + r.day2Ord
          rows.push(
            isCount
              ? { session_id: [r.sessionId, `POS/${r.sessionId}`], __count: totalOrd, __range: hourRange('2026-11-15', r.kwHour) }
              : { session_id: [r.sessionId, `POS/${r.sessionId}`], amount_total: totalNet, amount_tax: 0, __count: totalOrd, __range: hourRange('2026-11-15', r.kwHour) },
          )
        }
        return rpcOk(reqId, rows)
      }

      if (groupby.includes('date_order:hour')) {
        const rows = matchingOperatingRegs.map((r) => {
          const totalNet = isTodayOnlyWindow ? r.day2Net : r3(r.day1Net + r.day2Net)
          const totalOrd = isTodayOnlyWindow ? r.day2Ord : r.day1Ord + r.day2Ord
          return isCount
            ? { __count: totalOrd, __range: hourRange('2026-11-15', r.kwHour) }
            : { amount_total: totalNet, amount_tax: 0, __count: totalOrd, __range: hourRange('2026-11-15', r.kwHour) }
        })
        return rpcOk(reqId, rows)
      }

      if (groupby.length === 1 && groupby[0] === 'session_id') {
        const rows: unknown[] = []
        for (const r of matchingOperatingRegs) {
          const totalNet = r3(r.day1Net + r.day2Net)
          const totalOrd = r.day1Ord + r.day2Ord
          rows.push(
            isCount
              ? { session_id: [r.sessionId, `POS/${r.sessionId}`], __count: totalOrd }
              : { session_id: [r.sessionId, `POS/${r.sessionId}`], amount_total: totalNet, amount_tax: 0, __count: totalOrd },
          )
        }
        return rpcOk(reqId, rows)
      }

      if (groupby.length === 0) {
        const opNet = r3(
          matchingOperatingRegs.reduce(
            (s, r) => s + (isTodayOnlyWindow ? r.day2Net : r.day1Net + r.day2Net),
            0,
          ),
        )
        const opOrd = matchingOperatingRegs.reduce(
          (s, r) => s + (isTodayOnlyWindow ? r.day2Ord : r.day1Ord + r.day2Ord),
          0,
        )
        const poisonNet = r3(matchingPoisonedRegs.reduce((s, p) => s + p.poisonNet, 0))
        const poisonOrd = matchingPoisonedRegs.reduce((s, p) => s + p.poisonOrd, 0)
        return rpcOk(reqId, [
          { amount_total: r3(opNet + poisonNet), amount_tax: 0, __count: opOrd + poisonOrd },
        ])
      }
      return rpcOk(reqId, [])
    }

    if (model === 'pos.order' && method === 'search_count') {
      if (domainStr.includes('["id","=",0]') || isPrior30Window) {
        return rpcOk(reqId, 0)
      }
      const opOrd = matchingOperatingRegs.reduce(
        (s, r) => s + (isTodayOnlyWindow ? r.day2Ord : r.day1Ord + r.day2Ord),
        0,
      )
      const poisonOrd = matchingPoisonedRegs.reduce((s, p) => s + p.poisonOrd, 0)
      return rpcOk(reqId, opOrd + poisonOrd)
    }

    if (model === 'pos.payment' && method === 'read_group') {
      if (domainStr.includes('["id","=",0]')) return rpcOk(reqId, [])
      const isCount = domainStr.includes('["amount",">=",0]')
      const isPaymentToday =
        domainStr.includes('["pos_order_id.date_order",">=","2026-11-14 21:00:00"]') &&
        domainStr.includes('["pos_order_id.date_order","<","2026-11-15 21:00:00"]')
      return rpcOk(
        reqId,
        matchingOperatingRegs.map((r) => {
          const amt = isPaymentToday ? r.day2Net : r3(r.day1Net + r.day2Net)
          const cnt = isPaymentToday ? r.day2Ord : r.day1Ord + r.day2Ord
          return isCount
            ? { session_id: [r.sessionId, `POS/${r.sessionId}`], payment_method_id: [7, 'Talabat Go'], __count: cnt }
            : { session_id: [r.sessionId, `POS/${r.sessionId}`], payment_method_id: [7, 'Talabat Go'], amount: amt, __count: cnt }
        }),
      )
    }

    if (model === 'pos.order.line' && method === 'read_group') {
      if (domainStr.includes('["discount",">",0]') || domainStr.includes('["id","=",0]')) {
        return rpcOk(reqId, [])
      }
      const excludedCatIds = extractExcludedPosCategoryIds(domain)
      const isLineToday =
        domainStr.includes('["order_id.date_order",">=","2026-11-14 21:00:00"]') &&
        domainStr.includes('["order_id.date_order","<","2026-11-15 21:00:00"]')
      const baseNet = r3(
        matchingOperatingRegs.reduce(
          (s, r) => s + (isLineToday ? r.day2Net : r.day1Net + r.day2Net),
          0,
        ),
      )
      const baseOrd = matchingOperatingRegs.reduce(
        (s, r) => s + (isLineToday ? r.day2Ord : r.day1Ord + r.day2Ord),
        0,
      )

      const validLines = authenticProducts.map((p) => ({
        product_id: [p.id, p.name],
        price_subtotal: r3(baseNet * p.share),
        qty: Math.max(1, Math.round(baseOrd * p.share * 2)),
        discount: 0,
        __count: Math.max(1, Math.round(baseOrd * p.share)),
      }))

      // Inject poisoned lines whose category was NOT filtered out by domain, so we verify post-query entity filters also catch them!
      const leakedPoisonLines = poisonedProducts
        .filter((p) => !excludedCatIds.has(Number(p.pos_categ_id[0])))
        .map((p) => ({
          product_id: [p.id, p.name],
          price_subtotal: p.poisonNet,
          qty: p.qty,
          discount: 0,
          __count: p.qty,
        }))

      return rpcOk(reqId, [...validLines, ...leakedPoisonLines])
    }

    if (model === 'stock.picking' && method === 'search_count') {
      return rpcOk(reqId, 0)
    }

    return rpcOk(reqId, [])
  })
}

describe('Overnight Parameterized Matrix — Per-Branch Checklist, School Canteens 41/42 & 4 Excluded Entities', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const k of ODOO_ENV_KEYS) {
      savedEnv[k] = process.env[k]
    }
    process.env.ODOO_URL = 'https://odoo-matrix-test.example.com'
    process.env.ODOO_DB = 'venturefoods_matrix'
    process.env.ODOO_USERNAME = 'api@venturefoodskw.com'
    process.env.ODOO_API_KEY = 'matrix-test-key'
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

  describe('0. Dynamic POS Registry Topology Integrity (src/lib/odoo/pos-registry.json)', () => {
    it('derives the exact 7 active restaurant branches + school-canteens (41, 42 & 43) dynamically from pos-registry.json', () => {
      expect([...DYNAMIC_RESTAURANT_BRANCH_IDS].sort()).toEqual(
        ['promenade', '360-mall', 'ardiya', 'assima', 'salmiya', 'al-kout', 'avenues'].sort(),
      )
      expect(DYNAMIC_CANTEEN_BRANCH_IDS).toEqual(['school-canteens'])
      expect(SCHOOL_CANTEEN_BRANCH_ID).toBe('school-canteens')
      expect(posRegistry.schoolCanteenPosConfigIds).toEqual([41, 42, 43])
      expect(schoolCanteenRegisterIds()).toEqual([41, 42, 43])
      expect(activeRegistersForLocation('school-canteens')).toEqual([41, 42, 43])

      // Exhibitions are strictly excluded from both restaurantRegisterIds and schoolCanteenRegisterIds
      const exhibitionIds = activeRegistersForLocation('exhibitions')
      expect(exhibitionIds.length).toBeGreaterThan(0)
      for (const exbId of exhibitionIds) {
        expect(restaurantRegisterIds()).not.toContain(exbId)
        expect(schoolCanteenRegisterIds()).not.toContain(exbId)
        expect(companyPosRegisterIds()).not.toContain(exbId)
      }

      const searchDomain = companyPosSearchDomain()
      expect(searchDomain).toContainEqual(['active', '=', true])
      expect(searchDomain).toContainEqual(['id', 'in', companyPosRegisterIds()])
    })
  })

  describe('1. School Canteens 41 (NPIS Hawally) & 42 (FAIPS Ahmadi) Inclusion vs Veto Matrix', () => {
    const ALLOWED_CANTEEN_CASES: readonly { configId: 41 | 42; label: string }[] = [
      { configId: 41, label: 'NPIS Hawally' },
      { configId: 41, label: 'NPIS Hawally School Canteen' },
      { configId: 41, label: 'مقصف مدرسة NPIS حولي' },
      { configId: 41, label: 'مقصف حولي' },
      { configId: 41, label: 'Hawally School Canteen' },
      { configId: 41, label: 'NPIS Hawally Venture Foods Restaurant Co. NPIS: PoS Orders' },
      { configId: 42, label: 'FAIPS Ahmadi' },
      { configId: 42, label: 'FAIPS Ahmadi School Canteen' },
      { configId: 42, label: 'مقصف مدرسة FAIPS الأحمدي' },
      { configId: 42, label: 'FAIPS Ahmadi Venture Foods Hawally: PoS Orders' },
    ]

    it.each(ALLOWED_CANTEEN_CASES)(
      'INCLUDES active canteen POS #$configId ("$label") across companyPos, excludedEntities, domain, console, and branch resolver',
      ({ configId, label }) => {
        expect(isPinnedSchoolCanteenConfigId(configId)).toBe(true)
        expect(companyPosConfigAllowed(configId, label, true)).toBe(true)
        expect(companyPosConfigAllowed(configId, label, false)).toBe(false)
        expect(isExcludedOdooEntity(label)).toBe(false)
        expect(evalOdooDomain(NAME_EXCLUSION_DOMAIN, label)).toBe(true)
        expect(CONSOLE_ROW_KEPT({ id: configId, name: label })).toBe(true)
        expect(resolveRestaurantBranchForConfig(configId, label)).toBe('school-canteens')

        const sanitized = sanitizePosTerminalDisplayName(configId, label)
        expect(sanitized).not.toMatch(/hawally|hawalli|\u062d\u0648\u0644\u064a/i)
      },
    )

    const VETOED_CANTEEN_CASES: readonly {
      configId: 41 | 42
      label: string
      reason: string
      shortCodeOnly?: boolean
    }[] = [
      { configId: 41, label: 'Heisenberg School Canteen', reason: 'Heisenberg Latin brand veto' },
      { configId: 41, label: 'Hizenberg NPIS Hawally', reason: 'Heisenberg typo veto' },
      { configId: 41, label: 'مقصف هايزنبرغ حولي', reason: 'Heisenberg Arabic brand veto' },
      { configId: 41, label: 'مقصف هايزن بريج حولي', reason: 'Heisenberg split Arabic veto' },
      { configId: 41, label: 'NPIS Jahra', reason: 'Jahra Latin branch veto' },
      { configId: 41, label: 'مقصف مدرسة الجهراء', reason: 'Jahra Arabic branch veto' },
      { configId: 41, label: 'Canteen JHR01', reason: 'Jahra short-code + digit veto', shortCodeOnly: true },
      { configId: 42, label: 'FAIPS Qurain', reason: 'Qurain Latin branch veto' },
      { configId: 42, label: 'مقصف مدرسة القرين', reason: 'Qurain Arabic branch veto' },
      { configId: 42, label: 'Canteen QRN1', reason: 'Qurain short-code + digit veto', shortCodeOnly: true },
    ]

    it.each(VETOED_CANTEEN_CASES)(
      'VETOES mislabelled POS #$configId ("$label" — $reason) across companyPos, excludedEntities, domain, console, and branch resolver',
      ({ configId, label, shortCodeOnly }) => {
        expect(companyPosConfigAllowed(configId, label, true)).toBe(false)
        expect(isExcludedOdooEntity(label)).toBe(true)
        if (!shortCodeOnly) {
          expect(evalOdooDomain(NAME_EXCLUSION_DOMAIN, label)).toBe(false)
          expect(CONSOLE_ROW_KEPT({ id: configId, name: label })).toBe(false)
        }
        expect(resolveRestaurantBranchForConfig(configId, label)).toBeNull()
      },
    )

    it('includes 41, 42 & 43 in live company totals when active, drops them to 0 when inactive, and drops #41 when veto-mislabelled', async () => {
      // 1) Active 41 (184.375 KWD, 42 ord) + 42 (136.250 KWD, 33 ord) + 43 (58.500 KWD, 15 ord) = 379.125 KWD, 90 orders
      installMatrixOdooRpcMock({ canteenActive: true })
      const activeEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const activeCanteenBranch = activeEnv.branches?.find((b) => b.id === 'school-canteens')
      expect(activeCanteenBranch?.netSalesKwd).toBe(379.125)
      expect(activeCanteenBranch?.orders).toBe(90)

      const restaurantOnlySum = r3(
        DYNAMIC_RESTAURANT_BRANCH_IDS.reduce(
          (s, b) => s + expectedBranchTotals(b).netKwd,
          0,
        ),
      )
      expect(activeEnv.totals.netSalesKwd).toBe(r3(restaurantOnlySum + 379.125))

      // 2) Inactive 41, 42 & 43 -> 0.000 KWD in school-canteens and company totals equal restaurantOnlySum
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installMatrixOdooRpcMock({ canteenActive: false })
      const inactiveEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const inactiveCanteenBranch = inactiveEnv.branches?.find((b) => b.id === 'school-canteens')
      expect(inactiveCanteenBranch?.netSalesKwd).toBe(0)
      expect(inactiveCanteenBranch?.orders).toBe(0)
      expect(inactiveEnv.totals.netSalesKwd).toBe(restaurantOnlySum)

      // 3) Mislabelled #41 ("Heisenberg School Canteen") -> #41 vetoed, only #42 + #43 (194.750 KWD, 48 ord) counted!
      vi.restoreAllMocks()
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
      installMatrixOdooRpcMock({ canteenActive: true, vetoCanteen41Label: 'Heisenberg School Canteen' })
      const vetoEnv = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const vetoCanteenBranch = vetoEnv.branches?.find((b) => b.id === 'school-canteens')
      expect(vetoCanteenBranch?.netSalesKwd).toBe(194.75)
      expect(vetoCanteenBranch?.orders).toBe(48)
      expect(vetoEnv.totals.netSalesKwd).toBe(r3(restaurantOnlySum + 194.75))
    })
  })

  describe('2. All 4 Excluded Entities Matrix — Zero Matches & 0.000 KWD Contribution Across Every Entry Point', () => {
    const EXCLUDED_ENTITY_MATRIX: readonly {
      family: 'Heisenberg' | 'Qurain' | 'Closed-Hawally-Restaurant' | 'Jahra'
      label: string
      shortCodeOnly?: boolean
    }[] = [
      // Family 1: Heisenberg
      { family: 'Heisenberg', label: 'Heisenberg' },
      { family: 'Heisenberg', label: 'HeisenbergKW' },
      { family: 'Heisenberg', label: 'Hizenberg' },
      { family: 'Heisenberg', label: 'Heizenberg' },
      { family: 'Heisenberg', label: 'Heisenburg' },
      { family: 'Heisenberg', label: 'Haisenberg' },
      { family: 'Heisenberg', label: 'هايزنبرغ' },
      { family: 'Heisenberg', label: 'هايزن بريج' },
      { family: 'Heisenberg', label: 'هايزن' },

      // Family 2: Qurain
      { family: 'Qurain', label: 'Qurain' },
      { family: 'Qurain', label: 'Qurain WH' },
      { family: 'Qurain', label: 'Al-Qurain' },
      { family: 'Qurain', label: 'Kurain' },
      { family: 'Qurain', label: 'QRN', shortCodeOnly: true },
      { family: 'Qurain', label: 'QRN01', shortCodeOnly: true },
      { family: 'Qurain', label: 'القرين' },
      { family: 'Qurain', label: 'قرين' },
      { family: 'Qurain', label: 'بالقرين' },

      // Family 3: Closed Hawally restaurant branch
      { family: 'Closed-Hawally-Restaurant', label: 'Hawally' },
      { family: 'Closed-Hawally-Restaurant', label: 'Hawally2' },
      { family: 'Closed-Hawally-Restaurant', label: 'Hawally Restaurant' },
      { family: 'Closed-Hawally-Restaurant', label: 'Hawally School Street Branch' },
      { family: 'Closed-Hawally-Restaurant', label: 'HWL', shortCodeOnly: true },
      { family: 'Closed-Hawally-Restaurant', label: 'فرع حولي' },
      { family: 'Closed-Hawally-Restaurant', label: 'حولي' },
      { family: 'Closed-Hawally-Restaurant', label: 'بحولي' },
      { family: 'Closed-Hawally-Restaurant', label: 'حولي - شارع المدارس' },

      // Family 4: Jahra
      { family: 'Jahra', label: 'Jahra' },
      { family: 'Jahra', label: 'Jahra01' },
      { family: 'Jahra', label: 'AlJahra' },
      { family: 'Jahra', label: 'Jahara' },
      { family: 'Jahra', label: 'JHR', shortCodeOnly: true },
      { family: 'Jahra', label: 'JHR2', shortCodeOnly: true },
      { family: 'Jahra', label: 'الجهراء' },
      { family: 'Jahra', label: 'جهراء' },
      { family: 'Jahra', label: 'الجهرة' },
      { family: 'Jahra', label: 'بالجهراء' },
      { family: 'Jahra', label: 'Delivery (Jahra)' },
      { family: 'Jahra', label: 'Tasty Snacks(Jahra)' },
    ]

    it.each(EXCLUDED_ENTITY_MATRIX)(
      'blocks [$family] "$label" across isExcludedOdooEntity, companyPosConfigAllowed, branchResolver, stripExcludedOdooTree, and sumWithoutExcludedEntities',
      ({ label, shortCodeOnly }) => {
        expect(isExcludedOdooEntity(label)).toBe(true)
        expect(isExcludedOdooRecord({ id: 777, name: label, kind: 'branch' })).toBe(true)

        // Even if someone attaches an excluded name to an approved restaurant register #8, it MUST be blocked
        expect(companyPosConfigAllowed(8, label, true)).toBe(false)
        expect(companyPosConfigAllowed(99, label, true)).toBe(false)
        expect(resolveRestaurantBranchForConfig(8, label)).toBeNull()
        expect(resolveRestaurantBranchForConfig(99, label)).toBeNull()

        if (!shortCodeOnly) {
          expect(evalOdooDomain(NAME_EXCLUSION_DOMAIN, label)).toBe(false)
          expect(CONSOLE_ROW_KEPT({ id: 777, name: label })).toBe(false)
        }

        // Tree stripper & sum reducer contribute 0 matches and 0.000 KWD
        const tree = stripExcludedOdooTree({
          rows: [
            { name: 'Promenade', amount: 125.5 },
            { name: label, amount: 999.875 },
          ],
          nested: {
            promenade: { netKwd: 125.5 },
            [label]: { netKwd: 999.875 },
          },
        })
        expect(tree.rows).toEqual([{ name: 'Promenade', amount: 125.5 }])
        expect(tree.nested[label]).toBeUndefined()

        expect(
          rowsWithoutExcludedEntities([
            { name: '360 Mall' },
            { name: label },
          ]),
        ).toEqual([{ name: '360 Mall' }])

        expect(
          sumWithoutExcludedEntities([
            { name: label, amount: 888.888 },
          ]),
        ).toBe(0)

        expect(
          isPeriodSaleProduct({
            name: label,
            brandId: 'china-garden',
            netKwd: 500,
            qty: 50,
            approvedBrandIds: ['china-garden'],
          }),
        ).toBe(false)
      },
    )

    it('blocks POS category #150 (Heisenberg) and strips all 4 poisoned excluded entities across live Snapshot, PeriodCube, Workspace, CoresHub, Comparison, Reports, BriefFactPack, and Feryal (0.000 KWD)', async () => {
      expect(isExcludedRecordId('pos_category', 150)).toBe(true)
      expect(isExcludedOdooRecord({ id: 150, name: 'Any Category Name', kind: 'pos_category' })).toBe(
        true,
      )

      installMatrixOdooRpcMock({ canteenActive: true })
      const env = await fetchLiveOdooSnapshot({
        period: 'month',
        forceRefresh: true,
        referenceNowMs: TEST_REF_NOW_MS,
      })
      const cube = await fetchLiveOdooPeriodCube('2026-11-14', '2026-11-15', TEST_REF_NOW_MS)

      const exactExpectedCompanyNet = r3(
        DYNAMIC_OPERATING_BRANCH_IDS.reduce((s, b) => s + expectedBranchTotals(b).netKwd, 0),
      )
      const exactExpectedCompanyOrders = DYNAMIC_OPERATING_BRANCH_IDS.reduce(
        (s, b) => s + expectedBranchTotals(b).orders,
        0,
      )

      // Zero poisoned KWD or orders leaked into Envelope or Cube
      expect(env.totals.netSalesKwd).toBe(exactExpectedCompanyNet)
      expect(env.totals.orders).toBe(exactExpectedCompanyOrders)
      expect(env.unattributedSalesKwd).toBe(0)
      expect(cube.totals.netSalesKwd).toBe(exactExpectedCompanyNet)
      expect(cube.totals.orders).toBe(exactExpectedCompanyOrders)
      expect(cube.posConfigIds?.excludedPosCategoryIds).toContain(150)
      expect(cube.posConfigIds?.excludedPosCategoryIds).toContain(151)

      // Zero poisoned products in cube.topProducts or cores.menu.dishes
      const ws = computeGlobalWorkspace({ ...DEFAULT_GLOBAL_FILTERS, period: 'month' }, env.summary)
      const cores = computeCoresHubSnapshot(
        { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
        [],
        env.summary,
        cube,
      )
      const depts = buildLiveEnterpriseDepartments(ws, env.summary, true)
      const cmp = computeErpComparison(
        {
          mode: 'date-vs-date',
          granularity: 'range',
          periodA: { from: '2026-11-14', to: '2026-11-15' },
          periodB: { from: '2026-11-12', to: '2026-11-13' },
          brandIds: 'all',
          branchIds: 'all',
          channelIds: 'all',
        },
        { cubeA: cube, cubeB: cube, liveSummary: env.summary },
      )
      const pack = buildBriefFactPack({
        yesterday: '2026-11-15',
        prior: '2026-11-14',
        current: cube,
        priorCube: null,
        purchases: null,
        receivables: null,
      })

      const serializedAll = JSON.stringify({
        branches: env.branches,
        brands: env.brands,
        topProducts: cube.topProducts,
        dishes: cores.menu.dishes,
        reports: depts,
        cmpBranches: cmp.byBranch,
        briefFacts: pack.facts,
      })
      expect(serializedAll).not.toMatch(
        /heisenberg|hizenberg|هايزن|qurain|القرين|قرين|jahra|الجهراء|جهراء|فرع حولي|hawally restaurant/i,
      )
    })
  })

  describe('3. Parameterized Per-Branch Scoped Parity Across All 8 Active Branches (7 Restaurants + school-canteens)', () => {
    it.each(DYNAMIC_OPERATING_BRANCH_IDS)(
      'verifies [%s] across branch options, Envelope, PeriodCube, Workspace, CoresHub chart/tooltip series, Comparison, VF-POS-02, and Feryal best/worst facts',
      async (branchId) => {
        installMatrixOdooRpcMock({ canteenActive: true })
        const env = await fetchLiveOdooSnapshot({
          period: 'month',
          forceRefresh: true,
          referenceNowMs: TEST_REF_NOW_MS,
        })
        const cube = await fetchLiveOdooPeriodCube('2026-11-14', '2026-11-15', TEST_REF_NOW_MS)
        const expected = expectedBranchTotals(branchId)

        // (a) Dashboard Branch Options & Brand-Branch Compatibility
        const staticOpt = GLOBAL_BRANCH_OPTIONS.find((o) => o.id === branchId)
        expect(staticOpt).toBeDefined()
        expect(isBrandBranchCompatible('china-garden', branchId)).toBe(true)

        const wsAll = computeGlobalWorkspace(
          { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
          env.summary,
        )
        const cascadingOpt = wsAll.cascadingOptions.branches.find((o) => o.id === branchId)
        expect(cascadingOpt).toBeDefined()
        expect(cascadingOpt?.available).toBe(true)
        expect(cascadingOpt?.healthDot).toBe('🟢')

        // (b) Live Odoo Envelope & PeriodCube
        const envBranch = env.branches?.find((b) => b.id === branchId)
        expect(envBranch).toBeDefined()
        expect(envBranch?.netSalesKwd).toBe(expected.netKwd)
        expect(envBranch?.orders).toBe(expected.orders)

        expect(cube.byBranch[branchId].netKwd).toBe(expected.netKwd)
        expect(cube.byBranch[branchId].orders).toBe(expected.orders)
        expect(cube.byBranch[branchId].aovKwd).toBe(expected.aovKwd)

        // (c) Branch-Scoped computeGlobalWorkspace Parity (3-decimal Net KWD, orders, AOV)
        const wsScoped = computeGlobalWorkspace(
          { ...DEFAULT_GLOBAL_FILTERS, period: 'month', branch: branchId },
          env.summary,
        )
        expect(wsScoped.salesKwd).toBe(expected.netKwd)
        expect(wsScoped.orders).toBe(expected.orders)
        expect(wsScoped.aovKwd).toBe(expected.aovKwd)

        // (d) Sales Analysis (CoresHub) & Daily/Hourly Chart + Tooltip Series Parity
        const coresAll = computeCoresHubSnapshot(
          { ...DEFAULT_GLOBAL_FILTERS, period: 'month' },
          [],
          env.summary,
          cube,
        )
        const rankRowAll = coresAll.sales.branchRanking.find((r) => r.id === branchId)
        expect(rankRowAll).toBeDefined()
        expect(rankRowAll?.salesKwd).toBe(expected.netKwd)
        expect(rankRowAll?.orders).toBe(expected.orders)
        expect(rankRowAll?.aovKwd).toBe(expected.aovKwd)

        const coresScoped = computeCoresHubSnapshot(
          { ...DEFAULT_GLOBAL_FILTERS, period: 'month', branch: branchId },
          [],
          env.summary,
          cube,
        )
        expect(coresScoped.sales.branchRanking).toHaveLength(1)
        expect(coresScoped.sales.branchRanking[0]?.salesKwd).toBe(expected.netKwd)
        expect(coresScoped.sales.branchRanking[0]?.orders).toBe(expected.orders)
        expect(coresScoped.sales.branchRanking[0]?.aovKwd).toBe(expected.aovKwd)

        const timelineSumNet = r3(
          coresScoped.sales.timeline.reduce((s, p) => s + p.salesKwd, 0),
        )
        const timelineSumOrd = coresScoped.sales.timeline.reduce((s, p) => s + (p.orders ?? 0), 0)
        expect(timelineSumNet).toBe(expected.netKwd)
        expect(timelineSumOrd).toBe(expected.orders)

        const hourlySumNet = r3(
          coresScoped.sales.hourly.reduce((s, p) => s + p.salesKwd, 0),
        )
        const hourlySumOrd = coresScoped.sales.hourly.reduce((s, p) => s + (p.orders ?? 0), 0)
        expect(hourlySumNet).toBe(expected.netKwd)
        expect(hourlySumOrd).toBe(expected.orders)

        // (e) Branch Comparison (computeErpComparison & computeBeforeAfterSnapshot)
        const cmpAll = computeErpComparison(
          {
            mode: 'date-vs-date',
            granularity: 'range',
            periodA: { from: '2026-11-14', to: '2026-11-15' },
            periodB: { from: '2026-11-12', to: '2026-11-13' },
            brandIds: 'all',
            branchIds: 'all',
            channelIds: 'all',
          },
          { cubeA: cube, cubeB: cube, liveSummary: env.summary },
        )
        const cmpBranchRow = cmpAll.byBranch.find((r) => r.id === branchId)
        expect(cmpBranchRow).toBeDefined()
        expect(cmpBranchRow?.ordersA).toBe(expected.orders)

        const cmpEntity = computeErpComparison(
          {
            mode: 'entity-vs-entity',
            granularity: 'range',
            periodA: { from: '2026-11-14', to: '2026-11-15' },
            periodB: { from: '2026-11-14', to: '2026-11-15' },
            brandIds: 'all',
            branchIds: 'all',
            channelIds: 'all',
            entityDimension: 'branch',
            entityA: branchId,
            entityB: branchId === 'avenues' ? '360-mall' : 'avenues',
          },
          { cubeA: cube, cubeB: cube, liveSummary: env.summary },
        )
        expect(cmpEntity.selectionA.completedOrders).toBe(expected.orders)

        const baScoped = computeBeforeAfterSnapshot(
          { ...DEFAULT_GLOBAL_FILTERS, branch: branchId },
          'week-vs-week',
          null,
          [],
          [],
          env.summary,
          { afterCube: cube, beforeCube: cube },
        )
        expect(
          baScoped.byBranchRows
            .filter((r) => r.afterOrders > 0 || r.afterSalesKwd > 0)
            .map((r) => r.id),
        ).toEqual([branchId])
        expect(baScoped.summary.orders.after).toBe(expected.orders)

        // (f) Enterprise Reports Registry (VF-POS-02)
        const deptsAllEn = buildLiveEnterpriseDepartments(wsAll, env.summary, false)
        const vfPos02All = deptsAllEn
          .flatMap((d) => d.reports)
          .find((r) => r.code === 'VF-POS-02')
        const expectedEnLabel = staticOpt?.en ?? branchId
        const vfRow = vfPos02All?.rows.find((r) => r.branch === expectedEnLabel)
        expect(vfRow).toBeDefined()
        expect(vfRow?.netSales).toBe(expected.netKwd.toFixed(3))
        expect(vfRow?.orders).toBe(expected.orders)
        expect(vfRow?.avgOrderValue).toBe(expected.aovKwd.toFixed(3))

        // (g) AI Brief Fact Pack & Feryal Best/Worst + Council Facts
        const pack = buildBriefFactPack({
          yesterday: '2026-11-15',
          prior: '2026-11-14',
          current: cube,
          priorCube: null,
          purchases: null,
          receivables: null,
        })
        const briefSalesFact = pack.facts.find(
          (f) => f.metric === 'net_sales_kwd' && f.entityId === branchId,
        )
        const briefOrdersFact = pack.facts.find(
          (f) => f.metric === 'orders' && f.entityId === branchId,
        )
        expect(briefSalesFact).toBeDefined()
        expect(Number(briefSalesFact?.value)).toBe(expected.netKwd)
        expect(Number(briefOrdersFact?.value)).toBe(expected.orders)

        // Verify Feryal surfaces this branch as topBranch when boosted to #1 and as lowestBranch when reduced to #8
        const boostedCube: OdooPeriodCube = {
          ...cube,
          byBranch: {
            ...cube.byBranch,
            [branchId]: {
              ...cube.byBranch[branchId],
              netKwd: 9500.5,
              orders: 1200,
              aovKwd: r3(9500.5 / 1200),
            },
          },
          totals: {
            ...cube.totals,
            netSalesKwd: r3(cube.totals.netSalesKwd - expected.netKwd + 9500.5),
            orders: cube.totals.orders - expected.orders + 1200,
          },
        }
        const feryalDsTop: FeryalOdooDataSource = {
          fetchPeriodCube: async () => boostedCube,
          fetchPurchaseOrders: async () => null,
          fetchWarehouseChain: async () => null,
          fetchReceivablesSummary: async () => null,
          fetchBranchTopProducts: async () => [],
        }
        const feryalTopRes = await askFeryalOdooAgent({
          question: 'كم مبيعات الفروع أمس 14/11؟',
          referenceNowMs: TEST_REF_NOW_MS,
          dataSource: feryalDsTop,
        })
        expect(feryalTopRes.status).toBe('answered')
        expect(feryalTopRes.verifier.valid).toBe(true)
        expect(feryalTopRes.reply).toContain('9,500.5 د.ك')
        const structuredFact = feryalTopRes.facts.find(
          (f) => f.entityId === branchId && f.metric === 'net_sales_kwd',
        )
        expect(structuredFact?.value).toBe('9500.5')

        const lowestCube: OdooPeriodCube = {
          ...cube,
          byBranch: {
            ...cube.byBranch,
            [branchId]: {
              ...cube.byBranch[branchId],
              netKwd: 12.4,
              orders: 3,
              aovKwd: r3(12.4 / 3),
            },
          },
          totals: {
            ...cube.totals,
            netSalesKwd: r3(cube.totals.netSalesKwd - expected.netKwd + 12.4),
            orders: cube.totals.orders - expected.orders + 3,
          },
        }
        const feryalDsLowest: FeryalOdooDataSource = {
          fetchPeriodCube: async () => lowestCube,
          fetchPurchaseOrders: async () => null,
          fetchWarehouseChain: async () => null,
          fetchReceivablesSummary: async () => null,
          fetchBranchTopProducts: async () => [],
        }
        const feryalLowestRes = await askFeryalOdooAgent({
          question: 'كم مبيعات الفروع أمس 14/11؟',
          referenceNowMs: TEST_REF_NOW_MS,
          dataSource: feryalDsLowest,
        })
        expect(feryalLowestRes.status).toBe('answered')
        expect(feryalLowestRes.verifier.valid).toBe(true)
        expect(feryalLowestRes.reply).toContain('بينما سجل فرع')
        expect(feryalLowestRes.reply).toContain('12.4 د.ك')
        const lowestFact = feryalLowestRes.facts.find(
          (f) => f.entityId === branchId && f.metric === 'net_sales_kwd',
        )
        expect(lowestFact?.value).toBe('12.4')

        const directCouncilFacts = numericFactsFromStructured(
          {
            period: { from: '2026-11-14', to: '2026-11-15' },
            branch: { id: branchId, nameAr: staticOpt?.ar ?? branchId, netKwd: expected.netKwd, orders: expected.orders },
          },
          { from: '2026-11-14', to: '2026-11-15' },
        )
        expect(
          directCouncilFacts.find(
            (f) => f.id === `net_sales_kwd|${branchId}|2026-11-14..2026-11-15`,
          )?.value,
        ).toBe(String(expected.netKwd))
      },
    )
  })
})
