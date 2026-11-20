import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { filterMockState } = vi.hoisted(() => ({
  filterMockState: {
    current: null as Record<string, unknown> | null,
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/feryal-ai',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname?: string }
    children?: React.ReactNode
    className?: string
  }) =>
    React.createElement(
      'a',
      { href: typeof href === 'string' ? href : href?.pathname ?? '#', ...rest },
      children,
    ),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => filterMockState.current,
}))

import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { verifyFeryalReplyNumbers } from '@/lib/feryal-odoo-agent'
import {
  confirmDocumentIntakeDraft,
  EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
  recomputeIntakeRowAnomalies,
  serializePricingRowsToCsv,
  UNMATCHED_WRONG_VARIANT_LABEL_AR,
  UNMATCHED_WRONG_VARIANT_LABEL_EN,
  USER_INPUT_CONFIRMED_LABEL,
  type ConfirmedPriceSheet,
  type DocumentIntakeDraft,
} from '@/lib/feryal/document-intake-types'
import {
  ingestPricingDocument,
  matchIntakeItemToOdooRow,
  parseSpreadsheetIntakeRows,
} from '@/lib/feryal/document-intake'
import {
  buildExecutiveContextPack,
  collectExecutiveGroundedNumbers,
  renderDeterministicExecutiveBrief,
  simulateExecutivePricingOptions,
} from '@/lib/feryal/executive-advisor'
import {
  matchProposedPrice,
  readItemPricingLines,
  type ItemPricingExecute,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import {
  areSkuBrandsCompatible,
  brandIdForPosRoot,
  checkPriceSanityDeviation,
  extractSizePackQualifiers,
  hasCompatibleSizePackTokens,
  inferBrandIdFromSkuName,
  resolveCanonicalBrandId,
} from '@/lib/feryal/sku-matcher-guard'
import { FeryalDocumentReviewCard, updateDraftRowCurrentPrice } from '@/components/aether/FeryalDocumentReviewCard'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { guardAnswerAgainstFacts } from '@/server/ai/number-guard'

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLocale(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProviderHost, { initialLocale: locale }, element),
  )
}

function setFilterContext(period: GlobalFilters['period']): void {
  const filters: Required<GlobalFilters> = {
    ...DEFAULT_GLOBAL_FILTERS,
    period,
  }
  const summary: OdooLiveSummary = {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    lastSyncAt: '2026-11-20T05:00:00.000Z',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange:
      period === 'today'
        ? { from: '2026-11-20', to: '2026-11-20' }
        : { from: '2026-10-22', to: '2026-11-20' },
    syncedAt: '2026-11-20T05:00:00.000Z',
    period:
      period === 'today'
        ? { from: '2026-11-20', to: '2026-11-20' }
        : { from: '2026-10-22', to: '2026-11-20' },
    database: null,
    totals: { netSalesKwd: 4200, orders: 950, aovKwd: 4.421 },
    brands: [],
    branches: [],
    channels: [],
  }
  const workspace = computeGlobalWorkspace(filters, summary, '/erp/feryal-ai')
  filterMockState.current = {
    filters,
    workspace,
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    syncCooldownSec: 0,
    triggerOdooSyncNow: vi.fn(async () => undefined),
    setPeriod: vi.fn(),
    setCustomRange: vi.fn(),
    setKuwaitSlice: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setLens: vi.fn(),
    resetFilters: vi.fn(),
    buildShareDeepLinkText: () => '',
  }
}

beforeEach(() => {
  setFilterContext('month')
})

describe('Rule 1 — Strict Brand-Scoped Matching (Karak Pepsi 0.300 vs China Garden Pepsi 0.450)', () => {
  it('resolves canonical brandIds from POS roots, names, and Odoo [RI...] SKU code prefixes', () => {
    expect(brandIdForPosRoot('CG')).toBe('china-garden')
    expect(brandIdForPosRoot("Frank's")).toBe('franks')
    expect(brandIdForPosRoot('Tahina')).toBe('tahina')
    expect(brandIdForPosRoot('FB')).toBe('farm-brown')
    expect(brandIdForPosRoot('TNB')).toBe('noodle-bar')
    expect(brandIdForPosRoot('Karak Cafeteria')).toBe('karak-cafeteria')

    expect(inferBrandIdFromSkuName('[RICG004] Pepsi Can')).toBe('china-garden')
    expect(inferBrandIdFromSkuName('[RIKC012] Pepsi')).toBe('karak-cafeteria')
    expect(inferBrandIdFromSkuName('[RIFR010] Brisket Fries')).toBe('franks')
    expect(inferBrandIdFromSkuName('[RITH002] Chicken Shawarma')).toBe('tahina')
    expect(inferBrandIdFromSkuName('[RIFB008] Brioche Toast')).toBe('farm-brown')
    expect(inferBrandIdFromSkuName('[RITNB003] Dan Dan Noodles')).toBe('noodle-bar')

    expect(resolveCanonicalBrandId('كرك كافتيريا')).toBe('karak-cafeteria')
    expect(resolveCanonicalBrandId('تشاينا جاردن')).toBe('china-garden')
  })

  it('populates brandId on ItemPricingRow in company-wide readItemPricingLines via read-only product.product.pos_categ_id', async () => {
    const calls: Array<{ model: string; method: string; args: unknown[]; kwargs: Record<string, unknown> }> = []
    const execute: ItemPricingExecute = async (call) => {
      calls.push({ model: call.model, method: call.method, args: call.args, kwargs: call.kwargs })
      expect(JSON.stringify(call.args)).not.toContain('standard_price')
      expect(JSON.stringify(call.kwargs)).not.toContain('standard_price')
      if (call.model === 'pos.category') {
        return [
          { id: 10, name: 'CG', parent_id: false },
          { id: 11, name: 'Beverages', parent_id: [10, 'CG'] },
          { id: 40, name: 'Karak Cafeteria', parent_id: false },
          { id: 41, name: 'Cold Drinks', parent_id: [40, 'Karak Cafeteria'] },
        ]
      }
      if (call.model === 'pos.order.line') {
        return [
          { product_id: [501, 'Pepsi'], price_subtotal: 450, qty: 1000 },
          { product_id: [502, 'Pepsi'], price_subtotal: 150, qty: 500 },
        ]
      }
      if (call.model === 'product.product') {
        return [
          { id: 501, pos_categ_id: [11, 'CG / Beverages'] },
          { id: 502, pos_categ_id: [41, 'Karak Cafeteria / Cold Drinks'] },
        ]
      }
      return []
    }

    const read = await readItemPricingLines({
      fromIso: '2026-11-01',
      toIso: '2026-11-20',
      branchLocation: null,
      posRoot: null,
      execute,
    })

    expect(read).not.toBeNull()
    expect(read?.configIds).toEqual(expect.arrayContaining([24, 36]))
    expect(read?.configIds).not.toContain(25)
    expect(read?.configIds).not.toContain(39)
    expect(read?.configIds).not.toContain(40)

    const cgPepsi = read?.rows.find((r) => r.productId === 501)
    const karakPepsi = read?.rows.find((r) => r.productId === 502)
    expect(cgPepsi).toMatchObject({
      productId: 501,
      unitPriceKwd: '0.45',
      brandId: 'china-garden',
    })
    expect(karakPepsi).toMatchObject({
      productId: 502,
      unitPriceKwd: '0.3',
      brandId: 'karak-cafeteria',
    })
  })

  it('strictly prevents Karak Pepsi (0.300 KWD) from matching China Garden Pepsi (0.450 KWD) across intake and simulation', async () => {
    const cgOnlyOdooRows: ItemPricingRow[] = [
      {
        productId: 501,
        name: '[RICG-09] Pepsi',
        qty: '1000',
        netKwd: '450.000',
        unitPriceKwd: '0.450',
        categoryId: 11,
        brandId: 'china-garden',
      },
    ]

    expect(
      areSkuBrandsCompatible({
        rowBrand: 'Karak Cafeteria',
        sheetItemName: 'Pepsi',
        candidateBrand: 'china-garden',
        candidateSkuName: '[RICG-09] Pepsi',
        contextBrand: 'china-garden',
      }),
    ).toBe(false)

    // 1. Direct matchIntakeItemToOdooRow: Karak Pepsi vs China Garden Pepsi -> null
    expect(
      matchIntakeItemToOdooRow('Karak Pepsi', cgOnlyOdooRows, {
        sheetCurrentPriceKwd: '0.300',
      }),
    ).toBeNull()

    expect(
      matchIntakeItemToOdooRow('Pepsi', cgOnlyOdooRows, {
        rowBrand: 'Karak Cafeteria',
        contextBrand: 'china-garden',
        sheetCurrentPriceKwd: '0.300',
      }),
    ).toBeNull()

    // 2. Full spreadsheet intake under China Garden scope with a Karak Cafeteria row -> unmatched!
    const csv = [
      'Brand,Item Name,Current Price,Proposed',
      'Karak Cafeteria,Pepsi,0.300,0.350',
      'China Garden,Pepsi,0.450,0.500',
    ].join('\n')

    const draft = await ingestPricingDocument(
      {
        fileName: 'cross-brand-pepsi.csv',
        mimeType: 'text/csv',
        bytes: new TextEncoder().encode(csv),
        period: 'month',
        brand: 'china-garden',
      },
      { odooRowsOverride: cgOnlyOdooRows },
    )

    const karakRow = draft.rows[0]!
    const cgRow = draft.rows[1]!
    expect(karakRow.matchedOdooProductId).toBeNull()
    expect(karakRow.anomalies.some((a) => a.code === 'UNMATCHED_ODOO_SKU')).toBe(true)
    expect(cgRow.matchedOdooProductId).toBe(501)
    expect(cgRow.odooRealizedUnitPriceKwd).toBe('0.450')

    // 3. Executive simulator: even if matchedOdooProductId=501 was pre-populated on a Karak row, it is rejected!
    const cgPack = buildExecutiveContextPack({
      fromIso: '2026-10-22',
      toIso: '2026-11-20',
      brandId: 'china-garden',
      rows: cgOnlyOdooRows,
    })

    const sim = simulateExecutivePricingOptions({
      pack: cgPack,
      sheet: {
        sourceTag: USER_INPUT_CONFIRMED_LABEL,
        rows: [
          {
            rowId: 'karak-pepsi',
            brand: 'Karak Cafeteria',
            itemName: 'Pepsi',
            currentPriceKwd: '0.300',
            matchedOdooProductId: 501,
            proposedOptions: [{ optionKey: 'proposed', label: 'Proposed', proposedPriceKwd: '0.350' }],
          },
        ],
      },
    })

    const opt = sim.options[0]!
    expect(opt.matchedSkuCount).toBe(0)
    expect(opt.unmatchedRowCount).toBe(1)
    expect(opt.baseDeltaKwd).toBe('0.000')
    expect(opt.lines[0]?.matched).toBe(false)
    expect(opt.lines[0]?.productId).toBeNull()
  })
})

describe('Rule 2 — Size / Packing Token Lock (Bulk/Multi-Pack & Portion-Down Qualifiers)', () => {
  const regularOdooRows: ItemPricingRow[] = [
    {
      productId: 201,
      name: 'Sweet & Sour Chicken',
      qty: '600',
      netKwd: '2100.000',
      unitPriceKwd: '3.500',
      categoryId: 10,
      brandId: 'china-garden',
    },
    {
      productId: 202,
      name: 'Classic Beef Burger',
      qty: '450',
      netKwd: '1350.000',
      unitPriceKwd: '3.000',
      categoryId: 20,
      brandId: 'franks',
    },
    {
      productId: 203,
      name: 'Chicken Shawarma',
      qty: '900',
      netKwd: '810.000',
      unitPriceKwd: '0.900',
      categoryId: 30,
      brandId: 'tahina',
    },
  ]

  it('rejects Platter, For 6, For 8, Box, Dozen, and Meal vs single dishes across all matching tiers', () => {
    const bulkCases: Array<[string, string]> = [
      ['Sweet & Sour Chicken Platter', 'Sweet & Sour Chicken'],
      ['بلاتر سويت اند ساور', 'سويت اند ساور'],
      ['صينية شاورما دجاج', 'شاورما دجاج'],
      ['Sweet & Sour Chicken For 6', 'Sweet & Sour Chicken'],
      ['Sweet & Sour Chicken For 8', 'Sweet & Sour Chicken'],
      ['Sweet & Sour Chicken For 6', 'Sweet & Sour Chicken For 8'],
      ['مشاوي يكفي 6', 'مشاوي يكفي 8'],
      ['Chicken Shawarma Box', 'Chicken Shawarma'],
      ['بوكس شاورما دجاج', 'شاورما دجاج'],
      ['Spring Roll Dozen', 'Spring Roll'],
      ['Spring Roll Half Dozen', 'Spring Roll Dozen'],
      ['درزن سمبوسة', 'سمبوسة'],
      ['Classic Beef Burger Meal', 'Classic Beef Burger'],
      ['وجبة شاورما دجاج', 'شاورما دجاج'],
      ['Chicken Shawarma Family', 'Chicken Shawarma'],
      ['Chicken Shawarma Gathering', 'Chicken Shawarma'],
      ['Classic Beef Burger Combo', 'Classic Beef Burger'],
    ]

    for (const [left, right] of bulkCases) {
      expect(hasCompatibleSizePackTokens(left, right), `${left} vs ${right}`).toBe(false)
      expect(hasCompatibleSizePackTokens(right, left), `${right} vs ${left}`).toBe(false)
    }

    // Equivalent count phrasings ("For 6" === "6 Pax") ARE compatible
    expect(extractSizePackQualifiers('Mixed Grill For 6')).toEqual(['for_6'])
    expect(extractSizePackQualifiers('Mixed Grill (6 Pax)')).toEqual(['for_6'])
    expect(hasCompatibleSizePackTokens('Mixed Grill For 6', 'Mixed Grill (6 Pax)')).toBe(true)

    // Verify matchIntakeItemToOdooRow and matchProposedPrice both block bulk vs single
    for (const bulkName of [
      'Sweet & Sour Chicken Platter',
      'Sweet & Sour Chicken For 6',
      'Sweet & Sour Chicken For 8',
      'Sweet & Sour Chicken Box',
      'Sweet & Sour Chicken Dozen',
      'Sweet & Sour Chicken Meal',
    ]) {
      expect(matchIntakeItemToOdooRow(bulkName, regularOdooRows)).toBeNull()
      expect(matchProposedPrice({ label: bulkName, amount: '5.000' }, regularOdooRows)).toBeNull()
    }
  })

  it('rejects Single, Little, Mini, and Kids vs regular size across EN and AR', () => {
    const smallCases: Array<[string, string]> = [
      ['Single Classic Beef Burger', 'Classic Beef Burger'],
      ['برجر لحم سنجل', 'برجر لحم'],
      ['Little Classic Beef Burger', 'Classic Beef Burger'],
      ['Mini Chicken Shawarma', 'Chicken Shawarma'],
      ['ميني شاورما دجاج', 'شاورما دجاج'],
      ['Kids Classic Beef Burger', 'Classic Beef Burger'],
      ['Junior Classic Beef Burger', 'Classic Beef Burger'],
      ['شاورما دجاج أطفال', 'شاورما دجاج'],
    ]

    for (const [smallName, regularName] of smallCases) {
      expect(hasCompatibleSizePackTokens(smallName, regularName), `${smallName} vs ${regularName}`).toBe(
        false,
      )
      expect(hasCompatibleSizePackTokens(regularName, smallName), `${regularName} vs ${smallName}`).toBe(
        false,
      )
    }

    expect(matchIntakeItemToOdooRow('Single Classic Beef Burger', regularOdooRows)).toBeNull()
    expect(matchIntakeItemToOdooRow('Little Classic Beef Burger', regularOdooRows)).toBeNull()
    expect(matchIntakeItemToOdooRow('Mini Chicken Shawarma', regularOdooRows)).toBeNull()
    expect(matchIntakeItemToOdooRow('Kids Classic Beef Burger', regularOdooRows)).toBeNull()
  })
})

describe('Rule 3 — >35% Price Sanity Gate (Platter 21.500 KWD vs Plate 3.500 KWD -> UNMATCHED_WRONG_VARIANT)', () => {
  const singlePlateOdooRows: ItemPricingRow[] = [
    {
      productId: 301,
      name: 'Mixed Seafood',
      qty: '400',
      netKwd: '1400.000',
      unitPriceKwd: '3.500',
      categoryId: 10,
      brandId: 'china-garden',
    },
    {
      productId: 302,
      name: 'Sweet & Sour Chicken',
      qty: '500',
      netKwd: '1750.000',
      unitPriceKwd: '3.500',
      categoryId: 10,
      brandId: 'china-garden',
    },
  ]

  it('enforces exact 35% Decimal boundary on sheet current vs Odoo realized unit price', () => {
    // Exact 35.00% -> allowed (not > 35%)
    expect(checkPriceSanityDeviation('1.350', '1.000').exceedsThreshold).toBe(false)
    expect(checkPriceSanityDeviation('0.650', '1.000').exceedsThreshold).toBe(false)

    // > 35% -> rejected
    expect(checkPriceSanityDeviation('1.355', '1.000').exceedsThreshold).toBe(true)
    expect(checkPriceSanityDeviation('0.250', '0.450')).toMatchObject({
      exceedsThreshold: true,
      diffPct: '-44.44',
    })
    expect(checkPriceSanityDeviation('21.500', '3.500')).toMatchObject({
      exceedsThreshold: true,
      diffPct: '514.29',
    })
  })

  it('rejects 21.500 KWD sheet row vs 3.500 KWD Odoo plate, marks Unmatched / Wrong Variant in EN & AR, and produces 0 false KWD simulation delta', async () => {
    // Even if sheet item name lacks the word "Platter" ("Mixed Seafood" @ 21.500 KWD vs Odoo "Mixed Seafood" @ 3.500 KWD),
    // Rule 3 catches the >35% price deviation and blocks the wrong-variant match!
    const csv = [
      'Brand,Item Name,Current Price,CH,AE',
      'China Garden,Mixed Seafood,21.500,22.500,23.500',
      'China Garden,Sweet & Sour Chicken,3.500,3.750,3.850',
    ].join('\n')

    const draft = await ingestPricingDocument(
      {
        fileName: 'cg-platter-vs-plate.csv',
        mimeType: 'text/csv',
        bytes: new TextEncoder().encode(csv),
        period: 'month',
        brand: 'china-garden',
      },
      { odooRowsOverride: singlePlateOdooRows },
    )

    const wrongVariantRow = draft.rows[0]!
    const validPlateRow = draft.rows[1]!

    expect(wrongVariantRow.matchedOdooProductId).toBeNull()
    expect(wrongVariantRow.matchedOdooProductName).toBeNull()
    expect(wrongVariantRow.odooQty).toBeNull()
    expect(wrongVariantRow.odooNetSalesKwd).toBeNull()
    expect(wrongVariantRow.rejectedVariantHint).toEqual({
      odooName: 'Mixed Seafood',
      odooUnitPriceKwd: '3.500',
      diffPct: '514.29',
    })
    expect(wrongVariantRow.anomalies.map((a) => a.code)).toContain('UNMATCHED_WRONG_VARIANT')
    expect(wrongVariantRow.anomalies[0]?.messageEn).toContain(UNMATCHED_WRONG_VARIANT_LABEL_EN)
    expect(wrongVariantRow.anomalies[0]?.messageAr).toContain(UNMATCHED_WRONG_VARIANT_LABEL_AR)

    expect(validPlateRow.matchedOdooProductId).toBe(302)
    expect(validPlateRow.anomalies).toEqual([])

    // Verify Review Card renders "Unmatched / Wrong Variant" & "غير مطابق / صنف أو حجم مختلف"
    const enCardHtml = renderToStaticMarkup(
      React.createElement(FeryalDocumentReviewCard, {
        draft,
        isAr: false,
        activePeriod: 'month',
        onDraftChange: () => undefined,
        onConfirmAndRun: () => undefined,
        onCancel: () => undefined,
      }),
    )
    expect(enCardHtml).toContain('data-unmatched-wrong-variant="true"')
    expect(enCardHtml).toContain('data-anomaly-code="UNMATCHED_WRONG_VARIANT"')
    expect(enCardHtml).toContain(UNMATCHED_WRONG_VARIANT_LABEL_EN)

    const arCardHtml = renderToStaticMarkup(
      React.createElement(FeryalDocumentReviewCard, {
        draft,
        isAr: true,
        activePeriod: 'month',
        onDraftChange: () => undefined,
        onConfirmAndRun: () => undefined,
        onCancel: () => undefined,
      }),
    )
    expect(arCardHtml).toContain('data-unmatched-wrong-variant="true"')
    expect(arCardHtml).toContain(UNMATCHED_WRONG_VARIANT_LABEL_AR)

    // Verify inline edit of current price on an already-matched row to 21.500 KWD also unmatches it immediately
    const afterInlinePriceEdit = updateDraftRowCurrentPrice(draft, validPlateRow.rowId, '21.500')
    const editedPlate = afterInlinePriceEdit.rows.find((r) => r.rowId === validPlateRow.rowId)!
    expect(editedPlate.matchedOdooProductId).toBeNull()
    expect(editedPlate.anomalies.map((a) => a.code)).toContain('UNMATCHED_WRONG_VARIANT')

    // Verify Executive Simulator NEVER multiplies platter price by single-plate 400 qty EVEN IF matchedOdooProductId=301 was pre-populated!
    const pack = buildExecutiveContextPack({
      fromIso: '2026-10-22',
      toIso: '2026-11-20',
      brandId: 'china-garden',
      rows: singlePlateOdooRows,
    })

    const confirmed = confirmDocumentIntakeDraft(draft, '2026-11-20T05:10:00.000Z')
    const forcedMismatchSheet: ConfirmedPriceSheet = {
      ...confirmed,
      rows: confirmed.rows.map((r) =>
        r.itemName === 'Mixed Seafood' ? { ...r, matchedOdooProductId: 301 } : r,
      ),
    }

    const sim = simulateExecutivePricingOptions({ pack, sheet: forcedMismatchSheet })
    const chOpt = sim.options.find((o) => o.optionKey === 'ch')!
    const seafoodLine = chOpt.lines.find((l) => l.itemName === 'Mixed Seafood')!
    const sweetSourLine = chOpt.lines.find((l) => l.itemName === 'Sweet & Sour Chicken')!

    expect(seafoodLine.matched).toBe(false)
    expect(seafoodLine.productId).toBeNull()
    expect(seafoodLine.qty).toBe('0')
    expect(seafoodLine.baseDeltaKwd).toBe('0.000')
    expect(seafoodLine.conservativeDeltaKwd).toBe('0.000')
    expect(seafoodLine.stressTestDeltaKwd).toBe('0.000')
    expect(seafoodLine.anomalyCodes).toContain('UNMATCHED_WRONG_VARIANT')

    // Total option Base delta comes strictly from Sweet & Sour Chicken: 500 * (3.750 - 3.500) = +125.000 KWD (zero false 7,600 KWD uplift!)
    expect(sweetSourLine.matched).toBe(true)
    expect(sweetSourLine.baseDeltaKwd).toBe('125.000')
    expect(chOpt.baseDeltaKwd).toBe('125.000')

    // Grounding check on deterministic EN & AR briefs with UNMATCHED_WRONG_VARIANT
    const grounded = collectExecutiveGroundedNumbers(pack, sim)
    for (const locale of ['en', 'ar'] as const) {
      const brief = renderDeterministicExecutiveBrief(pack, sim, locale, false)
      const verified = verifyFeryalReplyNumbers(brief, grounded.toolNumbers, {
        allowedDateStrings: ['2026-10-22', '2026-11-20'],
        allowedEntityNames: grounded.allowedEntityNames,
      })
      expect(verified.unverifiedNumbers).toEqual([])
      expect(verified.valid).toBe(true)
      expect(guardAnswerAgainstFacts(brief, grounded.labeledFacts).ok).toBe(true)
    }
  })

  it('clears UNMATCHED_WRONG_VARIANT cleanly when recomputeIntakeRowAnomalies receives a corrected sheet current price', () => {
    const flagged = recomputeIntakeRowAnomalies([
      {
        rowId: 'r1',
        brand: 'China Garden',
        itemName: 'Mixed Seafood',
        sheetCurrentPriceKwd: '21.500',
        proposedOptions: [{ optionKey: 'proposed', label: 'Proposed', proposedPriceKwd: '22.500' }],
        matchedOdooProductId: 301,
        matchedOdooProductName: 'Mixed Seafood',
        odooRealizedUnitPriceKwd: '3.500',
        odooQty: '400',
        odooNetSalesKwd: '1400.000',
        excluded: false,
        anomalies: [],
      },
    ])
    expect(flagged[0]?.matchedOdooProductId).toBeNull()
    expect(flagged[0]?.anomalies.map((a) => a.code)).toContain('UNMATCHED_WRONG_VARIANT')

    const afterFix = recomputeIntakeRowAnomalies([
      {
        ...flagged[0]!,
        sheetCurrentPriceKwd: '3.500',
        proposedOptions: [{ optionKey: 'proposed', label: 'Proposed', proposedPriceKwd: '3.750' }],
      },
    ])
    expect(afterFix[0]?.rejectedVariantHint).toBeNull()
    expect(afterFix[0]?.anomalies.map((a) => a.code)).not.toContain('UNMATCHED_WRONG_VARIANT')
  })
})

describe('Rule 4 — Default Period Guard ("Today" Warning Banner + 1-Click Re-Run on "Last 30 Days")', () => {
  const todayDraft: DocumentIntakeDraft = {
    draftId: 'draft-today-1',
    fileName: 'china-garden-today.xlsx',
    fileKind: 'xlsx',
    sourceTag: EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
    requiresHumanConfirmation: true,
    period: { from: '2026-11-20', to: '2026-11-20' },
    brand: 'china-garden',
    branch: null,
    rows: [
      {
        rowId: 'r1',
        brand: 'China Garden',
        itemName: 'Sweet & Sour Chicken',
        sheetCurrentPriceKwd: '2.500',
        proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.700' }],
        matchedOdooProductId: 101,
        matchedOdooProductName: 'Sweet & Sour Chicken',
        odooRealizedUnitPriceKwd: '2.500',
        odooQty: '12',
        odooNetSalesKwd: '30.000',
        excluded: false,
        anomalies: [],
      },
    ],
    summary: { totalRows: 1, matchedRows: 1, criticalCount: 0, warningCount: 0 },
  }

  it('renders Today period warning banner + 1-click "Switch & Re-Match on Last 30 Days" in EN & AR on FeryalDocumentReviewCard, and hides it on Last 30 Days', () => {
    setFilterContext('today')

    const enStudioHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialPendingDraft: todayDraft,
      }),
    )
    expect(enStudioHtml).toContain('data-feryal-today-period-warning="true"')
    expect(enStudioHtml).toContain('Last 30 Days')
    expect(enStudioHtml).toContain('data-rerun-last-30-days="true"')
    expect(enStudioHtml).toContain('Switch &amp; Re-Match on Last 30 Days')

    const arStudioHtml = renderWithLocale(
      'ar',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialPendingDraft: todayDraft,
      }),
    )
    expect(arStudioHtml).toContain('data-feryal-today-period-warning="true"')
    expect(arStudioHtml).toContain('آخر 30 يوماً')
    expect(arStudioHtml).toContain('data-rerun-last-30-days="true"')
    expect(arStudioHtml).toContain('التبديل وإعادة المطابقة على آخر 30 يوماً')

    // On Last 30 Days (from !== to and activePeriod === 'month'), warning banner is NOT shown
    setFilterContext('month')
    const monthDraft: DocumentIntakeDraft = {
      ...todayDraft,
      period: { from: '2026-10-22', to: '2026-11-20' },
    }
    const monthCardHtml = renderToStaticMarkup(
      React.createElement(FeryalDocumentReviewCard, {
        draft: monthDraft,
        isAr: false,
        activePeriod: 'month',
        onDraftChange: () => undefined,
        onConfirmAndRun: () => undefined,
        onCancel: () => undefined,
        onSwitchAndRematchLast30Days: () => undefined,
      }),
    )
    expect(monthCardHtml).not.toContain('data-feryal-today-period-warning="true"')
  })

  it('renders persistent simulation warning banner + 1-click "Re-run on Last 30 Days" button in FeryalGovernanceStudio when confirmed on Today, and serializes rows cleanly for 30-day re-intake', async () => {
    setFilterContext('today')
    const confirmedOnToday = confirmDocumentIntakeDraft(todayDraft, '2026-11-20T05:15:00.000Z')

    const enSimGuardHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialTodaySimulationSheet: confirmedOnToday,
      }),
    )
    expect(enSimGuardHtml).toContain('data-feryal-simulation-period-guard="true"')
    expect(enSimGuardHtml).toContain('data-feryal-today-period-warning="true"')
    expect(enSimGuardHtml).toContain('Last 30 Days')
    expect(enSimGuardHtml).toContain('data-rerun-simulation-30d="true"')
    expect(enSimGuardHtml).toContain('Re-run on Last 30 Days')

    const arSimGuardHtml = renderWithLocale(
      'ar',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialTodaySimulationSheet: confirmedOnToday,
      }),
    )
    expect(arSimGuardHtml).toContain('data-feryal-simulation-period-guard="true"')
    expect(arSimGuardHtml).toContain('آخر 30 يوماً')
    expect(arSimGuardHtml).toContain('data-rerun-simulation-30d="true"')
    expect(arSimGuardHtml).toContain('إعادة التشغيل على آخر 30 يوماً')

    // Round-trip CSV serialization used by 1-click re-match against Last 30 Days
    const csvText = serializePricingRowsToCsv(confirmedOnToday.rows)
    const reparsed = parseSpreadsheetIntakeRows(new TextEncoder().encode(csvText))
    expect(reparsed).toHaveLength(1)
    expect(reparsed[0]).toEqual({
      brand: 'China Garden',
      itemName: 'Sweet & Sour Chicken',
      sheetCurrentPriceKwd: '2.500',
      proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.700' }],
    })
  })
})

describe('Hotfix Static Hygiene & Client Boundary Guards', () => {
  it('keeps client-imported modules free of server-only, console.*, any, sub-12px classes, and truncate in studio', () => {
    const repoRoot = process.cwd()
    const checkedFiles = [
      'src/lib/feryal/sku-matcher-guard.ts',
      'src/lib/feryal/document-intake-types.ts',
      'src/components/aether/FeryalDocumentReviewCard.tsx',
      'src/components/erp/feryal-governance-studio.tsx',
    ]

    for (const rel of checkedFiles) {
      const content = readFileSync(path.join(repoRoot, rel), 'utf8')
      expect(content, `${rel} must not import server-only`).not.toMatch(/['"]server-only['"]/)
      expect(content, `${rel} must not use node:* builtins`).not.toMatch(/from ['"]node:/)
      expect(content, `${rel} must not contain console.*`).not.toMatch(/\bconsole\.(log|warn|error|info|debug)\b/)
      expect(content, `${rel} must not contain explicit any`).not.toMatch(/:\s*any\b|\bas\s+any\b|<any>/)
      expect(content, `${rel} must not contain sub-12px classes`).not.toMatch(
        /text-\[(?:10|10\.5|11|11\.5)px\]/,
      )
    }

    const studioContent = readFileSync(
      path.join(repoRoot, 'src/components/erp/feryal-governance-studio.tsx'),
      'utf8',
    )
    expect(studioContent).not.toContain('truncate')
  })
})
