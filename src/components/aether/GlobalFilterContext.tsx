'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalFilters,
  type GlobalPeriod,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

const STORAGE_KEY = 'aether.globalFilters.v1'

interface GlobalFilterContextValue {
  filters: GlobalFilters
  workspace: GlobalWorkspaceSlice
  liveSummary: OdooLiveSummary | null
  setPeriod: (period: GlobalPeriod) => void
  setBrand: (brand: GlobalBrand) => void
  setBranch: (branch: GlobalBranch) => void
  setChannel: (channel: GlobalChannel) => void
  resetFilters: () => void
}

const GlobalFilterContext = createContext<GlobalFilterContextValue | null>(null)

function sanitizeFilters(raw: Partial<GlobalFilters> | null | undefined): GlobalFilters {
  if (!raw) return DEFAULT_GLOBAL_FILTERS
  const period: GlobalPeriod =
    raw.period === 'today' || raw.period === 'week' || raw.period === 'month' || raw.period === 'year'
      ? raw.period
      : 'month'
  const brand: GlobalBrand =
    raw.brand && (APPROVED_BRAND_IDS as readonly string[]).includes(raw.brand)
      ? (raw.brand as GlobalBrand)
      : 'all'
  const branch: GlobalBranch =
    raw.branch && (APPROVED_BRANCH_IDS as readonly string[]).includes(raw.branch)
      ? (raw.branch as GlobalBranch)
      : 'all'
  const channel: GlobalChannel =
    raw.channel && (APPROVED_CHANNEL_IDS as readonly string[]).includes(raw.channel)
      ? (raw.channel as GlobalChannel)
      : 'all'
  return { period, brand, branch, channel }
}

export function GlobalFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_GLOBAL_FILTERS)
  const [hydrated, setHydrated] = useState(false)
  const [liveSummary, setLiveSummary] = useState<OdooLiveSummary | null>(null)

  // Hydrate from URL query params first, then localStorage
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const hasUrl = sp.has('period') || sp.has('brand') || sp.has('branch') || sp.has('channel')
      if (hasUrl) {
        setFilters(
          sanitizeFilters({
            period: (sp.get('period') as GlobalPeriod) || undefined,
            brand: (sp.get('brand') as GlobalBrand) || undefined,
            branch: (sp.get('branch') as GlobalBranch) || undefined,
            channel: (sp.get('channel') as GlobalChannel) || undefined,
          }),
        )
      } else {
        const saved = window.localStorage.getItem(STORAGE_KEY)
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
      if (filters.brand === 'all') url.searchParams.delete('brand')
      else url.searchParams.set('brand', filters.brand)
      if (filters.branch === 'all') url.searchParams.delete('branch')
      else url.searchParams.set('branch', filters.branch)
      if (filters.channel === 'all') url.searchParams.delete('channel')
      else url.searchParams.set('channel', filters.channel)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    } catch {
      // ignore history/storage errors
    }
  }, [filters, hydrated])

  // Background fetch of /api/odoo-sync for live bucket updates if signed in
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
    return () => {
      active = false
    }
  }, [filters.period])

  const setPeriod = useCallback((period: GlobalPeriod) => setFilters((f) => ({ ...f, period })), [])
  const setBrand = useCallback((brand: GlobalBrand) => setFilters((f) => ({ ...f, brand })), [])
  const setBranch = useCallback((branch: GlobalBranch) => setFilters((f) => ({ ...f, branch })), [])
  const setChannel = useCallback((channel: GlobalChannel) => setFilters((f) => ({ ...f, channel })), [])
  const resetFilters = useCallback(() => setFilters(DEFAULT_GLOBAL_FILTERS), [])

  const workspace = useMemo(() => computeGlobalWorkspace(filters, liveSummary), [filters, liveSummary])

  const value = useMemo<GlobalFilterContextValue>(
    () => ({
      filters,
      workspace,
      liveSummary,
      setPeriod,
      setBrand,
      setBranch,
      setChannel,
      resetFilters,
    }),
    [filters, workspace, liveSummary, setPeriod, setBrand, setBranch, setChannel, resetFilters],
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
      setBrand: () => {},
      setBranch: () => {},
      setChannel: () => {},
      resetFilters: () => {},
    }
  }
  return ctx
}
