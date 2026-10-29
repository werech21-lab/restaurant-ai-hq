'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, noticeClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { ConsumptionResult, KitchenProduction, KitchenWaste, Recipe } from '@/modules/kitchen/client'

type Item = { id: string; sku: string; name: string }
type Warehouse = { id: string; code: string; name: string }
type Page<T> = { data: T[]; nextCursor: string | null }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function Workspace() {
  const { t } = useI18n()
  const canRecord = useCan(permissions.inventoryStockAdjust)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [notice, setNotice] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [waste, setWaste] = useState<KitchenWaste[]>([])
  const [productions, setProductions] = useState<KitchenProduction[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [itemId, setItemId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [wastedOn, setWastedOn] = useState(today)
  const [reason, setReason] = useState('')
  const [recipeId, setRecipeId] = useState('')
  const [batches, setBatches] = useState('1')
  const [producedOn, setProducedOn] = useState(today)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<{ data: Recipe[] }>('/api/v1/kitchen/recipes', { signal: controller.signal }),
      apiRequest<Page<KitchenWaste>>('/api/v1/kitchen/waste?limit=20', { signal: controller.signal }),
      apiRequest<Page<KitchenProduction>>('/api/v1/kitchen/productions?limit=20', { signal: controller.signal }),
      apiRequest<Page<Item>>('/api/v1/inventory/items?limit=100', { signal: controller.signal }),
      apiRequest<Page<Warehouse>>('/api/v1/inventory/warehouses?limit=100&status=active', { signal: controller.signal }),
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
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [])

  async function saveWaste(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const result = await apiRequest<{ data: KitchenWaste & ConsumptionResult }>('/api/v1/kitchen/waste', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { itemId, warehouseId, quantity: Number(quantity), wastedOn, reason },
      })
      setWaste((current) => [result.data, ...current])
      setReason('')
      setNotice(result.data.journalEntryId)
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveProduction(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const result = await apiRequest<{ data: KitchenProduction & ConsumptionResult }>('/api/v1/kitchen/productions', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { recipeId, warehouseId, batches: Number(batches), producedOn, notes: null },
      })
      setProductions((current) => [result.data, ...current])
      setNotice(result.data.journalEntryId)
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') return <p className="text-sm text-mist-300">{t('kwork.loading')}</p>
  if (phase === 'error') return <p className={errorClass}>{t(error)}</p>

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-mist-100">{t('kwork.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-mist-400">{t('kwork.lead')}</p>
      </header>
      {notice ? (
        <p className={noticeClass}>
          {t('kwork.saved')}{' '}
          <Link href={`/erp/ledger?entry=${notice}`} className="text-blue-300 underline">
            {t('kwork.journal')}
          </Link>
        </p>
      ) : null}
      {phase === 'ready' && error !== 'erp.err.generic' ? <p className={errorClass}>{t(error)}</p> : null}
      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={(event) => void saveWaste(event)} className="space-y-3 rounded-2xl border border-gold-300/15 p-4">
          <h2 className="font-semibold text-gold-300">{t('kwork.waste')}</h2>
          <label className="block text-sm text-mist-300">
            {t('kwork.item')}
            <select className={inputClass} value={itemId} onChange={(event) => setItemId(event.target.value)} disabled={!canRecord || busy}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-mist-300">
            {t('kwork.warehouse')}
            <select className={inputClass} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} disabled={!canRecord || busy}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} — {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-mist-300">
            {t('kwork.quantity')}
            <input className={inputClass} value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" disabled={!canRecord || busy} />
          </label>
          <label className="block text-sm text-mist-300">
            {t('kwork.date')}
            <input className={inputClass} type="date" value={wastedOn} onChange={(event) => setWastedOn(event.target.value)} disabled={!canRecord || busy} />
          </label>
          <label className="block text-sm text-mist-300">
            {t('kwork.reason')}
            <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} disabled={!canRecord || busy} />
          </label>
          <button className={primaryButton} type="submit" disabled={!canRecord || busy || reason.trim() === ''}>
            {t('kwork.saveWaste')}
          </button>
        </form>
        <form onSubmit={(event) => void saveProduction(event)} className="space-y-3 rounded-2xl border border-gold-300/15 p-4">
          <h2 className="font-semibold text-gold-300">{t('kwork.production')}</h2>
          <label className="block text-sm text-mist-300">
            {t('kwork.recipes')}
            <select className={inputClass} value={recipeId} onChange={(event) => setRecipeId(event.target.value)} disabled={!canRecord || busy || recipes.length === 0}>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-mist-300">
            {t('kwork.batches')}
            <input className={inputClass} value={batches} onChange={(event) => setBatches(event.target.value)} inputMode="numeric" disabled={!canRecord || busy} />
          </label>
          <label className="block text-sm text-mist-300">
            {t('kwork.date')}
            <input className={inputClass} type="date" value={producedOn} onChange={(event) => setProducedOn(event.target.value)} disabled={!canRecord || busy} />
          </label>
          <button className={primaryButton} type="submit" disabled={!canRecord || busy || recipeId === ''}>
            {t('kwork.saveProduction')}
          </button>
        </form>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-mist-100">{t('kwork.recipes')}</h2>
        {recipes.length === 0 ? <p className="text-sm text-mist-400">{t('kwork.empty')}</p> : null}
        <ul className="space-y-2 text-sm text-mist-100">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="rounded-xl border border-gold-300/10 px-3 py-2">
              {recipe.name} · {recipe.lines.map((line) => `${line.quantity}`).join(' + ')}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-mist-100">{t('kwork.waste')}</h2>
        {waste.length === 0 ? <p className="text-sm text-mist-400">{t('kwork.empty')}</p> : null}
        <ul className="space-y-2 text-sm">
          {waste.map((row) => (
            <li key={row.id} className="rounded-xl border border-gold-300/10 px-3 py-2 text-mist-100">
              {row.wastedOn} · {row.quantity} · {row.reason}
              {'costMinor' in row ? ` · ${formatMinor((row as KitchenWaste & ConsumptionResult).costMinor)}` : ''}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-mist-100">{t('kwork.production')}</h2>
        {productions.length === 0 ? <p className="text-sm text-mist-400">{t('kwork.empty')}</p> : null}
        <ul className="space-y-2 text-sm">
          {productions.map((row) => (
            <li key={row.id} className="rounded-xl border border-gold-300/10 px-3 py-2 text-mist-100">
              {row.producedOn} · {row.batches}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default function KitchenWorkspace({ permissions: held }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace />
    </PermissionProvider>
  )
}
