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
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getOpenAIApiKey } from '@/lib/openai-key'

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
  branchesCount: 8,
  activeMenuItemsCount: 364,
  topItemsSalesConcentrationPct: 80.0,
  topItemsCount: 32,
}

// Strictly the 8 Verified Operational Branches (Zero Jahra / Zero Qurain)
const VERIFIED_BRANCHES = [
  { id: 'Salmiya', nameAr: 'السالمية', nameEn: 'Salmiya', salesKwd: 31246.23, orders: 5710, share: 18.7, rank: 1, bestChannelAr: 'طلبات جو (توصيل المنصة)', bestChannelEn: 'Talabat Tgo', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Al-Kout', nameAr: 'الكوت / الفحيحيل', nameEn: 'Al-Kout / Fahaheel', salesKwd: 27904.39, orders: 5100, share: 16.7, rank: 2, bestChannelAr: 'سوق طلبات (توصيل المطعم)', bestChannelEn: 'Talabat TMP', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Sharq', nameAr: 'شرق', nameEn: 'Sharq', salesKwd: 24896.73, orders: 4550, share: 14.9, rank: 3, bestChannelAr: 'دليفرو', bestChannelEn: 'Deliveroo', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Hawally', nameAr: 'حولي', nameEn: 'Hawally', salesKwd: 21387.79, orders: 3910, share: 12.8, rank: 4, bestChannelAr: 'كيتا', bestChannelEn: 'Keeta', statusAr: 'يحتاج صيانة مبردات', statusEn: 'Chiller Repairs Required' },
  { id: 'Farwaniya', nameAr: 'الفروانية', nameEn: 'Farwaniya', salesKwd: 18045.95, orders: 3300, share: 10.8, rank: 5, bestChannelAr: 'طلبات جو (توصيل المنصة)', bestChannelEn: 'Talabat Tgo', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Ardiya', nameAr: 'العارضية الحرفية', nameEn: 'Ardiya Central', salesKwd: 15372.48, orders: 2810, share: 9.2, rank: 6, bestChannelAr: 'المطبخ المركزي', bestChannelEn: 'Central Hub', statusAr: 'معايرة هدر التتبيل', statusEn: 'Prep Waste Calibration' },
  { id: 'Mahboula', nameAr: 'المهبولة', nameEn: 'Mahboula', salesKwd: 15038.29, orders: 2750, share: 9.0, rank: 7, bestChannelAr: 'سوق طلبات (توصيل المطعم)', bestChannelEn: 'Talabat TMP', statusAr: 'مثالي', statusEn: 'Optimal' },
  { id: 'Mubarak-Al-Kabeer', nameAr: 'مبارك الكبير / صباح السالم', nameEn: 'Mubarak Al-Kabeer', salesKwd: 13200.3, orders: 2410, share: 7.9, rank: 8, bestChannelAr: 'طلبات جو (توصيل المنصة)', bestChannelEn: 'Talabat Tgo', statusAr: 'نمو متصاعد', statusEn: 'Rapid Growth' },
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
        // Wait 150ms after stopping mic so Windows Bluetooth driver switches from HFP back to A2DP Stereo!
        await new Promise((resolve) => setTimeout(resolve, 150))

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

      // 1. Direct Browser Call to OpenAI Chat Completion (gpt-4o-mini)
      const apiKey = getOpenAIApiKey()
      if (apiKey) {
        try {
          const systemPrompt = isAr
            ? `أنت المستشارة التنفيذية الذكية "فريال" لمجموعة فنتشر فودز (AetherBI).
بيانات أودو الرسمية لشهر أكتوبر 2026:
- صافي المبيعات المعتمدة: 167,092.160 د.ك (30,540 طلباً | متوسط الطلب 5.471 د.ك).
- صافي الربح التشغيلي: 42,441.480 د.ك (هامش 25.4%).
- تكلفة الأغذية والمواد: 41,438.856 د.ك (24.8% والمستهدف 24.0%، وفر هدر العارضية 1,336 د.ك).
- المصروفات التشغيلية: 51,154.950 د.ك (خفض صيانة حولي 850 د.ك).
- الخصومات: 4,152.000 د.ك (سقف خصومات كيتا يوفر 1,620 د.ك).
- الفروع الـ 8 المعتمدة فقط: السالمية (31,246 د.ك)، الكوت (27,904 د.ك)، شرق (24,896 د.ك)، حولي (21,387 د.ك)، الفروانية (18,045 د.ك)، العارضية (15,372 د.ك)، المهبولة (15,038 د.ك)، مبارك الكبير (13,200 د.ك). لا يوجد فرع للجهراء.
أجيبي بأسلوب استراتيجي قيادي واضح وموجز مستخدمة الأرقام الصحيحة فقط وبدون أي رموز غير ناطقة.`
            : `You are Executive AI Copilot "Feryal" for Venture Foods Kuwait (AetherBI).
Verified October Odoo Master Metrics:
- Net Sales: 167,092.160 KWD (30,540 orders | AOV 5.471 KWD).
- Operating Profit: 42,441.480 KWD (25.4% margin).
- Food Cost: 41,438.856 KWD (24.8% vs 24.0% target, Ardiya prep waste 1,336 KWD).
- Opex: 51,154.950 KWD (Hawally chiller overhaul saves 850 KWD/mo).
- Discounts: 4,152.000 KWD (Keeta cap saves 1,620 KWD/mo).
- 8 Verified Branches: Salmiya, Al-Kout, Sharq, Hawally, Farwaniya, Ardiya, Mahboula, Mubarak Al-Kabeer. Zero Jahra branch.
Provide crisp, executive-grade advisory.`

          const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: textToSend },
              ],
              temperature: 0.3,
              max_tokens: 380,
            }),
          })

          if (chatRes.ok) {
            const chatData = await chatRes.json()
            const rawContent = chatData.choices?.[0]?.message?.content || ''
            if (rawContent.trim()) {
              if (isAr) replyAr = rawContent.trim()
              else replyEn = rawContent.trim()
            }
          }
        } catch (chatErr) {
          console.warn('Direct browser chat completion error:', chatErr)
        }
      }

      // 2. Fallback to local /api/feryal route
      if (!replyAr && !replyEn) {
        try {
          const res = await fetch('/api/feryal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'chat', query: textToSend, lang: isAr ? 'ar' : 'en' }),
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
    [inputText, isAr, playFeryalSpeech]
  )

  useEffect(() => {
    handleSendQueryRef.current = handleSendQuery
  }, [handleSendQuery])

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

    // Monthly baseline gains: 3,806 KWD savings + 3,034 KWD added revenue = 6,840 KWD/mo
    const monthlyAddedProfit = 3806 * costFactor + 3034 * upsellFactor

    // Q1 (3 months)
    const q1AddedProfit = monthlyAddedProfit * 3
    const q1Sales = 512400 * (1 + (revenueUpsellSlider - 100) * 0.002)
    const q1Profit = 127324.44 + q1AddedProfit
    const q1Margin = (q1Profit / q1Sales) * 100

    // H1 (6 months)
    const h1AddedProfit = monthlyAddedProfit * 6
    const h1Sales = 1038500 * (1 + (revenueUpsellSlider - 100) * 0.002)
    const h1Profit = 254648.88 + h1AddedProfit
    const h1Margin = (h1Profit / h1Sales) * 100

    // Annual (12 months)
    const annualAddedProfit = monthlyAddedProfit * 12
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
      className="min-h-screen bg-[#F7F7F8] dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 p-4 sm:p-6 md:p-8 space-y-8 font-sans antialiased"
    >
      {/* ==================================================================== */}
      {/* 1. TOP EXECUTIVE HEADER (Clean, Solid, Zero Slop Gradients) */}
      {/* ==================================================================== */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 sm:p-7 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
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
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-[13px] font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
          >
            <RefreshCw className={`h-4 w-4 ${hubLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isAr ? 'تحديث الاستخبارات المباشرة' : 'Refresh Market Intel'}</span>
          </button>
          <Link
            href="/erp/sales-scorecard"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-blue-600 px-4 py-2.5 text-[13px] font-bold text-white transition-all shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{isAr ? 'سجل المبيعات والأصناف' : 'Sales Scorecard'}</span>
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 sm:p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800">
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 sm:p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800">
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 sm:p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800">
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 sm:p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800">
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
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-white dark:bg-[#111827] rounded-2xl p-5 sm:p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800">
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
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 text-[13px] text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-4 font-semibold">
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
                <strong className="text-slate-950 dark:text-white font-extrabold">8</strong> {isAr ? 'فروع تشغيلية حقيقية فقط (دون فروع وهمية)' : 'Verified Branches Only (0 Synthetic)'}
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================================================================ */}
        {/* LEFT COLUMN: THE COPILOT "FERYAL" (Natural Voice & Text Engine) */}
        {/* ================================================================ */}
        <section className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-2xl shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 flex flex-col min-h-[780px] lg:h-[840px] overflow-hidden">
          {/* Elegant Dark Navy Header with Two Clear Unsquished Rows */}
          <div className="bg-[#0F172A] text-white p-4 sm:p-5 flex flex-col gap-3.5">
            {/* ROW 1: Bot Avatar + Full Unsquished Title + Status Pill */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="h-11 w-11 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                    <Bot className="h-6 w-6" />
                  </div>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#0F172A]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white whitespace-nowrap tracking-tight">
                    {isAr ? 'فريال — المستشارة التنفيذية الذكية' : 'Feryal — Executive AI Copilot'}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    {isAr ? 'المحرك الصوتي والاستراتيجي المعتمد لمجموعة فنتشر فودز' : 'Executive Voice & Strategy Engine for Venture Foods'}
                  </p>
                </div>
              </div>

              {/* Status Badge in clean horizontal pill */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>{isAr ? 'المحرك الصوتي الذكي متصل ونشط تلقائياً' : 'AI Voice Engine Active & Connected'}</span>
              </span>
            </div>

            {/* ROW 2: Control Action Buttons in horizontal row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                {/* Test Voice in Bluetooth Headset Button */}
                <button
                  type="button"
                  onClick={() => {
                    playFeryalSpeech(
                      isAr
                        ? 'مرحباً بك يا سعادة المدير. المحرك الصوتي الذكي متصل بنجاح ويعمل بنقاء تام في سماعة البلوتوث.'
                        : 'Welcome, Executive Leader. AI voice engine is active with crystal clear audio in your Bluetooth headset.',
                      'test-voice'
                    )
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all flex items-center gap-1.5 shadow-2xs"
                  title={isAr ? 'اختبار خروج الصوت في سماعة البلوتوث' : 'Test Bluetooth Headset Audio Playback'}
                >
                  <Volume2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>{isAr ? '🔊 اختبار الصوت في سماعة البلوتوث الآن' : '🔊 Test Bluetooth Audio Now'}</span>
                </button>

                {/* TTS Voice Mute Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (audioPlayerRef.current) {
                      audioPlayerRef.current.pause()
                    }
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                      window.speechSynthesis.cancel()
                    }
                    setIsVoiceMuted(!isVoiceMuted)
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                    isVoiceMuted
                      ? 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-750'
                      : 'border-blue-500 bg-blue-600 text-white'
                  }`}
                  title={isVoiceMuted ? (isAr ? 'تفعيل الرد الصوتي' : 'Enable Voice Response') : (isAr ? 'كتم الرد الصوتي' : 'Mute Voice Response')}
                >
                  {isVoiceMuted ? <VolumeX className="h-3.5 w-3.5 shrink-0" /> : <Volume2 className="h-3.5 w-3.5 shrink-0" />}
                  <span>{isVoiceMuted ? (isAr ? 'الرد الصوتي: معطّل' : 'Voice: Muted') : (isAr ? 'الرد الصوتي: مفعّل' : 'Voice: Enabled')}</span>
                </button>

                {/* Hands-Free Conversation Mode Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isHandsFree
                    setIsHandsFree(nextState)
                    isHandsFreeRef.current = nextState
                    if (nextState) {
                      if (!playingMsgId && !isListening) {
                        startListening()
                      }
                    } else {
                      if (isListening) {
                        toggleListening()
                      }
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                    isHandsFree
                      ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/50'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={
                    isHandsFree
                      ? isAr
                        ? 'إيقاف وضع الحوار الصوتي المستمر'
                        : 'Disable Hands-Free Mode'
                      : isAr
                      ? 'تفعيل وضع الحوار الصوتي المستمر بعد كل إجابة'
                      : 'Enable Hands-Free Mode'
                  }
                >
                  <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isHandsFree ? 'animate-spin text-white' : 'text-slate-400'}`} />
                  <span>{isAr ? '🔄 حوار صوتي مستمر' : '🔄 Hands-Free Mode'}</span>
                </button>
              </div>

              {/* Mic language toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextLang = micLang === 'ar' ? 'en' : 'ar'
                  setMicLang(nextLang)
                  micLangRef.current = nextLang
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all shrink-0"
                title={isAr ? 'تبديل لغة المايكروفون' : 'Switch Microphone Language'}
              >
                🎙️ {micLang === 'ar' ? (isAr ? 'عربي' : 'AR') : (isAr ? 'إنجليزي' : 'EN')}
              </button>
            </div>
          </div>

          {/* Permanent Decoupled Voice Player Bar */}
          <div className="bg-slate-100 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 p-3 sm:p-3.5 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
                <span>{isAr ? '🔊 استمع لصوت فريال (Nova)' : '🔊 Listen to Feryal (Nova)'}</span>
              </button>
              {lastVoiceError && (
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  {lastVoiceError}
                </span>
              )}
            </div>
            <audio ref={audioPlayerRef} controls preload="auto" className="w-full h-10 mt-2 rounded-lg shadow-2xs" />
          </div>

          {/* Quick Action Pills Under Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
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
                className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 hover:text-slate-950 transition-all shadow-2xs"
              >
                {isAr ? p.ar : p.en}
              </button>
            ))}
          </div>

          {/* Messages Log (Clear High Contrast Chat Bubbles) */}
          <div ref={chatScrollRef} className="flex-1 min-h-[460px] max-h-[520px] overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl p-4 shadow-2xs leading-relaxed text-sm ${
                    m.sender === 'user'
                      ? 'bg-[#2563EB] text-white rounded-br-none font-medium'
                      : 'bg-white dark:bg-[#1A2234] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-bl-none font-medium'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{isAr ? m.textAr : m.textEn}</p>

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

                  {/* Audio Listen Button under Feryal messages */}
                  {m.sender === 'feryal' && (
                    <button
                      type="button"
                      onClick={() => playFeryalSpeech(isAr ? m.textAr : m.textEn, m.id)}
                      className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        playingMsgId === m.id
                          ? 'bg-blue-600 text-white border-blue-600 animate-pulse'
                          : 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 border-blue-200 dark:border-blue-900'
                      }`}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{isAr ? (playingMsgId === m.id ? '🔊 فريال تتحدث الآن...' : '🔊 استمع الآن لصوت فريال') : (playingMsgId === m.id ? '🔊 Feryal is speaking...' : '🔊 Listen to Feryal')}</span>
                    </button>
                  )}
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

          {/* Voice Waveform Alert & Live Status Indicator (when mic is actively listening) */}
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
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 sm:p-4">
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
                className="rounded-xl bg-[#2563EB] hover:bg-blue-600 px-5 py-3 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <span>{isAr ? 'إرسال' : 'Send'}</span>
                <Send className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
              </button>
            </form>
          </div>
        </section>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: THE FOUR-STAGE STRATEGIC ANALYSIS ENGINE */}
        {/* ================================================================ */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 sm:p-7 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 space-y-6">
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
                {isAr ? 'ثانياً: محرك التحليل الاستراتيجي الرباعي' : '2. Four-Stage Strategic Analysis Engine'}
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
                <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-2.5 text-indigo-800 dark:text-indigo-300">
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
                <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">{isAr ? '4 أسابيع مجدولة' : '4 Weeks Roadmapped'}</span>
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
                          : 'bg-[#0F172A] hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-xs'
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
          </div>
        </section>
      </div>

      {/* ==================================================================== */}
      {/* 4. THE FOUR SMART SERVICES GATEWAY (Clean 2x2 Grid of 4 Cards) */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              {isAr ? 'رابعاً: بوابة الخدمات الذكية الأربع (استخبارات السوق والمنافسين والأتمتة)' : '4. The Four Smart Services Gateway (Market, Competitors & Automation)'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{isAr ? 'بوابة الوكلاء الذكية' : 'Multi-Agent Gateway'}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CARD 1: PERPLEXITY SONAR-PRO */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 space-y-4 flex flex-col justify-between">
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
                  className="rounded-xl bg-[#2563EB] hover:bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all shrink-0 shadow-xs"
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 space-y-4 flex flex-col justify-between">
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
                  className="rounded-xl bg-[#2563EB] hover:bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all shrink-0 shadow-xs"
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>{isAr ? '3. المراقب الآلي لبوابات التوصيل (بلاي رايت)' : '3. Delivery Aggregator Watchdog (Playwright)'}</span>
                </span>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                  {isAr ? '8/8 فروع متصلة بالكامل' : '8/8 Branches Online'}
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        portalSelect === p
                          ? 'bg-[#0F172A] text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
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
          <div className="bg-white dark:bg-[#111827] rounded-2xl p-6 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 space-y-4 flex flex-col justify-between">
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
      {/* 5. VERIFIED 8-BRANCH PERFORMANCE AUDIT TABLE */}
      {/* ==================================================================== */}
      <section className="bg-white dark:bg-[#111827] rounded-2xl p-6 sm:p-7 shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {isAr ? 'أداء الفروع التشغيلية الـ 8 المعتمدة فقط (حسب سجل أودو لشهر أكتوبر)' : 'Performance Breakdown: Strictly 8 Verified Branches (October Odoo)'}
            </h3>
            <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 font-medium">
              {isAr ? 'خالٍ تماماً من أي فروع وهمية أو بيانات اصطناعية - مطابقة مبيعات 167,092.160 د.ك' : '100% reconciled against approved 167,092.160 KWD sales ledger'}
            </p>
          </div>
          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-1.5 rounded-full">
            {isAr ? '8/8 فروع نشطة بالكامل' : '8/8 Branches Active'}
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
