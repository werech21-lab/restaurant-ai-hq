'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  APPROVED_KUWAIT_SLICES,
  APPROVED_PROFIT_LENSES,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  isBrandBranchCompatible,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalFilters,
  type GlobalPeriod,
  type GlobalWorkspaceSlice,
  type KuwaitSlice,
  type ProfitLens,
} from '@/lib/aether/global-filter-engine'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

const STORAGE_KEY = 'aether.globalFilters.v2'

interface GlobalFilterContextValue {
  filters: Required<GlobalFilters>
  workspace: GlobalWorkspaceSlice
  liveSummary: OdooLiveSummary | null
  setPeriod: (period: GlobalPeriod) => void
  setKuwaitSlice: (slice: KuwaitSlice) => void
  setBrand: (brand: GlobalBrand) => void
  setBranch: (branch: GlobalBranch) => void
  setChannel: (channel: GlobalChannel) => void
  setLens: (lens: ProfitLens) => void
  resetFilters: () => void
  buildShareDeepLinkText: (pathname: string, isAr: boolean) => string
}

const GlobalFilterContext = createContext<GlobalFilterContextValue | null>(null)

function sanitizeFilters(raw: Partial<GlobalFilters> | null | undefined): Required<GlobalFilters> {
  if (!raw) return DEFAULT_GLOBAL_FILTERS
  const period: GlobalPeriod =
    raw.period === 'today' || raw.period === 'week' || raw.period === 'month' || raw.period === 'year'
      ? raw.period
      : 'month'
  const kuwaitSlice: KuwaitSlice =
    raw.kuwaitSlice && (APPROVED_KUWAIT_SLICES as readonly string[]).includes(raw.kuwaitSlice)
      ? (raw.kuwaitSlice as KuwaitSlice)
      : 'all'
  const brand: GlobalBrand =
    raw.brand && (APPROVED_BRAND_IDS as readonly string[]).includes(raw.brand)
      ? (raw.brand as GlobalBrand)
      : 'all'
  let branch: GlobalBranch =
    raw.branch && (APPROVED_BRANCH_IDS as readonly string[]).includes(raw.branch)
      ? (raw.branch as GlobalBranch)
      : 'all'
  if (!isBrandBranchCompatible(brand, branch)) {
    branch = 'all'
  }
  const channel: GlobalChannel =
    raw.channel && (APPROVED_CHANNEL_IDS as readonly string[]).includes(raw.channel)
      ? (raw.channel as GlobalChannel)
      : 'all'
  const lens: ProfitLens =
    raw.lens && (APPROVED_PROFIT_LENSES as readonly string[]).includes(raw.lens)
      ? (raw.lens as ProfitLens)
      : 'all'
  return { period, kuwaitSlice, brand, branch, channel, lens }
}

export function GlobalFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<Required<GlobalFilters>>(DEFAULT_GLOBAL_FILTERS)
  const [hydrated, setHydrated] = useState(false)
  const [liveSummary, setLiveSummary] = useState<OdooLiveSummary | null>(null)

  // Hydrate from URL query params first, then localStorage
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const hasUrl =
        sp.has('period') ||
        sp.has('slice') ||
        sp.has('brand') ||
        sp.has('branch') ||
        sp.has('channel') ||
        sp.has('lens')
      if (hasUrl) {
        setFilters(
          sanitizeFilters({
            period: (sp.get('period') as GlobalPeriod) || undefined,
            kuwaitSlice: (sp.get('slice') as KuwaitSlice) || undefined,
            brand: (sp.get('brand') as GlobalBrand) || undefined,
            branch: (sp.get('branch') as GlobalBranch) || undefined,
            channel: (sp.get('channel') as GlobalChannel) || undefined,
            lens: (sp.get('lens') as ProfitLens) || undefined,
          }),
        )
      } else {
        const saved =
          window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem('aether.globalFilters.v1')
        if (saved) {
          setFilters(sanitizeFilters(JSON.parse(saved) as Partial<GlobalFilters>))
        }
      }
    } catch {
      // ignore storage errors
    }
    setHydrated(true)
  }, [])

  // Persist to localStorage & lightweight URL query sync
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
      const url = new URL(window.location.href)
      if (filters.period === 'month') url.searchParams.delete('period')
      else url.searchParams.set('period', filters.period)
      if (filters.kuwaitSlice === 'all') url.searchParams.delete('slice')
      else url.searchParams.set('slice', filters.kuwaitSlice)
      if (filters.brand === 'all') url.searchParams.delete('brand')
      else url.searchParams.set('brand', filters.brand)
      if (filters.branch === 'all') url.searchParams.delete('branch')
      else url.searchParams.set('branch', filters.branch)
      if (filters.channel === 'all') url.searchParams.delete('channel')
      else url.searchParams.set('channel', filters.channel)
      if (filters.lens === 'all') url.searchParams.delete('lens')
      else url.searchParams.set('lens', filters.lens)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    } catch {
      // ignore history/storage errors
    }
  }, [filters, hydrated])

  // Background fetch of /api/odoo-sync for live bucket updates + listen for manual sync events
  useEffect(() => {
    let active = true
    fetch(`/api/odoo-sync?period=${encodeURIComponent(filters.period)}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? (res.json() as Promise<OdooLiveSummary>) : null))
      .then((data) => {
        if (active && data && data.totals) setLiveSummary(data)
      })
      .catch(() => {
        // Silent fallback to build-time Odoo snapshot
      })

    const onSyncEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<OdooLiveSummary>).detail
      if (detail && detail.totals) setLiveSummary(detail)
    }
    window.addEventListener('aether:odoo-sync', onSyncEvent)
    return () => {
      active = false
      window.removeEventListener('aether:odoo-sync', onSyncEvent)
    }
  }, [filters.period])

  const setPeriod = useCallback((period: GlobalPeriod) => setFilters((f) => ({ ...f, period })), [])
  const setKuwaitSlice = useCallback(
    (kuwaitSlice: KuwaitSlice) => setFilters((f) => ({ ...f, kuwaitSlice })),
    [],
  )
  const setBrand = useCallback((brand: GlobalBrand) => {
    setFilters((f) => {
      const nextBranch = isBrandBranchCompatible(brand, f.branch) ? f.branch : 'all'
      return { ...f, brand, branch: nextBranch }
    })
  }, [])
  const setBranch = useCallback((branch: GlobalBranch) => {
    setFilters((f) => {
      const nextBrand = isBrandBranchCompatible(f.brand, branch) ? f.brand : 'all'
      return { ...f, brand: nextBrand, branch }
    })
  }, [])
  const setChannel = useCallback((channel: GlobalChannel) => setFilters((f) => ({ ...f, channel })), [])
  const setLens = useCallback((lens: ProfitLens) => {
    setFilters((f) => {
      // Smoothly couple quiet-hours lens with quiet-hours slice when switching from default
      const nextSlice =
        lens === 'quiet-hours' && f.kuwaitSlice === 'all'
          ? 'quiet-hours'
          : lens !== 'quiet-hours' && f.lens === 'quiet-hours' && f.kuwaitSlice === 'quiet-hours'
            ? 'all'
            : f.kuwaitSlice
      return { ...f, lens, kuwaitSlice: nextSlice }
    })
  }, [])
  const resetFilters = useCallback(() => setFilters(DEFAULT_GLOBAL_FILTERS), [])

  const workspace = useMemo(() => computeGlobalWorkspace(filters, liveSummary), [filters, liveSummary])

  const buildShareDeepLinkText = useCallback(
    (pathname: string, isAr: boolean): string => {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const params = new URLSearchParams()
      if (filters.period !== 'month') params.set('period', filters.period)
      if (filters.kuwaitSlice !== 'all') params.set('slice', filters.kuwaitSlice)
      if (filters.brand !== 'all') params.set('brand', filters.brand)
      if (filters.branch !== 'all') params.set('branch', filters.branch)
      if (filters.channel !== 'all') params.set('channel', filters.channel)
      if (filters.lens !== 'all') params.set('lens', filters.lens)
      const qs = params.toString()
      const deepUrl = `${origin}${pathname}${qs ? `?${qs}` : ''}`
      const salesFmt = Math.round(workspace.salesKwd).toLocaleString('en-US')
      const ordFmt = workspace.orders.toLocaleString('en-US')

      if (isAr) {
        return [
          `📊 *فنتشر فودز — ${workspace.subtitleAr}*`,
          `• المبيعات: ${salesFmt} د.ك (${ordFmt} طلب) | الصافي المرجّح: ${workspace.weightedNetPct.toFixed(1)}%`,
          `• التشخيص: ${workspace.diagnosticStrip.rootCauseAr}`,
          `🔗 رابط مباشر: ${deepUrl}`,
        ].join('\n')
      }
      return [
        `📊 *Venture Foods — ${workspace.subtitleEn}*`,
        `• Sales: ${salesFmt} KWD (${ordFmt} orders) | Weighted Net: ${workspace.weightedNetPct.toFixed(1)}%`,
        `• Diagnosis: ${workspace.diagnosticStrip.rootCauseEn}`,
        `🔗 Deep Link: ${deepUrl}`,
      ].join('\n')
    },
    [filters, workspace],
  )

  const value = useMemo<GlobalFilterContextValue>(
    () => ({
      filters,
      workspace,
      liveSummary,
      setPeriod,
      setKuwaitSlice,
      setBrand,
      setBranch,
      setChannel,
      setLens,
      resetFilters,
      buildShareDeepLinkText,
    }),
    [
      filters,
      workspace,
      liveSummary,
      setPeriod,
      setKuwaitSlice,
      setBrand,
      setBranch,
      setChannel,
      setLens,
      resetFilters,
      buildShareDeepLinkText,
    ],
  )

  return <GlobalFilterContext.Provider value={value}>{children}</GlobalFilterContext.Provider>
}

export function useGlobalFilter(): GlobalFilterContextValue {
  const ctx = useContext(GlobalFilterContext)
  if (!ctx) {
    const fallbackWorkspace = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, null)
    return {
      filters: DEFAULT_GLOBAL_FILTERS,
      workspace: fallbackWorkspace,
      liveSummary: null,
      setPeriod: () => {},
      setKuwaitSlice: () => {},
      setBrand: () => {},
      setBranch: () => {},
      setChannel: () => {},
      setLens: () => {},
      resetFilters: () => {},
      buildShareDeepLinkText: () => '',
    }
  }
  return ctx
}
