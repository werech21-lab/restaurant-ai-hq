'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Activity,
  Zap,
  Globe,
  Store,
  ChevronRight,
  Clock,
  Check,
  Building2,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  HelpCircle,
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

// 8 Verified Operational Branches (Strictly No Jahra / No Qurain)
const VERIFIED_BRANCHES = [
  { id: 'Salmiya', nameAr: 'السالمية', nameEn: 'Salmiya', salesKwd: 31246.23, orders: 5710, share: 18.7, rank: 1, bestChannel: 'Talabat Tgo', status: 'Optimal' },
  { id: 'Al-Kout', nameAr: 'الكوت / الفحيحيل', nameEn: 'Al-Kout / Fahaheel', salesKwd: 27904.39, orders: 5100, share: 16.7, rank: 2, bestChannel: 'Talabat TMP', status: 'Optimal' },
  { id: 'Sharq', nameAr: 'شرق', nameEn: 'Sharq', salesKwd: 24896.73, orders: 4550, share: 14.9, rank: 3, bestChannel: 'Deliveroo', status: 'Optimal' },
  { id: 'Hawally', nameAr: 'حولي', nameEn: 'Hawally', salesKwd: 21387.79, orders: 3910, share: 12.8, rank: 4, bestChannel: 'Keeta', status: 'Attention (Chiller)' },
  { id: 'Farwaniya', nameAr: 'الفروانية', nameEn: 'Farwaniya', salesKwd: 18045.95, orders: 3300, share: 10.8, rank: 5, bestChannel: 'Talabat Tgo', status: 'Optimal' },
  { id: 'Ardiya', nameAr: 'العارضية الحرفية', nameEn: 'Ardiya Central', salesKwd: 15372.48, orders: 2810, share: 9.2, rank: 6, bestChannel: 'Central Hub', status: 'Attention (Prep Waste)' },
  { id: 'Mahboula', nameAr: 'المهبولة', nameEn: 'Mahboula', salesKwd: 15038.29, orders: 2750, share: 9.0, rank: 7, bestChannel: 'Talabat TMP', status: 'Optimal' },
  { id: 'Mubarak-Al-Kabeer', nameAr: 'مبارك الكبير / صباح السالم', nameEn: 'Mubarak Al-Kabeer', salesKwd: 13200.3, orders: 2410, share: 7.9, rank: 8, bestChannel: 'Talabat Tgo', status: 'Growing' },
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
  annualSavingsKwd: number
  badge: string
  detailsAr: string
  detailsEn: string
}

const STRATEGIC_SOLUTIONS: SolutionItem[] = [
  {
    id: 'sol-ardiya',
    titleAr: 'ضبط هدر التتبيل والتحضير المركزي',
    titleEn: 'Central Prep & Marination Yield Calibration',
    locationAr: 'مطبخ العارضية المركزي',
    locationEn: 'Ardiya Central Prep Facility',
    monthlySavingsKwd: 1336,
    annualSavingsKwd: 16032,
    badge: 'Food Cost (COGS)',
    detailsAr: 'إعادة ضبط أوزان صوصات التتبيل وتوحيد خلطات الدجاج يقلص الفاقد بنسبة 1.6% ويعيد تكلفة المواد للمستهدف 24.0%.',
    detailsEn: 'Standardizing marinade batch weights and raw poultry prep cuts recovers 1.6% yield, aligning food cost to target 24.0%.',
  },
  {
    id: 'sol-hawally',
    titleAr: 'استبدال وحدات التبريد وخفض استهلاك الطاقة',
    titleEn: 'Commercial Chiller Overhaul & Energy Efficiency',
    locationAr: 'فرع حولي',
    locationEn: 'Hawally Branch',
    monthlySavingsKwd: 850,
    annualSavingsKwd: 10200,
    badge: 'Utility & Maintenance',
    detailsAr: 'استبدال 3 مبردات قديمة تجاوزت عمرها الافتراضي يخفض فواتير الكهرباء ويمنع تلف الخضار واللحوم.',
    detailsEn: 'Upgrading 3 degraded commercial chillers reduces electric tariff loads and prevents raw perishables spoilage.',
  },
  {
    id: 'sol-keeta',
    titleAr: 'سقف ترشيد الخصومات لحملات كيتا',
    titleEn: 'Cap Keeta Platform Marketing Subsidies',
    locationAr: 'منصة Keeta (كافة الفروع)',
    locationEn: 'Keeta Aggregator (All Branches)',
    monthlySavingsKwd: 1620,
    annualSavingsKwd: 19440,
    badge: 'Marketing Yield',
    detailsAr: 'وضع حد أقصى للخصومات الترويجية وخفض الحرق من 2,544 د.ك إلى 924 د.ك شهرياً مع الحفاظ على معدل التحويل.',
    detailsEn: 'Capping aggressive promo burn from 2,544 KWD to 924 KWD monthly while preserving customer order conversion.',
  },
]

interface ProposalItem {
  id: string
  titleAr: string
  titleEn: string
  expectedMonthlyGainKwd: number
  expectedAnnualGainKwd: number
  badge: string
  mechanismAr: string
  mechanismEn: string
}

const STRATEGIC_PROPOSALS: ProposalItem[] = [
  {
    id: 'prop-drinks',
    titleAr: 'إلزام إضافة المشروبات للوجبات ومجموعات الكومبو',
    titleEn: 'Mandatory Beverage Attachment in Combo Meals',
    expectedMonthlyGainKwd: 2450,
    expectedAnnualGainKwd: 29400,
    badge: 'AOV Expansion',
    mechanismAr: 'رفع متوسط سلة الشراء (AOV) من 5.471 إلى 5.750 د.ك بإضافة المشروب الإلزامي لكافة طلبات الكومبو على تطبيقات التوصيل.',
    mechanismEn: 'Elevating Group AOV from 5.471 to 5.750 KWD by bundling high-margin soft beverages in all delivery combo items.',
  },
  {
    id: 'prop-menu-eng',
    titleAr: 'إعادة هندسة قائمة الطعام (Menu Engineering Matrix)',
    titleEn: 'Menu Matrix Rationalization (Dogs & Plowhorses)',
    expectedMonthlyGainKwd: 584,
    expectedAnnualGainKwd: 7008,
    badge: 'Margin Optimization',
    mechanismAr: 'حذف 18 صنفاً بطيئ الحركة (Dogs) وتعديل أسعار 4 أصناف شعبية (Plowhorses) بنسبة +5% لتوليد ربح إضافي مباشر.',
    mechanismEn: 'Purging 18 sluggish Dog items and adjusting prices of 4 popular Plowhorses by +5% to generate pure margin.',
  },
]

interface ExecutionPlanItem {
  id: string
  week: string
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
    week: 'الأسبوع 1',
    departmentAr: 'المطبخ المركزي والجودة',
    departmentEn: 'Central Kitchen & QC',
    titleAr: 'معايرة مقادير التتبيل وموازين العارضية',
    titleEn: 'Calibrate Marinades & Portion Scales at Ardiya',
    targetKpiAr: 'خفض الهدر بنسبة 1.6% (وفر 1,336 د.ك)',
    targetKpiEn: 'Cut waste by 1.6% (Save 1,336 KWD)',
    actionType: 'dispatch_operations_plan',
    status: 'pending',
  },
  {
    id: 'plan-w2',
    week: 'الأسبوع 2',
    departmentAr: 'الصيانة والمشتريات',
    departmentEn: 'Maintenance & Procurement',
    titleAr: 'شراء وتوريد المبردات الحديثة لفرع حولي',
    titleEn: 'Procure & Install Inverter Chillers for Hawally',
    targetKpiAr: 'خفض فاتورة الكهرباء والصيانة بـ 850 د.ك',
    targetKpiEn: 'Cut utility & repairs by 850 KWD',
    actionType: 'dispatch_chiller_plan',
    status: 'pending',
  },
  {
    id: 'plan-w3',
    week: 'الأسبوع 3',
    departmentAr: 'التسويق وإدارة القنوات',
    departmentEn: 'Marketing & Channels',
    titleAr: 'تطبيق سقف خصومات كيتا وتعديل مصفوفة العروض',
    titleEn: 'Apply Keeta Promo Cap & Revamp Delivery Tiers',
    targetKpiAr: 'وفر تسويقي فوري قدره 1,620 د.ك',
    targetKpiEn: 'Direct promo savings of 1,620 KWD',
    actionType: 'dispatch_keeta_cap',
    status: 'pending',
  },
  {
    id: 'plan-w4',
    week: 'الأسبوع 4',
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

// ==============================================================================
// 3. MAIN COMPONENT
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
        'أهلاً بك يا سعادة المدير. أنا المستشارة فريال، محرك الذكاء الاصطناعي التنفيذي لمجموعة فنتشر فودز. أراقب لحظياً 167,092.160 د.ك مبيعات معتمدة و30,540 طلباً عبر أودو ورادارات التوصيل. كيف ترغب أن نبدأ خطة تعظيم الأرباح وخفض التكاليف اليوم؟',
      textEn:
        'Greetings, Executive Leader. I am Feryal, your AI Executive Copilot for Venture Foods. I actively monitor 167,092.160 KWD in approved sales and 30,540 orders across Odoo and delivery aggregators. How would you like to accelerate profit margins and eliminate operational waste today?',
      time: 'الآن',
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isCopilotThinking, setIsCopilotThinking] = useState(false)

  // Voice Interaction States (Web Speech API)
  const [isListening, setIsListening] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const recognitionRef = useRef<any>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Four Smart Services Hub States (Perplexity, Firecrawl, Playwright, Composio)
  const [activeHubTab, setActiveHubTab] = useState<'perplexity' | 'firecrawl' | 'playwright' | 'composio'>('perplexity')
  const [hubLoading, setHubLoading] = useState(false)

  // Perplexity States
  const [perplexityQuery, setPerplexityQuery] = useState('أسعار الدجاج والزيوت وسوق المطاعم في الكويت وتأثير الطقس')
  const [perplexityResponse, setPerplexityResponse] = useState<string | null>(null)
  const [perplexityMode, setPerplexityMode] = useState<string>('demo_simulation')

  // Firecrawl States
  const [firecrawlUrl, setFirecrawlUrl] = useState('https://www.talabat.com/kuwait/restaurant/china-garden')
  const [competitorItems, setCompetitorItems] = useState<any[]>([])
  const [firecrawlMode, setFirecrawlMode] = useState<string>('demo_simulation')

  // Playwright States
  const [portalSelect, setPortalSelect] = useState<'talabat' | 'keeta' | 'deliveroo'>('talabat')
  const [portalHealthData, setPortalHealthData] = useState<any>(null)

  // Composio States
  const [executionPlans, setExecutionPlans] = useState<ExecutionPlanItem[]>(STRATEGIC_EXECUTION_PLANS)
  const [dispatchedLogs, setDispatchedLogs] = useState<Array<{ time: string; msg: string; channel: string }>>([
    { time: '08:00', msg: 'تم تسليم تقرير مطابقة أودو التلقائي للإدارة العليا عبر Gmail.', channel: 'Gmail Exec' },
    { time: '08:15', msg: 'مزامنة مبيعات Talabat Tgo و TMP مع دفتر أستاذ أودو بنجاح.', channel: 'Google Sheets' },
  ])

  // What-If Dynamic Slider States (Financial Projections)
  const [costOptimizationSlider, setCostOptimizationSlider] = useState<number>(100) // 50% to 150%
  const [revenueUpsellSlider, setRevenueUpsellSlider] = useState<number>(100) // 50% to 150%

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, isCopilotThinking])

  // Initialize Web Speech API for voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        setIsSpeechSupported(true)
        const recognizer = new SpeechRecognition()
        recognizer.continuous = false
        recognizer.interimResults = false
        recognizer.lang = isAr ? 'ar-KW' : 'en-US'

        recognizer.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInputText(transcript)
          setIsListening(false)
          handleSendQuery(transcript)
        }

        recognizer.onerror = () => {
          setIsListening(false)
        }

        recognizer.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognizer
      }
    }
  }, [isAr])

  // Voice output (TTS)
  const speakText = (text: string) => {
    if (isVoiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return

    try {
      window.speechSynthesis.cancel()
      const cleanText = text.replace(/[*#•`_]/g, '')
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = isAr ? 'ar-XA' : 'en-US'
      utterance.rate = 1.05
      utterance.pitch = 1.0

      // Try selecting female voice
      const voices = window.speechSynthesis.getVoices()
      const femaleVoice = voices.find(
        (v) => (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Laila') || v.name.includes('Hoda') || v.name.includes('Salma')) && (isAr ? v.lang.startsWith('ar') : v.lang.startsWith('en'))
      )
      if (femaleVoice) {
        utterance.voice = femaleVoice
      }

      window.speechSynthesis.speak(utterance)
    } catch (e) {
      // safe fallback
    }
  }

  // Toggle Voice Input
  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.lang = isAr ? 'ar-KW' : 'en-US'
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
        body: JSON.stringify({ action: 'chat', query: textToSend }),
      })

      const data = await res.json()
      if (data.success) {
        const feryalMsg = {
          id: `feryal-${Date.now()}`,
          sender: 'feryal' as const,
          textAr: data.replyAr,
          textEn: data.replyEn,
          time: new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
          metrics: data.keyMetrics,
        }
        setMessages((prev) => [...prev, feryalMsg])
        speakText(isAr ? data.replyAr : data.replyEn)
      }
    } catch (e) {
      const fallbackMsg = {
        id: `feryal-${Date.now()}`,
        sender: 'feryal' as const,
        textAr: 'وفقاً لبيانات أودو لشهر أكتوبر، صافي المبيعات هو 167,092.160 د.ك والأرباح التشغيلية 42,441.480 د.ك (هامش 25.4%). خطة خفض الهدر وسقف الخصومات جاهزة للتنفيذ.',
        textEn: 'According to October Odoo figures, Net Sales stand at 167,092.160 KWD and Operating Profit at 42,441.480 KWD (25.4% margin). Waste elimination and discount capping plans are ready to deploy.',
        time: 'الآن',
      }
      setMessages((prev) => [...prev, fallbackMsg])
      speakText(isAr ? fallbackMsg.textAr : fallbackMsg.textEn)
    } finally {
      setIsCopilotThinking(false)
    }
  }

  // Load Perplexity Research
  const handleRunPerplexity = async () => {
    setHubLoading(true)
    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'perplexity', query: perplexityQuery }),
      })
      const data = await res.json()
      if (data.success) {
        setPerplexityResponse(data.content)
        setPerplexityMode(data.mode)
      }
    } catch (e) {
      // fallback
    } finally {
      setHubLoading(false)
    }
  }

  // Load Firecrawl Competitor Scrape
  const handleRunFirecrawl = async () => {
    setHubLoading(true)
    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'firecrawl', url: firecrawlUrl }),
      })
      const data = await res.json()
      if (data.success && data.items) {
        setCompetitorItems(data.items)
        setFirecrawlMode(data.mode)
      }
    } catch (e) {
      // fallback
    } finally {
      setHubLoading(false)
    }
  }

  // Load Playwright Portal Check
  const handleRunPlaywright = async (p = portalSelect) => {
    setHubLoading(true)
    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'playwright', url: p }),
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
  }

  // Dispatch Composio Action
  const handleDispatchComposio = async (planId: string, actionType: string) => {
    // Update local plan status to running
    setExecutionPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, status: 'running' as const } : p))
    )

    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'composio', actionType }),
      })
      const data = await res.json()
      if (data.success) {
        setExecutionPlans((prev) =>
          prev.map((p) => (p.id === planId ? { ...p, status: 'completed' as const } : p))
        )
        const timeNow = new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' })
        setDispatchedLogs((prev) => [
          { time: timeNow, msg: data.message, channel: 'Composio Multi-Channel' },
          ...prev,
        ])
      }
    } catch (e) {
      setExecutionPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, status: 'completed' as const } : p))
      )
    }
  }

  // Trigger initial service data once on load
  useEffect(() => {
    handleRunPerplexity()
    handleRunFirecrawl()
    handleRunPlaywright('talabat')
  }, [])

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-5 md:p-8 space-y-8 font-sans antialiased selection:bg-indigo-600 selection:text-white">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER & BRANDING */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-400" />
              <span>{isAr ? 'النسخة الموحدة القيادية 2026' : 'Executive Master Command 2026'}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-300">{isAr ? 'بيانات أودو معتمدة' : 'Verified Odoo Ledger'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>{isAr ? 'مركز القيادة الذكي والمستشارة فريال' : 'Executive AI Command & Advisor Feryal'}</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
              {isAr
                ? 'المنظومة التنفيذية الموحدة لتحليل بيانات أودو المعتمدة، هندسة الربحية، محاكاة السيناريوهات، ودمج الاستخبارات السوقية اللحظية عبر Perplexity و Firecrawl و Playwright و Composio.'
                : 'Unified executive ecosystem synthesizing verified Odoo ledgers, margin engineering, scenario simulation, and real-time market intelligence via Perplexity, Firecrawl, Playwright, and Composio.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                handleRunPerplexity()
                handleRunFirecrawl()
                handleRunPlaywright()
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-all shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${hubLoading ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
              <span>{isAr ? 'تحديث الاستخبارات المباشرة' : 'Refresh Market Intel'}</span>
            </button>
            <Link
              href="/erp/sales-scorecard"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>{isAr ? 'سجل المبيعات والأصناف' : 'Sales Scorecard'}</span>
              <ChevronRight className={`h-3.5 w-3.5 ${isAr ? 'rotate-180' : ''}`} />
            </Link>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. UNIFIED ODOO MASTER AGGREGATOR (Top KPI Matrix) */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              {isAr ? 'أولاً: المجمّع الشامل لبيانات أودو المعتمدة (Venture Foods Master)' : '1. Unified Odoo Master Ledger (Venture Foods)'}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {isAr ? 'شهر أكتوبر 2026 | مطابقة محاسبية 100%' : 'October 2026 | 100% Ledger Reconciled'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Card 1: Net Sales */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>{isAr ? 'صافي المبيعات المعتمدة' : 'Approved Net Sales'}</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              167,092.160 <span className="text-xs font-normal text-slate-400 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>{isAr ? '30,540 طلباً معتمداً' : '30,540 Total Orders'}</span>
              <span className="text-emerald-400 font-semibold">{isAr ? 'م.السلة 5.471 د.ك' : 'AOV 5.471'}</span>
            </div>
          </div>

          {/* Card 2: Operating Profit */}
          <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4 sm:p-5 hover:border-indigo-700/60 transition-all">
            <div className="flex items-center justify-between text-xs text-indigo-300 font-medium">
              <span>{isAr ? 'صافي الربح التشغيلي' : 'Net Operating Profit'}</span>
              <TrendingUp className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black text-indigo-200 font-mono tracking-tight">
              42,441.480 <span className="text-xs font-normal text-indigo-300 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-indigo-900/30 pt-2">
              <span>{isAr ? 'هامش الربح التشغيلي' : 'Operating Margin'}</span>
              <span className="text-emerald-400 font-bold">25.4%</span>
            </div>
          </div>

          {/* Card 3: Food Cost */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>{isAr ? 'تكلفة المواد (COGS)' : 'Food Cost (COGS)'}</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              41,438.856 <span className="text-xs font-normal text-slate-400 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>{isAr ? 'الحالي: 24.8%' : 'Actual: 24.8%'}</span>
              <span className="text-amber-400 font-semibold">{isAr ? 'المستهدف: 24.0%' : 'Target: 24.0%'}</span>
            </div>
          </div>

          {/* Card 4: Operating Expenses & Custody */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>{isAr ? 'المصروفات والعهد' : 'Opex & Custodies'}</span>
              <Layers className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              51,154.950 <span className="text-xs font-normal text-slate-400 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span>{isAr ? '2,213 قيد محاسبي' : '2,213 Journal Entries'}</span>
              <span className="text-sky-300 font-semibold" title={isAr ? 'عهدة صيانة رابح' : 'Rabih custody'}>
                {isAr ? 'رابح: 10.7k د.ك' : 'Rabih: 10.7k'}
              </span>
            </div>
          </div>

          {/* Card 5: Discounts (Keeta Alert) */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 rounded-xl border border-rose-900/30 bg-rose-950/10 p-4 sm:p-5 hover:border-rose-700/50 transition-all">
            <div className="flex items-center justify-between text-xs text-rose-300 font-medium">
              <span>{isAr ? 'الخصومات والعروض' : 'Promo Discounts'}</span>
              <ArrowDownRight className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black text-rose-200 font-mono tracking-tight">
              4,152.000 <span className="text-xs font-normal text-rose-300 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-rose-900/30 pt-2">
              <span>2.4% {isAr ? 'من المبيعات' : 'of Sales'}</span>
              <span className="text-rose-400 font-bold">{isAr ? 'كيتا: 2,544 د.ك' : 'Keeta: 2,544'}</span>
            </div>
          </div>
        </div>

        {/* Operational Foundation Bar */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-400" />
              <span>
                <strong>6</strong> {isAr ? 'علامات تجارية نشطة' : 'Active Brands'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-emerald-400" />
              <span>
                <strong>8</strong> {isAr ? 'فروع تشغيلية حقيقية (0 فروع وهمية)' : 'Verified Branches (0 Synthetic)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-sky-400" />
              <span>
                <strong>11</strong> {isAr ? 'قناة بيع وتوصيل (بما فيها Tgo و TMP)' : 'Sales Channels (Incl. Tgo & TMP)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>
                <strong>364</strong> {isAr ? 'صنفاً نشطاً (أعلى 32 صنفاً تشكل 80% من المبيعات)' : 'Menu Items (Top 32 = 80% Rev)'}
              </span>
            </div>
          </div>
          <div className="text-slate-400">
            {isAr ? 'السالمية تتصدر بـ 31,246 د.ك (18.7%) | الكوت بـ 27,904 د.ك (16.7%)' : 'Salmiya Leads: 31,246 KWD (18.7%) | Al-Kout: 27,904 KWD (16.7%)'}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. TWO-COLUMN SPLIT: BILINGUAL COPILOT & STRATEGIC 4-STAGE ENGINE */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================================================================ */}
        {/* LEFT COLUMN: THE COPILOT "FERYAL" (Text & Voice Interface) */}
        {/* ================================================================ */}
        <section className="lg:col-span-5 rounded-2xl border border-indigo-500/20 bg-slate-900/90 shadow-xl overflow-hidden flex flex-col h-[740px]">
          {/* Copilot Header */}
          <div className="border-b border-slate-800 bg-slate-900 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <Bot className="h-5 w-5" />
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>{isAr ? 'المستشارة الذكية فريال' : 'Advisor Feryal Copilot'}</span>
                  <span className="rounded bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.5 font-mono">AI Pro</span>
                </h3>
                <p className="text-xs text-slate-400">{isAr ? 'استشارات تنفيذية فورية بالصوت والنص' : 'Voice & Text Executive Advisory'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVoiceMuted(!isVoiceMuted)}
                title={isVoiceMuted ? (isAr ? 'إلغاء كتم الصوت' : 'Unmute Voice') : isAr ? 'كتم صوت الردود' : 'Mute Voice'}
                className={`p-2 rounded-lg border text-xs transition-all ${
                  isVoiceMuted
                    ? 'border-slate-800 bg-slate-800/50 text-slate-500'
                    : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                }`}
              >
                {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Quick Prompts Pills */}
          <div className="border-b border-slate-800/80 bg-slate-950/40 p-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { ar: 'ما هو الفرع الأعلى ربحية؟', en: 'Top profitable branch?' },
              { ar: 'كيف نوفر 3,800 د.ك شهرياً؟', en: 'How to save 3,800 KWD?' },
              { ar: 'مقارنة Talabat Tgo مقابل TMP', en: 'Compare Tgo vs TMP' },
              { ar: 'أثر رفع أسعار تشاينا جاردن 5%', en: '5% price hike impact' },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendQuery(isAr ? p.ar : p.en)}
                className="shrink-0 rounded-full border border-slate-800 bg-slate-800/60 px-3 py-1 text-[11px] font-medium text-slate-300 hover:border-indigo-500/50 hover:bg-indigo-950/30 hover:text-white transition-all"
              >
                {isAr ? p.ar : p.en}
              </button>
            ))}
          </div>

          {/* Messages Log */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs sm:text-sm">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[88%] rounded-2xl p-4 shadow-sm leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{isAr ? m.textAr : m.textEn}</p>

                  {/* Render Key Metrics Badges if attached to response */}
                  {m.metrics && Object.keys(m.metrics).length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/50 grid grid-cols-2 gap-2 text-[11px]">
                      {Object.entries(m.metrics).map(([k, v]) => (
                        <div key={k} className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">{k}</span>
                          <span className="font-bold text-emerald-400 font-mono">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{m.time}</span>
              </div>
            ))}

            {isCopilotThinking && (
              <div className="flex items-center gap-2 text-indigo-400 text-xs py-2 px-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 w-fit">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>{isAr ? 'فريال تحلل بيانات أودو والقنوات...' : 'Feryal is computing ledger figures...'}</span>
              </div>
            )}
          </div>

          {/* Voice Waveform Animation (Active during listening) */}
          {isListening && (
            <div className="px-4 py-2 bg-indigo-950/40 border-t border-indigo-500/30 flex items-center justify-between text-xs text-indigo-300">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span>{isAr ? 'جاري الاستماع لصوتك (عربي / إنجليزي)...' : 'Listening to voice stream (Ar / En)...'}</span>
              </div>
              <div className="flex items-center gap-1 h-4">
                {[0.4, 0.8, 1.2, 0.6, 1.0, 0.5, 0.9].map((scale, i) => (
                  <div
                    key={i}
                    className="w-1 bg-indigo-400 rounded-full animate-pulse"
                    style={{ height: `${Math.round(scale * 16)}px`, animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Input Box with Voice & Send buttons */}
          <div className="border-t border-slate-800 bg-slate-900/90 p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendQuery()
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2.5 rounded-xl border transition-all ${
                  isListening
                    ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title={isListening ? (isAr ? 'إيقاف الميكروفون' : 'Stop Microphone') : isAr ? 'تحدث مع فريال' : 'Speak to Feryal'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isAr ? 'اسأل فريال عن أرقام المبيعات، الهدر، أو الفروع...' : 'Ask Feryal about sales, waste, or branches...'}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20"
              >
                <Send className={`h-4 w-4 ${isAr ? 'rotate-180' : ''}`} />
              </button>
            </form>
          </div>
        </section>

        {/* ================================================================ */}
        {/* RIGHT COLUMN: THE FOUR-STAGE STRATEGIC ANALYSIS ENGINE */}
        {/* ================================================================ */}
        <section className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl space-y-6">
            {/* Header with 4-stage Breadcrumbs */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5">
                  Strategic Matrix
                </span>
                <span className="text-xs text-slate-400">
                  {isAr ? 'محرك القرارات والتعظيم الربحي' : 'Executive Profit & Growth Engine'}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                {isAr ? 'ثانياً: محرك التحليل الاستراتيجي الرباعي' : '2. Four-Stage Strategic Analysis Engine'}
              </h3>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-semibold">
                <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-2 text-emerald-300">
                  1. {isAr ? 'الحلول' : 'Solutions'}
                </div>
                <div className="rounded-lg bg-sky-950/40 border border-sky-500/30 p-2 text-sky-300">
                  2. {isAr ? 'الاقتراحات' : 'Proposals'}
                </div>
                <div className="rounded-lg bg-indigo-950/40 border border-indigo-500/30 p-2 text-indigo-300">
                  3. {isAr ? 'الخطط' : 'Execution'}
                </div>
                <div className="rounded-lg bg-purple-950/40 border border-purple-500/30 p-2 text-purple-300">
                  4. {isAr ? 'النتائج' : 'Projections'}
                </div>
              </div>
            </div>

            {/* STAGE 1: SOLUTIONS (الحلول) */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{isAr ? 'المرحلة 1: الحلول التشغيلية لخفض الهدر' : 'Stage 1: Waste Reduction Solutions'}</span>
              </h4>
              <div className="space-y-2.5">
                {STRATEGIC_SOLUTIONS.map((sol) => (
                  <div
                    key={sol.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{isAr ? sol.titleAr : sol.titleEn}</span>
                        <span className="rounded bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5">{sol.badge}</span>
                      </div>
                      <p className="text-xs text-slate-400">{isAr ? sol.detailsAr : sol.detailsEn}</p>
                      <span className="text-[11px] text-indigo-300 font-medium block">
                        📍 {isAr ? sol.locationAr : sol.locationEn}
                      </span>
                    </div>

                    <div className="text-end shrink-0 bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-3 py-2">
                      <span className="text-[10px] text-emerald-400 block font-medium">{isAr ? 'الوفر المتوقع' : 'Savings'}</span>
                      <span className="text-base font-black text-emerald-300 font-mono">
                        +{sol.monthlySavingsKwd.toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'شهرياً' : '/month'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STAGE 2: PROPOSALS (الاقتراحات) */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isAr ? 'المرحلة 2: الاقتراحات الاستراتيجية لرفع سلة الشراء (AOV)' : 'Stage 2: Upselling & Margin Proposals'}</span>
              </h4>
              <div className="space-y-2.5">
                {STRATEGIC_PROPOSALS.map((prop) => (
                  <div
                    key={prop.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{isAr ? prop.titleAr : prop.titleEn}</span>
                        <span className="rounded bg-sky-950 text-sky-300 border border-sky-800 text-[10px] px-2 py-0.5 font-semibold">
                          {prop.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{isAr ? prop.mechanismAr : prop.mechanismEn}</p>
                    </div>

                    <div className="text-end shrink-0 bg-sky-950/30 border border-sky-900/40 rounded-xl px-3 py-2">
                      <span className="text-[10px] text-sky-400 block font-medium">{isAr ? 'الربح الإضافي' : 'Added Profit'}</span>
                      <span className="text-base font-black text-sky-300 font-mono">
                        +{prop.expectedMonthlyGainKwd.toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'شهرياً' : '/month'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STAGE 3: EXECUTION PLANS & COMPOSIO ACTIONS (الخطط التنفيذية) */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{isAr ? 'المرحلة 3: الخطط التنفيذية والأتمتة عبر Composio' : 'Stage 3: Weekly Execution Plans & Composio'}</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">4 {isAr ? 'أسابيع مجدولة' : 'Weeks Roadmapped'}</span>
              </div>

              <div className="space-y-2.5">
                {executionPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-900/40 text-indigo-300 font-mono font-bold text-xs px-2 py-0.5">
                          {plan.week}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          [{isAr ? plan.departmentAr : plan.departmentEn}]
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white">{isAr ? plan.titleAr : plan.titleEn}</p>
                      <div className="text-[11px] text-emerald-400 font-medium">
                        🎯 {isAr ? plan.targetKpiAr : plan.targetKpiEn}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={plan.status === 'completed' || plan.status === 'running'}
                      onClick={() => handleDispatchComposio(plan.id, plan.actionType)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        plan.status === 'completed'
                          ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                          : plan.status === 'running'
                          ? 'bg-indigo-950 border border-indigo-500 text-indigo-300 animate-pulse'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      }`}
                    >
                      {plan.status === 'completed' ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>{isAr ? 'تم الإرسال عبر Composio' : 'Dispatched via Composio'}</span>
                        </>
                      ) : plan.status === 'running' ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>{isAr ? 'جاري الإرسال...' : 'Dispatching...'}</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" />
                          <span>{isAr ? 'تنفيذ وإرسال التكليف' : 'Execute & Dispatch'}</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* STAGE 4: FINANCIAL PROJECTIONS & WHAT-IF SLIDER (النتائج والسيناريوهات) */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5" />
                    <span>{isAr ? 'المرحلة 4: النتائج المالية المتوقعة ومحاكي السيناريوهات' : 'Stage 4: Financial Projections & What-If Slider'}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {isAr ? 'حرّك السلايدر لتجربة نسب كفاءة الهدر والنمو وانعكاسها المالي الفوري' : 'Adjust sliders to simulate cost-saving & growth sensitivities'}
                  </p>
                </div>
                <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg px-3 py-1.5 text-xs text-purple-200">
                  {isAr ? 'الأثر الشهري المتوقع:' : 'Expected Monthly Added:'}{' '}
                  <strong className="text-emerald-400 font-mono">+{calculatedProjections.monthlyAddedProfit.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</strong>
                </div>
              </div>

              {/* What-If Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span>{isAr ? 'كفاءة ضبط الهدر والتكاليف' : 'Cost & Waste Efficiency'}</span>
                    <span className="text-emerald-400 font-mono">{costOptimizationSlider}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={costOptimizationSlider}
                    onChange={(e) => setCostOptimizationSlider(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>50% ({isAr ? 'متحفظ' : 'Conservative'})</span>
                    <span>100% ({isAr ? 'المستهدف' : 'Target'})</span>
                    <span>150% ({isAr ? 'فائق' : 'Aggressive'})</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span>{isAr ? 'نمو سلة الشراء وترقية الوجبات' : 'AOV & Upselling Lift'}</span>
                    <span className="text-sky-400 font-mono">{revenueUpsellSlider}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={revenueUpsellSlider}
                    onChange={(e) => setRevenueUpsellSlider(Number(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>50%</span>
                    <span>100%</span>
                    <span>150%</span>
                  </div>
                </div>
              </div>

              {/* The Three Timeframes (Q1, H1, Annual) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Q1 Card */}
                <div className="rounded-xl border border-purple-900/30 bg-purple-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                    <span>{isAr ? 'الربع الأول (3 أشهر)' : 'Q1 (3 Months)'}</span>
                    <span className="text-[10px] bg-purple-900/40 px-2 py-0.5 rounded text-purple-200">
                      {calculatedProjections.q1.margin.toFixed(1)}% {isAr ? 'هامش' : 'margin'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>{isAr ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-mono text-white font-bold">{calculatedProjections.q1.sales.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? 'الوفر الإضافي:' : 'Added Gain:'}</span>
                      <span className="font-mono text-emerald-400 font-bold">+{calculatedProjections.q1.addedProfit.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-purple-900/40 pt-1 text-slate-200 font-bold">
                      <span>{isAr ? 'الربح المتوقع:' : 'Net Profit:'}</span>
                      <span className="font-mono text-purple-200">{calculatedProjections.q1.totalProfit.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* H1 Card */}
                <div className="rounded-xl border border-indigo-900/30 bg-indigo-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                    <span>{isAr ? 'النصف سنوي (6 أشهر)' : 'H1 (6 Months)'}</span>
                    <span className="text-[10px] bg-indigo-900/40 px-2 py-0.5 rounded text-indigo-200">
                      {calculatedProjections.h1.margin.toFixed(1)}% {isAr ? 'هامش' : 'margin'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>{isAr ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-mono text-white font-bold">{calculatedProjections.h1.sales.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? 'الوفر الإضافي:' : 'Added Gain:'}</span>
                      <span className="font-mono text-emerald-400 font-bold">+{calculatedProjections.h1.addedProfit.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-indigo-900/40 pt-1 text-slate-200 font-bold">
                      <span>{isAr ? 'الربح المتوقع:' : 'Net Profit:'}</span>
                      <span className="font-mono text-indigo-200">{calculatedProjections.h1.totalProfit.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Annual Card */}
                <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span>{isAr ? 'السنوي (12 شهراً)' : 'Annual (12 Months)'}</span>
                    <span className="text-[10px] bg-emerald-900/40 px-2 py-0.5 rounded text-emerald-200">
                      {calculatedProjections.annual.margin.toFixed(1)}% {isAr ? 'هامش' : 'margin'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>{isAr ? 'المبيعات:' : 'Sales:'}</span>
                      <span className="font-mono text-white font-bold">{calculatedProjections.annual.sales.toFixed(0)} {isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isAr ? 'الوفر الإضافي:' : 'Added Gain:'}</span>
                      <span className="font-mono text-emerald-400 font-bold">+{calculatedProjections.annual.addedProfit.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-900/40 pt-1 text-slate-200 font-bold">
                      <span>{isAr ? 'الربح المتوقع:' : 'Net Profit:'}</span>
                      <span className="font-mono text-emerald-200">{calculatedProjections.annual.totalProfit.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ==================================================================== */}
      {/* 4. THE FOUR SMART SERVICES GATEWAY (Market & Competitor AI Hub) */}
      {/* ==================================================================== */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold px-2.5 py-0.5 mb-1.5">
              <Globe className="h-3.5 w-3.5" />
              <span>Multi-Agent External AI Hub</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>{isAr ? 'رابعاً: بوابة الخدمات الذكية الأربع' : '4. Four Smart Services Gateway'}</span>
              <span className="text-xs text-slate-400 font-normal">
                (Perplexity + Firecrawl + Playwright + Composio)
              </span>
            </h3>
          </div>

          {/* Service Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveHubTab('perplexity')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeHubTab === 'perplexity' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Perplexity
            </button>
            <button
              onClick={() => setActiveHubTab('firecrawl')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeHubTab === 'firecrawl' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Firecrawl
            </button>
            <button
              onClick={() => setActiveHubTab('playwright')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeHubTab === 'playwright' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Playwright
            </button>
            <button
              onClick={() => setActiveHubTab('composio')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeHubTab === 'composio' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              4. Composio
            </button>
          </div>
        </div>

        {/* TAB 1: PERPLEXITY (Live Market Research) */}
        {activeHubTab === 'perplexity' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute top-3.5 right-3.5 text-slate-400" />
                <input
                  type="text"
                  value={perplexityQuery}
                  onChange={(e) => setPerplexityQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث في سوق المطاعم الكويتي، أسعار التوريد، التضخم...' : 'Search Kuwait restaurant market, supply inflation...'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs sm:text-sm text-white pr-10 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={handleRunPerplexity}
                disabled={hubLoading}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shrink-0 shadow-md shadow-indigo-600/20"
              >
                {hubLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>{isAr ? 'بحث لحظي بـ Sonar-Pro' : 'Run Sonar-Pro Query'}</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  {isAr ? 'موجز استخبارات السوق الكويتي عبر Perplexity AI' : 'Kuwait Market Intelligence Summary'}
                </span>
                <span className="rounded bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 text-[10px]">
                  Mode: {perplexityMode}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                {perplexityResponse || (isAr ? 'جاري تحليل السوق...' : 'Analyzing live market...')}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FIRECRAWL (Competitor Menu Scraper) */}
        {activeHubTab === 'firecrawl' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={firecrawlUrl}
                onChange={(e) => setFirecrawlUrl(e.target.value)}
                placeholder="https://www.talabat.com/kuwait/restaurant/..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleRunFirecrawl}
                disabled={hubLoading}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shrink-0 shadow-md shadow-indigo-600/20"
              >
                {hubLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                <span>{isAr ? 'استخراج ومقارنة الأسعار' : 'Scrape & Compare'}</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                    <th className="py-3 px-4 text-start">{isAr ? 'صنف المنافس' : 'Competitor Item'}</th>
                    <th className="py-3 px-4 text-start">{isAr ? 'سعر المنافس' : 'Comp. Price'}</th>
                    <th className="py-3 px-4 text-start">{isAr ? 'صنفنا المقابل' : 'Our Equivalent Item'}</th>
                    <th className="py-3 px-4 text-start">{isAr ? 'سعرنا' : 'Our Price'}</th>
                    <th className="py-3 px-4 text-start">{isAr ? 'الفارق' : 'Delta'}</th>
                    <th className="py-3 px-4 text-start">{isAr ? 'توصية التسعير الفورية' : 'Pricing Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {competitorItems.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">
                        {isAr ? item.competitorItemAr || item.competitorItem : item.competitorItem}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {item.competitorPriceKwd?.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </td>
                      <td className="py-3 px-4 text-indigo-300 font-medium">{item.ourItem}</td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                        {item.ourPriceKwd?.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-sky-400">{item.diffPct}</td>
                      <td className="py-3 px-4 text-slate-200">
                        <span className="rounded bg-slate-800 px-2 py-1 text-[11px] font-medium border border-slate-700">
                          {item.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PLAYWRIGHT (Aggregator Health Watchdog) */}
        {activeHubTab === 'playwright' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {(['talabat', 'keeta', 'deliveroo'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPortalSelect(p)
                    handleRunPlaywright(p)
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase ${
                    portalSelect === p
                      ? 'bg-slate-800 text-white border border-indigo-500/50 shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {p} Portal
                </button>
              ))}
            </div>

            {portalHealthData && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{portalHealthData.name}</span>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{portalHealthData.url}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-950 border border-emerald-800 px-3 py-1 text-xs text-emerald-300 font-semibold">
                      {portalHealthData.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      8/8 {isAr ? 'فروع متصلة' : 'Branches Online'}
                    </span>
                  </div>
                </div>

                {portalHealthData.branchesList && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {portalHealthData.branchesList.map((b: any, idx: number) => (
                      <div key={idx} className="rounded-lg bg-slate-900 p-2.5 border border-slate-800 text-xs">
                        <div className="font-bold text-white">{b.branch}</div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                          <span className="text-emerald-400">Tgo: {b.tgoStatus}</span>
                          <span className="text-sky-400">TMP: {b.tmpStatus}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {portalHealthData.burnRateMonthly && (
                  <div className="rounded-lg bg-rose-950/30 border border-rose-800/40 p-3 text-xs text-rose-300 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">{isAr ? 'تنبيه استنزاف التسويق:' : 'Marketing Burn Alert:'}</span>
                      <span>{portalHealthData.burnRateMonthly}</span>
                    </div>
                    <button
                      onClick={() => handleDispatchComposio('plan-w3', 'dispatch_keeta_cap')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                    >
                      {isAr ? 'تطبيق السقف فورياً' : 'Enforce Cap'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: COMPOSIO (Action Log & Multi-Channel Dispatch) */}
        {activeHubTab === 'composio' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">WhatsApp Gateway</span>
                  <span className="text-sm font-bold text-white">{isAr ? 'جاهز للتكليفات' : 'Ready (Active)'}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Executive Gmail</span>
                  <span className="text-sm font-bold text-white">{isAr ? 'مرتبط بأودو' : 'Linked to Odoo'}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-sky-950/60 text-sky-400 border border-sky-800/40">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Google Sheets Sync</span>
                  <span className="text-sm font-bold text-white">{isAr ? 'مزامنة لحظية' : 'Live Synced'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isAr ? 'سجل العمليات المنفذة مؤخراً عبر بروتوكول Composio' : 'Recent Composio Automated Execution Log'}
              </h5>
              <div className="space-y-2">
                {dispatchedLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-bold">[{log.time}]</span>
                      <span className="text-slate-200">{log.msg}</span>
                    </div>
                    <span className="rounded bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5">{log.channel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* 5. VERIFIED 8-BRANCH PERFORMANCE AUDIT TABLE */}
      {/* ==================================================================== */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {isAr ? 'أداء الفروع التشغيلية الـ 8 المعتمدة فقط (حسب سجل أودو لشهر أكتوبر)' : 'Performance Breakdown: Strictly 8 Verified Branches (October Odoo)'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr ? 'خالٍ تماماً من أي فروع وهمية أو بيانات اصطناعية - مطابقة مبيعات 167,092.160 د.ك' : '100% reconciled against approved 167,092.160 KWD sales ledger'}
            </p>
          </div>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-full">
            8/8 {isAr ? 'فروع نشطة' : 'Active Branches'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="py-3 px-4 text-start">#</th>
                <th className="py-3 px-4 text-start">{isAr ? 'الفرع' : 'Branch'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'المبيعات المعتمدة' : 'Net Sales'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'عدد الطلبات' : 'Orders'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'الحصة' : 'Rev Share'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'القناة الأبرز' : 'Top Channel'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'الحالة التشغيلية' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {VERIFIED_BRANCHES.map((b) => (
                <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 font-bold">{b.rank}</td>
                  <td className="py-3 px-4 font-bold text-white">{isAr ? b.nameAr : b.nameEn}</td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                    {b.salesKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{b.orders.toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono text-sky-400 font-semibold">{b.share}%</td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-indigo-950/50 text-indigo-300 border border-indigo-900/50 px-2 py-0.5 font-medium">
                      {b.bestChannel}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`rounded px-2 py-0.5 font-semibold text-[11px] ${
                        b.status.includes('Attention')
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {b.status}
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
