'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2,
  CalendarRange,
  CornerDownLeft,
  LayoutDashboard,
  Printer,
  Radar,
  Search,
  Sparkles,
  Store,
  Target,
} from 'lucide-react'
import { feryalHref } from '@/lib/aether/ledger'
import {
  BRANCH_TRUE_CASH,
  BRAND_TRUE_CASH,
  JOURNEY_PLAYS,
  JOURNEY_STAGES,
} from '@/lib/full-journey-enterprise-brain'
import { COMMAND_PALETTE_EVENT } from '@/components/aether/BiFilterContext'
import { useLang } from '@/components/aether/ui'

type Group = 'pages' | 'decisions' | 'branches' | 'brands' | 'feryal' | 'actions'

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

const GROUP_LABEL: Record<Group, { en: string; ar: string }> = {
  pages: { en: 'Main Sections', ar: 'الأقسام الرئيسية' },
  decisions: { en: 'Practical Steps to Grow Profit', ar: 'خطوات زيادة الربح وتقليل الهدر' },
  branches: { en: 'Active Restaurant Branches', ar: 'فروع المطاعم النشطة' },
  brands: { en: 'Venture Foods Brands', ar: 'علامات فنتشر فودز المعتمدة' },
  feryal: { en: 'Ask Feryal Immediately', ar: 'اسأل المستشارة فريال فوراً' },
  actions: { en: 'Quick Actions', ar: 'إجراءات سريعة' },
}

const GROUP_ORDER: Group[] = ['pages', 'decisions', 'branches', 'brands', 'feryal', 'actions']

const fmtKwd = (n: number, isAr: boolean) =>
  `${Math.round(n).toLocaleString('en-US')} ${isAr ? 'د.ك/شهر' : 'KWD/mo'}`

/** Bilingual Executive Command Palette (⌘K / Ctrl+K) strictly locked to Venture Foods entities & 4 Executive Pillars. */
export function ExecutiveCommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const { lang, isAr, T } = useLang()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
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

  const go = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [close, router],
  )

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [
      {
        id: 'p-erp',
        group: 'pages',
        en: 'Company Summary & Profit Opportunities',
        ar: 'ملخص أداء الشركة وفرص زيادة الربح',
        hintEn: `${JOURNEY_PLAYS.length} practical steps`,
        hintAr: `${JOURNEY_PLAYS.length} خطوة عملية`,
        keywords: 'dashboard summary profit steps ملخص أداء ربح خطوات',
        icon: <LayoutDashboard className="h-4 w-4" />,
        run: () => go('/erp'),
      },
      {
        id: 'p-feryal',
        group: 'pages',
        en: 'Feryal — Smart Advisor',
        ar: 'المستشارة الذكية فريال',
        hintEn: 'Voice & Action Briefs',
        hintAr: 'محادثة صوتية وخطوات عملية',
        keywords: 'ai copilot voice nova feryal فريال ذكاء صوت مستشارة',
        icon: <Sparkles className="h-4 w-4" />,
        run: () => go('/erp/feryal-ai'),
      },
      {
        id: 'p-radar',
        group: 'pages',
        en: 'Forensic Delivery Radar',
        ar: 'الرادار الجنائي لمنصات التوصيل',
        hintEn: 'Stopped Accounts, Tgo/TMP & Commissions',
        hintAr: 'الحسابات المتوقفة والعمولات والطلبات',
        keywords: 'radar forensic talabat keeta deliveroo jahez snoonu tgo tmp رادار جنائي توصيل طلبات كيتا دليفرو جاهز سنونو',
        icon: <Radar className="h-4 w-4" />,
        run: () => go('/erp/aggregator-radar'),
      },
      {
        id: 'p-events',
        group: 'pages',
        en: 'Seasonal Booths & Exhibitions Study',
        ar: 'جدوى المعارض والبوثات الموسمية',
        hintEn: 'Break-even & Rent Review',
        hintAr: 'نقطة التعادل ومراجعة الإيجار',
        keywords: 'events booth exb kashta winterland فعاليات بوث معارض كشتة',
        icon: <CalendarRange className="h-4 w-4" />,
        run: () => go('/erp/events-intelligence'),
      },
    ]

    const decisions: Command[] = JOURNEY_PLAYS.map((p) => {
      const st = JOURNEY_STAGES.find((s) => s.id === p.stage)
      return {
        id: `d-${p.id}`,
        group: 'decisions',
        en: p.titleEn,
        ar: p.titleAr,
        hintEn: `+${fmtKwd(p.monthlyKwd, false)} · ${st?.en ?? p.stage}`,
        hintAr: `+${fmtKwd(p.monthlyKwd, true)} · ${st?.ar ?? p.stage}`,
        keywords: `${p.subjectEn} ${p.subjectAr} ${p.stage} ${p.id}`,
        icon: <Target className="h-4 w-4 text-emerald-600" />,
        run: () => go(`/erp?stage=${encodeURIComponent(p.stage)}&play=${encodeURIComponent(p.id)}`),
      }
    })

    const branches: Command[] = BRANCH_TRUE_CASH.map((b) => ({
      id: `br-loc-${b.id}`,
      group: 'branches',
      en: b.en,
      ar: b.ar,
      hintEn: `Net Profit: ${b.trueNetCash >= 0 ? '+' : ''}${Math.round(b.trueNetCash).toLocaleString('en-US')} KWD/30d`,
      hintAr: `الربح الصافي: ${b.trueNetCash >= 0 ? '+' : ''}${Math.round(b.trueNetCash).toLocaleString('en-US')} د.ك/30 يوم`,
      keywords: `branch location فرع موقع ${b.en} ${b.ar}`,
      icon: <Store className="h-4 w-4" />,
      run: () =>
        go(
          feryalHref(
            lang === 'ar'
              ? `عطيني ملخص واضح لأداء فرع ${b.ar}: المبيعات، الإيجار، المصاريف، وأسرع خطوة لزيادة صافي الربح.`
              : `Give me a clear summary for ${b.en}: sales, rent, expenses, and the fastest step to grow net profit.`,
          ),
        ),
    }))

    const brands: Command[] = BRAND_TRUE_CASH.map((b) => ({
      id: `brand-${b.id}`,
      group: 'brands',
      en: b.en,
      ar: b.ar,
      hintEn: `${Math.round(b.netSales).toLocaleString('en-US')} KWD sales · ${b.orders.toLocaleString('en-US')} orders`,
      hintAr: `${Math.round(b.netSales).toLocaleString('en-US')} د.ك مبيعات · ${b.orders.toLocaleString('en-US')} طلب`,
      keywords: `brand علامة براند مطعم ${b.en} ${b.ar}`,
      icon: <Building2 className="h-4 w-4" />,
      run: () =>
        go(
          feryalHref(
            lang === 'ar'
              ? `حلّلي أداء مطعم ${b.ar} من ناحية أرباح الأطباق وعمولات التوصيل وفرصة تشغيله داخل فروعنا الحالية بدون إيجار جديد.`
              : `Review ${b.en} across dish margins, delivery commissions, and running it inside our existing branch kitchens with zero extra rent.`,
          ),
        ),
    }))

    const feryalPrompts: { en: string; ar: string }[] = [
      {
        en: 'How can we grow profit at Salmiya and Promenade by running an extra brand in the same kitchen?',
        ar: 'كيف نرفع أرباح فرع السالمية والبروميناد بتشغيل مطعم إضافي بنفس المطبخ بدون إيجار جديد؟',
      },
      {
        en: 'Give me the plan to stop Keeta promo losses and shift nearby Talabat Tgo orders to TMP (10%).',
        ar: 'أعطيني خطة إيقاف خصومات كيتا الزائدة وتحويل الطلبات القريبة في طلبات إلى توصيل سائقينا (10%).',
      },
      {
        en: 'How do we reduce kitchen waste at Ardiya Central Kitchen and stop supplier price increases?',
        ar: 'كيف نقلل هدر المطبخ المركزي بالعارضية ونوقف ارتفاع أسعار الموردين؟',
      },
      {
        en: "Which China Garden and Frank's top sellers can take a 150 fils update while keeping core combo prices fixed?",
        ar: 'شنو الأطباق الأكثر طلباً في تشاينا جاردن وفرانكس اللي تتحمل زيادة 150 فلس مع تثبيت أسعار وجبات الكومبو؟',
      },
    ]

    const feryal: Command[] = feryalPrompts.map((q, i) => ({
      id: `f-${i}`,
      group: 'feryal',
      en: q.en,
      ar: q.ar,
      keywords: 'feryal ask فريال اسأل استشارة',
      icon: <Sparkles className="h-4 w-4" />,
      run: () => go(feryalHref(lang === 'ar' ? q.ar : q.en)),
    }))

    const actions: Command[] = [
      {
        id: 'a-print',
        group: 'actions',
        en: 'Print / Export Board Executive Brief',
        ar: 'طباعة وتصدير الموجز التنفيذي لمجلس الإدارة',
        keywords: 'print pdf export طباعة تصدير',
        icon: <Printer className="h-4 w-4" />,
        run: () => {
          close()
          if (pathname === '/erp') window.setTimeout(() => window.print(), 120)
          else router.push('/erp?print=1')
        },
      },
    ]

    return [...pages, ...decisions, ...branches, ...brands, ...feryal, ...actions]
  }, [close, go, lang, pathname, router])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const scored = commands
      .map((c) => {
        if (!q) {
          const base =
            c.group === 'pages' ? 3 : c.group === 'decisions' ? 2 : c.group === 'branches' ? 1.5 : c.group === 'feryal' ? 1 : 0.5
          return { c, score: base }
        }
        const hay = `${c.en} ${c.ar} ${c.hintEn ?? ''} ${c.hintAr ?? ''} ${c.keywords ?? ''}`.toLowerCase()
        const primary = (isAr ? c.ar : c.en).toLowerCase()
        if (primary.startsWith(q)) return { c, score: 4 }
        if (hay.includes(q)) return { c, score: 3 }
        const tokens = q.split(/\s+/).filter(Boolean)
        return { c, score: tokens.length > 1 && tokens.every((t) => hay.includes(t)) ? 2 : -1 }
      })
      .filter((x) => x.score > 0)

    const groups = GROUP_ORDER.map((g) => ({
      group: g,
      items: scored
        .filter((x) => x.c.group === g)
        .sort((a, b) => b.score - a.score)
        .slice(0, q ? 8 : g === 'pages' ? 4 : g === 'decisions' ? 6 : 4)
        .map((x) => x.c),
    })).filter((g) => g.items.length > 0)

    return { groups, flat: groups.flatMap((g) => g.items) }
  }, [commands, isAr, query])

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
    <div
      className="ae-palette-backdrop fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[8vh]"
      role="dialog"
      aria-modal
      aria-label={T('Executive command palette', 'لوحة البحث السريع في القرارات والفروع')}
      onClick={close}
    >
      <div className="ae-palette ae-pop w-full max-w-2xl overflow-hidden" dir={isAr ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 dark:border-slate-700/60">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={T(
              'Search any branch, brand, profit step, or ask Feryal…',
              'ابحث في الفروع أو المطاعم أو خطوات زيادة الربح أو اسأل فريال…',
            )}
            className="w-full text-[15px] outline-none placeholder:text-slate-400"
          />
          <kbd dir="ltr" className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[62vh] overflow-y-auto p-2">
          {results.groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              {T('No exact match — send this question directly to Feryal.', 'لا توجد نتيجة مطابقة — اسأل المستشارة فريال مباشرة.')}
              <div className="mt-3">
                <button type="button" className="ae-pill-dark" onClick={() => go(feryalHref(query))}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {T('Ask Feryal now', 'اسأل فريال الآن')}
                </button>
              </div>
            </div>
          ) : (
            results.groups.map((g) => (
              <div key={g.group} className="mb-1.5">
                <div className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {isAr ? GROUP_LABEL[g.group].ar : GROUP_LABEL[g.group].en}
                </div>
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
                        {(isAr ? c.hintAr : c.hintEn) ? (
                          <span className="block truncate text-[11px] font-medium text-slate-500">{isAr ? c.hintAr : c.hintEn}</span>
                        ) : null}
                      </span>
                      {active === i ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200/60 px-5 py-2.5 text-[11px] text-slate-500 dark:border-slate-700/60">
          <span>{T('↑ ↓ to navigate · Enter to jump · Esc to close', '↑ ↓ للتنقل · إدخال للانتقال الفوري · Esc للإغلاق')}</span>
          <span dir="ltr" className="font-mono text-[10px] font-bold">⌘K</span>
        </div>
      </div>
    </div>
  )
}
