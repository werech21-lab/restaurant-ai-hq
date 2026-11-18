/**
 * Phase 1 · Item 1.4 (`C5` + Qurain double-count audit prep while POS sales stay «غير متاح» per line 83).
 *
 * HARD RULE: Zero hand-typed KWD values. Every figure is derived strictly from
 * real repo data (`database/seeds/venturefoods_odoo_cids1_dump.json`,
 * `src/lib/__tests__/fixtures/dashboard-today-2026-11-17.json`, `pos-registry.json`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { companyPosConfigAllowed, EXHIBITION_BRANCH_ID } from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity, isExcludedRecordId } from '@/lib/odoo/excluded-entities'
import {
  bustOdooLiveCache,
  fetchLiveOdooSnapshot,
  fetchLiveOdooWarehouseChain,
  formatStockTransferEndpoint,
  isDecommissionedWarehouseRecord,
  QURAIN_CENTRAL_KITCHEN_LABEL_AR,
  QURAIN_CENTRAL_KITCHEN_LABEL_EN,
  resolveStockLocationRole,
} from '@/lib/odoo-live-connector'
import { localizeArabicPlanningCopy } from '@/lib/aether/planning-engine'
import { askFeryalOdooAgent, resetFeryalAuditCache } from '@/lib/feryal-odoo-agent'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import {
  classifyQurainAuditOrders,
  OUR_SITES_RE,
  redactPartnerIdentity,
} from '../../../../scripts/audit-qurain-double-count.mjs'

interface RealSeedQuantRow {
  id: number
  product_id: [number, string]
  location_id: [number, string]
  quantity: number
}

const ROOT = process.cwd()
const SEED_DUMP_PATH = path.join(ROOT, 'database', 'seeds', 'venturefoods_odoo_cids1_dump.json')
const seedDump = JSON.parse(fs.readFileSync(SEED_DUMP_PATH, 'utf8')) as {
  models: {
    'stock.quant': RealSeedQuantRow[]
  }
}

const ODOO_ENV_KEYS = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_LOGIN', 'ODOO_API_KEY'] as const

describe('Phase 1.4 (C5) — Qurain Central Kitchen stock/transfers visible & EXB = Exhibition Booths (never a kitchen)', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const k of ODOO_ENV_KEYS) savedEnv[k] = process.env[k]
    resetFeryalAuditCache()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  afterEach(() => {
    for (const k of ODOO_ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
    vi.restoreAllMocks()
    bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
  })

  it('un-decommissions QRN/Qurain/«القرين» on warehouse paths (role: ck) while keeping Jahra & Heisenberg decommissioned', () => {
    const realQrnQuants = seedDump.models['stock.quant'].filter(
      (q) => Array.isArray(q.location_id) && q.location_id[1] === 'QRN/Stock',
    )
    expect(realQrnQuants.length).toBeGreaterThan(0)
    const realQrnLabel = realQrnQuants[0]!.location_id[1]

    for (const ckLoc of [
      realQrnLabel,
      'Qurain/Stock',
      'Al-Qurain Central Kitchen/Stock',
      'القرين/المخزن',
      QURAIN_CENTRAL_KITCHEN_LABEL_AR,
      QURAIN_CENTRAL_KITCHEN_LABEL_EN,
    ]) {
      expect(isDecommissionedWarehouseRecord(ckLoc), ckLoc).toBe(false)
      const role = resolveStockLocationRole(ckLoc, 'internal')
      expect(role.excluded, ckLoc).toBe(false)
      expect(role.role, ckLoc).toBe('ck')
      expect(role.branchId, ckLoc).toBeNull()
    }

    for (const decomm of ['Jahra Branch/Stock', 'JHR/Stock', 'الجهراء', 'Heisenberg Kitchen/Stock', 'هايزنبرغ']) {
      expect(isDecommissionedWarehouseRecord(decomm), decomm).toBe(true)
      expect(resolveStockLocationRole(decomm, 'internal').excluded, decomm).toBe(true)
    }
  })

  it('maps EXB to Exhibition Booths (never ck / kitchen) across stock locations, transfer fallbacks, planning copy & role docs', () => {
    for (const boothLoc of ['EXB/Stock', 'EXB/Booth 1', 'Exhibition Booths/Stock', 'بوثات المعارض/المخزن']) {
      const role = resolveStockLocationRole(boothLoc, 'internal')
      expect(role.excluded, boothLoc).toBe(false)
      expect(role.role, boothLoc).toBe('branch')
      expect(role.branchId, boothLoc).toBe(EXHIBITION_BRANCH_ID)
    }

    expect(formatStockTransferEndpoint(null, 'origin')).toBe(QURAIN_CENTRAL_KITCHEN_LABEL_EN)
    expect(formatStockTransferEndpoint('QRN/Stock', 'origin')).toBe(QURAIN_CENTRAL_KITCHEN_LABEL_EN)
    expect(formatStockTransferEndpoint('القرين/المخزن', 'origin')).toBe(QURAIN_CENTRAL_KITCHEN_LABEL_AR)
    expect(formatStockTransferEndpoint(null, 'origin')).not.toMatch(/EXB|Ardiya Central Kitchen/i)

    const localized = localizeArabicPlanningCopy('توسيع معارض EXB وتشغيل EXB في الموسم')
    expect(localized).not.toMatch(/\bEXB\b/i)
    expect(localized).toContain('بوثات المعارض')
    expect(localized).not.toMatch(/مطبخ|المركزي/)

    const roleDirSrc = fs.readFileSync(
      path.join(ROOT, 'src', 'app', 'api', 'erp', 'role-directory', 'route.ts'),
      'utf8',
    )
    const rolePolicySrc = fs.readFileSync(
      path.join(ROOT, 'src', 'lib', 'auth', 'role-access-policy.ts'),
      'utf8',
    )
    expect(roleDirSrc).not.toMatch(/Ardiya Central Kitchen\s*\(?EXB\)?|المطبخ المركزي بالعارضية\s*\(EXB\)/i)
    expect(rolePolicySrc).not.toMatch(/Ardiya Central Kitchen\s*\(?EXB\)?/i)
  })

  it('surfaces real QRN/Stock quants from venturefoods_odoo_cids1_dump.json in fetchLiveOdooWarehouseChain & Qurain stockTransfers', async () => {
    process.env.ODOO_URL = 'https://localhost:8069'
    process.env.ODOO_DB = 'vf_test'
    process.env.ODOO_USERNAME = 'bi@example.com'
    process.env.ODOO_API_KEY = 'test_key'

    const realQuants = seedDump.models['stock.quant']
    const uniqueLocations = new Map<number, { id: number; name: string; complete_name: string; usage: string }>()
    for (const q of realQuants) {
      const [locId, locLabel] = q.location_id
      if (!uniqueLocations.has(locId)) {
        const usage = locLabel.startsWith('Partners/')
          ? 'customer'
          : locLabel.startsWith('Virtual Locations/')
            ? 'inventory'
            : 'internal'
        uniqueLocations.set(locId, {
          id: locId,
          name: locLabel.split('/').pop() || locLabel,
          complete_name: locLabel,
          usage,
        })
      }
    }

    const internalQuantGroups = realQuants
      .filter((q) => uniqueLocations.get(q.location_id[0])?.usage === 'internal')
      .map((q) => ({
        product_id: q.product_id,
        location_id: q.location_id,
        quantity: q.quantity,
        __count: 1,
      }))

    const r3 = (n: number) => Math.round(n * 1000) / 1000
    const expectedQrnQty = realQuants
      .filter((q) => q.location_id[1] === 'QRN/Stock')
      .reduce((sum, q) => sum + q.quantity, 0)
    const expectedPrmQty = realQuants
      .filter((q) => q.location_id[1] === 'PRM/Stock')
      .reduce((sum, q) => r3(sum + q.quantity), 0)

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number
        params?: { service?: string; method?: string; args?: unknown[] }
      }
      const reply = (result: unknown) =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 1, result }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      if (body.params?.service === 'common' && body.params?.method === 'authenticate') return reply(7)
      const args = body.params?.args ?? []
      const model = String(args[3] ?? '')
      const method = String(args[4] ?? '')

      if (model === 'res.users' && method === 'read') return reply([{ id: 7, company_id: [1, 'Venture Foods'] }])
      if (model === 'stock.location' && method === 'search_read') return reply([...uniqueLocations.values()])
      if (model === 'fields_get' || method === 'fields_get') return reply({ quantity: { type: 'float' } })
      if (model === 'pos.category' && method === 'search_read') {
        return reply([{ id: 10, name: 'CG', parent_id: false }])
      }
      if (model === 'stock.quant' && method === 'read_group') return reply(internalQuantGroups)
      if (model === 'product.product' && method === 'read') {
        const callArgs = Array.isArray(args[5]) ? (args[5] as unknown[]) : []
        const ids = Array.isArray(callArgs[0]) ? (callArgs[0] as number[]) : []
        return reply(
          ids.map((id) => {
            const matchQuant = realQuants.find((q) => q.product_id[0] === id)
            const rawLabel = matchQuant?.product_id[1] ?? `Product #${id}`
            const codeMatch = /^\[([^\]]+)\]\s*(.*)$/.exec(rawLabel)
            return {
              id,
              name: codeMatch ? codeMatch[2] : rawLabel,
              default_code: codeMatch ? codeMatch[1] : `ITEM-${id}`,
              standard_price: 1,
              categ_id: [1, 'Ingredients'],
              pos_categ_id: [10, 'CG'],
              uom_id: [1, 'Unit'],
            }
          }),
        )
      }
      if (model === 'stock.picking' && method === 'search_read') {
        return reply([
          {
            id: 9001,
            name: 'QRN/INT/00901',
            state: 'done',
            location_id: [259, 'QRN/Stock'],
            location_dest_id: [251, 'PRM/Stock'],
            scheduled_date: '2026-11-17 06:00:00',
            date_done: '2026-11-17 07:15:00',
          },
          {
            id: 9002,
            name: 'QRN/INT/00902',
            state: 'done',
            location_id: [259, 'القرين/المخزن'],
            location_dest_id: [219, '360/Stock'],
            scheduled_date: '2026-11-17 08:00:00',
            date_done: '2026-11-17 08:45:00',
          },
          {
            id: 9003,
            name: 'JHR/INT/00001',
            state: 'done',
            location_id: [999, 'JHR/Stock'],
            location_dest_id: [251, 'PRM/Stock'],
            scheduled_date: '2026-11-17 05:00:00',
            date_done: '2026-11-17 05:30:00',
          },
        ])
      }
      if (model === 'stock.picking' && method === 'search_count') return reply(2)
      if (model === 'pos.config' && method === 'search_read') {
        return reply([{ id: 8, name: 'Promenade', active: true, company_id: [1, 'Venture Foods'] }])
      }
      if (model === 'pos.order' && method === 'search_read') {
        return reply([{ id: 1, date_order: '2026-11-17 09:00:00', amount_total: 1, config_id: [8, 'Promenade'], company_id: [1, 'Venture Foods'] }])
      }
      return reply([])
    })

    const wh = await fetchLiveOdooWarehouseChain('2026-11-01', '2026-11-17', Date.parse('2026-11-17T12:00:00Z'))
    expect(wh.connected).toBe(true)
    expect(wh.byBranchOnHand.promenade.qty).toBeCloseTo(expectedPrmQty, 3)
    expect(wh.totals.ckOnHandValueKwd).toBeCloseTo(expectedQrnQty, 3)
    expect(wh.totals.currentOnHandQty).toBeGreaterThan(wh.byBranchOnHand.promenade.qty)

    const snap = await fetchLiveOdooSnapshot({ period: 'today', forceRefresh: true })
    const routes = snap.summary?.stockTransfers?.routes ?? []
    expect(routes.map((r) => r.origin)).toEqual([
      QURAIN_CENTRAL_KITCHEN_LABEL_EN,
      QURAIN_CENTRAL_KITCHEN_LABEL_AR,
    ])
    expect(JSON.stringify(routes)).not.toMatch(/JHR|Jahra/i)
  })

  it('keeps Qurain POS sales excluded / «غير متاح» per Master Prompt line 83 until the owner runs the Mac audit', async () => {
    expect(isExcludedOdooEntity('Qurain')).toBe(true)
    expect(isExcludedOdooEntity('القرين')).toBe(true)
    expect(companyPosConfigAllowed(99, 'Qurain POS')).toBe(false)
    expect(posRegistry.locations).not.toHaveProperty('qurain')

    const res = await askFeryalOdooAgent({
      question: 'كم مبيعات القرين هالشهر؟',
      userSub: 'redo-p1-qurain-gate',
      userRole: 'gm',
      skipAuditLog: true,
    })
    expect(res.status).toBe('no_odoo_data')
    expect(res.reply).toContain('غير متاح')
    expect(res.reply).toContain('القرين (المطبخ المركزي)')
    expect(res.reply).not.toMatch(/0\.000/)
  })

  it('hardens audit-qurain-double-count: redacts PII, recognizes FAS/EXB internal sites, retains customer orderIds/byDay/byConfig, and verifies Σbranches + Qurain == headline', () => {
    expect(OUR_SITES_RE.test('FAS Fahaheel Canteen')).toBe(true)
    expect(OUR_SITES_RE.test('مقصف الفحاحيل')).toBe(true)
    expect(OUR_SITES_RE.test('EXB Booth 3')).toBe(true)
    expect(OUR_SITES_RE.test('بوث المعرض')).toBe(true)

    const piiPartner = redactPartnerIdentity({
      partnerId: 777,
      rawName: 'Mohammed Al-Customer Personal Name',
      isCompany: false,
      internalReason: null,
    })
    expect(JSON.stringify(piiPartner)).not.toContain('Mohammed')
    expect(piiPartner.partnerRef).toMatch(/^partner#777:[0-9a-f]{10}$/)

    const liveSummary = loadLiveTodaySummary()
    const todayBkt = liveSummary.buckets!.today!
    const nonZeroBranchEntries = Object.entries(todayBkt.byLocation ?? {}).filter(([, v]) => v.netKwd > 0)
    const [firstBranchEntry, secondBranchEntry] = nonZeroBranchEntries
    expect(firstBranchEntry).toBeDefined()
    expect(secondBranchEntry).toBeDefined()

    const realAmtA = firstBranchEntry![1].netKwd
    const realAmtB = secondBranchEntry![1].netKwd

    const audit = classifyQurainAuditOrders({
      qurainOrders: [
        {
          id: 50001,
          name: 'QRN/0001',
          pos_reference: 'Order 00001-001-0001',
          partner_id: [777, 'Mohammed Al-Customer Personal Name'],
          amount_total: realAmtA,
          amount_tax: 0,
          date_order: '2026-11-17 09:30:00',
          config_id: [90, 'Qurain CK Counter'],
          methods: ['KNET'],
          products: ['Family Box'],
        },
        {
          id: 50002,
          name: 'QRN/0002',
          pos_reference: 'Order 00001-001-0002',
          partner_id: [888, 'FAS Fahaheel School'],
          amount_total: realAmtB,
          amount_tax: 0,
          date_order: '2026-11-17 10:00:00',
          config_id: [90, 'Qurain CK Counter'],
          methods: ['Cash'],
          products: ['Canteen Tray'],
        },
        {
          id: 50003,
          name: 'QRN/0003',
          pos_reference: 'DUP-REF-1',
          partner_id: false,
          amount_total: realAmtB,
          amount_tax: 0,
          date_order: '2026-11-17 11:00:00',
          config_id: [90, 'Qurain CK Counter'],
          methods: ['KNET'],
          products: ['Meal'],
        },
      ],
      otherCompanyOrders: [
        {
          id: 60001,
          pos_reference: 'DUP-REF-1',
          partner_id: false,
          amount_total: realAmtB,
          amount_tax: 0,
          date_order: '2026-11-17 11:02:00',
          config_id: [8, 'Promenade'],
        },
      ],
      internalPartnerById: new Map([[888, 'named like one of our sites']]),
      partnerMetaById: new Map([
        [777, { isCompany: false, rawName: 'Mohammed Al-Customer Personal Name' }],
        [888, { isCompany: true, rawName: 'FAS Fahaheel School' }],
      ]),
    })

    expect(JSON.stringify(audit)).not.toContain('Mohammed')
    expect(audit.customer.orderIds).toEqual([50001])
    expect(audit.customer.byDay['2026-11-17']?.orders).toBe(1)
    expect(audit.customer.byConfig['90']?.orders).toBe(1)
    expect(audit.summary.internalPartner.orders).toBe(1)
    expect(audit.summary.duplicate.orders).toBe(1)
    expect(audit.integrity.hasDuplicateOrderIds).toBe(false)
    expect(audit.integrity.overlappingOrderIdsWithBranches).toEqual([])
    expect(audit.companyComparison.otherBranchesNetFils + audit.companyComparison.qurainCustomerNetFils).toBe(
      audit.companyComparison.candidateHeadlineNetFils,
    )
    expect([24, 25, 39, 40].every((id) => isExcludedRecordId('pos_config', id))).toBe(true)
  })
})
