import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { studioFilterState, odooRpcTracker } = vi.hoisted(() => ({
  studioFilterState: {
    current: null as Record<string, unknown> | null,
  },
  odooRpcTracker: {
    calls: [] as Array<{ model: string; method: string; args: unknown[]; kwargs: Record<string, unknown> }>,
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
  useGlobalFilter: () => studioFilterState.current,
}))

vi.mock('@/lib/odoo-live-connector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/odoo-live-connector')>()
  return {
    ...actual,
    executeOdooKw: async (
      model: string,
      method: string,
      args: unknown[] = [],
      kwargs: Record<string, unknown> = {},
    ) => {
      odooRpcTracker.calls.push({ model, method, args, kwargs })
      if (model === 'pos.category') {
        return [
          { id: 10, name: 'CG', parent_id: false },
          { id: 11, name: 'Rice & Mains', parent_id: [10, 'CG'] },
        ]
      }
      if (model === 'pos.order.line' && method === 'read_group') {
        return [
          { product_id: [101, '[RICG0101] Sweet & Sour Chicken'], price_subtotal: 2500, qty: 1000 },
          { product_id: [136, '[RICG0136] Mushroom Fried Rice'], price_subtotal: 1800, qty: 800 },
          { product_id: [201, '[RICG0201] Nims Chow Mein'], price_subtotal: 700, qty: 280 },
          { product_id: [202, '[RICG0202] Vegetable Dumplings'], price_subtotal: 390, qty: 200 },
        ]
      }
      return []
    },
    fetchLiveOdooSnapshot: async () => ({
      source: 'live' as const,
      connected: true,
      sourceMode: 'odoo17-live' as const,
      noData: false,
      lastSyncAt: '2026-11-20T06:00:00.000Z',
      isStale24h: false,
      odooCompanyId: 1,
      dateRange: { from: '2026-10-22', to: '2026-11-20' },
      syncedAt: '2026-11-20T06:00:00.000Z',
      period: { from: '2026-10-22', to: '2026-11-20' },
      database: null,
      bucket: 'month' as const,
      totals: { netSalesKwd: 5390, orders: 1280, aovKwd: 4.211 },
      brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 5390, sharePct: 100 }],
      branches: [
        { id: '360-mall', name: '360 Mall', unit: 'مول 360', netSalesKwd: 3200, orders: 760, sharePct: 59.37 },
        { id: 'avenues', name: 'Avenues', unit: 'الأفنيوز', netSalesKwd: 2190, orders: 520, sharePct: 40.63 },
      ],
      channels: [
        { name: 'talabat', amountKwd: 3500 },
        { name: 'dine-in', amountKwd: 1890 },
      ],
    }),
  }
})

import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import { POST as chatPost } from '@/app/api/erp/feryal/chat/route'
import {
  DELETE as threadsDelete,
  GET as threadsGet,
  POST as threadsPost,
} from '@/app/api/erp/feryal/threads/route'
import { FeryalDocumentReviewCard } from '@/components/aether/FeryalDocumentReviewCard'
import {
  FeryalStudioMessage,
  formatFrozenScopeBadgeText,
  shouldNowrapPlaybookCell,
} from '@/components/aether/FeryalStudioMessage'
import {
  buildFeryalStudioTurnPostBody,
  captureRequestStartFrozenScope,
  FeryalGovernanceStudio,
  isTechnicalProviderBadge,
  type ChatUiMessage,
} from '@/components/erp/feryal-governance-studio'
import type { ActivePriceSheetThreadContext, FeryalChatThread } from '@/lib/feryal-chat-store'
import { isConfirmedSheetFollowUpQuestion } from '@/lib/feryal-intent'
import {
  detectClientExifOrientation,
  exifOrientationToRotationDegrees,
} from '@/lib/feryal-multimodal'
import { verifyFeryalReplyNumbers } from '@/lib/feryal-odoo-agent'
import {
  confirmDocumentIntakeDraft,
  EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
  inferConfirmedSheetBrandId,
  UNMATCHED_WRONG_VARIANT_LABEL_EN,
  USER_INPUT_CONFIRMED_LABEL,
  type ConfirmedPriceSheet,
  type DocumentIntakeDraft,
} from '@/lib/feryal/document-intake-types'
import {
  detectExifOrientation,
  exifOrientationToClockwiseDegrees,
  extractVisionIntakeRows,
  ingestPricingDocument,
  matchIntakeItemToOdooRow,
  normalizeIntakeImageOrientation,
  parseSpreadsheetIntakeRows,
} from '@/lib/feryal/document-intake'
import {
  buildExecutiveContextPack,
  collectExecutiveGroundedNumbers,
  DETERMINISTIC_SIMULATION_TAG,
  formatKuwaitFils50,
  KUWAIT_MARKET_STRATEGY_TAG_AR,
  KUWAIT_MARKET_STRATEGY_TAG_EN,
  ODOO_VERIFIED_ACTUAL_TAG,
  renderDeterministicExecutiveBrief,
  roundToKuwaitFils50,
  simulateExecutivePricingOptions,
} from '@/lib/feryal/executive-advisor'
import type { ItemPricingRow } from '@/lib/feryal/item-pricing'
import {
  enforceOneToOneSkuMatches,
  extractFlavorProteinQualifiers,
  hasCompatibleFlavorProteinTokens,
  hasCompatibleSizePackTokens,
  normalizeSkuMenuLabel,
} from '@/lib/feryal/sku-matcher-guard'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { Decimal } from '@/server/ai/decimal'
import { inferBrandIdFromConfirmedSheet, runFeryalCouncil } from '@/server/ai/council'
import { guardAnswerAgainstFacts, reviewGroundedNumbers } from '@/server/ai/number-guard'
import {
  callProvider,
  getProviderCooldownSnapshot,
  isProviderInCooldown,
  orderProvidersByHealth,
  resetProviderCooldowns,
} from '@/server/ai/providers'

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLocale(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProviderHost, { initialLocale: locale }, element),
  )
}

function configureStudioFilter(
  period: GlobalFilters['period'] = 'month',
  brand: GlobalFilters['brand'] = 'all',
  branch: GlobalFilters['branch'] = 'all',
): void {
  const filters: Required<GlobalFilters> = {
    ...DEFAULT_GLOBAL_FILTERS,
    period,
    brand,
    branch,
  }
  const range =
    period === 'today'
      ? { from: '2026-11-20', to: '2026-11-20' }
      : { from: '2026-10-22', to: '2026-11-20' }
  const summary: OdooLiveSummary = {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    lastSyncAt: '2026-11-20T06:00:00.000Z',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: range,
    syncedAt: '2026-11-20T06:00:00.000Z',
    period: range,
    database: null,
    totals: { netSalesKwd: 5390, orders: 1280, aovKwd: 4.211 },
    brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 5390, sharePct: 100 }],
    branches: [],
    channels: [],
  }
  const workspace = computeGlobalWorkspace(filters, summary, '/erp/feryal-ai')
  studioFilterState.current = {
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

function buildMinimalExifJpeg(orientation: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, littleEndian = true): Uint8Array {
  // Minimal valid JPEG SOI + APP1 Exif segment + EOI
  // TIFF header (8 bytes) + IFD0 count (2) + 1 entry for 0x0112 (12) + nextIFD (4) = 26 bytes
  const tiff = new Uint8Array(26)
  if (littleEndian) {
    tiff[0] = 0x49 // 'I'
    tiff[1] = 0x49 // 'I'
    tiff[2] = 0x2a
    tiff[3] = 0x00
    tiff[4] = 0x08 // IFD0 offset = 8
    tiff[5] = 0x00
    tiff[6] = 0x00
    tiff[7] = 0x00
    tiff[8] = 0x01 // 1 entry
    tiff[9] = 0x00
    tiff[10] = 0x12 // tag 0x0112
    tiff[11] = 0x01
    tiff[12] = 0x03 // SHORT
    tiff[13] = 0x00
    tiff[14] = 0x01 // count = 1
    tiff[15] = 0x00
    tiff[16] = 0x00
    tiff[17] = 0x00
    tiff[18] = orientation
    tiff[19] = 0x00
  } else {
    tiff[0] = 0x4d // 'M'
    tiff[1] = 0x4d // 'M'
    tiff[2] = 0x00
    tiff[3] = 0x2a
    tiff[4] = 0x00
    tiff[5] = 0x00
    tiff[6] = 0x00
    tiff[7] = 0x08 // IFD0 offset = 8
    tiff[8] = 0x00
    tiff[9] = 0x01 // 1 entry
    tiff[10] = 0x01 // tag 0x0112
    tiff[11] = 0x12
    tiff[12] = 0x00
    tiff[13] = 0x03 // SHORT
    tiff[14] = 0x00
    tiff[15] = 0x00
    tiff[16] = 0x00
    tiff[17] = 0x01 // count = 1
    tiff[18] = 0x00
    tiff[19] = orientation
  }

  // Segment length = 2 (len bytes) + 6 ("Exif\0\0") + 26 (tiff) = 34 (0x0022)
  const segLen = 2 + 6 + tiff.length
  const jpeg = new Uint8Array(2 + 2 + segLen + 2)
  jpeg[0] = 0xff
  jpeg[1] = 0xd8
  jpeg[2] = 0xff
  jpeg[3] = 0xe1
  jpeg[4] = (segLen >> 8) & 0xff
  jpeg[5] = segLen & 0xff
  // "Exif\0\0"
  jpeg[6] = 0x45
  jpeg[7] = 0x78
  jpeg[8] = 0x69
  jpeg[9] = 0x66
  jpeg[10] = 0x00
  jpeg[11] = 0x00
  jpeg.set(tiff, 12)
  jpeg[jpeg.length - 2] = 0xff
  jpeg[jpeg.length - 1] = 0xd9
  return jpeg
}

beforeEach(() => {
  odooRpcTracker.calls.length = 0
  resetProviderCooldowns()
  configureStudioFilter('month', 'all', 'all')
})

describe('Part A.1 — Strict 1-to-1 SKU Lock, Flavor/Protein Lock, Safe Normalization & Brand-Scoped Baseline', () => {
  it('normalizes Nim’s -> nims, Vege -> veg, & -> and, and cooking prep notes without relaxing size/pack or protein/spicy locks', () => {
    expect(normalizeSkuMenuLabel("Nim's Chow Mein")).toBe('nims chow mein')
    expect(normalizeSkuMenuLabel('Nim’s Chow Mein')).toBe('nims chow mein')
    expect(normalizeSkuMenuLabel('[RICG0201] Nims Chow Mein')).toBe('nims chow mein')

    expect(normalizeSkuMenuLabel('Vege Dumplings (Pan Fry & Steamed)')).toBe('veg dumplings')
    expect(normalizeSkuMenuLabel('[RICG0202] Vegetable Dumplings (Steamed & Pan Fried)')).toBe(
      'veg dumplings',
    )
    expect(normalizeSkuMenuLabel('Sweet & Sour Chicken (Crispy)')).toBe('sweet and sour chicken')

    // Never strip parentheticals that carry size/pack or protein/spicy qualifiers
    expect(normalizeSkuMenuLabel('Mixed Grill (For 6)')).toContain('for 6')
    expect(hasCompatibleSizePackTokens('Mixed Grill (For 6)', 'Mixed Grill')).toBe(false)
    expect(normalizeSkuMenuLabel('Mushroom Fried Rice (Chicken)')).toContain('chicken')
    expect(normalizeSkuMenuLabel('Spring Roll (Spicy)')).toContain('spicy')

    const cgRows: ItemPricingRow[] = [
      {
        productId: 201,
        name: '[RICG0201] Nims Chow Mein',
        qty: '280',
        netKwd: '700.000',
        unitPriceKwd: '2.500',
        categoryId: 11,
        brandId: 'china-garden',
      },
      {
        productId: 202,
        name: '[RICG0202] Vegetable Dumplings',
        qty: '200',
        netKwd: '390.000',
        unitPriceKwd: '1.950',
        categoryId: 11,
        brandId: 'china-garden',
      },
    ]

    expect(
      matchIntakeItemToOdooRow("Nim's Chow Mein", cgRows, {
        rowBrand: 'China Garden',
        sheetCurrentPriceKwd: '2.500',
      })?.productId,
    ).toBe(201)

    expect(
      matchIntakeItemToOdooRow('Vege Dumplings (Pan Fry & Steamed)', cgRows, {
        rowBrand: 'China Garden',
        sheetCurrentPriceKwd: '1.950',
      })?.productId,
    ).toBe(202)
  })

  it('enforces bidirectional Spicy lock and exact-set Protein/Base lock across EN & AR', () => {
    // Spicy vs non-spicy must never cross-match
    expect(hasCompatibleFlavorProteinTokens('Spicy Mushroom Fried Rice', '[RICG0136] Mushroom Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Mushroom Fried Rice', 'Spicy Mushroom Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('شاورما دجاج سبايسي', 'شاورما دجاج')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('بروستد دجاج حار', 'بروستد دجاج')).toBe(false)

    // Protein variants must match exact canonical protein set
    expect(hasCompatibleFlavorProteinTokens('Chicken Mushroom Fried Rice', '[RICG0136] Mushroom Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Beef Mushroom Fried Rice', '[RICG0136] Mushroom Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Shrimp Mushroom Fried Rice', '[RICG0136] Mushroom Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Mixed Mushroom Fried Rice', '[RICG0136] Mushroom Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Vege Mushroom Fried Rice', '[RICG0136] Mushroom Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Beef Fried Rice', 'Chicken Fried Rice')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Shrimp Chow Mein', 'Mixed Chow Mein')).toBe(false)
    expect(hasCompatibleFlavorProteinTokens('Vege Spring Roll', 'Chicken Spring Roll')).toBe(false)

    // Canonical synonyms ('Vege' === 'Vegetable', 'Prawn' === 'Shrimp') ARE compatible
    expect(extractFlavorProteinQualifiers('Vege Dumplings').proteins).toEqual(['veg'])
    expect(extractFlavorProteinQualifiers('Vegetable Dumplings').proteins).toEqual(['veg'])
    expect(hasCompatibleFlavorProteinTokens('Vege Dumplings', 'Vegetable Dumplings')).toBe(true)
    expect(hasCompatibleFlavorProteinTokens('Prawn Fried Rice', 'Shrimp Fried Rice')).toBe(true)
  })

  it('enforces strict 1-to-1 product_id lock with zero double-counting when multiple Mushroom Fried Rice rows compete for [RICG0136]', async () => {
    const cgOdooRows: ItemPricingRow[] = [
      {
        productId: 136,
        name: '[RICG0136] Mushroom Fried Rice',
        qty: '800',
        netKwd: '1800.000',
        unitPriceKwd: '2.250',
        categoryId: 11,
        brandId: 'china-garden',
      },
      {
        productId: 101,
        name: '[RICG0101] Sweet & Sour Chicken',
        qty: '1000',
        netKwd: '2500.000',
        unitPriceKwd: '2.500',
        categoryId: 11,
        brandId: 'china-garden',
      },
    ]

    // 5 competing Mushroom Fried Rice rows: plain exact (2.250), secondary plain/prep row (2.450), Chicken, Beef, and Spicy
    const csv = [
      'Brand,Item Name,Current Price,CH Suggested,AE Suggested',
      'China Garden,Mushroom Fried Rice,2.250,2.500,2.400',
      'China Garden,Mushroom Fried Rice (Steamed),2.450,2.750,2.600',
      'China Garden,Chicken Mushroom Fried Rice,2.650,2.950,2.850',
      'China Garden,Beef Mushroom Fried Rice,2.850,3.150,3.000',
      'China Garden,Spicy Mushroom Fried Rice,2.350,2.650,2.500',
      'China Garden,Sweet & Sour Chicken (Crispy),2.500,2.750,2.650',
    ].join('\n')

    const draft = await ingestPricingDocument(
      {
        fileName: 'cg-mushroom-rice-collision.csv',
        mimeType: 'text/csv',
        bytes: new TextEncoder().encode(csv),
        period: 'month',
        brand: 'china-garden',
      },
      { odooRowsOverride: cgOdooRows },
    )

    // Exactly ONE row wins productId=136 (row 0 with exact 2.250 price), and row 5 wins productId=101
    const matched136Rows = draft.rows.filter((r) => r.matchedOdooProductId === 136)
    expect(matched136Rows).toHaveLength(1)
    expect(matched136Rows[0]?.itemName).toBe('Mushroom Fried Rice')
    expect(matched136Rows[0]?.sheetCurrentPriceKwd).toBe('2.250')

    // Secondary plain row (Steamed @ 2.450) competed for already-claimed 136 -> marked UNMATCHED_WRONG_VARIANT (duplicate_sku_collision)
    const secondaryPlain = draft.rows[1]!
    expect(secondaryPlain.matchedOdooProductId).toBeNull()
    expect(secondaryPlain.odooQty).toBeNull()
    expect(secondaryPlain.odooNetSalesKwd).toBeNull()
    const wrongVariantFlag = secondaryPlain.anomalies.find(
      (a) => a.code === 'UNMATCHED_WRONG_VARIANT',
    )
    expect(wrongVariantFlag).toBeDefined()
    expect(wrongVariantFlag?.messageEn).toContain(UNMATCHED_WRONG_VARIANT_LABEL_EN)

    // Protein & Spicy variants are blocked by Flavor/Protein Lock -> unmatched (0 volume)
    for (const variantIdx of [2, 3, 4]) {
      expect(draft.rows[variantIdx]?.matchedOdooProductId).toBeNull()
      expect(draft.rows[variantIdx]?.odooQty).toBeNull()
    }

    // Sweet & Sour Chicken (Crispy) safely normalizes and matches 101
    expect(draft.rows[5]?.matchedOdooProductId).toBe(101)
    expect(draft.summary.matchedRows).toBe(2)

    // Even if a caller forces matchedOdooProductId=136 onto multiple ConfirmedPriceSheet rows,
    // simulateExecutivePricingOptions enforces 1-to-1 lock and NEVER double-counts 800 qty!
    const pack = buildExecutiveContextPack({
      fromIso: '2026-10-22',
      toIso: '2026-11-20',
      brandId: 'china-garden',
      rows: cgOdooRows,
    })
    const confirmed = confirmDocumentIntakeDraft(draft, '2026-11-20T06:10:00.000Z')
    const forcedDuplicateIds: ConfirmedPriceSheet = {
      ...confirmed,
      rows: confirmed.rows.map((r, i) => (i < 5 ? { ...r, matchedOdooProductId: 136 } : r)),
    }

    const sim = simulateExecutivePricingOptions({ pack, sheet: forcedDuplicateIds })
    const chOpt = sim.options.find((o) => o.optionKey === 'ch_suggested')!
    expect(chOpt.matchedSkuCount).toBe(2)
    expect(chOpt.unmatchedRowCount).toBe(4)

    // Baseline = 800*2.250 (1,800) + 1000*2.500 (2,500) = 4,300.000 KWD (zero double-counting!)
    expect(chOpt.baselineRevenueKwd).toBe('4300.000')
    // Base delta = 800*(2.500-2.250)=+200.000 + 1000*(2.750-2.500)=+250.000 => +450.000 KWD
    expect(chOpt.baseDeltaKwd).toBe('450.000')

    const directAssignments = enforceOneToOneSkuMatches(
      [
        { rowIndex: 0, itemName: 'Mushroom Fried Rice', brand: 'China Garden', currentPriceKwd: '2.250' },
        { rowIndex: 1, itemName: 'Mushroom Fried Rice (Pan Fried)', brand: 'China Garden', currentPriceKwd: '2.400' },
      ],
      [
        {
          productId: 136,
          name: '[RICG0136] Mushroom Fried Rice',
          unitPriceKwd: '2.250',
          netSalesKwd: '1800.000',
          brandId: 'china-garden',
        },
      ],
      { contextBrand: 'china-garden' },
    )
    expect(directAssignments[0]).toMatchObject({ matched: true, productId: 136 })
    expect(directAssignments[1]).toMatchObject({
      matched: false,
      productId: null,
      rejectedWrongVariant: true,
    })
  })

  it('restricts candidate SKUs and baseline revenue strictly to the inferred Brand scope', () => {
    const mixedCompanyRows: ItemPricingRow[] = [
      {
        productId: 101,
        name: '[RICG0101] Sweet & Sour Chicken',
        qty: '1000',
        netKwd: '2500.000',
        unitPriceKwd: '2.500',
        categoryId: 11,
        brandId: 'china-garden',
      },
      {
        productId: 801,
        name: '[RIKC001] Karak Tea',
        qty: '4000',
        netKwd: '1200.000',
        unitPriceKwd: '0.300',
        categoryId: 40,
        brandId: 'karak-cafeteria',
      },
      {
        productId: 901,
        name: '[RIFR005] Brisket Burger',
        qty: '900',
        netKwd: '3150.000',
        unitPriceKwd: '3.500',
        categoryId: 20,
        brandId: 'franks',
      },
    ]

    const cgSheet: ConfirmedPriceSheet = {
      draftId: 'cg-only-sheet',
      fileName: 'china-garden-repricing.xlsx',
      sourceTag: USER_INPUT_CONFIRMED_LABEL,
      confirmedAtIso: '2026-11-20T06:00:00.000Z',
      rows: [
        {
          rowId: 'r1',
          brand: 'China Garden',
          itemName: 'Sweet & Sour Chicken',
          currentPriceKwd: '2.500',
          proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.700' }],
          matchedOdooProductId: 101,
        },
        {
          rowId: 'r2',
          brand: 'China Garden',
          itemName: 'Brisket Burger',
          currentPriceKwd: '3.500',
          proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '3.750' }],
          matchedOdooProductId: 901,
        },
      ],
    }

    expect(inferConfirmedSheetBrandId(cgSheet)).toBe('china-garden')
    expect(inferBrandIdFromConfirmedSheet(cgSheet)).toBe('china-garden')

    // Scoped pack excludes Karak & Frank's from totalNetSalesKwd
    const scopedPack = buildExecutiveContextPack({
      fromIso: '2026-10-22',
      toIso: '2026-11-20',
      brandId: inferConfirmedSheetBrandId(cgSheet),
      rows: mixedCompanyRows,
    })
    expect(scopedPack.totals.totalNetSalesKwd).toBe('2500.000')
    expect(scopedPack.skus.map((s) => s.productId)).toEqual([101])

    // Even on an unscoped pack, simulateExecutivePricingOptions infers China Garden from the sheet and blocks Frank's 901!
    const unscopedPack = buildExecutiveContextPack({
      fromIso: '2026-10-22',
      toIso: '2026-11-20',
      brandId: null,
      rows: mixedCompanyRows,
    })
    const sim = simulateExecutivePricingOptions({ pack: unscopedPack, sheet: cgSheet })
    expect(sim.options[0]?.matchedSkuCount).toBe(1)
    expect(sim.options[0]?.baselineRevenueKwd).toBe('2500.000')
  })
})

describe("Part B.5 — Deterministic Feryal Rec. KWD (0.050 KWD Steps), Executive Opinion & 0 GUARD_REJECTED False Positives", () => {
  const cgPackRows: ItemPricingRow[] = [
    {
      productId: 101,
      name: '[RICG0101] Sweet & Sour Chicken',
      qty: '1000',
      netKwd: '2500.000',
      unitPriceKwd: '2.500',
      categoryId: 11,
      brandId: 'china-garden',
    },
    {
      productId: 136,
      name: '[RICG0136] Mushroom Fried Rice',
      qty: '800',
      netKwd: '1800.000',
      unitPriceKwd: '2.250',
      categoryId: 11,
      brandId: 'china-garden',
    },
    {
      productId: 201,
      name: '[RICG0201] Nims Chow Mein',
      qty: '300',
      netKwd: '750.000',
      unitPriceKwd: '2.500',
      categoryId: 11,
      brandId: 'china-garden',
    },
    {
      productId: 202,
      name: '[RICG0202] Vegetable Dumplings',
      qty: '100',
      netKwd: '195.000',
      unitPriceKwd: '1.950',
      categoryId: 11,
      brandId: 'china-garden',
    },
  ]

  function makeCgPack() {
    return buildExecutiveContextPack({
      fromIso: '2026-10-22',
      toIso: '2026-11-20',
      brandId: 'china-garden',
      rows: cgPackRows,
      liveSummary: {
        source: 'live',
        connected: true,
        sourceMode: 'odoo17-live',
        noData: false,
        lastSyncAt: '2026-11-20T06:00:00.000Z',
        isStale24h: false,
        odooCompanyId: 1,
        dateRange: { from: '2026-10-22', to: '2026-11-20' },
        syncedAt: '2026-11-20T06:00:00.000Z',
        period: { from: '2026-10-22', to: '2026-11-20' },
        database: null,
        totals: { netSalesKwd: 5390, orders: 1280, aovKwd: 4.211 },
        brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 5390, sharePct: 100 }],
        branches: [
          { id: '360-mall', name: '360 Mall', unit: 'مول 360', netSalesKwd: 3200, orders: 760, sharePct: 59.37 },
          { id: 'avenues', name: 'Avenues', unit: 'الأفنيوز', netSalesKwd: 2190, orders: 520, sharePct: 40.63 },
        ],
        channels: [
          { name: 'talabat', amountKwd: 3500 },
          { name: 'dine-in', amountKwd: 1890 },
        ],
      },
    })
  }

  it('rounds strictly to 0.050 KWD increments, caps Tier-A hikes with channel-split, approves Tier-B/C, and renders top-of-report Executive Opinion with 0 GUARD_REJECTED', () => {
    expect(formatKuwaitFils50(Decimal.parse('2.724')!)).toBe('2.700')
    expect(formatKuwaitFils50(Decimal.parse('2.726')!)).toBe('2.750')
    expect(roundToKuwaitFils50(Decimal.parse('1.976')!).canonical()).toBe('2')

    const pack = makeCgPack()

    // Case 1: Partially Agree (Recommended) — aggressive Tier-A hike (+24% on 101: 2.500 -> 3.100) + disciplined Tier-B/C increases
    const partialSheet: ConfirmedPriceSheet = {
      draftId: 'cg-v2-partial',
      fileName: 'cg-menu-v2.xlsx',
      sourceTag: USER_INPUT_CONFIRMED_LABEL,
      confirmedAtIso: '2026-11-20T06:15:00.000Z',
      brandId: 'china-garden',
      rows: [
        {
          rowId: 'r1',
          brand: 'China Garden',
          itemName: 'Sweet & Sour Chicken',
          currentPriceKwd: '2.500',
          proposedOptions: [
            { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '3.100' },
            { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.950' },
          ],
          matchedOdooProductId: 101,
        },
        {
          rowId: 'r2',
          brand: 'China Garden',
          itemName: 'Mushroom Fried Rice',
          currentPriceKwd: '2.250',
          proposedOptions: [
            { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '2.650' },
            { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.450' },
          ],
          matchedOdooProductId: 136,
        },
        {
          rowId: 'r3',
          brand: 'China Garden',
          itemName: "Nim's Chow Mein",
          currentPriceKwd: '2.500',
          proposedOptions: [
            { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '2.720' },
            { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.650' },
          ],
          matchedOdooProductId: 201,
        },
        {
          rowId: 'r4',
          brand: 'China Garden',
          itemName: 'Vege Dumplings (Pan Fry & Steamed)',
          currentPriceKwd: '1.950',
          proposedOptions: [
            { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '2.110' },
            { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.050' },
          ],
          matchedOdooProductId: 202,
        },
      ],
    }

    const sim = simulateExecutivePricingOptions({ pack, sheet: partialSheet })
    expect(sim.executiveVerdictBadge).toBe('Partially Agree (Recommended)')
    expect(sim.feryalRecommendedPortfolio).not.toBeNull()
    expect(sim.feryalRecommendedPortfolio?.channelSplitSkuCount).toBeGreaterThanOrEqual(1)

    // Verify EVERY matched line has feryalRecKwd strictly divisible by 0.050 KWD
    for (const opt of sim.options) {
      for (const line of opt.lines) {
        if (!line.matched) continue
        expect(line.feryalRecKwd).toMatch(/^\d+\.(?:\d00|\d50)$/)
      }
    }

    const chOpt = sim.options.find((o) => o.optionKey === 'ch_suggested')!
    const sweetSourCh = chOpt.lines.find((l) => l.productId === 101)!
    // Tier-A 2.500 -> 3.100 (+24% > 15%) => capped at safe psychological anchor <= 10% (2.750 KWD) with channelSplitRecommended = true
    expect(sweetSourCh.abcTier).toBe('A')
    expect(sweetSourCh.feryalRecKwd).toBe('2.750')
    expect(sweetSourCh.channelSplitRecommended).toBe(true)

    // Mushroom Fried Rice (Tier A, 2.250): CH is 2.650 (+17.78%) while AE Suggested is 2.450 (+8.89% <= 10%) => prefers milder 2.450 KWD!
    const mushroomCh = chOpt.lines.find((l) => l.productId === 136)!
    expect(mushroomCh.abcTier).toBe('A')
    expect(mushroomCh.feryalRecKwd).toBe('2.450')
    expect(mushroomCh.channelSplitRecommended).toBe(true)

    // Tier-B/C items: 2.720 -> 2.700 KWD and 2.110 -> 2.100 KWD (approved & rounded to 0.050 KWD)
    const chowMeinCh = chOpt.lines.find((l) => l.productId === 201)!
    expect(chowMeinCh.abcTier).toBe('B')
    expect(chowMeinCh.feryalRecKwd).toBe('2.700')

    const dumplingsCh = chOpt.lines.find((l) => l.productId === 202)!
    expect(dumplingsCh.abcTier).toBe('C')
    expect(dumplingsCh.feryalRecKwd).toBe('2.100')

    // Verify EN and AR deterministic briefs start with Feryal's Executive Opinion & Justification,
    // contain Feryal Rec. KWD column, and pass BOTH verifyFeryalReplyNumbers & reviewGroundedNumbers!
    const grounded = collectExecutiveGroundedNumbers(pack, sim)
    const executiveFacts = {
      toolNumbers: grounded.toolNumbers,
      simulationNumbers: grounded.simulationNumbers,
      canonicalDecimals: grounded.canonicalDecimals,
      labeledFacts: grounded.labeledFacts,
      cogsReadable: false,
    }

    const enBrief = renderDeterministicExecutiveBrief(pack, sim, 'en', false)
    expect(enBrief.startsWith("## Feryal's Executive Opinion & Justification")).toBe(true)
    expect(enBrief).toContain('Verdict: Partially Agree (Recommended)')
    expect(enBrief).toContain(KUWAIT_MARKET_STRATEGY_TAG_EN)
    expect(enBrief).toContain(ODOO_VERIFIED_ACTUAL_TAG)
    expect(enBrief).toContain(DETERMINISTIC_SIMULATION_TAG)
    expect(enBrief).toContain('| Feryal Rec. KWD | Action |')

    const enVerified = verifyFeryalReplyNumbers(enBrief, grounded.toolNumbers, {
      allowedDateStrings: ['2026-10-22', '2026-11-20'],
      allowedEntityNames: grounded.allowedEntityNames,
    })
    expect(enVerified.unverifiedNumbers).toEqual([])
    expect(enVerified.valid).toBe(true)

    const enGuard = reviewGroundedNumbers(enBrief, executiveFacts, {
      simulationNumbers: grounded.simulationNumbers,
      allowedDecimals: grounded.canonicalDecimals,
      allowedEntityNames: grounded.allowedEntityNames,
      forbidPosCogsMarginClaims: true,
      executiveBriefMode: true,
    })
    expect(enGuard).toEqual({ ok: true, offending: [] })
    expect(guardAnswerAgainstFacts(enBrief, grounded.labeledFacts).ok).toBe(true)

    const arBrief = renderDeterministicExecutiveBrief(pack, sim, 'ar', false)
    expect(arBrief.startsWith('## رأي فريال التنفيذي والمبررات الإدارية')).toBe(true)
    expect(arBrief).toContain('Verdict: Partially Agree (Recommended)')
    expect(arBrief).toContain(KUWAIT_MARKET_STRATEGY_TAG_AR)
    expect(arBrief).toContain('سعر فريال الموصى د.ك')

    const arGuard = reviewGroundedNumbers(arBrief, executiveFacts, {
      simulationNumbers: grounded.simulationNumbers,
      allowedDecimals: grounded.canonicalDecimals,
      allowedEntityNames: grounded.allowedEntityNames,
      forbidPosCogsMarginClaims: true,
      executiveBriefMode: true,
    })
    expect(arGuard).toEqual({ ok: true, offending: [] })

    // Verify anti-hallucination remains 100% strict (fabricated KWD or COGS/margin still rejected!)
    const hallucinated = reviewGroundedNumbers(
      `${enBrief}\nExtra unverified profit +918.273 KWD.`,
      executiveFacts,
      {
        simulationNumbers: grounded.simulationNumbers,
        allowedDecimals: grounded.canonicalDecimals,
        allowedEntityNames: grounded.allowedEntityNames,
        forbidPosCogsMarginClaims: true,
        executiveBriefMode: true,
      },
    )
    expect(hallucinated.ok).toBe(false)
    expect(hallucinated.offending).toContain('918.273')
  })

  it('produces Agree verdict on disciplined <=10% increases and Disagree verdict when majority volume has typos', () => {
    const pack = makeCgPack()

    const agreeSim = simulateExecutivePricingOptions({
      pack,
      sheet: {
        draftId: 'cg-agree',
        fileName: 'cg-disciplined.xlsx',
        sourceTag: USER_INPUT_CONFIRMED_LABEL,
        confirmedAtIso: '2026-11-20T06:20:00.000Z',
        rows: [
          {
            rowId: 'a1',
            brand: 'China Garden',
            itemName: 'Sweet & Sour Chicken',
            currentPriceKwd: '2.500',
            proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.700' }],
            matchedOdooProductId: 101,
          },
          {
            rowId: 'a2',
            brand: 'China Garden',
            itemName: 'Mushroom Fried Rice',
            currentPriceKwd: '2.250',
            proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.450' }],
            matchedOdooProductId: 136,
          },
        ],
      },
    })
    expect(agreeSim.executiveVerdictBadge).toBe('Agree')
    expect(renderDeterministicExecutiveBrief(pack, agreeSim, 'en', false)).toContain('Verdict: Agree')

    const disagreeSim = simulateExecutivePricingOptions({
      pack,
      sheet: {
        draftId: 'cg-disagree',
        fileName: 'cg-typo.xlsx',
        sourceTag: USER_INPUT_CONFIRMED_LABEL,
        confirmedAtIso: '2026-11-20T06:21:00.000Z',
        rows: [
          {
            rowId: 'd1',
            brand: 'China Garden',
            itemName: 'Sweet & Sour Chicken',
            currentPriceKwd: '2.500',
            proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '0.250' }],
            matchedOdooProductId: 101,
          },
          {
            rowId: 'd2',
            brand: 'China Garden',
            itemName: 'Mushroom Fried Rice',
            currentPriceKwd: '2.250',
            proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.400' }],
            matchedOdooProductId: 136,
          },
        ],
      },
    })
    expect(disagreeSim.executiveVerdictBadge).toBe('Disagree')
    // Typo row holds Feryal Rec. KWD at rounded baseline 2.500 KWD
    const typoLine = disagreeSim.options[0]?.lines.find((l) => l.productId === 101)
    expect(typoLine?.feryalRecKwd).toBe('2.500')
    expect(typoLine?.feryalRecDeltaKwd).toBe('0.000')
    expect(renderDeterministicExecutiveBrief(pack, disagreeSim, 'en', false)).toContain('Verdict: Disagree')
  })
})

describe('Part B.4 — Persistent Confirmed Price-Sheet Context Across Thread DB, Studio State & Follow-Up Questions', () => {
  const confirmedCgSheet: ConfirmedPriceSheet = {
    draftId: 'draft-followup-cg',
    fileName: 'china-garden-nov-sheet.xlsx',
    sourceTag: USER_INPUT_CONFIRMED_LABEL,
    confirmedAtIso: '2026-11-20T06:30:00.000Z',
    brandId: 'china-garden',
    rows: [
      {
        rowId: 'r1',
        brand: 'China Garden',
        itemName: 'Sweet & Sour Chicken',
        currentPriceKwd: '2.500',
        proposedOptions: [
          { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '3.000' },
          { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.700' },
        ],
        matchedOdooProductId: 101,
      },
      {
        rowId: 'r2',
        brand: 'China Garden',
        itemName: 'Mushroom Fried Rice',
        currentPriceKwd: '2.250',
        proposedOptions: [
          { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '2.650' },
          { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.450' },
        ],
        matchedOdooProductId: 136,
      },
      {
        rowId: 'r3',
        brand: 'China Garden',
        itemName: "Nim's Chow Mein",
        currentPriceKwd: '2.500',
        proposedOptions: [
          { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '2.700' },
          { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.650' },
        ],
        matchedOdooProductId: 201,
      },
    ],
  }

  it('detects confirmed-sheet follow-up questions in EN & AR/Gulf while allowing unrelated operational escape', () => {
    expect(
      isConfirmedSheetFollowUpQuestion(
        'Do you agree with these increases? Provide your recommended pricing and a short paragraph justification',
      ),
    ).toBe(true)
    expect(isConfirmedSheetFollowUpQuestion('Do you agree with these increases?')).toBe(true)
    expect(isConfirmedSheetFollowUpQuestion('Provide your recommended pricing and a short paragraph justification')).toBe(true)
    expect(isConfirmedSheetFollowUpQuestion('Why did you cap Sweet & Sour Chicken?')).toBe(true)
    expect(isConfirmedSheetFollowUpQuestion('هل توافقين على هذه الزيادات؟')).toBe(true)
    expect(isConfirmedSheetFollowUpQuestion('شنو رأيج بالأسعار المقترحة؟')).toBe(true)

    // Unrelated operational HR query escapes sheet lock cleanly
    expect(isConfirmedSheetFollowUpQuestion('Show HR employee attendance and overtime payroll')).toBe(false)
  })

  it('persists activePriceSheetContext & frozenScope in /api/erp/feryal/threads DB store and grounds follow-up questions in runFeryalCouncil & POST /api/erp/feryal/chat without falling back to generic Pareto', async () => {
    const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')

    if (adminToken.length > 0) {
      const activeSheetContext: ActivePriceSheetThreadContext = {
        confirmedPriceSheet: confirmedCgSheet,
        confirmedAtIso: confirmedCgSheet.confirmedAtIso,
        fileName: confirmedCgSheet.fileName,
        brandScope: 'China Garden',
        periodLabel: 'Last 30 Days',
        dateFrom: '2026-10-22',
        dateTo: '2026-11-20',
        matchedSkuCount: 3,
        summaryMarkdown: 'Initial China Garden 3-scenario analysis completed.',
      }

      const threadPayload: FeryalChatThread = {
        id: 'thread-pricing-v2-followup',
        title: 'China Garden Pricing Sheet Review',
        notebookId: 'nb-branches-pricing',
        pinned: false,
        lang: 'en',
        messageCount: 2,
        previewText: 'Initial executive pricing analysis',
        searchableCorpus: 'China Garden Sweet & Sour Chicken Mushroom Fried Rice',
        createdAt: '2026-11-20T06:30:00.000Z',
        updatedAt: '2026-11-20T06:31:00.000Z',
        activePriceSheetContext: activeSheetContext,
        messages: [
          {
            id: 'u1',
            sender: 'user',
            text: 'Run executive pricing simulation on china-garden-nov-sheet.xlsx',
            time: '09:30',
          },
          {
            id: 'f1',
            sender: 'feryal',
            text: "## Feryal's Executive Opinion & Justification\n- **Verdict: Partially Agree (Recommended)**",
            time: '09:30',
            frozenScope: {
              periodKey: 'month',
              periodLabel: 'Last 30 Days',
              dateFrom: '2026-10-22',
              dateTo: '2026-11-20',
              brandScope: 'China Garden',
            },
          },
        ],
      }

      // 1. Persist thread to POST /api/erp/feryal/threads
      const saveRes = await threadsPost(
        new NextRequest('https://aetherbi.com/api/erp/feryal/threads', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
          },
          body: JSON.stringify({ thread: threadPayload }),
        }),
      )
      expect(saveRes.status).toBe(200)

      // 2. Read back from GET /api/erp/feryal/threads?id=...
      const loadRes = await threadsGet(
        new NextRequest('https://aetherbi.com/api/erp/feryal/threads?id=thread-pricing-v2-followup', {
          method: 'GET',
          headers: { cookie: `${EXEC_SESSION_COOKIE}=${adminToken}` },
        }),
      )
      expect(loadRes.status).toBe(200)
      const loadJson = (await loadRes.json()) as { ok: boolean; thread: FeryalChatThread | null }
      expect(loadJson.ok).toBe(true)
      expect(loadJson.thread?.activePriceSheetContext?.confirmedPriceSheet.draftId).toBe(
        'draft-followup-cg',
      )
      expect(loadJson.thread?.activePriceSheetContext?.brandScope).toBe('China Garden')
      expect(loadJson.thread?.messages[1]?.frozenScope).toMatchObject({
        periodLabel: 'Last 30 Days',
        dateFrom: '2026-10-22',
        dateTo: '2026-11-20',
        brandScope: 'China Garden',
      })

      // 3. Build follow-up request body via Studio helper even when top Brand filter is 'all'
      const followUpQuestion =
        'Do you agree with these increases? Provide your recommended pricing and a short paragraph justification'
      const followUpPostBody = buildFeryalStudioTurnPostBody({
        question: followUpQuestion,
        filters: { period: 'month', branch: 'all', brand: 'all', channel: 'all' },
        activePriceSheetContext: loadJson.thread!.activePriceSheetContext!,
      })
      expect(followUpPostBody.isFollowUpOnConfirmedSheet).toBe(true)
      expect(followUpPostBody.brand).toBe('china-garden')
      expect(followUpPostBody.confirmedPriceSheet).toBeDefined()

      // 4. Verify Active Price Sheet pill renders in FeryalGovernanceStudio
      const studioWithPillHtml = renderWithLocale(
        'en',
        React.createElement(FeryalGovernanceStudio, {
          sessionRole: 'admin',
          initialMainTab: 'chat',
          initialActivePriceSheetContext: activeSheetContext,
        }),
      )
      expect(studioWithPillHtml).toContain('data-active-price-sheet-pill="true"')
      expect(studioWithPillHtml).toContain('china-garden-nov-sheet.xlsx')
      expect(studioWithPillHtml).toContain('data-detach-price-sheet="true"')

      // 5. Execute follow-up turn against POST /api/erp/feryal/chat (deterministic verified fallback when keys unset)
      const prevKeys = {
        anthropic: process.env.ANTHROPIC_API_KEY,
        gemini: process.env.GEMINI_API_KEY,
        xai: process.env.XAI_API_KEY,
      }
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.GEMINI_API_KEY
      delete process.env.XAI_API_KEY
      try {
        const chatRes = await chatPost(
          new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
            },
            body: JSON.stringify(followUpPostBody),
          }),
        )
        expect(chatRes.status).toBe(200)
        const chatJson = (await chatRes.json()) as {
          ok: boolean
          status: string
          reply: string
          verifier: { valid: boolean; unverifiedNumbers: number[] }
          frozenScope: { periodLabel: string; dateFrom: string; dateTo: string; brandScope: string }
          activePriceSheetSummary: { draftId: string; matchedRows: number; brandScope: string } | null
        }
        expect(chatJson.ok).toBe(true)
        expect(chatJson.status).toBe('answered')
        expect(chatJson.verifier.valid).toBe(true)
        expect(chatJson.verifier.unverifiedNumbers).toEqual([])
        // Grounded in confirmed price sheet + Feryal Rec. KWD + Executive Opinion (never generic sheet-less Pareto!)
        expect(chatJson.reply).toContain("## Feryal's Executive Opinion & Justification")
        expect(chatJson.reply).toContain('Verdict: Partially Agree (Recommended)')
        expect(chatJson.reply).toContain('Feryal Rec. KWD')
        expect(chatJson.reply).toContain(KUWAIT_MARKET_STRATEGY_TAG_EN)
        expect(chatJson.reply).not.toContain('Top SKUs by POS Net Revenue')
        expect(chatJson.frozenScope.brandScope).toBe('China Garden')
        expect(chatJson.activePriceSheetSummary).toMatchObject({
          draftId: 'draft-followup-cg',
          matchedRows: 3,
          brandScope: 'China Garden',
        })
        expect(JSON.stringify(odooRpcTracker.calls)).not.toContain('standard_price')
      } finally {
        if (prevKeys.anthropic !== undefined) process.env.ANTHROPIC_API_KEY = prevKeys.anthropic
        if (prevKeys.gemini !== undefined) process.env.GEMINI_API_KEY = prevKeys.gemini
        if (prevKeys.xai !== undefined) process.env.XAI_API_KEY = prevKeys.xai
      }

      // 6. Verify runFeryalCouncil also injects FOLLOW-UP EXECUTIVE QUESTION ON CONFIRMED PRICE SHEET into LLM prompts
      let capturedUserPrompt = ''
      const pack = buildExecutiveContextPack({
        fromIso: '2026-10-22',
        toIso: '2026-11-20',
        brandId: 'china-garden',
        rows: [
          { productId: 101, name: '[RICG0101] Sweet & Sour Chicken', qty: '1000', netKwd: '2500.000', unitPriceKwd: '2.500', categoryId: 11, brandId: 'china-garden' },
          { productId: 136, name: '[RICG0136] Mushroom Fried Rice', qty: '800', netKwd: '1800.000', unitPriceKwd: '2.250', categoryId: 11, brandId: 'china-garden' },
          { productId: 201, name: '[RICG0201] Nims Chow Mein', qty: '280', netKwd: '700.000', unitPriceKwd: '2.500', categoryId: 11, brandId: 'china-garden' },
        ],
      })
      const sim = simulateExecutivePricingOptions({ pack, sheet: confirmedCgSheet })
      const deterministicReply = renderDeterministicExecutiveBrief(pack, sim, 'en', false)

      const councilFollowUp = await runFeryalCouncil(
        {
          question: followUpQuestion,
          userId: 'gm-1',
          userRole: 'admin',
          confirmedPriceSheet: confirmedCgSheet,
          isFollowUpOnConfirmedSheet: true,
        },
        {
          executivePack: pack,
          persist: async () => undefined,
          sleepImpl: async () => undefined,
          keys: {
            anthropic: 'test-anthropic-key-00001',
            google: 'test-google-key-00000001',
            xai: 'test-xai-grok-key-000001',
          },
          models: {
            anthropic: 'claude-sonnet-4-6',
            google: 'gemini-3.1-pro-preview',
            xai: 'grok-4',
          },
          fetchImpl: async (input, init) => {
            const url = String(input)
            const rawBody = JSON.parse(String(init?.body ?? '{}')) as {
              messages?: Array<{ role?: string; content?: string }>
            }
            if (url.includes('api.anthropic.com')) {
              capturedUserPrompt = rawBody.messages?.[0]?.content ?? ''
              return Response.json({
                model: 'claude-sonnet-4-6-20251101',
                content: [{ type: 'text', text: deterministicReply }],
                usage: { input_tokens: 300, output_tokens: 400 },
              })
            }
            if (url.includes('generativelanguage.googleapis.com')) {
              return Response.json({
                modelVersion: 'gemini-3.1-pro-preview-001',
                candidates: [{ content: { parts: [{ text: deterministicReply }] } }],
                usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 400 },
              })
            }
            return Response.json({
              model: 'grok-4-0709',
              choices: [{ message: { content: deterministicReply } }],
              usage: { prompt_tokens: 300, completion_tokens: 400 },
            })
          },
        },
      )
      expect(capturedUserPrompt).toContain(followUpQuestion)
      expect(councilFollowUp.status).toBe('answered')
      expect(councilFollowUp.verifier.valid).toBe(true)
      expect(councilFollowUp.reply).toContain('Feryal Rec. KWD')

      // Clean up test thread in DB
      await threadsDelete(
        new NextRequest('https://aetherbi.com/api/erp/feryal/threads?id=thread-pricing-v2-followup', {
          method: 'DELETE',
          headers: { cookie: `${EXEC_SESSION_COOKIE}=${adminToken}` },
        }),
      )
    }
  })
})

describe('Part A.2, A.3 & B.6 — Frozen Scope Snapshot, Horizontal Table Scroll, Collapsible Diagnostics & Rotated Multi-Table Image Intake', () => {
  it('freezes historical message Scope: header against subsequent top Period/Brand filter changes and wraps wide Markdown tables in horizontal scroll', () => {
    const snapAtRequest = captureRequestStartFrozenScope({
      periodKey: 'month',
      dateFrom: '2026-10-22',
      dateTo: '2026-11-20',
      brandId: 'china-garden',
      branchId: 'all',
      channelId: 'all',
      isAr: false,
    })
    expect(formatFrozenScopeBadgeText(snapAtRequest, false)).toBe(
      'Scope: China Garden · Last 30 Days (2026-10-22 → 2026-11-20)',
    )

    const playbookMarkdown = [
      "## Feryal's Executive Opinion & Justification",
      '- **Verdict: Partially Agree (Recommended)**',
      '### Actionable SKU / Operational Playbook',
      '| Item | Tier | Qty | Current KWD | Proposed KWD | Change % | Base KWD | Conservative KWD | Stress-Test KWD | Feryal Rec. KWD | Action |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| [RICG0101] Sweet & Sour Chicken | A | 1,000 | 2.500 | 3.100 | +24.00% | +600.000 | +445.000 | +290.000 | 2.750 | Hold / Protect Traffic [Channel-Split] |',
    ].join('\n')

    const historicalMessages: ChatUiMessage[] = [
      {
        id: 'hist-user-1',
        sender: 'user',
        text: 'Analyze China Garden last 30 days',
        time: '09:00',
      },
      {
        id: 'hist-feryal-1',
        sender: 'feryal',
        text: playbookMarkdown,
        time: '09:01',
        replyStatus: 'answered',
        frozenScope: snapAtRequest,
      },
    ]

    // Render initially under Last 30 Days + China Garden
    configureStudioFilter('month', 'china-garden', 'all')
    const beforeFilterChangeHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialMessages: historicalMessages,
      }),
    )
    expect(beforeFilterChangeHtml).toContain('data-frozen-scope="true"')
    expect(beforeFilterChangeHtml).toContain(
      'Scope: China Garden · Last 30 Days (2026-10-22 → 2026-11-20)',
    )

    // Now switch top global filters to Today (2026-11-20) + Karak Cafeteria!
    configureStudioFilter('today', 'karak-cafeteria', 'salmiya')
    const afterFilterChangeHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialMessages: historicalMessages,
      }),
    )
    // Historical message Scope: badge MUST remain 100% frozen!
    expect(afterFilterChangeHtml).toContain('data-frozen-scope="true"')
    expect(afterFilterChangeHtml).toContain('data-scope-brand="China Garden"')
    expect(afterFilterChangeHtml).toContain('data-scope-from="2026-10-22"')
    expect(afterFilterChangeHtml).toContain('data-scope-to="2026-11-20"')
    expect(afterFilterChangeHtml).toContain(
      'Scope: China Garden · Last 30 Days (2026-10-22 → 2026-11-20)',
    )

    // Verify horizontal table scroll wrapper & nowrap cells in FeryalStudioMessage
    const msgHtml = renderToStaticMarkup(
      React.createElement(FeryalStudioMessage, {
        text: playbookMarkdown,
        frozenScope: snapAtRequest,
        isAr: false,
      }),
    )
    expect(msgHtml).toContain('data-feryal-table-scroll="true"')
    expect(msgHtml).toContain('w-full overflow-x-auto rounded-lg border border-slate-200/80')
    expect(msgHtml).toContain('my-3')
    expect(msgHtml).toContain('min-w-max')
    expect(msgHtml).toContain('whitespace-nowrap tabular-nums')
    expect(shouldNowrapPlaybookCell('Feryal Rec. KWD', '2.750')).toBe(true)
    expect(shouldNowrapPlaybookCell('Action', 'Hold / Protect Traffic [Channel-Split]')).toBe(true)
  })

  it('hides raw technical provider error badges behind collapsible Diagnostics toggle and tracks provider cooldown health', async () => {
    expect(isTechnicalProviderBadge('anthropic · error · TIMEOUT')).toBe(true)
    expect(isTechnicalProviderBadge('google · error · HTTP_RATE_LIMIT')).toBe(true)
    expect(isTechnicalProviderBadge('anthropic/claude-sonnet-4-6 · xai/grok-4')).toBe(true)

    const messageWithErrors: ChatUiMessage = {
      id: 'diag-msg-1',
      sender: 'feryal',
      text: "## Feryal's Executive Opinion & Justification\n- **Verdict: Agree**",
      time: '09:15',
      replyStatus: 'answered',
      providerBadge: 'xai/grok-4',
      council: [
        {
          provider: 'anthropic',
          modelId: 'claude-sonnet-4-6',
          status: 'error',
          errorCode: 'TIMEOUT',
        },
        {
          provider: 'google',
          modelId: 'gemini-3.1-pro-preview',
          status: 'error',
          errorCode: 'HTTP_RATE_LIMIT',
        },
        {
          provider: 'xai',
          modelId: 'grok-4',
          status: 'ok',
          errorCode: null,
        },
      ],
      verifier: {
        valid: true,
        extractedNumbers: [2.5, 2.7],
        unverifiedNumbers: [],
      },
    }

    // Closed by default: manager sees clean header + subtle Diagnostics toggle, ZERO raw error codes!
    const closedHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialMessages: [messageWithErrors],
      }),
    )
    expect(closedHtml).toContain('data-feryal-diagnostics-toggle="true"')
    expect(closedHtml).toContain('aria-expanded="false"')
    expect(closedHtml).not.toContain('data-feryal-diagnostics-panel="true"')
    expect(closedHtml).not.toContain('TIMEOUT')
    expect(closedHtml).not.toContain('HTTP_RATE_LIMIT')
    expect(closedHtml).not.toContain('claude-sonnet-4-6')

    // Expanded when clicked/opened: reveals full provider telemetry inside Diagnostics panel
    const openedHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialMessages: [messageWithErrors],
        initialOpenDiagnosticsIds: ['diag-msg-1'],
      }),
    )
    expect(openedHtml).toContain('aria-expanded="true"')
    expect(openedHtml).toContain('data-feryal-diagnostics-panel="true"')
    expect(openedHtml).toContain('TIMEOUT')
    expect(openedHtml).toContain('HTTP_RATE_LIMIT')

    // Verify provider cooldown tracking & health ordering in providers.ts
    resetProviderCooldowns()
    const baseNow = 1_700_000_000_000
    const rateLimited = await callProvider({
      provider: 'google',
      apiKey: 'test-google-key-00000001',
      model: 'gemini-3.1-pro-preview',
      system: 'sys',
      user: 'usr',
      timeoutMs: 3_000,
      enableCooldown: true,
      nowMs: baseNow,
      sleepImpl: async () => undefined,
      fetchImpl: async () => new Response('{}', { status: 429, headers: { 'retry-after': '0' } }),
    })
    expect(rateLimited.errorCode).toBe('HTTP_RATE_LIMIT')
    expect(isProviderInCooldown('google', baseNow + 5_000)).toBe(true)
    expect(isProviderInCooldown('google', baseNow + 60_000)).toBe(false)

    // Re-trigger at baseNow + 10_000 and verify orderProvidersByHealth places cooled-down provider last
    await callProvider({
      provider: 'google',
      apiKey: 'test-google-key-00000001',
      model: 'gemini-3.1-pro-preview',
      system: 'sys',
      user: 'usr',
      timeoutMs: 3_000,
      enableCooldown: true,
      nowMs: baseNow + 10_000,
      sleepImpl: async () => undefined,
      fetchImpl: async () => new Response('{}', { status: 429, headers: { 'retry-after': '0' } }),
    })
    const snapshot = getProviderCooldownSnapshot(baseNow + 15_000)
    expect(snapshot.google.inCooldown).toBe(true)
    const ordered = orderProvidersByHealth(['google', 'anthropic', 'xai'], baseNow + 15_000)
    expect(ordered[ordered.length - 1]).toBe('google')
    resetProviderCooldowns()
  })

  it('detects JPEG EXIF orientations (1, 3, 6, 8) in LE & BE and extracts multi-table printed menu sheets ignoring Increase delta column', async () => {
    for (const [orientation, expectedDeg] of [
      [1, 0],
      [3, 180],
      [6, 90],
      [8, 270],
    ] as const) {
      const leBytes = buildMinimalExifJpeg(orientation, true)
      const beBytes = buildMinimalExifJpeg(orientation, false)

      expect(detectExifOrientation(leBytes)).toBe(orientation)
      expect(detectExifOrientation(beBytes)).toBe(orientation)
      expect(exifOrientationToClockwiseDegrees(orientation)).toBe(expectedDeg)

      expect(detectClientExifOrientation(leBytes)).toBe(orientation)
      expect(detectClientExifOrientation(beBytes)).toBe(orientation)
      expect(exifOrientationToRotationDegrees(orientation)).toBe(expectedDeg)

      const normalized = await normalizeIntakeImageOrientation(leBytes, 'image/jpeg', 0)
      expect(normalized.exifOrientation).toBe(orientation)
      expect(normalized.appliedDegrees).toBe(expectedDeg)
    }

    // 1. Multi-table vision extraction with side-by-side tables + "Increase" delta column
    const rotated90Jpeg = buildMinimalExifJpeg(6, true)
    const extractedVisionRows = await extractVisionIntakeRows(
      {
        bytes: rotated90Jpeg,
        mimeType: 'image/jpeg',
        fileName: 'cg-printed-menu-90deg.jpg',
      },
      {
        visionExtractOverride: async () => ({
          detected_rotation_degrees: 90,
          brand: 'China Garden',
          tables: [
            {
              table_title: 'Left Column — Rice & Noodles',
              brand: 'China Garden',
              rows: [
                {
                  item_name: 'Mushroom Fried Rice',
                  current_price: '2.250',
                  proposed_options: [
                    { option_key: 'increase', label: 'Increase', proposed_price: '0.200' },
                    { option_key: 'ch_suggested', label: 'CH Suggested', proposed_price: '2.650' },
                    { option_key: 'ae_suggested', label: 'AE Suggested', proposed_price: '2.450' },
                  ],
                },
                {
                  item_name: "Nim's Chow Mein",
                  current_price: '2.500',
                  proposed_options: [
                    { option_key: 'increase', label: 'Increase', proposed_price: '0.200' },
                    { option_key: 'ch_suggested', label: 'CH Suggested', proposed_price: '2.700' },
                    { option_key: 'ae_suggested', label: 'AE Suggested', proposed_price: '2.650' },
                  ],
                },
              ],
            },
            {
              table_title: 'Right Column — Appetizers & Mains',
              brand: 'China Garden',
              rows: [
                {
                  item_name: 'Vege Dumplings (Pan Fry & Steamed)',
                  current_price: '1.950',
                  proposed_options: [
                    { option_key: 'increase', label: 'Increase', proposed_price: '0.150' },
                    { option_key: 'ch_suggested', label: 'CH Suggested', proposed_price: '2.100' },
                    { option_key: 'ae_suggested', label: 'AE Suggested', proposed_price: '2.050' },
                  ],
                },
                {
                  item_name: 'Sweet & Sour Chicken',
                  current_price: '2.500',
                  proposed_options: [
                    { option_key: 'increase', label: 'Increase', proposed_price: '0.250' },
                    { option_key: 'ch_suggested', label: 'CH Suggested', proposed_price: '2.750' },
                    { option_key: 'ae_suggested', label: 'AE Suggested', proposed_price: '2.700' },
                  ],
                },
              ],
            },
          ],
        }),
      },
    )

    expect(extractedVisionRows).toHaveLength(4)
    expect(extractedVisionRows[0]).toEqual({
      brand: 'China Garden',
      itemName: 'Mushroom Fried Rice',
      sheetCurrentPriceKwd: '2.250',
      proposedOptions: [
        { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '2.650' },
        { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.450' },
      ],
    })

    // 2. Multi-table side-by-side spreadsheet layout with Price + Increase + CH Suggested + AE Suggested
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'Item Name',
        'Price',
        'Increase',
        'CH Suggested',
        'AE Suggested',
        '',
        'Item Name',
        'Price',
        'Increase',
        'CH Suggested',
        'AE Suggested',
      ],
      [
        'Mushroom Fried Rice',
        '2.250',
        '0.200',
        '2.650',
        '2.450',
        '',
        'Sweet & Sour Chicken',
        '2.500',
        '0.250',
        '2.750',
        '2.700',
      ],
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'PrintedMenu')
    const xlsxBytes = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer)
    const multiBlockRows = parseSpreadsheetIntakeRows(xlsxBytes)
    expect(multiBlockRows).toHaveLength(2)
    expect(multiBlockRows.map((r) => r.itemName)).toEqual([
      'Mushroom Fried Rice',
      'Sweet & Sour Chicken',
    ])
    expect(multiBlockRows[0]?.sheetCurrentPriceKwd).toBe('2.250')
    expect(multiBlockRows[0]?.proposedOptions.map((o) => o.label)).toEqual([
      'CH Suggested',
      'AE Suggested',
    ])

    // 3. Image draft renders 1-click "Rotate 90° & Re-Scan" button in FeryalDocumentReviewCard
    const imageDraft: DocumentIntakeDraft = {
      draftId: 'img-draft-rot',
      fileName: 'cg-printed-menu-90deg.jpg',
      fileKind: 'image',
      sourceTag: EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
      requiresHumanConfirmation: true,
      period: { from: '2026-10-22', to: '2026-11-20' },
      brand: 'china-garden',
      brandId: 'china-garden',
      branch: null,
      rows: [
        {
          rowId: 'r1',
          brand: 'China Garden',
          itemName: 'Mushroom Fried Rice',
          sheetCurrentPriceKwd: '2.250',
          proposedOptions: [
            { optionKey: 'ch_suggested', label: 'CH Suggested', proposedPriceKwd: '2.650' },
            { optionKey: 'ae_suggested', label: 'AE Suggested', proposedPriceKwd: '2.450' },
          ],
          matchedOdooProductId: 136,
          matchedOdooProductName: '[RICG0136] Mushroom Fried Rice',
          odooRealizedUnitPriceKwd: '2.250',
          odooQty: '800',
          odooNetSalesKwd: '1800.000',
          excluded: false,
          anomalies: [],
        },
      ],
      summary: { totalRows: 1, matchedRows: 1, criticalCount: 0, warningCount: 0 },
    }
    const reviewHtml = renderToStaticMarkup(
      React.createElement(FeryalDocumentReviewCard, {
        draft: imageDraft,
        isAr: false,
        activePeriod: 'month',
        onDraftChange: () => undefined,
        onConfirmAndRun: () => undefined,
        onCancel: () => undefined,
        onRotateImageAndRescan: () => undefined,
      }),
    )
    expect(reviewHtml).toContain('data-feryal-rotate-rescan="true"')
    expect(reviewHtml).toContain('Rotate 90° &amp; Re-Scan')
    expect(reviewHtml).toContain('CH Suggested')
    expect(reviewHtml).toContain('AE Suggested')
  })
})

describe('V2 Static Repo Invariants & Odoo Read-Only Safety Audit', () => {
  it('enforces 0 console.*, 0 explicit any, 0 @ts-ignore, 0 sub-12px classes, 0 mock*/seed* identifiers, 0 truncate in studio, and 0 null bytes across all V2 modules', () => {
    const repoRoot = process.cwd()
    const v2ProductionFiles = [
      'src/lib/feryal/sku-matcher-guard.ts',
      'src/lib/feryal/item-pricing.ts',
      'src/lib/feryal/document-intake-types.ts',
      'src/lib/feryal/document-intake.ts',
      'src/lib/feryal/executive-advisor.ts',
      'src/lib/feryal-multimodal.ts',
      'src/lib/feryal-intent.ts',
      'src/lib/feryal-chat-store.ts',
      'src/server/ai/council.ts',
      'src/server/ai/number-guard.ts',
      'src/server/ai/providers.ts',
      'src/server/ai/models.ts',
      'src/app/api/erp/feryal/chat/route.ts',
      'src/app/api/erp/feryal/document-intake/route.ts',
      'src/app/api/erp/feryal/threads/route.ts',
      'src/app/api/erp/feryal/vision/route.ts',
      'src/components/erp/feryal-governance-studio.tsx',
      'src/components/aether/FeryalStudioMessage.tsx',
      'src/components/aether/FeryalDocumentReviewCard.tsx',
      'src/components/aether/FeryalMultimodalBar.tsx',
    ]

    for (const rel of v2ProductionFiles) {
      const abs = path.join(repoRoot, rel)
      const rawBytes = readFileSync(abs)
      expect(rawBytes.includes(0), `${rel} must contain 0 null bytes`).toBe(false)

      const content = rawBytes.toString('utf8')
      expect(content, `${rel} must contain 0 console.*`).not.toMatch(
        /\bconsole\.(log|warn|error|info|debug)\b/,
      )
      expect(content, `${rel} must contain 0 explicit any`).not.toMatch(
        /:\s*any\b|\bas\s+any\b|<any>/,
      )
      expect(content, `${rel} must contain 0 @ts-ignore`).not.toMatch(
        /@ts-ignore|@ts-expect-error/,
      )
      expect(content, `${rel} must contain 0 sub-12px text classes`).not.toMatch(
        /text-\[(?:9|10|10\.5|11|11\.5)px\]/,
      )
      expect(content, `${rel} must contain 0 mock*/seed* identifiers`).not.toMatch(
        /\b(?:mock[A-Za-z0-9_]*|seed[A-Za-z0-9_]*)\b/,
      )
    }

    const studioSource = readFileSync(
      path.join(repoRoot, 'src/components/erp/feryal-governance-studio.tsx'),
      'utf8',
    )
    expect(studioSource).not.toContain('truncate')
  })
})
