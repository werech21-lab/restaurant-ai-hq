/**
 * Server-side render helpers for the Executive Dashboard tests.
 *
 * The test file mocks `next/navigation` and `GlobalFilterContext` (vi.mock is hoisted per file);
 * these helpers build the context value and render through the real language provider.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export const dashboardContext: { value: unknown } = { value: null }

export function todayFilters(brand: string): GlobalFilters {
  return { ...DEFAULT_GLOBAL_FILTERS, period: 'today', brand: brand as GlobalFilters['brand'] }
}

/** Sets the mocked filter context to `summary` seen through `filters`. */
export function setDashboardContext(summary: OdooLiveSummary, filters: GlobalFilters): void {
  dashboardContext.value = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary),
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
  }
}

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

export function renderAr(node: React.ReactElement): string {
  return renderToStaticMarkup(React.createElement(TypedLangProvider, { initialLocale: 'ar' }, node))
}

/** `data-scope-for` targets of every scope badge in the markup, keyed to the badge kind. */
export function scopeBadgesOf(html: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /data-scope-badge="([^"]+)"[^>]*?data-scope-for="([^"]+)"/g
  for (const m of html.matchAll(re)) out[m[2]] = m[1]
  return out
}

/** Text content of the first element carrying `attr="value"` (tags stripped). */
export function textOfAttr(html: string, attr: string, value = 'true'): string | null {
  const start = html.indexOf(`${attr}="${value}"`)
  if (start < 0) return null
  const open = html.lastIndexOf('<', start)
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(open))?.[1]
  if (!tag) return null
  let depth = 0
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return html.slice(open, m.index + m[0].length).replace(/<[^>]+>/g, '')
  }
  return null
}
