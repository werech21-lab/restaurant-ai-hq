import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import {
  ODOO_EXCLUSION_RULES,
  isExcludedOdooEntity,
  isExcludedRecordId,
  isPeriodSaleProduct,
  sumWithoutExcludedEntities,
} from '@/lib/odoo/excluded-entities'
import { buildBriefFactPack, type BriefCubeInput } from '@/server/ai/facts'

const ROOT = process.cwd()
const SOURCE_DIRS = ['src/app', 'src/components', 'src/lib', 'src/modules', 'src/server', 'src/services']
const PRODUCT_NAME_RE = /croissant|avocado|كرواسون|كرواسان|أفوكادو|افوكادو/i

async function productionSources(): Promise<{ rel: string; text: string }[]> {
  const out: { rel: string; text: string }[] = []
  async function walk(dir: string) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue
        await walk(full)
        continue
      }
      if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) continue
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue
      out.push({ rel: path.relative(ROOT, full), text: await readFile(full, 'utf8') })
    }
  }
  for (const dir of SOURCE_DIRS) await walk(path.join(ROOT, dir))
  return out
}

function cube(overrides: Partial<BriefCubeInput> = {}): BriefCubeInput {
  return {
    connected: true,
    noData: false,
    dateRange: { from: '2026-11-15', to: '2026-11-15' },
    totals: { netSalesKwd: 40, orders: 4 },
    topProducts: [],
    ...overrides,
  }
}

describe('phase 1 data cleanup', () => {
  it('keeps croissant and avocado names out of production source', async () => {
    const files = await productionSources()
    expect(files.length).toBeGreaterThan(50)
    const hits = files.filter((file) => PRODUCT_NAME_RE.test(file.text)).map((file) => file.rel)
    expect(hits).toEqual([])
  })

  it('matches excluded entities by stored id and Arabic or English name', () => {
    expect(isExcludedRecordId('pos_category', 150)).toBe(true)
    expect(ODOO_EXCLUSION_RULES.some((rule) => rule.ids.includes(150))).toBe(true)
    for (const name of ['Heisenberg', 'هايزنبرغ', 'Jahra', 'الجهراء', 'القرين', 'Qurain']) {
      expect(isExcludedOdooEntity(name)).toBe(true)
    }
    expect(isExcludedOdooEntity(['haw', 'ally'].join(''))).toBe(true)
    expect(isExcludedOdooEntity('Promenade')).toBe(false)
  })

  it('drops an excluded row before the total is summed', () => {
    expect(
      sumWithoutExcludedEntities([
        { name: 'Promenade', amount: 10 },
        { name: 'الجهراء', amount: 7 },
      ]),
    ).toBe(10)
  })

  it('shows a product only when it sold in the period on an approved brand', () => {
    const approved = ['china-garden']
    expect(
      isPeriodSaleProduct({ name: 'Chicken', brandId: 'china-garden', netKwd: 4, qty: 1, approvedBrandIds: approved }),
    ).toBe(true)
    expect(
      isPeriodSaleProduct({ name: 'Chicken', brandId: 'china-garden', netKwd: 0, qty: 0, approvedBrandIds: approved }),
    ).toBe(false)
    expect(
      isPeriodSaleProduct({ name: 'هايزنبرغ', brandId: 'china-garden', netKwd: 4, qty: 1, approvedBrandIds: approved }),
    ).toBe(false)
  })

  it('omits an excluded or unsold product and labels a missing source', () => {
    const pack = buildBriefFactPack({
      yesterday: '2026-11-15',
      prior: '2026-11-14',
      current: cube({
        topProducts: [
          { productId: 11, name: 'Chicken', netKwd: 12 },
          { productId: 12, name: 'هايزنبرغ', netKwd: 90 },
          { productId: 13, name: 'Unsolds', netKwd: 0 },
        ],
      }),
      priorCube: null,
      purchases: null,
      receivables: null,
    })
    const scopes = pack.facts.map((fact) => fact.scope)
    expect(scopes).toContain('Chicken')
    expect(scopes.join(' ')).not.toMatch(/هايزن/)
    expect(scopes).not.toContain('Unsolds')
    expect(pack.sections.find((section) => section.id === 'receivables')?.status).toBe('not_linked')
    expect(pack.sections.find((section) => section.id === 'receivables_aging')?.status).toBe('unverified')
    expect(pack.sections.find((section) => section.id === 'prior_period')?.status).toBe('not_linked')
  })

  it('labels a KPI with its Odoo model, period, and an honest unsynced state', () => {
    const html = renderToStaticMarkup(
      createElement(KpiProvenanceBadge, {
        odooModel: 'pos.order',
        dateRange: { from: '2026-11-15', to: '2026-11-15' },
        lastSyncAt: null,
        kind: 'actual',
        isAr: true,
      }),
    )
    expect(html).toContain('pos.order')
    expect(html).toContain('2026-11-15')
    expect(html).toContain('فعلي')
    expect(html).toContain('غير متزامن')
  })

  it('does not label a missing model as pos.order', () => {
    const html = renderToStaticMarkup(
      createElement(KpiProvenanceBadge, {
        dateRange: '2026-11-15',
        lastSyncAt: null,
        kind: 'estimate',
        isAr: true,
      }),
    )
    expect(html).toContain('غير محدد')
    expect(html).not.toContain('pos.order')
  })
})
