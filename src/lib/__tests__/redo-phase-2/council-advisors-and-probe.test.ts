/**
 * Phase 2 · Items 2.1 (`F2` — Live Model Probe), 2.2 (`F3` — Delivery Advisor & Hourly Carry-Forward),
 * and 2.3 (`F4` HR Advisor & `F5` Inventory Advisor + Prod Dump Removal).
 *
 * HARD OWNER RULE:
 *   Zero hand-typed KWD values in test fixtures. Every monetary / sales / stock / shift input is
 *   derived strictly from real cached repo data (`loadLiveTodaySummary()` in
 *   `dashboard-today-2026-11-17.json`, `venturefoods_odoo_cids1_dump.json` in tests only, and
 *   `pos-registry.json`) using integer-fils arithmetic (`toFils` / `fromFils`).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { bustOdooLiveCache } from '@/lib/odoo-live-connector'
import type { OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'
import { deliveryAdvisor, detectPauses, DIRECT_CHANNELS, PLATFORM_CHANNELS, type AggregatorHourlyCell, type AggregatorHourlyMatrix } from '@/lib/council/advisors/delivery'
import { hrAdvisor } from '@/lib/council/advisors/hr'
import { inventoryAdvisor, LOCATION_BRANCH } from '@/lib/council/advisors/inventory'
import { fromFils, shiftIso, toFils, weekdayOf } from '@/lib/council/helpers'
import { runCouncil } from '@/lib/council/runner'
import { completedDailyByBranch } from '@/lib/council/series'
import { attendanceInputFrom, classifyMatrixPaymentChannel, resolveWorkLocationBranchId } from '@/lib/council/sources'
import { untracedNumbers } from '@/lib/council/trace'
import type { CouncilSnapshot } from '@/lib/council/types'
import {
  fetchAggregatorHourlyMatrix,
  fetchAttendanceInput,
  fetchBomUsageInput,
  fetchQurainTransferInput,
  PROBED_MODELS,
  probeOdooModels,
} from '@/server/council/odoo-reads'
import { askFeryalOdooAgent, resetFeryalAuditCache } from '@/lib/feryal-odoo-agent'
import { createRealPayloadDataSource, REAL_SYNC_NOW_MS } from '../council/feryal-real-source'
import { mergeHourlyCarryForwardReports, resolveHasBomsFromProbe } from '@/server/council/service'
import { listLocalOdooDumpSummary } from '@/services/odoo-live-extractor.service'
import { loadLiveTodaySummary, loadOdooExport, realInventoryInput } from '../council/support'
import {
  ALLOWED_ODOO_METHODS,
  assertReadOnlyOdooMethod,
  buildCachedBaselineProbeReport,
  PROBED_MODEL_SPECS,
  renderModelProbeMarkdown,
} from '../../../../scripts/probe-odoo-models.mjs'

const ROOT = process.cwd()
const ODOO_ENV_KEYS = ['ODOO_URL', 'ODOO_DB', 'ODOO_USERNAME', 'ODOO_LOGIN', 'ODOO_API_KEY'] as const

interface SeedProductTemplate {
  id: number
  name: string
  default_code: string | false
  list_price: number
}

interface SeedQuant {
  id: number
  product_id: [number, string]
  location_id: [number, string]
  quantity: number
}

function loadFullSeedModels() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/seeds/venturefoods_odoo_cids1_dump.json'), 'utf8')) as {
    exportedAt: string
    models: {
      'hr.attendance': { id: number; employee_id: [number, string]; check_in: string; check_out: string | false }[]
      'hr.employee': { id: number; name: string; department_id: [number, string] | false; work_location_id?: [number, string] | false }[]
      'stock.quant': SeedQuant[]
      'product.template': SeedProductTemplate[]
    }
  }
  return raw
}

/**
 * Derives a real 5-week (35-day) branch × hour × channel matrix strictly from `loadLiveTodaySummary()`
 * (`dailyByBranch` + `buckets.month.byLocation[b].uiChannels` + `hourlySeries`) using integer-fils math.
 */
function buildRealDerivedFiveWeekMatrix(opts: {
  pauseSpec: { branchId: string; channel: (typeof PLATFORM_CHANNELS)[number]; pauseHours: number[]; pauseDay: string }[]
  zeroDirectSpec?: { branchId: string; channel: (typeof PLATFORM_CHANNELS)[number]; hour: number; day: string }
}): {
  matrix: AggregatorHourlyMatrix
  expectedLostFilsByKey: Map<string, number>
} {
  const summary = loadLiveTodaySummary()
  const series = completedDailyByBranch(summary)!
  const lastDay = series.days[series.days.length - 1]! // 2026-11-16
  const startDay = shiftIso(lastDay, -34) // 35 completed days (5 full weeks)
  const windowDays = series.days.filter((d) => d >= startDay && d <= lastDay)

  const monthByLoc = summary.buckets?.month?.byLocation ?? {}
  const activeHours = [13, 19, 21]
  const targetBranches = ['assima', 'salmiya', 'promenade'] as const
  const channels = ['dine-in', 'takeaway-direct', ...PLATFORM_CHANNELS] as const

  const pauseLookup = new Set<string>()
  for (const p of opts.pauseSpec) {
    for (const h of p.pauseHours) {
      pauseLookup.add(`${p.pauseDay}|${h}|${p.branchId}|${p.channel}`)
    }
  }

  const cellMap = new Map<string, AggregatorHourlyCell>()
  for (const day of windowDays) {
    for (const branchId of targetBranches) {
      const dayBranch = series.byDay[day]?.[branchId]
      if (!dayBranch || dayBranch.netFils <= 0 || dayBranch.orders <= 0) continue

      const uiCh = monthByLoc[branchId]?.uiChannels ?? {}
      const totalMonthChFils = channels.reduce((s, ch) => s + toFils(uiCh[ch]?.netKwd ?? 0), 0)
      const totalMonthChOrders = channels.reduce((s, ch) => s + (uiCh[ch]?.orders ?? 0), 0)

      for (let hIdx = 0; hIdx < activeHours.length; hIdx++) {
        const hour = activeHours[hIdx]!
        // Split day total across the 3 peak hours deterministically in integer fils
        const hourNetFils = Math.floor(dayBranch.netFils / activeHours.length)
        const hourOrders = Math.max(channels.length, Math.floor(dayBranch.orders / activeHours.length))

        for (const ch of channels) {
          const chShareFils =
            totalMonthChFils > 0
              ? Math.max(1, Math.round((hourNetFils * toFils(uiCh[ch]?.netKwd ?? 0)) / totalMonthChFils))
              : Math.max(1, Math.floor(hourNetFils / channels.length))
          const chShareOrders =
            totalMonthChOrders > 0
              ? Math.max(1, Math.round((hourOrders * (uiCh[ch]?.orders ?? 0)) / totalMonthChOrders))
              : 1

          const k = `${day}|${hour}|${branchId}|${ch}`
          const isZeroDirectHour =
            opts.zeroDirectSpec &&
            opts.zeroDirectSpec.day === day &&
            opts.zeroDirectSpec.hour === hour &&
            opts.zeroDirectSpec.branchId === branchId

          if (pauseLookup.has(k)) {
            cellMap.set(k, { day, hour, branchId, channel: ch, orders: 0, netKwd: 0 })
          } else if (isZeroDirectHour && (DIRECT_CHANNELS.has(ch) || ch === opts.zeroDirectSpec!.channel)) {
            cellMap.set(k, { day, hour, branchId, channel: ch, orders: 0, netKwd: 0 })
          } else {
            cellMap.set(k, {
              day,
              hour,
              branchId,
              channel: ch,
              orders: chShareOrders,
              netKwd: fromFils(chShareFils),
            })
          }
        }
      }
    }
  }

  // Compute exact expected lost fils from the prior 4 weeks of the same weekday-hour
  const expectedLostFilsByKey = new Map<string, number>()
  for (const p of opts.pauseSpec) {
    let sumFils = 0
    for (const h of p.pauseHours) {
      const histFils = [1, 2, 3, 4]
        .map((w) => cellMap.get(`${shiftIso(p.pauseDay, -7 * w)}|${h}|${p.branchId}|${p.channel}`)?.netKwd ?? 0)
        .map((v) => toFils(v))
        .sort((a, b) => a - b)
      const medFils = Math.round((histFils[1]! + histFils[2]!) / 2)
      sumFils += medFils
    }
    expectedLostFilsByKey.set(`${p.branchId}|${p.channel}`, sumFils)
  }

  return {
    matrix: {
      rows: [...cellMap.values()],
      period: { from: startDay, to: lastDay },
      syncAt: summary.lastSyncAt ?? null,
    },
    expectedLostFilsByKey,
  }
}

describe('Phase 2 · Council Advisors & Live Model Probe (F2, F3, F4, F5)', () => {
  const savedEnv: Partial<Record<(typeof ODOO_ENV_KEYS)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const k of ODOO_ENV_KEYS) savedEnv[k] = process.env[k]
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

  it('self-audit: zero hand-typed KWD decimal literals in this test file', () => {
    const selfSrc = fs.readFileSync(path.join(ROOT, 'src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts'), 'utf8')
    const noComments = selfSrc.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    expect(noComments).not.toMatch(/\b\d+\.\d{3}\b/)
  })

  describe('2.1 Live Model Probe (F2) — probeOdooModels, CLI & >30d mrp.bom fix', () => {
    it('probes all 8 required models with fields_get, totalCount, recentCount, dateSpan, branchCoveragePct & read-only RPCs only', async () => {
      expect([...PROBED_MODELS]).toEqual([
        'hr.attendance',
        'hr.employee',
        'stock.move',
        'stock.scrap',
        'stock.quant',
        'mrp.bom',
        'mrp.bom.line',
        'pos.payment',
      ])
      expect(PROBED_MODEL_SPECS.map((s: { model: string }) => s.model)).toEqual([...PROBED_MODELS])

      process.env.ODOO_URL = 'https://localhost:8069'
      process.env.ODOO_DB = 'vf_probe_test'
      process.env.ODOO_USERNAME = 'bi@example.com'
      process.env.ODOO_API_KEY = 'probe_key'

      const seed = loadFullSeedModels()
      const realAtt = seed.models['hr.attendance']
      const realEmp = seed.models['hr.employee']
      const realQuants = seed.models['stock.quant']
      const internalQuantCount = realQuants.filter(
        (q) => !q.location_id[1].startsWith('Partners/') && !q.location_id[1].startsWith('Virtual Locations/'),
      ).length

      const calledMethods = new Set<string>()

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
        const callArgs = (args[5] as unknown[]) ?? []
        calledMethods.add(method)
        assertReadOnlyOdooMethod(method)

        if (model === 'ir.model' && method === 'search_read') {
          return reply(PROBED_MODELS.map((m) => ({ model: m })))
        }

        if (method === 'fields_get') {
          const fieldsByModel: Record<string, Record<string, { type: string }>> = {
            'hr.attendance': { employee_id: { type: 'many2one' }, check_in: { type: 'datetime' }, check_out: { type: 'datetime' }, create_date: { type: 'datetime' } },
            'hr.employee': { active: { type: 'boolean' }, department_id: { type: 'many2one' }, work_location_id: { type: 'many2one' }, company_id: { type: 'many2one' }, create_date: { type: 'datetime' } },
            'stock.move': { product_id: { type: 'many2one' }, location_id: { type: 'many2one' }, location_dest_id: { type: 'many2one' }, quantity: { type: 'float' }, state: { type: 'selection' }, date: { type: 'datetime' }, create_date: { type: 'datetime' } },
            'stock.scrap': { product_id: { type: 'many2one' }, location_id: { type: 'many2one' }, scrap_qty: { type: 'float' }, state: { type: 'selection' }, date_done: { type: 'datetime' }, create_date: { type: 'datetime' } },
            'stock.quant': { product_id: { type: 'many2one' }, location_id: { type: 'many2one' }, quantity: { type: 'float' }, in_date: { type: 'datetime' }, create_date: { type: 'datetime' } },
            'mrp.bom': { product_tmpl_id: { type: 'many2one' }, product_id: { type: 'many2one' }, product_qty: { type: 'float' }, active: { type: 'boolean' }, bom_line_ids: { type: 'one2many' }, create_date: { type: 'datetime' } },
            'mrp.bom.line': { bom_id: { type: 'many2one' }, product_id: { type: 'many2one' }, product_qty: { type: 'float' }, product_uom_id: { type: 'many2one' }, create_date: { type: 'datetime' } },
            'pos.payment': { pos_order_id: { type: 'many2one' }, session_id: { type: 'many2one' }, payment_method_id: { type: 'many2one' }, amount: { type: 'monetary' }, payment_date: { type: 'datetime' }, create_date: { type: 'datetime' } },
          }
          return reply(fieldsByModel[model] ?? {})
        }

        if (method === 'search_count') {
          const domain = (callArgs[0] as unknown[]) ?? []
          const domStr = JSON.stringify(domain)
          if (model === 'hr.attendance') {
            if (domStr.includes('work_location_id')) return reply(0)
            return reply(realAtt.length)
          }
          if (model === 'hr.employee') {
            if (domStr.includes('work_location_id')) return reply(0)
            if (domStr.includes('department_id')) return reply(realEmp.filter((e) => Array.isArray(e.department_id)).length)
            return reply(realEmp.length)
          }
          if (model === 'stock.quant') {
            if (domStr.includes('internal')) return reply(internalQuantCount)
            return reply(realQuants.length)
          }
          if (model === 'mrp.bom') {
            // Simulate BoMs created >30 days ago: totalCount = 12, recentCount (30d create_date) = 0!
            if (domStr.includes('>=')) return reply(0)
            return reply(12)
          }
          if (model === 'mrp.bom.line') {
            if (domStr.includes('>=')) return reply(0)
            return reply(48)
          }
          if (model === 'pos.payment') {
            return reply(2500)
          }
          return reply(120)
        }

        if (method === 'search_read') {
          const kwargs = (args[6] as { order?: string }) ?? {}
          const isAsc = kwargs.order?.includes('asc')
          if (model === 'hr.attendance') {
            return reply([{ check_in: isAsc ? '2026-10-20 13:09:18' : '2026-10-31 06:57:02' }])
          }
          if (model === 'pos.payment') {
            return reply([{ payment_date: isAsc ? '2026-09-14 08:00:00' : '2026-11-17 02:55:00' }])
          }
          if (model === 'mrp.bom') {
            return reply([{ create_date: isAsc ? '2026-05-01 09:00:00' : '2026-06-15 14:00:00' }])
          }
          return reply([{ date: '2026-11-01 08:00:00', date_done: '2026-11-01 08:00:00', in_date: '2026-10-01 08:00:00', create_date: '2026-01-15 10:00:00' }])
        }

        if (model === 'pos.payment' && method === 'read_group') {
          return reply([
            {
              session_id: [501, 'POS/00501'],
              payment_method_id: [3, 'Talabat Go'],
              amount: 10,
              __count: 2,
              __range: { 'payment_date:hour': { from: '2026-11-16 16:00:00', to: '2026-11-16 17:00:00' } },
            },
          ])
        }
        if (model === 'pos.session' && method === 'read') {
          return reply([{ id: 501, config_id: [14, 'Assima POS'] }])
        }

        return reply([])
      })

      const probe = await probeOdooModels(Date.parse('2026-11-17T06:00:00Z'))
      expect(probe).not.toBeNull()
      expect(probe!.rows.map((r) => r.model)).toEqual([...PROBED_MODELS])

      for (const m of calledMethods) {
        expect(ALLOWED_ODOO_METHODS.has(m), m).toBe(true)
      }

      const bomRow = probe!.rows.find((r) => r.model === 'mrp.bom')!
      expect(bomRow.installed).toBe(true)
      expect(bomRow.totalCount).toBe(12)
      expect(bomRow.recentCount).toBe(0)
      // Bug fix check: BoMs created >30 days ago (totalCount=12, recentCount=0) MUST resolve to hasBoms=true!
      expect(resolveHasBomsFromProbe(probe)).toBe(true)

      const empRow = probe!.rows.find((r) => r.model === 'hr.employee')!
      expect(empRow.totalCount).toBe(realEmp.length)
      expect(empRow.branchCoveragePct).toBe(0)
      expect(empRow.departmentCoveragePct).toBeCloseTo(95.8, 1)

      const quantRow = probe!.rows.find((r) => r.model === 'stock.quant')!
      expect(quantRow.totalCount).toBe(realQuants.length)
      expect(quantRow.branchCoveragePct).toBeCloseTo(54.5, 1)

      const payRow = probe!.rows.find((r) => r.model === 'pos.payment')!
      expect(payRow.supportsConfigHourMethodGroup).toBe(true)
      expect(payRow.dateSpan).toEqual({
        field: 'payment_date',
        min: '2026-09-14 08:00:00',
        max: '2026-11-17 02:55:00',
      })
    })

    it('standalone CLI scripts/probe-odoo-models.mjs exits 0 when .env.local is absent and docs/redo/odoo-model-probe.md carries verified baseline facts', () => {
      expect(() => assertReadOnlyOdooMethod('write')).toThrow(/Security violation/)
      expect(() => assertReadOnlyOdooMethod('unlink')).toThrow(/Security violation/)
      expect(() => assertReadOnlyOdooMethod('create')).toThrow(/Security violation/)

      const cleanEnv = { ...process.env }
      for (const k of ODOO_ENV_KEYS) delete cleanEnv[k]
      delete cleanEnv.ODOO_PASSWORD

      const stdout = execFileSync(process.execPath, [path.join(ROOT, 'scripts/probe-odoo-models.mjs')], {
        cwd: ROOT,
        env: cleanEnv,
        encoding: 'utf8',
      })
      expect(stdout).toContain('.env.local')
      expect(stdout).toContain('ODOO_URL')

      const baseline = buildCachedBaselineProbeReport({ rootDir: ROOT })
      const rendered = renderModelProbeMarkdown(baseline)
      expect(rendered).toContain('غير متاح — بانتظار تشغيل فحص المالك على Mac')

      const docPath = path.join(ROOT, 'docs/redo/odoo-model-probe.md')
      expect(fs.existsSync(docPath)).toBe(true)
      const docContent = fs.readFileSync(docPath, 'utf8')
      expect(docContent).toContain('غير متاح — بانتظار تشغيل فحص المالك على Mac')
      for (const m of PROBED_MODELS) {
        expect(docContent).toContain(`\`${m}\``)
      }
      // Verified counts from real cached Oct 31 export (1,000 cap on attendance/quant, 166 employees)
      expect(docContent).toContain('166')
      expect(docContent).toContain('1,000')
    })
  })

  describe('2.2 Delivery Advisor (F3) — Direct Sales vs TGO/TMP/Keeta Pauses & Hourly Cron Carry-Forward', () => {
    it('maps direct in-branch payment methods distinctly from TGO, TMP, Keeta, and other aggregators in fetchAggregatorHourlyMatrix', async () => {
      expect(classifyMatrixPaymentChannel('Cash')).toBe('dine-in')
      expect(classifyMatrixPaymentChannel('KNET')).toBe('dine-in')
      expect(classifyMatrixPaymentChannel('Visa / MasterCard')).toBe('dine-in')
      expect(classifyMatrixPaymentChannel('Cash on delivery')).toBe('takeaway-direct')
      expect(classifyMatrixPaymentChannel('Hesabe Payment Link')).toBe('takeaway-direct')
      expect(classifyMatrixPaymentChannel('Cash', true)).toBe('takeaway-direct')
      expect(classifyMatrixPaymentChannel('Talabat Go')).toBe('talabat-tgo')
      expect(classifyMatrixPaymentChannel('Talabat MP')).toBe('talabat-tmp')
      expect(classifyMatrixPaymentChannel('Keeta')).toBe('keeta')
      expect(classifyMatrixPaymentChannel('Deliveroo Go')).toBe('deliveroo')
      expect(classifyMatrixPaymentChannel('Staff Meal')).toBe('staff')

      process.env.ODOO_URL = 'https://localhost:8069'
      process.env.ODOO_DB = 'vf_matrix_test'
      process.env.ODOO_USERNAME = 'bi@example.com'
      process.env.ODOO_API_KEY = 'matrix_key'

      const summary = loadLiveTodaySummary()
      const series = completedDailyByBranch(summary)!
      const sampleDay = series.days[series.days.length - 1]!
      const assimaDay = series.byDay[sampleDay]!.assima!
      const halfFils = Math.floor(assimaDay.netFils / 2)
      const restFils = assimaDay.netFils - halfFils

      const assimaCfgId = Number(
        Object.entries(posRegistry.registers).find(([, v]) => v.location === 'assima')![0],
      )
      const branchOfConfig = new Map<number, string>([[assimaCfgId, 'assima']])

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
        if (body.params?.service === 'common') return reply(7)
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        if (model === 'pos.payment' && method === 'read_group') {
          return reply([
            {
              session_id: [701, 'POS/00701'],
              payment_method_id: [1, 'KNET'],
              amount: fromFils(halfFils),
              __count: Math.max(1, Math.floor(assimaDay.orders / 2)),
              __range: { 'payment_date:hour': { from: `${sampleDay} 16:00:00`, to: `${sampleDay} 17:00:00` } },
            },
            {
              session_id: [701, 'POS/00701'],
              payment_method_id: [2, 'Talabat Go'],
              amount: fromFils(restFils),
              __count: Math.max(1, assimaDay.orders - Math.floor(assimaDay.orders / 2)),
              __range: { 'payment_date:hour': { from: `${sampleDay} 16:00:00`, to: `${sampleDay} 17:00:00` } },
            },
          ])
        }
        if (model === 'pos.session' && method === 'read') {
          return reply([{ id: 701, config_id: [assimaCfgId, 'Assima POS'] }])
        }
        return reply([])
      })

      const m = await fetchAggregatorHourlyMatrix(sampleDay, sampleDay, branchOfConfig, summary.lastSyncAt ?? null)
      expect(m).not.toBeNull()
      // 16:00 UTC = 19:00 Asia/Kuwait
      const dineInCell = m!.rows.find((r) => r.channel === 'dine-in' && r.hour === 19)
      const tgoCell = m!.rows.find((r) => r.channel === 'talabat-tgo' && r.hour === 19)
      expect(dineInCell).toBeDefined()
      expect(tgoCell).toBeDefined()
      expect(toFils(dineInCell!.netKwd) + toFils(tgoCell!.netKwd)).toBe(assimaDay.netFils)
    })

    it('detects pauses split by TGO vs TMP vs Keeta ONLY when direct in-branch sales > 0, with labelled Estimate + formula + inputs & zero untraced numbers', () => {
      const summary = loadLiveTodaySummary()
      const series = completedDailyByBranch(summary)!
      const pauseDay = series.days[series.days.length - 1]! // 2026-11-16 (Monday)

      const { matrix, expectedLostFilsByKey } = buildRealDerivedFiveWeekMatrix({
        pauseSpec: [
          { branchId: 'assima', channel: 'talabat-tgo', pauseHours: [19, 21], pauseDay },
          { branchId: 'assima', channel: 'talabat-tmp', pauseHours: [19], pauseDay },
          { branchId: 'salmiya', channel: 'keeta', pauseHours: [21], pauseDay },
        ],
        // At promenade 13:00 on pauseDay, direct in-branch sales are 0 while keeta > 0 and talabat-tgo = 0:
        // must NOT be flagged as a platform pause because directOrders == 0!
        zeroDirectSpec: { branchId: 'promenade', channel: 'talabat-tgo', hour: 13, day: pauseDay },
      })

      const pauses = detectPauses(matrix, 4)
      expect(pauses.some((p) => p.branchId === 'promenade')).toBe(false)
      expect(pauses.filter((p) => p.branchId === 'assima' && p.channel === 'talabat-tgo')).toHaveLength(2)
      expect(pauses.filter((p) => p.branchId === 'assima' && p.channel === 'talabat-tmp')).toHaveLength(1)
      expect(pauses.filter((p) => p.branchId === 'salmiya' && p.channel === 'keeta')).toHaveLength(1)

      const report = deliveryAdvisor.run({ matrix, historyWeeks: 4 })
      expect(untracedNumbers(report)).toEqual([])

      const fingerprints = report.findings.map((f) => f.fingerprint).sort()
      expect(fingerprints).toEqual([
        'delivery:pause:assima:talabat-tgo',
        'delivery:pause:assima:talabat-tmp',
        'delivery:pause:salmiya:keeta',
      ])

      for (const f of report.findings) {
        expect(f.kind).toBe('platform-pause')
        expect(f.entities.branchId).toBeDefined()
        expect(f.entities.channel).toBeDefined()
        expect(Number.isInteger(f.entities.hour)).toBe(true)
        expect(f.entities.weekday).toBe(weekdayOf(pauseDay))

        expect(f.weeklyImpact).not.toBeNull()
        expect(f.weeklyImpact!.label).toBe('Estimate')
        expect(f.weeklyImpact!.unit).toBe('KWD')
        expect(f.weeklyImpact!.formula.length).toBeGreaterThan(10)
        const expectedLostFils = expectedLostFilsByKey.get(`${f.entities.branchId}|${f.entities.channel}`)!
        expect(toFils(f.weeklyImpact!.inputs.lostKwd)).toBe(expectedLostFils)
      }
    })

    it('carries forward nightly delivery platform-pause findings on hourly runs instead of wiping them when matrix is null', () => {
      const summary = loadLiveTodaySummary()
      const series = completedDailyByBranch(summary)!
      const pauseDay = series.days[series.days.length - 1]!
      const { matrix } = buildRealDerivedFiveWeekMatrix({
        pauseSpec: [{ branchId: 'assima', channel: 'talabat-tgo', pauseHours: [19], pauseDay }],
      })

      const nightlySnap: CouncilSnapshot = runCouncil({
        cfo: { summary },
        delivery: { matrix },
        inventory: realInventoryInput(),
      })
      expect(
        nightlySnap.reports.find((r) => r.advisorId === 'delivery')!.findings.some((f) => f.kind === 'platform-pause'),
      ).toBe(true)

      // Hourly run executes without matrix / hr / inventory
      const freshHourly = runCouncil({
        cfo: { summary },
        delivery: { matrix: null },
      })
      expect(freshHourly.reports.find((r) => r.advisorId === 'delivery')!.findings).toHaveLength(0)

      const merged = mergeHourlyCarryForwardReports(freshHourly.reports, nightlySnap, new Set())
      const mergedDelivery = merged.reports.find((r) => r.advisorId === 'delivery')!
      expect(mergedDelivery.findings.map((f) => f.fingerprint)).toContain('delivery:pause:assima:talabat-tgo')
      expect(merged.reports.find((r) => r.advisorId === 'inventory')!.findings.length).toBeGreaterThan(0)
      // Cross-advisor discovery link: both CFO (wow-divergence) and Delivery (platform-pause) point to `assima`!
      const assimaDisc = merged.discoveries.find((d) => d.finding.entities.branchId === 'assima')
      expect(assimaDisc).toBeDefined()
    })
  })

  describe('2.3 HR Advisor (F4) — work_location_id mapping, employee name stripping & precise dataGap', () => {
    it('reads work_location_id safely via fields_get, maps work locations to branchId, strips employee names, and emits hr.employee.work_location_id dataGap when unlinked', async () => {
      const dump = loadOdooExport()
      // 1) Raw Oct 31 export has no work_location_id -> precise dataGap naming hr.employee.work_location_id
      const noBranchAtt = attendanceInputFrom(dump.models['hr.attendance'], dump.models['hr.employee'], {
        syncAt: dump.exportedAt,
        rowLimit: 1000,
      })
      const rNoBranch = hrAdvisor.run({ attendance: noBranchAtt })
      expect(untracedNumbers(rNoBranch)).toEqual([])
      const branchGap = rNoBranch.dataGaps.find((g) => g.odooModel === 'hr.employee (work_location_id)')
      expect(branchGap).toBeDefined()
      expect(`${branchGap!.missingEn} ${branchGap!.recordEn}`).toContain('hr.employee.work_location_id')

      // 2) Map real work location labels from pos-registry.json -> branchId, stripping employee names
      expect(resolveWorkLocationBranchId(posRegistry.locations.promenade.en)).toBe('promenade')
      expect(resolveWorkLocationBranchId(posRegistry.locations.assima.ar)).toBe('assima')
      expect(resolveWorkLocationBranchId('NPIS Hawally Canteen')).toBe('school-canteens')
      expect(resolveWorkLocationBranchId('QRN/Central Kitchen')).toBe('qurain')
      expect(resolveWorkLocationBranchId('Jahra Closed Branch')).toBeNull()

      process.env.ODOO_URL = 'https://localhost:8069'
      process.env.ODOO_DB = 'vf_hr_test'
      process.env.ODOO_USERNAME = 'bi@example.com'
      process.env.ODOO_API_KEY = 'hr_key'

      const sampleAtt = dump.models['hr.attendance'].slice(0, 80)
      const empIds = new Set(sampleAtt.map((a) => (Array.isArray(a.employee_id) ? a.employee_id[0] : -1)))
      const sampleEmpsWithLoc = dump.models['hr.employee']
        .filter((e) => empIds.has(e.id))
        .map((e, idx) => ({
          ...e,
          work_location_id: [
            idx % 2 === 0 ? 39 : 40,
            idx % 2 === 0 ? posRegistry.locations.promenade.en : posRegistry.locations.assima.ar,
          ] as [number, string],
        }))

      let requestedEmpFields: string[] = []
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
        if (body.params?.service === 'common') return reply(7)
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        const callArgs = (args[5] as unknown[]) ?? []
        if (model === 'hr.attendance' && method === 'search_read') return reply(sampleAtt)
        if (model === 'hr.employee' && method === 'fields_get') {
          return reply({ department_id: { type: 'many2one' }, work_location_id: { type: 'many2one' } })
        }
        if (model === 'hr.employee' && method === 'read') {
          requestedEmpFields = (callArgs[1] as string[]) ?? []
          return reply(sampleEmpsWithLoc)
        }
        return reply([])
      })

      const liveAtt = await fetchAttendanceInput('2026-10-20', '2026-10-31')
      expect(requestedEmpFields).toContain('work_location_id')
      expect(requestedEmpFields).toContain('department_id')
      expect(requestedEmpFields).not.toContain('name')
      expect(liveAtt).not.toBeNull()
      expect(liveAtt!.rows.some((r) => r.branchId === 'promenade')).toBe(true)
      expect(liveAtt!.rows.some((r) => r.branchId === 'assima')).toBe(true)

      const rLinked = hrAdvisor.run({
        attendance: liveAtt,
        probe: {
          probedAt: '2026-11-17T06:00:00.000Z',
          rows: [
            {
              model: 'hr.employee',
              installed: true,
              readable: true,
              totalCount: sampleEmpsWithLoc.length,
              recentCount: 0,
              presentFields: ['department_id', 'work_location_id'],
              missingFields: [],
              dateSpan: null,
              branchCoveragePct: 100,
            },
          ],
        },
      })
      expect(untracedNumbers(rLinked)).toEqual([])
      // All rows linked -> no missing work_location_id gap!
      expect(rLinked.dataGaps.some((g) => g.odooModel === 'hr.employee (work_location_id)')).toBe(false)
      // Zero employee names leak
      const rawNames = dump.models['hr.employee']
        .map((e) => (e as unknown as { name?: string }).name)
        .filter((n): n is string => Boolean(n && n.length > 5))
      const serialized = JSON.stringify(rLinked)
      for (const nm of rawNames) {
        expect(serialized.includes(nm)).toBe(false)
      }
    })
  })

  describe('2.3 Inventory Advisor (F5) — Qurain transfers vs receipts, mrp.bom theoretical usage & prod dump removal', () => {
    it('compares Qurain (QRN/Stock / القرين) outbound transfers vs branch receipts and emits stock.move dataGap when transfer lines are absent', async () => {
      expect(LOCATION_BRANCH.QRN).toBe('qurain')

      const seed = loadFullSeedModels()
      const qrnQuants = seed.models['stock.quant'].filter((q) => q.location_id[1] === 'QRN/Stock' && q.quantity > 0)
      const templates = seed.models['product.template'].filter((t) => t.list_price > 0)
      const sampleQuantA = qrnQuants[0]!
      const sampleQuantB = qrnQuants[1]!
      const unitCostFilsA = toFils(templates[0]!.list_price)
      const unitCostFilsB = toFils(templates[1]!.list_price)

      const dispatchedQtyA = Math.max(2, Math.round(sampleQuantA.quantity))
      const receivedQtyA = Math.max(1, Math.floor(dispatchedQtyA / 2))
      const pendingQtyA = dispatchedQtyA - receivedQtyA
      const dispatchedQtyB = Math.max(1, Math.round(sampleQuantB.quantity))

      process.env.ODOO_URL = 'https://localhost:8069'
      process.env.ODOO_DB = 'vf_inv_test'
      process.env.ODOO_USERNAME = 'bi@example.com'
      process.env.ODOO_API_KEY = 'inv_key'

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
        if (body.params?.service === 'common') return reply(7)
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        if (model === 'stock.move' && method === 'fields_get') {
          return reply({
            product_id: { type: 'many2one' },
            location_id: { type: 'many2one' },
            location_dest_id: { type: 'many2one' },
            quantity: { type: 'float' },
            state: { type: 'selection' },
            date: { type: 'datetime' },
          })
        }
        if (model === 'stock.move' && method === 'search_read') {
          return reply([
            {
              id: 1,
              product_id: sampleQuantA.product_id,
              location_id: [259, 'QRN/Stock'],
              location_dest_id: [251, 'PRM/Stock'],
              quantity: receivedQtyA,
              state: 'done',
              date: '2026-11-15 07:00:00',
            },
            {
              id: 2,
              product_id: sampleQuantA.product_id,
              location_id: [259, 'QRN/Stock'],
              location_dest_id: [251, 'PRM/Stock'],
              quantity: pendingQtyA,
              state: 'assigned',
              date: '2026-11-16 08:00:00',
            },
            {
              id: 3,
              product_id: sampleQuantB.product_id,
              location_id: [259, 'القرين/المخزن'],
              location_dest_id: [219, '360/Stock'],
              quantity: dispatchedQtyB,
              state: 'done',
              date: '2026-11-16 09:00:00',
            },
          ])
        }
        if (model === 'product.product' && method === 'read') {
          return reply([
            { id: sampleQuantA.product_id[0], standard_price: fromFils(unitCostFilsA) },
            { id: sampleQuantB.product_id[0], standard_price: fromFils(unitCostFilsB) },
          ])
        }
        return reply([])
      })

      const qurainTransfers = await fetchQurainTransferInput('2026-11-10', '2026-11-16')
      expect(qurainTransfers).not.toBeNull()
      expect(qurainTransfers!.dispatchedQty).toBe(dispatchedQtyA + dispatchedQtyB)
      expect(qurainTransfers!.receivedQty).toBe(receivedQtyA + dispatchedQtyB)
      expect(qurainTransfers!.unreceivedQty).toBe(pendingQtyA)

      const repWithTransfers = inventoryAdvisor.run({
        quants: realInventoryInput().quants,
        qurainTransfers,
        hasBoms: false,
      })
      expect(untracedNumbers(repWithTransfers)).toEqual([])
      const transferFinding = repWithTransfers.findings.find((f) => f.kind === 'qurain-transfer-gap')
      expect(transferFinding).toBeDefined()
      expect(transferFinding!.entities.branchId).toBe('promenade')
      expect(transferFinding!.titleAr).toContain('القرين')
      expect(transferFinding!.evidence.some((e) => e.value === pendingQtyA)).toBe(true)

      // When warehouse is connected with 0 transfer moves and no qurainTransfers -> emits precise stock.move dataGap
      const emptyWh: OdooLiveWarehouseChainPayload = {
        connected: true,
        sourceMode: 'odoo17-live',
        noData: false,
        odooCompanyId: 1,
        lastSyncAt: '2026-11-17T03:00:00.000Z',
        isStale24h: false,
        dateRange: { from: '2026-11-10', to: '2026-11-16' },
        quantHasValueField: false,
        totals: {
          currentOnHandQty: 0,
          currentOnHandValueKwd: 0,
          ckOnHandValueKwd: 0,
          branchesOnHandValueKwd: 0,
          inboundSupplierKwd: 0,
          ckToBranchTransferKwd: 0,
          posConsumptionKwd: 0,
          scrapKwd: 0,
          scrapPctOfConsumption: 0,
          doneMovesCount: 0,
          scrapOrdersCount: 0,
          quantsCount: 0,
        },
        byBranchOnHand: {},
        dailyMoves: [],
        products: [],
        scraps: [],
      }
      const repNoTransfers = inventoryAdvisor.run({
        quants: realInventoryInput().quants,
        warehouse: emptyWh,
        hasBoms: false,
      })
      expect(repNoTransfers.dataGaps.some((g) => g.odooModel === 'stock.move' && /Qurain|QRN/i.test(g.missingEn))).toBe(true)
    })

    it('computes mrp.bom theoretical usage (pos.order.line × mrp.bom.line vs actual) ONLY when hasBoms === true & BoM lines exist, else returns mrp.bom dataGap', () => {
      const seed = loadFullSeedModels()
      const templates = seed.models['product.template'].filter((t) => t.list_price > 0)
      const menuProduct = templates[0]!
      const ingredientProduct = templates[1]!
      const unitCostFils = toFils(ingredientProduct.list_price)
      const ordersCount = loadLiveTodaySummary().buckets?.today?.totals.orders ?? 24

      const bomUsage = {
        period: { from: '2026-11-10', to: '2026-11-16' },
        syncAt: '2026-11-17T03:00:36.564Z',
        bomLines: [
          {
            posProductId: menuProduct.id,
            posProductName: menuProduct.name,
            bomProductQty: 1,
            ingredientProductId: ingredientProduct.id,
            ingredientName: ingredientProduct.name,
            ingredientQty: 2,
            unitCostKwd: fromFils(unitCostFils),
          },
        ],
        posSales: [{ productId: menuProduct.id, qtySold: ordersCount, branchId: 'assima' }],
        // Theoretical = ordersCount * 2; Actual = ordersCount * 3 (50% excess consumption)
        actualConsumption: [
          {
            ingredientProductId: ingredientProduct.id,
            actualQty: ordersCount * 3,
            actualKwd: fromFils(ordersCount * 3 * unitCostFils),
            branchId: 'assima',
          },
        ],
      }

      // 1) When hasBoms is false, bomUsage is ignored and mrp.bom dataGap is returned
      const repNoBom = inventoryAdvisor.run({
        quants: realInventoryInput().quants,
        hasBoms: false,
        bomUsage,
      })
      expect(repNoBom.findings.some((f) => f.kind === 'bom-variance')).toBe(false)
      expect(repNoBom.dataGaps.some((g) => g.odooModel === 'mrp.bom / mrp.bom.line')).toBe(true)

      // 2) When hasBoms === true and bomUsage lines are provided, theoretical vs actual variance is emitted!
      const repWithBom = inventoryAdvisor.run({
        quants: realInventoryInput().quants,
        hasBoms: true,
        bomUsage,
      })
      expect(untracedNumbers(repWithBom)).toEqual([])
      expect(repWithBom.dataGaps.some((g) => g.odooModel === 'mrp.bom / mrp.bom.line')).toBe(false)
      const bomFinding = repWithBom.findings.find((f) => f.kind === 'bom-variance')
      expect(bomFinding).toBeDefined()
      expect(bomFinding!.entities.branchId).toBe('assima')
      expect(bomFinding!.evidence.some((e) => e.value === ordersCount * 2)).toBe(true)
      expect(bomFinding!.evidence.some((e) => e.value === ordersCount * 3)).toBe(true)
    })

    it('drops stale 31 Oct venturefoods_odoo_cids1_dump.json from production odoo-live-extractor.service.ts', () => {
      const extractorSrc = fs.readFileSync(path.join(ROOT, 'src/services/odoo-live-extractor.service.ts'), 'utf8')
      const noComments = extractorSrc.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
      expect(noComments).not.toContain('venturefoods_odoo_cids1_dump.json')

      const summary = listLocalOdooDumpSummary()
      expect(summary.exists).toBe(false)
      expect(summary.counts).toEqual({})
      expect(summary.exportedAt).toBeNull()
    })

    it('fetches mrp.bom + mrp.bom.line + pos.order.line via read-only RPCs in fetchBomUsageInput', async () => {
      process.env.ODOO_URL = 'https://localhost:8069'
      process.env.ODOO_DB = 'vf_bom_rpc_test'
      process.env.ODOO_USERNAME = 'bi@example.com'
      process.env.ODOO_API_KEY = 'bom_key'

      const seed = loadFullSeedModels()
      const templates = seed.models['product.template'].filter((t) => t.list_price > 0)
      const menuTpl = templates[0]!
      const ingTpl = templates[1]!
      const unitCostFils = toFils(ingTpl.list_price)
      const soldQty = loadLiveTodaySummary().buckets?.today?.totals.orders ?? 24

      const assimaCfgId = Number(
        Object.entries(posRegistry.registers).find(([, v]) => v.location === 'assima')![0],
      )
      const branchOfConfig = new Map<number, string>([[assimaCfgId, 'assima']])

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
        if (body.params?.service === 'common') return reply(7)
        const args = body.params?.args ?? []
        const model = String(args[3] ?? '')
        const method = String(args[4] ?? '')
        assertReadOnlyOdooMethod(method)

        if (model === 'mrp.bom' && method === 'search_read') {
          return reply([{ id: 301, product_id: false, product_tmpl_id: [menuTpl.id, menuTpl.name], product_qty: 1 }])
        }
        if (model === 'mrp.bom.line' && method === 'search_read') {
          return reply([{ bom_id: [301, menuTpl.name], product_id: [ingTpl.id, ingTpl.name], product_qty: 2 }])
        }
        if (model === 'product.product' && method === 'search_read') {
          return reply([{ id: menuTpl.id, product_tmpl_id: [menuTpl.id, menuTpl.name] }])
        }
        if (model === 'product.product' && method === 'read') {
          return reply([{ id: ingTpl.id, standard_price: fromFils(unitCostFils) }])
        }
        if (model === 'pos.order.line' && method === 'read_group') {
          return reply([{ product_id: [menuTpl.id, menuTpl.name], qty: soldQty, __count: soldQty }])
        }
        return reply([])
      })

      const wh: OdooLiveWarehouseChainPayload = {
        connected: true,
        sourceMode: 'odoo17-live',
        noData: false,
        odooCompanyId: 1,
        lastSyncAt: '2026-11-17T03:00:36.564Z',
        isStale24h: false,
        dateRange: { from: '2026-11-10', to: '2026-11-16' },
        quantHasValueField: false,
        totals: {
          currentOnHandQty: 0,
          currentOnHandValueKwd: 0,
          ckOnHandValueKwd: 0,
          branchesOnHandValueKwd: 0,
          inboundSupplierKwd: 0,
          ckToBranchTransferKwd: 0,
          posConsumptionKwd: fromFils(soldQty * 3 * unitCostFils),
          scrapKwd: 0,
          scrapPctOfConsumption: 0,
          doneMovesCount: 1,
          scrapOrdersCount: 0,
          quantsCount: 0,
        },
        byBranchOnHand: {},
        dailyMoves: [],
        products: [
          {
            productId: ingTpl.id,
            skuCode: 'ING',
            name: ingTpl.name,
            categoryName: 'Ingredients',
            uomName: 'Unit',
            unitCostKwd: fromFils(unitCostFils),
            onHandQty: 0,
            onHandValueKwd: 0,
            inboundQty: 0,
            inboundValueKwd: 0,
            transferQty: 0,
            transferValueKwd: 0,
            consumedQty: soldQty * 3,
            consumedValueKwd: fromFils(soldQty * 3 * unitCostFils),
            scrapQty: 0,
            scrapValueKwd: 0,
          },
        ],
        scraps: [],
      }

      const bomUsage = await fetchBomUsageInput('2026-11-10', '2026-11-16', branchOfConfig, wh)
      expect(bomUsage).not.toBeNull()
      expect(bomUsage!.bomLines).toHaveLength(1)
      expect(bomUsage!.posSales).toEqual([{ productId: menuTpl.id, qtySold: soldQty }])
      expect(bomUsage!.actualConsumption[0]!.actualQty).toBe(soldQty * 3)
    })
  })

  describe('Cross-Advisor Synthesis & Feryal Eval Q7/Q9 Verification', () => {
    it('answers Eval Q7 («طلبات توقف عندنا وايد، شنو الحل؟») with real pause hours, branch, TGO/TMP/Keeta split, and Estimate formula', async () => {
      resetFeryalAuditCache()
      const summary = loadLiveTodaySummary()
      const series = completedDailyByBranch(summary)!
      const pauseDay = series.days[series.days.length - 1]!
      const { matrix } = buildRealDerivedFiveWeekMatrix({
        pauseSpec: [
          { branchId: 'assima', channel: 'talabat-tgo', pauseHours: [19, 21], pauseDay },
          { branchId: 'salmiya', channel: 'keeta', pauseHours: [21], pauseDay },
        ],
      })

      const council = runCouncil({
        cfo: { summary },
        delivery: { matrix, historyWeeks: 4 },
        inventory: realInventoryInput(),
      })

      const res = await askFeryalOdooAgent({
        question: 'طلبات توقف عندنا وايد، شنو الحل؟',
        userSub: 'redo-p2-q7-pause-eval',
        userRole: 'gm',
        referenceNowMs: REAL_SYNC_NOW_MS,
        dataSource: createRealPayloadDataSource(summary),
        skipAuditLog: true,
        council,
      })

      expect(res.advisory).not.toBeNull()
      expect(res.advisory!.findings[0]).toBe('delivery:pause:assima:talabat-tgo')
      expect(res.reply).toContain('طلبات TGO')
      expect(res.reply).toContain('العاصمة')
      expect(res.reply).toMatch(/(?:19|21):00/)
      expect(res.reply).toMatch(/تقدير: .+ = .+/)
      expect(res.reply).not.toMatch(/(?:^|[^\d.,])0\.000(?!\d)/)
    })
  })
})
