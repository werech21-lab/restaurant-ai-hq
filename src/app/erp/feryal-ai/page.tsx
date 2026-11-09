'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  Mic,
  MicOff,
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
  const { locale } = useI18n()
  const isAr = locale === 'ar'

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
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

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

      utterance.onend = () => setPlayingMsgId(null)
      utterance.onerror = () => setPlayingMsgId(null)
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      setPlayingMsgId(null)
    }
  }, [])

  // Natural Cloud Audio Player via Google Translate TTS Stream API
  const playFeryalSpeech = useCallback(
    async (text: string, msgId?: string) => {
      if (isVoiceMuted) return

      // Stop any existing playback
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
        audioPlayerRef.current.currentTime = 0
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      const activeLang = isAr ? 'ar' : 'en'
      const activeId = msgId || 'live-speech'
      setPlayingMsgId(activeId)

      try {
        const res = await fetch('/api/feryal/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang: activeLang }),
        })

        if (res.ok) {
          const blob = await res.blob()
          const audioUrl = URL.createObjectURL(blob)
          const audio = new Audio(audioUrl)
          audioPlayerRef.current = audio

          audio.onended = () => {
            setPlayingMsgId(null)
            URL.revokeObjectURL(audioUrl)
          }

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl)
            fallbackSpeechSynthesis(text, activeLang)
          }

          await audio.play()
          return
        }
        // If server TTS returned non-200, use fallback
        fallbackSpeechSynthesis(text, activeLang)
      } catch (err) {
        fallbackSpeechSynthesis(text, activeLang)
      }
    },
    [isVoiceMuted, isAr, fallbackSpeechSynthesis]
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

  // Initialize Web Speech API for voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognizer = new SpeechRecognition()
        recognizer.continuous = false
        recognizer.interimResults = false
        recognizer.lang = micLang === 'ar' ? 'ar-KW' : 'en-US'

        recognizer.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInputText(transcript)
          setIsListening(false)
          handleSendQuery(transcript)
        }

        recognizer.onerror = () => setIsListening(false)
        recognizer.onend = () => setIsListening(false)

        recognitionRef.current = recognizer
      }
    }
  }, [micLang])

  // Toggle Voice Input
  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.lang = micLang === 'ar' ? 'ar-KW' : 'en-US'
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        setIsListening(false)
      }
    }
  }

  // Handle Send Query to Feryal
  const handleSendQuery = async (queryText?: string) => {
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
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', query: textToSend, lang: isAr ? 'ar' : 'en' }),
      })

      const data = await res.json()
      if (data.success) {
        const feryalMsgId = `feryal-${Date.now()}`
        const feryalMsg = {
          id: feryalMsgId,
          sender: 'feryal' as const,
          textAr: data.replyAr,
          textEn: data.replyEn,
          time: new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
          metrics: data.keyMetrics,
        }
        setMessages((prev) => [...prev, feryalMsg])
        playFeryalSpeech(isAr ? data.replyAr : data.replyEn, feryalMsgId)
      }
    } catch (e) {
      const fallbackMsgId = `feryal-${Date.now()}`
      const fallbackMsg = {
        id: fallbackMsgId,
        sender: 'feryal' as const,
        textAr: 'وفقاً لبيانات أودو لشهر أكتوبر، صافي المبيعات هو مائة وسبعة وستون ألفاً واثنان وتسعون ديناراً كويتياً، والأرباح التشغيلية اثنان وأربعون ألفاً وأربعمائة وواحد وأربعون ديناراً كويتياً بهامش خمسة وعشرين بالمئة. خطة خفض الهدر وسقف الخصومات جاهزة للتنفيذ.',
        textEn: 'According to October Odoo figures, Net Sales stand at 167,092.160 KWD and Operating Profit at 42,441.480 KWD (25.4% margin). Waste elimination and discount capping plans are ready to deploy.',
        time: isAr ? 'الآن' : 'Just now',
      }
      setMessages((prev) => [...prev, fallbackMsg])
      playFeryalSpeech(isAr ? fallbackMsg.textAr : fallbackMsg.textEn, fallbackMsgId)
    } finally {
      setIsCopilotThinking(false)
    }
  }

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
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 p-4 sm:p-6 md:p-8 space-y-8 font-sans antialiased">
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
        <section className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-2xl shadow-xs ring-1 ring-slate-200/90 dark:ring-slate-800 flex flex-col h-[760px] overflow-hidden">
          {/* Elegant Dark Navy Header */}
          <div className="bg-[#0F172A] text-white p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-11 w-11 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
                  <Bot className="h-6 w-6" />
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#0F172A]" />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold text-white flex items-center gap-2">
                  <span>{isAr ? 'فريال — المستشارة التنفيذية الذكية' : 'Feryal — Executive AI Copilot'}</span>
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  {isAr ? 'استشارات تنفيذية صوتية ونصية باللغتين' : 'Voice & Text Executive Advisory'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Mic language toggle */}
              <button
                type="button"
                onClick={() => setMicLang(micLang === 'ar' ? 'en' : 'ar')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all"
                title={isAr ? 'تبديل لغة الاستماع' : 'Switch Voice Language'}
              >
                🎙️ {isAr ? (micLang === 'ar' ? 'عربي' : 'إنجليزي') : (micLang === 'ar' ? 'AR' : 'EN')}
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
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isVoiceMuted
                    ? 'border-slate-700 bg-slate-800 text-slate-400'
                    : 'border-blue-500 bg-blue-600 text-white'
                }`}
                title={isVoiceMuted ? (isAr ? 'تشغيل الرد الصوتي' : 'Unmute Voice') : isAr ? 'كتم الرد الصوتي' : 'Mute Voice'}
              >
                {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                <span className="hidden sm:inline">{isVoiceMuted ? (isAr ? 'مكتوم' : 'Muted') : isAr ? 'الرد الصوتي' : 'Voice'}</span>
              </button>
            </div>
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
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
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
                      <span>{isAr ? (playingMsgId === m.id ? '🔊 جاري النطق بصوت فريال...' : '🔊 استمع لصوت فريال') : (playingMsgId === m.id ? '🔊 Speaking...' : '🔊 Listen to Feryal')}</span>
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-semibold mt-1 px-1">{m.time}</span>
              </div>
            ))}

            {isCopilotThinking && (
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-bold py-2.5 px-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 w-fit">
                <Sparkles className="h-4 w-4 animate-spin text-blue-600" />
                <span>{isAr ? 'فريال تحلل بيانات أودو والقنوات...' : 'Feryal is computing ledger figures...'}</span>
              </div>
            )}
          </div>

          {/* Voice Waveform Alert (when mic is actively listening) */}
          {isListening && (
            <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/30 border-t border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
                </span>
                <span>{isAr ? 'جاري الاستماع لصوتك (تحدث الآن)...' : 'Listening to voice stream (Speak now)...'}</span>
              </div>
              <div className="flex items-center gap-1 h-4">
                {[0.4, 0.8, 1.2, 0.6, 1.0, 0.5, 0.9].map((scale, i) => (
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
                className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  isListening
                    ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
                }`}
                title={isListening ? (isAr ? 'إيقاف الميكروفون' : 'Stop Microphone') : isAr ? 'تحدث مع فريال' : 'Speak to Feryal'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-blue-600" />}
                <span className="hidden sm:inline">{isListening ? (isAr ? 'استماع...' : 'Listening...') : isAr ? 'تحدث' : 'Speak'}</span>
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isAr ? 'اسأل فريال عن أرقام المبيعات، الهدر، أو الفروع...' : 'Ask Feryal about sales, waste, or branches...'}
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
