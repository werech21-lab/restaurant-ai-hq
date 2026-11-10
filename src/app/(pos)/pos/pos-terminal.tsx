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
  UtensilsCrossed,
  UserCheck,
  X,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { sendToKitchenAction } from '@/app/actions/kds'
import { createSalesInvoice } from '@/app/actions/sales'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useOptionalScope } from '@/components/ScopeProvider'
import { LanguageSwitch, useI18n } from '@/lib/i18n'
import { formatQty } from '@/lib/format'
import { enqueueSale, listQueued, removeQueued } from '@/lib/offline-pos'
import type { OrderTypeId, VentureBranchOption } from '@/lib/venture-branches'

export type PosProduct = {
  id: string
  code: string
  name: string
  category: string
  price: number
  stock: number
  imageUrl?: string | null
}

type CartLine = { product: PosProduct; quantity: number; note: string }

export type EmployeeBrief = {
  id: string
  code: string
  name: string
  jobTitle?: string
  department?: string
}

type OfficialBrandId = 'ALL' | 'CHINA_GARDEN' | 'FRANKS' | 'SHAWARMA_TAHINA' | 'FARM_BROWN' | 'NOODLE_BAR' | 'KARAK'

interface BrandFilterDef {
  id: OfficialBrandId
  labelAr: string
  labelEn: string
  icon: string
  match?: (p: PosProduct) => boolean
}

// 6 Official Brands Only — Heisenberg & General are permanently excluded
const OFFICIAL_POS_BRANDS: BrandFilterDef[] = [
  { id: 'ALL', labelAr: 'الكل', labelEn: 'All Brands', icon: '✦' },
  {
    id: 'CHINA_GARDEN',
    labelAr: 'تشاينا جاردن',
    labelEn: 'China Garden',
    icon: '🥢',
    match: (p) => /china|جاردن|ricg|ctcg/i.test(`${p.category} ${p.name} ${p.code}`),
  },
  {
    id: 'FRANKS',
    labelAr: 'فرانكس',
    labelEn: "Frank's",
    icon: '🥩',
    match: (p) => /frank|فرانك|ستيك|rifr|ctfr/i.test(`${p.category} ${p.name} ${p.code}`),
  },
  {
    id: 'SHAWARMA_TAHINA',
    labelAr: 'شاورما طحينة',
    labelEn: 'Tahina Shawarma',
    icon: '🥙',
    match: (p) => /shawarma|tahina|طحينة|شاورما|ritah|cttah|rita/i.test(`${p.category} ${p.name} ${p.code}`),
  },
  {
    id: 'FARM_BROWN',
    labelAr: 'فارم براون',
    labelEn: 'Farm Brown',
    icon: '🍳',
    match: (p) => /farm|brown|فارم|براون|rifb|ctfb/i.test(`${p.category} ${p.name} ${p.code}`),
  },
  {
    id: 'NOODLE_BAR',
    labelAr: 'ذا نودل بار',
    labelEn: 'The Noodle Bar',
    icon: '🍜',
    match: (p) => /noodle|نودل|ritnb|cttnb|ritn/i.test(`${p.category} ${p.name} ${p.code}`),
  },
  {
    id: 'KARAK',
    labelAr: 'كرك كافتيريا',
    labelEn: 'Karak Cafeteria',
    icon: '☕',
    match: (p) => /karak|cafeteria|كرك|كافتيريا|rikc|ctkc/i.test(`${p.category} ${p.name} ${p.code}`),
  },
]

function getProductBrandLabel(product: PosProduct, isEn: boolean): string {
  const text = `${product.category} ${product.name} ${product.code}`.toLowerCase()
  if (/china|جاردن|ricg|ctcg/.test(text)) return isEn ? 'China Garden' : 'تشاينا جاردن'
  if (/frank|فرانك|ستيك|rifr|ctfr/.test(text)) return isEn ? "Frank's" : 'فرانكس'
  if (/shawarma|tahina|طحينة|شاورما|ritah|cttah|rita/.test(text)) return isEn ? 'Tahina Shawarma' : 'شاورما طحينة'
  if (/farm|brown|فارم|براون|rifb|ctfb/.test(text)) return isEn ? 'Farm Brown' : 'فارم براون'
  if (/noodle|نودل|ritnb|cttnb|ritn/.test(text)) return isEn ? 'The Noodle Bar' : 'ذا نودل بار'
  if (/karak|cafeteria|كرك|كافتيريا|rikc|ctkc/.test(text)) return isEn ? 'Karak Cafeteria' : 'كرك كافتيريا'
  return isEn ? 'Venture Foods' : 'فنتشر فودز'
}

export function PosTerminal({
  products,
  walkInId,
  customers,
  employees = [],
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
  employees?: EmployeeBrief[]
  brands: Array<{ code: string; nameAr: string; nameEn?: string }>
  branches: VentureBranchOption[]
  orderTypes: Array<{ id: OrderTypeId | string; labelAr: string; labelEn?: string }>
  initialBrandCode?: string
  initialBranchId?: string
  warehouseId?: string
}) {
  const router = useRouter()
  const { t, money, locale } = useI18n()
  const en = locale === 'en'
  const scope = useOptionalScope()

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

  const [orderType, setOrderType] = useState<string>(orderTypes[0]?.id ?? 'takeaway')
  const [tableNo, setTableNo] = useState('')
  const [selectedBrandTab, setSelectedBrandTab] = useState<OfficialBrandId>('ALL')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'CREDIT' | 'STAFF_MEAL'>('CARD')
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

  // Staff Meal (Account 5230) state
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [staffBadgeInput, setStaffBadgeInput] = useState('')
  const [activeStaffMeal, setActiveStaffMeal] = useState<{
    badge: string
    name: string
    jobTitle?: string
    department?: string
  } | null>(null)

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

  // Filter products: Purge Heisenberg, 0 KWD coupons, and match the 6 official brands
  const visible = useMemo(() => {
    return products.filter((product) => {
      // 1. Purge zero-price and dummy discount coupons
      if (product.price <= 0) return false
      const fullText = `${product.category} ${product.name} ${product.code}`.toLowerCase()
      if (
        fullText.includes('heisenberg') ||
        fullText.includes('10%') ||
        fullText.includes('15%') ||
        fullText.includes('20%') ||
        fullText.includes('25%') ||
        fullText.includes('30%') ||
        fullText.includes('coupon') ||
        fullText.includes('discount') ||
        fullText.includes('delivery charges')
      ) {
        return false
      }

      // 2. Official brand tab filter
      if (selectedBrandTab !== 'ALL') {
        const brandObj = OFFICIAL_POS_BRANDS.find((b) => b.id === selectedBrandTab)
        if (brandObj?.match && !brandObj.match(product)) {
          return false
        }
      }

      // 3. Search query filter
      const text = query.trim().toLowerCase()
      if (text) {
        const matches =
          product.name.toLowerCase().includes(text) ||
          product.code.toLowerCase().includes(text) ||
          product.category.toLowerCase().includes(text)
        if (!matches) return false
      }

      return true
    })
  }, [products, selectedBrandTab, query])

  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.product.price, 0)
  const isStaffMeal = Boolean(activeStaffMeal)
  const discountValue = isStaffMeal ? subtotal : Math.min(Math.max(Number(discount) || 0, 0), subtotal)
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

  function handleApplyStaffMeal(employee: EmployeeBrief | { code: string; name: string; jobTitle?: string; department?: string }) {
    setActiveStaffMeal({
      badge: employee.code,
      name: employee.name,
      jobTitle: employee.jobTitle,
      department: employee.department,
    })
    setMethod('STAFF_MEAL')
    setOrderType('staff_meal')
    setShowStaffModal(false)
    setStaffBadgeInput('')
    setNotice(
      en
        ? `Staff meal authorized for #${employee.code} (${employee.name}) · Charged to Account 5230.`
        : `تم اعتماد وجبة موظف برقم البصمة #${employee.code} (${employee.name}) · محملة على حساب 5230.`,
    )
  }

  function handleCancelStaffMeal() {
    setActiveStaffMeal(null)
    setMethod('CARD')
    setOrderType('takeaway')
    setNotice(en ? 'Staff meal mode canceled.' : 'تم إلغاء وضع وجبة الموظف.')
  }

  async function checkout(printOnly = false) {
    setError('')
    if (cart.length === 0) {
      setError(en ? 'Cart is empty.' : 'السلة فارغة')
      return
    }
    if (orderType === 'dine_in' && !tableNo.trim() && !isStaffMeal) {
      setError(en ? 'Enter calling order # for store order.' : 'أدخل رقم الطلب الندائي للطلب المحلي')
      return
    }

    const partyId = method === 'CREDIT' ? customerId : walkInId || customerId
    if (!partyId) {
      setError(
        en
          ? 'Walk-in customer is missing. Pull Odoo data or re-seed.'
          : 'عميل الصندوق غير موجود. اسحب بيانات Odoo أو أعد التغذية.',
      )
      return
    }
    if (method === 'CREDIT' && partyId === walkInId) {
      setError(en ? 'Choose a customer for credit / pay link.' : 'اختر عميلاً للبيع الآجل / رابط الدفع')
      return
    }

    const effectivePaymentMethod: 'CASH' | 'CARD' | 'CREDIT' = isStaffMeal ? 'CREDIT' : method === 'STAFF_MEAL' ? 'CREDIT' : method

    const payload = {
      partyId,
      paidAmount: isStaffMeal ? 0 : method === 'CREDIT' ? 0 : total,
      paymentMethod: effectivePaymentMethod,
      warehouseId: warehouseId || undefined,
      items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity, price: line.product.price })),
      customData: {
        brandCode,
        branchId,
        orderType,
        tableNo: tableNo.trim(),
        ...(isStaffMeal && activeStaffMeal
          ? {
              isStaffMeal: 'true',
              employeeBadge: activeStaffMeal.badge,
              employeeName: activeStaffMeal.name,
              glAccount: '5230',
              glAccountName: 'تكلفة وجبات الموظفين بسعر التكلفة (Account 5230 - Staff Meals at BOM Cost)',
            }
          : {}),
      },
    }

    if (!navigator.onLine) {
      await enqueueSale({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...payload })
      setCart([])
      if (isStaffMeal) handleCancelStaffMeal()
      setQueued((count) => count + 1)
      setNotice(
        en
          ? 'Offline Ready — invoice saved locally for sync later.'
          : 'وضع Offline Ready — حُفظت الفاتورة محلياً للمزامنة لاحقاً.',
      )
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
      if (isStaffMeal) handleCancelStaffMeal()
      setQueued((count) => count + 1)
      setNotice(en ? 'Could not reach the server. Invoice saved offline.' : 'تعذر الوصول للسيرفر. حُفظت الفاتورة Offline.')
      return
    }
    setPending(false)
    if (!result.ok || !result.id) {
      setError(result.ok ? (en ? 'Could not issue the receipt.' : 'تعذر إصدار الإيصال') : result.message)
      return
    }

    if (isStaffMeal && activeStaffMeal) {
      setNotice(
        en
          ? `Receipt issued for staff meal #${activeStaffMeal.badge} under GL Account 5230.`
          : `صدر إيصال وجبة الموظف برقم البصمة #${activeStaffMeal.badge} محملة على حساب 5230.`,
      )
      setActiveStaffMeal(null)
    }

    if (printOnly || method !== 'CREDIT') {
      router.push(`/sales/${result.id}/print?layout=thermal`)
      return
    }
    setNotice(en ? 'Invoice issued — ready for pay link / MyFatoorah.' : `صدرت الفاتورة — جاهزة لرابط الدفع / ماي فاتورة`)
    setCart([])
    router.push(`/sales/${result.id}/print?layout=thermal`)
  }

  checkoutRef.current = checkout

  async function sendKitchen() {
    if (cart.length === 0) {
      setError(en ? 'No items to send to the kitchen.' : 'لا أصناف لإرسالها للمطبخ')
      return
    }
    setPending(true)
    const notes = cart
      .filter((l) => l.note.trim())
      .map((l) => `${l.product.name}: ${l.note}`)
      .join(' · ')
    const result = await sendToKitchenAction({
      brandCode,
      branchCode: branchId,
      warehouseId: warehouseId || undefined,
      orderType,
      tableNo: isStaffMeal ? `بصمة #${activeStaffMeal?.badge}` : tableNo.trim(),
      notes: isStaffMeal ? `[وجبة موظف - حساب 5230 - بصمة #${activeStaffMeal?.badge}] ${notes}` : notes,
      items: cart.map((line) => ({
        productId: line.product.id,
        name: line.product.name,
        quantity: line.quantity,
        note: line.note,
      })),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    const brand = brands.find((b) => b.code === brandCode)
    const order = orderTypes.find((o) => o.id === orderType)
    const brandLabel = en && brand?.nameEn ? brand.nameEn : brand?.nameAr || ''
    const orderLabel = en && order?.labelEn ? order.labelEn : order?.labelAr || ''
    const pieces = cart.reduce((s, l) => s + l.quantity, 0)
    setNotice(
      en
        ? `Sent ${pieces} item(s) to Kitchen (${brandLabel} · ${orderLabel}${tableNo ? ` · Order #${tableNo}` : ''})`
        : `أُرسلت ${pieces} قطعة إلى شاشة المطبخ (${brandLabel} · ${orderLabel}${tableNo ? ` · رقم النداء #${tableNo}` : ''})`,
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-mist-100 md:h-screen">
      {/* POS Top Header — Scope bar removed, clean single line with pure Arabic support */}
      <header className="sticky top-0 z-30 border-b border-gold-300/15 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:border-[#8cc63f]/40 hover:text-white transition"
          >
            <span>🏠</span>
            <span>{en ? 'Dashboard' : 'لوحة القيادة'}</span>
          </a>

          <div className="hidden items-center gap-2 sm:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/venture-foods-logo-dark.svg"
              alt={en ? 'Venture Foods' : 'شركة فنتشر فودز'}
              className="h-7 w-auto"
            />
            <span className="font-black text-sm tracking-tight text-white">
              {en ? 'Venture Foods W.L.L.' : 'شركة فنتشر فودز لإدارة المطاعم'}
            </span>
          </div>

          <LanguageSwitch />
          <ThemeToggle />

          <select
            className="rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-mist-100"
            value={brandCode}
            onChange={(e) => {
              const next = e.target.value
              setBrandCode(next)
              scope?.setBrand(next as never)
            }}
          >
            {brands.map((b) => (
              <option key={b.code} value={b.code}>
                {en && b.nameEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>

          <select
            className="max-w-[11rem] rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-mist-100 sm:max-w-none"
            value={branchId}
            onChange={(e) => {
              const next = e.target.value
              setBranchId(next)
              scope?.setBranch(next as never)
            }}
          >
            {brandBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {en && b.nameEn ? b.nameEn : b.nameAr}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-mist-100"
            value={orderType}
            onChange={(e) => {
              const val = e.target.value
              setOrderType(val)
              if (val === 'staff_meal') {
                setShowStaffModal(true)
              }
            }}
          >
            {orderTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {en && o.labelEn ? o.labelEn : o.labelAr}
              </option>
            ))}
          </select>

          {orderType === 'dine_in' && !isStaffMeal ? (
            <input
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
              placeholder={en ? 'Order #108' : 'رقم النداء #108'}
              className="w-24 rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1.5 text-xs font-bold text-gold-300"
            />
          ) : null}

          {isStaffMeal ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-950/60 px-2.5 py-1 text-xs font-bold text-purple-300">
              <UserCheck size={13} />
              <span>{en ? `Badge #${activeStaffMeal?.badge}` : `بصمة #${activeStaffMeal?.badge}`}</span>
              <button
                type="button"
                onClick={handleCancelStaffMeal}
                className="text-purple-400 hover:text-white"
                title={en ? 'Cancel staff meal' : 'إلغاء وجبة الموظف'}
              >
                <X size={12} />
              </button>
            </div>
          ) : null}

          <div className="ms-auto flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                online ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'
              }`}
            >
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? (en ? 'Online' : 'متصل') : en ? 'Offline' : 'غير متصل'}
            </span>
            {queued > 0 ? (
              <span className="text-[11px] font-semibold text-amber-300">
                {en ? `Queue: ${queued}` : `طابور: ${queued}`}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Terminal View */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[65fr_35fr]">
        {/* Menu Catalog Section */}
        <section className="min-h-0 overflow-y-auto border-b border-white/5 p-3 sm:p-4 lg:border-b-0 lg:border-e lg:border-white/5">
          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
            <input
              id="pos-search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onBarcode}
              placeholder={en ? 'Search menu by dish name or SKU code (F2)...' : 'ابحث في قائمة الطعام باسم الطبق أو الكود (F2)...'}
              className="w-full rounded-xl border border-white/10 bg-ink-900 py-3 pe-3 ps-10 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-[#8cc63f]/50"
            />
          </div>

          {/* Official 7 Brands Filter Buttons (Pure Arabic in AR mode) */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {OFFICIAL_POS_BRANDS.map((item) => {
              const active = item.id === selectedBrandTab
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedBrandTab(item.id)}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950 font-black shadow-md'
                      : 'border border-white/10 bg-ink-900 text-mist-300 hover:border-gold-300/30'
                  }`}
                >
                  <span className="me-1.5 opacity-90">{item.icon}</span>
                  {en ? item.labelEn : item.labelAr}
                </button>
              )
            })}
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((product) => {
              const brandLabel = getProductBrandLabel(product, en)
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => add(product)}
                  className={`group rounded-2xl border p-3 text-start transition active:scale-[0.98] flex flex-col justify-between ${
                    flashId === product.id
                      ? 'border-[#8cc63f] bg-[#8cc63f]/20 shadow-[0_0_0_2px_rgba(140,198,63,0.35)]'
                      : 'border-gold-300/15 bg-ink-900/90 hover:border-[#00a99d]/50 hover:bg-ink-800/80'
                  }`}
                >
                  <div>
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="mb-2 h-24 w-full rounded-xl object-cover border border-white/10"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mb-2 flex h-24 w-full items-center justify-center rounded-xl border border-white/10 bg-[#0a0d12] text-2xl text-mist-500 group-hover:text-gold-300 transition-colors">
                        <UtensilsCrossed size={28} />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-mist-400">
                        {brandLabel}
                      </span>
                      <span className="text-[10px] text-mist-500 font-mono" dir="ltr">
                        {product.code}
                      </span>
                    </div>

                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-mist-100 group-hover:text-gold-300 transition-colors">
                      {product.name}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-base font-black text-gold-300">{money(product.price)}</p>
                      {/* Positive green stock badge */}
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {en ? `Available (${formatQty(product.stock)})` : `متوفر (${formatQty(product.stock)})`}
                      </p>
                    </div>

                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-mist-300 group-hover:bg-[#8cc63f] group-hover:text-ink-950 transition-all">
                      <Plus size={16} />
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {visible.length === 0 ? (
            <div className="py-16 text-center text-sm text-mist-500">
              <p className="text-base font-bold text-mist-300">{en ? 'No items found' : 'لا توجد أطباق مطابقة'}</p>
              <p className="mt-1 text-xs text-mist-500">
                {en ? 'Try choosing another brand tab or clearing search' : 'اختر تصنيف براند آخر أو امسح شريط البحث'}
              </p>
            </div>
          ) : null}
        </section>

        {/* Order Basket & Checkout Section */}
        <aside className="flex min-h-0 flex-col bg-[#0d0f12] p-3 sm:p-4">
          {error ? <p className="mb-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white">{error}</p> : null}
          {notice ? (
            <p className="mb-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {notice}
            </p>
          ) : null}

          {/* Active Staff Meal Banner */}
          {isStaffMeal && activeStaffMeal ? (
            <div className="mb-3 rounded-xl border border-purple-500/50 bg-purple-950/50 p-2.5 text-xs text-purple-200">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-purple-400" />
                  {en ? 'Staff Meal (Account 5230)' : 'وجبة موظف معتمدة (حساب 5230)'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelStaffMeal}
                  className="rounded px-1.5 py-0.5 text-[10px] bg-purple-900/60 hover:bg-purple-800 text-purple-200"
                >
                  {en ? 'Cancel' : 'إلغاء'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-purple-300">
                {en
                  ? `Badge #${activeStaffMeal.badge} · ${activeStaffMeal.name} (${activeStaffMeal.jobTitle || 'Staff'})`
                  : `رقم البصمة #${activeStaffMeal.badge} · ${activeStaffMeal.name} (${activeStaffMeal.jobTitle || 'موظف'})`}
              </p>
            </div>
          ) : null}

          {/* Cart Items List */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-xs text-mist-500">
                <UtensilsCrossed size={32} className="mx-auto mb-2 opacity-30" />
                <p>{en ? 'Cart is empty. Click on any dish to add.' : 'السلة فارغة. انقر على أي طبق لإضافته للطلب.'}</p>
              </div>
            ) : (
              cart.map((line) => (
                <div key={line.product.id} className="rounded-xl border border-white/10 bg-ink-900/80 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{line.product.name}</p>
                      <p className="text-[11px] text-mist-500">
                        {money(line.product.price)} × {formatQty(line.quantity)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-600/20"
                      onClick={() => setCart((c) => c.filter((item) => item.product.id !== line.product.id))}
                      aria-label={en ? 'Remove' : 'حذف'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-ink-950"
                        onClick={() =>
                          setCart((c) =>
                            c.map((item) =>
                              item.product.id === line.product.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item,
                            ),
                          )
                        }
                      >
                        <Minus size={13} />
                      </button>
                      <span className="min-w-7 text-center text-sm font-black">{formatQty(line.quantity)}</span>
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-ink-950"
                        onClick={() =>
                          setCart((c) =>
                            c.map((item) => (item.product.id === line.product.id ? { ...item, quantity: item.quantity + 1 } : item)),
                          )
                        }
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        className="ms-1 grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-[#00a99d]"
                        onClick={() => setNoteLineId(noteLineId === line.product.id ? null : line.product.id)}
                        title={en ? 'Add Note' : 'إضافة ملاحظة'}
                      >
                        <StickyNote size={13} />
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
                      placeholder={en ? 'Preparation note...' : 'ملاحظة تحضير المطبخ...'}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-ink-950 px-2.5 py-1 text-xs text-mist-100"
                    />
                  ) : line.note ? (
                    <p className="mt-1 text-[11px] text-[#00a99d]">
                      {en ? 'Note' : 'ملاحظة'}: {line.note}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {/* Cart Financial Summary & Payment Actions */}
          <div className="mt-3 space-y-2 border-t border-gold-300/15 pt-3">
            <div className="flex justify-between text-xs text-mist-400">
              <span>{en ? 'Subtotal' : 'المجموع الإجمالي'}</span>
              <span className="font-semibold text-mist-100">{money(subtotal)}</span>
            </div>

            {isStaffMeal ? (
              <div className="flex justify-between text-xs font-bold text-purple-400">
                <span>{en ? 'Staff Meal Discount (100% · Acc 5230)' : 'خصم وجبة موظف (100% · حساب 5230)'}</span>
                <span>-{money(subtotal)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-mist-400">{en ? 'Discount' : 'الخصم'}</span>
                <input
                  dir="ltr"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 rounded-lg border border-white/10 bg-ink-950 px-2 py-1 text-end text-xs font-bold text-mist-100"
                />
              </div>
            )}

            <div className="flex justify-between text-base font-black">
              <span>{en ? 'Total Due' : 'صافي المستحق'}</span>
              <span className="text-gold-300 font-mono text-lg">{money(total)}</span>
            </div>

            {method === 'CASH' && !isStaffMeal ? (
              <div>
                <input
                  dir="ltr"
                  className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-xs"
                  placeholder={en ? 'Amount Tendered (Cash)' : 'المبلغ المستلم نقداً'}
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                />
                <p className="mt-1 text-xs font-semibold text-mist-400">
                  {en ? 'Change' : 'المتبقي للعميل'} {money(change)}
                </p>
              </div>
            ) : null}

            {method === 'CREDIT' && !isStaffMeal ? (
              <select
                className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-xs font-semibold text-mist-100"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                {customers
                  .filter((c) => c.id !== walkInId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            ) : null}

            {/* Payment Method Grid + Staff Meal Button */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (isStaffMeal) handleCancelStaffMeal()
                  setMethod('CARD')
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold ${
                  method === 'CARD' ? 'bg-[#00a99d] text-ink-950' : 'border border-white/15 bg-ink-900 text-mist-200'
                }`}
              >
                <CreditCard size={14} />
                {en ? 'K-Net / Card' : 'كي نت / شبكة'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isStaffMeal) handleCancelStaffMeal()
                  setMethod('CASH')
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold ${
                  method === 'CASH' ? 'bg-[#8cc63f] text-ink-950' : 'border border-white/15 bg-ink-900 text-mist-200'
                }`}
              >
                <Banknote size={14} />
                {en ? 'Cash' : 'كاش نقدي'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isStaffMeal) handleCancelStaffMeal()
                  setMethod('CREDIT')
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold ${
                  method === 'CREDIT' ? 'bg-gold-400 text-ink-950' : 'border border-white/15 bg-ink-900 text-mist-200'
                }`}
              >
                <Link2 size={14} />
                {en ? 'Pay Link' : 'رابط دفع'}
              </button>

              <button
                type="button"
                onClick={() => void sendKitchen()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[#00a99d]/40 bg-[#00a99d]/15 py-2.5 text-xs font-bold text-[#7fe0d6]"
              >
                <ChefHat size={14} />
                {en ? 'Send to Kitchen (KDS)' : 'إرسال فوري لشاشة المطبخ'}
              </button>
            </div>

            {/* Dedicated Staff Meal Button (Account 5230) */}
            <button
              type="button"
              onClick={() => setShowStaffModal(true)}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
                isStaffMeal
                  ? 'border border-purple-400 bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'border border-purple-500/40 bg-purple-950/40 text-purple-300 hover:bg-purple-900/50'
              }`}
            >
              <UserCheck size={14} />
              <span>{en ? '🍽️ Record as Staff Meal (Posted to Acc 5230 at Cost)' : '🍽️ تسجيل كوجبة موظف (يرحل لحساب 5230 بسعر التكلفة)'}</span>
            </button>

            {/* Checkout / Issue Receipt Button */}
            <button
              type="button"
              disabled={pending || cart.length === 0}
              onClick={() => void checkout(true)}
              className="w-full rounded-2xl bg-gradient-to-l from-[#8cc63f] to-[#00a99d] py-3 text-sm font-black text-ink-950 disabled:opacity-50 transition active:scale-[0.99]"
            >
              {pending ? '…' : isStaffMeal ? (en ? 'Authorize & Print Staff Meal' : 'اعتماد وطباعة إيصال وجبة الموظف') : en ? 'Pay & Issue Receipt' : 'دفع وإصدار الفاتورة'}
            </button>
          </div>
        </aside>
      </div>

      {/* Staff Meal Biometric / Badge Authorization Modal */}
      {showStaffModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-purple-500/40 bg-[#0f0e17] p-5 shadow-2xl text-mist-100">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600/30 text-purple-300">
                  <UserCheck size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {en ? 'Authorize Staff Meal (Account 5230)' : 'اعتماد وجبة موظف (برقم البصمة · حساب 5230)'}
                  </h3>
                  <p className="text-[11px] text-purple-300">
                    {en
                      ? 'Duty meal charged at BOM standard cost to GL Account 5230'
                      : 'قيد تكلفة الوجبة المعيارية على حساب 5230 مع حظر الصرف النقدي'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                className="rounded-lg p-1 text-mist-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-mist-200">
                  {en ? 'Enter Biometric Badge ID / Barcode:' : 'أدخل رقم بصمة الموظف / الباركود:'}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder={en ? 'e.g. 2090, 1715, 1986...' : 'مثال: 2090، 1715، 1986...'}
                    value={staffBadgeInput}
                    onChange={(e) => setStaffBadgeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && staffBadgeInput.trim()) {
                        const matched = employees.find((emp) => emp.code === staffBadgeInput.trim())
                        handleApplyStaffMeal(
                          matched || {
                            code: staffBadgeInput.trim(),
                            name: `موظف بصمة #${staffBadgeInput.trim()}`,
                            jobTitle: 'طاقم تشغيل',
                          },
                        )
                      }
                    }}
                    className="w-full rounded-xl border border-purple-500/40 bg-ink-950 px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-purple-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!staffBadgeInput.trim()) return
                      const matched = employees.find((emp) => emp.code === staffBadgeInput.trim())
                      handleApplyStaffMeal(
                        matched || {
                          code: staffBadgeInput.trim(),
                          name: `موظف بصمة #${staffBadgeInput.trim()}`,
                          jobTitle: 'طاقم تشغيل',
                        },
                      )
                    }}
                    className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-black text-white hover:bg-purple-500"
                  >
                    {en ? 'Apply' : 'تطبيق'}
                  </button>
                </div>
              </div>

              {/* Quick Employee Picker */}
              {employees.length > 0 ? (
                <div>
                  <label className="text-[11px] font-bold text-mist-400">
                    {en ? 'Or pick from active staff on duty:' : 'أو اختر سريعاً من موظفي الوردية:'}
                  </label>
                  <div className="mt-1.5 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {employees.slice(0, 20).map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleApplyStaffMeal(emp)}
                        className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-ink-900/90 p-2 text-start text-xs hover:border-purple-500/50 hover:bg-purple-950/30 transition"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">{emp.name}</p>
                          <p className="text-[10px] text-mist-400">{emp.jobTitle || emp.department || 'موظف'}</p>
                        </div>
                        <span className="rounded bg-purple-900/50 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">
                          #{emp.code}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-2.5 text-[11px] text-purple-300">
                <span className="font-bold">⚠️ {en ? 'Accounting Note:' : 'ملاحظة محاسبية:'}</span>{' '}
                {en
                  ? 'Applies 100% discount, zero customer cash, and routes food cost to Account 5230 (Staff Meals at Cost).'
                  : 'يتم تطبيق خصم 100% وإعفاء العميل من الدفع، وترحيل التكلفة إلى حساب 5230 (تكلفة وجبات الموظفين).'}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
