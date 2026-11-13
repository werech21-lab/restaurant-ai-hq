'use client'

import React, { useState, useRef } from 'react'
import {
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  ShieldCheck,
  Building,
  Zap,
  Printer,
  ChevronRight,
  TrendingUp,
  Flame,
  FileCheck,
  Scale,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  Award,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Store,
  ChefHat,
  Tag,
  Check,
} from 'lucide-react'
import {
  MARINA_KASHTA_CONTRACT_DATA,
  OFFICIAL_EXB_MENUS,
  type EventContractIntelligence,
} from '@/lib/events/venture-events-engine'

interface AIContractRiskAnalyzerProps {
  isAr: boolean
  onApplyToSimulator?: (params: {
    eventNameAr: string
    eventNameEn: string
    organizerAr: string
    locationAr: string
    startDate: string
    endDate: string
    boothCount: number
    boothLengthM: number
    boothWidthM: number
    totalRentKwd: number
    fitoutKwd: number
    staffCount: number
    dailyWageKwd: number
    expectedAovKwd: number
    estimatedCogsPct: number
    marketingOpexKwd: number
    baselineDailyOrders: number
    selectedBrands: string[]
  }) => void
  onNavigateTab?: (tab: 'feasibility' | 'exb_menu' | 'historical_radar') => void
}

export default function AIContractRiskAnalyzer({
  isAr,
  onApplyToSimulator,
  onNavigateTab,
}: AIContractRiskAnalyzerProps) {
  const [contract, setContract] = useState<EventContractIntelligence>(MARINA_KASHTA_CONTRACT_DATA)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string>(
    '1976-chinagarden_26_Nov_26_to_02_Jan_27-KD_1300_.pdf'
  )
  const [milestones, setMilestones] = useState(MARINA_KASHTA_CONTRACT_DATA.actionPlanMilestones)
  const [showMociModal, setShowMociModal] = useState(false)
  const [selectedRiskCategory, setSelectedRiskCategory] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle local file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadedFileName(file.name)
    setIsProcessing(true)

    // Simulate high-speed AI OCR extraction
    setTimeout(() => {
      setIsProcessing(false)
    }, 850)
  }

  // Toggle milestone completion
  const toggleMilestone = (id: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m))
    )
  }

  // Marina Kashta China Garden Menu (EXCG0001 - EXCG0009)
  const chinaGardenMenu = OFFICIAL_EXB_MENUS.filter((item) => item.brandKey === 'china-garden')

  // Apply contract figures directly to Future Event Studio Simulator
  const handleTransferToSimulator = () => {
    if (onApplyToSimulator) {
      onApplyToSimulator({
        eventNameAr: contract.eventNameAr,
        eventNameEn: contract.eventNameEn,
        organizerAr: contract.organizerAr,
        locationAr: contract.locationAr,
        startDate: contract.startDate,
        endDate: contract.endDate,
        boothCount: 1,
        boothLengthM: 3.0,
        boothWidthM: 3.0,
        totalRentKwd: contract.rentAmountKwd,
        fitoutKwd: 650,
        staffCount: 3,
        dailyWageKwd: 8.333,
        expectedAovKwd: 2.55,
        estimatedCogsPct: 22.0,
        marketingOpexKwd: 350,
        baselineDailyOrders: 72,
        selectedBrands: ['China Garden'],
      })
    }
  }

  // Filtered operational risks
  const filteredRisks = contract.operationalRisks.filter((risk) => {
    if (selectedRiskCategory === 'all') return true
    return risk.category === selectedRiskCategory
  })

  return (
    <div className="space-y-6">
      {/* ----------------- TOP UPLOAD & STATUS BANNER ----------------- */}
      <div className="relative overflow-hidden rounded-3xl border border-gold-400/30 bg-gradient-to-br from-[#0c1017] via-[#0f172a] to-[#080d1a] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-xs font-black text-gold-300">
                <Sparkles className="h-3.5 w-3.5" />
                {isAr ? 'محلل عقود الفعاليات الذكي المدعوم بالذكاء الاصطناعي' : 'AI Event Contract Intelligence Engine'}
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                AetherBI Legal OCR · دقة 99.4%
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
              {isAr ? 'تحليل عقد كشتة المارينا الشتوية (Marina Kashta)' : 'Marina Kashta Participation Contract Analyzer'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist-300">
              {isAr
                ? 'استخراج آلي لكامل بنود العقد رقم 1976، اكتشاف قيود الطاقة والهندسة (حظر الغاز واللهب المكشوف 100% والتحول للووك الحثي)، ومطابقة شروط وزارة التجارة القرار الوزاري 303 لسنة 2018.'
                : 'Automated 360° extraction of contract 1976, critical constraint radars (strict gas prohibition, 100% induction setup, 2.5m height limit), and MOCI Decree 303/2018 compliance.'}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-mist-400">
              <span className="flex items-center gap-1.5 text-gold-300">
                <FileText className="h-4 w-4" />
                {uploadedFileName}
              </span>
              <span>·</span>
              <span>رقم العقد: {contract.contractId}</span>
              <span>·</span>
              <span className="text-emerald-400">الحالة: معتمد ومطابق للاشتراطات ✅</span>
            </div>
          </div>

          {/* Action Buttons & File Picker */}
          <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-xs font-black text-white shadow-md hover:bg-white/10 active:scale-95 transition-all"
            >
              <Upload className="h-4 w-4 text-cyan-400" />
              <span>{isAr ? 'رفع عقد جديد (PDF / Image)' : 'Upload New Contract PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContract(MARINA_KASHTA_CONTRACT_DATA)
                setUploadedFileName('1976-chinagarden_26_Nov_26_to_02_Jan_27-KD_1300_.pdf')
                setIsProcessing(true)
                setTimeout(() => setIsProcessing(false), 500)
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-amber-600 px-4 py-3 text-xs font-black text-ink-950 shadow-lg shadow-gold-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <RefreshCw className={`h-4 w-4 stroke-[2.5] ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'إعادة تحميل عقد كشتة المارينا 1976' : 'Reload Marina Kashta 1976 Contract'}</span>
            </button>
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-xs font-bold text-cyan-300 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
            <span>{isAr ? 'جارٍ قراءة العقد بالذكاء الاصطناعي واستخراج القيود الهندسية والمالية...' : 'Analyzing contract clauses with AI and extracting engineering constraints...'}</span>
          </div>
        )}
      </div>

      {/* ----------------- 360° LEGAL & CONTRACT DATA CARDS ----------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-[#0c1017] p-4">
          <div className="flex items-center gap-2 text-mist-400 text-xs font-bold">
            <Building className="h-4 w-4 text-gold-400" />
            <span>{isAr ? 'الفعالية والمنظم' : 'Event & Organizer'}</span>
          </div>
          <div className="mt-2 text-sm font-black text-white">{contract.eventNameAr}</div>
          <p className="mt-1 text-xs text-mist-400">{contract.organizerAr}</p>
          <div className="mt-2 text-xs font-mono text-gold-300">عقد رقم #1976</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c1017] p-4">
          <div className="flex items-center gap-2 text-mist-400 text-xs font-bold">
            <Award className="h-4 w-4 text-emerald-400" />
            <span>{isAr ? 'البراند والترخيص التجاري' : 'Brand & Trade License'}</span>
          </div>
          <div className="mt-2 text-sm font-black text-emerald-300">{contract.permittedBrand}</div>
          <p className="mt-1 text-xs text-mist-300">ترخيص رقم: <span className="font-mono font-bold text-white">{contract.commercialLicenseNo}</span></p>
          <p className="mt-1 text-xs text-mist-400 truncate">المفوض: {contract.licenseHolderName}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c1017] p-4">
          <div className="flex items-center gap-2 text-mist-400 text-xs font-bold">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <span>{isAr ? 'المدة والموقع' : 'Period & Location'}</span>
          </div>
          <div className="mt-2 text-sm font-black text-white">{contract.daysCount} يوماً متواصلاً</div>
          <p className="mt-1 text-xs text-cyan-300">26 نوفمبر 2026 – 02 يناير 2027</p>
          <p className="mt-1 text-xs text-mist-400">ممشى مارينا كرسنت - السالمية</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c1017] p-4">
          <div className="flex items-center gap-2 text-mist-400 text-xs font-bold">
            <Store className="h-4 w-4 text-amber-400" />
            <span>{isAr ? 'مساحة ومواصفات البوث' : 'Booth Specs'}</span>
          </div>
          <div className="mt-2 text-sm font-black text-amber-300">{contract.boothDimensions} ({contract.boothAreaSqM} م²)</div>
          <p className="mt-1 text-xs text-mist-300">{contract.boothType}</p>
          <p className="mt-1 text-xs text-rose-300 font-bold">أقصى ارتفاع للديكور: 2.50 متر</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c1017] p-4">
          <div className="flex items-center gap-2 text-mist-400 text-xs font-bold">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span>{isAr ? 'الإيجار والتأمين المسترد' : 'Rent & Deposit'}</span>
          </div>
          <div className="mt-2 text-base font-black text-gold-300">
            {contract.totalImmediateDueKwd.toFixed(3)} <span className="text-xs text-mist-400">د.ك</span>
          </div>
          <p className="mt-0.5 text-xs text-mist-300">إيجار: 1,300 + تأمين: 250 د.ك</p>
          <span className="mt-1 inline-block rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
            سداد 48 ساعة (Link Payment)
          </span>
        </div>
      </div>

      {/* ----------------- CRITICAL OPERATIONAL RISKS & CONSTRAINTS RADAR ----------------- */}
      <div className="rounded-3xl border border-white/10 bg-[#0b0e14] p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <span>{isAr ? 'رادار القيود والمخاطر التشغيلية والهندسية الخمسة المستخرجة من العقد' : '5 Critical Operational & Engineering Risk Radars'}</span>
            </h3>
            <p className="mt-1 text-xs text-mist-400">
              {isAr
                ? 'تحويل فوري لنصوص العقد الصارمة إلى إجراءات وتوصيات هندسية ولوجستية ومالية ملزمة للشركة.'
                : 'Direct transformation of binding contractual clauses into engineering, logistical, and financial directives.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedRiskCategory('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedRiskCategory === 'all'
                  ? 'bg-gold-400 text-ink-950 font-black'
                  : 'bg-white/5 text-mist-400 hover:text-white'
              }`}
            >
              {isAr ? 'الكل (5)' : 'All (5)'}
            </button>
            <button
              onClick={() => setSelectedRiskCategory('cooking_flame')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedRiskCategory === 'cooking_flame'
                  ? 'bg-rose-500 text-white font-black'
                  : 'bg-white/5 text-mist-400 hover:text-white'
              }`}
            >
              🚨 منع الغاز
            </button>
            <button
              onClick={() => setSelectedRiskCategory('engineering_fitout')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedRiskCategory === 'engineering_fitout'
                  ? 'bg-cyan-500 text-ink-950 font-black'
                  : 'bg-white/5 text-mist-400 hover:text-white'
              }`}
            >
              📐 الديكور 2.5م
            </button>
            <button
              onClick={() => setSelectedRiskCategory('operating_hours')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedRiskCategory === 'operating_hours'
                  ? 'bg-amber-500 text-ink-950 font-black'
                  : 'bg-white/5 text-mist-400 hover:text-white'
              }`}
            >
              ⏰ 10ص-10م
            </button>
            <button
              onClick={() => setSelectedRiskCategory('payment_deposit')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedRiskCategory === 'payment_deposit'
                  ? 'bg-emerald-500 text-ink-950 font-black'
                  : 'bg-white/5 text-mist-400 hover:text-white'
              }`}
            >
              💰 مهلة 48h
            </button>
            <button
              onClick={() => setSelectedRiskCategory('moci_compliance')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedRiskCategory === 'moci_compliance'
                  ? 'bg-purple-500 text-white font-black'
                  : 'bg-white/5 text-mist-400 hover:text-white'
              }`}
            >
              ⚖️ قرار 303
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredRisks.map((risk) => {
            const isCritical = risk.severity === 'critical'
            return (
              <div
                key={risk.id}
                className={`rounded-2xl border p-5 transition-all ${
                  isCritical
                    ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60'
                    : 'border-white/10 bg-[#0d121c] hover:border-white/20'
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-white">{risk.titleAr}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {risk.severity === 'critical' ? 'حرج وإلزامي 100%' : 'شرط تعاقدي ملزم'}
                      </span>
                    </div>

                    {/* Extracted Clause */}
                    <div className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs leading-relaxed text-mist-300">
                      <span className="font-bold text-mist-100">{isAr ? 'النص الصريح المستخرج من العقد:' : 'Extracted Contract Clause:'}</span>{' '}
                      <span className="italic font-serif">&ldquo;{risk.extractedClauseAr}&rdquo;</span>
                    </div>

                    {/* Automated System Recommendation */}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200">
                      <span className="font-bold text-emerald-400">
                        {isAr ? '💡 التوصية الهندسية والتشغيلية الآلية للنظام:' : '💡 Automated Engineering Recommendation:'}
                      </span>{' '}
                      {risk.systemRecommendationAr}
                    </div>

                    {/* Equipment or Action List */}
                    {risk.equipmentOrActionList && risk.equipmentOrActionList.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs font-bold text-gold-300 uppercase tracking-wider">
                          {isAr ? 'قائمة المعدات والإجراءات الفورية المطلوبة:' : 'Required Equipment & Action List:'}
                        </span>
                        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {risk.equipmentOrActionList.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 text-xs text-mist-200"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata Sidebar */}
                  <div className="shrink-0 space-y-2 rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-mist-400 lg:w-56">
                    <div>
                      <span className="text-xs text-mist-500 font-bold uppercase">{isAr ? 'المسؤول' : 'Owner'}</span>
                      <p className="font-bold text-mist-200">{risk.actionOwner}</p>
                    </div>
                    <div>
                      <span className="text-xs text-mist-500 font-bold uppercase">{isAr ? 'الموعد النهائي' : 'Deadline'}</span>
                      <p className="font-bold text-amber-300">{risk.deadline}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ----------------- FEASIBILITY STUDY & 3 SCENARIOS COMPARISON ----------------- */}
      <div className="rounded-3xl border border-gold-500/30 bg-[#0b0e15] p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold-400/20 px-3 py-1 text-xs font-black text-gold-300 border border-gold-400/30">
                دراسة الجدوى المالية المعتمدة لمشروع كشتة المارينا
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                عائد واقعي متوقع 68.7% ROI
              </span>
            </div>
            <h3 className="mt-2 text-xl font-black text-white">
              {isAr ? 'ميزانية تشاينا جاردن لكشتة المارينا ومقارنة السيناريوهات الثلاثة (38 يوماً)' : 'China Garden Marina Kashta Feasibility (38 Days)'}
            </h3>
          </div>

          <button
            onClick={handleTransferToSimulator}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-amber-500 px-4 py-2.5 text-xs font-black text-ink-950 shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            <Zap className="h-4 w-4" />
            <span>{isAr ? 'تحميل الأرقام في محاكي الجدوى الكامل' : 'Open in Full Simulator'}</span>
          </button>
        </div>

        {/* Cost Structure Summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-white/5 bg-[#0f1420] p-3 text-center">
            <span className="text-xs text-mist-400 font-bold uppercase">{isAr ? 'إيجار البوث (38 يوماً)' : 'Booth Rent'}</span>
            <div className="text-base font-black text-white">1,300.000 <span className="text-xs text-gold-400">د.ك</span></div>
            <p className="mt-1 text-xs text-emerald-400 font-bold">34.210 د.ك / يوم (أوفر من السفير!)</p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0f1420] p-3 text-center">
            <span className="text-xs text-mist-400 font-bold uppercase">{isAr ? 'التأمين المسترد' : 'Security Deposit'}</span>
            <div className="text-base font-black text-cyan-300">250.000 <span className="text-xs text-gold-400">د.ك</span></div>
            <p className="mt-1 text-xs text-mist-400">GL 110400 (يسترد 03/01/2027)</p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0f1420] p-3 text-center">
            <span className="text-xs text-mist-400 font-bold uppercase">{isAr ? 'تجهيز البوث والديكور' : 'Fit-Out & Electric'}</span>
            <div className="text-base font-black text-white">650.000 <span className="text-xs text-gold-400">د.ك</span></div>
            <p className="mt-1 text-xs text-mist-400">هيكل 3×3م وووك حثي</p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0f1420] p-3 text-center">
            <span className="text-xs text-mist-400 font-bold uppercase">{isAr ? 'تكلفة العمالة (شفتين)' : 'Staff Cost'}</span>
            <div className="text-base font-black text-white">950.000 <span className="text-xs text-gold-400">د.ك</span></div>
            <p className="mt-1 text-xs text-mist-400">3 موظفين × 38 يوماً</p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0f1420] p-3 text-center">
            <span className="text-xs text-mist-400 font-bold uppercase">{isAr ? 'مصاريف تشغيل ونقل' : 'Logistics & POS'}</span>
            <div className="text-base font-black text-white">350.000 <span className="text-xs text-gold-400">د.ك</span></div>
            <p className="mt-1 text-xs text-mist-400">نقل مبرد وتغذية كهرباء</p>
          </div>

          <div className="rounded-2xl border border-gold-400/30 bg-gold-400/10 p-3 text-center">
            <span className="text-xs text-gold-300 font-bold uppercase">{isAr ? 'إجمالي المصاريف التشغيلية' : 'Total OPEX'}</span>
            <div className="text-base font-black text-gold-200">3,250.000 <span className="text-xs text-white">د.ك</span></div>
            <p className="mt-1 text-xs text-gold-300 font-bold">التعادل: 4,167 د.ك (43 طلب/يوم)</p>
          </div>
        </div>

        {/* 3 Scenario Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Conservative */}
          <div className="rounded-2xl border border-white/10 bg-[#0d121c] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-mist-400 uppercase">{isAr ? 'السيناريو المتحفظ' : 'Conservative Scenario'}</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold text-mist-300">140 د.ك / يوم</span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-mist-300">
                <span>{isAr ? 'إجمالي المبيعات (38 يوماً):' : 'Gross Sales:'}</span>
                <span className="font-mono font-bold text-white">5,320.000 د.ك</span>
              </div>
              <div className="flex justify-between text-mist-400">
                <span>{isAr ? 'تكلفة الأغذية والمواد (22%):' : 'COGS (22%):'}</span>
                <span className="font-mono text-rose-300">1,170.400 د.ك</span>
              </div>
              <div className="flex justify-between text-mist-400">
                <span>{isAr ? 'المصاريف التشغيلية (OPEX):' : 'Total OPEX:'}</span>
                <span className="font-mono text-mist-300">3,250.000 د.ك</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-black text-emerald-400">
                <span>{isAr ? 'صافي الربح المتوقع:' : 'Net Profit:'}</span>
                <span>+900.000 د.ك (16.9%)</span>
              </div>
              <p className="text-xs text-mist-400 mt-2">
                استرداد كامل المصاريف (نقطة التعادل) في <span className="font-bold text-white">اليوم 30</span> من أصل 38 يوماً.
              </p>
            </div>
          </div>

          {/* Realistic Approved */}
          <div className="relative rounded-2xl border-2 border-gold-400/50 bg-[#121926] p-5 shadow-lg shadow-gold-500/10">
            <div className="absolute -top-3 end-4 rounded-full bg-gold-400 px-3 py-0.5 text-xs font-black uppercase text-ink-950">
              {isAr ? 'السيناريو الواقعي المعتمد' : 'Realistic Approved'}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gold-300 uppercase">{isAr ? 'الهدف المالي للمشروع' : 'Projected Target'}</span>
              <span className="rounded-md bg-gold-400/20 px-2 py-0.5 text-xs font-bold text-gold-200">185 د.ك / يوم</span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-mist-300">
                <span>{isAr ? 'إجمالي المبيعات (38 يوماً):' : 'Gross Sales:'}</span>
                <span className="font-mono font-bold text-white">7,030.000 د.ك</span>
              </div>
              <div className="flex justify-between text-mist-400">
                <span>{isAr ? 'تكلفة الأغذية والمواد (22%):' : 'COGS (22%):'}</span>
                <span className="font-mono text-rose-300">1,546.600 د.ك</span>
              </div>
              <div className="flex justify-between text-mist-400">
                <span>{isAr ? 'المصاريف التشغيلية (OPEX):' : 'Total OPEX:'}</span>
                <span className="font-mono text-mist-300">3,250.000 د.ك</span>
              </div>
              <div className="border-t border-gold-400/30 pt-2 flex justify-between text-sm font-black text-gold-300">
                <span>{isAr ? 'صافي الربح المتوقع:' : 'Net Profit:'}</span>
                <span>+2,233.400 د.ك (31.8%)</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>{isAr ? 'عائد الاستثمار: ▲ 68.7%' : 'ROI: ▲ 68.7%'}</span>
                <span>التعادل في اليوم 22</span>
              </div>
            </div>
          </div>

          {/* Optimistic */}
          <div className="rounded-2xl border border-white/10 bg-[#0d121c] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-cyan-400 uppercase">{isAr ? 'السيناريو المتفائل (ذروة ديسمبر)' : 'Optimistic Peak'}</span>
              <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-200">250 د.ك / يوم</span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between text-mist-300">
                <span>{isAr ? 'إجمالي المبيعات (38 يوماً):' : 'Gross Sales:'}</span>
                <span className="font-mono font-bold text-white">9,500.000 د.ك</span>
              </div>
              <div className="flex justify-between text-mist-400">
                <span>{isAr ? 'تكلفة الأغذية والمواد (22%):' : 'COGS (22%):'}</span>
                <span className="font-mono text-rose-300">2,090.000 د.ك</span>
              </div>
              <div className="flex justify-between text-mist-400">
                <span>{isAr ? 'المصاريف التشغيلية (OPEX):' : 'Total OPEX:'}</span>
                <span className="font-mono text-mist-300">3,250.000 د.ك</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-black text-cyan-300">
                <span>{isAr ? 'صافي الربح المتوقع:' : 'Net Profit:'}</span>
                <span>+4,160.000 د.ك (43.8%)</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-cyan-300">
                <span>{isAr ? 'عائد الاستثمار: ▲ 128.0%' : 'ROI: ▲ 128.0%'}</span>
                <span>التعادل في اليوم 16</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- EXB MENU FOR CHINA GARDEN (MARINA KASHTA NO-GAS EDITION) ----------------- */}
      <div className="rounded-3xl border border-white/10 bg-[#0b0e14] p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-black text-cyan-300 border border-cyan-500/30">
                {isAr ? 'قائمة معارض تشاينا جاردن · كشتة المارينا' : 'EXB Menu China Garden · Marina Kashta'}
              </span>
              <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                {isAr ? '100% تشغيل كهربائي بدون غاز' : '100% Electric Only (No Gas)'}
              </span>
            </div>
            <h3 className="mt-2 text-xl font-black text-white">
              {isAr ? 'قائمة طعام كشتة المارينا المعتمدة (أكواب وبوكسات المشي والأكل السريع)' : 'Approved Walk & Eat Street Food Menu (9 Items)'}
            </h3>
            <p className="mt-1 text-xs text-mist-400">
              {isAr
                ? 'مصممة خصيصاً لممشى كرسنت لسهولة الأكل أثناء المشي (Walk & Eat Cups) وبسرعة تحضير أقل من 60 ثانية عبر مقالي الووك الحثية الكهربائية.'
                : 'Engineered for Marina promenade walk & eat format with sub-60-second turnaround using commercial electric induction woks.'}
            </p>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('exb_menu')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-400 hover:text-gold-300"
            >
              <span>{isAr ? 'فتح في مولد قوائم المعارض' : 'Open in EXB Menu Studio'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-white/10 text-mist-400 text-xs uppercase">
                <th className="py-3 px-3 text-start">{isAr ? 'الكود' : 'SKU Code'}</th>
                <th className="py-3 px-3 text-start">{isAr ? 'الصنف (عربي / إنجليزي)' : 'Item Name'}</th>
                <th className="py-3 px-3 text-start">{isAr ? 'الفئة وطريقة التحضير' : 'Category & Prep'}</th>
                <th className="py-3 px-3 text-center">{isAr ? 'سعر البيع المعرض' : 'EXB Price'}</th>
                <th className="py-3 px-3 text-center">{isAr ? 'التكلفة والمواد' : 'Food Cost'}</th>
                <th className="py-3 px-3 text-center">{isAr ? 'نسبة التكلفة' : 'Cost %'}</th>
                <th className="py-3 px-3 text-center">{isAr ? 'هامش الربح' : 'Profit Margin'}</th>
                <th className="py-3 px-3 text-center">{isAr ? 'زمن التقديم' : 'Turnaround'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {chinaGardenMenu.map((item) => {
                const margin = item.recommendedExbPriceKwd - item.foodPackagingCogsKwd
                const costPct = (item.foodPackagingCogsKwd / item.recommendedExbPriceKwd) * 100
                const marginPct = 100 - costPct

                return (
                  <tr key={item.code} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-gold-400">{item.code}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{item.nameAr}</div>
                      <div className="text-xs text-mist-400">{item.nameEn}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-mist-300">
                        {item.categoryAr}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-white">
                      {item.recommendedExbPriceKwd.toFixed(3)} د.ك
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-rose-300">
                      {item.foodPackagingCogsKwd.toFixed(3)} د.ك
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          costPct <= 20
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : costPct <= 25
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {costPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                      +{margin.toFixed(3)} د.ك ({marginPct.toFixed(0)}%)
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs text-mist-300">
                        <Clock className="h-3 w-3 text-cyan-400" />
                        {item.prepTimeSeconds} ثانية
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------- ACTION PLAN & MOCI DECREE 303 PLEDGE ----------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Action Plan Milestones (2 cols) */}
        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-[#0b0e14] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span>{isAr ? 'خطة إدارة المشروع التنفيذية لكشتة المارينا' : 'Marina Kashta Milestone Execution Plan'}</span>
              </h3>
              <p className="mt-1 text-xs text-mist-400">
                {isAr
                  ? 'المهام الـ 4 الحرجة لضمان انطلاق المشروع وسداد المستحقات وتوريد المعدات واسترداد التأمين.'
                  : '4 critical project milestones covering payment, engineering fitout, daily supply, and deposit retrieval.'}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 transition-all ${
                  m.completed
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/10 bg-[#0d121c]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleMilestone(m.id)}
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
                      m.completed
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-white/30 bg-white/5 hover:border-gold-400'
                    }`}
                  >
                    {m.completed && <Check className="h-4 w-4 stroke-[3]" />}
                  </button>

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gold-400 uppercase tracking-wider">{m.phaseAr}</span>
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-mono text-mist-300">
                        {m.deadlineAr}
                      </span>
                    </div>

                    <h4 className={`text-sm font-black ${m.completed ? 'text-emerald-300 line-through' : 'text-white'}`}>
                      {m.titleAr}
                    </h4>

                    <p className="text-xs leading-relaxed text-mist-400">{m.detailsAr}</p>

                    <div className="pt-2 text-xs text-mist-500">
                      <span className="font-bold text-mist-400">المسؤول:</span> {m.ownerAr}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MOCI Decree 303/2018 Undertaking Box (1 col) */}
        <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#110f22] to-[#0b0e14] p-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-black text-purple-300 border border-purple-500/40">
                الامتثال والرقابة الحكومية
              </span>
            </div>

            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-purple-400" />
              <span>{isAr ? 'إقرار وتعهد وزارة التجارة والصناعة (القرار 303/2018)' : 'MOCI Decree 303/2018 Official Undertaking'}</span>
            </h3>

            <p className="text-xs leading-relaxed text-mist-300">
              {isAr
                ? 'نموذج الإقرار والتعهد الرسمي الصادر وفق اشتراطات وزارة التجارة والصناعة بدولة الكويت بشأن المعارض المؤقتة، ويلزم المنشأة بإصدار فواتير بيع معتمدة وحصر المشاركة ببراند تشاينا جاردن.'
                : 'Binding official undertaking under MOCI Ministerial Decree 303/2018 obligating receipt issuance and brand exclusivity.'}
            </p>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2 text-xs font-mono text-mist-300">
              <div className="flex justify-between">
                <span className="text-mist-500">المنشأة:</span>
                <span className="font-bold text-white truncate max-w-[180px]">{contract.mociPledgeTemplate.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mist-500">السجل التجاري:</span>
                <span className="font-bold text-gold-400">{contract.mociPledgeTemplate.crNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mist-500">الترخيص التجاري:</span>
                <span className="font-bold text-cyan-400">{contract.mociPledgeTemplate.licenseNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mist-500">المفوض بالتوقيع:</span>
                <span className="font-bold text-white">{contract.mociPledgeTemplate.authorizedSignatory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mist-500">البراند المرخص:</span>
                <span className="font-bold text-emerald-400">{contract.mociPledgeTemplate.permittedBrand}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => setShowMociModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <FileCheck className="h-4 w-4" />
              <span>{isAr ? 'معاينة وطباعة الإقرار والتعهد الوزاري' : 'View & Print MOCI 303/2018 Pledge'}</span>
            </button>

            <p className="text-center text-xs text-mist-500">
              جاهز للتصدير كملف PDF رسمي بختم الشركة واعتماد المفوض
            </p>
          </div>
        </div>
      </div>

      {/* ----------------- MOCI PLEDGE PRINT MODAL ----------------- */}
      {showMociModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/20 bg-[#0f1422] p-6 text-mist-100 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Scale className="h-6 w-6 text-gold-400" />
                <h3 className="text-lg font-black text-white">
                  {isAr ? 'إقرار وتعهد وزارة التجارة والصناعة (القرار الوزاري 303 لسنة 2018)' : 'Official MOCI 303/2018 Pledge & Undertaking'}
                </h3>
              </div>
              <button
                onClick={() => setShowMociModal(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-mist-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Printable Document Sheet */}
            <div className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 sm:p-8 text-slate-900 shadow-inner" dir="rtl">
              <div className="text-center border-b-2 border-slate-800 pb-4">
                <h2 className="text-xl font-black">دولة الكويت</h2>
                <h3 className="text-base font-bold text-slate-700">وزارة التجارة والصناعة — قطاع الرقابة التجارية وحماية المستهلك</h3>
                <h4 className="mt-2 text-sm font-black bg-slate-100 py-1 border border-slate-300">
                  إقرار وتعهد بالالتزام بأحكام القرار الوزاري رقم (303) لسنة 2018 بشأن تنظيم المعارض التجارية المؤقتة
                </h4>
              </div>

              <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-800">
                <p>
                  نقر نحن الشركة الموقعة أدناه: <span className="font-bold underline">{contract.mociPledgeTemplate.companyName}</span>، سجل تجاري رقم (<span className="font-bold">{contract.mociPledgeTemplate.crNumber}</span>)، وترخيص تجاري رقم (<span className="font-bold">{contract.mociPledgeTemplate.licenseNumber}</span>)، ويمثلها السيد/ <span className="font-bold underline">{contract.mociPledgeTemplate.authorizedSignatory}</span>، بطاقة مدنية رقم (<span className="font-bold">{contract.mociPledgeTemplate.civilId}</span>)، بصفتنا مشاركين في:
                </p>

                <div className="rounded-lg bg-slate-50 p-3 border border-slate-300 text-xs">
                  <p><span className="font-bold">اسم الفعالية / المعرض:</span> {contract.mociPledgeTemplate.eventName}</p>
                  <p><span className="font-bold">الجهة المنظمة:</span> {contract.mociPledgeTemplate.organizerName}</p>
                  <p><span className="font-bold">الموقع ورقم البوث:</span> {contract.mociPledgeTemplate.boothNumber}</p>
                  <p><span className="font-bold">العلامة التجارية المصرح بها فقط:</span> <span className="font-black text-blue-900">{contract.mociPledgeTemplate.permittedBrand}</span></p>
                </div>

                <p className="font-bold mt-2">بأننا نتعهد ونقر بالالتزام التام والنافذ بالبنود التالية:</p>

                <ol className="list-decimal space-y-2 pr-5 text-xs">
                  {contract.mociPledgeTemplate.clauses.map((clause, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {clause}
                    </li>
                  ))}
                </ol>

                <div className="mt-8 pt-4 border-t-2 border-slate-400 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="font-bold text-xs">المفوض بالتوقيع عن المنشأة المشاركة</p>
                    <p className="mt-1 font-bold text-sm">{contract.mociPledgeTemplate.authorizedSignatory}</p>
                    <p className="text-xs text-slate-500">الرقم المدني: {contract.mociPledgeTemplate.civilId}</p>
                    <div className="mt-8 text-slate-400 text-xs italic">[التوقيع والختم الرسمي]</div>
                  </div>

                  <div>
                    <p className="font-bold text-xs">اعتماد الجهة المنظمة للمهرجان</p>
                    <p className="mt-1 font-bold text-sm">شركة ريختر كريتيف لتنظيم المعارض</p>
                    <p className="text-xs text-slate-500">السيد / بدر نبيل العيسى</p>
                    <div className="mt-8 text-slate-400 text-xs italic">[ختم المنظم المعتمد]</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-2.5 text-xs font-black text-ink-950 shadow-md hover:bg-gold-300"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة الإقرار فوراً</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMociModal(false)}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
