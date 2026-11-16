'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ChefHat, Flame, Layers } from 'lucide-react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type {
  ConsumptionResult,
  KitchenProduction,
  KitchenWaste,
  Recipe,
} from '@/modules/kitchen/client'

type Item = { id: string; sku: string; name: string }
type Warehouse = { id: string; code: string; name: string }
type Page<T> = { data: T[]; nextCursor: string | null }

function todayKuwait(): string {
  return formatDate(new Date(), 'en')
}

const inputCls =
  'ds-focus-ring mt-1.5 min-h-11 w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 dark:border-white/20 dark:bg-[#0D1512] dark:text-slate-50 dark:placeholder:text-slate-500'
const labelCls = 'block text-sm font-semibold text-slate-800 dark:text-slate-200'
const primaryBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const noticeCls =
  'rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/45 dark:text-emerald-100'

export interface KitchenWorkspaceInitialData {
  recipes?: Recipe[]
  waste?: KitchenWaste[]
  productions?: KitchenProduction[]
  items?: Item[]
  warehouses?: Warehouse[]
}

function Workspace({
  initialPhase,
  initialError,
  initialData,
}: {
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: KitchenWorkspaceInitialData
}) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale === 'ar'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canRecord = useCan(permissions.inventoryStockAdjust)

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>(initialPhase ?? 'loading')
  const [error, setError] = useState<MessageKey>(initialError ?? 'erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>(initialData?.recipes ?? [])
  const [waste, setWaste] = useState<KitchenWaste[]>(initialData?.waste ?? [])
  const [productions, setProductions] = useState<KitchenProduction[]>(
    initialData?.productions ?? [],
  )
  const [items, setItems] = useState<Item[]>(initialData?.items ?? [])
  const [warehouses, setWarehouses] = useState<Warehouse[]>(initialData?.warehouses ?? [])
  const [itemId, setItemId] = useState(initialData?.items?.[0]?.id ?? '')
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouses?.[0]?.id ?? '')
  const [quantity, setQuantity] = useState('1')
  const [wastedOn, setWastedOn] = useState(todayKuwait)
  const [reason, setReason] = useState('')
  const [recipeId, setRecipeId] = useState(initialData?.recipes?.[0]?.id ?? '')
  const [batches, setBatches] = useState('1')
  const [producedOn, setProducedOn] = useState(todayKuwait)
  const [busy, setBusy] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1)
  }, [])

  useEffect(() => {
    if (initialPhase !== undefined && reloadToken === 0) return
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Recipe[] }>('/api/v1/kitchen/recipes', { signal: controller.signal }),
      apiRequest<Page<KitchenWaste>>('/api/v1/kitchen/waste?limit=20', {
        signal: controller.signal,
      }),
      apiRequest<Page<KitchenProduction>>('/api/v1/kitchen/productions?limit=20', {
        signal: controller.signal,
      }),
      apiRequest<Page<Item>>('/api/v1/inventory/items?limit=100', {
        signal: controller.signal,
      }),
      apiRequest<Page<Warehouse>>('/api/v1/inventory/warehouses?limit=100&status=active', {
        signal: controller.signal,
      }),
    ])
      .then(([recipePage, wastePage, productionPage, itemPage, warehousePage]) => {
        setRecipes(recipePage.data)
        setWaste(wastePage.data)
        setProductions(productionPage.data)
        setItems(itemPage.data)
        setWarehouses(warehousePage.data)
        setItemId(itemPage.data[0]?.id ?? '')
        setWarehouseId(warehousePage.data[0]?.id ?? '')
        setRecipeId(recipePage.data[0]?.id ?? '')
        setActionError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [initialPhase, reloadToken])

  async function saveWaste(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      const result = await apiRequest<{ data: KitchenWaste & ConsumptionResult }>(
        '/api/v1/kitchen/waste',
        {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(),
          body: { itemId, warehouseId, quantity: Number(quantity), wastedOn, reason },
        },
      )
      setWaste((current) => [result.data, ...current])
      setReason('')
      setNotice(result.data.journalEntryId)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveProduction(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      const result = await apiRequest<{ data: KitchenProduction & ConsumptionResult }>(
        '/api/v1/kitchen/productions',
        {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(),
          body: { recipeId, warehouseId, batches: Number(batches), producedOn, notes: null },
        },
      )
      setProductions((current) => [result.data, ...current])
      setNotice(result.data.journalEntryId)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
        <StateBlock state="loading" locale={fmtLocale} skeletonRows={4} title={t('kwork.loading')} />
      </div>
    )
  }

  if (phase === 'error') {
    const isForbidden = error === 'erp.err.forbidden' || error === 'erp.err.unauthenticated'
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
        <StateBlock
          state={isForbidden ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={isForbidden ? undefined : reload}
        />
      </div>
    )
  }

  const totalWasteMinor = waste.reduce(
    (sum, row) =>
      sum +
      ('costMinor' in row && Number.isFinite(Number((row as KitchenWaste & ConsumptionResult).costMinor))
        ? Number((row as KitchenWaste & ConsumptionResult).costMinor)
        : 0),
    0,
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard
        locale={fmtLocale}
        icon={<ChefHat className="h-4 w-4" aria-hidden />}
        title={t('kwork.title')}
        subtitle={t('kwork.lead')}
        actions={
          <Link
            href="/erp/kds"
            className="ds-focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 dark:border-white/20 dark:bg-[#141F1B] dark:text-slate-50 dark:hover:bg-white/[0.06]"
          >
            {isAr ? 'شاشة KDS' : 'Open KDS'}
          </Link>
        }
      >
        <div className="rounded-2xl border border-amber-400/40 bg-amber-50/90 px-4 py-3.5 text-amber-950 dark:border-amber-400/25 dark:bg-amber-950/35 dark:text-amber-100">
          <p className="text-sm font-bold">{t('kwork.backflush')}</p>
          <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
            {t('kwork.backflush.hint')}
          </p>
        </div>

        {notice ? (
          <p role="status" className={`${noticeCls} mt-4`}>
            {t('kwork.saved')}{' '}
            <Link
              href={`/erp/ledger?entry=${notice}`}
              className="ds-focus-ring inline-flex min-h-11 items-center rounded px-1 font-bold underline"
            >
              {t('kwork.journal')}
            </Link>
          </p>
        ) : null}

        {actionError ? (
          <div className="mt-4">
            <StateBlock
              state={actionError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
              compact
              locale={fmtLocale}
              title={t(actionError)}
            />
          </div>
        ) : null}
      </SectionCard>

      <section className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          locale={fmtLocale}
          icon={<Flame className="h-4 w-4" aria-hidden />}
          title={t('kwork.waste')}
        >
          <form onSubmit={(event) => void saveWaste(event)} className="space-y-3.5">
            <label className={labelCls}>
              {t('kwork.item')}
              <select
                className={inputCls}
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                disabled={!canRecord || busy}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} — {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t('kwork.warehouse')}
              <select
                className={inputCls}
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                disabled={!canRecord || busy}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t('kwork.quantity')}
              <input
                className={inputCls}
                dir="ltr"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                inputMode="numeric"
                disabled={!canRecord || busy}
              />
            </label>
            <label className={labelCls}>
              {t('kwork.date')}
              <input
                className={inputCls}
                dir="ltr"
                type="date"
                value={wastedOn}
                onChange={(event) => setWastedOn(event.target.value)}
                disabled={!canRecord || busy}
              />
            </label>
            <label className={labelCls}>
              {t('kwork.reason')}
              <input
                className={inputCls}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
                disabled={!canRecord || busy}
              />
            </label>
            <button
              className={primaryBtnCls}
              type="submit"
              disabled={!canRecord || busy || reason.trim() === ''}
            >
              {t('kwork.saveWaste')}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          locale={fmtLocale}
          icon={<Layers className="h-4 w-4" aria-hidden />}
          title={t('kwork.production')}
        >
          <form onSubmit={(event) => void saveProduction(event)} className="space-y-3.5">
            <label className={labelCls}>
              {t('kwork.recipes')}
              <select
                className={inputCls}
                value={recipeId}
                onChange={(event) => setRecipeId(event.target.value)}
                disabled={!canRecord || busy || recipes.length === 0}
              >
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t('kwork.batches')}
              <input
                className={inputCls}
                dir="ltr"
                value={batches}
                onChange={(event) => setBatches(event.target.value)}
                inputMode="numeric"
                disabled={!canRecord || busy}
              />
            </label>
            <label className={labelCls}>
              {t('kwork.date')}
              <input
                className={inputCls}
                dir="ltr"
                type="date"
                value={producedOn}
                onChange={(event) => setProducedOn(event.target.value)}
                disabled={!canRecord || busy}
              />
            </label>
            <button
              className={primaryBtnCls}
              type="submit"
              disabled={!canRecord || busy || recipeId === ''}
            >
              {t('kwork.saveProduction')}
            </button>
          </form>
        </SectionCard>
      </section>

      <SectionCard locale={fmtLocale} title={t('kwork.recipes')}>
        {recipes.length === 0 ? (
          <StateBlock state="empty" compact locale={fmtLocale} title={t('kwork.empty')} />
        ) : (
          <ul className="space-y-2 text-sm text-slate-900 dark:text-slate-100">
            {recipes.map((recipe) => (
              <li
                key={recipe.id}
                className="ds-surface-subtle flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 font-medium"
              >
                <span>{recipe.name}</span>
                <span dir="ltr" className="ds-num text-xs text-slate-600 dark:text-slate-300">
                  {recipe.lines.map((line) => formatInt(line.quantity, fmtLocale)).join(' + ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        locale={fmtLocale}
        title={t('kwork.waste')}
        actions={
          <span
            dir="ltr"
            className="ds-num rounded-xl border border-rose-500/30 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {t('kwork.wasteVariance')}: {formatKwd(totalWasteMinor / 1000, { locale: fmtLocale })}
          </span>
        }
      >
        {waste.length === 0 ? (
          <StateBlock state="empty" compact locale={fmtLocale} title={t('kwork.empty')} />
        ) : (
          <ul className="space-y-2 text-sm text-slate-900 dark:text-slate-100">
            {waste.map((row) => {
              const hasCost = 'costMinor' in row
              const costVal = hasCost
                ? Number((row as KitchenWaste & ConsumptionResult).costMinor)
                : null
              const costText =
                costVal !== null && Number.isFinite(costVal)
                  ? formatKwd(costVal / 1000, { locale: fmtLocale })
                  : null
              return (
                <li
                  key={row.id}
                  className="ds-surface-subtle flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span dir="ltr" className="ds-num text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(row.wastedOn, fmtLocale)}
                    </span>
                    <span dir="ltr" className="ds-num font-bold">
                      {formatInt(row.quantity, fmtLocale)}
                    </span>
                    <span>{row.reason}</span>
                  </div>
                  {hasCost ? (
                    <span
                      dir="ltr"
                      title={costText ? undefined : unavailableTooltip}
                      className="ds-num font-bold text-rose-800 dark:text-rose-300"
                    >
                      {costText ?? UNAVAILABLE_DASH}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard locale={fmtLocale} title={t('kwork.production')}>
        {productions.length === 0 ? (
          <StateBlock state="empty" compact locale={fmtLocale} title={t('kwork.empty')} />
        ) : (
          <ul className="space-y-2 text-sm text-slate-900 dark:text-slate-100">
            {productions.map((row) => {
              const hasCost = 'costMinor' in row
              const costVal = hasCost
                ? Number((row as KitchenProduction & ConsumptionResult).costMinor)
                : null
              const costText =
                costVal !== null && Number.isFinite(costVal)
                  ? formatKwd(costVal / 1000, { locale: fmtLocale })
                  : null
              return (
                <li
                  key={row.id}
                  className="ds-surface-subtle flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span dir="ltr" className="ds-num text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(row.producedOn, fmtLocale)}
                    </span>
                    <span dir="ltr" className="ds-num font-bold">
                      {formatInt(row.batches, fmtLocale)}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {t('kwork.backflush')}
                    </span>
                  </div>
                  {hasCost ? (
                    <span
                      dir="ltr"
                      title={costText ? undefined : unavailableTooltip}
                      className="ds-num font-bold text-emerald-800 dark:text-emerald-300"
                    >
                      {costText ?? UNAVAILABLE_DASH}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

export default function KitchenWorkspace({
  permissions: held,
  initialPhase,
  initialError,
  initialData,
}: {
  permissions: readonly string[]
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: KitchenWorkspaceInitialData
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace
        initialPhase={initialPhase}
        initialError={initialError}
        initialData={initialData}
      />
    </PermissionProvider>
  )
}
