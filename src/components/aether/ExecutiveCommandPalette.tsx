'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarRange,
  CornerDownLeft,
  FileText,
  LayoutDashboard,
  Printer,
  Radar,
  RotateCcw,
  Search,
  Sparkles,
  Store,
  Tag,
  Truck,
  UtensilsCrossed,
} from 'lucide-react'
import { BRANDS, BRANCHES, CHANNELS, MENU_ITEMS, PERIODS, AGGREGATOR_IDS, feryalHref, kwd } from '@/lib/aether/ledger'
import { COMMAND_PALETTE_EVENT, useBiFilters } from '@/components/aether/BiFilterContext'
import { isBiRoute } from '@/components/aether/GlobalFilterBar'
import { useLang } from '@/components/aether/ui'

type Group = 'pages' | 'feryal' | 'branches' | 'brands' | 'channels' | 'items' | 'actions' | 'records'

interface Command {
  id: string
  group: Group
  en: string
  ar: string
  hintEn?: string
  hintAr?: string
  keywords?: string
  icon: ReactNode
  run: () => void
}

interface RecordHit {
  kind: string
  id: string
  title: string
  subtitle?: string
  href: string
}

const GROUP_LABEL: Record<Group, { en: string; ar: string }> = {
  pages: { en: 'ERP pages', ar: 'صفحات النظام' },
  feryal: { en: 'Ask Feryal', ar: 'اسأل فريال' },
  branches: { en: 'Branches', ar: 'الفروع' },
  brands: { en: 'Brands', ar: 'العلامات التجارية' },
  channels: { en: 'Sales channels', ar: 'قنوات البيع' },
  items: { en: 'Top menu items', ar: 'أهم أصناف المنيو' },
  actions: { en: 'Actions', ar: 'إجراءات' },
  records: { en: 'Records', ar: 'السجلات' },
}

const GROUP_ORDER: Group[] = ['pages', 'feryal', 'actions', 'branches', 'brands', 'channels', 'items', 'records']

/** Bilingual Executive Command Palette (Ctrl/⌘ + K). */
export function ExecutiveCommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const { lang, isAr, T } = useLang()
  const { setFilters, reset } = useBiFilters()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [records, setRecords] = useState<RecordHit[]>([])
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') close()
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen)
    }
  }, [close])

  // Live record search across the platform (employees, items, invoices, journals …).
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setRecords([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setBusy(true)
      fetch(`/api/panel/search?q=${encodeURIComponent(q)}`, { credentials: 'same-origin', signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((json: { data?: RecordHit[] }) => setRecords((json.data || []).slice(0, 6)))
        .catch(() => setRecords([]))
        .finally(() => setBusy(false))
    }, 160)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, query])

  const go = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [close, router],
  )

  const goBi = useCallback(
    (fallback: string) => {
      close()
      if (!isBiRoute(pathname)) router.push(fallback)
    },
    [close, pathname, router],
  )

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [
      { id: 'p-erp', group: 'pages', en: 'Executive Financial Summary', ar: 'الملخص المالي التنفيذي', keywords: 'dashboard board kpi profit ملخص لوحة', icon: <LayoutDashboard className="h-4 w-4" />, run: () => go('/erp') },
      { id: 'p-feryal', group: 'pages', en: 'Feryal Executive AI Copilot', ar: 'المستشارة التنفيذية فريال', keywords: 'ai copilot voice gemini nova ذكاء صوت', icon: <Sparkles className="h-4 w-4" />, run: () => go('/erp/feryal-ai') },
      { id: 'p-events', group: 'pages', en: 'Events, Contracts & EXB Menu Hub', ar: 'مركز الفعاليات والعقود ومنيو المعارض', keywords: 'events contract booth kashta winterland فعاليات عقد كشتة', icon: <CalendarRange className="h-4 w-4" />, run: () => go('/erp/events-intelligence') },
      { id: 'p-sales', group: 'pages', en: 'Sales & Items Analysis', ar: 'تحليل المبيعات والأصناف', keywords: 'menu engineering stars dogs items منيو أصناف', icon: <BarChart3 className="h-4 w-4" />, run: () => go('/erp/sales-analysis') },
      { id: 'p-delivery', group: 'pages', en: 'Delivery Aggregators Control', ar: 'رقابة منصات التوصيل', keywords: 'talabat keeta deliveroo payout commission طلبات كيتا عمولة', icon: <Truck className="h-4 w-4" />, run: () => go('/erp/delivery-control') },
      { id: 'p-alerts', group: 'pages', en: 'Automated Financial Alerts', ar: 'التنبيهات المالية الآلية', keywords: 'alerts anomalies تنبيهات انحرافات', icon: <AlertTriangle className="h-4 w-4" />, run: () => go('/erp/alerts') },
      { id: 'p-scorecard', group: 'pages', en: 'Sales scorecard (8 sections)', ar: 'سجل المبيعات (8 أقسام)', keywords: 'scorecard سجل', icon: <FileText className="h-4 w-4" />, run: () => go('/erp/sales-scorecard') },
      { id: 'p-radar', group: 'pages', en: 'Aggregator commission radar', ar: 'رادار عمولات منصات التوصيل', keywords: 'radar رادار', icon: <Radar className="h-4 w-4" />, run: () => go('/erp/aggregator-radar') },
      { id: 'p-menu', group: 'pages', en: 'Menu engineering workbench', ar: 'منصة هندسة المنيو', keywords: 'menu منيو', icon: <UtensilsCrossed className="h-4 w-4" />, run: () => go('/erp/menu-engineering') },
      { id: 'p-dashboard', group: 'pages', en: 'Detailed financial report & recommendations', ar: 'التقرير المالي التفصيلي والتوصيات', keywords: 'report تقرير', icon: <FileText className="h-4 w-4" />, run: () => go('/dashboard') },
      { id: 'p-automations', group: 'pages', en: 'Notification rules', ar: 'قواعد التنبيهات', keywords: 'automation rules أتمتة', icon: <AlertTriangle className="h-4 w-4" />, run: () => go('/automations') },
    ]

    const feryalQueries: { en: string; ar: string }[] = [
      { en: 'Which branch is the most profitable and why is Salmiya leading at 31,246.230 KWD?', ar: 'ما الفرع الأعلى ربحية ولماذا تتصدر السالمية بـ 31,246.230 د.ك؟' },
      { en: 'Build the plan to cap Keeta promotions at 3.5% and recover 1,620 KWD per month.', ar: 'ضعي خطة سقف خصومات كيتا عند 3.5% لاسترداد 1,620 د.ك شهرياً.' },
      { en: 'How do we recover 1,336 KWD per month from the Ardiya Central Kitchen poultry variance?', ar: 'كيف نسترد 1,336 د.ك شهرياً من انحراف دواجن المطبخ المركزي بالعارضية؟' },
      { en: 'Compare Talabat Tgo versus TMP unit economics per order.', ar: 'قارني اقتصاديات الطلب الواحد بين طلبات جو وسوق طلبات.' },
      { en: 'Walk me through the Q1, H1 and full-year profit roadmap to 600,978 KWD.', ar: 'اشرحي خارطة الربح للربع الأول والنصف الأول والسنة الكاملة حتى 600,978 د.ك.' },
      { en: 'How does a mandatory beverage in delivery combos lift AOV from 5.471 to 5.750 KWD?', ar: 'كيف يرفع المشروب الإلزامي في وجبات التوصيل متوسط السلة من 5.471 إلى 5.750 د.ك؟' },
    ]
    const feryal: Command[] = feryalQueries.map((q, i) => ({
      id: `f-${i}`,
      group: 'feryal',
      en: q.en,
      ar: q.ar,
      keywords: 'feryal ask فريال اسأل',
      icon: <Sparkles className="h-4 w-4" />,
      run: () => go(feryalHref(lang === 'ar' ? q.ar : q.en)),
    }))

    const actions: Command[] = [
      { id: 'a-reset', group: 'actions', en: 'Reset to Full Group Ledger', ar: 'العودة إلى دفتر المجموعة الكامل', keywords: 'reset clear filters مسح إعادة', icon: <RotateCcw className="h-4 w-4" />, run: () => { reset(); close() } },
      { id: 'a-print', group: 'actions', en: 'Print / Export Board Executive Brief', ar: 'طباعة وتصدير الموجز التنفيذي لمجلس الإدارة', keywords: 'print pdf export طباعة تصدير', icon: <Printer className="h-4 w-4" />, run: () => { close(); if (pathname === '/erp') window.setTimeout(() => window.print(), 120); else router.push('/erp?print=1') } },
      ...PERIODS.map((p) => ({ id: `a-period-${p.id}`, group: 'actions' as const, en: `Switch period: ${p.en}`, ar: `تغيير الفترة: ${p.ar}`, keywords: 'period فترة', icon: <CalendarRange className="h-4 w-4" />, run: () => { setFilters({ period: p.id }); goBi('/erp') } })),
    ]

    const branches: Command[] = BRANCHES.map((b) => ({
      id: `b-${b.id}`,
      group: 'branches',
      en: b.en,
      ar: b.ar,
      hintEn: kwd(b.sales, 'en', 0),
      hintAr: kwd(b.sales, 'ar', 0),
      keywords: 'branch فرع',
      icon: <Store className="h-4 w-4" />,
      run: () => { setFilters({ branch: b.id }); goBi('/erp') },
    }))

    const brands: Command[] = BRANDS.map((b) => ({
      id: `br-${b.id}`,
      group: 'brands',
      en: b.en,
      ar: b.ar,
      hintEn: kwd(b.sales, 'en', 0),
      hintAr: kwd(b.sales, 'ar', 0),
      keywords: 'brand علامة',
      icon: <Building2 className="h-4 w-4" />,
      run: () => { setFilters({ brand: b.id }); goBi('/erp') },
    }))

    const channels: Command[] = CHANNELS.map((c) => ({
      id: `c-${c.id}`,
      group: 'channels',
      en: c.en,
      ar: c.ar,
      hintEn: kwd(c.sales, 'en', 0),
      hintAr: kwd(c.sales, 'ar', 0),
      keywords: 'channel قناة',
      icon: <Truck className="h-4 w-4" />,
      run: () => { setFilters({ channel: c.id }); goBi(AGGREGATOR_IDS.includes(c.id) ? '/erp/delivery-control' : '/erp') },
    }))

    const items: Command[] = MENU_ITEMS.filter((m) => m.top32).map((m) => ({
      id: `i-${m.id}`,
      group: 'items',
      en: m.en,
      ar: m.ar,
      hintEn: kwd(m.revenue, 'en', 0),
      hintAr: kwd(m.revenue, 'ar', 0),
      keywords: `${BRANDS.find((b) => b.id === m.brand)?.en ?? ''} ${BRANDS.find((b) => b.id === m.brand)?.ar ?? ''} item صنف`,
      icon: <Tag className="h-4 w-4" />,
      run: () => go(`/erp/sales-analysis?item=${encodeURIComponent(m.id)}`),
    }))

    return [...pages, ...feryal, ...actions, ...branches, ...brands, ...channels, ...items]
  }, [close, go, goBi, lang, pathname, reset, router, setFilters])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scored = commands
      .map((c) => {
        if (!q) return { c, score: c.group === 'pages' || c.group === 'feryal' ? 1 : c.group === 'actions' ? 0.5 : -1 }
        const hay = `${c.en} ${c.ar} ${c.keywords ?? ''}`.toLowerCase()
        const primary = (isAr ? c.ar : c.en).toLowerCase()
        if (primary.startsWith(q)) return { c, score: 3 }
        if (hay.includes(q)) return { c, score: 2 }
        const tokens = q.split(/\s+/).filter(Boolean)
        return { c, score: tokens.length > 1 && tokens.every((t) => hay.includes(t)) ? 1 : -1 }
      })
      .filter((x) => x.score > 0)
    const byGroup = GROUP_ORDER.map((g) => ({
      group: g,
      items: scored
        .filter((x) => x.c.group === g)
        .sort((a, b) => b.score - a.score)
        .slice(0, q ? 6 : g === 'pages' ? 11 : 4)
        .map((x) => x.c),
    }))
    const recordCommands: Command[] = records.map((r) => ({
      id: `r-${r.kind}-${r.id}`,
      group: 'records',
      en: r.title,
      ar: r.title,
      hintEn: r.subtitle,
      hintAr: r.subtitle,
      icon: <Search className="h-4 w-4" />,
      run: () => go(r.href),
    }))
    const groups = byGroup.map((g) => (g.group === 'records' ? { group: g.group, items: recordCommands } : g)).filter((g) => g.items.length > 0)
    return { groups, flat: groups.flatMap((g) => g.items) }
  }, [commands, go, isAr, query, records])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(results.flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      results.flat[active]?.run()
    }
  }

  let index = -1
  return (
    <div className="ae-palette-backdrop fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[9vh]" role="dialog" aria-modal aria-label={T('Executive command palette', 'لوحة الأوامر التنفيذية')} onClick={close}>
      <div className="ae-palette ae-pop w-full max-w-2xl overflow-hidden" dir={isAr ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/60">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={T('Jump to a page, branch, brand, menu item — or ask Feryal…', 'انتقل إلى صفحة أو فرع أو علامة أو صنف — أو اسأل فريال…')}
            className="w-full text-[15px] outline-none placeholder:text-slate-400"
          />
          {busy ? <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" /> : null}
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {results.groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              {T('No matches. Press Enter on a Feryal query to ask instead.', 'لا نتائج مطابقة. يمكنك سؤال فريال مباشرة.')}
              <div className="mt-3">
                <button type="button" className="ae-pill-dark" onClick={() => go(feryalHref(query))}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {T('Ask Feryal about this', 'اسأل فريال عن ذلك')}
                </button>
              </div>
            </div>
          ) : (
            results.groups.map((g) => (
              <div key={g.group} className="mb-1.5">
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold text-slate-400">{isAr ? GROUP_LABEL[g.group].ar : GROUP_LABEL[g.group].en}</div>
                {g.items.map((c) => {
                  index += 1
                  const i = index
                  return (
                    <button
                      key={c.id}
                      type="button"
                      data-index={i}
                      data-active={active === i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => c.run()}
                      className="ae-palette-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors"
                    >
                      <span className="ae-icon-badge h-8 w-8">{c.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{isAr ? c.ar : c.en}</span>
                        {(isAr ? c.hintAr : c.hintEn) ? <span className="ae-num block truncate text-[11px] font-medium text-slate-500">{isAr ? c.hintAr : c.hintEn}</span> : null}
                      </span>
                      {active === i ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200/70 px-5 py-2.5 text-[11px] text-slate-500 dark:border-slate-700/60">
          <span>{T('↑ ↓ to navigate · Enter to open · Esc to close', '↑ ↓ للتنقل · إدخال للفتح · خروج للإغلاق')}</span>
          {isAr ? null : <span className="ae-num">Ctrl + K</span>}
        </div>
      </div>
    </div>
  )
}
