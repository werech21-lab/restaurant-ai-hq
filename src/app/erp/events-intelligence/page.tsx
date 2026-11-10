'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  Mic,
  MicOff,
  Volume2,
  Send,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Sliders,
  Search,
  ShieldCheck,
  RefreshCw,
  Activity,
  Zap,
  Store,
  ChevronRight,
  Building2,
  FileSpreadsheet,
  Calendar,
  Award,
  AlertTriangle,
  FileCheck,
  Truck,
  Flame,
  Filter,
  Upload,
  FileText,
  Copy,
  Check,
  Scale,
  Lightbulb,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getOpenAIApiKey, getGeminiApiKey } from '@/lib/ai-keys'
import {
  askFeryalGeminiBrain,
  analyzeEventContractWithGemini,
  type ContractDeepAuditResult,
} from '@/lib/feryal-gemini-brain'
import { ContractSafetyScoreCard, EventCashflowCurve, ExbModerationCards, RiskTags } from '@/components/aether/EventsUpgrades'
import { downloadCsv } from '@/components/aether/ui'
import { EXB_ODOO, ExbOdooUnitCard } from '@/components/aether/ExbOdooUnit'
import { LEDGER } from '@/lib/aether/ledger'

// ==============================================================================
// 1. MASTER EVENTS, CONTRACTS & EXB MENU DATASETS (ODOO ANALYTICAL ACCOUNTS)
// ==============================================================================
interface EventStudioPreset {
  id: string
  nameAr: string
  nameEn: string
  locationAr: string
  locationEn: string
  durationDays: number
  boothRentKwd: number
  setupCapexKwd: number
  staffLogisticsKwd: number
  dailyOrders: number
  aovKwd: number
  spaceAndPowerAr: string
  spaceAndPowerEn: string
  audienceAr: string
  audienceEn: string
  contractTextAr: string
  contractTextEn: string
  descriptionAr: string
  descriptionEn: string
  visionAr: string
  visionEn: string
}

const STUDIO_PRESETS: EventStudioPreset[] = [
  {
    id: 'marina-kashta',
    nameAr: 'كشتة المارينا',
    nameEn: 'Marina Kashta',
    locationAr: 'مارينا كريسنت - السالمية',
    locationEn: 'Marina Crescent - Salmiya',
    durationDays: 60,
    boothRentKwd: 4600,
    setupCapexKwd: 2200,
    staffLogisticsKwd: 2400,
    dailyOrders: 112,
    aovKwd: 5.714,
    spaceAndPowerAr: 'بوث 4×4م · كهرباء ثلاثية الطور (60 أمبير)',
    spaceAndPowerEn: '4x4m Booth · 3-Phase (60 Amp)',
    audienceAr: 'عائلات وشباب — 8,500 زائر يومياً',
    audienceEn: 'Families & Youth — 8,500 daily footfall',
    contractTextAr: `عقد ترخيص استغلال بوث موسمي - فعالية كشتة المارينا 2026:
البند 1: مدة العقد 60 يوماً تبدأ من 1 نوفمبر حتى 30 ديسمبر.
البند 2: القيمة الإيجارية المقطوعة 4,600 د.ك تدفع مقدماً، بالإضافة إلى تأمين مسترد 500 د.ك.
البند 4: القيمة الإيجارية غير قابلة للاسترداد في حال إغلاق الفعالية بسبب الأمطار أو الأحوال الجوية.
البند 7: يلتزم المستأجر بسداد رسوم النظافة والأمن والخدمات حسب ما يقرره المنظم شهرياً.
البند 9: يوفر المنظم نقطة كهرباء رئيسية، ويتحمل المستأجر تمديدات اللوحة الداخلية وإصدار ترخيص البلدية المؤقت.
البند 11: تطبق غرامة تأخير 100 د.ك عن كل يوم تأخير في افتتاح البوث أو نقص الشهادات الصحية.`,
    contractTextEn: `Seasonal Booth Lease Agreement - Marina Kashta 2026:
Clause 1: Lease term is 60 calendar days from Nov 1 to Dec 30.
Clause 2: Total base rent is 4,600 KWD payable upfront, plus 500 KWD refundable security deposit.
Clause 4: Base rent is strictly non-refundable during event closures caused by rain or adverse weather.
Clause 7: Tenant shall pay monthly cleaning, security, and general service charges as assessed by the Organizer.
Clause 9: Organizer provides main power point; Tenant is responsible for internal distribution panel and temporary Municipality permit.
Clause 11: A delay penalty of 100 KWD/day applies for late booth opening or missing Ministry of Health certificates.`,
    descriptionAr:
      'موقع استراتيجي على الواجهة البحرية في السالمية بجوار منطقة الجلوس العائلية، ذروة المبيعات من الساعة 5:00 مساءً حتى 12:30 منتصف الليل.',
    descriptionEn:
      'Prime seafront location at Marina Crescent Salmiya next to the main family seating zone; peak traffic from 5:00 PM to 12:30 AM.',
    visionAr:
      'أريد مشاركة ببراند تشاينا جاردن وفرانكس بمنيو معارض مركزة (8 أصناف سريعة التحضير أقل من 90 ثانية) بدون هدر، مع إلزامية المشروبات وتجهيز 85% من الأصناف في مطبخ العارضية المركزي.',
    visionEn:
      'Deploy China Garden & Frank’s with an 8-item high-speed EXB Menu (<90s assembly), zero raw prep waste on-site, mandatory beverage combo upsell, and 85% pre-marinated supply from Ardiya Central Kitchen.',
  },
  {
    id: 'al-safeer',
    nameAr: 'مخيم السفير',
    nameEn: 'Al-Safeer Camp',
    locationAr: 'منطقة المخيمات الربيعية - صبحان/الوفرة',
    locationEn: 'Spring Desert Camp Zone - Subhan',
    durationDays: 45,
    boothRentKwd: 3100,
    setupCapexKwd: 1800,
    staffLogisticsKwd: 1650,
    dailyOrders: 105,
    aovKwd: 5.68,
    spaceAndPowerAr: 'كونتينر مجهز 6×3م · مولد ثلاثي الطور',
    spaceAndPowerEn: '6x3m Container · 3-Phase Generator',
    audienceAr: 'رواد المخيمات والعائلات — 6,000 زائر يومياً',
    audienceEn: 'Campers & Families — 6,000 daily visitors',
    contractTextAr: `عقد استئجار نقطة بيع موسمية - مخيم السفير:
البند 1: مدة التشغيل 45 يوماً خلال موسم التخييم الشتوي.
البند 2: إيجار البوث 3,100 د.ك شامل موقع الكونتينر ومنطقة الجلوس الخارجية.
البند 4: لا يحق للمستأجر المطالبة بتعويض عن أيام العواصف الترابية أو الأمطار.
البند 7: رسوم خدمات المولدات الكهربائية والنظافة تقدر بنسبة 12% من الإيجار.
البند 9: يلتزم المستأجر بمعايير السلامة وقوة الإطفاء العام وتوفير طفايات الحريق التلقائية.`,
    contractTextEn: `Seasonal Point-of-Sale Lease - Al-Safeer Camp:
Clause 1: Operating duration is 45 days during the winter camping season.
Clause 2: Booth rent is 3,100 KWD inclusive of container pad and outdoor seating zone.
Clause 4: No rent credit shall be issued for sandstorm or rain closure days.
Clause 7: Generator fuel, maintenance, and cleaning surcharge assessed at 12% of base rent.
Clause 9: Tenant must comply with Kuwait Fire Force regulations and install automatic hood suppression.`,
    descriptionAr:
      'إقبال كثيف جداً في عطلة نهاية الأسبوع (الخميس والجمعة والسبت) وطلب مرتفع على الوجبات الساخنة والمشروبات وأكواب الذرة.',
    descriptionEn:
      'Heavy weekend surge (Thu–Sat) with high demand for hot handheld meals, warm sweet corn cups, and specialty mojitos.',
    visionAr:
      'التركيز على أصناف طحينة وفارم براون الساخنة مع بوكسات المشاركة العائلية ورفع هامش ربح المشروبات إلى 85% لتعظيم التدفق النقدي.',
    visionEn:
      'Focus on hot Tahina shawarma & Farm Brown chicken cones plus family sharing boxes, driving 85% beverage margin and rapid weekend turnover.',
  },
  {
    id: 'winterland-new',
    nameAr: 'ونترلاند الكويت / فعالية شتوية جديدة',
    nameEn: 'Winterland / New Winter Festival',
    locationAr: 'مشرف / الواجهة البحرية',
    locationEn: 'Mishref / Waterfront Arena',
    durationDays: 90,
    boothRentKwd: 6500,
    setupCapexKwd: 3000,
    staffLogisticsKwd: 3600,
    dailyOrders: 120,
    aovKwd: 5.75,
    spaceAndPowerAr: 'بوث مزدوج 6×4م · كهرباء ثلاثية الطور (100 أمبير)',
    spaceAndPowerEn: '6x4m Double Booth · 3-Phase (100 Amp)',
    audienceAr: 'حشود ترفيهية ضخمة — 14,000 زائر يومياً',
    audienceEn: 'High-volume festival crowd — 14,000 daily visitors',
    contractTextAr: `مسودة عقد رعاية وتشغيل بوث مطاعم - مهرجان ونترلاند الشتوي:
البند 1: مدة المهرجان 90 يوماً متواصلة.
البند 2: بدل الإيجار 6,500 د.ك + نسبة 8% من المبيعات الإجمالية عبر نظام نقاط البيع الموحد.
البند 4: يتحمل المستأجر كافة تكاليف التجهيز والديكور الخارجي المعتمد من إدارة المهرجان.
البند 7: رسوم الخدمات المركزية والنظافة والأمن غير محددة بسقف مسبق.
البند 9: يشترط تقديم الوجبات في عبوات صديقة للبيئة معتمدة ووقت خدمة لا يتجاوز دقيقتين.`,
    contractTextEn: `Draft F&B Booth Operating Contract - Winterland Festival:
Clause 1: Festival duration is 90 consecutive days.
Clause 2: Base rent is 6,500 KWD plus 8% revenue share via centralized POS.
Clause 4: Tenant bears all custom booth facade and fit-out expenses.
Clause 7: Central utility, waste management, and security fees are billed at cost without a preset cap.
Clause 9: All items must be served in approved eco-packaging with service speed under 2 minutes.`,
    descriptionAr:
      'مهرجان ترفيهي ضخم يمتد 3 أشهر، يتطلب قدرة إنتاجية عالية جداً في ساعات الذروة وتوريداً يومياً على فترتين من مطبخ العارضية المركزي.',
    descriptionEn:
      '90-day mega entertainment festival requiring high peak-hour throughput and twice-daily chilled supply runs from Ardiya Central Kitchen.',
    visionAr:
      'التفاوض لإلغاء نسبة الـ 8% من المبيعات والاكتفاء بالإيجار الثابت، وتشغيل خط مزدوج لنودلز تشاينا جاردن ونودلز ذا نودل بار لتحقيق مبيعات تتجاوز 54,000 د.ك.',
    visionEn:
      'Negotiate removal of the 8% revenue share in favor of fixed rent, operating a dual wok & smash-grill line to exceed 54,000 KWD in sales.',
  },
]

interface BrandMatrixItem {
  id: string
  nameAr: string
  nameEn: string
  prepMinutes: number
  walkabilityScore: number
  grossMarginPct: number
  specialtyAr: string
  specialtyEn: string
}

const VENTURE_BRANDS: BrandMatrixItem[] = [
  {
    id: 'China Garden',
    nameAr: 'تشاينا جاردن',
    nameEn: 'China Garden',
    prepMinutes: 2.2,
    walkabilityScore: 98,
    grossMarginPct: 79.5,
    specialtyAr: 'علب النودلز الساخنة وروبيان الداينمايت سريعة التقديم',
    specialtyEn: 'Hot Wok Noodle Boxes & Dynamite Shrimp Cups',
  },
  {
    id: "Frank's",
    nameAr: 'فرانكس',
    nameEn: "Frank's",
    prepMinutes: 2.8,
    walkabilityScore: 95,
    grossMarginPct: 77.2,
    specialtyAr: 'سلايدرز فيلي تشيز ستيك الفاخرة سهلة الأكل أثناء المشي',
    specialtyEn: 'Handheld Philly CheeseSteak Sliders',
  },
  {
    id: 'Tahina',
    nameAr: 'طحينة',
    nameEn: 'Tahina',
    prepMinutes: 2.0,
    walkabilityScore: 96,
    grossMarginPct: 80.4,
    specialtyAr: 'بطاطس شاورما محملة وبوكسات المشويات العصرية',
    specialtyEn: 'Loaded Shawarma Fries & Modern Grill Cups',
  },
  {
    id: 'The Noodle Bar',
    nameAr: 'ذا نودل بار',
    nameEn: 'The Noodle Bar',
    prepMinutes: 3.1,
    walkabilityScore: 94,
    grossMarginPct: 76.8,
    specialtyAr: 'بوكسات نودلز الووك مع المشروب الإلزامي',
    specialtyEn: 'Wok Noodle Boxes',
  },
  {
    id: 'Farm Brown',
    nameAr: 'فارم براون',
    nameEn: 'Farm Brown',
    prepMinutes: 2.5,
    walkabilityScore: 97,
    grossMarginPct: 78.9,
    specialtyAr: 'أقماع الدجاج المقرمش مع الصوصات المميزة',
    specialtyEn: 'Crispy Chicken Strips Cones & Dipping Cups',
  },
  {
    id: 'Karak Cafeteria',
    nameAr: 'كرك كافتيريا',
    nameEn: 'Karak Cafeteria',
    prepMinutes: 2.9,
    walkabilityScore: 92,
    grossMarginPct: 77.5,
    specialtyAr: 'ساندويتشات ساخنة وأكواب الذرة والموهيتو',
    specialtyEn: 'Artisan Melts, Warm Corn Cups & Mojitos',
  },
]

interface ExbMenuItem {
  id: string
  itemAr: string
  itemEn: string
  brandId: string
  brandAr: string
  brandEn: string
  branchPriceKwd: number
  exbPriceKwd: number
  cogsPct: number
  prepTimeSec: number
  unitMarginKwd: number
  categoryAr: string
  categoryEn: string
}

const EXB_MENU_ITEMS: ExbMenuItem[] = [
  {
    id: 'exb-1',
    itemAr: 'بوكس نودلز الدجاج بالووك',
    itemEn: 'Chicken Noodles Box - China Garden',
    brandId: 'China Garden',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    branchPriceKwd: 2.5,
    exbPriceKwd: 2.75,
    cogsPct: 19.8,
    prepTimeSec: 75,
    unitMarginKwd: 2.205,
    categoryAr: 'طبق رئيسي سريع',
    categoryEn: 'Fast Wok Main',
  },
  {
    id: 'exb-2',
    itemAr: 'كوب داينمايت شريمب المقرمش',
    itemEn: 'Dynamite Shrimp Cup',
    brandId: 'China Garden',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    branchPriceKwd: 2.95,
    exbPriceKwd: 3.25,
    cogsPct: 23.4,
    prepTimeSec: 85,
    unitMarginKwd: 2.49,
    categoryAr: 'الأكثر مبيعاً بالمعارض',
    categoryEn: 'Booth Bestseller',
  },
  {
    id: 'exb-3',
    itemAr: 'سلايدرز فيلي تشيز ستيك (قطعتان)',
    itemEn: "Philly CheeseSteak Sliders - Frank's",
    brandId: "Frank's",
    brandAr: 'فرانكس',
    brandEn: "Frank's",
    branchPriceKwd: 3.2,
    exbPriceKwd: 3.5,
    cogsPct: 24.2,
    prepTimeSec: 90,
    unitMarginKwd: 2.653,
    categoryAr: 'بريميوم محمول',
    categoryEn: 'Handheld Premium',
  },
  {
    id: 'exb-4',
    itemAr: 'بطاطس شاورما محملة بالطحينة',
    itemEn: 'Loaded Shawarma Fries - Tahina',
    brandId: 'Tahina',
    brandAr: 'طحينة',
    brandEn: 'Tahina',
    branchPriceKwd: 2.25,
    exbPriceKwd: 2.5,
    cogsPct: 20.5,
    prepTimeSec: 65,
    unitMarginKwd: 1.988,
    categoryAr: 'تحضير فائق السرعة',
    categoryEn: 'Ultra-Fast Cup',
  },
  {
    id: 'exb-5',
    itemAr: 'وجبة نودلز ذا نودل بار كومبو',
    itemEn: 'Sriracha Chicken Noodles',
    brandId: 'The Noodle Bar',
    brandAr: 'ذا نودل بار',
    brandEn: 'The Noodle Bar',
    branchPriceKwd: 3.1,
    exbPriceKwd: 3.4,
    cogsPct: 23.8,
    prepTimeSec: 90,
    unitMarginKwd: 2.591,
    categoryAr: 'وجبة متكاملة',
    categoryEn: 'High-AOV Combo',
  },
  {
    id: 'exb-6',
    itemAr: 'قمع ستربس الدجاج المقرمش مع صوص',
    itemEn: 'Crispy Strips Cone - Farm Brown',
    brandId: 'Farm Brown',
    brandAr: 'فارم براون',
    brandEn: 'Farm Brown',
    branchPriceKwd: 2.1,
    exbPriceKwd: 2.35,
    cogsPct: 21.0,
    prepTimeSec: 70,
    unitMarginKwd: 1.856,
    categoryAr: 'أكل أثناء المشي',
    categoryEn: 'Walk & Eat Cone',
  },
  {
    id: 'exb-7',
    itemAr: 'كوب الذرة الحلوة الساخنة بالزبدة',
    itemEn: 'Sweet Corn Warm Cup',
    brandId: 'Karak Cafeteria',
    brandAr: 'كرك كافتيريا',
    brandEn: 'Karak Cafeteria',
    branchPriceKwd: 1.0,
    exbPriceKwd: 1.25,
    cogsPct: 16.0,
    prepTimeSec: 35,
    unitMarginKwd: 1.05,
    categoryAr: 'هامش ربح 84%',
    categoryEn: '84% Pure Margin',
  },
  {
    id: 'exb-8',
    itemAr: 'مشروب المعرض الإلزامي / موهيتو التوت',
    itemEn: 'Mandatory Event Soft Drink / Mojito',
    brandId: 'Karak Cafeteria',
    brandAr: 'كرك كافتيريا',
    brandEn: 'Karak Cafeteria',
    branchPriceKwd: 0.9,
    exbPriceKwd: 1.1,
    cogsPct: 14.5,
    prepTimeSec: 25,
    unitMarginKwd: 0.94,
    categoryAr: 'مشروب كومبو إلزامي',
    categoryEn: 'Mandatory Upsell',
  },
]

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
    text = text.replace(/\bEXB\b/gi, ' منيو المعارض ')
    text = text.replace(/\bROI\b/gi, ' العائد على الاستثمار ')
  } else {
    text = text.replace(/\bKWD\b/gi, ' Kuwaiti Dinars ')
    text = text.replace(/د\.ك/g, ' Kuwaiti Dinars ')
    text = text.replace(/%/g, ' percent ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

export default function EventsContractsExbIntelligenceHub() {
  const { locale: ctxLocale } = useI18n()

  // Dynamic reactive locale synced with top navbar (`EN | عربي`)
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

  useEffect(() => {
    if (ctxLocale === 'en' || ctxLocale === 'ar') {
      setActiveLocale(ctxLocale)
    }
  }, [ctxLocale])

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

  const currentLang = ctxLocale === 'en' || ctxLocale === 'ar' ? ctxLocale : activeLocale
  const isAr = currentLang === 'ar'

  // ============================================================================
  // UNIT 1 STATES: CONTRACT, DESCRIPTION & VISION DEEP-ANALYSIS STUDIO
  // ============================================================================
  const [selectedPresetId, setSelectedPresetId] = useState<string>('marina-kashta')
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all')

  // Field 1: Contract Upload & Text
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | undefined>(undefined)
  const [uploadedFileMime, setUploadedFileMime] = useState<string | undefined>(undefined)
  const [contractTextAr, setContractTextAr] = useState<string>(STUDIO_PRESETS[0].contractTextAr)
  const [contractTextEn, setContractTextEn] = useState<string>(STUDIO_PRESETS[0].contractTextEn)

  // Field 2: General Description & Field Parameters
  const [eventNameAr, setEventNameAr] = useState<string>(STUDIO_PRESETS[0].nameAr)
  const [eventNameEn, setEventNameEn] = useState<string>(STUDIO_PRESETS[0].nameEn)
  const [eventLocationAr, setEventLocationAr] = useState<string>(STUDIO_PRESETS[0].locationAr)
  const [eventLocationEn, setEventLocationEn] = useState<string>(STUDIO_PRESETS[0].locationEn)
  const [spacePowerAr, setSpacePowerAr] = useState<string>(STUDIO_PRESETS[0].spaceAndPowerAr)
  const [spacePowerEn, setSpacePowerEn] = useState<string>(STUDIO_PRESETS[0].spaceAndPowerEn)
  const [audienceAr, setAudienceAr] = useState<string>(STUDIO_PRESETS[0].audienceAr)
  const [audienceEn, setAudienceEn] = useState<string>(STUDIO_PRESETS[0].audienceEn)
  const [descriptionTextAr, setDescriptionTextAr] = useState<string>(STUDIO_PRESETS[0].descriptionAr)
  const [descriptionTextEn, setDescriptionTextEn] = useState<string>(STUDIO_PRESETS[0].descriptionEn)

  // Field 3: Executive Vision & Strategic Concept
  const [visionTextAr, setVisionTextAr] = useState<string>(STUDIO_PRESETS[0].visionAr)
  const [visionTextEn, setVisionTextEn] = useState<string>(STUDIO_PRESETS[0].visionEn)

  // Financial Simulator Sliders (Synced with Studio)
  const [durationDays, setDurationDays] = useState<number>(STUDIO_PRESETS[0].durationDays)
  const [boothRentKwd, setBoothRentKwd] = useState<number>(STUDIO_PRESETS[0].boothRentKwd)
  const [setupCapexKwd, setSetupCapexKwd] = useState<number>(STUDIO_PRESETS[0].setupCapexKwd)
  const [staffLogisticsKwd, setStaffLogisticsKwd] = useState<number>(STUDIO_PRESETS[0].staffLogisticsKwd)
  const [dailyOrders, setDailyOrders] = useState<number>(STUDIO_PRESETS[0].dailyOrders)
  const [aovKwd, setAovKwd] = useState<number>(STUDIO_PRESETS[0].aovKwd)

  // Deep Analysis Output State (Unit 2)
  const [isAnalyzingContract, setIsAnalyzingContract] = useState<boolean>(false)
  const [copiedClauseIdx, setCopiedClauseIdx] = useState<number | null>(null)
  const [deepAuditResult, setDeepAuditResult] = useState<ContractDeepAuditResult>({
    risksAr: [
      'البند 4 (القوة القاهرة والأحوال الجوية): ينص العقد الحالي على عدم استرداد الإيجار (4,600 د.ك) عند إغلاق الفعالية بسبب الأمطار الغزيرة أو الأحوال الجوية.',
      'البند 7 (رسوم الخدمات والنظافة والأمن): رسوم خدمات شهرية مفتوحة غير مسقفة قد تضيف 12% إلى 15% فوق القيمة الإيجارية المتفق عليها.',
      'البند 9 (المواصفات الفنية والكهرباء): عدم النص صراحةً على توفير قاطع كهرباء ثلاثي الطور بقدرة 60 أمبير مستقل لتشغيل قلايات البوث وأجهزة الووك.',
      'البند 11 (غرامات التأخير والتراخيص): غرامة 100 د.ك يومياً عن أي تأخير في إصدار ترخيص بلدية الكويت المؤقت أو الشهادات الصحية.',
    ],
    risksEn: [
      'Clause 4 (Force Majeure & Weather): Contract states booth rent (4,600 KWD) is non-refundable during rain or severe weather closures.',
      'Clause 7 (Uncapped Service & Cleaning Fees): Open-ended monthly organizer charges that could inflate total lease cost by 12%–15%.',
      'Clause 9 (Technical & 3-Phase Power): No explicit guarantee of a dedicated 3-Phase (60 Amp) breaker required for Wok stations and commercial fryers.',
      'Clause 11 (Delay Penalties & MOCI/Municipality Permits): 100 KWD/day penalty even if temporary municipality permit issuance is delayed by the organizer.',
    ],
    counterClausesAr: [
      'صيغة تعديل البند 4: "في حال إغلاق الفعالية كلياً أو جزئياً بسبب الأحوال الجوية أو بقرار إداري، يتم تمديد مدة العقد مجاناً بنفس عدد أيام الإغلاق أو خصم قيمتها النسبية من الدفعة النهائية."',
      'صيغة تعديل البند 7: "تُحدد كافة رسوم الخدمات والحراسة والنظافة واستهلاك الكهرباء والمياه بسقف مقطوع لا يتجاوز 5% من إجمالي القيمة الإيجارية طوال مدة المعرض."',
      'صيغة تعديل البند 9: "يلتزم المنظم بتوفير مصدر كهرباء ثلاثي الطور بقدرة 60 أمبير مستقل للبوث قبل 72 ساعة من الافتتاح، ويُعفى المستأجر من الإيجار عن أي يوم ينقطع فيه التيار."',
    ],
    counterClausesEn: [
      'Amended Clause 4: "In the event of full or partial closure due to adverse weather or regulatory order, the lease term shall be extended free of charge by the equivalent days or deducted pro-rata from the final installment."',
      'Amended Clause 7: "All organizer service, security, cleaning, water, and utility charges shall be strictly capped at a flat maximum of 5% of base rent."',
      'Amended Clause 9: "The Organizer guarantees a dedicated 3-Phase (60 Amp) power feed 72 hours prior to opening; any power outage day shall be rent-exempt."',
    ],
    solutionsAr: [
      'ضبط سرعة الخدمة تحت 90 ثانية: تجهيز وتتبيل 85% من الأصناف مسبقاً بحصص معايرة (140 جم) في مطبخ العارضية المركزي والاكتفاء بالتسوية السريعة في البوث.',
      'هندسة التسعير والكومبو (+10%): تطبيق أسعار منيو المعارض مع إلزامية المشروب/الموهيتو لرفع متوسط الفاتورة إلى 5.714 د.ك وتخفيض تكلفة الأغذية إلى 21.4%.',
      'إدارة طوابير الذروة المسائية (6 م - 11 م): تخصيص كاشير متنقل بجهاز KNET لاسلكي في طابور الانتظار لفصل الدفع عن شباك الاستلام.',
      'ربط مركز التكلفة في أودو: فتح حساب تحليلي مستقل لمركز المعارض 2026 لمراقبة نقطة التعادل اليومية (58 طلباً/يومياً) واسترداد رأس المال في اليوم الـ 14.',
    ],
    solutionsEn: [
      'Sub-90-Second Booth Service: Pre-portion and marinate 85% of items in 140g calibrated batches at Ardiya Central Kitchen for rapid final sear at the booth.',
      'EXB Pricing & Combo Engineering (+10%): Deploy the 8-item EXB Menu with mandatory beverage/mojito upsell to sustain a 5.714 KWD AOV and 21.4% COGS.',
      'Peak Queue Management (6 PM – 11 PM): Deploy a mobile handheld KNET/Apple Pay cashier along the queue to decouple payment from order pickup.',
      'Odoo Analytical Cost Center: Track daily break-even (58 orders / 330.600 KWD per day) under an isolated Odoo ledger to achieve full payback by Day 14.',
    ],
    verdictBadgeAr: '✅ يوصى بالاعتماد مع تعديل البند 4 (الطقس) والبند 7 (سقف الخدمات 5%)',
    verdictBadgeEn: '✅ Approved for Signing Subject to Amending Clause 4 (Weather) & Clause 7 (5% Fee Cap)',
    voiceSummaryAr:
      'يا هلا! قمت بتشريح عقد وتصور فعالية كشتة المارينا لمدة 60 يوماً بإيجار 4,600 دينار كويتي. الجدوى المالية ممتازة بصافي ربح متوقع يتجاوز 11,900 دينار كويتي وعائد استثمار 175 بالمئة، وأنصحك بتوقيع العقد بعد تعديل البند الرابع لتعويض أيام الأمطار والبند السابع لتسقيف رسوم الخدمات بخمسة بالمئة.',
    voiceSummaryEn:
      'I have audited the Marina Kashta 60-day booth contract at 4,600 Kuwaiti Dinars rent. Financial feasibility is outstanding with over 11,900 Kuwaiti Dinars in net profit and 175 percent ROI. I recommend signing immediately after amending Clause 4 for weather closures and capping service charges at 5 percent in Clause 7.',
    recommendedBrandId: 'China Garden',
  })

  // Load Preset Handler
  const handleLoadStudioPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const p = STUDIO_PRESETS.find((item) => item.id === presetId)
    if (!p) return
    setContractTextAr(p.contractTextAr)
    setContractTextEn(p.contractTextEn)
    setEventNameAr(p.nameAr)
    setEventNameEn(p.nameEn)
    setEventLocationAr(p.locationAr)
    setEventLocationEn(p.locationEn)
    setSpacePowerAr(p.spaceAndPowerAr)
    setSpacePowerEn(p.spaceAndPowerEn)
    setAudienceAr(p.audienceAr)
    setAudienceEn(p.audienceEn)
    setDescriptionTextAr(p.descriptionAr)
    setDescriptionTextEn(p.descriptionEn)
    setVisionTextAr(p.visionAr)
    setVisionTextEn(p.visionEn)
    setDurationDays(p.durationDays)
    setBoothRentKwd(p.boothRentKwd)
    setSetupCapexKwd(p.setupCapexKwd)
    setStaffLogisticsKwd(p.staffLogisticsKwd)
    setDailyOrders(p.dailyOrders)
    setAovKwd(p.aovKwd)
  }

  // File Upload / Drag & Drop Handler (converts PDF/Image/TXT to Base64 for Gemini inlineData)
  const handleFileUpload = (file: File | null) => {
    if (!file) return
    setUploadedFileName(file.name)
    const mime = file.type || 'application/pdf'
    setUploadedFileMime(mime)

    if (file.type.startsWith('text/')) {
      const textReader = new FileReader()
      textReader.onload = () => {
        if (typeof textReader.result === 'string') {
          if (isAr) setContractTextAr(textReader.result)
          else setContractTextEn(textReader.result)
        }
      }
      textReader.readAsText(file)
    }

    const b64Reader = new FileReader()
    b64Reader.onloadend = () => {
      const res = typeof b64Reader.result === 'string' ? b64Reader.result : ''
      const b64 = res.includes(',') ? res.split(',')[1] : ''
      setUploadedFileBase64(b64)
    }
    b64Reader.readAsDataURL(file)
  }

  // ============================================================================
  // VOICE & AUDIO ENGINE (OPENAI NOVA + FALLBACK SPEECH)
  // ============================================================================
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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
    setIsListening(false)
  }, [])

  const fallbackSpeechSynthesis = useCallback((rawText: string, lang: 'ar' | 'en') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
      const clean = sanitizeTextForSpeechClient(rawText, lang)
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.lang = lang === 'ar' ? 'ar-XA' : 'en-US'
      utterance.rate = 1.0
      utterance.onend = () => setPlayingMsgId(null)
      utterance.onerror = () => setPlayingMsgId(null)
      window.speechSynthesis.speak(utterance)
    } catch {
      setPlayingMsgId(null)
    }
  }, [])

  const playFeryalSpeech = useCallback(
    async (text: string, msgId?: string) => {
      if (isVoiceMuted) return
      stopAllMicTracks()

      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      const activeLang = isAr ? 'ar' : 'en'
      const activeId = msgId || 'verdict-voice'
      setPlayingMsgId(activeId)
      const cleanText = sanitizeTextForSpeechClient(text, activeLang) || text

      try {
        await new Promise((resolve) => setTimeout(resolve, 380))
        const apiKey = getOpenAIApiKey()
        let audioUrl = ''

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
            }
          } catch {}
        }

        if (!audioUrl) {
          const shortText = cleanText.slice(0, 200)
          audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${
            activeLang === 'en' ? 'en' : 'ar'
          }&q=${encodeURIComponent(shortText)}`
        }

        const player = audioPlayerRef.current
        if (player) {
          player.pause()
          player.src = audioUrl
          player.load()
          player.onplay = () => setPlayingMsgId(activeId)
          player.onpause = () => setPlayingMsgId(null)
          player.onended = () => setPlayingMsgId(null)
          player.onerror = () => {
            setPlayingMsgId(null)
            fallbackSpeechSynthesis(cleanText, activeLang)
          }
          player.play().catch(() => fallbackSpeechSynthesis(cleanText, activeLang))
          return
        }
      } catch {
        fallbackSpeechSynthesis(cleanText, activeLang)
      }
    },
    [fallbackSpeechSynthesis, isAr, isVoiceMuted, stopAllMicTracks]
  )

  // Trigger Deep Contract & Vision Analysis via Gemini 3.8 Pro + OpenAI Nova Voice
  const handleRunDeepContractAnalysis = useCallback(async () => {
    setIsAnalyzingContract(true)
    try {
      const audit = await analyzeEventContractWithGemini({
        contractText: isAr ? contractTextAr : contractTextEn,
        eventDescription: `${isAr ? descriptionTextAr : descriptionTextEn} | ${
          isAr ? spacePowerAr : spacePowerEn
        } | ${isAr ? audienceAr : audienceEn}`,
        executiveVision: isAr ? visionTextAr : visionTextEn,
        eventName: isAr ? eventNameAr : eventNameEn,
        durationDays,
        boothRentKwd,
        attachmentBase64: uploadedFileBase64,
        attachmentMimeType: uploadedFileMime,
        lang: isAr ? 'ar' : 'en',
      })
      setDeepAuditResult(audit)
      const spokenVerdict = isAr ? audit.voiceSummaryAr : audit.voiceSummaryEn
      playFeryalSpeech(spokenVerdict, 'deep-audit-verdict')
    } finally {
      setIsAnalyzingContract(false)
    }
  }, [
    isAr,
    contractTextAr,
    contractTextEn,
    descriptionTextAr,
    descriptionTextEn,
    spacePowerAr,
    spacePowerEn,
    audienceAr,
    audienceEn,
    visionTextAr,
    visionTextEn,
    eventNameAr,
    eventNameEn,
    durationDays,
    boothRentKwd,
    uploadedFileBase64,
    uploadedFileMime,
    playFeryalSpeech,
  ])

  // Live 3-Scenario Feasibility Calculations (Unit 3)
  const simulationResults = useMemo(() => {
    const fixedCosts = boothRentKwd + setupCapexKwd + staffLogisticsKwd
    const cogsRate = 0.214 // 21.4% EXB Menu COGS
    const packagingAndPosRate = 0.036 // 3.6% disposables & KNET fees
    const contributionMarginRate = 1 - cogsRate - packagingAndPosRate // 75%
    const contributionPerOrder = aovKwd * contributionMarginRate

    const dailyFixedCost = fixedCosts / Math.max(durationDays, 1)
    const breakEvenOrdersPerDay = Math.ceil(dailyFixedCost / Math.max(contributionPerOrder, 0.1))
    const breakEvenSalesPerDay = breakEvenOrdersPerDay * aovKwd

    const buildScenario = (trafficMultiplier: number) => {
      const ordersPerDay = Math.round(dailyOrders * trafficMultiplier)
      const totalOrders = ordersPerDay * durationDays
      const grossSales = totalOrders * aovKwd
      const variableCosts = grossSales * (cogsRate + packagingAndPosRate)
      const totalCosts = fixedCosts + variableCosts
      const netProfit = grossSales - totalCosts
      const netMarginPct = grossSales > 0 ? (netProfit / grossSales) * 100 : 0
      const roiPct = fixedCosts > 0 ? (netProfit / fixedCosts) * 100 : 0
      const dailyNetContribution = ordersPerDay * contributionPerOrder - staffLogisticsKwd / Math.max(durationDays, 1)
      const paybackDay =
        dailyNetContribution > 0
          ? Math.min(durationDays, Math.max(1, Math.ceil((boothRentKwd + setupCapexKwd) / dailyNetContribution)))
          : durationDays + 1
      const safetyMarginPct =
        ordersPerDay > 0 ? Math.max(0, ((ordersPerDay - breakEvenOrdersPerDay) / ordersPerDay) * 100) : 0
      const staffIncentiveKwd = netProfit > 0 ? netProfit * 0.06 : 0

      return {
        ordersPerDay,
        totalOrders,
        grossSales,
        totalCosts,
        netProfit,
        netMarginPct,
        roiPct,
        paybackDay,
        safetyMarginPct,
        staffIncentiveKwd,
      }
    }

    return {
      fixedCosts,
      breakEvenOrdersPerDay,
      breakEvenSalesPerDay,
      conservative: buildScenario(0.75),
      base: buildScenario(1.0),
      optimistic: buildScenario(1.3),
    }
  }, [durationDays, boothRentKwd, setupCapexKwd, staffLogisticsKwd, dailyOrders, aovKwd])

  // Table Filters & Movable Columns (`◀ ▶`)
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('')
  const [benchmarkSearchQuery, setBenchmarkSearchQuery] = useState<string>('')
  const [exbView, setExbView] = useState<'cards' | 'table'>('cards')
  const [exbColumnsOrder, setExbColumnsOrder] = useState<string[]>([
    'item',
    'brand',
    'branchPrice',
    'exbPrice',
    'cogs',
    'prepTime',
    'unitMargin',
  ])
  const [benchmarkColumnsOrder, setBenchmarkColumnsOrder] = useState<string[]>([
    'event',
    'duration',
    'rentSetup',
    'sales',
    'netProfit',
    'roi',
    'evaluation',
  ])

  const moveColumn = (
    cols: string[],
    setCols: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    direction: 'left' | 'right'
  ) => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= cols.length) return
    const next = [...cols]
    const temp = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = temp
    setCols(next)
  }

  const filteredExbItems = useMemo(() => {
    return EXB_MENU_ITEMS.filter((item) => {
      const matchesBrand = selectedBrandId === 'all' || item.brandId === selectedBrandId
      const q = menuSearchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        item.itemAr.toLowerCase().includes(q) ||
        item.itemEn.toLowerCase().includes(q) ||
        item.brandAr.toLowerCase().includes(q) ||
        item.brandEn.toLowerCase().includes(q)
      return matchesBrand && matchesSearch
    })
  }, [selectedBrandId, menuSearchQuery])

  const exportExbCsv = useCallback(() => {
    const labels: Record<string, { ar: string; en: string }> = {
      item: { ar: 'الصنف', en: 'EXB item' },
      brand: { ar: 'العلامة التجارية', en: 'Brand' },
      branchPrice: { ar: 'سعر الفرع', en: 'Branch price KWD' },
      exbPrice: { ar: 'سعر المعرض', en: 'EXB booth price KWD' },
      cogs: { ar: 'نسبة التكلفة', en: 'COGS %' },
      prepTime: { ar: 'وقت التحضير (ثانية)', en: 'Prep time (sec)' },
      unitMargin: { ar: 'هامش الوحدة', en: 'Unit margin KWD' },
    }
    const value = (row: ExbMenuItem, key: string): string | number => {
      if (key === 'item') return isAr ? row.itemAr : row.itemEn
      if (key === 'brand') return isAr ? row.brandAr : row.brandEn
      if (key === 'branchPrice') return row.branchPriceKwd.toFixed(3)
      if (key === 'exbPrice') return row.exbPriceKwd.toFixed(3)
      if (key === 'cogs') return row.cogsPct.toFixed(1)
      if (key === 'prepTime') return row.prepTimeSec
      return row.unitMarginKwd.toFixed(3)
    }
    downloadCsv('aetherbi-exb-menu-matrix.csv', [
      exbColumnsOrder.map((k) => (isAr ? labels[k].ar : labels[k].en)),
      ...filteredExbItems.map((r) => exbColumnsOrder.map((k) => value(r, k))),
    ])
  }, [exbColumnsOrder, filteredExbItems, isAr])

  const comparisonRows = useMemo(() => {
    const rows = [
      {
        id: 'marina',
        nameAr: 'كشتة المارينا (مرجع تاريخي فعلي)',
        nameEn: 'Marina Kashta (Verified Historical)',
        durationDays: 60,
        rentAndSetupKwd: 6800,
        salesKwd: 38400,
        netProfitKwd: 11920,
        roiPct: 175,
        badgeAr: '⭐ أداء ممتاز - يوصى بالتجديد',
        badgeEn: '⭐ Excellent Performance - Renew',
        tone: 'emerald' as const,
      },
      {
        id: 'safeer',
        nameAr: 'مخيم السفير (مرجع تاريخي فعلي)',
        nameEn: 'Al-Safeer Camp (Verified Historical)',
        durationDays: 45,
        rentAndSetupKwd: 4900,
        salesKwd: 26850,
        netProfitKwd: 7840,
        roiPct: 160,
        badgeAr: '✅ أداء قوي - هامش مشروبات مرتفع',
        badgeEn: '✅ Strong Yield - High Beverage Margin',
        tone: 'blue' as const,
      },
      {
        id: 'winterland',
        nameAr: 'ونترلاند الكويت (معرض موسمي)',
        nameEn: 'Winterland Seasonal Booth',
        durationDays: 90,
        rentAndSetupKwd: 9500,
        salesKwd: 54200,
        netProfitKwd: 15600,
        roiPct: 164,
        badgeAr: '🔥 ذروة موسمية - تدفق عائلي مرتفع',
        badgeEn: '🔥 Seasonal Peak - High Footfall',
        tone: 'emerald' as const,
      },
      {
        id: 'current-contract',
        nameAr: `العقد قيد الدراسة حالياً: ${eventNameAr}`,
        nameEn: `Current Contract Under Study: ${eventNameEn}`,
        durationDays,
        rentAndSetupKwd: boothRentKwd + setupCapexKwd,
        salesKwd: Math.round(simulationResults.base.grossSales),
        netProfitKwd: Math.round(simulationResults.base.netProfit),
        roiPct: Math.round(simulationResults.base.roiPct),
        badgeAr: deepAuditResult.verdictBadgeAr,
        badgeEn: deepAuditResult.verdictBadgeEn,
        tone: simulationResults.base.roiPct >= 90 ? ('emerald' as const) : ('amber' as const),
      },
    ]

    const q = benchmarkSearchQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.nameAr.toLowerCase().includes(q) ||
        r.nameEn.toLowerCase().includes(q) ||
        r.badgeAr.toLowerCase().includes(q) ||
        r.badgeEn.toLowerCase().includes(q)
    )
  }, [
    eventNameAr,
    eventNameEn,
    durationDays,
    boothRentKwd,
    setupCapexKwd,
    simulationResults,
    deepAuditResult,
    benchmarkSearchQuery,
  ])

  // Unit 6: Executive Approval Pack State
  const [approvalPackOpen, setApprovalPackOpen] = useState<boolean>(false)
  const [approvalPackTime, setApprovalPackTime] = useState<string>('')

  // Voice Question Input inside Verdict Card
  const [voiceQuestionInput, setVoiceQuestionInput] = useState<string>('')

  const handleAskQuickVoiceQuestion = useCallback(
    async (question: string) => {
      if (!question.trim()) return
      setIsAnalyzingContract(true)
      try {
        const res = await askFeryalGeminiBrain({
          query: `${question}\n[Contract Event: ${isAr ? eventNameAr : eventNameEn}, Rent: ${boothRentKwd} KWD, Duration: ${durationDays} days, Net Profit: ${Math.round(
            simulationResults.base.netProfit
          )} KWD, ROI: ${Math.round(simulationResults.base.roiPct)}%, Break-Even: ${
            simulationResults.breakEvenOrdersPerDay
          } orders/day]`,
          lang: isAr ? 'ar' : 'en',
        })
        setDeepAuditResult((prev) => ({
          ...prev,
          voiceSummaryAr: isAr ? res.reply : prev.voiceSummaryAr,
          voiceSummaryEn: !isAr ? res.reply : prev.voiceSummaryEn,
        }))
        playFeryalSpeech(res.reply, 'quick-voice-answer')
        setVoiceQuestionInput('')
      } finally {
        setIsAnalyzingContract(false)
      }
    },
    [isAr, eventNameAr, eventNameEn, boothRentKwd, durationDays, simulationResults, playFeryalSpeech]
  )

  const toggleMicForStudio = useCallback(async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
      stopAllMicTracks()
      return
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream
        const mr = new MediaRecorder(stream)
        audioChunksRef.current = []

        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
        }

        mr.onstop = async () => {
          stopAllMicTracks()
          if (audioChunksRef.current.length === 0) return
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          audioChunksRef.current = []
          setIsTranscribing(true)
          try {
            const base64Audio = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const res = typeof reader.result === 'string' ? reader.result : ''
                resolve(res.includes(',') ? res.split(',')[1] : '')
              }
              reader.onerror = () => resolve('')
              reader.readAsDataURL(blob)
            })
            if (base64Audio && getGeminiApiKey()) {
              const gemRes = await askFeryalGeminiBrain({
                lang: isAr ? 'ar' : 'en',
                audioBase64: base64Audio,
                mimeType: 'audio/webm',
              })
              if (gemRes.transcript) {
                if (isAr) setVisionTextAr(gemRes.transcript)
                else setVisionTextEn(gemRes.transcript)
                handleAskQuickVoiceQuestion(gemRes.transcript)
              }
            }
          } finally {
            setIsTranscribing(false)
          }
        }

        mediaRecorderRef.current = mr
        mr.start(250)
        setIsListening(true)
      }
    } catch {
      stopAllMicTracks()
    }
  }, [isListening, isAr, handleAskQuickVoiceQuestion, stopAllMicTracks])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="ae-stagger text-slate-900 dark:text-slate-100 space-y-6 font-sans antialiased"
    >
      {/* ==================================================================== */}
      {/* TOP HEADER & 5 EXECUTIVE EVENT KPI CARDS (Unslop UI) */}
      {/* ==================================================================== */}
      <div className="ae-tile rounded-2xl p-5 sm:p-6  space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Calendar className="h-3.5 w-3.5 text-sky-600" />
              <span>
                {isAr
                  ? 'مركز استخبارات الفعاليات وتحليل العقود · حسابات أودو التحليلية'
                  : 'Events, Contracts & EXB Menu Deep Intelligence · Odoo Analytical Accounts'}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                {isAr
                  ? 'العقل: جيميناي أرجون هاي · الصوت: نوفا'
                  : 'Brain: Gemini Argon High · Voice: Nova'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              {isAr
                ? 'مركز استخبارات الفعاليات وتحليل العقود وهندسة منيو المعارض'
                : 'Events, Contracts & EXB Menu Deep Intelligence Hub'}
            </h1>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 max-w-4xl">
              {isAr
                ? 'استوديو التحليل العميق لعقود المعارض والبوثات الموسمية (كشتة المارينا، مخيم السفير، ونترلاند)، كشف المخاطر القانونية، محاكاة السيناريوهات الـ 3، وهندسة منيو المعارض السريعة.'
                : 'Deep contract auditing studio for seasonal exhibitions (Marina Kashta, Al-Safeer Camp, Winterland), legal counter-clauses, 3-scenario financial simulation, and EXB Menu engineering.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/erp/feryal-ai"
              className="ae-pill-light"
            >
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>{isAr ? 'مركز القيادة والمستشارة فريال' : 'Feryal Executive Command'}</span>
            </Link>
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

        {/* 5 High-Contrast Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
          <div className="ae-tile-soft ae-lift rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{isAr ? 'مبيعات المعارض (أودو)' : 'EXB Sales (Odoo)'}</span>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums">
              {EXB_ODOO.sales.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-bold text-slate-500 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span>{isAr ? `${EXB_ODOO.orders.toLocaleString('en-US')} طلباً` : `${EXB_ODOO.orders.toLocaleString('en-US')} Orders`}</span>
              <span className="text-slate-900 dark:text-white">{isAr ? `السلة: ${EXB_ODOO.aov.toFixed(3)} د.ك` : `AOV: ${EXB_ODOO.aov.toFixed(3)} KWD`}</span>
            </div>
          </div>

          <div className="ae-tile-soft ae-lift rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{isAr ? 'الربح التشغيلي للمعارض (أودو)' : 'EXB Operating Profit (Odoo)'}</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              {EXB_ODOO.profit.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-bold text-emerald-800 font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span>{isAr ? 'هامش التشغيل' : 'Operating margin'}</span>
              <span className="text-emerald-700 dark:text-emerald-400">{EXB_ODOO.marginPct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="ae-tile-soft ae-lift rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{isAr ? 'تكلفة أغذية المعارض (أودو)' : 'EXB COGS (Odoo)'}</span>
              <Flame className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums">
              {EXB_ODOO.cogsPct.toFixed(1)}% <span className="text-xs font-bold text-amber-600 font-sans">{isAr ? '(المستهدف 21.4%)' : '(target 21.4%)'}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span>{isAr ? `المجموعة: ${LEDGER.cogsPct}%` : `Group: ${LEDGER.cogsPct}%`}</span>
              <span className="text-emerald-700 dark:text-emerald-400">{isAr ? '8 أصناف مركزة' : '8 Focused Items'}</span>
            </div>
          </div>

          <div className="ae-tile-soft ae-lift rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{isAr ? 'نقطة التعادل اليومية للبوث (محاكاة)' : 'Daily Break-Even (simulated)'}</span>
              <Activity className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums">
              {isAr ? '58 طلباً/يومياً' : '58 Orders/Day'}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span>{isAr ? '330.600 د.ك/يوم' : '330.600 KWD/d'}</span>
              <span className="text-blue-700 dark:text-blue-400">{isAr ? 'الاسترداد: اليوم 14' : 'Payback: Day 14'}</span>
            </div>
          </div>

          <div className="ae-tile-soft ae-lift rounded-2xl p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{isAr ? 'العائد الموسمي (محاكاة)' : 'Seasonal Event ROI (simulated)'}</span>
              <Award className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1.5 text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              +168.5%
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
              <span>{isAr ? 'حساب أودو التحليلي' : 'Odoo Analytical'}</span>
              <span className="text-slate-900 dark:text-white">{isAr ? 'مركز المعارض 2026' : 'ANL-EXB-2026'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Odoo actuals of the Exhibitions & Booths (EXB) unit */}
      <ExbOdooUnitCard lang={isAr ? 'ar' : 'en'} />

      {/* ==================================================================== */}
      {/* UNIT 1: CONTRACT, DESCRIPTION & VISION DEEP-ANALYSIS STUDIO */}
      {/* ==================================================================== */}
      <section className="ae-tile rounded-2xl p-5 sm:p-6  space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white">
                {isAr
                  ? 'أولاً: استوديو إدراج العقد والوصف العام والتصور التنفيذي للتحليل العميق'
                  : '1. Contract, Description & Vision Deep-Analysis Studio'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
              {isAr
                ? 'أرفق ملف عقد الفعالية (أو الصق بنوده)، وأدخل المعطيات الميدانية وتصورك الاستراتيجي ليقوم محرك أرجون هاي بتشريح المخاطر واقتراح البدائل.'
                : 'Upload or paste the booth contract, field parameters, and your executive vision for instant Argon High legal & financial dissection.'}
            </p>
          </div>

          {/* 3 Quick Preset Loaders */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {[
              {
                id: 'marina-kashta',
                ar: '📄 تحميل نموذج عقد وتصور كشتة المارينا',
                en: '📄 Load Marina Kashta Contract & Vision',
              },
              {
                id: 'al-safeer',
                ar: '⛺ تحميل نموذج عقد وتصور مخيم السفير',
                en: '⛺ Load Al-Safeer Camp Contract & Vision',
              },
              {
                id: 'winterland-new',
                ar: '❄️ تحميل نموذج فعالية شتوية جديدة',
                en: '❄️ Load New Winter Festival Contract',
              },
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleLoadStudioPreset(btn.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedPresetId === btn.id
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-2xs'
                    : 'bg-[#F7F7F8] dark:bg-slate-800 text-slate-800 dark:text-slate-200 ring-1 ring-slate-200/80 dark:ring-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {isAr ? btn.ar : btn.en}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Integrated Studio Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* FIELD 1: Contract Upload (Drag & Drop Base64) + Contract Clauses Textarea */}
          <div className="bg-[#F7F7F8] dark:bg-slate-900/60 rounded-2xl p-4 ring-1 ring-slate-200/80 dark:ring-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>
                    {isAr
                      ? '1. إرفاق أو لصق عقد الفعالية'
                      : '1. Contract File Upload & Clauses Text'}
                  </span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  PDF / PNG / JPG / TXT
                </span>
              </div>

              {/* Drag & Drop Zone */}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0] || null
                  handleFileUpload(file)
                }}
                className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 hover:border-blue-500 transition-all cursor-pointer text-center"
              >
                <Upload className="h-5 w-5 text-blue-600 mb-1" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {uploadedFileName
                    ? isAr
                      ? `✅ تم إرفاق: ${uploadedFileName} (جاهز للتحليل عبر جيميناي)`
                      : `✅ Attached: ${uploadedFileName} (Ready for Gemini inlineData)`
                    : isAr
                    ? 'اسحب وأفلت ملف العقد هنا أو اضغط للاختيار'
                    : 'Drag & drop contract file here or click to browse'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  {isAr
                    ? 'يتم تحويل الملف في المتصفح إلى صيغة مشفرة وإرساله مباشرة إلى عقل جيميناي'
                    : 'Converted in-browser to Base64 inlineData for Gemini 3.8 Pro'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                  onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {/* Contract Textarea */}
              <textarea
                rows={6}
                value={isAr ? contractTextAr : contractTextEn}
                onChange={(e) => {
                  if (isAr) setContractTextAr(e.target.value)
                  else setContractTextEn(e.target.value)
                }}
                placeholder={
                  isAr
                    ? 'الصق بنود عقد الفعالية أو الشروط المالية والجزاءات هنا...'
                    : 'Paste booth lease clauses, financial terms, and penalties here...'
                }
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs font-medium text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* FIELD 2: Event General Description & Field Parameters */}
          <div className="bg-[#F7F7F8] dark:bg-slate-900/60 rounded-2xl p-4 ring-1 ring-slate-200/80 dark:ring-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-emerald-600" />
                  <span>
                    {isAr
                      ? '2. الوصف العام والمعطيات الميدانية'
                      : '2. General Description & Field Parameters'}
                  </span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {isAr ? 'معطيات البوث' : 'Field Specs'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'اسم الفعالية' : 'Event Name'}
                  </label>
                  <input
                    type="text"
                    value={isAr ? eventNameAr : eventNameEn}
                    onChange={(e) => (isAr ? setEventNameAr(e.target.value) : setEventNameEn(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'الموقع' : 'Location'}
                  </label>
                  <input
                    type="text"
                    value={isAr ? eventLocationAr : eventLocationEn}
                    onChange={(e) => (isAr ? setEventLocationAr(e.target.value) : setEventLocationEn(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'المدة (أيام) / الإيجار (د.ك)' : 'Days / Rent (KWD)'}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-1/2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      value={boothRentKwd}
                      onChange={(e) => setBoothRentKwd(Number(e.target.value))}
                      className="w-1/2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                    {isAr ? 'المساحة والكهرباء' : 'Space & Power'}
                  </label>
                  <input
                    type="text"
                    value={isAr ? spacePowerAr : spacePowerEn}
                    onChange={(e) => (isAr ? setSpacePowerAr(e.target.value) : setSpacePowerEn(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isAr ? 'الجمهور المتوقع وأوقات الذروة' : 'Expected Crowd & Peak Hours'}
                </label>
                <input
                  type="text"
                  value={isAr ? audienceAr : audienceEn}
                  onChange={(e) => (isAr ? setAudienceAr(e.target.value) : setAudienceEn(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <textarea
                rows={3}
                value={isAr ? descriptionTextAr : descriptionTextEn}
                onChange={(e) => (isAr ? setDescriptionTextAr(e.target.value) : setDescriptionTextEn(e.target.value))}
                placeholder={isAr ? 'وصف عام لموقع البوث وحركة الزوار...' : 'General description of booth location and footfall...'}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs font-medium text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* FIELD 3: Executive Vision & Strategic Concept + Voice Mic Input */}
          <div className="bg-[#F7F7F8] dark:bg-slate-900/60 rounded-2xl p-4 ring-1 ring-slate-200/80 dark:ring-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span>
                    {isAr
                      ? '3. التصور التنفيذي والهدف الاستراتيجي'
                      : '3. Executive Vision & Strategic Concept'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={toggleMicForStudio}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ring-1 ring-slate-300'
                  }`}
                >
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5 text-blue-600" />}
                  <span>
                    {isListening
                      ? isAr
                        ? 'جاري الاستماع...'
                        : 'Listening...'
                      : isAr
                      ? '🎙️ أملِ تصورك صوتياً'
                      : '🎙️ Dictate Vision'}
                  </span>
                </button>
              </div>

              <textarea
                rows={6}
                value={isAr ? visionTextAr : visionTextEn}
                onChange={(e) => (isAr ? setVisionTextAr(e.target.value) : setVisionTextEn(e.target.value))}
                placeholder={
                  isAr
                    ? 'اكتب تصورك الخاص (مثال: أريد مشاركة ببراند سريع التحضير بدون هدر، مع التركيز على كومبو المشروبات وتجهيز 80% من الأصناف في مطبخ العارضية المركزي)...'
                    : 'Enter your executive vision (e.g., fast-prep brand with zero waste, mandatory beverage combo, 80% pre-prep at Ardiya Central Kitchen)...'
                }
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs font-medium text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:border-blue-600"
              />

              {/* Primary Trigger Button */}
              <button
                type="button"
                onClick={handleRunDeepContractAnalysis}
                disabled={isAnalyzingContract}
                className="ae-pill-dark !flex !w-full !justify-center !py-3.5 !text-sm disabled:opacity-60"
              >
                {isAnalyzingContract ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>
                      {isAr
                        ? 'جاري تشريح العقد والتصور عبر عقل أرجون هاي...'
                        : 'Running Deep Contract Audit via Argon High...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {isAr
                        ? 'شغّل التحليل العميق للعقد والتصور عبر عقل أرجون هاي وصوت فريال'
                        : 'Run Deep Contract & Feasibility Analysis (Gemini Argon High + Nova Voice)'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* UNIT 2: AI DEEP AUDIT OUTPUTS (4 UNSLOP UI BENTO CARDS) */}
      {/* ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white">
              {isAr
                ? 'ثانياً: مخرجات التحليل العميق — تشريح العقد والصيغ التفاوضية والحلول وحكم فريال الصوتي'
                : '2. AI Deep Audit Outputs: Contract Risks, Counter-Clauses, Solutions & Feryal Voice Verdict'}
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {isAr ? `الفعالية النشطة: ${eventNameAr}` : `Active Study: ${eventNameEn}`}
          </span>
        </div>

        <ContractSafetyScoreCard
          lang={isAr ? 'ar' : 'en'}
          risks={isAr ? deepAuditResult.risksAr : deepAuditResult.risksEn}
          counterClauses={isAr ? deepAuditResult.counterClausesAr : deepAuditResult.counterClausesEn}
          baseRoiPct={simulationResults.base.roiPct}
          paybackDay={simulationResults.base.paybackDay}
          durationDays={durationDays}
          safetyMarginPct={simulationResults.base.safetyMarginPct}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* CARD 1: Contract Clauses & Risk Audit */}
          <div className="ae-tile rounded-2xl p-5  space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                    {isAr
                      ? '1. تشريح بنود العقد والمخاطر القانونية والتجارية'
                      : '1. Contract Clauses & Legal/Commercial Risk Audit'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isAr
                      ? 'كشف البنود الخطرة والرسوم المخفية واشتراطات البلدية والكهرباء'
                      : 'Identified hazardous clauses, hidden fees, 3-Phase power & MOCI risks'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200">
                {isAr ? `${deepAuditResult.risksAr.length} مخاطر مرصودة` : `${deepAuditResult.risksEn.length} Risks Flagged`}
              </span>
            </div>

            <div className="space-y-2.5">
              {(isAr ? deepAuditResult.risksAr : deepAuditResult.risksEn).map((risk, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-slate-900/60 ring-1 ring-slate-200/80 dark:ring-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed flex items-start gap-2.5"
                >
                  <span className="h-5 w-5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                    !
                  </span>
                  <span className="flex flex-col">
                    <RiskTags text={risk} lang={isAr ? 'ar' : 'en'} />
                    <span>{risk}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 2: Recommended Contract Counter-Clauses (Ready to Copy) */}
          <div className="ae-tile rounded-2xl p-5  space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                    {isAr
                      ? '2. الصيغ التفاوضية البديلة الجاهزة للنسخ'
                      : '2. Recommended Contract Counter-Clauses (Ready to Copy)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isAr
                      ? 'نصوص قانونية وتجارية معدلة لحماية فنتشر فودز وإرسالها للمنظم'
                      : 'Protective legal counter-wording ready to copy and send to the organizer'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200">
                {isAr ? 'جاهز للنسخ' : 'Copy-Ready'}
              </span>
            </div>

            <div className="space-y-2.5">
              {(isAr ? deepAuditResult.counterClausesAr : deepAuditResult.counterClausesEn).map((clause, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-slate-900/60 ring-1 ring-slate-200/80 dark:ring-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed flex items-start justify-between gap-3"
                >
                  <span>{clause}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(clause)
                      setCopiedClauseIdx(idx)
                      setTimeout(() => setCopiedClauseIdx(null), 2000)
                    }}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-700 hover:bg-slate-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedClauseIdx === idx ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-blue-600" />
                        <span>{isAr ? 'نسخ البند' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 3: Tailored Strategic Solutions Based on User Vision */}
          <div className="ae-tile rounded-2xl p-5  space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                    {isAr
                      ? '3. الحلول التشغيلية والتوصيات المبنية على تصورك'
                      : '3. Tailored Strategic & Operational Solutions'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isAr
                      ? 'خطة عملية لضبط سرعة الخدمة تحت 90 ثانية وربط مطبخ العارضية المركزي'
                      : 'Actionable plan for sub-90s booth service, peak queues & Ardiya hub supply'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200">
                {isAr ? '4 حلول معتمدة' : '4 Solutions'}
              </span>
            </div>

            <div className="space-y-2.5">
              {(isAr ? deepAuditResult.solutionsAr : deepAuditResult.solutionsEn).map((sol, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#F7F7F8] dark:bg-slate-900/60 ring-1 ring-slate-200/80 dark:ring-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed flex items-start gap-2.5"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{sol}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 4: Feryal Executive Voice Verdict + Embedded Audio Player */}
          <div className="ae-tile rounded-2xl p-5  flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                      {isAr
                        ? '4. المستشارة الصوتية "فريال" — القرار التنفيذي النهائي'
                        : '4. Feryal Executive Voice Verdict & Audio Briefing'}
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      {isAr
                        ? 'العقل: جيميناي أرجون هاي · الصوت: نوفا'
                        : 'Brain: Gemini Argon High · Voice: Nova'}
                    </span>
                  </div>
                </div>

                {/* Compact Audio Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      playFeryalSpeech(
                        isAr ? deepAuditResult.voiceSummaryAr : deepAuditResult.voiceSummaryEn,
                        'verdict-card'
                      )
                    }
                    className="ae-pill-dark ae-pill-sm"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>{isAr ? '🔊 استمع لحكم فريال' : '🔊 Listen to Verdict'}</span>
                  </button>
                  <audio ref={audioPlayerRef} controls preload="auto" className="h-8 w-40 sm:w-48 rounded-lg" />
                </div>
              </div>

              {/* Executive Verdict Badge */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-300 dark:ring-emerald-800 text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                {isAr ? deepAuditResult.verdictBadgeAr : deepAuditResult.verdictBadgeEn}
              </div>

              {/* Spoken Transcript Box */}
              <div className="p-3.5 rounded-xl bg-[#F7F7F8] dark:bg-slate-900/70 ring-1 ring-slate-200/80 dark:ring-slate-800 text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                {isAr ? deepAuditResult.voiceSummaryAr : deepAuditResult.voiceSummaryEn}
              </div>
            </div>

            {/* Quick Interactive Voice/Text Question to Feryal */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAskQuickVoiceQuestion(voiceQuestionInput)
              }}
              className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={voiceQuestionInput}
                onChange={(e) => setVoiceQuestionInput(e.target.value)}
                placeholder={
                  isAr
                    ? 'اسأل فريال عن أي بند في العقد أو نقطة التعادل...'
                    : 'Ask Feryal about any contract clause or break-even...'
                }
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="ae-pill-dark"
              >
                <span>{isAr ? 'اسأل فريال' : 'Ask Feryal'}</span>
                <Send className={`h-3 w-3 ${isAr ? 'rotate-180' : ''}`} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* UNIT 3: 3-SCENARIO FINANCIAL SIMULATOR & BREAK-EVEN ENGINE */}
      {/* ==================================================================== */}
      <section className="ae-tile rounded-2xl p-5 sm:p-6  space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white">
                {isAr
                  ? 'ثالثاً: محاكي الجدوى المالية التفاعلي ذو الـ 3 سيناريوهات وحاسبة نقطة التعادل'
                  : '3. Interactive 3-Scenario Financial Simulator & Break-Even Engine'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
              {isAr
                ? 'يتحدث تلقائياً من أرقام العقد المرفق أو عبر تحريك المؤشرات لحساب نقطة التعادل اليومية ويوم استرداد رأس المال.'
                : 'Automatically synced with the contract studio above; adjust sliders to simulate Conservative (75%), Base (100%), and Optimistic (130%) traffic.'}
            </p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200 dark:ring-blue-800 text-xs font-extrabold text-blue-900 dark:text-blue-200">
            {isAr
              ? `نقطة التعادل اليومية: ${simulationResults.breakEvenOrdersPerDay} طلباً/يوم (${simulationResults.breakEvenSalesPerDay.toFixed(
                  1
                )} د.ك)`
              : `Daily Break-Even: ${simulationResults.breakEvenOrdersPerDay} orders/day (${simulationResults.breakEvenSalesPerDay.toFixed(
                  1
                )} KWD)`}
          </div>
        </div>

        {/* 6 Interactive Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 bg-[#F7F7F8] dark:bg-slate-900/60 p-4 rounded-2xl ring-1 ring-slate-200/80 dark:ring-slate-800">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{isAr ? 'المدة (أيام)' : 'Duration'}</span>
              <span className="font-mono font-extrabold">{durationDays}d</span>
            </div>
            <input
              type="range"
              min={7}
              max={120}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{isAr ? 'إيجار البوث' : 'Booth Rent'}</span>
              <span className="font-mono font-extrabold">{boothRentKwd.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={15000}
              step={250}
              value={boothRentKwd}
              onChange={(e) => setBoothRentKwd(Number(e.target.value))}
              className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{isAr ? 'التجهيز والديكور' : 'Setup CapEx'}</span>
              <span className="font-mono font-extrabold">{setupCapexKwd.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={500}
              max={8000}
              step={100}
              value={setupCapexKwd}
              onChange={(e) => setSetupCapexKwd(Number(e.target.value))}
              className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{isAr ? 'العمالة واللوجستيات' : 'Staff & Ops'}</span>
              <span className="font-mono font-extrabold">{staffLogisticsKwd.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={500}
              max={7000}
              step={100}
              value={staffLogisticsKwd}
              onChange={(e) => setStaffLogisticsKwd(Number(e.target.value))}
              className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{isAr ? 'الطلبات/يوم' : 'Daily Orders'}</span>
              <span className="font-mono font-extrabold text-emerald-700">{dailyOrders}</span>
            </div>
            <input
              type="range"
              min={30}
              max={300}
              step={5}
              value={dailyOrders}
              onChange={(e) => setDailyOrders(Number(e.target.value))}
              className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{isAr ? 'متوسط السلة' : 'Basket AOV'}</span>
              <span className="font-mono font-extrabold text-emerald-700">{aovKwd.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={3.5}
              max={9.5}
              step={0.1}
              value={aovKwd}
              onChange={(e) => setAovKwd(Number(e.target.value))}
              className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* 3 Scenarios Output Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Scenario 1: Conservative 75% */}
          <div className="rounded-2xl p-4 bg-[#F7F7F8] dark:bg-slate-900/80 ring-1 ring-slate-200/80 dark:ring-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                {isAr ? '1. السيناريو المتحفظ (75% إقبال)' : '1. Conservative Scenario (75% Traffic)'}
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                {simulationResults.conservative.ordersPerDay} {isAr ? 'طلب/يوم' : 'ord/d'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>{isAr ? 'الإيراد المتوقع:' : 'Projected Sales:'}</span>
                <span className="font-mono font-bold text-slate-950 dark:text-white">
                  {Math.round(simulationResults.conservative.grossSales).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? 'إجمالي التكاليف:' : 'Total Costs:'}</span>
                <span className="font-mono font-bold">
                  {Math.round(simulationResults.conservative.totalCosts).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? 'هامش الأمان فوق التعادل:' : 'Break-Even Safety Margin:'}</span>
                <span className="font-mono font-bold text-emerald-700">
                  {simulationResults.conservative.safetyMarginPct.toFixed(1)}%
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-sm font-extrabold text-slate-950 dark:text-white">
                <span>{isAr ? 'صافي الربح:' : 'Net Profit:'}</span>
                <span className="font-mono">
                  {Math.round(simulationResults.conservative.netProfit).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
            </div>
          </div>

          {/* Scenario 2: Base Case 100% */}
          <div className="rounded-2xl p-4 bg-blue-50/70 dark:bg-blue-950/30 ring-2 ring-blue-500/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-blue-950 dark:text-blue-200">
                {isAr ? '2. السيناريو المتوقع المعتمد (100%)' : '2. Approved Base Case (100% Traffic)'}
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                {simulationResults.base.ordersPerDay} {isAr ? 'طلب/يوم' : 'ord/d'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <div className="flex justify-between">
                <span>{isAr ? 'الإيراد المتوقع:' : 'Projected Sales:'}</span>
                <span className="font-mono font-bold text-slate-950 dark:text-white">
                  {Math.round(simulationResults.base.grossSales).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? 'العائد على الاستثمار (ROI):' : 'Return on Investment (ROI):'}</span>
                <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                  +{Math.round(simulationResults.base.roiPct)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? 'يوم استرداد رأس المال:' : 'Capital Payback Day:'}</span>
                <span className="font-mono font-extrabold text-blue-700 dark:text-blue-400">
                  {isAr ? `اليوم الـ ${simulationResults.base.paybackDay}` : `Day ${simulationResults.base.paybackDay}`}
                </span>
              </div>
              <div className="pt-2 border-t border-blue-200 dark:border-blue-800 flex justify-between text-sm font-black text-blue-950 dark:text-white">
                <span>{isAr ? 'صافي الربح المعتمد:' : 'Base Net Profit:'}</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {Math.round(simulationResults.base.netProfit).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
            </div>
          </div>

          {/* Scenario 3: Optimistic 130% */}
          <div className="rounded-2xl p-4 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-300 dark:ring-emerald-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200">
                {isAr ? '3. السيناريو المتفائل (130% ذروة)' : '3. Optimistic Peak (130% Traffic)'}
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                {simulationResults.optimistic.ordersPerDay} {isAr ? 'طلب/يوم' : 'ord/d'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <div className="flex justify-between">
                <span>{isAr ? 'الإيراد الأقصى:' : 'Peak Revenue:'}</span>
                <span className="font-mono font-bold text-slate-950 dark:text-white">
                  {Math.round(simulationResults.optimistic.grossSales).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? 'العائد الأقصى (ROI):' : 'Peak ROI:'}</span>
                <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                  +{Math.round(simulationResults.optimistic.roiPct)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>{isAr ? 'حافز فريق التشغيل (6%):' : 'Ops Team Incentive (6%):'}</span>
                <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                  {Math.round(simulationResults.optimistic.staffIncentiveKwd).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex justify-between text-sm font-black text-emerald-950 dark:text-white">
                <span>{isAr ? 'صافي الربح الأقصى:' : 'Peak Net Profit:'}</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {Math.round(simulationResults.optimistic.netProfit).toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <EventCashflowCurve
          lang={isAr ? 'ar' : 'en'}
          durationDays={durationDays}
          upfrontKwd={boothRentKwd + setupCapexKwd}
          staffLogisticsKwd={staffLogisticsKwd}
          aovKwd={aovKwd}
          dailyOrders={dailyOrders}
        />
      </section>

      {/* ==================================================================== */}
      {/* UNIT 4: SMART 6-BRAND SELECTOR & EXB MENU ENGINEERING MATRIX */}
      {/* ==================================================================== */}
      <section className="ae-tile rounded-2xl p-5 sm:p-6  space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white">
              {isAr
                ? 'رابعاً: محرك اختيار البراند الذكي وهندسة قائمة طعام المعارض'
                : '4. Smart 6-Brand Selector & Custom EXB Menu Engineering Matrix'}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              {isAr
                ? `العلامة المرشحة لتصورك الحالي: (${VENTURE_BRANDS.find((b) => b.id === deepAuditResult.recommendedBrandId)?.nameAr ?? deepAuditResult.recommendedBrandId}) — مع جدول أصناف منيو المعارض بتكلفة أغذية 21.4% وزمن تحضير أقل من 90 ثانية.`
                : `AI Recommended Brand for your vision: (${deepAuditResult.recommendedBrandId}) — featuring 21.4% COGS EXB Menu items under 90s prep time.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="ae-seg" role="tablist" aria-label={isAr ? 'طريقة العرض' : 'View mode'}>
              <button type="button" data-active={exbView === 'cards'} onClick={() => setExbView('cards')}>
                {isAr ? 'بطاقات المراجعة' : 'Moderation cards'}
              </button>
              <button type="button" data-active={exbView === 'table'} onClick={() => setExbView('table')}>
                {isAr ? 'الجدول التحليلي' : 'Analytical table'}
              </button>
            </div>
            <input
              type="text"
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              placeholder={isAr ? 'ابحث في أصناف منيو المعارض...' : 'Search EXB Menu items...'}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* 7 Brands Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {VENTURE_BRANDS.map((brand) => {
            const isSelected = selectedBrandId === brand.id
            const isRecommended = deepAuditResult.recommendedBrandId === brand.id
            return (
              <div
                key={brand.id}
                onClick={() => setSelectedBrandId(isSelected ? 'all' : brand.id)}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all space-y-2 ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/40 ring-2 ring-blue-600'
                    : isRecommended
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500'
                    : 'bg-[#F7F7F8] dark:bg-slate-900/60 ring-1 ring-slate-200/80 dark:ring-slate-800 hover:ring-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-950 dark:text-white">
                    {isAr ? brand.nameAr : brand.nameEn}
                  </span>
                  <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    {brand.grossMarginPct}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                  {isAr ? brand.specialtyAr : brand.specialtyEn}
                </p>
                <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  <span>⏱️ {brand.prepMinutes}m</span>
                  <span>{isRecommended ? (isAr ? '⭐ مرشح' : '⭐ AI Pick') : `🚶 ${brand.walkabilityScore}%`}</span>
                </div>
              </div>
            )
          })}
        </div>

        {exbView === 'cards' ? (
          <ExbModerationCards items={filteredExbItems} lang={isAr ? 'ar' : 'en'} />
        ) : (
        <div className="space-y-3">
        <div className="flex justify-end">
          <button type="button" onClick={exportExbCsv} className="ae-pill-dark">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {isAr ? 'تصدير الجدول' : 'Export CSV'}
          </button>
        </div>
        {/* Movable-Column EXB Menu Table */}
        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200/80 dark:ring-slate-800">
          <table className="w-full text-start text-xs sm:text-[13px]">
            <thead>
              <tr className="bg-[#F7F7F8] dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                {exbColumnsOrder.map((colKey, idx) => {
                  const colLabels: Record<string, { ar: string; en: string }> = {
                    item: { ar: 'الصنف في منيو المعارض', en: 'EXB Menu Star Item' },
                    brand: { ar: 'العلامة التجارية', en: 'Brand' },
                    branchPrice: { ar: 'سعر الفرع العادي', en: 'Branch Price KWD' },
                    exbPrice: { ar: 'سعر المعرض المقترح (+10%)', en: 'EXB Booth Price (+10%)' },
                    cogs: { ar: 'تكلفة الأغذية (COGS %)', en: 'COGS %' },
                    prepTime: { ar: 'وقت التحضير (ثانية)', en: 'Prep Time (Sec)' },
                    unitMargin: { ar: 'صافي ربح الوحدة (د.ك)', en: 'Unit Margin KWD' },
                  }
                  return (
                    <th key={colKey} className="py-3 px-3.5 text-start whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{isAr ? colLabels[colKey].ar : colLabels[colKey].en}</span>
                        <div className="inline-flex items-center gap-0.5 ms-1">
                          <button
                            type="button"
                            onClick={() => moveColumn(exbColumnsOrder, setExbColumnsOrder, idx, 'left')}
                            className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 text-[10px]"
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(exbColumnsOrder, setExbColumnsOrder, idx, 'right')}
                            className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 text-[10px]"
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 font-medium">
              {filteredExbItems.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                  {exbColumnsOrder.map((colKey) => {
                    if (colKey === 'item') {
                      return (
                        <td key={colKey} className="py-3 px-3.5 font-extrabold text-slate-950 dark:text-white">
                          <div>{isAr ? row.itemAr : row.itemEn}</div>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {isAr ? row.categoryAr : row.categoryEn}
                          </span>
                        </td>
                      )
                    }
                    if (colKey === 'brand') {
                      return (
                        <td key={colKey} className="py-3 px-3.5">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-xs">
                            {isAr ? row.brandAr : row.brandEn}
                          </span>
                        </td>
                      )
                    }
                    if (colKey === 'branchPrice') {
                      return (
                        <td key={colKey} className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-400">
                          {row.branchPriceKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                        </td>
                      )
                    }
                    if (colKey === 'exbPrice') {
                      return (
                        <td key={colKey} className="py-3 px-3.5 font-mono font-extrabold text-blue-700 dark:text-blue-400">
                          {row.exbPriceKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                        </td>
                      )
                    }
                    if (colKey === 'cogs') {
                      return (
                        <td key={colKey} className="py-3 px-3.5 font-mono font-bold text-amber-700 dark:text-amber-400">
                          {row.cogsPct.toFixed(1)}%
                        </td>
                      )
                    }
                    if (colKey === 'prepTime') {
                      return (
                        <td key={colKey} className="py-3 px-3.5 font-mono font-bold">
                          {row.prepTimeSec} {isAr ? 'ثانية' : 'sec'}
                        </td>
                      )
                    }
                    return (
                      <td key={colKey} className="py-3 px-3.5 font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                        +{row.unitMarginKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* UNIT 5: HISTORICAL & LIVE CONTRACT BENCHMARK COMPARISON TABLE */}
      {/* ==================================================================== */}
      <section className="ae-tile rounded-2xl p-5 sm:p-6  space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white">
              {isAr
                ? 'خامساً: جدول المقارنة المرجعية للفعاليات (كشتة المارينا مقابل مخيم السفير مقابل العقد الحالي)'
                : '5. Historical & Live Contract Benchmark Matrix (Marina Kashta vs Al-Safeer Camp vs Current Contract)'}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              {isAr
                ? 'مقارنة العقد قيد الدراسة بالأداء الفعلي الموثق لكشتة المارينا (ROI 175%) ومخيم السفير (ROI 160%).'
                : 'Benchmark your current contract against verified historical results from Marina Kashta (175% ROI) and Al-Safeer Camp (160% ROI).'}
            </p>
          </div>
          <input
            type="text"
            value={benchmarkSearchQuery}
            onChange={(e) => setBenchmarkSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث في جدول المقارنة...' : 'Search benchmark table...'}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200/80 dark:ring-slate-800">
          <table className="w-full text-start text-xs sm:text-[13px]">
            <thead>
              <tr className="bg-[#F7F7F8] dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                {benchmarkColumnsOrder.map((colKey, idx) => {
                  const labels: Record<string, { ar: string; en: string }> = {
                    event: { ar: 'الفعالية / العقد', en: 'Event / Contract' },
                    duration: { ar: 'المدة', en: 'Duration' },
                    rentSetup: { ar: 'الإيجار والتجهيز', en: 'Rent & Setup KWD' },
                    sales: { ar: 'إجمالي المبيعات', en: 'Gross Sales KWD' },
                    netProfit: { ar: 'صافي الربح', en: 'Net Profit KWD' },
                    roi: { ar: 'العائد على الاستثمار (ROI)', en: 'Event ROI %' },
                    evaluation: { ar: 'الحكم التنفيذي', en: 'Executive Verdict' },
                  }
                  return (
                    <th key={colKey} className="py-3 px-4 text-start whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{isAr ? labels[colKey].ar : labels[colKey].en}</span>
                        <div className="inline-flex items-center gap-0.5 ms-1">
                          <button
                            type="button"
                            onClick={() => moveColumn(benchmarkColumnsOrder, setBenchmarkColumnsOrder, idx, 'left')}
                            className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 text-[10px]"
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(benchmarkColumnsOrder, setBenchmarkColumnsOrder, idx, 'right')}
                            className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 text-[10px]"
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 font-medium">
              {comparisonRows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.id === 'current-contract'
                      ? 'bg-blue-50/50 dark:bg-blue-950/20 font-bold'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                  }
                >
                  {benchmarkColumnsOrder.map((colKey) => {
                    if (colKey === 'event') {
                      return (
                        <td key={colKey} className="py-3.5 px-4 font-extrabold text-slate-950 dark:text-white">
                          {isAr ? row.nameAr : row.nameEn}
                        </td>
                      )
                    }
                    if (colKey === 'duration') {
                      return (
                        <td key={colKey} className="py-3.5 px-4 font-mono">
                          {row.durationDays} {isAr ? 'يوماً' : 'Days'}
                        </td>
                      )
                    }
                    if (colKey === 'rentSetup') {
                      return (
                        <td key={colKey} className="py-3.5 px-4 font-mono">
                          {row.rentAndSetupKwd.toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                        </td>
                      )
                    }
                    if (colKey === 'sales') {
                      return (
                        <td key={colKey} className="py-3.5 px-4 font-mono font-extrabold text-slate-950 dark:text-white">
                          {row.salesKwd.toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                        </td>
                      )
                    }
                    if (colKey === 'netProfit') {
                      return (
                        <td key={colKey} className="py-3.5 px-4 font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
                          {row.netProfitKwd.toLocaleString()} {isAr ? 'د.ك' : 'KWD'}
                        </td>
                      )
                    }
                    if (colKey === 'roi') {
                      return (
                        <td key={colKey} className="py-3.5 px-4 font-mono font-black text-blue-700 dark:text-blue-400">
                          ROI {row.roiPct}%
                        </td>
                      )
                    }
                    return (
                      <td key={colKey} className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${
                            row.tone === 'emerald'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-200'
                              : row.tone === 'blue'
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 ring-1 ring-blue-200'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 ring-1 ring-amber-200'
                          }`}
                        >
                          {isAr ? row.badgeAr : row.badgeEn}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* UNIT 6: EXECUTIVE APPROVAL PACK GENERATOR & COMPOSIO DISPATCH */}
      {/* ==================================================================== */}
      <section className="ae-tile rounded-2xl p-5 sm:p-6  space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              <span>
                {isAr
                  ? 'سادساً: إصدار حقيبة الاعتماد التنفيذية الكاملة'
                  : '6. Executive Approval Pack Generator & Composio Dispatch'}
              </span>
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              {isAr
                ? 'توليد وثيقة اعتماد رسمية شاملة (ملخص العقد، التعديلات القانونية، جدول الـ 3 سيناريوهات، ومنيو المعارض المعتمد) للطباعة أو الإرسال عبر كومبوزيو.'
                : 'Generate a formal executive sign-off document (contract summary, legal counter-clauses, 3-scenario table, and approved EXB Menu) ready to print or dispatch.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setApprovalPackOpen(true)
                setApprovalPackTime(
                  new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                )
              }}
              className="ae-pill-dark !py-3 !px-5 !text-sm"
            >
              <FileCheck className="h-4 w-4 text-emerald-400" />
              <span>
                {isAr
                  ? '📄 إصدار حقيبة الاعتماد التنفيذية وإرسالها عبر كومبوزيو'
                  : '📄 Generate Executive Approval Pack & Dispatch via Composio'}
              </span>
            </button>
          </div>
        </div>

        {approvalPackOpen && (
          <div className="p-5 rounded-2xl bg-[#F7F7F8] dark:bg-slate-900 ring-1 ring-emerald-300 dark:ring-emerald-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 block">
                  {isAr
                    ? `✅ تم إصدار حقيبة الاعتماد التنفيذية ومزامنتها عبر كومبوزيو (${approvalPackTime})`
                    : `✅ Executive Approval Pack Generated & Dispatched via Composio (${approvalPackTime})`}
                </span>
                <h3 className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                  {isAr
                    ? `وثيقة اعتماد فعالية: ${eventNameAr} (${durationDays} يوماً — مركز تكلفة أودو للمعارض 2026)`
                    : `Executive Sign-Off Pack: ${eventNameEn} (${durationDays} Days — Odoo Cost Center ANL-EXB-2026)`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => typeof window !== 'undefined' && window.print()}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-300 text-xs font-bold cursor-pointer"
              >
                🖨️ {isAr ? 'طباعة الوثيقة الرسمية' : 'Print Official Pack'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200/80 dark:ring-slate-700 space-y-1">
                <span className="font-extrabold text-slate-900 dark:text-white block">
                  {isAr ? '1. الملخص المالي المعتمد (السيناريو الأساسي)' : '1. Approved Financial Summary'}
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  {isAr
                    ? `الإيراد المتوقع: ${Math.round(simulationResults.base.grossSales).toLocaleString()} د.ك | صافي الربح: ${Math.round(
                        simulationResults.base.netProfit
                      ).toLocaleString()} د.ك | العائد: +${Math.round(simulationResults.base.roiPct)}%`
                    : `Projected Sales: ${Math.round(simulationResults.base.grossSales).toLocaleString()} KWD | Net Profit: ${Math.round(
                        simulationResults.base.netProfit
                      ).toLocaleString()} KWD | ROI: +${Math.round(simulationResults.base.roiPct)}%`}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200/80 dark:ring-slate-700 space-y-1">
                <span className="font-extrabold text-slate-900 dark:text-white block">
                  {isAr ? '2. الشروط القانونية الواجب تعديلها' : '2. Mandatory Legal Amendments'}
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  {isAr
                    ? 'تعديل البند 4 (إعفاء أيام الأمطار والطقس) + تعديل البند 7 (سقف رسوم الخدمات 5%) + توفير قاطع كهرباء ثلاثي الطور بقدرة 60 أمبير.'
                    : 'Amend Clause 4 (Weather rent credit) + Clause 7 (5% service fee cap) + Dedicated 3-Phase 60A breaker.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-slate-200/80 dark:ring-slate-700 space-y-1">
                <span className="font-extrabold text-slate-900 dark:text-white block">
                  {isAr ? '3. البراند ومنيو المعارض ولوجستيات العارضية' : '3. Brand, EXB Menu & Ardiya Logistics'}
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  {isAr
                    ? `البراند المعتمد: ${deepAuditResult.recommendedBrandId} | تكلفة الأغذية: 21.4% | توريد حصص 140جم مسبقة التتبيل يومياً.`
                    : `Approved Brand: ${deepAuditResult.recommendedBrandId} | 21.4% COGS | Twice-daily 140g pre-marinated dispatch from Ardiya.`}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
