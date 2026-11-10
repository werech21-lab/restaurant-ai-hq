'use client'

import React, { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Plus,
  Send,
  Scissors,
  Trash2,
  User,
  X,
  Building2,
  Tag,
  Truck,
  Tent,
  AlertCircle,
  MessageSquare,
  History,
  Calendar,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export type ExpenseSingleStatus = 'to_submit' | 'submitted' | 'approved' | 'paid' | 'refused'

export interface AnalyticSplitRow {
  id: string
  percentage: number
  locationId: string
  brandId: string
  vehicleId: string
  eventId: string
}

export interface NewExpensePayload {
  descriptionAr: string
  descriptionEn: string
  date: string
  categoryId: string
  custodianId: string
  paidBy: 'employee' | 'company'
  amountKwd: number
  status: ExpenseSingleStatus
  receiptAttached: boolean
  receiptFileName?: string
  splits: AnalyticSplitRow[]
}

const EXPENSE_CATEGORIES_25 = [
  { id: '40117', code: '40117', nameAr: '[40117] مصاريف معدات الإطفاء والمطافئ', nameEn: '[40117] Fire Fighting Equipment & Safety OPEX' },
  { id: '40355', code: '40355', nameAr: '[40355] الضمان الصحي الحكومي للإقامات', nameEn: '[40355] Government Health Insurance (MOH)' },
  { id: '40360', code: '40360', nameAr: '[40360] مصاريف كروت صحة البلدية', nameEn: '[40360] Municipal Food Handler Health Cards' },
  { id: '40371', code: '40371', nameAr: '[40371] مصاريف ترجمة رسمية', nameEn: '[40371] Official Certified Legal Translation' },
  { id: '40377', code: '40377', nameAr: '[40377] مصاريف اعتماد وتصديق', nameEn: '[40377] Legal Document Attestation & MOFA Fees' },
  { id: '40494', code: '40494', nameAr: '[40494] رسوم التراخيص التجارية والبلدية', nameEn: '[40494] Commercial & Municipal Trade Licenses' },
  { id: '40497', code: '40497', nameAr: '[40497] رسوم تراخيص قوة الإطفاء العام', nameEn: '[40497] Kuwait Fire Force Licensing Fees' },
  { id: 'CarFIX', code: 'CarFIX', nameAr: '[CarFIX] صيانة وإصلاح السيارات والأسطول', nameEn: '[CarFIX] Delivery Fleet Vehicle Maintenance' },
  { id: 'CarPtrl', code: 'CarPtrl', nameAr: '[CarPtrl] وقود وبنزين السيارات', nameEn: '[CarPtrl] Fleet Fuel & Petrol Allowances' },
  { id: 'GenMaint', code: 'GenMaint', nameAr: '[GenMaint] الصيانة العامة للمطابخ والفروع', nameEn: '[GenMaint] Kitchen & Branch General Maintenance' },
  { id: 'GAS', code: 'GAS', nameAr: '[GAS] تعبئة وتبديل أسطوانات الغاز', nameEn: '[GAS] Central Kitchen Gas Cylinders Refill' },
  { id: 'Government', code: 'Government', nameAr: '[Government] معاملات ورسوم حكومية', nameEn: '[Government] Government & Ministerial Clearances' },
  { id: 'ExpoExp', code: 'ExpoExp', nameAr: '[ExpoExp] مصاريف المعارض والمخيمات', nameEn: '[ExpoExp] Exhibitions, Popups & Winter Camps' },
  { id: 'EMP-BEN', code: 'EMP-BEN', nameAr: '[EMP-BEN] مزايا ووجبات الموظفين', nameEn: '[EMP-BEN] Staff Meals & Welfare Allowances' },
  { id: 'EMP-Uni', code: 'EMP-Uni', nameAr: '[EMP-Uni] الزي الموحد للموظفين', nameEn: '[EMP-Uni] Kitchen & Service Uniforms' },
  { id: 'EMP-FUR', code: 'EMP-FUR', nameAr: '[EMP-FUR] أثاث وتجهيزات سكن الموظفين', nameEn: '[EMP-FUR] Staff Housing Furniture & Fixtures' },
  { id: 'LOAN', code: 'LOAN', nameAr: '[LOAN] سلف الموظفين', nameEn: '[LOAN] Employee Advances & Short-Term Loans' },
  { id: 'PAM-RNW', code: 'PAM-RNW', nameAr: '[PAM-RNW] مصاريف تجديد الإقامات وأذونات العمل', nameEn: '[PAM-RNW] PAM Work Permits & Residency Renewals' },
  { id: 'PAM-REC', code: 'PAM-REC', nameAr: '[PAM-REC] مصاريف التوظيف والاستقدام الجديد', nameEn: '[PAM-REC] New Recruitment & PAM Visa Openings' },
  { id: 'MISC-EXP', code: 'MISC-EXP', nameAr: '[MISC-EXP] مصاريف تشغيلية متنوعة', nameEn: '[MISC-EXP] General Miscellaneous OPEX' },
  { id: 'MKT-ADS', code: 'MKT-ADS', nameAr: '[MKT-ADS] رسوم وتراخيص إعلانات الفروع والواجهات', nameEn: '[MKT-ADS] Signboard & Storefront Municipal Permits' },
  { id: 'UTIL-WAT', code: 'UTIL-WAT', nameAr: '[UTIL-WAT] فواتير واستهلاك المياه والكهرباء', nameEn: '[UTIL-WAT] Utilities, MEW Water & Electricity' },
  { id: 'CLEN-SUP', code: 'CLEN-SUP', nameAr: '[CLEN-SUP] مواد وأدوات النظافة والتعقيم', nameEn: '[CLEN-SUP] Kitchen Sanitation & Cleaning Supplies' },
  { id: 'PACK-EXP', code: 'PACK-EXP', nameAr: '[PACK-EXP] أدوات التعبئة والتغليف الطارئة', nameEn: '[PACK-EXP] Packaging & Takeaway Disposables' },
  { id: 'STAT-OFF', code: 'STAT-OFF', nameAr: '[STAT-OFF] قرطاسية ومطبوعات المكتب الرئيسي', nameEn: '[STAT-OFF] HQ Office Stationery & Printing' },
]

const EXPENSE_CUSTODIANS = [
  { id: 'sanad', nameAr: 'سند — عهدة التعقيب الحكومي والعلاقات العامة', nameEn: 'Sanad — PRO & Government Clearance Custody' },
  { id: 'rabih', nameAr: 'ربيع أنيس يحيى (صيانة المطابخ والفروع)', nameEn: 'Rabih Anis Yahya (Kitchen & Branch Maintenance)' },
  { id: 'sheila', nameAr: 'شيلا أمبوس بولبولي (عهد العمليات والتشغيل)', nameEn: 'Sheila Ambos Bolboli (Operations Custody)' },
  { id: 'amjad', nameAr: 'أمجد سمير جرجس ميخائيل (الرقابة والمشتريات)', nameEn: 'Amjad Samir Guirguis (Auditing & Procurement)' },
  { id: 'shyam', nameAr: 'شيام (إدارة الموارد البشرية والشؤون الإدارية)', nameEn: 'Shyam (HR & Admin Affairs Management)' },
  { id: 'nader', nameAr: 'نادر نزهي (المطبخ المركزي والتصنيع)', nameEn: 'Nader Nazhi (Central Kitchen & MRP)' },
  { id: 'shukrallah', nameAr: 'شكر الله ناصيف (الصيانة والتجهيزات العامة)', nameEn: 'Shukrallah Nassif (General Maintenance)' },
  { id: 'nousha', nameAr: 'نوشا أسانار (الرقابة الميدانية والتفتيش)', nameEn: 'Nousha Asanar (Field Operations & Inspection)' },
  { id: 'abdullah', nameAr: 'عبد الله عبد الغفار جمعة عويره (الإدارة التنفيذية)', nameEn: 'Abdullah Abdulghaffar Owaira (Executive Management)' },
  { id: 'abdulrahman', nameAr: 'عبد الرحمن محمد جمال الدين (الإدارة المالية)', nameEn: 'Abdulrahman M. Jamaluddin (Financial Controller)' },
]

const LOCATIONS_11 = [
  { id: 'salmiya', nameAr: 'فرع السالمية', nameEn: 'Salmiya Branch' },
  { id: 'hawally', nameAr: 'فرع حولي', nameEn: 'Hawally Branch' },
  { id: 'farwaniya', nameAr: 'فرع الفروانية', nameEn: 'Farwaniya Branch' },
  { id: 'mubarak-al-kabeer', nameAr: 'فرع مبارك الكبير', nameEn: 'Mubarak Al-Kabeer Branch' },
  { id: 'khiran', nameAr: 'فرع خيران', nameEn: 'Khiran Branch' },
  { id: 'ardiya', nameAr: 'فرع العارضية الحرفية', nameEn: 'Ardiya Craft Branch' },
  { id: 'mahboula', nameAr: 'فرع المهبولة', nameEn: 'Mahboula Branch' },
  { id: 'fahaheel', nameAr: 'فرع الفحيحيل', nameEn: 'Fahaheel Branch' },
  { id: 'central_kitchen', nameAr: 'المطبخ المركزي', nameEn: 'Central Kitchen' },
  { id: 'hq_office', nameAr: 'المقر الرئيسي — شرق', nameEn: 'HQ Office — Sharq' },
]

const BRANDS_6 = [
  { id: 'china_garden', nameAr: 'تشاينا جاردن', nameEn: 'China Garden' },
  { id: 'franks', nameAr: 'فرانكس', nameEn: "Frank's" },
  { id: 'tahina', nameAr: 'شاورما طحينة', nameEn: 'Tahina Shawarma' },
  { id: 'farm_brown', nameAr: 'فارم براون', nameEn: 'Farm Brown' },
  { id: 'noodle_bar', nameAr: 'ذا نودل بار', nameEn: 'The Noodle Bar' },
  { id: 'karak', nameAr: 'كرك كافتيريا', nameEn: 'Karak Cafeteria' },
  { id: 'shared', nameAr: 'الإدارة المركزية المشتركة', nameEn: 'Central Shared Corporate' },
]

const VEHICLES_LIST = [
  { id: 'none', nameAr: 'بدون ربط سيارة (مصروف غير مروري)', nameEn: 'None — Non-Vehicle Expense' },
  { id: 'car_14_8891', nameAr: 'تويوتا يارس 14-8891 (توصيل الفروانية)', nameEn: 'Toyota Yaris 14-8891 (Farwaniya Delivery)' },
  { id: 'car_22_1043', nameAr: 'وانيت إيسوزو ديماكس 22-1043 (المطبخ المركزي)', nameEn: 'Isuzu D-Max 22-1043 (Central Kitchen)' },
  { id: 'car_65_2241', nameAr: 'نيسان صني 65-2241 (توصيل السالمية)', nameEn: 'Nissan Sunny 65-2241 (Salmiya Delivery)' },
  { id: 'car_18_9902', nameAr: 'باص ميتسوبيشي روزا 18-9902 (نقل عمال المطابخ)', nameEn: 'Mitsubishi Rosa 18-9902 (Staff Shuttle)' },
  { id: 'car_31_4401', nameAr: 'تويوتا هايس 31-4401 (صيانة ربيع طه)', nameEn: 'Toyota Hiace 31-4401 (Maintenance Rabih)' },
]

const EVENTS_LIST = [
  { id: 'none', nameAr: 'لا ينطبق (تشغيل اعتيادي بالفروع)', nameEn: 'N/A — Regular Branch Operation' },
  { id: 'safir_camp', nameAr: 'مخيم السفير الشتوي', nameEn: 'Safir Winter Camp' },
  { id: 'marina_kashta', nameAr: 'كشتة المارينا', nameEn: 'Marina Kashta Event' },
  { id: 'perfumes_expo', nameAr: 'معرض العطور بأرض المعارض مشرف', nameEn: 'Mishref Perfumes Expo' },
  { id: 'kout_booth', nameAr: 'بوث فنتشر فودز مجمع الكوت', nameEn: 'Al Kout Mall Pop-up Booth' },
]

interface OdooExpenseSingleModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: NewExpensePayload) => void
  initialData?: Partial<NewExpensePayload>
}

export function OdooExpenseSingleModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: OdooExpenseSingleModalProps) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'

  const [description, setDescription] = useState(initialData?.descriptionAr || 'شراء مستلزمات طارئة واستبدال أسطوانات غاز')
  const [date, setDate] = useState(initialData?.date || '2026-11-04')
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || 'GAS')
  const [custodianId, setCustodianId] = useState(initialData?.custodianId || 'rabih')
  const [paidBy, setPaidBy] = useState<'employee' | 'company'>(initialData?.paidBy || 'employee')
  const [amountKwd, setAmountKwd] = useState<number>(initialData?.amountKwd || 35.500)
  const [status, setStatus] = useState<ExpenseSingleStatus>(initialData?.status || 'to_submit')
  const [receiptAttached, setReceiptAttached] = useState<boolean>(initialData?.receiptAttached ?? false)
  const [receiptName, setReceiptName] = useState<string>(initialData?.receiptFileName || '')

  // 4-Axis Analytic Splits
  const [showAnalyticPopover, setShowAnalyticPopover] = useState(false)
  const [splits, setSplits] = useState<AnalyticSplitRow[]>(
    initialData?.splits || [
      {
        id: 'split_1',
        percentage: 100,
        locationId: 'central_kitchen',
        brandId: 'shared',
        vehicleId: 'none',
        eventId: 'none',
      },
    ]
  )

  // Chatter state
  const [activeChatterTab, setActiveChatterTab] = useState<'message' | 'note' | 'activity' | 'attachments'>('message')
  const [chatterInput, setChatterInput] = useState('')
  const [chatterLogs, setChatterLogs] = useState<Array<{ id: string; author: string; time: string; text: string; type: 'note' | 'message' | 'system' }>>([
    {
      id: 'log_1',
      author: isAr ? 'عبد الله عبد الغفار (المدير العام)' : 'Abdullah Abdulghaffar (GM)',
      time: isAr ? 'اليوم في 10:33 ص' : 'Today at 10:33 AM',
      text: isAr ? 'تم فتح مسودة المصروف وربطه بمركز تكلفة الشركة المعتمد.' : 'Expense draft initialized and linked to company cost center.',
      type: 'system',
    },
  ])

  if (!isOpen) return null

  const totalSplitPct = splits.reduce((acc, row) => acc + (Number(row.percentage) || 0), 0)

  const handleAddSplit = () => {
    const currentTotal = splits.reduce((acc, r) => acc + r.percentage, 0)
    const remaining = Math.max(0, 100 - currentTotal)
    setSplits([
      ...splits,
      {
        id: `split_${Date.now()}`,
        percentage: remaining > 0 ? remaining : 0,
        locationId: 'salmiya',
        brandId: 'china_garden',
        vehicleId: 'none',
        eventId: 'none',
      },
    ])
  }

  const handleRemoveSplit = (id: string) => {
    if (splits.length === 1) return
    setSplits(splits.filter((s) => s.id !== id))
  }

  const handleUpdateSplit = (id: string, field: keyof AnalyticSplitRow, val: any) => {
    setSplits(splits.map((s) => (s.id === id ? { ...s, [field]: val } : s)))
  }

  const handleAttachReceipt = () => {
    const fakeFileName = `INV-${Math.floor(1000 + Math.random() * 9000)}-RECEIPT.pdf`
    setReceiptAttached(true)
    setReceiptName(fakeFileName)
    setChatterLogs((prev) => [
      {
        id: `att_${Date.now()}`,
        author: isAr ? 'المستخدم الحالي' : 'Current User',
        time: isAr ? 'الآن' : 'Just now',
        text: isAr ? `تم إرفاق مستند الوصل بنجاح: ${fakeFileName} (210 KB)` : `Receipt document attached: ${fakeFileName} (210 KB)`,
        type: 'system',
      },
      ...prev,
    ])
  }

  const handleDuplicate = () => {
    setDescription((prev) => (isAr ? `${prev} (نسخة مكررة)` : `${prev} (Copy)`))
    setChatterLogs((prev) => [
      {
        id: `dup_${Date.now()}`,
        author: isAr ? 'نظام أودو المالي' : 'Odoo Financial Core',
        time: isAr ? 'الآن' : 'Just now',
        text: isAr ? 'تم تكرار السجل بنجاح لإنشاء حركة مصروف إضافية سريعة.' : 'Record duplicated successfully for quick expense cloning.',
        type: 'system',
      },
      ...prev,
    ])
  }

  const handleSendChatter = () => {
    if (!chatterInput.trim()) return
    setChatterLogs((prev) => [
      {
        id: `msg_${Date.now()}`,
        author: isAr ? 'عبد الرحمن جمال الدين (المالية)' : 'Abdulrahman Jamaluddin (Finance)',
        time: isAr ? 'الآن' : 'Just now',
        text: chatterInput.trim(),
        type: activeChatterTab === 'note' ? 'note' : 'message',
      },
      ...prev,
    ])
    setChatterInput('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      descriptionAr: description,
      descriptionEn: description,
      date,
      categoryId,
      custodianId,
      paidBy,
      amountKwd: Number(amountKwd) || 0,
      status,
      receiptAttached,
      receiptFileName: receiptName,
      splits,
    })
    onClose()
  }

  const pipelineStages: { id: ExpenseSingleStatus; labelAr: string; labelEn: string }[] = [
    { id: 'to_submit', labelAr: 'بانتظار الإرسال', labelEn: 'To Submit' },
    { id: 'submitted', labelAr: 'مُرسل للاعتماد', labelEn: 'Submitted' },
    { id: 'approved', labelAr: 'معتمد إدارياً', labelEn: 'Approved' },
    { id: 'paid', labelAr: 'تم السداد', labelEn: 'Paid' },
    { id: 'refused', labelAr: 'مرفوض', labelEn: 'Refused' },
  ]

  const currentStageIndex = pipelineStages.findIndex((s) => s.id === status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative flex flex-col my-auto w-full max-w-5xl rounded-3xl border border-white/15 bg-[#0f141c] text-white shadow-2xl overflow-hidden max-h-[95vh]">
        {/* Top Header Ribbon & Window Controls */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0d14] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-black font-black text-sm shadow-md">
              💰
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">
                  {isAr ? 'تسجيل مصروف فردي جديد (Odoo hr.expense)' : 'New Expense Record (Odoo hr.expense)'}
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                  {isAr ? 'النموذج الرسمي المعتمد' : 'Official Form'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isAr
                  ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م. — ترخيص 2021/22838'
                  : 'Venture Foods Restaurants Management Co. W.L.L. — Lic. 2021/22838'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar & Approval Pipeline Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#121824] px-5 py-2.5">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleAttachReceipt}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                receiptAttached
                  ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700'
              }`}
            >
              <Paperclip size={13} />
              <span>
                {receiptAttached
                  ? (isAr ? 'تم إرفاق الوصل ✓' : 'Receipt Attached ✓')
                  : (isAr ? 'إرفاق الوصل / الفاتورة' : 'Attach Receipt')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus('submitted')
                setChatterLogs((prev) => [
                  {
                    id: `sub_${Date.now()}`,
                    author: isAr ? 'المستخدم الحالي' : 'Current User',
                    time: isAr ? 'الآن' : 'Just now',
                    text: isAr ? 'تم إرسال المصروف لاعتماد المدير المباشر والإدارة المالية.' : 'Expense submitted for direct manager and financial approval.',
                    type: 'system',
                  },
                  ...prev,
                ])
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 px-3.5 py-1.5 text-xs font-black text-white hover:brightness-110 shadow-sm"
            >
              <Send size={13} />
              <span>{isAr ? 'إرسال لاعتماد المدير' : 'Submit to Manager'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAnalyticPopover(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
            >
              <Scissors size={13} />
              <span>{isAr ? 'تقسيم المصروف على الفروع' : 'Split Expense'}</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicate}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
              title={isAr ? 'تكرار السجل' : 'Duplicate'}
            >
              <Copy size={13} />
              <span className="hidden sm:inline">{isAr ? 'تكرار السجل' : 'Duplicate'}</span>
            </button>
          </div>

          {/* Status Pipeline Ribbon */}
          <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/90 p-0.5 text-[11px] font-bold">
            {pipelineStages.map((stage, idx) => {
              const isCurrent = stage.id === status
              const isPassed = idx < currentStageIndex && status !== 'refused'
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setStatus(stage.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                    isCurrent
                      ? stage.id === 'refused'
                        ? 'bg-rose-600 text-white font-black'
                        : 'bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950 font-black shadow-sm'
                      : isPassed
                      ? 'text-emerald-400 hover:bg-slate-800'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isPassed && <CheckCircle2 size={11} />}
                  <span>{isAr ? stage.labelAr : stage.labelEn}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Modal Main Body: Form + Chatter Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* Form Side (7 cols on lg) */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 p-6 space-y-5 border-b lg:border-b-0 lg:border-e border-white/10">
            {/* Description & Date */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'وصف وبيان المصروف (البيان التجاري)' : 'Expense Description & Details'}
                  <span className="text-rose-400 ms-1">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isAr ? 'مثال: شراء أسطوانات غاز للمطبخ المركزي أو رسوم إقامات' : 'e.g. Gas cylinders refill or residency clearance'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {isAr ? 'تاريخ المصروف' : 'Expense Date'}
                    <span className="text-rose-400 ms-1">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {isAr ? 'طريقة الدفع (Paid By)' : 'Paid By'}
                  </label>
                  <select
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-bold"
                  >
                    <option value="employee">
                      {isAr ? 'دُفع بواسطة الموظف / العهدة (يُستحق تعويضه بشيك)' : 'Paid by Employee (To Reimburse)'}
                    </option>
                    <option value="company">
                      {isAr ? 'دُفع مباشرة من حساب الشركة المصرفي' : 'Paid Directly by Company'}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category & Custodian */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'فئة المصروف (فئات الشركة الـ 25)' : 'Expense Category (25 Official)'}
                  <span className="text-rose-400 ms-1">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-semibold truncate"
                >
                  {EXPENSE_CATEGORIES_25.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {isAr ? cat.nameAr : cat.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'صاحب العهدة / الموظف المسؤول' : 'Custodian / Responsible Staff'}
                  <span className="text-rose-400 ms-1">*</span>
                </label>
                <select
                  value={custodianId}
                  onChange={(e) => setCustodianId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none font-semibold truncate"
                >
                  {EXPENSE_CUSTODIANS.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {isAr ? cust.nameAr : cust.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Total Amount & Tax In KWD */}
            <div className="rounded-2xl border border-white/10 bg-[#0a0d14] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400">
                    {isAr ? 'المبلغ الإجمالي بالدينار الكويتي' : 'Total Amount (KWD)'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {isAr ? 'شامل الرسوم والضرائب إن وجدت' : 'Includes all official fees & taxes'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.005"
                    min="0"
                    required
                    value={amountKwd}
                    onChange={(e) => setAmountKwd(parseFloat(e.target.value) || 0)}
                    className="w-36 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right font-mono text-lg font-black text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-300 font-mono">
                    {isAr ? 'د.ك' : 'KWD'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4-AXIS ANALYTIC DISTRIBUTION TRIGGER & PREVIEW */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🎯</span>
                  <span className="text-xs font-black text-amber-300">
                    {isAr ? 'التوزيع التحليلي ومراكز التكلفة (Analytic Distribution)' : 'Analytic Distribution & Cost Centers'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnalyticPopover(!showAnalyticPopover)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20"
                >
                  {showAnalyticPopover
                    ? (isAr ? 'إخفاء المحاور ▲' : 'Hide Axes ▲')
                    : (isAr ? `تعديل المحاور الـ 4 (${splits.length} صفوف - ${totalSplitPct}%) ▾` : `Edit 4 Axes (${splits.length} rows - ${totalSplitPct}%) ▾`)}
                </button>
              </div>

              {/* Quick Summary of Active Split */}
              <div className="space-y-1.5">
                {splits.map((split, i) => {
                  const loc = LOCATIONS_11.find((l) => l.id === split.locationId)
                  const brd = BRANDS_6.find((b) => b.id === split.brandId)
                  const veh = VEHICLES_LIST.find((v) => v.id === split.vehicleId)
                  const evt = EVENTS_LIST.find((e) => e.id === split.eventId)
                  return (
                    <div
                      key={split.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/80 px-3 py-2 border border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400">
                          {split.percentage}%
                        </span>
                        <span className="text-slate-300">
                          {isAr ? loc?.nameAr : loc?.nameEn} · {isAr ? brd?.nameAr : brd?.nameEn}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                        {split.vehicleId !== 'none' && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-blue-300">
                            🚗 {isAr ? veh?.nameAr : veh?.nameEn}
                          </span>
                        )}
                        {split.eventId !== 'none' && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-purple-300">
                            🎪 {isAr ? evt?.nameAr : evt?.nameEn}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* EXPANDABLE 4-AXIS ANALYTIC DISTRIBUTION POPOVER CONTAINER */}
              {showAnalyticPopover && (
                <div className="mt-3 rounded-2xl border border-slate-700 bg-[#0a0d14] p-4 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white">
                      {isAr ? 'محاور التوزيع التحليلي الـ 4 (أودو الرسمي):' : '4 Odoo Analytic Distribution Axes:'}
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSplit}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                    >
                      <Plus size={11} />
                      <span>{isAr ? 'إضافة سطر تقسيم' : 'Add Split Line'}</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {splits.map((split, idx) => (
                      <div
                        key={split.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">
                            {isAr ? `سطر التوزيع #${idx + 1}` : `Distribution Line #${idx + 1}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-slate-400">{isAr ? 'النسبة:' : 'Pct:'}</span>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={split.percentage}
                                onChange={(e) =>
                                  handleUpdateSplit(split.id, 'percentage', parseFloat(e.target.value) || 0)
                                }
                                className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center font-mono text-xs font-bold text-amber-400 focus:outline-none"
                              />
                              <span className="text-xs font-bold text-amber-400">%</span>
                            </div>
                            {splits.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSplit(split.id)}
                                className="text-slate-500 hover:text-rose-400 p-1"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 4 AXIS DROPDOWNS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {/* Axis 1: Location */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              {isAr ? 'المحور 1: الفرع / الموقع' : 'Axis 1: Branch / Location'}
                            </label>
                            <select
                              value={split.locationId}
                              onChange={(e) => handleUpdateSplit(split.id, 'locationId', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                            >
                              {LOCATIONS_11.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {isAr ? l.nameAr : l.nameEn}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Axis 2: Brand */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              {isAr ? 'المحور 2: العلامة التجارية' : 'Axis 2: Brand'}
                            </label>
                            <select
                              value={split.brandId}
                              onChange={(e) => handleUpdateSplit(split.id, 'brandId', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                            >
                              {BRANDS_6.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {isAr ? b.nameAr : b.nameEn}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Axis 3: Fleet Vehicle */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              {isAr ? 'المحور 3: المركبة والأسطول' : 'Axis 3: Fleet Vehicle'}
                            </label>
                            <select
                              value={split.vehicleId}
                              onChange={(e) => handleUpdateSplit(split.id, 'vehicleId', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                            >
                              {VEHICLES_LIST.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {isAr ? v.nameAr : v.nameEn}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Axis 4: Events & Expos */}
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              {isAr ? 'المحور 4: الفعاليات والمعارض' : 'Axis 4: Exhibitions & Camps'}
                            </label>
                            <select
                              value={split.eventId}
                              onChange={(e) => handleUpdateSplit(split.id, 'eventId', e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                            >
                              {EVENTS_LIST.map((ev) => (
                                <option key={ev.id} value={ev.id}>
                                  {isAr ? ev.nameAr : ev.nameEn}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-400">
                      {isAr ? 'إجمالي نسبة التوزيع التحليلي:' : 'Total Analytic Allocation:'}
                    </span>
                    <span
                      className={`font-mono font-black ${
                        totalSplitPct === 100 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {totalSplitPct}% {totalSplitPct === 100 ? '✓' : isAr ? '(يجب أن يساوي 100%)' : '(Must equal 100%)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 px-6 py-2.5 text-xs font-black text-black hover:brightness-110 shadow-lg shadow-emerald-950/40"
              >
                <CheckCircle2 size={15} />
                <span>{isAr ? 'حفظ وتثبيت المصروف' : 'Save & Record Expense'}</span>
              </button>
            </div>
          </form>

          {/* Interactive Audit & Activity Chatter Side (5 cols on lg) */}
          <div className="lg:col-span-5 bg-[#0a0d14] p-5 flex flex-col justify-between border-t lg:border-t-0 space-y-4">
            <div>
              {/* Chatter Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-emerald-400" />
                  <span className="text-xs font-black text-white">
                    {isAr ? 'سجل التدقيق والمحادثة (Chatter)' : 'Audit Trail & Chatter'}
                  </span>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                  {chatterLogs.length}
                </span>
              </div>

              {/* Chatter Tabs */}
              <div className="flex gap-1 border-b border-slate-800 pt-2 pb-2">
                {[
                  { id: 'message' as const, labelAr: 'إرسال رسالة', labelEn: 'Send Message' },
                  { id: 'note' as const, labelAr: 'تسجيل ملاحظة', labelEn: 'Log Note' },
                  { id: 'activity' as const, labelAr: 'جدولة نشاط', labelEn: 'Activity' },
                  { id: 'attachments' as const, labelAr: 'المرفقات', labelEn: 'Files' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveChatterTab(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      activeChatterTab === tab.id
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isAr ? tab.labelAr : tab.labelEn}
                  </button>
                ))}
              </div>

              {/* Chatter Input Box */}
              <div className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  value={chatterInput}
                  onChange={(e) => setChatterInput(e.target.value)}
                  placeholder={
                    activeChatterTab === 'note'
                      ? isAr
                        ? 'سجّل ملاحظة تدقيق داخلية للمحاسبة...'
                        : 'Log internal accounting note...'
                      : isAr
                      ? 'اكتب رسالة أو استفساراً لصاحب العهدة...'
                      : 'Send message to expense holder...'
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAttachReceipt}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400"
                  >
                    <Paperclip size={12} />
                    <span>{isAr ? 'إرفاق ملف' : 'Attach File'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSendChatter}
                    className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-400 hover:bg-slate-700"
                  >
                    <Send size={11} />
                    <span>{isAr ? 'إرسال' : 'Send'}</span>
                  </button>
                </div>
              </div>

              {/* Feed of Logs */}
              <div className="mt-4 space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {chatterLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-300">{log.author}</span>
                      <span className="text-slate-500">{log.time}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{log.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Verification Badge */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2.5">
              <span className="text-lg">🛡️</span>
              <div className="text-[10px] leading-tight">
                <p className="font-bold text-emerald-400">
                  {isAr ? 'نظام التدقيق الرقمي المباشر' : 'Live Digital Audit Engine'}
                </p>
                <p className="text-slate-400">
                  {isAr
                    ? 'يتم ربط كل مصروف تلقائياً بدفتر اليومية ومراكز التكلفة للفروع الـ 9.'
                    : 'Expenses automatically post to 9 branch cost centers and general ledger.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OdooExpenseSingleModal
