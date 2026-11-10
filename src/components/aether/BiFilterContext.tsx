'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BRANDS,
  BRANCHES,
  CHANNELS,
  DEFAULT_FILTERS,
  PERIODS,
  ledgerView,
  type BiFilters,
  type BranchId,
  type BrandId,
  type ChannelId,
  type LedgerView,
  type Period,
} from '@/lib/aether/ledger'

const STORAGE_KEY = 'aetherbi_v2_filters'
const PALETTE_EVENT = 'aetherbi:open-palette'

type BiFilterContextValue = {
  filters: BiFilters
  view: LedgerView
  hydrated: boolean
  setBrand: (id: BrandId | 'all') => void
  setBranch: (id: BranchId | 'all') => void
  setChannel: (id: ChannelId | 'all') => void
  setPeriod: (p: Period) => void
  reset: () => void
  setFilters: (patch: Partial<BiFilters>) => void
}

const BiFilterContext = createContext<BiFilterContextValue | null>(null)

function sanitize(input: unknown): BiFilters {
  if (!input || typeof input !== 'object') return DEFAULT_FILTERS
  const raw = input as Record<string, unknown>
  const brand = BRANDS.some((b) => b.id === raw.brand) ? (raw.brand as BrandId) : 'all'
  const branch = BRANCHES.some((b) => b.id === raw.branch) ? (raw.branch as BranchId) : 'all'
  const channel = CHANNELS.some((c) => c.id === raw.channel) ? (raw.channel as ChannelId) : 'all'
  const period = PERIODS.some((p) => p.id === raw.period) ? (raw.period as Period) : 'monthly'
  return { brand, branch, channel, period }
}

/** Live global BI context: every V2 surface reads the same brand × branch × channel × period slice. */
export function BiFilterProvider({ children }: { children: ReactNode }) {
  // Server and first client render always start from the full group ledger (no hydration mismatch).
  const [filters, setFiltersState] = useState<BiFilters>(DEFAULT_FILTERS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setFiltersState(sanitize(JSON.parse(stored)))
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // storage may be unavailable (private mode)
    }
  }, [filters, hydrated])

  const setFilters = useCallback((patch: Partial<BiFilters>) => {
    setFiltersState((prev) => sanitize({ ...prev, ...patch }))
  }, [])

  const value = useMemo<BiFilterContextValue>(
    () => ({
      filters,
      view: ledgerView(filters),
      hydrated,
      setBrand: (brand) => setFilters({ brand }),
      setBranch: (branch) => setFilters({ branch }),
      setChannel: (channel) => setFilters({ channel }),
      setPeriod: (period) => setFilters({ period }),
      reset: () => setFiltersState(DEFAULT_FILTERS),
      setFilters,
    }),
    [filters, hydrated, setFilters],
  )

  return <BiFilterContext.Provider value={value}>{children}</BiFilterContext.Provider>
}

const FALLBACK: BiFilterContextValue = {
  filters: DEFAULT_FILTERS,
  view: ledgerView(DEFAULT_FILTERS),
  hydrated: false,
  setBrand: () => undefined,
  setBranch: () => undefined,
  setChannel: () => undefined,
  setPeriod: () => undefined,
  reset: () => undefined,
  setFilters: () => undefined,
}

export function useBiFilters() {
  return useContext(BiFilterContext) ?? FALLBACK
}

export function openCommandPalette() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PALETTE_EVENT))
}

export const COMMAND_PALETTE_EVENT = PALETTE_EVENT
