'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Banknote,
  Link2,
  ChefHat,
  Minus,
  Plus,
  Trash2,
  Search,
  Wifi,
  WifiOff,
  StickyNote,
} from 'lucide-react'
import { createSalesInvoice } from '@/app/actions/sales'
import { GlobalScopeFilter } from '@/components/GlobalScopeFilter'
import { useOptionalScope } from '@/components/ScopeProvider'
import { LanguageSwitch, useI18n } from '@/lib/i18n'
import { formatQty } from '@/lib/format'
import { enqueueSale, listQueued, removeQueued } from '@/lib/offline-pos'
import type { OrderTypeId, VentureBranchOption } from '@/lib/venture-branches'

type PosProduct = {
  id: string
  code: string
  name: string
  category: string
  price: number
  stock: number
}

type CartLine = { product: PosProduct; quantity: number; note: string }

const CAT_ICONS: Record<string, string> = {
  الكل: '✦',
  'الوجبات الرئيسية': '🍽',
  المشروبات: '🥤',
  الحلويات: '🍮',
  الإضافات: '➕',
}

export function PosTerminal({
  products,
  walkInId,
  customers,
  brands,
  branches,
  orderTypes,
  initialBrandCode,
  initialBranchId,
  warehouseId,
}: {
  products: PosProduct[]
  walkInId: string
  customers: Array<{ id: string; name: string }>
  brands: Array<{ code: string; nameAr: string; nameEn?: string }>
  branches: VentureBranchOption[]
  orderTypes: Array<{ id: OrderTypeId | string; labelAr: string }>
  initialBrandCode?: string
  initialBranchId?: string
  warehouseId?: string
}) {
  const router = useRouter()
  const { t, money, locale } = useI18n()
  const scope = useOptionalScope()
  const categoryLabels = useMemo(
    () =>
      ({
        الكل: t('pos.all'),
        'الوجبات الرئيسية': t('pos.mains'),
        المشروبات: t('pos.drinks'),
        الحلويات: t('pos.desserts'),
        الإضافات: t('pos.extras'),
      }) as Record<string, string>,
    [t],
  )
  const categories = useMemo(() => {
    const fromData = Array.from(new Set(products.map((p) => p.category)))
    const preferred = ['الوجبات الرئيسية', 'المشروبات', 'الحلويات', 'الإضافات']
    const rest = fromData.filter((c) => !preferred.includes(c))
    return ['الكل', ...preferred.filter((c) => fromData.includes(c)), ...rest]
  }, [products])

  const [brandCode, setBrandCode] = useState(initialBrandCode || brands[0]?.code || '')
  const [branchId, setBranchId] = useState(
    () =>
      initialBranchId ||
      branches.find((b) => b.brandCode === (initialBrandCode || brands[0]?.code))?.id ||
      branches[0]?.id ||
      '',
  )

  useEffect(() => {
    if (scope?.brandId) setBrandCode(scope.brandId)
    if (scope?.branchId) setBranchId(scope.branchId)
  }, [scope?.brandId, scope?.branchId])
  const [orderType, setOrderType] = useState<string>(orderTypes[0]?.id ?? 'dine_in')
  const [tableNo, setTableNo] = useState('')
  const [category, setCategory] = useState('الكل')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'CREDIT'>('CARD')
  const [customerId, setCustomerId] = useState(walkInId)
  const [tendered, setTendered] = useState('')
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [queued, setQueued] = useState(0)
  const [online, setOnline] = useState(true)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [noteLineId, setNoteLineId] = useState<string | null>(null)

  const brandBranches = useMemo(() => branches.filter((b) => b.brandCode === brandCode), [branches, brandCode])

  useEffect(() => {
    const first = brandBranches[0]
    if (first && !brandBranches.some((b) => b.id === branchId)) setBranchId(first.id)
  }, [brandBranches, branchId])

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine)
    syncOnline()
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
    return () => {
      window.removeEventListener('online', syncOnline)
      window.removeEventListener('offline', syncOnline)
    }
  }, [])

  useEffect(() => {
    let alive = true
    async function flush() {
      const rows = await listQueued().catch(() => [])
      if (!alive) return
      setQueued(rows.length)
      if (!navigator.onLine || rows.length === 0) return
      for (const row of rows) {
        const result = await createSalesInvoice({
          partyId: row.partyId,
          paidAmount: row.paidAmount,
          discount: 0,
          paymentMethod: row.paymentMethod,
          source: 'pos',
          items: row.items,
        }).catch(() => null)
        if (!result?.ok) break
        await removeQueued(row.id)
      }
      const left = await listQueued().catch(() => [])
      if (alive) setQueued(left.length)
    }
    flush()
    const onOnline = () => flush()
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'POS_SYNC') flush()
    }
    window.addEventListener('online', onOnline)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      alive = false
      window.removeEventListener('online', onOnline)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  const checkoutRef = useRef<(printOnly?: boolean) => Promise<void>>(async () => undefined)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault()
        document.getElementById('pos-search')?.focus()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        void checkoutRef.current(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visible = products.filter((product) => {
    const inCategory = category === 'الكل' || product.category === category
    const text = query.trim()
    const matches = !text || product.name.includes(text) || product.code.toLowerCase().includes(text.toLowerCase())
    return inCategory && matches
  })

  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.product.price, 0)
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const total = Math.max(subtotal - discountValue, 0)
  const change = method === 'CASH' ? Math.max((Number(tendered) || 0) - total, 0) : 0

  function add(product: PosProduct) {
    setFlashId(product.id)
    window.setTimeout(() => setFlashId(null), 220)
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      if (existing) {
        return current.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line))
      }
      return [...current, { product, quantity: 1, note: '' }]
    })
  }

  function onBarcode(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const code = query.trim().toLowerCase()
    const product = products.find((item) => item.code.toLowerCase() === code)
    if (product) {
      add(product)
      setQuery('')
    }
  }

  async function checkout(printOnly = false) {
    setError('')
    if (cart.length === 0) {
      setError('السلة فارغة')
      return
    }
    if (orderType === 'dine_in' && !tableNo.trim()) {
      setError('أدخل رقم الطاولة للطلب المحلي')
      return
    }
    const partyId = method === 'CREDIT' ? customerId : walkInId || customerId
    if (!partyId) {
      setError('عميل الصندوق غير موجود. اسحب بيانات Odoo أو أعد التغذية.')
      return
    }
    if (method === 'CREDIT' && partyId === walkInId) {
      setError('اختر عميلاً للبيع الآجل / رابط الدفع')
      return
    }
    const payload = {
      partyId,
      paidAmount: method === 'CREDIT' ? 0 : total,
      paymentMethod: method,
      warehouseId: warehouseId || undefined,
      items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity, price: line.product.price })),
      customData: {
        brandCode,
        branchId,
        orderType,
        tableNo: tableNo.trim(),
      },
    }
    if (!navigator.onLine) {
      await enqueueSale({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...payload })
      setCart([])
      setQueued((count) => count + 1)
      setNotice('وضع Offline Ready — حُفظت الفاتورة محلياً للمزامنة لاحقاً.')
      return
    }
    setPending(true)
    let result: Awaited<ReturnType<typeof createSalesInvoice>> | null = null
    try {
      result = await createSalesInvoice({ ...payload, discount: discountValue, source: 'pos' })
    } catch {
      await enqueueSale({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...payload })
      setPending(false)
      setCart([])
      setQueued((count) => count + 1)
      setNotice('تعذر الوصول للسيرفر. حُفظت الفاتورة Offline.')
      return
    }
    setPending(false)
    if (!result.ok || !result.id) {
      setError(result.ok ? 'تعذر إصدار الإيصال' : result.message)
      return
    }
    if (printOnly || method !== 'CREDIT') {
      router.push(`/sales/${result.id}/print?layout=thermal`)
      return
    }
    setNotice(`صدرت الفاتورة — جاهزة لرابط الدفع / ماي فاتورة`)
    setCart([])
    router.push(`/sales/${result.id}/print?layout=thermal`)
  }

  checkoutRef.current = checkout

  async function sendKitchen() {
    if (cart.length === 0) {
      setError('لا أصناف لإرسالها للمطبخ')
      return
    }
    const notes = cart
      .filter((l) => l.note.trim())
      .map((l) => `${l.product.name}: ${l.note}`)
      .join(' · ')
    setNotice(
      `أُرسلت ${cart.reduce((s, l) => s + l.quantity, 0)} قطعة إلى محطة التحضير (${brands.find((b) => b.code === brandCode)?.nameAr || ''} · ${orderTypes.find((o) => o.id === orderType)?.labelAr || ''}${tableNo ? ` · طاولة ${tableNo}` : ''})${notes ? ` — ملاحظات: ${notes}` : ''}`,
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-mist-100 md:h-screen">
      <header className="sticky top-0 z-30 border-b border-gold-300/15 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
          <a href="/dashboard" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:border-[#8cc63f]/40">
            {t('nav.backSystem')}
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="hidden h-8 w-auto sm:block" />
          <LanguageSwitch />
          <GlobalScopeFilter compact />
          <select
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs font-semibold text-mist-100"
            value={brandCode}
            onChange={(e) => {
              const next = e.target.value
              setBrandCode(next)
              scope?.setBrand(next as never)
            }}
          >
            {brands.map((b) => (
              <option key={b.code} value={b.code}>
                {locale === 'en' && b.nameEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
          <select
            className="max-w-[11rem] rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs font-semibold text-mist-100 sm:max-w-none"
            value={branchId}
            onChange={(e) => {
              const next = e.target.value
              setBranchId(next)
              scope?.setBranch(next as never)
            }}
          >
            {brandBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {locale === 'en' ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs font-semibold text-mist-100"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
          >
            {orderTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.labelAr}
              </option>
            ))}
          </select>
          {orderType === 'dine_in' ? (
            <input
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
              placeholder={t('pos.table')}
              className="w-24 rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-xs font-bold text-gold-300"
            />
          ) : null}
          <div className="ms-auto flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                online ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'
              }`}
            >
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? t('pos.online') : t('pos.offline')}
            </span>
            {queued > 0 ? <span className="text-[11px] font-semibold text-amber-300">طابور: {queued}</span> : null}
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[65fr_35fr]">
        <section className="min-h-0 overflow-y-auto border-b border-white/5 p-3 sm:p-4 lg:border-b-0 lg:border-e lg:border-white/5">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
            <input
              id="pos-search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onBarcode}
              placeholder={t('pos.search')}
              className="w-full rounded-xl border border-white/10 bg-ink-900 py-3 pe-3 ps-10 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-[#8cc63f]/50"
            />
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  item === category
                    ? 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950'
                    : 'border border-white/10 bg-ink-900 text-mist-300 hover:border-gold-300/30'
                }`}
              >
                <span className="me-1.5 opacity-80">{CAT_ICONS[item] ?? '•'}</span>
                {categoryLabels[item] ?? item}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => add(product)}
                className={`rounded-2xl border p-3 text-right transition active:scale-[0.98] ${
                  flashId === product.id
                    ? 'border-[#8cc63f] bg-[#8cc63f]/20 shadow-[0_0_0_2px_rgba(140,198,63,0.35)]'
                    : 'border-gold-300/15 bg-ink-900/90 hover:border-[#00a99d]/50'
                }`}
              >
                <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-mist-100">{product.name}</p>
                <p className="mt-1 text-[11px] text-mist-500" dir="ltr">
                  {product.code}
                </p>
                <p className="mt-3 text-base font-black text-gold-300">{money(product.price)}</p>
                <p
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    product.stock <= 5 ? 'bg-red-600/25 text-red-300' : 'bg-emerald-600/20 text-emerald-300'
                  }`}
                >
                  {t('pos.stock')} {formatQty(product.stock)}
                </p>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="mt-10 text-center text-sm text-mist-500">{t('pos.emptyMenu')}</p>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col bg-[#0d0f12] p-3 sm:p-4">
          {error ? <p className="mb-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">{error}</p> : null}
          {notice ? <p className="mb-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">{notice}</p> : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-mist-500">{t('pos.emptyCart')}</p>
            ) : (
              cart.map((line) => (
                <div key={line.product.id} className="rounded-xl border border-white/10 bg-ink-900/80 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{line.product.name}</p>
                      <p className="text-[11px] text-mist-500">{money(line.product.price)} × {formatQty(line.quantity)}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-600/20"
                      onClick={() => setCart((c) => c.filter((item) => item.product.id !== line.product.id))}
                      aria-label="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-ink-950"
                        onClick={() =>
                          setCart((c) =>
                            c.map((item) =>
                              item.product.id === line.product.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item,
                            ),
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-8 text-center text-sm font-black">{formatQty(line.quantity)}</span>
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-ink-950"
                        onClick={() =>
                          setCart((c) =>
                            c.map((item) => (item.product.id === line.product.id ? { ...item, quantity: item.quantity + 1 } : item)),
                          )
                        }
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        className="ms-1 grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-[#00a99d]"
                        onClick={() => setNoteLineId(noteLineId === line.product.id ? null : line.product.id)}
                        title="ملاحظة مطبخ"
                      >
                        <StickyNote size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-black text-gold-300">{money(line.quantity * line.product.price)}</p>
                  </div>
                  {noteLineId === line.product.id ? (
                    <input
                      value={line.note}
                      onChange={(e) =>
                        setCart((c) => c.map((item) => (item.product.id === line.product.id ? { ...item, note: e.target.value } : item)))
                      }
                      placeholder={t('pos.prepNote')}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-ink-950 px-2 py-1.5 text-xs text-mist-100"
                    />
                  ) : line.note ? (
                    <p className="mt-1 text-[11px] text-[#00a99d]">
                      {t('pos.note')}: {line.note}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="mt-3 space-y-2 border-t border-gold-300/15 pt-3">
            <div className="flex justify-between text-sm text-mist-400">
              <span>{t('pos.subtotal')}</span>
              <span className="font-semibold text-mist-100">{money(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-mist-400">{t('pos.discount')}</span>
              <input
                dir="ltr"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-28 rounded-lg border border-white/10 bg-ink-950 px-2 py-1 text-end text-sm font-bold text-mist-100"
              />
            </div>
            <div className="flex justify-between text-lg font-black">
              <span>{t('pos.total')}</span>
              <span className="text-gold-300">{money(total)}</span>
            </div>

            {method === 'CASH' ? (
              <div>
                <input
                  dir="ltr"
                  className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm"
                  placeholder={t('pos.tendered')}
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                />
                <p className="mt-1 text-xs font-semibold text-mist-400">
                  {t('pos.change')} {money(change)}
                </p>
              </div>
            ) : null}
            {method === 'CREDIT' ? (
              <select className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customers
                  .filter((c) => c.id !== walkInId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('CARD')}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ${
                  method === 'CARD' ? 'bg-[#00a99d] text-ink-950' : 'border border-white/15 bg-ink-900'
                }`}
              >
                <CreditCard size={16} />
                {t('pos.knet')}
              </button>
              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ${
                  method === 'CASH' ? 'bg-[#8cc63f] text-ink-950' : 'border border-white/15 bg-ink-900'
                }`}
              >
                <Banknote size={16} />
                {t('pos.cash')}
              </button>
              <button
                type="button"
                onClick={() => setMethod('CREDIT')}
                className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ${
                  method === 'CREDIT' ? 'bg-gold-400 text-ink-950' : 'border border-white/15 bg-ink-900'
                }`}
              >
                <Link2 size={16} />
                {t('pos.link')}
              </button>
              <button
                type="button"
                onClick={() => void sendKitchen()}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#00a99d]/40 bg-[#00a99d]/15 py-3 text-sm font-bold text-[#7fe0d6]"
              >
                <ChefHat size={16} />
                {t('pos.kitchen')}
              </button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => void checkout(true)}
              className="w-full rounded-2xl bg-gradient-to-l from-[#8cc63f] to-[#00a99d] py-3.5 text-base font-black text-ink-950 disabled:opacity-60"
            >
              {pending ? '…' : t('pos.checkout')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
