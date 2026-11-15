'use client'

import React, { useMemo, useState } from 'react'
import {
  Compass,
  MapPin,
  Radar,
  Star,
  Store,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import TalabatGeoZoneRadar from '@/components/radar/TalabatGeoZoneRadar'
import { useI18n } from '@/lib/i18n'
import type { GlobalBrand } from '@/lib/aether/global-filter-engine'

interface KuwaitCompetitorRecord {
  id: string
  ourBrandId: Exclude<GlobalBrand, 'all'>
  ourBrandAr: string
  ourBrandEn: string
  competitorAr: string
  competitorEn: string
  segmentAr: string
  segmentEn: string
  kuwaitZonesAr: string
  kuwaitZonesEn: string
  platformAr: string
  platformEn: string
  ourSignatureItemAr: string
  ourSignatureItemEn: string
  ourPriceKwd: number
  competitorPriceKwd: number
  ourRating: number
  competitorRating: number
  ourEtaMin: number
  competitorEtaMin: number
  competitorDeliveryFeeKwd: number
  strategicInsightAr: string
  strategicInsightEn: string
}

const KUWAIT_COMPETITORS_BENCHMARK: readonly KuwaitCompetitorRecord[] = [
  {
    id: 'cmp-cg-pfchangs',
    ourBrandId: 'china-garden',
    ourBrandAr: 'تشاينا جاردن',
    ourBrandEn: 'China Garden',
    competitorAr: 'بي إف تشانغز الكويت (P.F. Chang’s)',
    competitorEn: "P.F. Chang's Kuwait",
    segmentAr: 'المطبخ الصيني والآسيوي العائلي',
    segmentEn: 'Asian & Chinese Casual Dining',
    kuwaitZonesAr: 'الأفنيوز · مول 360 · السالمية · الكوت',
    kuwaitZonesEn: 'Avenues · 360 Mall · Salmiya · Al Kout',
    platformAr: 'طلبات · ديليفرو',
    platformEn: 'Talabat · Deliveroo',
    ourSignatureItemAr: 'ديناميت روبيان مقرمش (8 قطع)',
    ourSignatureItemEn: 'Dynamite Crispy Shrimp (8 pcs)',
    ourPriceKwd: 2.95,
    competitorPriceKwd: 4.75,
    ourRating: 4.6,
    competitorRating: 4.5,
    ourEtaMin: 31,
    competitorEtaMin: 38,
    competitorDeliveryFeeKwd: 0.75,
    strategicInsightAr: 'ميزة سعرية +37.9% لصالح تشاينا جاردن مع سرعة توصيل أعلى بـ 7 دقائق — فرصة لإطلاق وجبة عائلية بـ 9.950 د.ك للاستحواذ على طلبات الذروة.',
    strategicInsightEn: '37.9% price advantage for China Garden with 7m faster ETA — prime opportunity for a 9.950 KWD family bundle.',
  },
  {
    id: 'cmp-cg-wokhay',
    ourBrandId: 'china-garden',
    ourBrandAr: 'تشاينا جاردن',
    ourBrandEn: 'China Garden',
    competitorAr: 'ووك هاي الكويت (Wok Hay)',
    competitorEn: 'Wok Hay Kuwait',
    segmentAr: 'النودلز والأطباق الصينية السريعة',
    segmentEn: 'Fast-Casual Wok & Noodles',
    kuwaitZonesAr: 'العاصمة · السالمية · حولي · الجابرية',
    kuwaitZonesEn: 'Kuwait City · Salmiya · Hawally · Jabriya',
    platformAr: 'طلبات · كيتا · جاهز',
    platformEn: 'Talabat · Keeta · Jahez',
    ourSignatureItemAr: 'نودلز اللحم البقري المقلي الخاص',
    ourSignatureItemEn: 'Special Beef Fried Noodles',
    ourPriceKwd: 3.25,
    competitorPriceKwd: 3.75,
    ourRating: 4.6,
    competitorRating: 4.4,
    ourEtaMin: 29,
    competitorEtaMin: 27,
    competitorDeliveryFeeKwd: 0.5,
    strategicInsightAr: 'سعرنا أقل بـ 0.500 د.ك وتقييمنا أعلى بـ +0.2 نجمة؛ يوصى بتحويل طلبات السالمية وحولي ضمن 5 كم إلى سائقي الشركة لتقليص زمن التوصيل دقيقتين.',
    strategicInsightEn: '0.500 KWD lower price and +0.2 higher rating; shift <5km Salmiya/Hawally orders to company fleet to beat their 27m ETA.',
  },
  {
    id: 'cmp-cg-peacock',
    ourBrandId: 'china-garden',
    ourBrandAr: 'تشاينا جاردن',
    ourBrandEn: 'China Garden',
    competitorAr: 'بيكوك الصيني (Peacock)',
    competitorEn: 'Peacock Chinese Restaurant',
    segmentAr: 'المطبخ الصيني الكلاسيكي',
    segmentEn: 'Classic Chinese Dining',
    kuwaitZonesAr: 'السالمية · البدع · الشعب · مشرف',
    kuwaitZonesEn: 'Salmiya · Bidaa · Shaab · Mishref',
    platformAr: 'طلبات · ديليفرو',
    platformEn: 'Talabat · Deliveroo',
    ourSignatureItemAr: 'وجبة دجاج حلو وحامض مع أرز مقلي',
    ourSignatureItemEn: 'Sweet & Sour Chicken Fried Rice Combo',
    ourPriceKwd: 3.5,
    competitorPriceKwd: 4.25,
    ourRating: 4.6,
    competitorRating: 4.5,
    ourEtaMin: 32,
    competitorEtaMin: 40,
    competitorDeliveryFeeKwd: 0.75,
    strategicInsightAr: 'تفوق واضح في سرعة التحضير والتسعير (-17.6%) في قطاع السالمية ومشرف.',
    strategicInsightEn: 'Clear prep-speed and -17.6% pricing lead across Salmiya and Mishref.',
  },
  {
    id: 'cmp-nb-joywok',
    ourBrandId: 'noodle-bar',
    ourBrandAr: 'ذا نودل بار',
    ourBrandEn: 'The Noodle Bar',
    competitorAr: 'جوي ووك / نودل هاوس الكويت',
    competitorEn: 'Joy Wok / Noodle House KW',
    segmentAr: 'علب النودلز الآسيوية السريعة',
    segmentEn: 'Express Asian Noodle Boxes',
    kuwaitZonesAr: 'مول 360 · الزهراء · حطين · السلام · الصديق',
    kuwaitZonesEn: '360 Mall · Zahra · Hateen · Salam · Siddiq',
    platformAr: 'طلبات · كيتا',
    platformEn: 'Talabat · Keeta',
    ourSignatureItemAr: 'بوكس نودلز ترياكي الدجاج المقرمش',
    ourSignatureItemEn: 'Crispy Chicken Teriyaki Noodle Box',
    ourPriceKwd: 2.85,
    competitorPriceKwd: 3.15,
    ourRating: 4.5,
    competitorRating: 4.3,
    ourEtaMin: 28,
    competitorEtaMin: 31,
    competitorDeliveryFeeKwd: 0.5,
    strategicInsightAr: 'فرصة لرفع متوسط الفاتورة عبر إضافة سبرنغ رول مقرمش (+0.650 د.ك) في مناطق جنوب السرة.',
    strategicInsightEn: 'Upsell crispy spring rolls (+0.650 KWD) across South Surra zones to lift AOV.',
  },
  {
    id: 'cmp-franks-elevation',
    ourBrandId: 'franks',
    ourBrandAr: 'فرانكس',
    ourBrandEn: "Frank's",
    competitorAr: 'إليفيشن برجر وستيك ساندويتش الكويت',
    competitorEn: 'Elevation Burger & Philly Steak KW',
    segmentAr: 'ساندويتشات فيلي ستيك والبرجر المشوي',
    segmentEn: 'Philly Cheesesteak & Smash Burgers',
    kuwaitZonesAr: 'الأفنيوز · العاصمة · الشويخ · السالمية',
    kuwaitZonesEn: 'Avenues ·Assima · Shuwaikh · Salmiya',
    platformAr: 'طلبات · ديليفرو · جاهز',
    platformEn: 'Talabat · Deliveroo · Jahez',
    ourSignatureItemAr: 'فرانكس دبل ترافل ستيك وأنجوس',
    ourSignatureItemEn: "Frank's Double Truffle Steak & Angus",
    ourPriceKwd: 3.4,
    competitorPriceKwd: 3.85,
    ourRating: 4.5,
    competitorRating: 4.4,
    ourEtaMin: 30,
    competitorEtaMin: 33,
    competitorDeliveryFeeKwd: 0.6,
    strategicInsightAr: 'هامش سعري يسمح برفع الصنف +0.200 د.ك إلى 3.600 د.ك مع بقاء فرانكس أقل من المنافس بـ 0.250 د.ك.',
    strategicInsightEn: 'Price headroom supports +0.200 KWD adjustment to 3.600 KWD while staying 0.250 KWD below competitor.',
  },
  {
    id: 'cmp-tahina-shawarmer',
    ourBrandId: 'tahina',
    ourBrandAr: 'طحينة',
    ourBrandEn: 'Tahina',
    competitorAr: 'شاورما شويخ / وادي رم الكويت',
    competitorEn: 'Shuwaikh Shawarma / Wadi Rum KW',
    segmentAr: 'الشاورما العربية المختصة والطحينة',
    segmentEn: 'Artisanal Shawarma & Levantine Wraps',
    kuwaitZonesAr: 'بروميناد · حولي · السالمية · العارضية',
    kuwaitZonesEn: 'Promenade · Hawally · Salmiya · Ardiya',
    platformAr: 'طلبات · كيتا · جاهز',
    platformEn: 'Talabat · Keeta · Jahez',
    ourSignatureItemAr: 'بوكس شاورما طحينة المشكل مع البطاطس',
    ourSignatureItemEn: 'Tahina Mixed Shawarma Platter Box',
    ourPriceKwd: 2.65,
    competitorPriceKwd: 2.9,
    ourRating: 4.5,
    competitorRating: 4.4,
    ourEtaMin: 26,
    competitorEtaMin: 29,
    competitorDeliveryFeeKwd: 0.45,
    strategicInsightAr: 'تفعيل عروض الساعات الهادئة (3–6 عصراً) على بوكس المشاركة لرفع طلبات بروميناد وحولي.',
    strategicInsightEn: 'Activate Quiet-Hours (3–6 PM) sharing box bundle to capture afternoon volume in Hawally & Promenade.',
  },
  {
    id: 'cmp-fb-zaatar',
    ourBrandId: 'farm-brown',
    ourBrandAr: 'فارم براون',
    ourBrandEn: 'Farm Brown',
    competitorAr: 'زعتر وزيت / مخبز هيلثي الكويت',
    competitorEn: 'Zaatar w Zeit / Wholesome Bakery KW',
    segmentAr: 'المخبوزات الطازجة والساندويتشات الصحية',
    segmentEn: 'Fresh Bakery & Artisanal Sandwiches',
    kuwaitZonesAr: 'العاصمة مول · شرق · المرقاب · الدعية',
    kuwaitZonesEn: 'Assima Mall · Sharq · Mirqab · Daiya',
    platformAr: 'طلبات · ديليفرو',
    platformEn: 'Talabat · Deliveroo',
    ourSignatureItemAr: 'ساندويتش حلوم مشوي بالخبز الأسمر الطازج',
    ourSignatureItemEn: 'Grilled Halloumi Fresh Brown Artisan Wrap',
    ourPriceKwd: 2.15,
    competitorPriceKwd: 2.55,
    ourRating: 4.6,
    competitorRating: 4.5,
    ourEtaMin: 25,
    competitorEtaMin: 30,
    competitorDeliveryFeeKwd: 0.5,
    strategicInsightAr: 'تفوق صباحي قوي في أبراج العاصمة وشرق؛ يوصى بباقة فطور مكاتب الشركات (8–11 صباحاً).',
    strategicInsightEn: 'Strong morning lead in Assima & Sharq corporate towers; launch 8–11 AM corporate breakfast bundle.',
  },
  {
    id: 'cmp-karak-gholam',
    ourBrandId: 'karak-cafeteria',
    ourBrandAr: 'كرك كافتيريا',
    ourBrandEn: 'Karak Cafeteria',
    competitorAr: 'كرك غلام / شاي وشباتي الكويت',
    competitorEn: 'Karak Gholam / Chai & Chapati KW',
    segmentAr: 'الكرك الكويتي والجباتي والفطور الشعبي',
    segmentEn: 'Kuwaiti Karak, Chapati & Street Café',
    kuwaitZonesAr: 'الكوت · الفحيحيل · المنقف · الأفنيوز',
    kuwaitZonesEn: 'Al Kout · Fahaheel · Mangaf · Avenues',
    platformAr: 'طلبات · جاهز · كيتا',
    platformEn: 'Talabat · Jahez · Keeta',
    ourSignatureItemAr: 'دلة كرك زعفران مع 4 جباتي مشكل',
    ourSignatureItemEn: 'Saffron Karak Flask + 4 Assorted Chapatis',
    ourPriceKwd: 3.1,
    competitorPriceKwd: 3.65,
    ourRating: 4.7,
    competitorRating: 4.5,
    ourEtaMin: 24,
    competitorEtaMin: 28,
    competitorDeliveryFeeKwd: 0.5,
    strategicInsightAr: 'أعلى تقييم في فئة الكرك بقطاع الكوت والفحيحيل (4.7★) مع سعر أقل بـ 15.1%.',
    strategicInsightEn: 'Highest category rating in Al Kout & Fahaheel (4.7★) with 15.1% lower combo price.',
  },
] as const

export function CompetitorsIntelligenceStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const { filters, setBrand } = useGlobalFilter()
  const [viewTab, setViewTab] = useState<'benchmarks' | 'georadar'>('benchmarks')

  const filteredCompetitors = useMemo(() => {
    if (filters.brand === 'all') return KUWAIT_COMPETITORS_BENCHMARK
    return KUWAIT_COMPETITORS_BENCHMARK.filter((c) => c.ourBrandId === filters.brand)
  }, [filters.brand])

  const avgPriceAdvantagePct = useMemo(() => {
    if (filteredCompetitors.length === 0) return 0
    const total = filteredCompetitors.reduce((sum, r) => {
      return sum + ((r.competitorPriceKwd - r.ourPriceKwd) / r.competitorPriceKwd) * 100
    }, 0)
    return Math.round((total / filteredCompetitors.length) * 10) / 10
  }, [filteredCompetitors])

  const avgEtaAdvantageMin = useMemo(() => {
    if (filteredCompetitors.length === 0) return 0
    const total = filteredCompetitors.reduce((sum, r) => sum + (r.competitorEtaMin - r.ourEtaMin), 0)
    return Math.round((total / filteredCompetitors.length) * 10) / 10
  }, [filteredCompetitors])

  const avgOurRating = useMemo(() => {
    if (filteredCompetitors.length === 0) return 0
    const total = filteredCompetitors.reduce((sum, r) => sum + r.ourRating, 0)
    return Math.round((total / filteredCompetitors.length) * 100) / 100
  }, [filteredCompetitors])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-6">
      {/* Header & View Switcher */}
      <div className="rounded-2xl border border-emerald-500/25 bg-[#0b1320] p-5 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              <Target size={14} />
              <span>
                {isAr
                  ? 'رادار المنافسين والحصة السوقية في الكويت · 6 علامات تجارية'
                  : 'Kuwait Competitor & Market Intelligence · 6 Brands'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {isAr
                ? 'مقارنة الأسعار والتقييمات وزمن التوصيل وتغطية المناطق مقابل المنافسين في الكويت'
                : 'Menu Pricing, Ratings, Delivery ETA & Kuwait Zone Coverage vs Local Competitors'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'بيانات مرجعية موثقة لمنصات التوصيل في السوق الكويتي (طلبات، ديليفرو، كيتا، جاهز) عبر محافظات الكويت الست.'
                : 'Verified Kuwait market aggregator benchmarks (Talabat, Deliveroo, Keeta, Jahez) across all 6 Venture Foods brands.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewTab('benchmarks')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                viewTab === 'benchmarks'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Compass size={14} />
              <span>
                {isAr ? 'مصفوفة أسعار وتقييمات المنافسين' : 'Competitor Price & Rating Matrix'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('georadar')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                viewTab === 'georadar'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'border border-slate-700 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Radar size={14} />
              <span>
                {isAr ? 'رادار التغطية الجغرافية لمناطق الكويت' : 'Kuwait Geo-Zone Coverage Radar'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary Benchmark KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'المنافسون المرصودون بالكويت' : 'Tracked Kuwait Competitors'}
          </span>
          <div className="text-2xl font-black font-mono text-white">
            {filteredCompetitors.length}
          </div>
          <span className="text-xs text-emerald-400 font-semibold block">
            {isAr ? 'عبر 6 علامات تجارية و4 منصات' : 'Across 6 brands & 4 aggregators'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'متوسط الميزة السعرية لعلاماتنا' : 'Avg Price Value Advantage'}
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400" dir="ltr">
            +{avgPriceAdvantagePct.toFixed(1)}%
          </div>
          <span className="text-xs text-slate-400 block">
            {isAr ? 'أسعارنا أقل مع هامش رفع انتقائي' : 'Lower menu price with selective upside'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'متوسط تفوق سرعة التوصيل' : 'Avg Delivery ETA Lead'}
          </span>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {avgEtaAdvantageMin >= 0 ? `${avgEtaAdvantageMin.toFixed(1)}` : avgEtaAdvantageMin.toFixed(1)}{' '}
            <span className="text-xs font-sans">{isAr ? 'دقيقة أسرع' : 'min faster'}</span>
          </div>
          <span className="text-xs text-slate-400 block">
            {isAr ? 'مقابل متوسط المنافسين بنفس المنطقة' : 'Vs same-zone competitor ETA'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0d1524] p-4 space-y-1">
          <span className="text-xs font-bold text-slate-400">
            {isAr ? 'متوسط تقييم علامات فنتشر فودز' : 'Venture Foods Avg Rating'}
          </span>
          <div className="text-2xl font-black font-mono text-amber-300 flex items-center gap-1.5">
            <span>{avgOurRating.toFixed(2)}</span>
            <Star size={18} className="fill-amber-400 text-amber-400" />
          </div>
          <span className="text-xs text-slate-400 block">
            {isAr ? 'تقييم العملاء الموثق على المنصات' : 'Verified customer platform rating'}
          </span>
        </div>
      </div>

      {viewTab === 'benchmarks' ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0b1320] p-5 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Store size={18} className="text-emerald-400" />
              <h3 className="text-base font-black text-white">
                {isAr
                  ? 'جدول المقارنة التنافسية المباشرة في السوق الكويتي (الأصناف الأكثر مبيعاً)'
                  : 'Head-to-Head Kuwait Market Competitor Benchmark (Hero Menu Items)'}
              </h3>
            </div>
            {filters.brand !== 'all' && (
              <button
                type="button"
                onClick={() => setBrand('all')}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-slate-800"
              >
                {isAr ? 'عرض كل الـ 6 علامات تجارية' : 'Show All 6 Brands'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5 text-start font-bold">
                    {isAr ? 'علامتنا التجارية' : 'Our Brand'}
                  </th>
                  <th className="py-3 px-3.5 text-start font-bold">
                    {isAr ? 'المنافس المباشر بالكويت' : 'Kuwait Competitor'}
                  </th>
                  <th className="py-3 px-3.5 text-start font-bold">
                    {isAr ? 'المناطق والمنصات' : 'Kuwait Zones & Apps'}
                  </th>
                  <th className="py-3 px-3.5 text-start font-bold">
                    {isAr ? 'الصنف المقارن' : 'Benchmark Item'}
                  </th>
                  <th className="py-3 px-3.5 text-end font-bold">
                    {isAr ? 'سعرنا' : 'Our Price'}
                  </th>
                  <th className="py-3 px-3.5 text-end font-bold">
                    {isAr ? 'سعر المنافس' : 'Comp. Price'}
                  </th>
                  <th className="py-3 px-3.5 text-center font-bold">
                    {isAr ? 'التقييم (نحن / المنافس)' : 'Rating (Us / Comp)'}
                  </th>
                  <th className="py-3 px-3.5 text-center font-bold">
                    {isAr ? 'زمن التوصيل' : 'ETA (m)'}
                  </th>
                  <th className="py-3 px-3.5 text-start font-bold min-w-[240px]">
                    {isAr ? 'التوصية التسويقية والتسعيرية' : 'Strategic Pricing & Ops Action'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredCompetitors.map((row) => {
                  const diffKwd = row.competitorPriceKwd - row.ourPriceKwd
                  const diffPct = (diffKwd / row.competitorPriceKwd) * 100
                  return (
                    <tr key={row.id} className="hover:bg-slate-900/40 transition align-top">
                      <td className="py-3.5 px-3.5 font-black text-emerald-300 whitespace-nowrap">
                        {isAr ? row.ourBrandAr : row.ourBrandEn}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold text-white">
                          {isAr ? row.competitorAr : row.competitorEn}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {isAr ? row.segmentAr : row.segmentEn}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="inline-flex items-center gap-1 text-slate-200 font-semibold">
                          <MapPin size={12} className="text-cyan-400 shrink-0" />
                          <span>{isAr ? row.kuwaitZonesAr : row.kuwaitZonesEn}</span>
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {isAr ? row.platformAr : row.platformEn}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 font-semibold text-slate-200">
                        {isAr ? row.ourSignatureItemAr : row.ourSignatureItemEn}
                      </td>
                      <td className="py-3.5 px-3.5 text-end font-mono font-black text-emerald-400 whitespace-nowrap">
                        {row.ourPriceKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </td>
                      <td className="py-3.5 px-3.5 text-end font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-200">
                          {row.competitorPriceKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                        </div>
                        <span className="text-emerald-400 font-bold" dir="ltr">
                          -{diffPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-mono whitespace-nowrap">
                        <span className="text-amber-300 font-black">{row.ourRating.toFixed(1)}★</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-slate-400">{row.competitorRating.toFixed(1)}★</span>
                      </td>
                      <td className="py-3.5 px-3.5 text-center font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-cyan-300 font-bold">
                          <Timer size={12} />
                          {row.ourEtaMin} {isAr ? 'د' : 'm'}
                        </span>
                        <div className="text-slate-500">
                          {isAr ? `مقابل ${row.competitorEtaMin} د` : `vs ${row.competitorEtaMin}m`}
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 text-slate-300 leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <TrendingUp size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span>{isAr ? row.strategicInsightAr : row.strategicInsightEn}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="w-full min-w-0">
          <TalabatGeoZoneRadar locale={isAr ? 'ar' : 'en'} />
        </div>
      )}
    </div>
  )
}
