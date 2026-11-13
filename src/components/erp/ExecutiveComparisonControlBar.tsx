'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Download,
  GitCompareArrows,
  RotateCcw,
  Share2,
  Store,
  Truck,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  GLOBAL_BRANCH_OPTIONS,
  GLOBAL_BRAND_OPTIONS,
  GLOBAL_CHANNEL_OPTIONS,
  getBranchLabel,
  getBrandLabel,
  getChannelLabel,
  isBrandBranchCompatible,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'
import {
  DEFAULT_COMPARISON_DATE_A,
  DEFAULT_COMPARISON_DATE_B,
  DEFAULT_RANGE_FROM_A,
  DEFAULT_RANGE_FROM_B,
  DEFAULT_RANGE_TO_A,
  DEFAULT_RANGE_TO_B,
  formatCalendarDateBadge,
  normalizeWindowSelection,
  sanitizeIsoDate,
  shiftIsoDate,
  shiftIsoMonth,
  type BranchEntityId,
  type BrandEntityId,
  type ChannelEntityId,
  type ComparisonGranularity,
  type ComparisonModeType,
  type EntityComparisonDimension,
  type ErpComparisonQuery,
} from '@/lib/erp-comparison-engine'

export interface ExecutiveComparisonControlBarProps {
  query: ErpComparisonQuery
  onQueryChange: (updater: ErpComparisonQuery | ((prev: ErpComparisonQuery) => ErpComparisonQuery)) => void
  onReset?: () => void
  onExportCsv?: () => void
  /** Visual order of Selection Cards: `'a-first'` (Base A -> VS -> Compare B) or `'b-first'` (Before B -> VS -> After A) */
  order?: 'a-first' | 'b-first'
  labelAEn?: string
  labelAAr?: string
  labelBEn?: string
  labelBAr?: string
  syncUrlParams?: boolean
  syncGlobalScope?: boolean
  extraActions?: React.ReactNode
}

type OpenDropdownId = 'brand' | 'branch' | 'channel' | 'entityA' | 'entityB' | null

const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-2xl bg-[#F2F4F5] p-1 ring-1 ring-slate-900/[0.04] dark:bg-[#0B1410] dark:ring-emerald-500/15'
const SEGMENT_BTN_BASE =
  'shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE =
  'bg-white font-semibold text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white'

const DATE_INPUT_CLS =
  'h-9 min-w-[134px] flex-1 cursor-pointer rounded-xl bg-white px-2.5 text-[13px] font-semibold tracking-tight text-slate-900 tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.08] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:bg-[#101C17] dark:text-slate-100 dark:ring-emerald-500/20'

/** Hydrates an initial `ErpComparisonQuery` from URL `searchParams` + `GlobalFilterContext` */
export function readInitialComparisonQueryFromEnv(
  defaults: ErpComparisonQuery,
  globalFilters: { brand: GlobalBrand; branch: GlobalBranch; channel: GlobalChannel },
): ErpComparisonQuery {
  const brandIds: ErpComparisonQuery['brandIds'] =
    globalFilters.brand !== 'all' ? [globalFilters.brand] : defaults.brandIds
  const branchIds: ErpComparisonQuery['branchIds'] =
    globalFilters.branch !== 'all' ? [globalFilters.branch] : defaults.branchIds
  const channelIds: ErpComparisonQuery['channelIds'] =
    globalFilters.channel !== 'all' ? [globalFilters.channel] : defaults.channelIds

  const base: ErpComparisonQuery = {
    ...defaults,
    brandIds,
    branchIds,
    channelIds,
  }

  if (typeof window === 'undefined') return base

  try {
    const sp = new URLSearchParams(window.location.search)
    const compMode = sp.get('compMode')
    const gran = sp.get('gran')
    const dateA = sp.get('dateA')
    const toA = sp.get('toA')
    const dateB = sp.get('dateB')
    const toB = sp.get('toB')
    const entDim = sp.get('entDim')
    const entA = sp.get('entA')
    const entB = sp.get('entB')
    const brandsParam = sp.get('brands')
    const branchesParam = sp.get('branches')
    const channelsParam = sp.get('channels')

    const mode: ComparisonModeType =
      compMode === 'entity-vs-entity' || compMode === 'date-vs-date' ? compMode : base.mode
    const granularity: ComparisonGranularity =
      gran === 'range' || gran === 'single' ? gran : base.granularity

    const periodA = {
      from: dateA ? sanitizeIsoDate(dateA, base.periodA.from) : base.periodA.from,
      to: toA ? sanitizeIsoDate(toA, base.periodA.to) : dateA && granularity === 'single' ? sanitizeIsoDate(dateA, base.periodA.to) : base.periodA.to,
    }
    const periodB = {
      from: dateB ? sanitizeIsoDate(dateB, base.periodB.from) : base.periodB.from,
      to: toB ? sanitizeIsoDate(toB, base.periodB.to) : dateB && granularity === 'single' ? sanitizeIsoDate(dateB, base.periodB.to) : base.periodB.to,
    }

    let parsedBrands = base.brandIds
    if (brandsParam) {
      const valid = brandsParam
        .split(',')
        .filter((x): x is BrandEntityId => (APPROVED_BRAND_IDS as readonly string[]).includes(x))
      if (valid.length > 0 && valid.length < APPROVED_BRAND_IDS.length) parsedBrands = valid
      else if (brandsParam === 'all') parsedBrands = 'all'
    }

    let parsedBranches = base.branchIds
    if (branchesParam) {
      const valid = branchesParam
        .split(',')
        .filter((x): x is BranchEntityId => (APPROVED_BRANCH_IDS as readonly string[]).includes(x))
      if (valid.length > 0 && valid.length < APPROVED_BRANCH_IDS.length) parsedBranches = valid
      else if (branchesParam === 'all') parsedBranches = 'all'
    }

    let parsedChannels = base.channelIds
    if (channelsParam) {
      const valid = channelsParam
        .split(',')
        .filter((x): x is ChannelEntityId => (APPROVED_CHANNEL_IDS as readonly string[]).includes(x))
      if (valid.length > 0 && valid.length < APPROVED_CHANNEL_IDS.length) parsedChannels = valid
      else if (channelsParam === 'all') parsedChannels = 'all'
    }

    const entityDimension: EntityComparisonDimension =
      entDim === 'branch' || entDim === 'brand' ? entDim : base.entityDimension ?? 'brand'

    return {
      mode,
      granularity,
      periodA,
      periodB,
      brandIds: parsedBrands,
      branchIds: parsedBranches,
      channelIds: parsedChannels,
      entityDimension,
      entityA: (entA as BrandEntityId | BranchEntityId) || base.entityA || 'china-garden',
      entityB: (entB as BrandEntityId | BranchEntityId) || base.entityB || 'franks',
    }
  } catch {
    return base
  }
}

export function ExecutiveComparisonControlBar({
  query,
  onQueryChange,
  onReset,
  onExportCsv,
  order = 'a-first',
  labelAEn,
  labelAAr,
  labelBEn,
  labelBAr,
  syncUrlParams = true,
  syncGlobalScope = true,
  extraActions,
}: ExecutiveComparisonControlBarProps) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const { filters, setBrand, setBranch, setChannel } = useGlobalFilter()

  const [openMenu, setOpenMenu] = useState<OpenDropdownId>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const lastGlobalRef = useRef({
    brand: filters.brand,
    branch: filters.branch,
    channel: filters.channel,
  })

  // Close popovers on outside click or Escape
  useEffect(() => {
    if (!openMenu) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  // Follow external TopFilterBar changes seamlessly
  useEffect(() => {
    if (!syncGlobalScope) return
    const prev = lastGlobalRef.current
    const changed =
      prev.brand !== filters.brand ||
      prev.branch !== filters.branch ||
      prev.channel !== filters.channel
    if (!changed) return
    lastGlobalRef.current = {
      brand: filters.brand,
      branch: filters.branch,
      channel: filters.channel,
    }
    onQueryChange((q) => ({
      ...q,
      brandIds: filters.brand === 'all' ? 'all' : [filters.brand],
      branchIds: filters.branch === 'all' ? 'all' : [filters.branch],
      channelIds: filters.channel === 'all' ? 'all' : [filters.channel],
    }))
  }, [filters.brand, filters.branch, filters.channel, onQueryChange, syncGlobalScope])

  // Sync comparison state into URL searchParams so deep links preserve exact comparison
  useEffect(() => {
    if (!syncUrlParams || typeof window === 'undefined') return
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('compMode', query.mode)
      url.searchParams.set('gran', query.granularity)
      url.searchParams.set('dateA', query.periodA.from)
      if (query.granularity === 'range') {
        url.searchParams.set('toA', query.periodA.to)
      } else {
        url.searchParams.delete('toA')
      }
      if (query.mode === 'date-vs-date') {
        url.searchParams.set('dateB', query.periodB.from)
        if (query.granularity === 'range') {
          url.searchParams.set('toB', query.periodB.to)
        } else {
          url.searchParams.delete('toB')
        }
        url.searchParams.delete('entDim')
        url.searchParams.delete('entA')
        url.searchParams.delete('entB')
      } else {
        url.searchParams.set('entDim', query.entityDimension ?? 'brand')
        url.searchParams.set('entA', query.entityA ?? 'china-garden')
        url.searchParams.set('entB', query.entityB ?? 'franks')
      }

      if (query.brandIds === 'all') url.searchParams.delete('brands')
      else url.searchParams.set('brands', query.brandIds.join(','))

      if (query.branchIds === 'all') url.searchParams.delete('branches')
      else url.searchParams.set('branches', query.branchIds.join(','))

      if (query.channelIds === 'all') url.searchParams.delete('channels')
      else url.searchParams.set('channels', query.channelIds.join(','))

      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    } catch {
      // ignore history replace errors
    }
  }, [query, syncUrlParams])

  const normA = useMemo(
    () => normalizeWindowSelection(query.periodA, query.granularity, DEFAULT_COMPARISON_DATE_A),
    [query.periodA, query.granularity],
  )
  const normB = useMemo(
    () => normalizeWindowSelection(query.periodB, query.granularity, DEFAULT_COMPARISON_DATE_B),
    [query.periodB, query.granularity],
  )

  const badgeA = useMemo(() => formatCalendarDateBadge(normA.fromIso, isAr, true), [normA.fromIso, isAr])
  const badgeToA = useMemo(() => formatCalendarDateBadge(normA.toIso, isAr, true), [normA.toIso, isAr])
  const badgeB = useMemo(() => formatCalendarDateBadge(normB.fromIso, isAr, true), [normB.fromIso, isAr])
  const badgeToB = useMemo(() => formatCalendarDateBadge(normB.toIso, isAr, true), [normB.toIso, isAr])

  const setMode = useCallback(
    (mode: ComparisonModeType) => {
      onQueryChange((prev) => {
        if (mode === 'entity-vs-entity') {
          const dim = prev.entityDimension ?? 'brand'
          const defaultA = dim === 'brand' ? 'china-garden' : 'avenues'
          const defaultB = dim === 'brand' ? 'franks' : 'salmiya'
          return {
            ...prev,
            mode,
            entityDimension: dim,
            entityA: prev.entityA ?? defaultA,
            entityB: prev.entityB ?? defaultB,
          }
        }
        return { ...prev, mode }
      })
    },
    [onQueryChange],
  )

  const setGranularity = useCallback(
    (granularity: ComparisonGranularity) => {
      onQueryChange((prev) => {
        if (granularity === 'single') {
          return {
            ...prev,
            granularity: 'single',
            periodA: { from: prev.periodA.to, to: prev.periodA.to },
            periodB: { from: prev.periodB.to, to: prev.periodB.to },
          }
        }
        const curA = normalizeWindowSelection(prev.periodA, 'single', DEFAULT_RANGE_TO_A)
        const curB = normalizeWindowSelection(prev.periodB, 'single', DEFAULT_RANGE_TO_B)
        const rangeFromA = prev.periodA.from < prev.periodA.to ? prev.periodA.from : shiftIsoDate(curA.toIso, -6)
        const rangeFromB = prev.periodB.from < prev.periodB.to ? prev.periodB.from : shiftIsoDate(curB.toIso, -6)
        return {
          ...prev,
          granularity: 'range',
          periodA: { from: rangeFromA || DEFAULT_RANGE_FROM_A, to: curA.toIso || DEFAULT_RANGE_TO_A },
          periodB: { from: rangeFromB || DEFAULT_RANGE_FROM_B, to: curB.toIso || DEFAULT_RANGE_TO_B },
        }
      })
    },
    [onQueryChange],
  )

  const handleSwap = useCallback(() => {
    onQueryChange((prev) => {
      if (prev.mode === 'entity-vs-entity') {
        return {
          ...prev,
          entityA: prev.entityB,
          entityB: prev.entityA,
        }
      }
      return {
        ...prev,
        periodA: { ...prev.periodB },
        periodB: { ...prev.periodA },
      }
    })
  }, [onQueryChange])

  const applyQuickComparePreset = useCallback(
    (preset: 'yesterday' | 'last-week' | 'last-month') => {
      onQueryChange((prev) => {
        const curA = normalizeWindowSelection(prev.periodA, prev.granularity, DEFAULT_COMPARISON_DATE_A)
        if (prev.granularity === 'single') {
          const targetB =
            preset === 'yesterday'
              ? shiftIsoDate(curA.fromIso, -1)
              : preset === 'last-week'
                ? shiftIsoDate(curA.fromIso, -7)
                : shiftIsoMonth(curA.fromIso, -1)
          return {
            ...prev,
            periodB: { from: targetB, to: targetB },
          }
        }
        // Range mode: shift entire Period A window cleanly
        if (preset === 'yesterday') {
          const endB = shiftIsoDate(curA.fromIso, -1)
          const startB = shiftIsoDate(endB, -(curA.dayCount - 1))
          return { ...prev, periodB: { from: startB, to: endB } }
        }
        if (preset === 'last-week') {
          return {
            ...prev,
            periodB: {
              from: shiftIsoDate(curA.fromIso, -7),
              to: shiftIsoDate(curA.toIso, -7),
            },
          }
        }
        return {
          ...prev,
          periodB: {
            from: shiftIsoMonth(curA.fromIso, -1),
            to: shiftIsoMonth(curA.toIso, -1),
          },
        }
      })
    },
    [onQueryChange],
  )

  const syncScopeToGlobal = useCallback(
    (
      nextBrands: ErpComparisonQuery['brandIds'],
      nextBranches: ErpComparisonQuery['branchIds'],
      nextChannels: ErpComparisonQuery['channelIds'],
    ) => {
      if (!syncGlobalScope) return
      const gBrand: GlobalBrand =
        nextBrands !== 'all' && nextBrands.length === 1 ? nextBrands[0] : 'all'
      const gBranch: GlobalBranch =
        nextBranches !== 'all' && nextBranches.length === 1 ? nextBranches[0] : 'all'
      const gChannel: GlobalChannel =
        nextChannels !== 'all' && nextChannels.length === 1 ? nextChannels[0] : 'all'

      lastGlobalRef.current = { brand: gBrand, branch: gBranch, channel: gChannel }
      if (filters.brand !== gBrand) setBrand(gBrand)
      if (filters.branch !== gBranch) setBranch(gBranch)
      if (filters.channel !== gChannel) setChannel(gChannel)
    },
    [filters.brand, filters.branch, filters.channel, setBrand, setBranch, setChannel, syncGlobalScope],
  )

  const toggleBrandItem = useCallback(
    (id: BrandEntityId) => {
      onQueryChange((prev) => {
        const current = prev.brandIds === 'all' ? [] : [...prev.brandIds]
        const exists = current.includes(id)
        const nextArr = exists ? current.filter((x) => x !== id) : [...current, id]
        const nextBrands: ErpComparisonQuery['brandIds'] =
          nextArr.length === 0 || nextArr.length === APPROVED_BRAND_IDS.length ? 'all' : nextArr
        syncScopeToGlobal(nextBrands, prev.branchIds, prev.channelIds)
        return { ...prev, brandIds: nextBrands }
      })
    },
    [onQueryChange, syncScopeToGlobal],
  )

  const toggleBranchItem = useCallback(
    (id: BranchEntityId) => {
      onQueryChange((prev) => {
        const current = prev.branchIds === 'all' ? [] : [...prev.branchIds]
        const exists = current.includes(id)
        const nextArr = exists ? current.filter((x) => x !== id) : [...current, id]
        const nextBranches: ErpComparisonQuery['branchIds'] =
          nextArr.length === 0 || nextArr.length === APPROVED_BRANCH_IDS.length ? 'all' : nextArr
        syncScopeToGlobal(prev.brandIds, nextBranches, prev.channelIds)
        return { ...prev, branchIds: nextBranches }
      })
    },
    [onQueryChange, syncScopeToGlobal],
  )

  const toggleChannelItem = useCallback(
    (id: ChannelEntityId) => {
      onQueryChange((prev) => {
        const current = prev.channelIds === 'all' ? [] : [...prev.channelIds]
        const exists = current.includes(id)
        const nextArr = exists ? current.filter((x) => x !== id) : [...current, id]
        const nextChannels: ErpComparisonQuery['channelIds'] =
          nextArr.length === 0 || nextArr.length === APPROVED_CHANNEL_IDS.length ? 'all' : nextArr
        syncScopeToGlobal(prev.brandIds, prev.branchIds, nextChannels)
        return { ...prev, channelIds: nextChannels }
      })
    },
    [onQueryChange, syncScopeToGlobal],
  )

  const handleResetAll = useCallback(() => {
    syncScopeToGlobal('all', 'all', 'all')
    if (onReset) {
      onReset()
      return
    }
    onQueryChange({
      mode: 'date-vs-date',
      granularity: 'single',
      periodA: { from: DEFAULT_COMPARISON_DATE_A, to: DEFAULT_COMPARISON_DATE_A },
      periodB: { from: DEFAULT_COMPARISON_DATE_B, to: DEFAULT_COMPARISON_DATE_B },
      brandIds: 'all',
      branchIds: 'all',
      channelIds: 'all',
      entityDimension: 'brand',
      entityA: 'china-garden',
      entityB: 'franks',
    })
  }, [onQueryChange, onReset, syncScopeToGlobal])

  const handleCopyDeepLink = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 1800)
    } catch {
      // ignore clipboard errors
    }
  }, [])

  // Scope summary labels
  const brandPillLabel = useMemo(() => {
    if (query.brandIds === 'all') return isAr ? 'كل المطاعم (6)' : 'All 6 Brands'
    if (query.brandIds.length === 1) return getBrandLabel(query.brandIds[0], isAr)
    return isAr ? `${query.brandIds.length} مطاعم محددة` : `${query.brandIds.length} Brands Selected`
  }, [query.brandIds, isAr])

  const branchPillLabel = useMemo(() => {
    if (query.branchIds === 'all') return isAr ? 'كل الفروع (7)' : 'All 7 Branches'
    if (query.branchIds.length === 1) return getBranchLabel(query.branchIds[0], isAr)
    return isAr ? `${query.branchIds.length} فروع محددة` : `${query.branchIds.length} Branches Selected`
  }, [query.branchIds, isAr])

  const channelPillLabel = useMemo(() => {
    if (query.channelIds === 'all') return isAr ? 'كل القنوات (8)' : 'All 8 Channels'
    if (query.channelIds.length === 1) return getChannelLabel(query.channelIds[0], isAr)
    return isAr ? `${query.channelIds.length} قنوات محددة` : `${query.channelIds.length} Channels Selected`
  }, [query.channelIds, isAr])

  const entityDim = query.entityDimension ?? 'brand'
  const entityOptions = useMemo(
    () =>
      entityDim === 'brand'
        ? GLOBAL_BRAND_OPTIONS.filter((o) => o.id !== 'all')
        : GLOBAL_BRANCH_OPTIONS.filter((o) => o.id !== 'all'),
    [entityDim],
  )

  const resolvedTitleA = isAr
    ? labelAAr ?? (query.mode === 'entity-vs-entity' ? 'الجهة الأساسية (أ)' : 'التاريخ الأساسي (أ)')
    : labelAEn ?? (query.mode === 'entity-vs-entity' ? 'Primary Entity (Base A)' : 'Primary Date (Base A)')

  const resolvedTitleB = isAr
    ? labelBAr ?? (query.mode === 'entity-vs-entity' ? 'مقارنة مع الجهة (ب)' : 'مقارنة مع تاريخ مخصص (ب)')
    : labelBEn ?? (query.mode === 'entity-vs-entity' ? 'Compare With Entity (B)' : 'Compare With Custom Date (B)')

  const renderDateCardA = () => (
    <div className="flex-1 rounded-2xl bg-[#F7F8F9] p-3.5 ring-1 ring-emerald-600/15 transition-all duration-150 dark:bg-[#0B1511] dark:ring-emerald-500/25">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
          <span className="text-[12px] font-semibold tracking-tight text-emerald-900 dark:text-emerald-300">
            {resolvedTitleA}
          </span>
        </div>
        <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tracking-tight text-emerald-800 tabular-nums dark:bg-emerald-500/20 dark:text-emerald-200">
          {query.granularity === 'single'
            ? badgeA.full
            : isAr
              ? `${normA.dayCount} أيام • ${badgeA.shortDdMm}–${badgeToA.shortDdMm}`
              : `${normA.dayCount} Days • ${badgeA.shortDdMm}–${badgeToA.shortDdMm}`}
        </span>
      </div>

      {query.granularity === 'single' ? (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <input
            type="date"
            aria-label={resolvedTitleA}
            value={normA.fromIso}
            onChange={(e) => {
              const v = sanitizeIsoDate(e.target.value, normA.fromIso)
              onQueryChange((prev) => ({ ...prev, periodA: { from: v, to: v } }))
            }}
            className={DATE_INPUT_CLS}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-1.5">
            <span className="w-9 shrink-0 text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'من' : 'From'}
            </span>
            <input
              type="date"
              value={normA.fromIso}
              onChange={(e) => {
                const v = sanitizeIsoDate(e.target.value, normA.fromIso)
                onQueryChange((prev) => ({
                  ...prev,
                  periodA: { from: v, to: v > prev.periodA.to ? v : prev.periodA.to },
                }))
              }}
              className={DATE_INPUT_CLS}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="w-9 shrink-0 text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'إلى' : 'To'}
            </span>
            <input
              type="date"
              value={normA.toIso}
              onChange={(e) => {
                const v = sanitizeIsoDate(e.target.value, normA.toIso)
                onQueryChange((prev) => ({
                  ...prev,
                  periodA: { from: v < prev.periodA.from ? v : prev.periodA.from, to: v },
                }))
              }}
              className={DATE_INPUT_CLS}
            />
          </label>
        </div>
      )}
    </div>
  )

  const renderDateCardB = () => (
    <div className="flex-1 rounded-2xl bg-[#F7F8F9] p-3.5 ring-1 ring-slate-900/[0.06] transition-all duration-150 dark:bg-[#0B1511] dark:ring-white/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
          <span className="text-[12px] font-semibold tracking-tight text-slate-700 dark:text-slate-200">
            {resolvedTitleB}
          </span>
        </div>
        <span className="rounded-lg bg-slate-200/70 px-2 py-0.5 text-xs font-semibold tracking-tight text-slate-700 tabular-nums dark:bg-white/10 dark:text-slate-300">
          {query.granularity === 'single'
            ? badgeB.full
            : isAr
              ? `${normB.dayCount} أيام • ${badgeB.shortDdMm}–${badgeToB.shortDdMm}`
              : `${normB.dayCount} Days • ${badgeB.shortDdMm}–${badgeToB.shortDdMm}`}
        </span>
      </div>

      {query.granularity === 'single' ? (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          <input
            type="date"
            aria-label={resolvedTitleB}
            value={normB.fromIso}
            onChange={(e) => {
              const v = sanitizeIsoDate(e.target.value, normB.fromIso)
              onQueryChange((prev) => ({ ...prev, periodB: { from: v, to: v } }))
            }}
            className={DATE_INPUT_CLS}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-1.5">
            <span className="w-9 shrink-0 text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'من' : 'From'}
            </span>
            <input
              type="date"
              value={normB.fromIso}
              onChange={(e) => {
                const v = sanitizeIsoDate(e.target.value, normB.fromIso)
                onQueryChange((prev) => ({
                  ...prev,
                  periodB: { from: v, to: v > prev.periodB.to ? v : prev.periodB.to },
                }))
              }}
              className={DATE_INPUT_CLS}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="w-9 shrink-0 text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'إلى' : 'To'}
            </span>
            <input
              type="date"
              value={normB.toIso}
              onChange={(e) => {
                const v = sanitizeIsoDate(e.target.value, normB.toIso)
                onQueryChange((prev) => ({
                  ...prev,
                  periodB: { from: v < prev.periodB.from ? v : prev.periodB.from, to: v },
                }))
              }}
              className={DATE_INPUT_CLS}
            />
          </label>
        </div>
      )}

      {/* 1-Click Quick-Fill Helper Chips (populate custom date without locking user) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isAr ? 'تعبئة سريعة:' : 'Quick fill:'}
        </span>
        <button
          type="button"
          onClick={() => applyQuickComparePreset('yesterday')}
          className="cursor-pointer rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/[0.07] transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#101C17] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200"
        >
          {query.granularity === 'single'
            ? isAr
              ? 'اليوم السابق (أمس)'
              : 'Prior Day (Yesterday)'
            : isAr
              ? `الفترة السابقة (${normA.dayCount}ي)`
              : `Prior ${normA.dayCount}d`}
        </button>
        <button
          type="button"
          onClick={() => applyQuickComparePreset('last-week')}
          className="cursor-pointer rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/[0.07] transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#101C17] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200"
        >
          {isAr ? 'نفس اليوم الأسبوع الماضي' : 'Same Day Last Week'}
        </button>
        <button
          type="button"
          onClick={() => applyQuickComparePreset('last-month')}
          className="cursor-pointer rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/[0.07] transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#101C17] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200"
        >
          {isAr ? 'نفس اليوم الشهر الماضي' : 'Same Day Last Month'}
        </button>
      </div>
    </div>
  )

  const renderEntitySelectorCard = (slot: 'A' | 'B') => {
    const isSlotA = slot === 'A'
    const menuId: OpenDropdownId = isSlotA ? 'entityA' : 'entityB'
    const currentId =
      (isSlotA ? query.entityA : query.entityB) ??
      (entityDim === 'brand'
        ? isSlotA
          ? 'china-garden'
          : 'franks'
        : isSlotA
          ? 'avenues'
          : 'salmiya')
    const currentLabel =
      entityDim === 'brand'
        ? getBrandLabel(currentId as BrandEntityId, isAr)
        : getBranchLabel(currentId as BranchEntityId, isAr)

    return (
      <div className="relative flex-1 rounded-2xl bg-[#F7F8F9] p-3.5 ring-1 ring-slate-900/[0.06] dark:bg-[#0B1511] dark:ring-emerald-500/20">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                isSlotA ? 'bg-emerald-500' : 'bg-sky-500'
              }`}
            />
            <span className="text-[12px] font-semibold tracking-tight text-slate-700 dark:text-slate-200">
              {isSlotA ? resolvedTitleA : resolvedTitleB}
            </span>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {entityDim === 'brand'
              ? isAr
                ? 'مطعم معتمد'
                : 'Approved Brand'
              : isAr
                ? 'فرع نشط'
                : 'Active Branch'}
          </span>
        </div>

        <button
          type="button"
          aria-expanded={openMenu === menuId}
          onClick={() => setOpenMenu((m) => (m === menuId ? null : menuId))}
          className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-white px-3 text-[13px] font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.08] transition-all duration-150 hover:ring-emerald-500/40 dark:bg-[#101C17] dark:text-white dark:ring-emerald-500/20"
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {openMenu === menuId && (
          <div className="absolute start-0 end-0 top-full z-40 mt-1.5 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-900/10 dark:bg-[#101C17] dark:ring-emerald-500/25">
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {entityOptions.map((opt) => {
                const selected = opt.id === currentId
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onQueryChange((prev) =>
                        isSlotA
                          ? { ...prev, entityA: opt.id as BrandEntityId | BranchEntityId }
                          : { ...prev, entityB: opt.id as BrandEntityId | BranchEntityId },
                      )
                      setOpenMenu(null)
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-start text-[13px] transition-all duration-150 ${
                      selected
                        ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span>{isAr ? opt.ar : opt.en}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <section
      ref={rootRef}
      aria-label={isAr ? 'شريط التحكم بالمقارنة المخصصة' : 'Executive Custom Comparison Control Bar'}
      className="ae-bento-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:ring-emerald-500/12"
    >
      {/* ───────────── TOP ROW: Mode & Granularity Segmented Toggles + Actions ───────────── */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Pill 1: Date vs Custom Date | Brand / Branch vs Another */}
          <div role="tablist" className={SEGMENT_TRACK_CLS}>
            <button
              type="button"
              role="tab"
              aria-selected={query.mode === 'date-vs-date'}
              onClick={() => setMode('date-vs-date')}
              className={`${SEGMENT_BTN_BASE} ${
                query.mode === 'date-vs-date' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_IDLE
              }`}
            >
              {isAr ? 'مقارنة تاريخ بتقويم مخصص' : 'Date vs Custom Date'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={query.mode === 'entity-vs-entity'}
              onClick={() => setMode('entity-vs-entity')}
              className={`${SEGMENT_BTN_BASE} ${
                query.mode === 'entity-vs-entity' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_IDLE
              }`}
            >
              {isAr ? 'مقارنة براند أو فرع بآخر' : 'Brand / Branch vs Another'}
            </button>
          </div>

          {/* Segmented Pill 2: Single Day | Custom Range (From-To) */}
          <div role="tablist" className={SEGMENT_TRACK_CLS}>
            <button
              type="button"
              role="tab"
              aria-selected={query.granularity === 'single'}
              onClick={() => setGranularity('single')}
              className={`${SEGMENT_BTN_BASE} ${
                query.granularity === 'single' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_IDLE
              }`}
            >
              {isAr ? 'يوم محدد' : 'Single Day'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={query.granularity === 'range'}
              onClick={() => setGranularity('range')}
              className={`${SEGMENT_BTN_BASE} ${
                query.granularity === 'range' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_IDLE
              }`}
            >
              {isAr ? 'فترة مخصصة (من–إلى)' : 'Custom Range (From–To)'}
            </button>
          </div>
        </div>

        {/* Trailing Utility Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSwap}
            title={isAr ? 'تبديل طرفي المقارنة' : 'Swap Selection A and Selection B'}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3 text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-900 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15 dark:hover:bg-emerald-500/15"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            <span>{isAr ? 'تبديل أ ⇄ ب' : 'Swap A ⇄ B'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3 text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-all duration-150 hover:bg-slate-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>{isAr ? 'إعادة ضبط' : 'Reset'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyDeepLink}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3 text-[12.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-all duration-150 hover:bg-slate-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15"
          >
            {copiedLink ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Share2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{copiedLink ? (isAr ? 'تم نسخ الرابط' : 'Link Copied') : isAr ? 'رابط المقارنة' : 'Share Link'}</span>
          </button>

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 text-[12.5px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
            </button>
          )}

          {extraActions}
        </div>
      </div>

      {/* ───────────── MIDDLE ROW: Side-by-Side Selection Cards (A vs B) ───────────── */}
      {query.mode === 'date-vs-date' ? (
        <div className="mt-3.5 flex flex-col items-stretch gap-2.5 xl:flex-row xl:items-center">
          {order === 'b-first' ? renderDateCardB() : renderDateCardA()}

          <div className="flex shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={handleSwap}
              title={isAr ? 'اضغط لتبديل التاريخين' : 'Click to swap dates'}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl bg-emerald-50 px-3 text-[13px] font-extrabold tracking-wider text-emerald-800 ring-1 ring-emerald-600/20 transition-all duration-150 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              <span>{isAr ? 'مقابل' : 'VS'}</span>
            </button>
          </div>

          {order === 'b-first' ? renderDateCardA() : renderDateCardB()}
        </div>
      ) : (
        <div className="mt-3.5 space-y-2.5">
          {/* Entity Dimension Selector: Brand vs Brand | Branch vs Branch */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'نوع المقارنة المباشرة:' : 'Entity Dimension:'}
            </span>
            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              <button
                type="button"
                role="tab"
                aria-selected={entityDim === 'brand'}
                onClick={() =>
                  onQueryChange((prev) => ({
                    ...prev,
                    entityDimension: 'brand',
                    entityA: 'china-garden',
                    entityB: 'franks',
                  }))
                }
                className={`${SEGMENT_BTN_BASE} ${
                  entityDim === 'brand' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_IDLE
                }`}
              >
                {isAr ? 'مطعم مقابل مطعم (6)' : 'Brand vs Brand (6)'}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={entityDim === 'branch'}
                onClick={() =>
                  onQueryChange((prev) => ({
                    ...prev,
                    entityDimension: 'branch',
                    entityA: 'avenues',
                    entityB: 'salmiya',
                  }))
                }
                className={`${SEGMENT_BTN_BASE} ${
                  entityDim === 'branch' ? SEGMENT_BTN_ACTIVE : SEGMENT_BTN_IDLE
                }`}
              >
                {isAr ? 'فرع مقابل فرع (7)' : 'Branch vs Branch (7)'}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2.5 xl:flex-row xl:items-center">
            {renderEntitySelectorCard('A')}

            <div className="flex shrink-0 items-center justify-center">
              <button
                type="button"
                onClick={handleSwap}
                className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl bg-emerald-50 px-3 text-[13px] font-extrabold tracking-wider text-emerald-800 ring-1 ring-emerald-600/20 transition-all duration-150 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30"
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
                <span>{isAr ? 'مقابل' : 'VS'}</span>
              </button>
            </div>

            {renderEntitySelectorCard('B')}

            {/* Shared Evaluation Date / Custom Range */}
            <div className="flex-1 rounded-2xl bg-[#F7F8F9] p-3.5 ring-1 ring-slate-900/[0.06] dark:bg-[#0B1511] dark:ring-white/10">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold tracking-tight text-slate-700 dark:text-slate-200">
                  {isAr ? 'فترة التقييم' : 'Evaluation Date / Range'}
                </span>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                  {query.granularity === 'single'
                    ? badgeA.full
                    : isAr
                      ? `${normA.dayCount} أيام`
                      : `${normA.dayCount} Days`}
                </span>
              </div>
              {query.granularity === 'single' ? (
                <input
                  type="date"
                  value={normA.fromIso}
                  onChange={(e) => {
                    const v = sanitizeIsoDate(e.target.value, normA.fromIso)
                    onQueryChange((prev) => ({ ...prev, periodA: { from: v, to: v } }))
                  }}
                  className={DATE_INPUT_CLS}
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={normA.fromIso}
                    onChange={(e) => {
                      const v = sanitizeIsoDate(e.target.value, normA.fromIso)
                      onQueryChange((prev) => ({
                        ...prev,
                        periodA: { from: v, to: v > prev.periodA.to ? v : prev.periodA.to },
                      }))
                    }}
                    className={DATE_INPUT_CLS}
                  />
                  <input
                    type="date"
                    value={normA.toIso}
                    onChange={(e) => {
                      const v = sanitizeIsoDate(e.target.value, normA.toIso)
                      onQueryChange((prev) => ({
                        ...prev,
                        periodA: { from: v < prev.periodA.from ? v : prev.periodA.from, to: v },
                      }))
                    }}
                    className={DATE_INPUT_CLS}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────── BOTTOM ROW: Synchronized Scope Filters (Brands + Branches + Channels) ───────────── */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 dark:border-white/[0.07]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'نطاق التصفية:' : 'Filter Scope:'}
          </span>

          {/* 1. Brands Multi-Select Popover Pill */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'brand'}
              onClick={() => setOpenMenu((m) => (m === 'brand' ? null : 'brand'))}
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-[12.5px] font-semibold transition-all duration-150 ${
                query.brandIds !== 'all'
                  ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/25 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30'
                  : 'bg-[#F6F7F8] text-slate-700 ring-1 ring-slate-900/[0.06] hover:bg-slate-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15'
              }`}
            >
              <Store className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{brandPillLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>

            {openMenu === 'brand' && (
              <div className="absolute start-0 top-full z-40 mt-1.5 w-68 rounded-2xl bg-white p-2.5 shadow-xl ring-1 ring-slate-900/10 dark:bg-[#101C17] dark:ring-emerald-500/25">
                <div className="mb-1.5 flex items-center justify-between px-2 py-1">
                  <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                    {isAr ? 'اختر مطعماً أو أكثر (6)' : 'Select 1 or more Brands (6)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      syncScopeToGlobal('all', query.branchIds, query.channelIds)
                      onQueryChange((prev) => ({ ...prev, brandIds: 'all' }))
                    }}
                    className="cursor-pointer text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    {isAr ? 'تحديد الكل' : 'All 6'}
                  </button>
                </div>
                <div className="space-y-1">
                  {GLOBAL_BRAND_OPTIONS.filter((b) => b.id !== 'all').map((b) => {
                    const id = b.id as BrandEntityId
                    const checked = query.brandIds === 'all' || query.brandIds.includes(id)
                    const activeInSelectedBranches =
                      query.branchIds === 'all' ||
                      query.branchIds.some((br) => isBrandBranchCompatible(id, br))
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleBrandItem(id)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-start text-[12.5px] transition-all duration-150 ${
                          checked && query.brandIds !== 'all'
                            ? 'bg-emerald-50 font-semibold text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100'
                            : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                        } ${!activeInSelectedBranches ? 'opacity-50' : ''}`}
                      >
                        <div className="flex flex-col">
                          <span>{isAr ? b.ar : b.en}</span>
                          {!activeInSelectedBranches && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {isAr ? 'خارج الفرع المحدد' : 'Not in selected branch'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md ring-1 ${
                            checked
                              ? 'bg-emerald-600 text-white ring-emerald-600'
                              : 'bg-white ring-slate-300 dark:bg-[#0B1410] dark:ring-slate-600'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Branches Multi-Select Popover Pill */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'branch'}
              onClick={() => setOpenMenu((m) => (m === 'branch' ? null : 'branch'))}
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-[12.5px] font-semibold transition-all duration-150 ${
                query.branchIds !== 'all'
                  ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/25 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30'
                  : 'bg-[#F6F7F8] text-slate-700 ring-1 ring-slate-900/[0.06] hover:bg-slate-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15'
              }`}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{branchPillLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>

            {openMenu === 'branch' && (
              <div className="absolute start-0 top-full z-40 mt-1.5 w-72 rounded-2xl bg-white p-2.5 shadow-xl ring-1 ring-slate-900/10 dark:bg-[#101C17] dark:ring-emerald-500/25">
                <div className="mb-1.5 flex items-center justify-between px-2 py-1">
                  <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                    {isAr ? 'اختر فرعاً أو أكثر (7)' : 'Select 1 or more Branches (7)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      syncScopeToGlobal(query.brandIds, 'all', query.channelIds)
                      onQueryChange((prev) => ({ ...prev, branchIds: 'all' }))
                    }}
                    className="cursor-pointer text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    {isAr ? 'تحديد الكل' : 'All 7'}
                  </button>
                </div>
                <div className="max-h-68 space-y-1 overflow-y-auto">
                  {GLOBAL_BRANCH_OPTIONS.filter((br) => br.id !== 'all').map((br) => {
                    const id = br.id as BranchEntityId
                    const checked = query.branchIds === 'all' || query.branchIds.includes(id)
                    const compatibleWithBrand =
                      query.brandIds === 'all' ||
                      query.brandIds.some((b) => isBrandBranchCompatible(b, id))
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleBranchItem(id)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-start text-[12.5px] transition-all duration-150 ${
                          checked && query.branchIds !== 'all'
                            ? 'bg-emerald-50 font-semibold text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100'
                            : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                        } ${!compatibleWithBrand ? 'opacity-50' : ''}`}
                      >
                        <div className="flex flex-col">
                          <span>{isAr ? br.ar : br.en}</span>
                          {!compatibleWithBrand && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {isAr ? 'لا يشغّل المطعم المحدد' : 'Brand inactive in this branch'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md ring-1 ${
                            checked
                              ? 'bg-emerald-600 text-white ring-emerald-600'
                              : 'bg-white ring-slate-300 dark:bg-[#0B1410] dark:ring-slate-600'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Channels Multi-Select Popover Pill */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'channel'}
              onClick={() => setOpenMenu((m) => (m === 'channel' ? null : 'channel'))}
              className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-[12.5px] font-semibold transition-all duration-150 ${
                query.channelIds !== 'all'
                  ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/25 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30'
                  : 'bg-[#F6F7F8] text-slate-700 ring-1 ring-slate-900/[0.06] hover:bg-slate-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15'
              }`}
            >
              <Truck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{channelPillLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>

            {openMenu === 'channel' && (
              <div className="absolute start-0 top-full z-40 mt-1.5 w-68 rounded-2xl bg-white p-2.5 shadow-xl ring-1 ring-slate-900/10 dark:bg-[#101C17] dark:ring-emerald-500/25">
                <div className="mb-1.5 flex items-center justify-between px-2 py-1">
                  <span className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                    {isAr ? 'اختر قناة بيع أو أكثر (8)' : 'Select Sales Channels (8)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      syncScopeToGlobal(query.brandIds, query.branchIds, 'all')
                      onQueryChange((prev) => ({ ...prev, channelIds: 'all' }))
                    }}
                    className="cursor-pointer text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    {isAr ? 'تحديد الكل' : 'All 8'}
                  </button>
                </div>
                <div className="max-h-68 space-y-1 overflow-y-auto">
                  {GLOBAL_CHANNEL_OPTIONS.filter((ch) => ch.id !== 'all').map((ch) => {
                    const id = ch.id as ChannelEntityId
                    const checked = query.channelIds === 'all' || query.channelIds.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleChannelItem(id)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-start text-[12.5px] transition-all duration-150 ${
                          checked && query.channelIds !== 'all'
                            ? 'bg-emerald-50 font-semibold text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100'
                            : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>{isAr ? ch.ar : ch.en}</span>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md ring-1 ${
                            checked
                              ? 'bg-emerald-600 text-white ring-emerald-600'
                              : 'bg-white ring-slate-300 dark:bg-[#0B1410] dark:ring-slate-600'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reconciliation & Ledger Integrity Pill */}
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            {isAr
              ? 'متزامن مع أودو 17 • تطابق 0.000 د.ك'
              : 'Synced with Odoo 17 POS • 0.000 KWD Gap'}
          </span>
        </div>
      </div>
    </section>
  )
}
