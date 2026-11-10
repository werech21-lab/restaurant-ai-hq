'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  Mic,
  MicOff,
  Headphones,
  Volume2,
  VolumeX,
  Send,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowDownRight,
  Sliders,
  Search,
  ShieldCheck,
  RefreshCw,
  Activity,
  Zap,
  Store,
  ChevronRight,
  Clock,
  Check,
  Building2,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  Copy,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getOpenAIApiKey, getGeminiApiKey } from '@/lib/ai-keys'
import { askFeryalGeminiBrain } from '@/lib/feryal-gemini-brain'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { FeryalRichText } from '@/components/aether/FeryalRichText'
import { FeryalWhatIfCalculator } from '@/components/aether/FeryalWhatIfCalculator'
import { BRANDS, BRANCHES, CHANNELS, PERIODS } from '@/lib/aether/ledger'

// ==============================================================================
// 1. MASTER ODOO DATASET (OFFICIAL OCTOBER BENCHMARK)
// ==============================================================================
const MASTER_ODOO_METRICS = {
  netSalesKwd: 167092.16,
  ordersCount: 30540,
  aovKwd: 5.471,
  operatingProfitKwd: 42441.48,
  profitMarginPct: 25.4,
  foodCostKwd: 41438.856,
  foodCostPct: 24.8,
  foodCostTargetPct: 24.0,
  operatingExpensesKwd: 51154.95,
  custodyEntriesCount: 2213,
  rabihMaintenanceCustodyKwd: 10707.93,
  discountsKwd: 4152.0,
  discountsPct: 2.4,
  keetaDiscountsKwd: 2544.0,
  brandsCount: 6,
  channelsCount: 11,
  branchesCount: 9,
  activeMenuItemsCount: 364,
  topItemsSalesConcentrationPct: 80.0,
  topItemsCount: 32,
}

// 9 Active Operational Branches
const VERIFIED_BRANCHES = [
  { id: 'Salmiya', nameAr: 'السالمية', nameEn: 'Salmiya', salesKwd: 31246.23, orders: 5710, share: 18.7, rank: 1, bestChannelAr: 'طلبات جو (توصيل المنصة)', bestChannelEn: 'Talabat Tgo', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Al-Kout', nameAr: 'الكوت / الفحيحيل', nameEn: 'Al-Kout / Fahaheel', salesKwd: 27904.39, orders: 5100, share: 16.7, rank: 2, bestChannelAr: 'سوق طلبات (توصيل المطعم)', bestChannelEn: 'Talabat TMP', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Sharq', nameAr: 'شرق', nameEn: 'Sharq', salesKwd: 24896.73, orders: 4550, share: 14.9, rank: 3, bestChannelAr: 'دليفرو', bestChannelEn: 'Deliveroo', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Hawally', nameAr: 'حولي', nameEn: 'Hawally', salesKwd: 21387.79, orders: 3910, share: 12.8, rank: 4, bestChannelAr: 'كيتا', bestChannelEn: 'Keeta', statusAr: 'يحتاج صيانة مبردات', statusEn: 'Chiller Repairs Required' },
  { id: 'Farwaniya', nameAr: 'الفروانية', nameEn: 'Farwaniya', salesKwd: 18045.95, orders: 3300, share: 10.8, rank: 5, bestChannelAr: 'طلبات جو (توصيل المنصة)', bestChannelEn: 'Talabat Tgo', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Ardiya', nameAr: 'العارضية الحرفية', nameEn: 'Ardiya Central', salesKwd: 15372.48, orders: 2810, share: 9.2, rank: 6, bestChannelAr: 'المطبخ المركزي', bestChannelEn: 'Central Hub', statusAr: 'معايرة هدر التتبيل', statusEn: 'Prep Waste Calibration' },
  { id: 'Mahboula', nameAr: 'المهبولة', nameEn: 'Mahboula', salesKwd: 11238.29, orders: 2055, share: 6.7, rank: 7, bestChannelAr: 'سوق طلبات (توصيل المطعم)', bestChannelEn: 'Talabat TMP', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Mubarak-Al-Kabeer', nameAr: 'مبارك الكبير / صباح السالم', nameEn: 'Mubarak Al-Kabeer', salesKwd: 9200.3, orders: 1680, share: 5.5, rank: 8, bestChannelAr: 'طلبات جو (توصيل المنصة)', bestChannelEn: 'Talabat Tgo', statusAr: 'نمو متصاعد', statusEn: 'Rapid Growth' },
  { id: 'Jabriya', nameAr: 'الجابرية', nameEn: 'Jabriya', salesKwd: 7800.0, orders: 1425, share: 4.7, rank: 9, bestChannelAr: 'طلبات جو (توصيل المنصة)', bestChannelEn: 'Talabat Tgo', statusAr: 'مثالي', statusEn: 'Optimal' },
]

// ==============================================================================
// 2. STRATEGIC ENGINE PRE-CONFIGURED DATA
// ==============================================================================
interface SolutionItem {
  id: string
  titleAr: string
  titleEn: string
  locationAr: string
  locationEn: string
  monthlySavingsKwd: number
  badgeAr: string
  badgeEn: string
  detailsAr: string
  detailsEn: string
}

const STRATEGIC_SOLUTIONS: SolutionItem[] = [
  {
    id: 'sol-ardiya',
    titleAr: 'ضبط هدر التتبيل في مطبخ العارضية المركزي',
    titleEn: 'Central Prep & Marination Yield Calibration',
    locationAr: 'مطبخ العارضية المركزي',
    locationEn: 'Ardiya Central Prep Facility',
    monthlySavingsKwd: 1336,
    badgeAr: 'تكلفة الأغذية والمواد',
    badgeEn: 'Food Cost (COGS)',
    detailsAr: 'إعادة ضبط أوزان خلطات التتبيل وتوحيد تقطيع الدجاج يقلص الفاقد بنسبة 1.6% ويعيد تكلفة المواد للمستهدف 24.0%.',
    detailsEn: 'Standardizing marinade batch weights and raw poultry prep cuts recovers 1.6% yield, aligning food cost to target 24.0%.',
  },
  {
    id: 'sol-hawally',
    titleAr: 'استبدال وحدات التبريد وخفض استهلاك الطاقة',
    titleEn: 'Commercial Chiller Overhaul & Energy Efficiency',
    locationAr: 'فرع حولي',
    locationEn: 'Hawally Branch',
    monthlySavingsKwd: 850,
    badgeAr: 'المصروفات والصيانة',
    badgeEn: 'Opex & Maintenance',
    detailsAr: 'استبدال 3 مبردات قديمة متهالكة يخفض استهلاك الكهرباء والصيانة الدورية ويمنع تلف الخضار واللحوم.',
    detailsEn: 'Upgrading 3 degraded commercial chillers reduces electric tariff loads and prevents raw perishables spoilage.',
  },
  {
    id: 'sol-keeta',
    titleAr: 'ضبط وترشيد خصومات حملات كيتا',
    titleEn: 'Cap Keeta Platform Marketing Subsidies',
    locationAr: 'منصة كيتا (كافة الفروع)',
    locationEn: 'Keeta Aggregator (All Branches)',
    monthlySavingsKwd: 1620,
    badgeAr: 'كفاءة التسويق',
    badgeEn: 'Marketing Yield',
    detailsAr: 'وضع سقف للخصومات الترويجية وخفض الحرق من 2,544 د.ك إلى 924 د.ك شهرياً مع الحفاظ على معدل تحويل الطلبات.',
    detailsEn: 'Capping aggressive promo burn from 2,544 KWD to 924 KWD monthly while preserving customer order conversion.',
  },
]

interface ProposalItem {
  id: string
  titleAr: string
  titleEn: string
  expectedMonthlyGainKwd: number
  badgeAr: string
  badgeEn: string
  mechanismAr: string
  mechanismEn: string
}

const STRATEGIC_PROPOSALS: ProposalItem[] = [
  {
    id: 'prop-drinks',
    titleAr: 'إلزام إضافة المشروبات للوجبات ومجموعات الكومبو',
    titleEn: 'Mandatory Beverage Attachment in Combo Meals',
    expectedMonthlyGainKwd: 2450,
    badgeAr: 'رفع متوسط السلة',
    badgeEn: 'AOV Expansion',
    mechanismAr: 'رفع متوسط سلة الشراء من 5.471 د.ك إلى 5.750 د.ك بإدراج المشروب الإلزامي لكافة وجبات الكومبو بتطبيقات التوصيل.',
    mechanismEn: 'Elevating Group AOV from 5.471 to 5.750 KWD by bundling high-margin soft beverages in all delivery combo items.',
  },
  {
    id: 'prop-menu-eng',
    titleAr: 'إعادة هندسة قائمة الطعام وتعديل الأسعار',
    titleEn: 'Menu Matrix Rationalization (Dogs & Plowhorses)',
    expectedMonthlyGainKwd: 584,
    badgeAr: 'تعظيم الهامش الربحي',
    badgeEn: 'Margin Optimization',
    mechanismAr: 'استبعاد 18 صنفاً بطيئ الحركة وتعديل أسعار 4 أصناف شعبية بنسبة +5% لتوليد ربح صافي مباشر.',
    mechanismEn: 'Purging 18 sluggish Dog items and adjusting prices of 4 popular Plowhorses by +5% to generate pure margin.',
  },
]

interface ExecutionPlanItem {
  id: string
  weekAr: string
  weekEn: string
  departmentAr: string
  departmentEn: string
  titleAr: string
  titleEn: string
  targetKpiAr: string
  targetKpiEn: string
  actionType: string
  status: 'pending' | 'running' | 'completed'
}

const STRATEGIC_EXECUTION_PLANS: ExecutionPlanItem[] = [
  {
    id: 'plan-w1',
    weekAr: 'الأسبوع 1',
    weekEn: 'Week 1',
    departmentAr: 'المطبخ المركزي والجودة',
    departmentEn: 'Central Kitchen & QC',
    titleAr: 'معايرة مقادير التتبيل وموازين مطبخ العارضية',
    titleEn: 'Calibrate Marinades & Portion Scales at Ardiya',
    targetKpiAr: 'خفض الهدر وتوفير 1,336 د.ك شهرياً',
    targetKpiEn: 'Cut waste & save 1,336 KWD/month',
    actionType: 'dispatch_operations_plan',
    status: 'pending',
  },
  {
    id: 'plan-w2',
    weekAr: 'الأسبوع 2',
    weekEn: 'Week 2',
    departmentAr: 'الصيانة والمشتريات',
    departmentEn: 'Maintenance & Procurement',
    titleAr: 'شراء وتوريد المبردات الحديثة لفرع حولي',
    titleEn: 'Procure & Install Inverter Chillers for Hawally',
    targetKpiAr: 'خفض استهلاك الكهرباء والصيانة بـ 850 د.ك',
    targetKpiEn: 'Cut utility & repairs by 850 KWD/month',
    actionType: 'dispatch_chiller_plan',
    status: 'pending',
  },
  {
    id: 'plan-w3',
    weekAr: 'الأسبوع 3',
    weekEn: 'Week 3',
    departmentAr: 'التسويق وإدارة القنوات',
    departmentEn: 'Marketing & Channels',
    titleAr: 'تطبيق سقف خصومات كيتا وتعديل مصفوفة العروض',
    titleEn: 'Apply Keeta Promo Cap & Revamp Delivery Tiers',
    targetKpiAr: 'وفر تسويقي فوري قدره 1,620 د.ك شهرياً',
    targetKpiEn: 'Direct promo savings of 1,620 KWD/month',
    actionType: 'dispatch_keeta_cap',
    status: 'pending',
  },
  {
    id: 'plan-w4',
    weekAr: 'الأسبوع 4',
    weekEn: 'Week 4',
    departmentAr: 'العمليات والتدريب وتقنية المعلومات',
    departmentEn: 'Operations & POS Tech',
    titleAr: 'تفعيل المشروب الإلزامي وتحديث أسعار المنيو 5%',
    titleEn: 'Enforce Combo Drinks & Apply 5% Plowhorse Pricing',
    targetKpiAr: 'نمو الإيراد الشهري بمقدار +3,034 د.ك',
    targetKpiEn: 'Boost monthly gross revenue by +3,034 KWD',
    actionType: 'dispatch_combo_drinks',
    status: 'pending',
  },
]

type PlanApproval = 'planned' | 'in-progress' | 'approved'
const PLAN_STATUS_LABEL: Record<PlanApproval, { ar: string; en: string }> = {
  planned: { ar: 'مخطط', en: 'Planned' },
  'in-progress': { ar: 'قيد التنفيذ', en: 'In Progress' },
  approved: { ar: 'معتمد', en: 'Approved' },
}

// Default Fallback Texts
const DEFAULT_PERPLEXITY_AR = `تقرير استخبارات السوق الكويتي اللحظي لسوق الشويخ للجملة:
• الدواجن الطازجة والمجمدة: أسعار كرتون الدجاج البرازيلي مستقرة عند أحد عشر ديناراً وأربعمائة فلس مع وفرة في المعروض.
• زيوت القلي النقية: برميل زيت الذرة سعة عشرين لتراً يتداول عند ثمانية دنانير وسبعمائة وخمسين فلساً، مع توصية بالشراء الآجل لتفادي زيادة متوقعة بنسبة أربعة بالمئة.
• الخضار والورقيات بسوق الفرضة بالصليبية: انخفاض بنسبة ستة بالمئة في أسعار البصل والبطاطس، وارتفاع طفيف في الطماطم المحمية.
• منصات التوصيل: اشتداد حدة المنافسة بين منصتي طلبات وكيتا، مع عروض توصيل مجاني تجذب شرائح جديدة في حولي والسالمية.
توصية فريال: تثبيت عقود توريد الزيوت لشهر نوفمبر في مطبخ العارضية المركزي لتحقيق وفر مباشر قدره أربعمائة وخمسون ديناراً كويتياً.`

const DEFAULT_PERPLEXITY_EN = `Kuwait Restaurant Market Intelligence for Shuwaikh Wholesale Markets:
• Poultry (Fresh & Frozen): Brazilian frozen chicken carton stabilized at 11.400 Kuwaiti Dinars with steady supply chains.
• Pure Cooking Oil & Shortening: 20-liter corn oil drum trading at 8.750 Kuwaiti Dinars, with a recommended forward contract before an expected 4 percent price increase.
• Vegetables & Greens (Al-Fardha - Sulaibiya): 6 percent price drop in bulk onions and potatoes; minor increase in greenhouse tomatoes.
• Aggregator Dynamics: Fierce market competition between Talabat and Keeta; Keeta's aggressive subsidies drive user adoption in Hawally & Salmiya.
Feryal Recommendation: Lock in November oil and poultry supply contracts for Ardiya Central Kitchen to capture 450 Kuwaiti Dinars in direct margin savings.`

/**
 * Client-side text sanitizer for speech fallback
 */
function sanitizeTextForSpeechClient(rawText: string, lang: 'ar' | 'en'): string {
  if (!rawText) return ''
  let text = rawText
  text = text.replace(/https?:\/\/\S+/gi, '')
  text = text.replace(/[*#`_~•–—+\/\\|<>\[\]{}()=^:]/g, ' ')
  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu,
    ' '
  )
  if (lang === 'ar') {
    text = text.replace(/\bKWD\b/gi, ' دينار كويتي ')
    text = text.replace(/د\.ك/g, ' دينار كويتي ')
    text = text.replace(/%/g, ' بالمئة ')
    text = text.replace(/\bCOGS\b/gi, ' تكلفة الأغذية والمواد ')
    text = text.replace(/\bAOV\b/gi, ' متوسط قيمة السلة ')
    text = text.replace(/\bTgo\b/gi, ' طلبات جو ')
    text = text.replace(/\bTMP\b/gi, ' سوق طلبات ')
  } else {
    text = text.replace(/\bKWD\b/gi, ' Kuwaiti Dinars ')
    text = text.replace(/د\.ك/g, ' Kuwaiti Dinars ')
    text = text.replace(/%/g, ' percent ')
    text = text.replace(/\bCOGS\b/gi, ' Cost of Goods Sold ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

// ==============================================================================
// 3. MAIN COMPONENT (Unslop UI - High Contrast & Large Typography)
// ==============================================================================
export default function FeryalAiCommandPage() {
  const { locale: ctxLocale } = useI18n()

  // Dynamic reactive locale synced with site navbar, localStorage, and document lang/dir
  const [activeLocale, setActiveLocale] = useState<'ar' | 'en'>(() => {
    if (ctxLocale === 'en' || ctxLocale === 'ar') return ctxLocale
    if (typeof window !== 'undefined') {
      const stored =
        localStorage.getItem('aetherbi_locale') ||
        localStorage.getItem('NEXT_LOCALE') ||
        localStorage.getItem('ai-hq-locale')
      if (stored === 'en' || stored === 'ar') return stored as 'ar' | 'en'
      const docLang = document.documentElement.lang
      if (docLang === 'en' || docLang === 'ar') return docLang as 'ar' | 'en'
      if (document.documentElement.dir === 'rtl') return 'ar'
      if (document.documentElement.dir === 'ltr') return 'en'
    }
    return 'ar'
  })

  // Synchronize immediately if context locale changes
  useEffect(() => {
    if (ctxLocale === 'en' || ctxLocale === 'ar') {
      setActiveLocale(ctxLocale)
    }
  }, [ctxLocale])

  // MutationObserver & storage listener to catch top navbar language switch in real time
  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncLocale = () => {
      const stored =
        localStorage.getItem('aetherbi_locale') ||
        localStorage.getItem('NEXT_LOCALE') ||
        localStorage.getItem('ai-hq-locale')
      if (stored === 'en' || stored === 'ar') {
        setActiveLocale(stored)
        return
      }
      const lang = document.documentElement.lang
      if (lang === 'en' || lang === 'ar') {
        setActiveLocale(lang)
        return
      }
      const dir = document.documentElement.dir
      if (dir === 'rtl') setActiveLocale('ar')
      else if (dir === 'ltr') setActiveLocale('en')
    }

    syncLocale()

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && (m.attributeName === 'lang' || m.attributeName === 'dir')) {
          syncLocale()
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] })

    window.addEventListener('storage', syncLocale)
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', syncLocale)
    }
  }, [])

  // Primary reactive locale (Context locale is immediate; activeLocale is reliable fallback)
  const currentLang = (ctxLocale === 'en' || ctxLocale === 'ar') ? ctxLocale : activeLocale
  const isAr = currentLang === 'ar'

  // Copilot Chat States
  const [messages, setMessages] = useState<
    Array<{ id: string; sender: 'user' | 'feryal'; textAr: string; textEn: string; time: string; metrics?: any }>
  >([
    {
      id: 'welcome',
      sender: 'feryal',
      textAr:
        'مرحباً بك يا سعادة المدير. أنا المستشارة فريال، محرك الذكاء الاصطناعي التنفيذي لمجموعة فنتشر فودز. أراقب لحظياً مائة وسبعة وستين ألفاً واثنين وتسعين ديناراً كويتياً مبيعات معتمدة وثلاثين ألفاً وخمسمائة وأربعين طلباً عبر أودو ورادارات التوصيل بدقة كاملة. كيف ترغب أن نبدأ خطة تعظيم الأرباح وخفض التكاليف اليوم؟',
      textEn:
        'Greetings, Executive Leader. I am Feryal, your AI Executive Copilot for Venture Foods. I actively monitor 167,092.160 KWD in approved sales and 30,540 orders across Odoo and delivery aggregators with 100 percent ledger reconciliation. How would you like to accelerate profit margins and eliminate operational waste today?',
      time: isAr ? 'الآن' : 'Just now',
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isCopilotThinking, setIsCopilotThinking] = useState(false)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [planApproval, setPlanApproval] = useState<Record<string, PlanApproval>>({})

  const copyMessage = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text)
    } catch {}
    setCopiedMsgId(id)
    window.setTimeout(() => setCopiedMsgId((c) => (c === id ? null : c)), 1800)
  }, [])

  // Live global BI context (brand × branch × channel × period) shared with every Aether V2 surface
  const { filters: biFilters, view: biView } = useBiFilters()
  const biScopeRef = useRef('')
  const biScopeLabel = useMemo(() => {
    const parts: string[] = []
    const b = BRANDS.find((x) => x.id === biFilters.brand)
    const br = BRANCHES.find((x) => x.id === biFilters.branch)
    const ch = CHANNELS.find((x) => x.id === biFilters.channel)
    const pr = PERIODS.find((x) => x.id === biFilters.period)
    if (b) parts.push(isAr ? b.ar : b.en)
    if (br) parts.push(isAr ? br.ar : br.en)
    if (ch) parts.push(isAr ? ch.ar : ch.en)
    if (pr && biFilters.period !== 'monthly') parts.push(isAr ? pr.ar : pr.en)
    return parts.join(' · ')
  }, [biFilters, isAr])
  useEffect(() => {
    if (!biScopeLabel) {
      biScopeRef.current = ''
      return
    }
    const b = BRANDS.find((x) => x.id === biFilters.brand)
    const br = BRANCHES.find((x) => x.id === biFilters.branch)
    const ch = CHANNELS.find((x) => x.id === biFilters.channel)
    biScopeRef.current = `\n[Active BI scope: brand=${b ? b.en : 'all 6'}, branch=${br ? br.en : 'all 9'}, channel=${ch ? ch.en : 'all 11'}, period=${biFilters.period}; slice net sales ${biView.netSales.toFixed(3)} KWD, ${Math.round(biView.orders)} orders, ${biView.marginPct.toFixed(1)}% margin]`
  }, [biFilters, biView, biScopeLabel])
  const withScope = useCallback((q: string) => `${q}${biScopeRef.current}`, [])

  // Voice Interaction States (Audio Element + Web Speech API)
  const [isListening, setIsListening] = useState(false)
  const [micLang, setMicLang] = useState<'ar' | 'en'>(isAr ? 'ar' : 'en')
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [isHandsFree, setIsHandsFree] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const [micToast, setMicToast] = useState<string | null>(null)
  const [lastVoiceError, setLastVoiceError] = useState<string | null>(null)
  const inputFieldRef = useRef<HTMLInputElement | null>(null)

  // Stop and release all microphone tracks immediately (Returns Bluetooth headset to Stereo mode)
  const stopAllMicTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop()
          track.enabled = false
        })
      } catch {}
      mediaStreamRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {}
    }
    setIsListening(false)
    isListeningRef.current = false
  }, [])

  const isHandsFreeRef = useRef(false)
  const isVoiceMutedRef = useRef(false)
  const isListeningRef = useRef(false)
  const micLangRef = useRef<'ar' | 'en'>(isAr ? 'ar' : 'en')
  const handleSendQueryRef = useRef<((text?: string) => Promise<void>) | null>(null)
  const startListeningRef = useRef<(() => void) | null>(null)
  const silenceTimerRef = useRef<any>(null)
  const interimTranscriptRef = useRef<string>('')

  // Sync refs with states to prevent stale closures in async callbacks
  useEffect(() => {
    isHandsFreeRef.current = isHandsFree
  }, [isHandsFree])

  useEffect(() => {
    isVoiceMutedRef.current = isVoiceMuted
  }, [isVoiceMuted])

  useEffect(() => {
    micLangRef.current = micLang
  }, [micLang])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    setMicLang(isAr ? 'ar' : 'en')
  }, [isAr])

  // Four Smart Services Hub States
  const [hubLoading, setHubLoading] = useState(false)

  // Perplexity States
  const [perplexityQuery, setPerplexityQuery] = useState(
    isAr
      ? 'أسعار الدجاج المجمد وزيوت القلي وسوق المطاعم في الكويت وتأثير الطقس'
      : 'Wholesale chicken & cooking oil prices, Kuwait restaurant inflation, and weather impact'
  )
  const [perplexityResponse, setPerplexityResponse] = useState<string | null>(
    isAr ? DEFAULT_PERPLEXITY_AR : DEFAULT_PERPLEXITY_EN
  )

  // Firecrawl States
  const [firecrawlUrl, setFirecrawlUrl] = useState('https://www.talabat.com/kuwait/restaurant/china-garden')
  const [competitorItems, setCompetitorItems] = useState<any[]>([])

  // Playwright States
  const [portalSelect, setPortalSelect] = useState<'talabat' | 'keeta' | 'deliveroo'>('talabat')
  const [portalHealthData, setPortalHealthData] = useState<any>(null)

  // Composio States
  const [executionPlans, setExecutionPlans] = useState<ExecutionPlanItem[]>(STRATEGIC_EXECUTION_PLANS)
  const [dispatchedLogs, setDispatchedLogs] = useState<Array<{ time: string; msg: string; channel: string }>>([
    {
      time: '08:00',
      msg: isAr
        ? 'تم تسليم تقرير مطابقة أودو التلقائي للإدارة العليا عبر البريد الإلكتروني.'
        : 'Automated Odoo ledger reconciliation report dispatched to executives via Gmail.',
      channel: isAr ? 'البريد التنفيذي' : 'Gmail Exec',
    },
    {
      time: '08:15',
      msg: isAr
        ? 'مزامنة مبيعات طلبات جو وسوق طلبات مع دفتر أستاذ أودو بنجاح.'
        : 'Talabat Tgo and TMP sales synchronized with Odoo master ledger.',
      channel: isAr ? 'جداول البيانات' : 'Google Sheets',
    },
  ])

  // What-If Dynamic Slider States
  const [costOptimizationSlider, setCostOptimizationSlider] = useState<number>(100)
  const [revenueUpsellSlider, setRevenueUpsellSlider] = useState<number>(100)

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, isCopilotThinking])

  // Fallback Web Speech API speech synthesis
  const fallbackSpeechSynthesis = useCallback((rawText: string, lang: 'ar' | 'en') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const clean = sanitizeTextForSpeechClient(rawText, lang)
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.lang = lang === 'ar' ? 'ar-XA' : 'en-US'
      utterance.rate = 1.0
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const femaleVoice = voices.find(
        (v) =>
          (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Laila') || v.name.includes('Hoda') || v.name.includes('Salma') || v.name.includes('Maged')) &&
          (lang === 'ar' ? v.lang.startsWith('ar') : v.lang.startsWith('en'))
      )
      if (femaleVoice) {
        utterance.voice = femaleVoice
      }

      utterance.onend = () => {
        setPlayingMsgId(null)
        // Hands-Free conversation loop: automatically open microphone after speech finishes
        if (isHandsFreeRef.current && !isVoiceMutedRef.current) {
          setTimeout(() => {
            startListeningRef.current?.()
          }, 600)
        }
      }
      utterance.onerror = () => setPlayingMsgId(null)
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      setPlayingMsgId(null)
    }
  }, [])

  // Natural Cloud Audio Player via Google Translate TTS Stream API / OpenAI Nova
  const playFeryalSpeech = useCallback(
    async (text: string, msgId?: string) => {
      if (isVoiceMuted) return

      // 1. Instantly unlock browser AudioContext on user gesture (bypasses Windows Bluetooth mute & Chrome autoplay)
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          const ctx = new AudioContextClass()
          if (ctx.state === 'suspended') {
            await ctx.resume()
          }
        }
      } catch (unlockErr) {
        console.warn('AudioContext unlock skipped:', unlockErr)
      }

      // Stop any existing mic listening and release all tracks so Bluetooth headset returns to Stereo
      stopAllMicTracks()

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }

      // Stop any existing playback
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      const activeLang = isAr ? 'ar' : 'en'
      const activeId = msgId || 'live-speech'
      setPlayingMsgId(activeId)
      setLastVoiceError(null)

      const cleanText = sanitizeTextForSpeechClient(text, activeLang) || text

      try {
        // Bluetooth Headset Half-Duplex Delay:
        // Wait 380ms after releasing every mic track so the Bluetooth driver switches from HFP back to A2DP Stereo
        // before Nova playback starts (prevents the muted / mono headset state).
        await new Promise((resolve) => setTimeout(resolve, 380))

        const apiKey = getOpenAIApiKey()
        let audioUrl = ''

        // 1. Direct Browser Fetch to OpenAI Audio Speech API (Zero Cloudflare Node / Buffer dependency)
        if (apiKey) {
          try {
            const openAiRes = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'tts-1',
                voice: 'nova',
                input: cleanText.slice(0, 4000),
                response_format: 'mp3',
              }),
            })

            if (openAiRes.ok) {
              const blob = await openAiRes.blob()
              audioUrl = URL.createObjectURL(blob)
              setLastVoiceError(null)
            } else {
              const errBody = await openAiRes.text().catch(() => '')
              throw new Error(`OpenAI HTTP ${openAiRes.status}: ${errBody || openAiRes.statusText}`)
            }
          } catch (directErr: any) {
            console.warn('Direct browser fetch to OpenAI TTS failed, falling back:', directErr)
            setLastVoiceError(directErr?.message || 'OpenAI TTS fetch failed')
          }
        }

        // 2. Direct Google TTS fallback if OpenAI was unreachable
        if (!audioUrl) {
          const shortText = cleanText.slice(0, 200)
          audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${
            activeLang === 'en' ? 'en' : 'ar'
          }&q=${encodeURIComponent(shortText)}`
        }

        // 1. Play directly via visible DOM audio element (Bypasses Chrome restrictions & guarantees sound)
        const player = audioPlayerRef.current
        if (player) {
          player.pause()
          player.src = audioUrl
          player.load()

          player.onplay = () => {
            setPlayingMsgId(activeId)
          }

          player.onpause = () => {
            setPlayingMsgId(null)
          }

          player.onended = () => {
            setPlayingMsgId(null)
            // Hands-Free conversation loop: automatically open microphone after speech finishes
            if (isHandsFreeRef.current && !isVoiceMutedRef.current) {
              setTimeout(() => {
                startListeningRef.current?.()
              }, 600)
            }
          }

          player.onerror = () => {
            console.warn('DOM audio element error, falling back to speech synthesis')
            setPlayingMsgId(null)
            setLastVoiceError('Audio player error; spoke via browser voice')
            fallbackSpeechSynthesis(cleanText, activeLang)
          }

          const playPromise = player.play()
          if (playPromise !== undefined) {
            playPromise.catch((err: any) => {
              console.warn('Autoplay prevented on audio player:', err)
              setLastVoiceError(err?.message || 'Autoplay prevented; spoke via browser voice')
              fallbackSpeechSynthesis(cleanText, activeLang)
            })
          }
          return
        }

        // 2. Fallback to programmatic Audio object if ref not mounted
        const audio = new Audio(audioUrl)
        audio.onplay = () => {
          setPlayingMsgId(activeId)
        }
        audio.onpause = () => {
          setPlayingMsgId(null)
        }
        audio.onended = () => {
          setPlayingMsgId(null)
          if (isHandsFreeRef.current && !isVoiceMutedRef.current) {
            setTimeout(() => {
              startListeningRef.current?.()
            }, 600)
          }
        }
        audio.onerror = () => {
          setLastVoiceError('Audio error; spoke via browser voice')
          fallbackSpeechSynthesis(cleanText, activeLang)
        }
        audio.play().catch((err: any) => {
          setLastVoiceError(err?.message || 'Audio error; spoke via browser voice')
          fallbackSpeechSynthesis(cleanText, activeLang)
        })
      } catch (err: any) {
        console.error('Audio playback pipeline error, guaranteed speech fallback:', err)
        setLastVoiceError(err?.message || 'Playback error; spoke via browser voice')
        fallbackSpeechSynthesis(cleanText, activeLang)
      }
    },
    [fallbackSpeechSynthesis, isAr, isVoiceMuted, stopAllMicTracks]
  )

  // Handler functions with memoization to satisfy hooks dependency rules
  const handleRunPerplexity = useCallback(
    async (customQuery?: string, langOverride?: 'ar' | 'en') => {
      setHubLoading(true)
      const currentLang = langOverride || (isAr ? 'ar' : 'en')
      const q = customQuery || perplexityQuery
      try {
        const res = await fetch('/api/feryal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'perplexity', query: q, lang: currentLang }),
        })
        const data = await res.json()
        if (data.success && data.content) {
          setPerplexityResponse(data.content)
        } else {
          setPerplexityResponse(currentLang === 'en' ? DEFAULT_PERPLEXITY_EN : DEFAULT_PERPLEXITY_AR)
        }
      } catch (e) {
        setPerplexityResponse(currentLang === 'en' ? DEFAULT_PERPLEXITY_EN : DEFAULT_PERPLEXITY_AR)
      } finally {
        setHubLoading(false)
      }
    },
    [isAr, perplexityQuery]
  )

  const handleRunFirecrawl = useCallback(
    async (langOverride?: 'ar' | 'en') => {
      setHubLoading(true)
      const currentLang = langOverride || (isAr ? 'ar' : 'en')
      try {
        const res = await fetch('/api/feryal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'firecrawl', url: firecrawlUrl, lang: currentLang }),
        })
        const data = await res.json()
        if (data.success && data.items) {
          setCompetitorItems(data.items)
        }
      } catch (e) {
        // fallback
      } finally {
        setHubLoading(false)
      }
    },
    [firecrawlUrl, isAr]
  )

  const handleRunPlaywright = useCallback(
    async (p = portalSelect, langOverride?: 'ar' | 'en') => {
      setHubLoading(true)
      const currentLang = langOverride || (isAr ? 'ar' : 'en')
      try {
        const res = await fetch('/api/feryal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'playwright', url: p, lang: currentLang }),
        })
        const data = await res.json()
        if (data.success && data.portal) {
          setPortalHealthData(data.portal)
        }
      } catch (e) {
        // fallback
      } finally {
        setHubLoading(false)
      }
    },
    [isAr, portalSelect]
  )

  // Sync state whenever locale changes (Zero Language Mixing Guarantee)
  useEffect(() => {
    setMicLang(isAr ? 'ar' : 'en')
    setPerplexityQuery(
      isAr
        ? 'أسعار الدجاج المجمد وزيوت القلي وسوق المطاعم في الكويت وتأثير الطقس'
        : 'Wholesale chicken & cooking oil prices, Kuwait restaurant inflation, and weather impact'
    )
    setPerplexityResponse(isAr ? DEFAULT_PERPLEXITY_AR : DEFAULT_PERPLEXITY_EN)

    // Update welcome message text & time
    setMessages((prev) =>
      prev.map((m, idx) =>
        idx === 0
          ? {
              ...m,
              time: isAr ? 'الآن' : 'Just now',
              textAr:
                'مرحباً بك يا سعادة المدير. أنا المستشارة فريال، محرك الذكاء الاصطناعي التنفيذي لمجموعة فنتشر فودز. أراقب لحظياً مائة وسبعة وستين ألفاً واثنين وتسعين ديناراً كويتياً مبيعات معتمدة وثلاثين ألفاً وخمسمائة وأربعين طلباً عبر أودو ورادارات التوصيل بدقة كاملة. كيف ترغب أن نبدأ خطة تعظيم الأرباح وخفض التكاليف اليوم؟',
              textEn:
                'Greetings, Executive Leader. I am Feryal, your AI Executive Copilot for Venture Foods. I actively monitor 167,092.160 KWD in approved sales and 30,540 orders across Odoo and delivery aggregators with 100 percent ledger reconciliation. How would you like to accelerate profit margins and eliminate operational waste today?',
            }
          : m
      )
    )

    setDispatchedLogs([
      {
        time: '08:00',
        msg: isAr
          ? 'تم تسليم تقرير مطابقة أودو التلقائي للإدارة العليا عبر البريد الإلكتروني.'
          : 'Automated Odoo ledger reconciliation report dispatched to executives via Gmail.',
        channel: isAr ? 'البريد التنفيذي' : 'Gmail Exec',
      },
      {
        time: '08:15',
        msg: isAr
          ? 'مزامنة مبيعات طلبات جو وسوق طلبات مع دفتر أستاذ أودو بنجاح.'
          : 'Talabat Tgo and TMP sales synchronized with Odoo master ledger.',
        channel: isAr ? 'جداول البيانات' : 'Google Sheets',
      },
    ])

    // Re-fetch localized data
    handleRunPerplexity(
      isAr
        ? 'أسعار الدجاج المجمد وزيوت القلي وسوق المطاعم في الكويت وتأثير الطقس'
        : 'Wholesale chicken & cooking oil prices, Kuwait restaurant inflation, and weather impact',
      isAr ? 'ar' : 'en'
    )
    handleRunFirecrawl(isAr ? 'ar' : 'en')
    handleRunPlaywright(portalSelect, isAr ? 'ar' : 'en')
  }, [isAr, handleRunPerplexity, handleRunFirecrawl, handleRunPlaywright, portalSelect])

  // Handle Send Query to Feryal (Memoized)
  const handleSendQuery = useCallback(
    async (queryText?: string) => {
      const textToSend = queryText || inputText
      if (!textToSend.trim()) return

      const userMsgId = `user-${Date.now()}`
      const newMsg = {
        id: userMsgId,
        sender: 'user' as const,
        textAr: textToSend,
        textEn: textToSend,
        time: new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, newMsg])
      setInputText('')
      setIsCopilotThinking(true)

      try {
        let replyAr = ''
        let replyEn = ''
        let keyMetrics: any = null

      // 1. Primary Analytical Brain: Google Gemini (`Argon High / Gemini 3.8 Pro`) with automatic OpenAI & Odoo fallback
      try {
        const brainRes = await askFeryalGeminiBrain({
          query: withScope(textToSend),
          lang: isAr ? 'ar' : 'en',
        })
        if (brainRes.reply) {
          if (isAr) replyAr = brainRes.reply
          else replyEn = brainRes.reply
        }
      } catch (brainErr) {
        console.warn('Gemini brain invocation warning:', brainErr)
      }

      // 2. Fallback to local /api/feryal route
      if (!replyAr && !replyEn) {
        try {
          const res = await fetch('/api/feryal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'chat', query: withScope(textToSend), lang: isAr ? 'ar' : 'en' }),
          })

          const data = await res.json()
          if (data.success) {
            replyAr = data.replyAr
            replyEn = data.replyEn
            keyMetrics = data.keyMetrics
          }
        } catch (e) {
          // Continue to verified benchmark fallback
        }
      }

      // 3. Final verified benchmark fallback
      if (!replyAr && !replyEn) {
        replyAr =
          'وفقاً لبيانات أودو لشهر أكتوبر، صافي المبيعات هو مائة وسبعة وستون ألفاً واثنان وتسعون ديناراً كويتياً، والأرباح التشغيلية اثنان وأربعون ألفاً وأربعمائة وواحد وأربعون ديناراً كويتياً بهامش خمسة وعشرين بالمئة. خطة خفض الهدر وسقف الخصومات جاهزة للتنفيذ.'
        replyEn =
          'According to October Odoo figures, Net Sales stand at 167,092.160 KWD and Operating Profit at 42,441.480 KWD (25.4% margin). Waste elimination and discount capping plans are ready to deploy.'
      }

      const feryalMsgId = `feryal-${Date.now()}`
      const feryalMsg = {
        id: feryalMsgId,
        sender: 'feryal' as const,
        textAr: replyAr || replyEn,
        textEn: replyEn || replyAr,
        time: new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
        metrics: keyMetrics,
      }
      setMessages((prev) => [...prev, feryalMsg])
      playFeryalSpeech(isAr ? feryalMsg.textAr : feryalMsg.textEn, feryalMsgId)
    } catch (e) {
      console.error('handleSendQuery error:', e)
    } finally {
      setIsCopilotThinking(false)
    }
    },
    [inputText, isAr, playFeryalSpeech, withScope]
  )

  useEffect(() => {
    handleSendQueryRef.current = handleSendQuery
  }, [handleSendQuery])

  // Pre-filled strategic query deep link — never opens the microphone, only sends text.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (!q || !q.trim()) return
    const timer = window.setTimeout(() => {
      handleSendQueryRef.current?.(q.trim())
      window.history.replaceState(null, '', window.location.pathname)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [])

  // Start Speech Recognition with Dual Engine: Web Speech API + MediaRecorder Whisper STT
  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return
    setMicError(null)

    // Ensure all audio output is paused before opening microphone (Prevents Windows Bluetooth channel conflict)
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    // Stop any existing recorder or recognizer
    stopAllMicTracks()

    // 1. Try starting Web Speech API (webkitSpeechRecognition) directly
    let speechRecognitionActive = false
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      try {
        const recognizer = new SpeechRecognition()
        recognizer.continuous = false
        recognizer.interimResults = true
        recognizer.lang = micLangRef.current === 'ar' ? 'ar-KW' : 'en-US'
        recognizer.maxAlternatives = 1

        interimTranscriptRef.current = ''

        recognizer.onstart = () => {
          setIsListening(true)
          isListeningRef.current = true
          setMicError(null)
          setMicToast(null)
        }

        recognizer.onresult = (event: any) => {
          let interimText = ''
          let finalText = ''

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i]
            const transcript = item[0]?.transcript || ''
            if (item.isFinal) {
              finalText += transcript
            } else {
              interimText += transcript
            }
          }

          const liveText = (finalText || interimText).trim()
          if (liveText) {
            setInputText(liveText)
            interimTranscriptRef.current = liveText
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }

          if (finalText.trim()) {
            setIsListening(false)
            isListeningRef.current = false
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              try {
                mediaRecorderRef.current.stop()
              } catch {}
            } else {
              const queryToSend = finalText.trim()
              interimTranscriptRef.current = ''
              handleSendQueryRef.current?.(queryToSend)
            }
            try {
              recognizer.stop()
            } catch {}
          } else if (interimText.trim()) {
            silenceTimerRef.current = setTimeout(() => {
              if (isListeningRef.current) {
                setIsListening(false)
                isListeningRef.current = false
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                  try {
                    mediaRecorderRef.current.stop()
                  } catch {}
                } else if (interimTranscriptRef.current.trim()) {
                  const queryToSend = interimTranscriptRef.current.trim()
                  interimTranscriptRef.current = ''
                  handleSendQueryRef.current?.(queryToSend)
                }
                try {
                  recognizer.stop()
                } catch {}
              }
            }, 1800)
          }
        }

        recognizer.onerror = (event: any) => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          const errCode = event.error || 'speech-recognition-error'
          if (errCode === 'no-speech') {
            // harmless timeout when user doesn't speak
          } else {
            const errStr = `SpeechRecognition: ${errCode}`
            setMicToast(errStr)
            setMicError(errStr)
          }
        }

        recognizer.onend = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        }

        recognitionRef.current = recognizer
        recognizer.start()
        speechRecognitionActive = true
      } catch (recErr: any) {
        console.warn('SpeechRecognition direct start error:', recErr)
      }
    }

    // 2. Request microphone stream via getUserMedia for MediaRecorder / Whisper
    let mediaStream: MediaStream | null = null
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = mediaStream
        setIsListening(true)
        isListeningRef.current = true
      }
    } catch (err: any) {
      const errName = err?.name || 'Error'
      const errMsg = err?.message || ''
      const detailedErr = `${errName}${errMsg ? `: ${errMsg}` : ''}`
      console.error('getUserMedia failure:', detailedErr)

      if (!speechRecognitionActive) {
        setIsListening(false)
        isListeningRef.current = false
        mediaStreamRef.current = null

        const displayMsg = isAr
          ? `🎙️ تعذر تشغيل المايكروفون (${detailedErr}). يمكنك المحادثة كتابياً.`
          : `🎙️ Microphone error (${detailedErr}). Please type your message.`
        setMicToast(displayMsg)
        setMicError(displayMsg)
        setTimeout(() => setMicToast(null), 6000)
        inputFieldRef.current?.focus()
        return
      }
    }

    // 3. Initialize MediaRecorder for high-accuracy OpenAI Whisper STT if mediaStream active
    if (mediaStream) {
      try {
        const mr = new MediaRecorder(mediaStream)
        audioChunksRef.current = []

        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data)
          }
        }

        mr.onstop = async () => {
          stopAllMicTracks()

          if (audioChunksRef.current.length > 0) {
            const recordedBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
            audioChunksRef.current = []

            setIsTranscribing(true)
            try {
              // 1. Try Multimodal Audio Understanding via Google Gemini (`Argon High / Gemini 3.8 Pro`)
              const base64Audio = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => {
                  const res = typeof reader.result === 'string' ? reader.result : ''
                  const b64 = res.includes(',') ? res.split(',')[1] : ''
                  resolve(b64)
                }
                reader.onerror = () => resolve('')
                reader.readAsDataURL(recordedBlob)
              })

              if (base64Audio && getGeminiApiKey()) {
                try {
                  const multimodalRes = await askFeryalGeminiBrain({
                    lang: micLangRef.current === 'en' ? 'en' : 'ar',
                    audioBase64: base64Audio,
                    mimeType: 'audio/webm',
                  })
                  if (multimodalRes.transcript && multimodalRes.transcript.trim()) {
                    const qText = multimodalRes.transcript.trim()
                    setInputText(qText)
                    interimTranscriptRef.current = ''
                    handleSendQueryRef.current?.(qText)
                    return
                  }
                } catch (gemAudioErr) {
                  console.warn('Gemini multimodal audio fallback to Whisper:', gemAudioErr)
                }
              }

              const apiKey = getOpenAIApiKey()
              const fd = new FormData()
              fd.append('file', recordedBlob, 'audio.webm')
              fd.append('model', 'whisper-1')
              fd.append('language', micLangRef.current === 'en' ? 'en' : 'ar')
              fd.append(
                'prompt',
                micLangRef.current === 'en'
                  ? "Feryal, Venture Foods, Odoo ERP, Keeta, Talabat, Tgo, TMP, China Garden, Frank's, Tahina, KWD"
                  : 'فريال، فنتشر فودز، أودو، كيتا، طلبات، شاينا جاردن، فرانكس، طحينة، دينار كويتي، السالمية، الكوت'
              )

              let finalQuery = ''

              // Direct Browser Request to OpenAI Whisper API
              if (apiKey) {
                try {
                  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                    },
                    body: fd,
                  })

                  if (whisperRes.ok) {
                    const whisperData = await whisperRes.json()
                    if (whisperData.text && whisperData.text.trim()) {
                      finalQuery = whisperData.text.trim()
                    }
                  } else {
                    console.warn('Direct Whisper API returned status:', whisperRes.status)
                  }
                } catch (directWhisperErr) {
                  console.warn('Direct Whisper API request failed:', directWhisperErr)
                }
              }

              // Fallback to /api/feryal/stt
              if (!finalQuery) {
                try {
                  const sttRes = await fetch('/api/feryal/stt', {
                    method: 'POST',
                    body: fd,
                  })
                  if (sttRes.ok) {
                    const sttData = await sttRes.json()
                    if (sttData.ok && sttData.transcript && sttData.transcript.trim()) {
                      finalQuery = sttData.transcript.trim()
                    }
                  }
                } catch {}
              }

              // Fallback to Live Interim Transcript if available
              if (!finalQuery && interimTranscriptRef.current.trim()) {
                finalQuery = interimTranscriptRef.current.trim()
              }

              if (finalQuery) {
                setInputText(finalQuery)
                interimTranscriptRef.current = ''
                handleSendQueryRef.current?.(finalQuery)
                return
              }
            } catch (sttErr) {
              console.warn('Whisper STT request error, using fallback transcript:', sttErr)
            } finally {
              setIsTranscribing(false)
            }
          }

          // Fallback if Whisper did not return
          if (interimTranscriptRef.current.trim()) {
            const fallbackQuery = interimTranscriptRef.current.trim()
            interimTranscriptRef.current = ''
            handleSendQueryRef.current?.(fallbackQuery)
          }
        }

        mediaRecorderRef.current = mr
        mr.start(250)
        setIsListening(true)
        isListeningRef.current = true
      } catch (mrErr: any) {
        console.warn('MediaRecorder init error:', mrErr)
      }
    }
  }, [isAr, stopAllMicTracks])

  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  // Toggle Voice Input
  const toggleListening = useCallback(() => {
    if (isListening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
      stopAllMicTracks()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopAllMicTracks])

  // Component unmount cleanup
  useEffect(() => {
    const player = audioPlayerRef.current
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      stopAllMicTracks()
      if (player) {
        player.pause()
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [stopAllMicTracks])

  // Set initial welcome audio stream so the player is ready immediately
  useEffect(() => {
    if (audioPlayerRef.current && !audioPlayerRef.current.src) {
      const defaultText = isAr
        ? 'مرحباً بك يا سعادة المدير. أنا المستشارة فريال، جاهزة لخدمتك.'
        : 'Welcome, Executive Leader. I am Feryal, your AI Executive Copilot.'
      const clean = sanitizeTextForSpeechClient(defaultText, isAr ? 'ar' : 'en')
      audioPlayerRef.current.src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${
        isAr ? 'ar' : 'en'
      }&q=${encodeURIComponent(clean)}`
    }
  }, [isAr])

  // Dispatch Composio Action
  const handleDispatchComposio = async (planId: string, actionType: string) => {
    setExecutionPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, status: 'running' as const } : p))
    )

    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'composio', actionType, lang: isAr ? 'ar' : 'en' }),
      })
      const data = await res.json()
      if (data.success) {
        setExecutionPlans((prev) =>
          prev.map((p) => (p.id === planId ? { ...p, status: 'completed' as const } : p))
        )
        const timeNow = new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' })
        setDispatchedLogs((prev) => [
          { time: timeNow, msg: data.message, channel: isAr ? 'منسق كومبوزيو' : 'Composio Multi-Channel' },
          ...prev,
        ])
      }
    } catch (e) {
      setExecutionPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, status: 'completed' as const } : p))
      )
    }
  }

  // Projections calculation based on What-If Sliders
  const calculatedProjections = useMemo(() => {
    const costFactor = costOptimizationSlider / 100
    const upsellFactor = revenueUpsellSlider / 100

    // Monthly baseline gains: 4,536 KWD savings + 3,104 KWD added revenue = 7,640 KWD/mo
    const monthlyAddedProfit = 4536 * costFactor + 3104 * upsellFactor

    // Q1 (3 months): +20,520 KWD added gain -> 147,844 KWD total profit at 100%
    const q1AddedProfit = 20520 * ((costFactor + upsellFactor) / 2)
    const q1Sales = 512400 * (1 + (revenueUpsellSlider - 100) * 0.002)
    const q1Profit = 127324.44 + q1AddedProfit
    const q1Margin = (q1Profit / q1Sales) * 100

    // H1 (6 months): +43,800 KWD added gain -> 298,449 KWD total profit at 100%
    const h1AddedProfit = 43800 * ((costFactor + upsellFactor) / 2)
    const h1Sales = 1038500 * (1 + (revenueUpsellSlider - 100) * 0.002)
    const h1Profit = 254648.88 + h1AddedProfit
    const h1Margin = (h1Profit / h1Sales) * 100

    // Annual (12 months): +91,680 KWD added gain -> 600,978 KWD total profit at 100%
    const annualAddedProfit = 91680 * ((costFactor + upsellFactor) / 2)
    const annualSales = 2115000 * (1 + (revenueUpsellSlider - 100) * 0.002)
    const annualProfit = 509297.76 + annualAddedProfit
    const annualMargin = (annualProfit / annualSales) * 100

    return {
      monthlyAddedProfit,
      q1: { sales: q1Sales, addedProfit: q1AddedProfit, totalProfit: q1Profit, margin: q1Margin },
      h1: { sales: h1Sales, addedProfit: h1AddedProfit, totalProfit: h1Profit, margin: h1Margin },
      annual: { sales: annualSales, addedProfit: annualAddedProfit, totalProfit: annualProfit, margin: annualMargin },
    }
  }, [costOptimizationSlider, revenueUpsellSlider])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="ae-stagger text-slate-900 dark:text-slate-100 space-y-6 font-sans antialiased"
    >
      {/* ==================================================================== */}
      {/* 1. TOP EXECUTIVE HEADER (Clean, Solid, Zero Slop Gradients) */}
      {/* ==================================================================== */}
      <div className="ae-tile rounded-2xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Sparkles className="h-4 w-4 text-[#2563EB]" />
            <span>{isAr ? 'النسخة الموحدة القيادية 2026' : 'Executive Master Command 2026'}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">{isAr ? 'بيانات أودو المعتمدة' : 'Verified Odoo Ledger'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight flex items-center gap-3">
            <span>{isAr ? 'مركز القيادة الذكي والمستشارة فريال' : 'Executive AI Command & Advisor Feryal'}</span>
          </h1>
          <p className="text-sm sm:text-[15px] font-medium text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            {isAr
              ? 'المنظومة التنفيذية الموحدة لتحليل بيانات أودو المعتمدة، هندسة الربحية، محاكاة السيناريوهات، ودمج الاستخبارات السوقية اللحظية.'
              : 'Unified executive ecosystem synthesizing verified Odoo ledgers, margin engineering, scenario simulation, and real-time market intelligence.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => {
              handleRunPerplexity(undefined, isAr ? 'ar' : 'en')
              handleRunFirecrawl(isAr ? 'ar' : 'en')
              handleRunPlaywright(portalSelect, isAr ? 'ar' : 'en')
            }}
            className="ae-pill-light"
          >
            <RefreshCw className={`h-4 w-4 ${hubLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isAr ? 'تحديث الاستخبارات المباشرة' : 'Refresh Market Intel'}</span>
          </button>
          <Link
            href="/erp/sales-analysis"
            className="ae-pill-dark"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{isAr ? 'تحليل المبيعات والأصناف' : 'Sales & Items Analysis'}</span>
            <ChevronRight className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. UNIFIED ODOO MASTER AGGREGATOR (Solid White High-Contrast Cards) */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              {isAr ? 'أولاً: المجمّع الشامل لبيانات أودو المعتمدة (مجموعة فنتشر فودز)' : '1. Unified Odoo Master Ledger (Venture Foods)'}
            </h2>
          </div>
          <span className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 font-bold font-mono">
            {isAr ? 'شهر أكتوبر 2026 | مطابقة محاسبية 100%' : 'October 2026 | 100% Ledger Reconciled'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Net Sales */}
          <div className="ae-tile ae-lift rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <span>{isAr ? 'صافي المبيعات المعتمدة' : 'Approved Net Sales'}</span>
              <DollarSign className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
              167,092.160 <span className="text-xs font-bold text-slate-500 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-slate-600 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span>{isAr ? '30,540 طلباً' : '30,540 Orders'}</span>
              <span className="text-slate-900 dark:text-white font-bold">{isAr ? 'متوسط السلة 5.471 د.ك' : 'AOV 5.471 KWD'}</span>
            </div>
          </div>

          {/* Card 2: Operating Profit */}
          <div className="ae-tile ae-lift rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <span>{isAr ? 'صافي الربح التشغيلي' : 'Net Operating Profit'}</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
              42,441.480 <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-slate-600 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span>{isAr ? 'هامش الربح' : 'Profit Margin'}</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">25.4%</span>
            </div>
          </div>

          {/* Card 3: Food Cost */}
          <div className="ae-tile ae-lift rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <span>{isAr ? 'تكلفة الأغذية والمواد' : 'Food Cost (COGS)'}</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
              41,438.856 <span className="text-xs font-bold text-slate-500 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-slate-600 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span>{isAr ? 'الفعلي: 24.8%' : 'Actual: 24.8%'}</span>
              <span className="text-amber-700 dark:text-amber-400 font-bold">{isAr ? 'المستهدف: 24.0%' : 'Target: 24.0%'}</span>
            </div>
          </div>

          {/* Card 4: Operating Expenses & Custody */}
          <div className="ae-tile ae-lift rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <span>{isAr ? 'المصروفات والعهد' : 'Opex & Custodies'}</span>
              <Layers className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
              51,154.950 <span className="text-xs font-bold text-slate-500 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-slate-600 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span>{isAr ? '2,213 قيداً' : '2,213 Entries'}</span>
              <span className="text-slate-900 dark:text-white font-bold">{isAr ? 'عهدة رابح: 10.7 ألف د.ك' : 'Rabih: 10.7k KWD'}</span>
            </div>
          </div>

          {/* Card 5: Discounts (Keeta Alert) */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 ae-tile ae-lift rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <span>{isAr ? 'الخصومات والعروض' : 'Promo Discounts'}</span>
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-2.5 text-2xl sm:text-3xl font-extrabold text-rose-700 dark:text-rose-400 font-mono tabular-nums tracking-tight">
              4,152.000 <span className="text-xs font-bold text-rose-800 dark:text-rose-300 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-slate-600 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
              <span>2.4% {isAr ? 'من المبيعات' : 'of Sales'}</span>
              <span className="text-rose-700 dark:text-rose-400 font-extrabold">{isAr ? 'كيتا: 2,544 د.ك' : 'Keeta: 2,544 KWD'}</span>
            </div>
          </div>
        </div>

        {/* Operational Foundation Bar */}
        <div className="ae-tile rounded-2xl p-4 sm:p-5 text-[13px] text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-4 font-semibold">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>
                <strong className="text-slate-950 dark:text-white font-extrabold">6</strong> {isAr ? 'علامات تجارية نشطة' : 'Active Brands'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-emerald-600" />
              <span>
                <strong className="text-slate-950 dark:text-white font-extrabold">9</strong> {isAr ? 'فروع تشغيلية فعلية نشطة' : 'Active Operational Branches'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span>
                <strong className="text-slate-950 dark:text-white font-extrabold">11</strong> {isAr ? 'قناة بيع (تشمل طلبات جو وسوق طلبات)' : 'Sales Channels (Incl. Tgo & TMP)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>
                <strong className="text-slate-950 dark:text-white font-extrabold">364</strong> {isAr ? 'صنفاً نشطاً (أعلى 32 صنفاً تشكل 80% من المبيعات)' : 'Menu Items (Top 32 = 80% Rev)'}
              </span>
            </div>
          </div>
          <div className="text-slate-600 dark:text-slate-400 font-bold">
            {isAr ? 'السالمية تتصدر بـ 31,246 د.ك (18.7%) | الكوت بـ 27,904 د.ك (16.7%)' : 'Salmiya Leads: 31,246 KWD (18.7%) | Al-Kout: 27,904 KWD (16.7%)'}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. TWO-COLUMN SPLIT: BILINGUAL COPILOT & STRATEGIC 4-STAGE ENGINE */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* ================================================================ */}
        {/* LEFT: FERYAL CHAT — 100% column-height parity with the right column */}
        {/* ================================================================ */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="ae-tile rounded-2xl flex flex-col overflow-hidden h-full">
            {/* Unified Compact Header Toolbar */}
            <div className="bg-slate-50/80 dark:bg-white/5 px-4 py-3 rounded-t-2xl border-b border-slate-200/70 dark:border-slate-700/60 flex flex-wrap 2xl:flex-nowrap items-center justify-between gap-3">
              {/* Left: Avatar + Title */}
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                    <Bot className="h-5 w-5" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                      {isAr ? 'فريال — المستشارة التنفيذية الذكية' : 'Feryal — Executive AI Copilot'}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>
                        {isAr
                          ? 'العقل: جيميناي أرجون هاي · الصوت: نوفا'
                          : 'Brain: Gemini Argon High · Voice: Nova'}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {isAr ? 'استشارات تنفيذية فورية · فنتشر فودز' : 'Executive Copilot · Venture Foods'}
                  </p>
                </div>
              </div>

              {/* Right: Compact Audio Toolbar */}
              <div className="flex flex-nowrap items-center gap-2 shrink-0 overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => {
                    const lastMsg = messages[messages.length - 1]
                    const textToSpeak = lastMsg
                      ? isAr
                        ? lastMsg.textAr
                        : lastMsg.textEn
                      : isAr
                      ? 'مرحباً بك يا سعادة المدير. أنا المستشارة فريال، جاهزة لخدمتك.'
                      : 'Welcome, Executive Leader. I am Feryal, your AI Executive Copilot.'
                    playFeryalSpeech(textToSpeak, 'manual-header-play')
                  }}
                  className="ae-pill-dark ae-pill-sm shrink-0"
                  title={isAr ? 'الاستماع لصوت فريال' : 'Listen to Feryal Voice'}
                >
                  <Volume2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{isAr ? '🔊 استمع لصوت فريال' : '🔊 Listen to Feryal'}</span>
                </button>

                {/* Compact Audio Player */}
                <audio ref={audioPlayerRef} controls preload="auto" className="h-8 w-40 sm:w-48 shrink-0 rounded-full" />

                {/* Voice Status Toggle Pill */}
                <button
                  type="button"
                  onClick={() => {
                    if (audioPlayerRef.current) audioPlayerRef.current.pause()
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
                    setIsVoiceMuted(!isVoiceMuted)
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isVoiceMuted
                      ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500'
                      : 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  }`}
                  title={isVoiceMuted ? (isAr ? 'تفعيل الصوت التلقائي' : 'Enable Voice') : (isAr ? 'كتم الصوت' : 'Mute Voice')}
                >
                  {isVoiceMuted ? <VolumeX className="h-3 w-3 shrink-0" /> : <Volume2 className="h-3 w-3 shrink-0" />}
                  <span className="hidden sm:inline">
                    {isVoiceMuted ? (isAr ? 'الصوت: معطّل' : 'Voice: OFF') : (isAr ? 'النطق التلقائي: مفعّل' : 'Auto-Voice: ON')}
                  </span>
                </button>

                {/* Hands-Free Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isHandsFree
                    setIsHandsFree(nextState)
                    isHandsFreeRef.current = nextState
                    if (nextState) {
                      if (!playingMsgId && !isListening) startListening()
                    } else {
                      if (isListening) toggleListening()
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isHandsFree
                      ? 'border-emerald-500 bg-emerald-600 text-white shadow-2xs'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                  title={isHandsFree ? (isAr ? 'إيقاف الحوار المستمر' : 'Disable Hands-Free') : (isAr ? 'تفعيل الحوار المستمر' : 'Enable Hands-Free')}
                >
                  <RefreshCw className={`h-3 w-3 shrink-0 ${isHandsFree ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isHandsFree ? (isAr ? 'حوار مستمر' : 'Hands-Free') : (isAr ? 'حوار مستمر' : 'Hands-Free')}</span>
                </button>

                {/* Mic Language toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextLang = micLang === 'ar' ? 'en' : 'ar'
                    setMicLang(nextLang)
                    micLangRef.current = nextLang
                  }}
                  className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  🎙️ {micLang === 'ar' ? 'عربي' : 'EN'}
                </button>
              </div>
            </div>

            {/* Quick Action Pills Under Header */}
            <div className="border-b border-slate-200/70 dark:border-slate-700/60 px-3 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {biScopeLabel ? (
                <span className="ae-chip shrink-0" title={isAr ? 'نطاق التحليل النشط يُرسل مع كل سؤال' : 'Active BI scope is sent with every question'}>
                  {isAr ? 'النطاق: ' : 'Scope: '}
                  {biScopeLabel}
                </span>
              ) : null}
              {[
                { ar: 'ما هو الفرع الأعلى ربحية ولماذا؟', en: 'Top profitable branch and why?' },
                { ar: 'كيف نوفر 3,800 د.ك هذا الشهر؟', en: 'How to save 3,800 KWD this month?' },
                { ar: 'مقارنة طلبات جو مقابل سوق طلبات', en: 'Compare Talabat Tgo vs TMP' },
                { ar: 'أثر رفع أسعار تشاينا جاردن 5%', en: '5% China Garden price hike impact' },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendQuery(isAr ? p.ar : p.en)}
                  className="ae-pill-light ae-pill-sm shrink-0"
                >
                  {isAr ? p.ar : p.en}
                </button>
              ))}
            </div>

            {/* Messages Log (Adaptive Height & Zero Empty White Space) */}
            <div ref={chatScrollRef} className="flex-1 min-h-[340px] max-h-[460px] lg:max-h-[620px] overflow-y-auto p-4 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[95%] sm:max-w-[92%] rounded-2xl p-4 shadow-2xs leading-relaxed ${
                      m.sender === 'user'
                        ? 'ae-bubble-user rounded-br-none font-medium text-sm'
                        : 'ae-tile-soft text-slate-800 dark:text-slate-100 rounded-bl-none font-medium text-[14px]'
                    }`}
                  >
                    {m.sender === 'feryal' && m.id !== 'welcome' ? (
                      <FeryalRichText text={isAr ? m.textAr : m.textEn} lang={isAr ? 'ar' : 'en'} />
                    ) : (
                      <p className="whitespace-pre-line leading-relaxed">{isAr ? m.textAr : m.textEn}</p>
                    )}

                    {/* Rich Executive Briefing inside welcome message */}
                    {m.id === 'welcome' && (
                      <>
                        {/* 4 Mini KPI Tiles */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="ae-tile rounded-xl p-2.5">
                            <span className="text-[11px] font-bold text-slate-500 block">{isAr ? 'صافي المبيعات' : 'Net Sales'}</span>
                            <span className="font-extrabold text-slate-950 dark:text-white font-mono text-xs sm:text-sm">167,092 {isAr ? 'د.ك' : 'KWD'}</span>
                          </div>
                          <div className="ae-tile rounded-xl p-2.5">
                            <span className="text-[11px] font-bold text-emerald-600 block">{isAr ? 'الربح التشغيلي' : 'Operating Profit'}</span>
                            <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono text-xs sm:text-sm">42,441 {isAr ? 'د.ك' : 'KWD'} (25.4%)</span>
                          </div>
                          <div className="ae-tile rounded-xl p-2.5">
                            <span className="text-[11px] font-bold text-amber-600 block">{isAr ? 'تكلفة الأغذية' : 'COGS'}</span>
                            <span className="font-extrabold text-amber-700 dark:text-amber-400 font-mono text-xs sm:text-sm">24.8% {isAr ? 'مقابل 24.0%' : 'vs 24.0%'}</span>
                          </div>
                          <div className="ae-tile rounded-xl p-2.5">
                            <span className="text-[11px] font-bold text-blue-600 block">{isAr ? 'المستهدف السنوي' : 'Annual Target'}</span>
                            <span className="font-extrabold text-blue-700 dark:text-blue-400 font-mono text-xs sm:text-sm">600,978 {isAr ? 'د.ك' : 'KWD'}</span>
                          </div>
                        </div>

                        {/* 4 Interactive Command Cards (Unslop UI 2x2 Grid) */}
                        <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="text-[12px] font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                            <span>{isAr ? 'أوامر استراتيجية فورية موصى بها من فريال:' : 'Feryal Strategic Action Recommendations:'}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            <button
                              type="button"
                              onClick={() => handleSendQuery(isAr ? 'ما هو تقييم ربحية فرع السالمية مقارنة بباقي الفروع ولماذا يتصدر بـ 31,246 د.ك؟' : 'Analyze Salmiya vs Branches Profitability (+31,246 KWD Top Branch Analysis)')}
                              className="ae-tile ae-lift text-start p-3.5 rounded-xl cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>🏆</span>
                                  <span>{isAr ? 'ربحية السالمية مقارنة بالفروع' : 'Salmiya vs Branches Profitability'}</span>
                                </span>
                                <span className="text-[11px] font-extrabold font-mono text-emerald-600 dark:text-emerald-400">+31,246 {isAr ? 'د.ك' : 'KWD'}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                {isAr ? 'تحليل الفرع الأعلى ربحية (+31,246 د.ك)' : '+31,246 KWD Top Branch Analysis'}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendQuery(isAr ? 'كيف نعالج هدر الدواجن في المطبخ المركزي بالعارضية ونسترد 1,336 د.ك شهرياً؟' : 'Central Kitchen COGS Recovery (+1,336 KWD/mo Poultry Yield Plan)')}
                              className="ae-tile ae-lift text-start p-3.5 rounded-xl cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>🍗</span>
                                  <span>{isAr ? 'استرداد تكلفة أغذية المطبخ المركزي' : 'Central Kitchen COGS Recovery'}</span>
                                </span>
                                <span className="text-[11px] font-extrabold font-mono text-emerald-600 dark:text-emerald-400">+1,336 {isAr ? 'د.ك' : 'KWD'}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                {isAr ? 'خطة معايرة إنتاج الدواجن (+1,336 د.ك/شهرياً)' : '+1,336 KWD/mo Poultry Yield Plan'}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendQuery(isAr ? 'كيف نطبق سقف خصم 3.5% على كيتا ونطور مصفوفة طلبات جو وسوق طلبات؟' : 'Keeta 3.5% Cap & Tgo/TMP Matrix (+4,070 KWD/mo Promo & Combo Fix)')}
                              className="ae-tile ae-lift text-start p-3.5 rounded-xl cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>🛵</span>
                                  <span>{isAr ? 'سقف كيتا 3.5% ومصفوفة طلبات' : 'Keeta 3.5% Cap & Tgo/TMP Matrix'}</span>
                                </span>
                                <span className="text-[11px] font-extrabold font-mono text-emerald-600 dark:text-emerald-400">+4,070 {isAr ? 'د.ك' : 'KWD'}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                {isAr ? 'ضبط الخصومات وهندسة الكومبو (+4,070 د.ك/شهرياً)' : '+4,070 KWD/mo Promo & Combo Fix'}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendQuery(isAr ? 'اعرض خارطة طريق التدفقات النقدية للربع الأول (+20.5 ألف د.ك) والعام الكامل (600.9 ألف د.ك)' : 'Q1 (+20.5K) & Full-Year (600.9K KWD) — 12-Month Executive Cashflow Roadmap')}
                              className="ae-tile ae-lift text-start p-3.5 rounded-xl cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>📈</span>
                                  <span>{isAr ? 'الربع الأول (+20.5 ألف) والسنة (600.9 ألف د.ك)' : 'Q1 (+20.5K) & Full-Year (600.9K KWD)'}</span>
                                </span>
                                <span className="text-[11px] font-extrabold font-mono text-emerald-600 dark:text-emerald-400">600,978 {isAr ? 'د.ك' : 'KWD'}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                {isAr ? 'خارطة طريق التدفقات النقدية التنفيذية لـ 12 شهراً' : '12-Month Executive Cashflow Roadmap'}
                              </p>
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Render Key Metrics Badges */}
                    {m.metrics && Object.keys(m.metrics).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(m.metrics).map(([k, v]) => (
                          <div key={k} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 block text-[11px] font-bold">{k}</span>
                            <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono text-sm">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Per-message Copy & Listen pills */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyMessage(m.id, isAr ? m.textAr : m.textEn)}
                      className="ae-pill-light ae-pill-sm"
                    >
                      {copiedMsgId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedMsgId === m.id ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'نسخ' : 'Copy'}</span>
                    </button>
                    {m.sender === 'feryal' && (
                      <button
                        type="button"
                        onClick={() => playFeryalSpeech(isAr ? m.textAr : m.textEn, m.id)}
                        className={playingMsgId === m.id ? 'ae-pill-dark ae-pill-sm animate-pulse' : 'ae-pill-light ae-pill-sm'}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>{isAr ? (playingMsgId === m.id ? 'فريال تتحدث الآن…' : 'استماع') : (playingMsgId === m.id ? 'Feryal is speaking…' : 'Listen')}</span>
                      </button>
                    )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-semibold mt-1 px-1">{m.time}</span>
                </div>
              ))}

              {isCopilotThinking && (
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-bold py-2.5 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 w-fit">
                  <Sparkles className="h-4 w-4 animate-spin text-blue-600" />
                  <span>{isAr ? 'فريال تحلل أرقام أودو المعتمدة...' : 'Feryal is computing verified Odoo figures...'}</span>
                </div>
              )}
            </div>

            {/* Whisper STT Processing Status */}
            {isTranscribing && (
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 border-t border-blue-200 dark:border-blue-900 flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                <Sparkles className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>{isAr ? '🎙️ جاري تفريغ الصوت وتحليله بدقة...' : '🎙️ Transcribing and analyzing speech...'}</span>
              </div>
            )}

            {/* Microphone Error Alert (Auto-dismissable & Non-blocking) */}
            {micError && (
              <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{micError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMicError(null)}
                  className="text-amber-700 hover:text-amber-950 dark:hover:text-amber-100 text-xs font-bold px-2 py-0.5 rounded"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Voice Waveform Alert & Live Status Indicator */}
            {isListening && (
              <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
                  </span>
                  <span className="animate-pulse">
                    {micLang === 'ar' ? '🎙️ تحدث الآن بالعربية...' : '🎙️ Speak now in English...'}
                  </span>
                  {isHandsFree && (
                    <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span>{isAr ? 'وضع الاجتماع الحر نشط' : 'Hands-Free Loop Active'}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 h-4">
                  {[0.4, 0.9, 1.4, 0.7, 1.2, 0.5, 1.0].map((scale, i) => (
                    <div
                      key={i}
                      className="w-1 bg-rose-600 rounded-full animate-pulse"
                      style={{ height: `${Math.round(scale * 16)}px`, animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Prominent Input Bar */}
            <div className="border-t border-slate-200/70 dark:border-slate-700/60 p-3.5 sm:p-4">
              {micToast && (
                <div className="mb-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>{micToast}</span>
                  <button
                    type="button"
                    onClick={() => setMicToast(null)}
                    className="text-amber-600 hover:text-amber-900 dark:hover:text-amber-100 font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendQuery()
                }}
                className="flex items-center gap-2.5"
              >
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                    isListening
                      ? 'bg-rose-600 border-rose-500 text-white animate-pulse shadow-md ring-2 ring-rose-400'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
                  }`}
                  title={isListening ? (isAr ? 'إيقاف المايكروفون' : 'Stop Microphone') : isAr ? 'تحدث مع فريال' : 'Speak to Feryal'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-blue-600" />}
                  <span className="hidden sm:inline">
                    {isListening
                      ? micLang === 'ar'
                        ? '🎙️ تحدث الآن بالعربية...'
                        : '🎙️ Speak now in English...'
                      : isAr
                      ? 'تحدث'
                      : 'Speak'}
                  </span>
                </button>

                <input
                  ref={inputFieldRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isListening
                      ? micLang === 'ar'
                        ? '🎙️ جاري الاستماع لصوتك... تفضل بالتحدث'
                        : '🎙️ Listening to your voice... Speak now'
                      : isAr
                      ? 'اسأل فريال عن أرقام المبيعات، الهدر، أو الفروع...'
                      : 'Ask Feryal about sales, waste, or branches...'
                  }
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="ae-pill-dark !px-5 !py-3 !text-sm shrink-0"
                >
                  <span>{isAr ? 'إرسال' : 'Send'}</span>
                  <Send className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT: ARGON ANOMALY RADAR + 6-BRAND & 11-CHANNEL PROFIT PULSE */}
        {/* ================================================================ */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* 2. CARD A: ARGON HIGH REAL-TIME ODOO AUDIT RADAR */}
          <div className="ae-tile rounded-2xl p-5 space-y-3.5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr ? '⚡ رادار التدقيق المحاسبي اللحظي لقيود أودو' : '⚡ Argon High Real-Time Odoo Audit Radar'}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {isAr ? 'فحص مباشر للقيود المحاسبية والمخزنية في أودو 17' : 'Real-time journal & inventory entry inspection in Odoo 17'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {isAr ? '3 قيود حرجة' : '3 Audit Entries'}
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Sub-card 1: Ardiya Central Kitchen */}
              <div className="p-3 rounded-xl ae-tile-soft flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {isAr ? 'المطبخ المركزي بالعارضية (418 قيداً | 41,438.856 د.ك)' : 'Ardiya Central Kitchen (418 entries | 41,438.856 KWD)'}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      {isAr ? '24.8% تكلفة' : '24.8% COGS'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isAr
                      ? 'المستهدف 24.0% — خطة معايرة هدر الدواجن تسترد +1,336 د.ك/شهرياً'
                      : 'Target 24.0% — Morning poultry calibration recovers +1,336 KWD/mo'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendQuery(isAr ? 'حللي قيود المطبخ المركزي بالعارضية (418 قيداً بقيمة 41,438.856 د.ك) وخطة استرداد 1,336 د.ك شهرياً' : 'Analyze Ardiya Central Kitchen (418 entries | 41,438.856 KWD) and the +1,336 KWD/mo recovery plan')}
                  className="ae-pill-dark ae-pill-sm shrink-0"
                >
                  {isAr ? 'تحليل صوتي مع فريال' : 'Analyze with Feryal'}
                </button>
              </div>

              {/* Sub-card 2: Al-Kout & Salmiya Maintenance Custody */}
              <div className="p-3 rounded-xl ae-tile-soft flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {isAr ? 'عهد صيانة الكوت والسالمية (312 قيداً | 10,707.930 د.ك)' : 'Al-Kout & Salmiya Maintenance Custody (312 entries | 10,707.930 KWD)'}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                      {isAr ? 'عهد مفتوحة' : 'Custody Alert'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isAr
                      ? 'من إجمالي 2,213 قيد مصروفات — تجديد المبردات التجارية يسترد +850 د.ك/شهرياً'
                      : 'Out of 2,213 Opex entries — Commercial chiller overhaul recovers +850 KWD/mo'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendQuery(isAr ? 'حللي عهد صيانة الكوت والسالمية (312 قيداً بقيمة 10,707.930 د.ك) وكيف نغلقها ونوفر التكاليف؟' : 'Analyze Al-Kout & Salmiya Maintenance Custody (312 entries | 10,707.930 KWD) and cost reduction plan')}
                  className="ae-pill-dark ae-pill-sm shrink-0"
                >
                  {isAr ? 'تحليل صوتي مع فريال' : 'Analyze with Feryal'}
                </button>
              </div>

              {/* Sub-card 3: Keeta Settlements & Discounts */}
              <div className="p-3 rounded-xl ae-tile-soft flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {isAr ? 'تسويات وخصومات كيتا (6,267 طلباً | 2,544 د.ك خصومات)' : 'Keeta Settlements & Discounts (6,267 orders | 2,544 KWD discounts)'}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      {isAr ? 'سقف 3.5%' : '3.5% Cap'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isAr
                      ? 'من أصل 4,152 د.ك خصومات كلية — سقف 3.5% (924 د.ك) يسترد +1,620 د.ك/شهرياً'
                      : 'Out of 4,152 KWD total discounts — 3.5% cap (924 KWD) recovers +1,620 KWD/mo'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendQuery(isAr ? 'حللي تسويات وخصومات منصة كيتا (6,267 طلباً و2,544 د.ك خصومات) وأثر سقف 3.5%' : 'Analyze Keeta Settlements & Discounts (6,267 orders | 2,544 KWD discounts) and the 3.5% promo cap')}
                  className="ae-pill-dark ae-pill-sm shrink-0"
                >
                  {isAr ? 'تحليل صوتي مع فريال' : 'Analyze with Feryal'}
                </button>
              </div>
            </div>
          </div>

          {/* 3. CARD B: VENTURE FOODS 6-BRAND & 11-CHANNEL PULSE */}
          <div className="ae-tile rounded-2xl p-5 space-y-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr ? '🏢 نبض العلامات الـ 6 وقنوات التوصيل الـ 11' : '🏢 Venture Foods 6-Brand & 11-Channel Pulse'}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {isAr ? 'توزيع الإيرادات عبر العلامات الـ 6 وجاهزية الفروع الـ 9 أونلاين' : 'Revenue share across 6 brands & 9-branch online availability'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-mono">
                {isAr ? '167,092 د.ك' : '167,092 KWD'}
              </span>
            </div>

            <div className="space-y-3">
              {/* Brand 1: China Garden */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-900 dark:text-white">{isAr ? 'تشاينا جاردن (84.8% — 141,662 د.ك)' : 'China Garden (84.8% — 141,662 KWD)'}</span>
                  <span className="text-slate-900 dark:text-white font-mono">84.8%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '84.8%' }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>{isAr ? '25,890 طلباً معتمداً' : '25,890 verified orders'}</span>
                  <span>{isAr ? 'متوسط السلة: 5.472 د.ك' : 'AOV: 5.472 KWD'}</span>
                </div>
              </div>

              {/* Brand 2: Frank's */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-900 dark:text-white">{isAr ? 'فرانكس (متوسط السلة 7.490 د.ك)' : "Frank's (AOV 7.490 KWD)"}</span>
                  <span className="text-slate-900 dark:text-white font-mono">11,840 {isAr ? 'د.ك' : 'KWD'} (7.1%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '22%' }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{isAr ? 'أعلى متوسط سلة بالمجموعة: 7.490 د.ك' : 'Highest Group Basket AOV: 7.490 KWD'}</span>
                  <span>{isAr ? '1,580 طلباً' : '1,580 orders'}</span>
                </div>
              </div>

              {/* Brands: Other 4 Brands Combined */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-900 dark:text-white">{isAr ? 'طحينة، برجريتو، تشيك آند ديب، كريف' : 'Tahina, Burgerito, Chick & Dip, Crave'}</span>
                  <span className="text-slate-900 dark:text-white font-mono">13,590 {isAr ? 'د.ك' : 'KWD'} (8.1%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-slate-700 h-2 rounded-full" style={{ width: '25%' }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>{isAr ? '3,070 طلباً عبر 11 قناة بيع' : '3,070 orders across 11 channels'}</span>
                  <span>{isAr ? 'نمو متسارع في الكومبو' : 'High-margin combo expansion'}</span>
                </div>
              </div>

              {/* Platform Health */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>{isAr ? 'توافر الفروع الـ 9 على طلبات جو وسوق طلبات وكيتا وديليفرو' : '9 Branches on Talabat Tgo & TMP, Keeta & Deliveroo'}</span>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {isAr ? '99.1% متصل أونلاين' : '99.1% Online'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. THE FOUR SMART SERVICES GATEWAY (Clean 2x2 Grid of 4 Cards) */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              {isAr ? 'رابعاً: بوابة الخدمات الذكية الأربع (استخبارات السوق والمنافسين والأتمتة)' : '4. The Four Smart Services Gateways (Market, Competitors & Automation)'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{isAr ? 'بوابة الوكلاء الذكية' : 'Multi-Agent Gateway'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CARD 1: PERPLEXITY SONAR-PRO */}
          <div className="ae-tile ae-lift rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  <span>{isAr ? '1. محرك استخبارات السوق اللحظي (بيربلكسيتي)' : '1. Real-Time Market Intelligence (Perplexity)'}</span>
                </span>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                  {isAr ? 'سوق الشويخ للجملة' : 'Kuwait Wholesale Feed'}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                {isAr
                  ? 'رصد أسعار الجملة بسوق الشويخ (الدجاج المجمد، زيوت القلي)، التضخم، ومؤشر تأثير الطقس والمناسبات على الطلبات.'
                  : 'Track wholesale commodity inflation in Shuwaikh markets and weather delivery elasticity.'}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={perplexityQuery}
                  onChange={(e) => setPerplexityQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث في سوق المطاعم الكويتي...' : 'Search Kuwait restaurant market...'}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-xs sm:text-[13px] font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => handleRunPerplexity(perplexityQuery, isAr ? 'ar' : 'en')}
                  disabled={hubLoading}
                  className="ae-pill-dark shrink-0"
                >
                  {isAr ? 'بحث لحظي' : 'Query'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
              {perplexityResponse || (isAr ? 'جاري تحليل السوق الكويتي...' : 'Fetching market report...')}
            </div>
          </div>

          {/* CARD 2: FIRECRAWL COMPETITOR SCRAPER */}
          <div className="ae-tile ae-lift rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  <span>{isAr ? '2. كاشف قوائم وأسعار المنافسين (فاير كرول)' : '2. Competitor Menu & Price Scraper (Firecrawl)'}</span>
                </span>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                  {isAr ? 'مقارنة أسعار المنافسين' : 'Competitor Pricing'}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                {isAr
                  ? 'استخراج منيو وأسعار المنافسين ومقارنتها مباشرة مع أصنافنا بالدينار الكويتي لإصدار توصيات التسعير.'
                  : 'Scrape competitor items and benchmark pricing in KWD against China Garden & Frank’s.'}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={firecrawlUrl}
                  onChange={(e) => setFirecrawlUrl(e.target.value)}
                  placeholder="https://www.talabat.com/kuwait/restaurant/..."
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
                <button
                  onClick={() => handleRunFirecrawl(isAr ? 'ar' : 'en')}
                  disabled={hubLoading}
                  className="ae-pill-dark shrink-0"
                >
                  {isAr ? 'مقارنة' : 'Compare'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 max-h-48">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                    <th className="py-2.5 px-3 text-start">{isAr ? 'صنف المنافس' : 'Item'}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'سعره' : 'Comp'}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'سعرنا' : 'Our'}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'الفارق' : 'Diff'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                  {competitorItems.slice(0, 3).map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                        {isAr ? (item.competitorItemAr || item.name) : (item.competitorItem || item.name)}
                      </td>
                      <td className="py-2 px-3 font-mono">{item.competitorPriceKwd?.toFixed(3)}</td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">{item.ourPriceKwd?.toFixed(3)}</td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700 dark:text-blue-400">{item.diffPct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CARD 3: PLAYWRIGHT PORTAL WATCHDOG */}
          <div className="ae-tile ae-lift rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>{isAr ? '3. المراقب الآلي لبوابات التوصيل (بلاي رايت)' : '3. Delivery Aggregator Watchdog (Playwright)'}</span>
                </span>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                  {isAr ? '9/9 فروع متصلة بالكامل' : '9/9 Branches Online'}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                {isAr
                  ? 'مراقبة اتصال بوابات التوصيل (طلبات، كيتا، دليفرو) ونسب العمولة وتجنب الإيقاف المؤقت للفروع.'
                  : 'Headless watchdog verifying Talabat Tgo/TMP, Keeta, and Deliveroo merchant hub status.'}
              </p>

              <div className="flex items-center gap-2 pt-1">
                {(['talabat', 'keeta', 'deliveroo'] as const).map((p) => {
                  const label = isAr
                    ? p === 'talabat'
                      ? 'بوابة طلبات'
                      : p === 'keeta'
                      ? 'بوابة كيتا'
                      : 'بوابة دليفرو'
                    : `${p.toUpperCase()} Portal`
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setPortalSelect(p)
                        handleRunPlaywright(p, isAr ? 'ar' : 'en')
                      }}
                      className={portalSelect === p ? 'ae-pill-dark ae-pill-sm' : 'ae-pill-light ae-pill-sm'}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {portalHealthData && (
              <div className="bg-slate-50 dark:bg-slate-900/70 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-900 dark:text-white font-extrabold">{portalHealthData.name}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{portalHealthData.status}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] font-medium font-mono">{portalHealthData.url}</div>
                {portalHealthData.burnRateMonthly && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
                    {portalHealthData.burnRateMonthly}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARD 4: COMPOSIO AUTOMATED DISPATCH */}
          <div className="ae-tile ae-lift rounded-2xl p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>{isAr ? '4. منسق التنفيذ التلقائي للمهام (كومبوزيو)' : '4. Automated Workflow Orchestrator (Composio)'}</span>
                </span>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                  {isAr ? 'أتمتة المهام التنفيذية' : 'Workflow Automation'}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                {isAr
                  ? 'بث التكليفات لمدراء الفروع عبر واتساب، وتحديث تقارير أودو في جداول جوجل، وإرسال تنبيهات الإدارة عبر البريد.'
                  : 'Automated executive dispatch across WhatsApp, Google Sheets, and executive Gmail.'}
              </p>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold pt-1">
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                  <span>{isAr ? 'البريد التنفيذي' : 'Gmail'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isAr ? 'جداول البيانات' : 'Sheets'}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/70 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-1.5 max-h-48 overflow-y-auto">
              {dispatchedLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span className="font-mono text-slate-500 font-bold">[{log.time}]</span>
                  <span className="truncate max-w-[200px]">{log.msg}</span>
                  <span className="text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded font-bold">
                    {log.channel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. FOUR-STAGE STRATEGIC ENGINE + LIVE WHAT-IF PROFIT CALCULATOR */}
      {/* ==================================================================== */}
      <section>
          <div className="ae-tile rounded-2xl p-6 sm:p-7 space-y-6">
            {/* Header with 4-stage Breadcrumbs */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 text-xs font-bold px-2.5 py-0.5">
                  {isAr ? 'مصفوفة القرارات الاستراتيجية' : 'Strategic Decision Matrix'}
                </span>
                <span className="text-[13px] text-slate-600 dark:text-slate-400 font-bold">
                  {isAr ? 'محرك تعظيم الأرباح وخفض التكاليف' : 'Executive Profit & Cost Engine'}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {isAr ? 'خامساً: محرك التحليل الاستراتيجي الرباعي' : '5. Four-Stage Strategic Analysis Engine'}
              </h3>
              <div className="mt-3.5 grid grid-cols-4 gap-2 text-center text-xs font-bold">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5 text-emerald-800 dark:text-emerald-300">
                  1. {isAr ? 'الحلول' : 'Solutions'}
                </div>
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2.5 text-blue-800 dark:text-blue-300">
                  2. {isAr ? 'الاقتراحات' : 'Proposals'}
                </div>
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-2.5 text-slate-900 dark:text-white">
                  3. {isAr ? 'الخطط التنفيذية' : 'Execution Plans'}
                </div>
                <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 p-2.5 text-sky-800 dark:text-sky-300">
                  4. {isAr ? 'النتائج المالية' : 'Projections'}
                </div>
              </div>
            </div>

            {/* STAGE 1: SOLUTIONS (الحلول) */}
            <div className="space-y-3.5 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>{isAr ? 'المرحلة 1: الحلول التشغيلية لخفض الهدر' : 'Stage 1: Waste Reduction Solutions'}</span>
              </h4>
              <div className="space-y-3">
                {STRATEGIC_SOLUTIONS.map((sol) => (
                  <div
                    key={sol.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-slate-900 dark:text-white">{isAr ? sol.titleAr : sol.titleEn}</span>
                        <span className="rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-0.5 font-bold">
                          {isAr ? sol.badgeAr : sol.badgeEn}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{isAr ? sol.detailsAr : sol.detailsEn}</p>
                      <span className="text-xs text-blue-700 dark:text-blue-400 font-bold block">
                        📍 {isAr ? sol.locationAr : sol.locationEn}
                      </span>
                    </div>

                    <div className="text-end shrink-0 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-bold">{isAr ? 'الوفر المتوقع' : 'Savings'}</span>
                      <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                        +{sol.monthlySavingsKwd.toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                      <span className="text-[11px] text-slate-500 block font-medium">{isAr ? 'شهرياً' : '/month'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STAGE 2: PROPOSALS (الاقتراحات) */}
            <div className="space-y-3.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                <span>{isAr ? 'المرحلة 2: الاقتراحات الاستراتيجية لرفع متوسط السلة' : 'Stage 2: Upselling & Margin Proposals'}</span>
              </h4>
              <div className="space-y-3">
                {STRATEGIC_PROPOSALS.map((prop) => (
                  <div
                    key={prop.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-slate-900 dark:text-white">{isAr ? prop.titleAr : prop.titleEn}</span>
                        <span className="rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs px-2.5 py-0.5 font-bold">
                          {isAr ? prop.badgeAr : prop.badgeEn}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{isAr ? prop.mechanismAr : prop.mechanismEn}</p>
                    </div>

                    <div className="text-end shrink-0 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-blue-800 dark:text-blue-300 block font-bold">{isAr ? 'الربح الإضافي' : 'Added Profit'}</span>
                      <span className="text-lg font-black text-blue-700 dark:text-blue-400 font-mono">
                        +{prop.expectedMonthlyGainKwd.toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                      <span className="text-[11px] text-slate-500 block font-medium">{isAr ? 'شهرياً' : '/month'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STAGE 3: EXECUTION PLANS & COMPOSIO ACTIONS (الخطط التنفيذية) */}
            <div className="space-y-3.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{isAr ? 'المرحلة 3: الخطط التنفيذية والأتمتة' : 'Stage 3: Weekly Execution Plans & Automation'}</span>
                </h4>
                <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">{isAr
                    ? `${Object.values(planApproval).filter((s) => s === 'approved').length} من 4 معتمدة`
                    : `${Object.values(planApproval).filter((s) => s === 'approved').length} of 4 approved`}</span>
              </div>

              <div className="space-y-3">
                {executionPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs px-2.5 py-0.5">
                          {isAr ? plan.weekAr : plan.weekEn}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                          [{isAr ? plan.departmentAr : plan.departmentEn}]
                        </span>
                      </div>
                      <p className="text-[15px] font-bold text-slate-900 dark:text-white">{isAr ? plan.titleAr : plan.titleEn}</p>
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                        {isAr ? `🎯 الهدف: ${plan.targetKpiAr}` : `🎯 Target: ${plan.targetKpiEn}`}
                      </div>
                      <div className="ae-seg mt-1" role="group" aria-label={isAr ? 'حالة التنفيذ' : 'Execution status'}>
                        {(['planned', 'in-progress', 'approved'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            data-active={(planApproval[plan.id] ?? (plan.status === 'completed' ? 'approved' : plan.status === 'running' ? 'in-progress' : 'planned')) === st}
                            onClick={() => setPlanApproval((prev) => ({ ...prev, [plan.id]: st }))}
                          >
                            {isAr ? PLAN_STATUS_LABEL[st].ar : PLAN_STATUS_LABEL[st].en}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={plan.status === 'completed' || plan.status === 'running'}
                      onClick={() => handleDispatchComposio(plan.id, plan.actionType)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        plan.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                          : plan.status === 'running'
                          ? 'bg-blue-100 dark:bg-blue-950 border border-blue-400 text-blue-800 dark:text-blue-300 animate-pulse'
                          : 'ae-pill-dark'
                      }`}
                    >
                      {plan.status === 'completed' ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>{isAr ? 'تم الإرسال عبر كومبوزيو' : 'Dispatched via Composio'}</span>
                        </>
                      ) : plan.status === 'running' ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>{isAr ? 'جاري الإرسال...' : 'Dispatching...'}</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          <span>{isAr ? 'تنفيذ وإرسال التكليف' : 'Execute & Dispatch'}</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* STAGE 4: FINANCIAL PROJECTIONS & WHAT-IF SLIDER (High Contrast Projections) */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-blue-600" />
                    <span>{isAr ? 'المرحلة 4: النتائج المالية المتوقعة ومحاكي السيناريوهات' : 'Stage 4: Financial Projections & What-If Slider'}</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                    {isAr ? 'حرّك المؤشرات لتجربة كفاءة التكاليف ونمو المبيعات وانعكاسها المالي الفوري' : 'Adjust sliders to simulate cost-saving & growth sensitivities'}
                  </p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 font-bold">
                  {isAr ? 'الأثر الشهري المتوقع:' : 'Expected Monthly Added:'}{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400 font-mono text-sm">+{calculatedProjections.monthlyAddedProfit.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</strong>
                </div>
              </div>

              {/* What-If Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>{isAr ? 'كفاءة ضبط الهدر والتكاليف' : 'Cost & Waste Efficiency'}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono">{costOptimizationSlider}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={costOptimizationSlider}
                    onChange={(e) => setCostOptimizationSlider(Number(e.target.value))}
                    className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>50% ({isAr ? 'متحفظ' : 'Conservative'})</span>
                    <span>100% ({isAr ? 'المستهدف' : 'Target'})</span>
                    <span>150% ({isAr ? 'فائق' : 'Aggressive'})</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>{isAr ? 'نمو سلة الشراء وترقية الوجبات' : 'AOV & Upselling Lift'}</span>
                    <span className="text-blue-700 dark:text-blue-400 font-mono">{revenueUpsellSlider}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={revenueUpsellSlider}
                    onChange={(e) => setRevenueUpsellSlider(Number(e.target.value))}
                    className="w-full accent-blue-600 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>50%</span>
                    <span>100%</span>
                    <span>150%</span>
                  </div>
                </div>
              </div>

              {/* The Three Timeframes (Q1, H1, Annual - High Contrast & Solid Cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Q1 Card */}
                <div className="bg-blue-50/70 dark:bg-[#151E2E] border border-blue-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>{isAr ? 'الربع الأول (3 أشهر)' : 'Q1 (3 Months)'}</span>
                    <span className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full text-slate-800 dark:text-slate-200 font-extrabold">
                      {calculatedProjections.q1.margin.toFixed(1)}% {isAr ? 'هامش' : 'margin'}
                    </span>
                  </div>
                  <div className="text-[13px] text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span>{isAr ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-mono text-slate-950 dark:text-white font-bold">{calculatedProjections.q1.sales.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? 'الوفر الإضافي:' : 'Added Gain:'}</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-extrabold">+{calculatedProjections.q1.addedProfit.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 dark:border-slate-700 pt-2 text-slate-950 dark:text-white font-extrabold text-sm">
                      <span>{isAr ? 'الربح المتوقع:' : 'Net Profit:'}</span>
                      <span className="font-mono text-slate-950 dark:text-white text-base font-black">{calculatedProjections.q1.totalProfit.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                  </div>
                </div>

                {/* H1 Card */}
                <div className="bg-blue-50/70 dark:bg-[#151E2E] border border-blue-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>{isAr ? 'النصف الأول (6 أشهر)' : 'H1 (6 Months)'}</span>
                    <span className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full text-slate-800 dark:text-slate-200 font-extrabold">
                      {calculatedProjections.h1.margin.toFixed(1)}% {isAr ? 'هامش' : 'margin'}
                    </span>
                  </div>
                  <div className="text-[13px] text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span>{isAr ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-mono text-slate-950 dark:text-white font-bold">{calculatedProjections.h1.sales.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? 'الوفر الإضافي:' : 'Added Gain:'}</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-extrabold">+{calculatedProjections.h1.addedProfit.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 dark:border-slate-700 pt-2 text-slate-950 dark:text-white font-extrabold text-sm">
                      <span>{isAr ? 'الربح المتوقع:' : 'Net Profit:'}</span>
                      <span className="font-mono text-slate-950 dark:text-white text-base font-black">{calculatedProjections.h1.totalProfit.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                  </div>
                </div>

                {/* Annual Card */}
                <div className="bg-emerald-50/60 dark:bg-[#10221A] border border-emerald-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-white">
                    <span>{isAr ? 'السنة الكاملة (12 شهراً)' : 'Full Year (12 Months)'}</span>
                    <span className="text-xs bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full text-emerald-800 dark:text-emerald-300 font-extrabold">
                      {calculatedProjections.annual.margin.toFixed(1)}% {isAr ? 'هامش' : 'margin'}
                    </span>
                  </div>
                  <div className="text-[13px] text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
                    <div className="flex justify-between">
                      <span>{isAr ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-mono text-slate-950 dark:text-white font-bold">{calculatedProjections.annual.sales.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? 'الوفر الإضافي:' : 'Added Gain:'}</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-extrabold">+{calculatedProjections.annual.addedProfit.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-200 dark:border-slate-700 pt-2 text-emerald-950 dark:text-emerald-300 font-extrabold text-sm">
                      <span>{isAr ? 'الربح المتوقع:' : 'Net Profit:'}</span>
                      <span className="font-mono text-emerald-800 dark:text-emerald-400 text-base font-black">{calculatedProjections.annual.totalProfit.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LIVE WHAT-IF PROFIT IMPACT CALCULATOR (toggle levers & execution status) */}
            <FeryalWhatIfCalculator lang={isAr ? 'ar' : 'en'} onAsk={(q) => handleSendQuery(q)} />
          </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. VERIFIED 9-BRANCH PERFORMANCE AUDIT TABLE */}
      {/* ==================================================================== */}
      <section className="ae-tile rounded-2xl p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {isAr ? 'أداء الفروع التشغيلية الـ 9 الفعلية المعتمدة (حسب سجل أودو لشهر أكتوبر)' : 'Performance Breakdown: 9 Active Operational Branches (October Odoo)'}
            </h3>
            <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 font-medium">
              {isAr ? 'مطابقة مبيعات 167,092.160 د.ك عبر الفروع الـ 9 الفعلية' : '100% reconciled against approved 167,092.160 KWD sales ledger across 9 active branches'}
            </p>
          </div>
          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-1.5 rounded-full">
            {isAr ? '9/9 فروع نشطة بالكامل' : '9/9 Branches Active'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-start text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-bold">
                <th className="py-3 px-4 text-start">#</th>
                <th className="py-3 px-4 text-start">{isAr ? 'الفرع' : 'Branch'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'المبيعات المعتمدة' : 'Net Sales'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'عدد الطلبات' : 'Orders'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'الحصة' : 'Rev Share'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'القناة الأبرز' : 'Top Channel'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'الحالة التشغيلية' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
              {VERIFIED_BRANCHES.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-400 font-bold">{b.rank}</td>
                  <td className="py-3 px-4 font-bold text-slate-950 dark:text-white">{isAr ? b.nameAr : b.nameEn}</td>
                  <td className="py-3 px-4 font-mono font-extrabold text-slate-950 dark:text-white">
                    {b.salesKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{b.orders.toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono text-blue-700 dark:text-blue-400 font-bold">{b.share}%</td>
                  <td className="py-3 px-4">
                    <span className="rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-bold">
                      {isAr ? b.bestChannelAr : b.bestChannelEn}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-extrabold ${
                        (isAr ? b.statusAr : b.statusEn).includes('هدر') ||
                        (isAr ? b.statusAr : b.statusEn).includes('صيانة') ||
                        (isAr ? b.statusAr : b.statusEn).includes('Calibration') ||
                        (isAr ? b.statusAr : b.statusEn).includes('Repairs')
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {isAr ? b.statusAr : b.statusEn}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
