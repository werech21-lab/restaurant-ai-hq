'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  Compass,
  CornerDownLeft,
  LayoutDashboard,
  MessageSquareHeart,
  PackageCheck,
  Printer,
  Radar,
  Scale,
  Search,
  Sparkles,
  Store,
  Target,
  Timer,
  Truck,
} from 'lucide-react'
import { feryalHref } from '@/lib/aether/ledger'
import {
  BRANCH_TRUE_CASH,
  BRAND_TRUE_CASH,
} from '@/lib/full-journey-enterprise-brain'
import { APPROVED_BRANCH_IDS, APPROVED_BRAND_IDS } from '@/lib/aether/global-filter-engine'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { COMMAND_PALETTE_EVENT } from '@/components/aether/BiFilterContext'
import { useLang } from '@/components/aether/ui'
import {
  isErpRouteAllowedForRole,
  shouldMaskInternalCostsForRole,
} from '@/lib/auth/role-access-policy'

type Group = 'pages' | 'decisions' | 'branches' | 'brands' | 'feryal' | 'actions'

function normalizeDecisionTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function resolvePlayCanonicalDestination(stage: string): {
  href: string
  domainEn: string
  domainAr: string
} {
  switch (stage) {
    case 'procurement':
    case 'kitchen':
      return {
        href: '/erp/warehouse-chain',
        domainEn: 'Warehouse-to-Branch Chain',
        domainAr: 'سلسلة المخزن والفروع',
      }
    case 'delivery':
      return {
        href: '/erp/aggregator-radar',
        domainEn: 'Aggregator Commissions',
        domainAr: 'عمولات منصات التوصيل',
      }
    case 'menu':
    case 'quality':
      return {
        href: '/erp/cores',
        domainEn: 'Sales, Marketing & Menu',
        domainAr: 'المبيعات والتسويق والمينيو',
      }
    case 'operations':
      return {
        href: '/erp/prep-sla',
        domainEn: 'Kitchen Prep SLA',
        domainAr: 'زمن تجهيز المطبخ',
      }
    case 'opex':
    default:
      return {
        href: '/erp/planning',
        domainEn: 'Strategic Planning & Forecast',
        domainAr: 'التخطيط والتوقعات',
      }
  }
}

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
  pages: { en: 'Executive Pages (4 Sections)', ar: 'صفحات المنصة (٤ أقسام)' },
  decisions: { en: 'Profit Tips', ar: 'توصيات الربح' },
  branches: { en: 'Branches', ar: 'الفروع' },
  brands: { en: 'Brands', ar: 'المطاعم' },
  feryal: { en: 'Ask Feryal (Vision & Video)', ar: 'المستشارة فريال (صور وفيديو)' },
  actions: { en: 'Actions', ar: 'إجراءات' },
}

const GROUP_ORDER: Group[] = ['pages', 'decisions', 'branches', 'brands', 'feryal', 'actions']

/** Bilingual Executive Command Palette (⌘K / Ctrl+K) aligned to the 4 Executive Sections & 13 ERP Routes. */
export function ExecutiveCommandPalette() {
  const router = useRouter()
  const pathname = usePathname()
  const { lang, isAr, T } = useLang()
  const { workspace, sessionRole, isAuditor } = useGlobalFilter()
  const activeRole = isAuditor ? 'auditor' : sessionRole
  const maskPaletteCosts =
    shouldMaskInternalCostsForRole(activeRole) || activeRole === 'supply'
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
    const allPageSpecs: Array<{ href: string; cmd: Command }> = [
      // 1) القيادة والمبيعات (Executive & Sales)
      {
        href: '/erp',
        cmd: {
          id: 'p-erp',
          group: 'pages',
          en: 'Company Summary',
          ar: 'ملخص الشركة',
          hintEn: maskPaletteCosts
            ? 'Executive & Sales · Sales, Orders & Quiet Hours'
            : 'Executive & Sales · 4 KPIs, Cash Flow & 10-KWD Split',
          hintAr: maskPaletteCosts
            ? 'القيادة والمبيعات · المبيعات والطلبات والساعات الهادئة'
            : 'القيادة والمبيعات · المؤشرات الرباعية وتوزيعة الـ ١٠ د.ك',
          keywords: 'overview dashboard company summary executive sales القيادة والمبيعات ملخص الشركة الرئيسية الصافي',
          icon: <LayoutDashboard className="h-4 w-4" />,
          run: () => go('/erp'),
        },
      },
      {
        href: '/erp/cores',
        cmd: {
          id: 'p-cores',
          group: 'pages',
          en: 'Sales, Marketing & Menu',
          ar: 'المبيعات والتسويق والمينيو',
          hintEn: 'Executive & Sales · Influencer ROI, Channel Mix & Menu Matrix',
          hintAr: 'القيادة والمبيعات · إعلانات المشاهير، القنوات، وهندسة المينيو',
          keywords: 'cores marketing social influencer menu sales المبيعات والتسويق والمينيو مشاهير اعلانات منيو اصناف',
          icon: <BarChart3 className="h-4 w-4" />,
          run: () => go('/erp/cores'),
        },
      },
      {
        href: '/erp/weekday-comparison',
        cmd: {
          id: 'p-weekday-comparison',
          group: 'pages',
          en: 'Weekday Sales Comparison',
          ar: 'مقارنة أيام الأسبوع',
          hintEn: 'Executive & Sales · Day-of-Week Sales & Margin Rhythm',
          hintAr: 'القيادة والمبيعات · أداء المبيعات والربحية حسب أيام الأسبوع',
          keywords: 'weekday comparison day of week weekend مقارنة أيام الأسبوع خميس جمعة سبت القيادة والمبيعات',
          icon: <CalendarDays className="h-4 w-4" />,
          run: () => go('/erp/weekday-comparison'),
        },
      },
      {
        href: '/erp/before-after',
        cmd: {
          id: 'p-before-after',
          group: 'pages',
          en: 'Decision Impact (Before & After)',
          ar: 'أثر القرارات (قبل وبعد)',
          hintEn: 'Executive & Sales · Verified Before vs. After Odoo Variance',
          hintAr: 'القيادة والمبيعات · قياس أثر القرارات المعتمدة قبل وبعد التنفيذ',
          keywords: 'decision impact before after compare variance أثر القرارات قبل وبعد مقارنة',
          icon: <ArrowLeftRight className="h-4 w-4" />,
          run: () => go('/erp/before-after'),
        },
      },

      // 2) التشغيل وسلسلة الإمداد (Operations & SLA)
      {
        href: '/erp/warehouse-chain',
        cmd: {
          id: 'p-warehouse-chain',
          group: 'pages',
          en: 'Warehouse-to-Branch Chain',
          ar: 'سلسلة المخزن والفروع',
          hintEn: 'Operations & SLA · Ardiya Stock, Outbound, Received & Depletion',
          hintAr: 'التشغيل وسلسلة الإمداد · رصيد العارضية، المنصرف، المستلم، والمباع',
          keywords: 'warehouse chain stock outbound received depletion التشغيل وسلسلة الإمداد سلسلة المخزن والفروع العارضية هدر',
          icon: <PackageCheck className="h-4 w-4" />,
          run: () => go('/erp/warehouse-chain'),
        },
      },
      {
        href: '/erp/prep-sla',
        cmd: {
          id: 'p-prep-sla',
          group: 'pages',
          en: 'Kitchen Prep SLA',
          ar: 'زمن تجهيز المطبخ',
          hintEn: 'Operations & SLA · Order Arrival to Kitchen Ready Speed',
          hintAr: 'التشغيل وسلسلة الإمداد · سرعة تحضير المطبخ حسب المطعم والفرع',
          keywords: 'prep sla kitchen ready kds زمن تجهيز المطبخ مدة تجهيز الطلبات تحضير اخضر اصفر احمر',
          icon: <Timer className="h-4 w-4" />,
          run: () => go('/erp/prep-sla'),
        },
      },
      {
        href: '/erp/delivery-sla',
        cmd: {
          id: 'p-delivery-sla',
          group: 'pages',
          en: 'Rider Delivery SLA',
          ar: 'زمن توصيل السائق',
          hintEn: 'Operations & SLA · Dispatch to Customer Handoff Speed',
          hintAr: 'التشغيل وسلسلة الإمداد · سرعة توصيل السائقين والمنصات',
          keywords: 'delivery sla rider driver speed زمن توصيل السائق مدة توصيل الطلبات سائق',
          icon: <Truck className="h-4 w-4" />,
          run: () => go('/erp/delivery-sla'),
        },
      },
      {
        href: '/erp/aggregator-radar',
        cmd: {
          id: 'p-radar',
          group: 'pages',
          en: 'Aggregator Commissions',
          ar: 'عمولات منصات التوصيل',
          hintEn: 'Operations & SLA · Talabat Tgo/TMP, Keeta, Deliveroo & Jahez',
          hintAr: 'التشغيل وسلسلة الإمداد · عمولات طلبات وكيتا ودليفرو وجاهز وسنونو',
          keywords: 'aggregator commissions radar delivery talabat keeta deliveroo jahez snoonu tgo tmp عمولات منصات التوصيل مراقبة التوصيل',
          icon: <Radar className="h-4 w-4" />,
          run: () => go('/erp/aggregator-radar'),
        },
      },

      // 3) السمعة والذكاء المرئي (Reputation & Vision AI)
      {
        href: '/erp/social-reviews',
        cmd: {
          id: 'p-social-reviews',
          group: 'pages',
          en: 'Social & Aggregator Reviews',
          ar: 'التقييمات ومنصات التواصل',
          hintEn: 'Reputation & Vision AI · Customer Ratings & Social Sentiment',
          hintAr: 'السمعة والذكاء المرئي · تقييمات المنصات والتفاعل الاجتماعي',
          keywords: 'social reviews ratings talabat google instagram السمعة والذكاء المرئي التقييمات ومنصات التواصل تعليقات تقييم',
          icon: <MessageSquareHeart className="h-4 w-4" />,
          run: () => go('/erp/social-reviews'),
        },
      },
      {
        href: '/erp/feryal-ai',
        cmd: {
          id: 'p-feryal',
          group: 'pages',
          en: 'Ask Feryal (Vision & Video)',
          ar: 'المستشارة فريال (صور وفيديو)',
          hintEn: 'Reputation & Vision AI · Multimodal Inspection, Voice & Triple-Brain',
          hintAr: 'السمعة والذكاء المرئي · فحص الصور والفيديو والمحادثة الصوتية',
          keywords: 'ai copilot voice vision video feryal المستشارة فريال صور وفيديو السمعة والذكاء المرئي',
          icon: <Sparkles className="h-4 w-4" />,
          run: () => go('/erp/feryal-ai'),
        },
      },

      // 4) الحوكمة والتخطيط (Governance & Strategy)
      {
        href: '/erp/planning',
        cmd: {
          id: 'p-planning',
          group: 'pages',
          en: 'Strategic Planning & Forecast',
          ar: 'التخطيط والتوقعات',
          hintEn: 'Governance & Strategy · 3 Scenarios & Phased Execution Roadmap',
          hintAr: 'الحوكمة والتخطيط · ٣ سيناريوهات، التوقعات، وخارطة المراحل',
          keywords: 'planning forecast scenarios roadmap strategy الحوكمة والتخطيط التخطيط والتوقعات خطة مراحل ميزانية',
          icon: <Compass className="h-4 w-4" />,
          run: () => go('/erp/planning'),
        },
      },
      {
        href: '/erp/regulations',
        cmd: {
          id: 'p-regulations',
          group: 'pages',
          en: 'Regulations & Licensing',
          ar: 'التشريعات والتراخيص',
          hintEn: 'Governance & Strategy · Municipality, PAFN, Manpower & MOCI',
          hintAr: 'الحوكمة والتخطيط · البلدية، الغذاء، القوى العاملة، والتجارة',
          keywords: 'regulations licensing compliance municipality pafn manpower moci الحوكمة والتخطيط التشريعات والتراخيص بلدية تراخيص',
          icon: <Scale className="h-4 w-4" />,
          run: () => go('/erp/regulations'),
        },
      },
      {
        href: '/erp/booth-feasibility',
        cmd: {
          id: 'p-booth-feasibility',
          group: 'pages',
          en: 'Booth Feasibility Calculator',
          ar: 'حاسبة جدوى المعارض',
          hintEn: 'Governance & Strategy · Exhibition Rent, Break-Even & Profit Study',
          hintAr: 'الحوكمة والتخطيط · دراسة جدوى البوثات والإيجار ونقطة التعادل',
          keywords: 'events booth feasibility calculator exb kashta winterland الحوكمة والتخطيط حاسبة جدوى المعارض حاسبة المعارض بوث كشتة',
          icon: <CalendarRange className="h-4 w-4" />,
          run: () => go('/erp/booth-feasibility'),
        },
      },
    ]
    const pages: Command[] = allPageSpecs
      .filter((entry) => isErpRouteAllowedForRole(activeRole, entry.href))
      .map((entry) => entry.cmd)

    const seenTitleAr = new Set<string>()
    const seenTitleEn = new Set<string>()
    const seenProblemAr = new Set<string>()
    const dedupedPlays = workspace.plays.filter((p) => {
      const keyAr = normalizeDecisionTitle(p.titleAr)
      const keyEn = normalizeDecisionTitle(p.titleEn)
      const probAr = normalizeDecisionTitle(p.problemAr)
      if (!keyAr || !keyEn) return false
      if (seenTitleAr.has(keyAr) || seenTitleEn.has(keyEn) || (probAr && seenProblemAr.has(probAr))) {
        return false
      }
      seenTitleAr.add(keyAr)
      seenTitleEn.add(keyEn)
      if (probAr) seenProblemAr.add(probAr)
      return true
    })

    const decisions: Command[] = dedupedPlays
      .map((p) => ({
        play: p,
        dest: resolvePlayCanonicalDestination(p.stage),
      }))
      .filter(({ dest }) => isErpRouteAllowedForRole(activeRole, dest.href))
      .map(({ play: p, dest }) => ({
        id: `d-${p.id}`,
        group: 'decisions' as const,
        en: p.titleEn,
        ar: p.titleAr,
        hintEn: maskPaletteCosts
          ? dest.domainEn
          : `${dest.domainEn} · +${p.periodLabelEn}`,
        hintAr: maskPaletteCosts
          ? dest.domainAr
          : `${dest.domainAr} · +${p.periodLabelAr}`,
        keywords: `${p.problemEn} ${p.problemAr} ${p.stage} ${p.id} ${dest.domainEn} ${dest.domainAr}`,
        icon: <Target className="h-4 w-4 text-emerald-600" />,
        run: () => go(dest.href),
      }))

    const branches: Command[] = BRANCH_TRUE_CASH.filter((b) =>
      (APPROVED_BRANCH_IDS as readonly string[]).includes(b.id),
    ).map((b) => ({
      id: `br-loc-${b.id}`,
      group: 'branches',
      en: b.en,
      ar: b.ar,
      hintEn: maskPaletteCosts
        ? 'Active Branch · Restricted to Finance/GM'
        : `Net: ${b.trueNetCash >= 0 ? '+' : ''}${Math.round(b.trueNetCash).toLocaleString('en-US')} KWD`,
      hintAr: maskPaletteCosts
        ? 'فرع نشط · محصور بالمالية والمدير العام'
        : `الصافي: ${b.trueNetCash >= 0 ? '+' : ''}${Math.round(b.trueNetCash).toLocaleString('en-US')} د.ك`,
      keywords: `branch location فرع موقع ${b.en} ${b.ar}`,
      icon: <Store className="h-4 w-4" />,
      run: () =>
        go(
          feryalHref(
            lang === 'ar'
              ? `عطيني ملخص واضح لأداء فرع ${b.ar}.`
              : `Give me a clear performance summary for ${b.en}.`,
          ),
        ),
    }))

    const brands: Command[] = BRAND_TRUE_CASH.filter((b) =>
      (APPROVED_BRAND_IDS as readonly string[]).includes(b.id),
    ).map((b) => ({
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
  }, [close, go, lang, pathname, router, workspace.plays])

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
        .sort((a, b) => (b.score !== a.score ? b.score - a.score : 0))
        .slice(0, q ? 13 : g === 'pages' ? 13 : g === 'decisions' ? 6 : 4)
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
      <div
        className="ae-palette ae-pop w-full max-w-2xl overflow-hidden"
        dir={isAr ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200/60 px-5 py-4 dark:border-slate-700/60">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={T(
              'Search any page, branch, brand, profit step, or ask Feryal…',
              'ابحث في الصفحات أو الفروع أو المطاعم أو خطوات الربح أو اسأل فريال…',
            )}
            className="w-full text-[15px] outline-none placeholder:text-slate-400"
          />
          <kbd
            dir="ltr"
            className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          >
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[62vh] overflow-y-auto p-2">
          {results.groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              {T(
                'No exact match — send this question directly to Feryal.',
                'لا توجد نتيجة مطابقة — اسأل المستشارة فريال مباشرة.',
              )}
              <div className="mt-3">
                <button
                  type="button"
                  className="btn-colored inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                  onClick={() => go(feryalHref(query))}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {T('Ask Feryal now', 'اسأل فريال الآن')}
                </button>
              </div>
            </div>
          ) : (
            results.groups.map((g) => (
              <div key={g.group} className="mb-1.5">
                <div className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
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
                      className="ae-palette-item flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors"
                    >
                      <span className="ae-icon-badge h-8 w-8">{c.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">
                          {isAr ? c.ar : c.en}
                        </span>
                        {(isAr ? c.hintAr : c.hintEn) ? (
                          <span className="block truncate text-[13px] font-medium text-slate-500">
                            {isAr ? c.hintAr : c.hintEn}
                          </span>
                        ) : null}
                      </span>
                      {active === i ? (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200/60 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-700/60">
          <span>
            {T(
              '↑ ↓ to navigate · Enter to jump · Esc to close',
              '↑ ↓ للتنقل · إدخال للانتقال الفوري · Esc للإغلاق',
            )}
          </span>
          <span dir="ltr" className="font-mono text-xs font-bold">
            ⌘K
          </span>
        </div>
      </div>
    </div>
  )
}
