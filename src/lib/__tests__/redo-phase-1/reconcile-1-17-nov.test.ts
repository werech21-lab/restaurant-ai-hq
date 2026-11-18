/**
 * Phase 1 · Item 1.5 (`C7` 1–17 Nov POS reconciliation) & Unified Mac Read-Only Probe Runner (`2.1`).
 *
 * HARD RULE: Zero hand-typed KWD values. Every figure is derived strictly from
 * real repo data (`database/seeds/venturefoods_odoo_cids1_dump.json`,
 * `src/lib/__tests__/fixtures/dashboard-today-2026-11-17.json`, `pos-registry.json`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import posRegistry from '@/lib/odoo/pos-registry.json'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import {
  buildVarianceReport,
  classifyRegister,
  renderReconciliationRedoMarkdown,
} from '../../../../scripts/lib/pos-variance-lib.mjs'
import {
  ALLOWED_ODOO_METHODS,
  assertReadOnlyOdooMethod,
  renderModelProbeMarkdown,
} from '../../../../scripts/run-mac-readonly-probes.mjs'

const ROOT = process.cwd()
const SEED_DUMP_PATH = path.join(ROOT, 'database', 'seeds', 'venturefoods_odoo_cids1_dump.json')
const seedDump = JSON.parse(fs.readFileSync(SEED_DUMP_PATH, 'utf8')) as {
  models: {
    'stock.quant': unknown[]
  }
}

describe('Phase 1.5 (C7) & Read-Only Mac Probe Runner — Reconciliation & RPC Guardrails', () => {
  it('separates archived #16/#35 from active restaurants, surfaces unknown #36, booths, canteens, excluded [24,25,39,40], and renders redo reconciliation doc', () => {
    expect(classifyRegister(8, posRegistry, { active: true }).reconciliationBucket).toBe('active-restaurant')
    expect(classifyRegister(16, posRegistry, { active: false }).category).toBe('archived-whitelisted')
    expect(classifyRegister(35, posRegistry, { active: false }).category).toBe('archived-whitelisted')
    expect(classifyRegister(26, posRegistry, { active: true }).reconciliationBucket).toBe('exhibition-booths')
    expect(classifyRegister(41, posRegistry, { active: true }).reconciliationBucket).toBe('school-canteens')
    expect(classifyRegister(24, posRegistry, { active: false }).reconciliationBucket).toBe('explicit-excluded')
    expect(classifyRegister(36, posRegistry, { active: false }).reconciliationBucket).toBe('unknown-unmapped')
    expect(
      classifyRegister(90, posRegistry, { active: true, name: 'Qurain Kitchen POS' }).reconciliationBucket,
    ).toBe('qurain-central-kitchen')

    const liveSummary = loadLiveTodaySummary()
    const todayLocs = liveSummary.buckets!.today!.byLocation ?? {}
    const rows = [
      {
        configId: 8,
        configName: 'Promenade Active',
        active: true,
        orders: todayLocs.promenade?.orders ?? 0,
        grossKwd: todayLocs.promenade?.netKwd ?? 0,
        taxKwd: 0,
      },
      {
        configId: 16,
        configName: 'E-Mall (Promenade) Archived',
        active: false,
        orders: todayLocs.ardiya?.orders ?? 0,
        grossKwd: todayLocs.ardiya?.netKwd ?? 0,
        taxKwd: 0,
      },
      {
        configId: 35,
        configName: 'Delivery (Ardiya Temp) Archived',
        active: false,
        orders: 0,
        grossKwd: 0,
        taxKwd: 0,
      },
      {
        configId: 36,
        configName: 'Config 36 Unknown',
        active: false,
        orders: 0,
        grossKwd: 0,
        taxKwd: 0,
      },
      {
        configId: 26,
        configName: 'EXB Booth 1',
        active: true,
        orders: todayLocs.salmiya?.orders ?? 0,
        grossKwd: todayLocs.salmiya?.netKwd ?? 0,
        taxKwd: 0,
      },
      {
        configId: 41,
        configName: 'NPIS Hawally',
        active: true,
        orders: todayLocs['al-kout']?.orders ?? 0,
        grossKwd: todayLocs['al-kout']?.netKwd ?? 0,
        taxKwd: 0,
      },
      {
        configId: 24,
        configName: 'Decommissioned 24',
        active: false,
        orders: 0,
        grossKwd: 0,
        taxKwd: 0,
      },
    ]

    const ownerRefDerived = (todayLocs.promenade?.netKwd ?? 0) + (todayLocs['al-kout']?.netKwd ?? 0)
    const report = buildVarianceReport(rows, posRegistry, { ownerReferenceKwd: ownerRefDerived })

    // Archived #16 MUST NOT inflate active whitelisted / restaurantsOnly totals:
    expect(report.totals.restaurantsOnly).toBeCloseTo(todayLocs.promenade?.netKwd ?? 0, 3)
    expect(report.byReconciliationBucket['archived-whitelisted'].netKwd).toBeCloseTo(
      todayLocs.ardiya?.netKwd ?? 0,
      3,
    )
    expect(report.registers.some((r: { configId: number }) => r.configId === 36)).toBe(true)

    const md = renderReconciliationRedoMarkdown(report, {
      fromIso: '2026-11-01',
      toIso: '2026-11-17',
      generatedAt: '2026-11-18T06:45:00.000Z',
    })
    expect(md).toContain('#16')
    expect(md).toContain('#35')
    expect(md).toContain('#36')
    expect(md).toContain('archived-whitelisted')
    expect(md).toContain('unknown-unmapped')
  })

  it('enforces strictly read-only Odoo RPC methods in run-mac-readonly-probes.mjs', () => {
    expect([...ALLOWED_ODOO_METHODS].sort()).toEqual([
      'fields_get',
      'read',
      'read_group',
      'search_count',
      'search_read',
    ])
    for (const m of ['fields_get', 'search_count', 'search_read', 'read_group', 'read']) {
      expect(() => assertReadOnlyOdooMethod(m)).not.toThrow()
    }
    for (const forbidden of ['create', 'write', 'unlink', 'action_post', 'execute', 'name_create']) {
      expect(() => assertReadOnlyOdooMethod(forbidden)).toThrow(/read-only/i)
    }

    const md = renderModelProbeMarkdown({
      generatedAt: '2026-11-18T06:45:00.000Z',
      models: [
        {
          model: 'stock.quant',
          readable: true,
          rowCount: seedDump.models['stock.quant'].length,
          keyFields: ['product_id', 'location_id', 'quantity'],
          dateSpan: null,
          branchCoveragePct: 100,
          notes: 'QRN/Stock present',
        },
      ],
    })
    expect(md).toContain('stock.quant')
    expect(md).toContain('QRN/Stock present')
  })
})
