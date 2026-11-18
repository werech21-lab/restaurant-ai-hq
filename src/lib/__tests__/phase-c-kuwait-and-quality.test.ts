import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/intelligence',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

import { formatAmount } from '@/components/charts'
import { dateTimeText } from '@/components/erp/common'
import { filterAndGroupChats, type FeryalChatSummary } from '@/lib/feryal-chat-store'
import {
  recordDecisionOutcome,
  resetFeryalMemoryToDefaults,
  teachPermanentFact,
} from '@/lib/feryal-learning-engine'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatDateTime,
  formatInt,
  formatKwd,
  formatMonth,
  formatPct,
} from '@/lib/format'
import { LanguageProvider } from '@/lib/i18n'
const el = React.createElement
const TypedLangProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLang(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(el(TypedLangProvider, { initialLocale: locale }, node))
}

const DELETED_ORPHAN_FILES = [
  'src/components/Agents.tsx',
  'src/components/Branches.tsx',
  'src/components/CEORoom.tsx',
  'src/components/Delivery.tsx',
  'src/components/ErpHub.tsx',
  'src/components/Kitchen.tsx',
  'src/components/InstallAppBanner.tsx',
  'src/components/PanelSpotlight.tsx',
  'src/components/assistant-widget.tsx',
  'src/components/brand-logo.tsx',
  'src/components/notification-bell.tsx',
  'src/components/aether/DecisionBriefStrip.tsx',
  'src/components/aether/DeliveryEnterpriseTabs.tsx',
  'src/components/erp/ops-expansion/OpsFilterSyncBar.tsx',
  'src/lib/accounting/odoo-real-expenses-data.ts',
  'src/lib/hr/odoo-hr-dashboard-data.ts',
] as const

describe('Wave 4 Phase C — Asia/Kuwait Midnight Boundary, Canonical Formatting & Repo Hygiene', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('1. Asia/Kuwait (UTC+3) Midnight Boundary (23:30 UTC = 02:30 Kuwait Next Day)', () => {
    it('resolves 2026-11-15T23:30:00.000Z to 2026-11-16 02:30 in Asia/Kuwait across formatDate, formatDateTime, formatMonth, and common.dateTimeText', () => {
      const utc2330 = '2026-11-15T23:30:00.000Z'
      const beforeKuwaitMidnight = '2026-11-15T20:59:59.000Z' // 23:59:59 Kuwait on 2026-11-15
      const atKuwaitMidnight = '2026-11-15T21:00:00.000Z' // 00:00:00 Kuwait on 2026-11-16

      expect(formatDate(beforeKuwaitMidnight, 'en')).toBe('2026-11-15')
      expect(formatDate(atKuwaitMidnight, 'en')).toBe('2026-11-16')
      expect(formatDate(utc2330, 'en')).toBe('2026-11-16')
      expect(formatDate(utc2330, { locale: 'en', style: 'medium' })).toBe('Nov 16, 2026')
      expect(formatDate(utc2330, { locale: 'ar', style: 'medium' })).toBe('16 نوفمبر 2026')

      expect(formatDateTime(utc2330, { locale: 'en', showZone: true })).toBe(
        '2026-11-16 02:30 UTC+3',
      )
      expect(dateTimeText(utc2330)).toBe('2026-11-16 02:30')
      expect(dateTimeText('invalid-date')).toBe(UNAVAILABLE_DASH)

      // Month-end boundary: 2026-10-31T23:30:00.000Z is 2026-11-01 02:30 in Kuwait (November, not October)
      expect(formatMonth(new Date('2026-10-31T23:30:00.000Z'))).toBe('نوفمبر 2026')
    })

    it('stamps Feryal learned rules and decision outcomes with the Asia/Kuwait calendar day (2026-11-16) at 23:30 UTC', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-15T23:30:00.000Z'))

      await resetFeryalMemoryToDefaults()
      const afterRule = await teachPermanentFact({
        text: 'مراجعة عمولات التوصيل يومياً حسب الفرع',
        source: 'user',
      })
      expect(afterRule.rules[0]?.createdAt).toBe('2026-11-16')

      const afterOutcome = await recordDecisionOutcome({
        titleAr: 'اعتماد مطابقة عمولات التوصيل',
        titleEn: 'Approve delivery commission reconciliation',
        status: 'approved',
        monthlyGainKwd: 420.5,
      })
      expect(afterOutcome.outcomes[0]?.recordedAt).toBe('2026-11-16')
    })

    it('groups Feryal chat threads by Asia/Kuwait midnight boundary at 23:30 UTC', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-15T23:30:00.000Z')) // 02:30 Kuwait on 2026-11-16

      const sampleChats: FeryalChatSummary[] = [
        {
          id: 'chat-kw-today',
          title: 'Early Kuwait Morning Thread',
          notebookId: 'general',
          pinned: false,
          createdAt: '2026-11-15T22:00:00.000Z',
          updatedAt: '2026-11-15T22:00:00.000Z', // 01:00 Kuwait on 2026-11-16 -> today
          messageCount: 2,
          lang: 'ar',
          previewText: 'Sales check',
          searchableCorpus: 'sales check',
        },
        {
          id: 'chat-kw-yesterday',
          title: 'Late Kuwait Previous Night Thread',
          notebookId: 'general',
          pinned: false,
          createdAt: '2026-11-15T20:30:00.000Z',
          updatedAt: '2026-11-15T20:30:00.000Z', // 23:30 Kuwait on 2026-11-15 -> yesterday
          messageCount: 2,
          lang: 'ar',
          previewText: 'Closing check',
          searchableCorpus: 'closing check',
        },
      ]

      const groups = filterAndGroupChats({
        chats: sampleChats,
        notebooks: [],
        activeNotebookId: 'all',
        searchQuery: '',
      })

      const todayGroup = groups.find((g) => g.id === 'today')
      const yesterdayGroup = groups.find((g) => g.id === 'yesterday')
      expect(todayGroup?.chats.map((c) => c.id)).toEqual(['chat-kw-today'])
      expect(yesterdayGroup?.chats.map((c) => c.id)).toEqual(['chat-kw-yesterday'])
    })

    it('enforces Asia/Kuwait date helpers instead of raw UTC slice or local getHours/getDate in live UI & HR attendance code', async () => {
      const commonSrc = await readFile(
        path.join(process.cwd(), 'src/components/erp/common.tsx'),
        'utf8',
      )
      expect(commonSrc).not.toMatch(/\.getHours\(|\.getDate\(/)

      const hrServiceSrc = await readFile(
        path.join(process.cwd(), 'src/services/hr.service.ts'),
        'utf8',
      )
      expect(hrServiceSrc).not.toMatch(/now\.getDate\(\)|now\.getMonth\(\)/)
      expect(hrServiceSrc).toContain('+03:00')

      const chatStoreSrc = await readFile(
        path.join(process.cwd(), 'src/lib/feryal-chat-store.ts'),
        'utf8',
      )
      expect(chatStoreSrc).not.toMatch(/new Date\(now\.getFullYear\(\)/)

      const radarRouteSrc = await readFile(
        path.join(process.cwd(), 'src/app/api/aggregator-radar/alert/route.ts'),
        'utf8',
      )
      expect(radarRouteSrc).not.toContain("new Date().toLocaleDateString('en-GB')")

      const noRawUtcTodayFiles = [
        'src/modules/governance/ui/GovernanceDesk.tsx',
        'src/components/aether/FeryalSidebarNotebooks.tsx',
        'src/components/erp/feryal-governance-studio.tsx',
        'src/lib/aether/social-campaigns.ts',
        'src/lib/feryal-learning-engine.ts',
      ] as const

      for (const rel of noRawUtcTodayFiles) {
        const content = await readFile(path.join(process.cwd(), rel), 'utf8')
        expect(content, `${rel} raw UTC today`).not.toMatch(
          /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/,
        )
      }
    })
  })

  describe('2. Canonical 3-Decimal KWD, Integer & Percentage Formatting', () => {
    it('formats KWD to 3 decimals, null/NaN to em-dash, and normalizes -0 across formatKwd, formatInt, formatPct, and chart formatAmount', () => {
      expect(formatKwd(null)).toBe(UNAVAILABLE_DASH)
      expect(formatKwd(undefined)).toBe(UNAVAILABLE_DASH)
      expect(formatKwd(Number.NaN)).toBe(UNAVAILABLE_DASH)
      expect(formatKwd(-0, 'en')).toBe('0.000 KWD')
      expect(formatKwd(4259.1, 'en')).toBe('4,259.100 KWD')
      expect(formatKwd(4259.1, 'ar')).toBe('4,259.100 د.ك')

      expect(formatInt(null)).toBe(UNAVAILABLE_DASH)
      expect(formatInt(23450)).toBe('23,450')

      expect(formatPct(null)).toBe(UNAVAILABLE_DASH)
      expect(formatPct(16.04, { signed: true })).toBe('+16.0%')

      expect(formatAmount(125.5)).toBe('125.500')
      expect(formatAmount([1420.25])).toBe('1,420.250')
      expect(formatAmount(undefined)).toBe(UNAVAILABLE_DASH)
    })

    it('eliminates ad-hoc KWD rounding/formatting in GlobalFilterContext, ExecutiveCommandPalette, SmartDropzonePortal, and enterprise-reports-registry', async () => {
      const globalFilterCtx = await readFile(
        path.join(process.cwd(), 'src/components/aether/GlobalFilterContext.tsx'),
        'utf8',
      )
      expect(globalFilterCtx).not.toContain('Math.round(workspace.nullableSalesKwd)')
      expect(globalFilterCtx).toContain('formatKwd')

      const cmdPalette = await readFile(
        path.join(process.cwd(), 'src/components/aether/ExecutiveCommandPalette.tsx'),
        'utf8',
      )
      expect(cmdPalette).not.toMatch(/salesKwd\.toLocaleString\(/)
      expect(cmdPalette).toContain('formatKwd')

      const dropzone = await readFile(
        path.join(process.cwd(), 'src/modules/smart-dropzone/ui/SmartDropzonePortal.tsx'),
        'utf8',
      )
      expect(dropzone).not.toContain('row.amountKwd.toFixed(3)')
      expect(dropzone).toContain('formatKwd')

      const registry = await readFile(
        path.join(process.cwd(), 'src/lib/reports/enterprise-reports-registry.ts'),
        'utf8',
      )
      expect(registry).not.toMatch(/\.toLocaleString\(/)
      expect(registry).toContain('formatKwd')
      expect(registry).toContain('formatInt')
      expect(registry).toContain('formatPct')
    })
  })

  describe('3. Heading hierarchy and ERP page shells', () => {
    it('keeps /erp/intelligence out of TopFilterBar ROUTES_WITH_OWN_H1, removes sub-12px classes in SmartDropzonePortal, and ensures 0 nested <main> across all /erp/*/page.tsx routes', async () => {
      const rootDir = process.cwd()
      const topFilterBarSrc = await readFile(
        path.join(rootDir, 'src/components/aether/TopFilterBar.tsx'),
        'utf8',
      )
      const ownH1Block = /const ROUTES_WITH_OWN_H1\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(
        topFilterBarSrc,
      )
      expect(ownH1Block).not.toBeNull()
      expect(ownH1Block?.[1]).not.toContain("'/erp/intelligence'")

      const dropzoneSrc = await readFile(
        path.join(rootDir, 'src/modules/smart-dropzone/ui/SmartDropzonePortal.tsx'),
        'utf8',
      )
      expect(dropzoneSrc).not.toMatch(/text-\[(?:10|10\.5|11|11\.5)px\]/)

      const erpDir = path.join(rootDir, 'src/app/erp')
      const erpPages: string[] = []
      const walkErp = async (dir: string): Promise<void> => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            await walkErp(full)
          } else if (entry.name === 'page.tsx') {
            erpPages.push(full)
          }
        }
      }
      await walkErp(erpDir)
      expect(erpPages.length).toBe(46)

      for (const pagePath of erpPages) {
        const rel = path.relative(rootDir, pagePath).replace(/\\/g, '/')
        const src = await readFile(pagePath, 'utf8')
        expect(src, `${rel} must not contain nested <main>`).not.toMatch(/<main\b/)
      }
    })
  })

  describe('4. Dead Orphan File Removal & Framework Entrypoint Preservation', () => {
    it('removes all 16 provably unreferenced legacy orphan files while preserving Next.js instrumentation.ts', () => {
      const rootDir = process.cwd()
      for (const rel of DELETED_ORPHAN_FILES) {
        expect(existsSync(path.join(rootDir, rel)), `${rel} must be deleted`).toBe(false)
      }
      expect(existsSync(path.join(rootDir, 'src/instrumentation.ts'))).toBe(true)
    })
  })
})
