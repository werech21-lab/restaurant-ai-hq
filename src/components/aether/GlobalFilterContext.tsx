'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  APPROVED_KUWAIT_SLICES,
  APPROVED_PROFIT_LENSES,
  computeGlobalWorkspace,
  DEFAULT_CUSTOM_FROM,
  DEFAULT_CUSTOM_TO,
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
import { clampPeriodToKuwaitToday, getKuwaitTodayIso } from '@/lib/aether/period-delta'
import type { ExecSessionRole } from '@/lib/auth/exec-role-meta'
import { UNAVAILABLE_DASH, formatInt, formatKwd, formatPct } from '@/lib/format'

const STORAGE_KEY = 'aether.globalFilters.v2'
const SILENT_POLL_INTERVAL_MS = 180_000 // 3 minutes silent live Odoo 17 polling

function normalizeSyncPayloadToSummary(raw: Partial<OdooLiveSummary> | null | undefined): OdooLiveSummary {
  if (raw && raw.connected === true && raw.totals) {
    return raw as OdooLiveSummary
  }
  return {
    source: 'disconnected',
    connected: false,
    sourceMode: 'disconnected',
    noData: true,
    messageAr: raw?.messageAr ?? 'لا توجد بيانات من Odoo لهذه الفترة',
    lastSyncAt: raw?.lastSyncAt ?? null,
    isStale24h: Boolean(raw?.isStale24h),
    odooCompanyId: raw?.odooCompanyId ?? null,
    dateRange: raw?.dateRange ?? { from: DEFAULT_CUSTOM_FROM, to: DEFAULT_CUSTOM_TO },
    period: raw?.period ?? raw?.dateRange ?? { from: DEFAULT_CUSTOM_FROM, to: DEFAULT_CUSTOM_TO },
    database: null,
    diagnosticCode: raw?.diagnosticCode,
    syncedAt: raw?.syncedAt ?? '',
    totals: { netSalesKwd: 0, orders: 0, aovKwd: 0 },
    brands: [],
    branches: [],
    channels: [],
  }
}

interface GlobalFilterContextValue {
  filters: Required<GlobalFilters>
  workspace: GlobalWorkspaceSlice
  liveSummary: OdooLiveSummary | null
  isAuditor: boolean
  sessionRole: ExecSessionRole
  syncingOdoo: boolean
  syncCooldownSec: number
  triggerOdooSyncNow: () => Promise<void>
  setPeriod: (period: GlobalPeriod) => void
  setCustomRange: (from: string, to: string) => void
  setKuwaitSlice: (slice: KuwaitSlice) => void
  setBrand: (brand: GlobalBrand) => void
  setBranch: (branch: GlobalBranch) => void
  setChannel: (channel: GlobalChannel) => void
  setLens: (lens: ProfitLens) => void
  resetFilters: () => void
  buildShareDeepLinkText: (pathname: string, isAr: boolean) => string
}

const GlobalFilterContext = createContext<GlobalFilterContextValue | null>(null)

function sanitizeFilters(
  raw: Partial<GlobalFilters> | null | undefined,
  pathname?: string | null,
): Required<GlobalFilters> {
  if (!raw) return DEFAULT_GLOBAL_FILTERS
  const isSubpage = Boolean(pathname && pathname !== '/erp')
  const period: GlobalPeriod =
    raw.period === 'today' ||
    raw.period === 'week' ||
    raw.period === 'month' ||
    raw.period === 'year' ||
    raw.period === 'custom'
      ? raw.period
      : 'month'
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  let customFrom = raw.customFrom && isoRe.test(raw.customFrom) ? raw.customFrom : DEFAULT_CUSTOM_FROM
  let customTo = raw.customTo && isoRe.test(raw.customTo) ? raw.customTo : DEFAULT_CUSTOM_TO
  if (customFrom > customTo) {
    const tmp = customFrom
    customFrom = customTo
    customTo = tmp
  }
  const clampedInit = clampPeriodToKuwaitToday({ from: customFrom, to: customTo })
  customFrom = clampedInit.from
  customTo = clampedInit.to
  const kuwaitSlice: KuwaitSlice = isSubpage
    ? 'all'
    : raw.kuwaitSlice && (APPROVED_KUWAIT_SLICES as readonly string[]).includes(raw.kuwaitSlice)
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
  const lens: ProfitLens = isSubpage
    ? 'all'
    : raw.lens && (APPROVED_PROFIT_LENSES as readonly string[]).includes(raw.lens)
      ? (raw.lens as ProfitLens)
      : 'all'
  return { period, customFrom, customTo, kuwaitSlice, brand, branch, channel, lens }
}

export function GlobalFilterProvider({
  children,
  isAuditor = false,
  sessionRole = 'admin',
}: {
  children: React.ReactNode
  isAuditor?: boolean
  sessionRole?: ExecSessionRole
}) {
  const pathname = usePathname() ?? ''
  const isSubpage = Boolean(pathname && pathname !== '/erp')

  const [filters, setFilters] = useState<Required<GlobalFilters>>(DEFAULT_GLOBAL_FILTERS)
  const [hydrated, setHydrated] = useState(false)
  const [liveSummary, setLiveSummary] = useState<OdooLiveSummary | null>(null)
  const [customDailySeries, setCustomDailySeries] = useState<
    { day: string; orders: number; netKwd: number }[]
  >([])
  const [syncingOdoo, setSyncingOdoo] = useState(false)
  const [syncCooldownSec, setSyncCooldownSec] = useState(0)

  useEffect(() => {
    if (syncCooldownSec <= 0) return undefined
    const timer = window.setTimeout(() => {
      setSyncCooldownSec((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [syncCooldownSec])

  // Hydrate from URL query params first, then localStorage
  useEffect(() => {
    try {
      const currentPath = window.location.pathname
      const sp = new URLSearchParams(window.location.search)
      const hasUrl =
        sp.has('period') ||
        sp.has('from') ||
        sp.has('to') ||
        sp.has('slice') ||
        sp.has('brand') ||
        sp.has('branch') ||
        sp.has('channel') ||
        sp.has('lens')
      if (hasUrl) {
        setFilters(
          sanitizeFilters(
            {
              period: (sp.get('period') as GlobalPeriod) || undefined,
              customFrom: sp.get('from') || undefined,
              customTo: sp.get('to') || undefined,
              kuwaitSlice: (sp.get('slice') as KuwaitSlice) || undefined,
              brand: (sp.get('brand') as GlobalBrand) || undefined,
              branch: (sp.get('branch') as GlobalBranch) || undefined,
              channel: (sp.get('channel') as GlobalChannel) || undefined,
              lens: (sp.get('lens') as ProfitLens) || undefined,
            },
            currentPath,
          ),
        )
      } else {
        const saved =
          window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem('aether.globalFilters.v1')
        if (saved) {
          setFilters(sanitizeFilters(JSON.parse(saved) as Partial<GlobalFilters>, currentPath))
        }
      }
    } catch {
      // ignore storage errors
    }
    setHydrated(true)
  }, [])

  // Auto-reset filters.lens & filters.kuwaitSlice to 'all' (and strip ?lens= & ?slice=)
  // whenever navigating away from /erp so subpages NEVER get stuck on Quiet Hours!
  useEffect(() => {
    if (!pathname || pathname === '/erp') return
    setFilters((prev) => {
      if (prev.lens === 'all' && prev.kuwaitSlice === 'all') return prev
      return { ...prev, lens: 'all', kuwaitSlice: 'all' }
    })
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('lens') || url.searchParams.has('slice')) {
        url.searchParams.delete('lens')
        url.searchParams.delete('slice')
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      }
    } catch {
      // ignore history errors
    }
  }, [pathname])

  const effectiveFilters = useMemo<Required<GlobalFilters>>(
    () =>
      isSubpage
        ? {
            ...filters,
            lens: 'all',
            kuwaitSlice: 'all',
          }
        : filters,
    [filters, isSubpage],
  )

  // Persist to localStorage & lightweight URL query sync
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(effectiveFilters))
      const url = new URL(window.location.href)
      if (effectiveFilters.period === 'month') {
        url.searchParams.delete('period')
        url.searchParams.delete('from')
        url.searchParams.delete('to')
      } else {
        url.searchParams.set('period', effectiveFilters.period)
        if (effectiveFilters.period === 'custom') {
          url.searchParams.set('from', effectiveFilters.customFrom)
          url.searchParams.set('to', effectiveFilters.customTo)
        } else {
          url.searchParams.delete('from')
          url.searchParams.delete('to')
        }
      }
      if (isSubpage || effectiveFilters.kuwaitSlice === 'all') url.searchParams.delete('slice')
      else url.searchParams.set('slice', effectiveFilters.kuwaitSlice)
      if (effectiveFilters.brand === 'all') url.searchParams.delete('brand')
      else url.searchParams.set('brand', effectiveFilters.brand)
      if (effectiveFilters.branch === 'all') url.searchParams.delete('branch')
      else url.searchParams.set('branch', effectiveFilters.branch)
      if (effectiveFilters.channel === 'all') url.searchParams.delete('channel')
      else url.searchParams.set('channel', effectiveFilters.channel)
      if (isSubpage || effectiveFilters.lens === 'all') url.searchParams.delete('lens')
      else url.searchParams.set('lens', effectiveFilters.lens)
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    } catch {
      // ignore history/storage errors
    }
  }, [effectiveFilters, hydrated, isSubpage])

  // Background fetch of /api/erp/odoo-sync + silent 3-minute polling on active executive sessions
  useEffect(() => {
    let active = true
    const qs =
      effectiveFilters.period === 'custom'
        ? `period=custom&from=${encodeURIComponent(effectiveFilters.customFrom)}&to=${encodeURIComponent(effectiveFilters.customTo)}`
        : `period=${encodeURIComponent(effectiveFilters.period)}`
    const cacheKey = `aether_live_odoo_summary_v1:${qs}`

    try {
      const cachedRaw = window.sessionStorage.getItem(cacheKey)
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as { savedAt?: number; data?: OdooLiveSummary }
        if (
          parsed?.data?.connected === true &&
          parsed?.data?.noData !== true &&
          parsed?.data?.totals &&
          typeof parsed.savedAt === 'number' &&
          Date.now() - parsed.savedAt < 5 * 60_000
        ) {
          setLiveSummary((prev) => prev ?? parsed.data ?? null)
        } else {
          window.sessionStorage.removeItem(cacheKey)
        }
      }
    } catch {
      // ignore sessionStorage quota/access errors
    }

    const pullSilentStatus = () => {
      fetch(`/api/erp/odoo-sync?${qs}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
        .then((res) => (res.ok ? (res.json() as Promise<Partial<OdooLiveSummary>>) : null))
        .then((data) => {
          if (!active) return
          const normalized = normalizeSyncPayloadToSummary(data)
          setLiveSummary(normalized)
          try {
            if (normalized.connected && !normalized.noData) {
              window.sessionStorage.setItem(
                cacheKey,
                JSON.stringify({ savedAt: Date.now(), data: normalized }),
              )
            } else {
              window.sessionStorage.removeItem(cacheKey)
            }
          } catch {
            // ignore sessionStorage quota errors
          }
          if (typeof data?.syncCooldownRemainingSec === 'number') {
            setSyncCooldownSec(Math.max(0, Math.round(data.syncCooldownRemainingSec)))
          }
        })
        .catch(() => {
          if (!active) return
          try {
            window.sessionStorage.removeItem(cacheKey)
          } catch {
            // ignore sessionStorage errors
          }
          setLiveSummary(normalizeSyncPayloadToSummary(null))
        })
    }

    pullSilentStatus()

    const pollTimer = !isAuditor
      ? window.setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return
          }
          pullSilentStatus()
        }, SILENT_POLL_INTERVAL_MS)
      : null

    const onSyncEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<OdooLiveSummary>>).detail
      if (detail) setLiveSummary(normalizeSyncPayloadToSummary(detail))
    }
    window.addEventListener('aether:odoo-sync', onSyncEvent)
    return () => {
      active = false
      if (pollTimer !== null) window.clearInterval(pollTimer)
      window.removeEventListener('aether:odoo-sync', onSyncEvent)
    }
  }, [effectiveFilters.customFrom, effectiveFilters.customTo, effectiveFilters.period, isAuditor])

  const triggerOdooSyncNow = useCallback(async () => {
    if (isAuditor || syncCooldownSec > 0) return
    setSyncingOdoo(true)
    try {
      const qs =
        effectiveFilters.period === 'custom'
          ? `period=custom&from=${encodeURIComponent(effectiveFilters.customFrom)}&to=${encodeURIComponent(effectiveFilters.customTo)}`
          : `period=${encodeURIComponent(effectiveFilters.period)}`
      const res = await fetch(
        `/api/erp/odoo-sync?${qs}`,
        {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        },
      )
      if (!res.ok) {
        const disconnected = normalizeSyncPayloadToSummary(null)
        setLiveSummary(disconnected)
        window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: disconnected }))
        return
      }
      const rawFresh = (await res.json()) as Partial<OdooLiveSummary>
      const fresh = normalizeSyncPayloadToSummary(rawFresh)
      setLiveSummary(fresh)
      setSyncCooldownSec(
        typeof rawFresh?.syncCooldownRemainingSec === 'number' && rawFresh.syncCooldownRemainingSec > 0
          ? Math.round(rawFresh.syncCooldownRemainingSec)
          : 30,
      )
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: fresh }))
    } catch {
      const disconnected = normalizeSyncPayloadToSummary(null)
      setLiveSummary(disconnected)
      window.dispatchEvent(new CustomEvent('aether:odoo-sync', { detail: disconnected }))
    } finally {
      setSyncingOdoo(false)
    }
  }, [effectiveFilters.customFrom, effectiveFilters.customTo, effectiveFilters.period, isAuditor, syncCooldownSec])

  // Hydrate custom global date ranges from /api/erp/live-comparison so Company Summary & Comparison stay 100% unified
  useEffect(() => {
    if (effectiveFilters.period !== 'custom') {
      setCustomDailySeries([])
      return undefined
    }
    let active = true
    const qs = new URLSearchParams({
      dateA: effectiveFilters.customFrom,
      toA: effectiveFilters.customTo,
      dateB: effectiveFilters.customFrom,
      toB: effectiveFilters.customTo,
      granularity: 'range',
    })
    fetch(`/api/erp/live-comparison?${qs.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{
              connected?: boolean
              dailySeries?: { day: string; orders: number; netKwd: number }[]
            }>)
          : null,
      )
      .then((payload) => {
        if (!active) return
        if (
          payload?.connected === false ||
          !Array.isArray(payload?.dailySeries) ||
          payload.dailySeries.length === 0
        ) {
          setCustomDailySeries([])
          return
        }
        setCustomDailySeries(payload.dailySeries)
      })
      .catch(() => {
        if (active) setCustomDailySeries([])
      })
    return () => {
      active = false
    }
  }, [effectiveFilters.period, effectiveFilters.customFrom, effectiveFilters.customTo])

  const setPeriod = useCallback((period: GlobalPeriod) => setFilters((f) => ({ ...f, period })), [])
  const setCustomRange = useCallback((from: string, to: string) => {
    setFilters((f) => {
      const fClean = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : f.customFrom
      const tClean = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : f.customTo
      const [start, end] = fClean <= tClean ? [fClean, tClean] : [tClean, fClean]
      const clamped = clampPeriodToKuwaitToday({ from: start, to: end })
      return { ...f, period: 'custom', customFrom: clamped.from, customTo: clamped.to }
    })
  }, [])
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

  const effectiveLiveSummary = useMemo<OdooLiveSummary | null>(() => {
    if (!liveSummary) return null
    if (liveSummary.connected !== true) return liveSummary
    const kwToday = getKuwaitTodayIso()
    if (customDailySeries.length === 0) {
      return {
        ...liveSummary,
        dailySeries: (liveSummary.dailySeries ?? []).filter((d) => d.day <= kwToday),
      }
    }
    const merged = new Map<string, { day: string; orders: number; netKwd: number }>()
    for (const d of liveSummary.dailySeries ?? []) {
      if (d.day <= kwToday) merged.set(d.day, d)
    }
    for (const d of customDailySeries) {
      if (d.day <= kwToday) merged.set(d.day, d)
    }
    return {
      ...liveSummary,
      dailySeries: [...merged.values()].sort((a, b) => a.day.localeCompare(b.day)),
    }
  }, [liveSummary, customDailySeries])

  const workspace = useMemo(
    () => computeGlobalWorkspace(effectiveFilters, effectiveLiveSummary, pathname),
    [effectiveFilters, effectiveLiveSummary, pathname],
  )

  const buildShareDeepLinkText = useCallback(
    (targetPath: string, isAr: boolean): string => {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const params = new URLSearchParams()
      const allowHomeSlices = targetPath === '/erp'
      if (effectiveFilters.period !== 'month') params.set('period', effectiveFilters.period)
      if (effectiveFilters.period === 'custom') {
        params.set('from', effectiveFilters.customFrom)
        params.set('to', effectiveFilters.customTo)
      }
      if (allowHomeSlices && effectiveFilters.kuwaitSlice !== 'all') {
        params.set('slice', effectiveFilters.kuwaitSlice)
      }
      if (effectiveFilters.brand !== 'all') params.set('brand', effectiveFilters.brand)
      if (effectiveFilters.branch !== 'all') params.set('branch', effectiveFilters.branch)
      if (effectiveFilters.channel !== 'all') params.set('channel', effectiveFilters.channel)
      if (allowHomeSlices && effectiveFilters.lens !== 'all') {
        params.set('lens', effectiveFilters.lens)
      }
      const qs = params.toString()
      const deepUrl = `${origin}${targetPath}${qs ? `?${qs}` : ''}`
      const salesFmt =
        workspace.nullableSalesKwd === null
          ? isAr
            ? 'غير متاح'
            : UNAVAILABLE_DASH
          : formatKwd(workspace.nullableSalesKwd, { showUnit: false })
      const ordFmt = formatInt(workspace.nullableOrders)

      const netLabelAr =
        workspace.accounting.netProfitPct !== null
          ? formatPct(workspace.accounting.netProfitPct)
          : 'غير متوفر'
      const netLabelEn =
        workspace.accounting.netProfitPct !== null
          ? formatPct(workspace.accounting.netProfitPct)
          : 'Not available'

      if (isAr) {
        return [
          `📊 *فنتشر فودز — ${workspace.subtitleAr}*`,
          `• المبيعات: ${salesFmt} د.ك (${ordFmt} طلب) | صافي الربح المحاسبي: ${netLabelAr}`,
          `• التشخيص: ${workspace.diagnosticStrip.rootCauseAr}`,
          `🔗 رابط مباشر: ${deepUrl}`,
        ].join('\n')
      }
      return [
        `📊 *Venture Foods — ${workspace.subtitleEn}*`,
        `• Sales: ${salesFmt} KWD (${ordFmt} orders) | GL Net Margin: ${netLabelEn}`,
        `• Diagnosis: ${workspace.diagnosticStrip.rootCauseEn}`,
        `🔗 Deep Link: ${deepUrl}`,
      ].join('\n')
    },
    [effectiveFilters, workspace],
  )

  const resolvedSessionRole: ExecSessionRole = isAuditor ? 'auditor' : sessionRole

  const value = useMemo<GlobalFilterContextValue>(
    () => ({
      filters: effectiveFilters,
      workspace,
      liveSummary: effectiveLiveSummary,
      isAuditor,
      sessionRole: resolvedSessionRole,
      syncingOdoo,
      syncCooldownSec,
      triggerOdooSyncNow,
      setPeriod,
      setCustomRange,
      setKuwaitSlice,
      setBrand,
      setBranch,
      setChannel,
      setLens,
      resetFilters,
      buildShareDeepLinkText,
    }),
    [
      effectiveFilters,
      workspace,
      effectiveLiveSummary,
      isAuditor,
      resolvedSessionRole,
      syncingOdoo,
      syncCooldownSec,
      triggerOdooSyncNow,
      setPeriod,
      setCustomRange,
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
      isAuditor: false,
      sessionRole: 'admin',
      syncingOdoo: false,
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
  return ctx
}
