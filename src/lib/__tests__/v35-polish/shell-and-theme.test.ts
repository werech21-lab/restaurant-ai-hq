/**
 * V35 Polish — Wave 0 RED tests for ThemeToggle (Blue Dark), ErpSidebar (default 76px collapsed),
 * TopFilterBar (concise search placeholder), and FullJourney360 hero Net Sales `whitespace-nowrap`.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BiFilterProvider } from '@/components/aether/BiFilterContext'
import { GovernanceProvider } from '@/components/erp/GovernanceBellDrawer'
import { LanguageProvider } from '@/lib/i18n'
import type { AccessUser } from '@/lib/permissions'
import { ThemeProvider } from '@/lib/theme'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import {
  dashboardContext,
  setDashboardContext,
  todayFilters,
} from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const TypedThemeProvider = ThemeProvider as unknown as React.ComponentType<{
  initialTheme?: 'dark' | 'light'
  children?: React.ReactNode
}>

const TypedGovernanceProvider = GovernanceProvider as unknown as React.ComponentType<{
  isAuditor?: boolean
  sessionRole?: 'admin' | 'gm' | 'finance' | 'ops' | 'auditor'
  children?: React.ReactNode
}>

function renderShell(
  locale: 'ar' | 'en',
  node: React.ReactElement,
  theme: 'dark' | 'light' = 'light',
): string {
  return renderToStaticMarkup(
    React.createElement(
      TypedLangProvider,
      { initialLocale: locale },
      React.createElement(
        TypedThemeProvider,
        { initialTheme: theme },
        React.createElement(
          BiFilterProvider,
          null,
          React.createElement(
            TypedGovernanceProvider,
            { isAuditor: false, sessionRole: 'admin' },
            node,
          ),
        ),
      ),
    ),
  )
}

function setFullFilterContext() {
  setDashboardContext(loadLiveTodaySummary(), todayFilters('all'))
  const base = dashboardContext.value as Record<string, unknown>
  dashboardContext.value = {
    ...base,
    syncCooldownSec: 0,
    triggerOdooSyncNow: async () => {},
    setPeriod: () => {},
    setCustomRange: () => {},
    setKuwaitSlice: () => {},
    setBrand: () => {},
    setBranch: () => {},
    setChannel: () => {},
    setLens: () => {},
    resetFilters: () => {},
    buildShareDeepLinkText: () => '',
  }
}

function extractBalancedElement(html: string, matchIndex: number): { openTag: string; outerHtml: string; text: string } | null {
  const open = html.lastIndexOf('<', matchIndex)
  if (open < 0) return null
  const openEnd = html.indexOf('>', open)
  if (openEnd < 0) return null
  const openTag = html.slice(open, openEnd + 1)
  const tag = /^<([a-z0-9]+)/i.exec(openTag)?.[1]
  if (!tag) return null
  let depth = 0
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) {
      const outerHtml = html.slice(open, m.index + m[0].length)
      return {
        openTag,
        outerHtml,
        text: outerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }
    }
  }
  return null
}

const SAMPLE_ADMIN_USER: AccessUser = {
  id: 'u-admin-1',
  name: 'Admin',
  email: 'admin@venturefoods.test',
  role: { id: 'r-admin', name: 'Admin', isAdmin: true, permissions: [] },
}

describe('V35 Polish — ThemeToggle, ErpSidebar, TopFilterBar & Hero Net Sales wrapping', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] })
    setFullFilterContext()
  })
  afterEach(() => vi.useRealTimers())

  it('ThemeToggle uses Blue Dark Mode labels in AR / EN visible text and TopFilterBar uses Blue Dark Mode tooltips', async () => {
    const { ThemeToggle } = await import('@/components/ThemeToggle')
    const { TopFilterBar } = await import('@/components/aether/TopFilterBar')

    const arLight = renderShell('ar', React.createElement(ThemeToggle), 'light')
    expect(arLight).toContain('أزرق')
    expect(arLight).toContain('التبديل إلى الوضع الأزرق الداكن')
    expect(arLight).not.toContain('زمردي')

    const enLight = renderShell('en', React.createElement(ThemeToggle), 'light')
    expect(enLight).toContain('>Blue<')
    const enVisibleText = enLight.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    expect(enVisibleText).toBe('Blue')
    expect(enVisibleText).not.toContain('Emerald')

    const arTopBar = renderShell('ar', React.createElement(TopFilterBar), 'light')
    expect(arTopBar).toContain('التبديل إلى الوضع الأزرق الداكن')
    expect(arTopBar).not.toContain('الزمرد')

    const enTopBar = renderShell('en', React.createElement(TopFilterBar), 'light')
    expect(enTopBar).toContain('Switch to Blue Dark Mode')
    expect(enTopBar).not.toContain('Obsidian-Emerald')
  })

  it('ErpSidebar defaults to 76px collapsed rail on desktop via CSS + storage default while preserving RTL/LTR direction', async () => {
    const { Sidebar: ErpSidebar } = await import('@/components/erp-sidebar')

    const arHtml = renderShell('ar', React.createElement(ErpSidebar, { user: SAMPLE_ADMIN_USER }))
    expect(arHtml).toContain('dir="rtl"')
    expect(arHtml).toContain('data-rail-expanded-only="true"')

    const enHtml = renderShell('en', React.createElement(ErpSidebar, { user: SAMPLE_ADMIN_USER }))
    expect(enHtml).toContain('dir="ltr"')
    expect(enHtml).toContain('data-rail-expanded-only="true"')

    const root = process.cwd()
    const [shellCss, sidebarSrc] = await Promise.all([
      readFile(path.join(root, 'src/app/v35-shell.css'), 'utf8'),
      readFile(path.join(root, 'src/components/erp-sidebar.tsx'), 'utf8'),
    ])
    expect(shellCss).toContain("html:not([data-rail-collapsed='false'])")
    expect(shellCss).toContain('width: 76px')
    expect(shellCss).toContain('[data-rail-expanded-only]')
    expect(shellCss).toContain('display: none')
    expect(sidebarSrc).toContain('rawSaved === null ? true')
  })

  it('TopFilterBar renders concise search prompt ("ابحث…" in AR, "Search…" in EN)', async () => {
    const { TopFilterBar } = await import('@/components/aether/TopFilterBar')

    const arHtml = renderShell('ar', React.createElement(TopFilterBar))
    expect(arHtml).toContain('ابحث…')
    expect(arHtml).not.toContain('ابحث في المؤشرات أو الفروع أو اسأل فريال')

    const enHtml = renderShell('en', React.createElement(TopFilterBar))
    expect(enHtml).toContain('Search…')
    expect(enHtml).not.toContain('Search metrics, branches, or ask Feryal')
  })

  it('FullJourney360 hero Net Sales value + unit container enforces whitespace-nowrap so 154.700 د.ك never wraps', async () => {
    const { FullJourney360 } = await import('@/components/aether/FullJourney360')

    const arHtml = renderShell('ar', React.createElement(FullJourney360))
    const idxAr = arHtml.indexOf('data-kpi="net-sales"')
    expect(idxAr).toBeGreaterThan(-1)
    const netSalesAr = extractBalancedElement(arHtml, idxAr)
    expect(netSalesAr).not.toBeNull()
    expect(netSalesAr!.text).toBe('154.700 د.ك')
    expect(netSalesAr!.outerHtml).toContain('whitespace-nowrap')

    const enHtml = renderShell('en', React.createElement(FullJourney360))
    const idxEn = enHtml.indexOf('data-kpi="net-sales"')
    expect(idxEn).toBeGreaterThan(-1)
    const netSalesEn = extractBalancedElement(enHtml, idxEn)
    expect(netSalesEn).not.toBeNull()
    expect(netSalesEn!.text).toBe('154.700 KWD')
    expect(netSalesEn!.outerHtml).toContain('whitespace-nowrap')
  })
})
