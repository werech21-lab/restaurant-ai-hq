'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  FileText,
  Sparkles,
  ShieldAlert,
  Wrench,
  Truck,
  UtensilsCrossed,
  IdCard,
  ArrowUpRight,
  BarChart3,
  Layers,
  Search,
  Download,
  Flame,
  Scale,
  Brain,
  Zap,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  ODOO_CUSTODIANS_7,
  ODOO_EXPENSE_CATEGORIES_25,
  ODOO_EXPENSES_TOTAL_KWD,
  ODOO_EXPENSES_TOTAL_TX,
} from '@/lib/accounting/odoo-real-expenses-data'

interface IntelligenceWorkspaceProps {
  permissions?: readonly string[]
  initialTab?: string
}

export default function IntelligenceWorkspace({
  permissions: _granted,
  initialTab = 'alerts',
}: IntelligenceWorkspaceProps) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'

  const [activeTab, setActiveTab] = useState<string>(
    initialTab === 'radar' || initialTab === 'telemetry' ? 'alerts' : initialTab
  )
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL')
  const [adoptedRecommendations, setAdoptedRecommendations] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')

  // 1. Odoo Anomaly Alerts List (4 Tiers)
  const odooAlerts = useMemo(() => [
    {
      id: 'ALT-SANAD-01',
      tier: 'CRITICAL',
      tierLabelAr: '🔴 خطر مالي/جنائي عاجل',
      tierLabelEn: '🔴 Critical Financial / Forensic Risk',
      titleAr: 'تنبيه عهد ومصاريف أودو — تركز 61.8% في مكتب تعقيب واحد (سند)',
      titleEn: 'Odoo Custody Alert — 61.8% Concentrated in Single PRO Office (Sanad)',
      amountKwd: 31646.750,
      txCount: 1412,
      categoryAr: 'شؤون وإقامات وبلدية',
      categoryEn: 'Govt Clearance & Baladiya',
      costCenter: 'CC-HQ-LEGAL',
      observationAr: 'رصد تركز 61.8% من إجمالي مصروفات العهد (31,646.750 د.ك من أصل 51,154.950 د.ك) في مكتب تعقيب واحد (سند) عبر 1,412 معاملة في أودو، مع رصد معاملات تجديد إقامة وكروت صحة بلدية متكررة تتضمن هوامش أتعاب مرتفعة.',
      observationEn: '61.8% of petty cash (31,646.750 KWD of 51,154.950 KWD) concentrated in a single agency (Sanad) across 1,412 Odoo transactions, with repetitive residency renewals and municipality health cards carrying excessive markups.',
      impactAr: 'فرصة توفير سنوية مباشرة بقيمة 22,200.000 د.ك (1,850 د.ك/شهرياً) عند التحول الداخلي.',
      impactEn: 'Direct annual saving opportunity of 22,200.000 KWD (1,850 KWD/mo) via internal processing.',
      actionStepAr: 'إنشاء وحدة تعقيب داخلي وربط مع بوابات "أسهل" والقوى العاملة وبلدية الكويت مباشرة عبر النظام.',
      actionStepEn: 'Establish in-house clearance unit integrated directly with Kuwait PAM & Baladiya portals.',
      recommendationId: 'REC-SANAD',
    },
    {
      id: 'ALT-MAINT-02',
      tier: 'CRITICAL',
      tierLabelAr: '🔴 خطر مالي/جنائي عاجل',
      tierLabelEn: '🔴 Critical Financial / Forensic Risk',
      titleAr: 'تنبيه صيانة الفروع والثلاجات — تكرار أعطال الكوت مول والسالمية (ربيع أنيس)',
      titleEn: 'Refrigeration Maintenance Drift — Al Kout & Salmiya Repeated Repairs (Rabih)',
      amountKwd: 10707.930,
      txCount: 538,
      categoryAr: 'صيانة المطابخ والفروع',
      categoryEn: 'Kitchen & Refrigeration',
      costCenter: 'CC-FR-KOT / CC-FR-SLM',
      observationAr: 'رصد تكرار أعطال كمبريسور وثلاجات التحضير في فرع الكوت مول والسالمية 9 مرات خلال 75 يوماً بقيمة 10,707.930 د.ك، ما يمثل استنزافاً مادياً وتلفاً متكرراً للأغذية يتطلب الاستبدال الجذري بدلاً من الترقيع المستمر.',
      observationEn: 'Repetitive compressor and prep-table chiller breakdowns at Al Kout and Salmiya (9 incidents in 75 days, totaling 10,707.930 KWD) causing food loss risk. Requires complete replacement instead of recurring patchwork.',
      impactAr: 'تخفيض فاتورة الصيانة الشهرية بمقدار 890.000 د.ك وحماية مخزون لحوم وأجبان بقيمة 3,800 د.ك.',
      impactEn: 'Reduce monthly maintenance costs by 890.000 KWD and safeguard 3,800 KWD in meat/cheese inventory.',
      actionStepAr: 'استبدال وحدتي التبريد القديمتين بضمان 3 سنوات وإبرام عقد صيانة وقائية شامل مع شركة معتمدة.',
      actionStepEn: 'Procure 2 heavy-duty inverter chillers with 3-year warranty and sign unified SLA contract.',
      recommendationId: 'REC-MAINT',
    },
    {
      id: 'ALT-COMM-03',
      tier: 'OPERATIONAL',
      tierLabelAr: '🟠 انحراف تشغيلي وتكلفة',
      tierLabelEn: '🟠 Operational & Cost Drift',
      titleAr: 'تنبيه عمولات منصات التوصيل — خسارة فرق عمولة (+7%) في أوقات وفرة الأسطول',
      titleEn: 'Aggregator Commission Abuse — 17% Forced Platform Fleet vs 10% Own Fleet',
      amountKwd: 41040.000,
      txCount: 6554,
      categoryAr: 'عمولات التوصيل والمنصات',
      categoryEn: 'Aggregator Commissions',
      costCenter: 'CC-ALL-DLV',
      observationAr: 'رصد 6,554 طلباً تم تحويلها لسائقي المنصات بعمولة 17% (توصيل المنصة) أثناء وجود سائقي أسطول فنتشر فودز (10%) في حالة خمول بالفرع، مما كبّد الشركة فارق عمولة ضائع (+7%) بقيمة 3,420 د.ك شهرياً.',
      observationEn: '6,554 orders dispatched via aggregator drivers at 17% while Venture Foods fleet (10%) riders were available nearby, causing an unrecovered +7% commission drain of 3,420 KWD/month.',
      impactAr: 'استرداد وتوفير 41,040.000 د.ك سنوياً (3,420 د.ك شهرياً) ومطالبة المنصة بالتعويض عن الإغلاقات.',
      impactEn: 'Recapture 41,040.000 KWD annually (3,420 KWD/mo) and file formal SLA penalty claim with aggregator.',
      actionStepAr: 'إعادة جدولة ورديات السائقين لربطها بخرائط الذروة وتفعيل الحظر التلقائي للتحويل إلى 17%.',
      actionStepEn: 'Rebalance fleet schedules to match peak heatmaps and enforce automated 10% fleet dispatch lock.',
      recommendationId: 'REC-FLEET',
    },
    {
      id: 'ALT-BOM-04',
      tier: 'OPERATIONAL',
      tierLabelAr: '🟠 انحراف تشغيلي وتكلفة',
      tierLabelEn: '🟠 Operational & Cost Drift',
      titleAr: 'تنبيه انحراف الوصفات والمخزون — تجاوز استهلاك اللحوم والزيوت والصوصات نسبة +4.5%',
      titleEn: 'BOM & Recipe Variance — Meat, Cooking Oil & Sauces Exceed Standard by +4.5%',
      amountKwd: 27126.000,
      txCount: 364,
      categoryAr: 'الوصفات وتكلفة الغذاء',
      categoryEn: 'Recipes & Food Cost',
      costCenter: 'CC-QRN-KITCHEN',
      observationAr: 'رصد تجاوز الاستهلاك الفعلي في أودو لبراندي تشاينا جاردن وفرانكس للوصفة المعيارية (BOM) بأكثر من +4.5% في بنود (اللحم البقري، الزيوت، صوص التيرياكي، صوص الشاورما) بالمطبخ المركزي وفروع القرين والسالمية.',
      observationEn: 'Actual Odoo recipe consumption for China Garden and Franks exceeded standard BOM by +4.5% on beef, frying oil, and specialty sauces at Qurain Central Kitchen and Salmiya.',
      impactAr: 'توفير فوري قدره 2,260.500 د.ك شهرياً (27,126.000 د.ك سنوياً) وتخفيض Food Cost من 24.8% إلى 22.9%.',
      impactEn: 'Immediate monthly savings of 2,260.500 KWD (27,126 KWD/yr) lowering Food Cost from 24.8% to 22.9%.',
      actionStepAr: 'معايرة موازين الحصص في محطات التجهيز وربط الصرف بأودو مع كميات الوجبات المباعة فعلياً.',
      actionStepEn: 'Calibrate prep station portion scales and mandate strict digital BOM deduction against POS sales.',
      recommendationId: 'REC-FOOD',
    },
    {
      id: 'ALT-HR-05',
      tier: 'GOV_DUE',
      tierLabelAr: '🟡 تنبيه استحقاق حكومي/إقامات',
      tierLabelEn: '🟡 Government Due Dates & Residency',
      titleAr: 'تنبيه استحقاق إقامات وكروت صحة البلدية لـ 166 موظفاً (لتفادي غرامات الشؤون)',
      titleEn: 'Residency, Health Insurance & Baladiya Expiries Alert (166 Employees)',
      amountKwd: 23635.800,
      txCount: 166,
      categoryAr: 'الموارد البشرية وقانون العمل',
      categoryEn: 'HR & Labor Compliance',
      costCenter: 'CC-HQ-HR',
      observationAr: 'رصد 34 موظفاً تنتهي إقاماتهم خلال 45 يوماً (14,912.800 د.ك) و22 كرت صحة بلدية تستحق التجديد (1,778 د.ك) وضمان صحي (6,945 د.ك). التأخير يعرض المطاعم لغرامات بلدية وإيقاف ملف الهيئة العامة للقوى العاملة.',
      observationEn: '34 employee residencies expiring within 45 days (14,912.800 KWD), 22 municipality health cards (1,778 KWD), and MOH insurance (6,945 KWD). Delay risks PAM file suspension and municipal fines.',
      impactAr: 'حماية المنظومة من غرامات فورية (50 د.ك لكل موظف شهرياً) وتفادي إغلاق صالات الفروع.',
      impactEn: 'Prevent instant PAM fines (50 KWD/worker/mo) and eliminate risk of branch closure by Baladiya inspectors.',
      actionStepAr: 'جدولة السداد الجماعي للرسوم قبل 30 يوماً وتعيين منسق داخلي لإجراء الفحوصات الطبية المجدولة.',
      actionStepEn: 'Schedule batch digital fee settlements 30 days prior and assign in-house coordinator for medicals.',
      recommendationId: 'REC-HR',
    },
  ], [])

  // 2. Actionable AI Recommendations List (4 Pillars)
  const aiRecommendations = useMemo(() => [
    {
      id: 'REC-SANAD',
      pillarAr: '💼 خفض التكاليف الحكومية والإدارية',
      pillarEn: 'Corporate & Gov Cost Reduction',
      titleAr: 'التحول التدريجي من مكتب "سند" إلى الإدارة الذاتية للقوى العاملة والبلدية',
      titleEn: 'Phased Migration from Agency "Sanad" to In-House Digital Clearance',
      badgeAr: 'توفير سنوي 22,200 د.ك',
      badgeEn: '22,200 KWD Annual Savings',
      monthlySavingsKwd: 1850.000,
      annualSavingsKwd: 22200.000,
      odooDataProofAr: 'تحليل أودو: 1,412 حركة بقيمة 31,646.750 د.ك، تتضمن أتعاب تعقيب إضافية بنسبة 28% فوق الرسوم الرسمية.',
      odooDataProofEn: 'Odoo Audit: 1,412 transactions totaling 31,646.750 KWD, with 28% average agency markups above state fees.',
      steps: [
        { num: '1', textAr: 'تفعيل المفوض بالتوقيع الإلكتروني لمجموعة فنتشر فودز عبر بوابة "أسهل" وموقع بلدية الكويت.', textEn: 'Activate digital authorized signatory on Kuwait PAM Sahel portal & Baladiya system.' },
        { num: '2', textAr: 'إسناد المعاملات لموظف شؤون داخلي براتب ثابت، مما يوفر أكثر من 70% من أتعاب المعاملة الواحدة.', textEn: 'Assign renewals to internal HR clerk on fixed salary, saving >70% of per-transaction broker fees.' },
        { num: '3', textAr: 'قصر التعامل مع "سند" على الحالات الاستثنائية والمعقدة فقط باعتماد مسبق من المدير العام.', textEn: 'Restrict external agency engagement solely to complex legal exceptions pre-approved by GM.' },
      ],
    },
    {
      id: 'REC-FLEET',
      pillarAr: '🚚 تعظيم أرباح التوصيل والمنصات',
      pillarEn: 'Delivery & Platform Margin Optimization',
      titleAr: 'إعادة توزيع أسطول الشركة على فروع الذروة وخفض عمولة المنصات من 17% إلى 10%',
      titleEn: 'Dynamic Fleet Rebalancing to Shift Orders from 17% Aggregator to 10% Company Fleet',
      badgeAr: 'توفير سنوي 41,040 د.ك',
      badgeEn: '41,040 KWD Annual Savings',
      monthlySavingsKwd: 3420.000,
      annualSavingsKwd: 41040.000,
      odooDataProofAr: 'تحليل أودو: 33.3% من المبيعات تمر عبر توصيل المنصة 17% مقابل 3.9% فقط لأسطول الشركة 10%.',
      odooDataProofEn: 'Odoo Analytics: 33.3% of sales channeled via 17% platform fleet vs only 3.9% on 10% company fleet.',
      steps: [
        { num: '1', textAr: 'نقل 6 دراجات نارية من الفروع ذات الطلب المنخفض إلى فرعي القرين والسالمية في ساعات الذروة (7-11 م).', textEn: 'Relocate 6 company delivery bikes to Qurain & Salmiya during evening peak rush (7-11 PM).' },
        { num: '2', textAr: 'تفعيل خوارزمية الأولوية في نقاط البيع لأودو لتعيين أسطول الشركة أولاً قبل فتح طلبات المنصة.', textEn: 'Enable POS dispatch logic in Odoo prioritizing internal riders before releasing orders to platform.' },
        { num: '3', textAr: 'تقديم مطالبة مالية رسمية لشركة طلبات عن فرق العمولة الناتج عن إغلاقات Busy غير المبررة (SLA Claim).', textEn: 'File official SLA penalty reimbursement claim with Talabat KAM for unnotified Busy blackouts.' },
      ],
    },
    {
      id: 'REC-FOOD',
      pillarAr: '🥩 ضبط تكلفة الأغذية والهدر بالمطبخ المركزي',
      pillarEn: 'Food Cost & Central Kitchen BOM Control',
      titleAr: 'معايرة الوصفات المعيارية وإعادة التفاوض مع موردي اللحوم والزيوت الأكثر تضخماً',
      titleEn: 'Standard BOM Yield Calibration & Supplier Renegotiation for Top Ingredients',
      badgeAr: 'توفير سنوي 27,126 د.ك',
      badgeEn: '27,126 KWD Annual Savings',
      monthlySavingsKwd: 2260.500,
      annualSavingsKwd: 27126.000,
      odooDataProofAr: 'تحليل أودو: استهلاك اللحم البقري وزيوت القلي يتجاوز معايير الوصفات بنسبة +4.5%، بقيمة هدر 2,260 د.ك شهرياً.',
      odooDataProofEn: 'Odoo Analysis: Beef & oil consumption exceeds theoretical BOM by +4.5%, representing 2,260 KWD/mo variance.',
      steps: [
        { num: '1', textAr: 'تطبيق التقطيع والتتبيل الموزون آلياً بالمطبخ المركزي بالقرين وتوريد حصص مفرغة الهواء للفروع.', textEn: 'Enforce automated portioning & vacuum-packing at Qurain Central Kitchen before branch dispatch.' },
        { num: '2', textAr: 'إلزام الطهاة بإدخال أوزان الهدر التالف في أودو يومياً بدلاً من التسوية الإجمالية في نهاية الشهر.', textEn: 'Mandate daily kitchen waste logging in Odoo instead of arbitrary end-of-month write-offs.' },
        { num: '3', textAr: 'توحيد حجم المشتريات بين تشاينا جاردن ونودل بار والتفاوض مع الموردين للحصول على خصم 6.5%.', textEn: 'Consolidate meat & oil purchasing volumes across brands to secure 6.5% tiered supplier rebate.' },
      ],
    },
    {
      id: 'REC-MAINT',
      pillarAr: '❄️ الصيانة الوقائية وغرف التبريد',
      pillarEn: 'Preventive Maintenance & Cold Chain',
      titleAr: 'استبدال ثلاجات الكوت والسالمية وإبرام عقد صيانة وقائية موحد للغرف والمعدات',
      titleEn: 'Commercial Fridge Replacement & Unified Preventive Cold-Chain Contract',
      badgeAr: 'توفير سنوي 10,680 د.ك',
      badgeEn: '10,680 KWD Annual Savings',
      monthlySavingsKwd: 890.000,
      annualSavingsKwd: 10680.000,
      odooDataProofAr: 'تحليل أودو: 10,707.930 د.ك مصروفات صيانة عهدة ربيع أنيس يحيى، 62% منها إصلاحات متكررة لنفس المعدات.',
      odooDataProofEn: 'Odoo Audit: 10,707.930 KWD spent via Rabih custody; 62% were repetitive repairs on identical units.',
      steps: [
        { num: '1', textAr: 'استبدال الثلاجات التالفة في الكوت مول والسالمية فوراً لتفادي تكرار فواتير الإصلاح وقطع الغيار.', textEn: 'Procure new high-efficiency prep chillers for Al Kout and Salmiya to halt emergency repair leaks.' },
        { num: '2', textAr: 'توقيع عقد صيانة سنوي موحد بزيارات دورية شهرية لكافة الفروع الـ 9 وغرف تبريد القرين.', textEn: 'Sign unified preventive maintenance SLA with monthly scheduled audits across all 9 branches.' },
        { num: '3', textAr: 'ربط حساسات إنترنت الأشياء (IoT) للحرارة بمنظومة الرادار للتنبيه قبل وصول الحرارة لدرجة الخطر.', textEn: 'Connect digital temperature IoT sensors to AetherBI radar for proactive 24/7 cold-chain telemetry.' },
      ],
    },
  ], [])

  // 3. Custodians Breakdown Data (51,154.950 KWD)
  const custodiansData = useMemo(() => [
    { nameAr: 'سند للتعقيب والخدمات الحكومية', nameEn: 'Sanad PRO & Govt Services', amountKwd: 31646.750, pct: 61.86, txCount: 1412, roleAr: 'إقامات، كروت بلدية، ضمان صحي، رخص تجارية', roleEn: 'Residencies, Baladiya, MOH, Licenses', avgTxKwd: 22.41, stdDev: '± 8.4%' },
    { nameAr: 'ربيع عطا طه (صيانة المطابخ والفروع)', nameEn: 'Rabih Atta Taha (Maintenance)', amountKwd: 10707.930, pct: 20.93, txCount: 538, roleAr: 'صيانة غرف تبريد، كمبريسورات، كهرباء، إطفاء', roleEn: 'Cold rooms, compressors, HVAC, fire safety', avgTxKwd: 19.90, stdDev: '± 12.1%' },
    { nameAr: 'شيلا أمبوس بولبولي (إسناد وتشغيل)', nameEn: 'Sheila Ambos Bulboli (Operations)', amountKwd: 2840.400, pct: 5.55, txCount: 114, roleAr: 'مشتريات تشغيل طارئة، إسناد لوجستي للفروع', roleEn: 'Emergency ops, branch consumables', avgTxKwd: 24.91, stdDev: '± 5.2%' },
    { nameAr: 'أمجد سمير (المشتريات السريعة)', nameEn: 'Amjad Samir (Fast Procurement)', amountKwd: 2115.650, pct: 4.14, txCount: 86, roleAr: 'شراء خضار ومواد طازجة عاجلة للفروع', roleEn: 'Fresh produce, dairy branch supplements', avgTxKwd: 24.60, stdDev: '± 6.8%' },
    { nameAr: 'شيام (الموارد البشرية والشؤون)', nameEn: 'Shyam (HR & Welfare)', amountKwd: 1420.250, pct: 2.78, txCount: 42, roleAr: 'تنقلات العمال، رعاية وسكن الموظفين', roleEn: 'Worker transit, staff welfare & housing', avgTxKwd: 33.81, stdDev: '± 4.9%' },
    { nameAr: 'نادر نزهي (الخدمات العامة)', nameEn: 'Nader Nezhy (General Services)', amountKwd: 1180.500, pct: 2.31, txCount: 38, roleAr: 'نثريات إدارية، رسوم اتصالات وبريد', roleEn: 'Corporate admin, courier & communications', avgTxKwd: 31.06, stdDev: '± 3.8%' },
    { nameAr: 'شكر الله ناصيف (المستودع والإسناد)', nameEn: 'Shokrallah Nassif (Warehouse Support)', amountKwd: 850.320, pct: 1.66, txCount: 22, roleAr: 'أدوات تغليف وطوارئ شحن القرين', roleEn: 'Packaging tools & Qurain warehouse support', avgTxKwd: 38.65, stdDev: '± 5.1%' },
    { nameAr: 'نوشا شريف (نثريات الضيافة والإدارة)', nameEn: 'Nousha Sharif (Office Hospitality)', amountKwd: 393.150, pct: 0.77, txCount: 16, roleAr: 'ضيافة مكتب الإدارة العامة والاجتماعات', roleEn: 'HQ office pantry, executive hospitality', avgTxKwd: 24.57, stdDev: '± 2.4%' },
  ], [])

  // 4. Pareto 80/20 Analysis (Top Categories driving 82.4% of cost)
  const paretoData = useMemo(() => [
    { rank: 1, nameAr: 'مصاريف تجديد الإقامات وأذونات العمل', nameEn: 'Residency Renewals & PAM Permits', amountKwd: 14912.800, pct: 29.15, cumPct: 29.15, categoryAr: 'شؤون وقوى عاملة' },
    { rank: 2, nameAr: 'الصيانة العامة للمطابخ والفروع', nameEn: 'Kitchen & Branch Maintenance', amountKwd: 10707.930, pct: 20.93, cumPct: 50.08, categoryAr: 'صيانة وتبريد' },
    { rank: 3, nameAr: 'رسوم الضمان الصحي وبطاقات وزارة الصحة', nameEn: 'Health Insurance & MOH Fees', amountKwd: 6945.000, pct: 13.58, cumPct: 63.66, categoryAr: 'صحة وضمان' },
    { rank: 4, nameAr: 'الإعلانات والتراخيص التجارية والبلدية', nameEn: 'Baladiya Licenses & Ads Approvals', amountKwd: 4216.500, pct: 8.24, cumPct: 71.90, categoryAr: 'بلدية وتراخيص' },
    { rank: 5, nameAr: 'فحص العمالة وكروت الصحة للبلدية', nameEn: 'Staff Medical Exams & Health Cards', amountKwd: 1778.000, pct: 3.48, cumPct: 75.38, categoryAr: 'كروت صحة' },
    { rank: 6, nameAr: 'باقي بنود المصروفات الـ 20 مجتمعة', nameEn: 'Remaining 20 Expense Items Combined', amountKwd: 12594.720, pct: 24.62, cumPct: 100.00, categoryAr: 'نثريات وتشغيل' },
  ], [])

  const handleAdopt = (id: string, titleAr: string) => {
    setAdoptedRecommendations((prev) => ({ ...prev, [id]: true }))
    setToastMessage(
      isAr
        ? `✅ تم اعتماد التوصية بنجاح: "${titleAr}" — تم تصدير التقرير الفني والتنفيذي وتوجيهه إلى المدير العام (GM)!`
        : `✅ Recommendation adopted: "${titleAr}" — Executive GM briefing report generated and dispatched!`
    )
    setTimeout(() => setToastMessage(null), 7000)
  }

  const filteredAlerts = odooAlerts.filter((a) => {
    if (selectedSeverity !== 'ALL' && a.tier !== selectedSeverity) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (
        a.titleAr.toLowerCase().includes(q) ||
        a.titleEn.toLowerCase().includes(q) ||
        a.observationAr.toLowerCase().includes(q) ||
        a.observationEn.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="w-full max-w-none space-y-6 text-slate-900 dark:text-slate-100" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 end-5 z-50 max-w-lg rounded-2xl border border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100 p-4 shadow-2xl backdrop-blur transition-all duration-300">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs font-bold leading-relaxed">{toastMessage}</div>
          </div>
        </div>
      )}

      {/* TOP HEADER: ODOO CONNECTION STATUS BAR & SYSTEM BANNER */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
              {isAr
                ? '🟢 متصل بقاعدة بيانات أودو (Odoo ERP) — شركة فنتشر فودز لإدارة المطاعم ذ.م.م.'
                : '🟢 Connected to Odoo ERP Database — Venture Foods W.L.L. (Lic. 2021/22838)'}
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
              {isAr
                ? '🚨 مركز التنبيهات والانحرافات الجنائية ومحرك التوصيات في أودو'
                : '🚨 Odoo Forensic Anomaly Radar & Actionable AI Decision Studio'}
            </h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {isAr
                ? 'تم تحليل 2,213 قيد مصروفات وعهد، 166 ملف موظف، 364 وصفة معيارية، ومبيعات الـ 6 علامات تجارية والـ 9 فروع النشطة والمطبخ المركزي بالقرين.'
                : 'Audited 2,213 Odoo expense & custody entries, 166 employee files, 364 standard recipes across 6 brands, 9 active branches & Qurain Central Kitchen.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <span>🔭 {isAr ? 'المرصد التنفيذي' : 'Executive Sentinel'}</span>
            </Link>
            <Link
              href="/erp/aggregator-radar"
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 px-4 py-2.5 text-xs font-bold transition hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              <span>🗺️ {isAr ? 'رادار منصات التوصيل' : 'Delivery Radar'}</span>
            </Link>
          </div>
        </div>

        {/* 4 Quick Stat Pills */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-200 dark:border-slate-800/60 pt-4 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{isAr ? 'إجمالي قيود العهد بأودو:' : 'Odoo Custody Entries:'}</div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">
              51,154.950 <span className="text-xs font-normal text-slate-500">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="text-[10px] text-slate-500">{isAr ? '2,213 معاملة مدققة' : '2,213 audited txns'}</div>
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3">
            <div className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">{isAr ? 'انحرافات حرجة مكتشفة:' : 'Critical Anomalies:'}</div>
            <div className="text-lg font-black text-rose-700 dark:text-rose-400 mt-0.5 font-mono">
              7 <span className="text-xs font-normal">{isAr ? 'انحرافات نشطة' : 'Active alerts'}</span>
            </div>
            <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80">{isAr ? 'تتطلب تدخلاً تنفيذياً' : 'Action required'}</div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
            <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">{isAr ? 'فرص التوفير المالي:' : 'Potential Savings:'}</div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5 font-mono">
              8,420.500 <span className="text-xs font-normal">{isAr ? 'د.ك/شهر' : 'KWD/mo'}</span>
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">{isAr ? '101,046 د.ك سنوياً' : '101,046 KWD/yr'}</div>
          </div>

          <div className="rounded-xl border border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 p-3">
            <div className="text-[11px] text-purple-700 dark:text-purple-300 font-bold">{isAr ? 'مؤشر صحة أودو:' : 'Odoo Health Score:'}</div>
            <div className="text-lg font-black text-purple-700 dark:text-purple-400 mt-0.5 font-mono">
              84 <span className="text-xs font-normal text-slate-500">/ 100</span>
            </div>
            <div className="text-[10px] text-purple-600/80 dark:text-purple-400/80">{isAr ? 'جيد مع فرص تحسين' : 'Good with quick wins'}</div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'alerts', labelAr: '🚨 رادار التنبيهات والانحرافات الجنائية', labelEn: 'Forensic Anomaly Radar', icon: AlertTriangle, count: odooAlerts.length },
          { id: 'recommendations', labelAr: '💡 محرك التوصيات وفرص التوفير (AI Studio)', labelEn: 'AI Recommendations Studio', icon: Sparkles, count: aiRecommendations.length },
          { id: 'statistics', labelAr: '📊 المحلل الإحصائي والمالي العميق (4D & Pareto)', labelEn: '4D Statistics & Pareto 80/20', icon: BarChart3 },
          { id: 'custody', labelAr: '⚖️ تفصيل وحوكمة العهد الـ 8 (51,154 د.ك)', labelEn: '8 Custodians Ledger & Sanad', icon: Scale },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold transition-all shadow-sm ${
                active
                  ? 'bg-emerald-600 text-white shadow-emerald-600/25 scale-[1.01]'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={15} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== undefined && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: FORENSIC ANOMALY RADAR                                          */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'مستوى الخطورة:' : 'Severity Level:'}</span>
              {[
                { id: 'ALL', labelAr: 'الكل (5)', labelEn: 'All (5)' },
                { id: 'CRITICAL', labelAr: '🔴 خطر عاجل (2)', labelEn: 'Critical (2)' },
                { id: 'OPERATIONAL', labelAr: '🟠 انحراف تكلفة (2)', labelEn: 'Operational (2)' },
                { id: 'GOV_DUE', labelAr: '🟡 استحقاق حكومي (1)', labelEn: 'Govt Due (1)' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setSelectedSeverity(lvl.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    selectedSeverity === lvl.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {isAr ? lvl.labelAr : lvl.labelEn}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث في التنبيهات والانحرافات...' : 'Search anomalies & observations...'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Alerts Cards List */}
          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-md transition hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? alert.tierLabelAr : alert.tierLabelEn}
                      </span>
                      <span className="font-mono text-xs text-slate-400">#{alert.id}</span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        {alert.costCenter}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-black text-slate-900 dark:text-white sm:text-lg">
                      {isAr ? alert.titleAr : alert.titleEn}
                    </h3>
                  </div>

                  <div className="text-end">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{isAr ? 'القيمة المرتبطة بأودو:' : 'Odoo Value:'}</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                      {alert.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                    </div>
                    <div className="text-[10px] text-slate-400">{alert.txCount} {isAr ? 'معاملة/حركة' : 'txns'}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'الملاحظة الجنائية المكتشفة في أودو:' : 'Forensic Observation in Odoo:'}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                        {isAr ? alert.observationAr : alert.observationEn}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                      <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        💡 {isAr ? 'الأثر المالي وفرصة التوفير:' : 'Financial Impact & Potential Savings:'}
                      </div>
                      <div className="mt-0.5 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
                        {isAr ? alert.impactAr : alert.impactEn}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                    <div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? 'الإجراء التصحيحي المطلوب:' : 'Required Corrective Action:'}</div>
                      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {isAr ? alert.actionStepAr : alert.actionStepEn}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('recommendations')
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-black text-white shadow transition"
                    >
                      <span>🔍 {isAr ? 'افحص الانحراف والتوصية' : 'Inspect Anomaly & Recommendation'}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: AI RECOMMENDATIONS & DECISION STUDIO                            */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {isAr ? '💡 محرك التوصيات التنفيذية وفرص التوفير المالي' : '💡 Actionable AI Recommendations & Cost-Reduction Studio'}
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {isAr
                    ? '4 توصيات محورية مبنية على تحليل قيود أودو الحقيقية — تحقق وفراً مالياً سنوياً قدره 101,046 د.ك (8,420.500 د.ك شهرياً).'
                    : '4 key strategic recommendations derived from real Odoo entries — delivering 101,046 KWD annual run-rate savings (8,420.500 KWD/mo).'}
                </p>
              </div>
              <div className="text-end">
                <span className="text-xs text-slate-500">{isAr ? 'إجمالي التوفير الشهري المباشر:' : 'Total Monthly Savings:'}</span>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  8,420.500 <span className="text-sm font-bold">{isAr ? 'د.ك' : 'KWD'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {aiRecommendations.map((rec) => {
              const isAdopted = adoptedRecommendations[rec.id]
              return (
                <div
                  key={rec.id}
                  className={`rounded-3xl border p-6 shadow-md transition ${
                    isAdopted
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {isAr ? rec.pillarAr : rec.pillarEn}
                      </span>
                      <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                        {isAr ? rec.titleAr : rec.titleEn}
                      </h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/60 px-3 py-1 text-xs font-black text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                      {isAr ? rec.badgeAr : rec.badgeEn}
                    </span>
                  </div>

                  {/* Monthly & Annual Impact */}
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{isAr ? 'التوفير الشهري المباشر:' : 'Monthly Savings:'}</div>
                      <div className="text-base font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                        +{rec.monthlySavingsKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                    </div>
                    <div className="border-s border-slate-200 dark:border-slate-800 ps-3">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{isAr ? 'الأثر السنوي المتوقع:' : 'Annual Impact:'}</div>
                      <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                        +{rec.annualSavingsKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </div>
                    </div>
                  </div>

                  {/* Supporting Odoo Data Proof */}
                  <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">📊 {isAr ? 'البيانات الداعمة من قيود أودو:' : 'Odoo Evidence:'} </span>
                    {isAr ? rec.odooDataProofAr : rec.odooDataProofEn}
                  </div>

                  {/* 3 Action Steps */}
                  <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{isAr ? 'خطوات التنفيذ الـ 3 المحددة:' : '3 Concrete Implementation Steps:'}</div>
                    {rec.steps.map((st) => (
                      <div key={st.num} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-black">
                          {st.num}
                        </span>
                        <span className="leading-relaxed">{isAr ? st.textAr : st.textEn}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                    {isAdopted ? (
                      <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500/50 py-3 text-xs font-black text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 size={16} />
                        <span>{isAr ? 'تم اعتماد التوصية وتصدير تقرير الإجراءات للمدير العام (GM)' : 'Adopted · Executive Action Report Dispatched to GM'}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAdopt(rec.id, rec.titleAr)}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 py-3 text-xs font-black text-white shadow-lg transition"
                      >
                        <FileText size={15} />
                        <span>{isAr ? 'اعتماد التوصية وتصدير تقرير للـ GM' : 'Adopt Recommendation & Export GM Brief'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: 4D PROFITABILITY & PARETO 80/20                                 */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {/* Pareto 80/20 Card */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white sm:text-lg">
                  {isAr ? '📈 تحليل باريتو الإحصائي لقاعدة (80/20) لمصروفات أودو' : '📈 Pareto 80/20 Statistical Analysis of Odoo Expenses'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {isAr
                    ? 'أعلى 5 بنود في أودو تستحوذ على 75.38% من إجمالي التكاليف (38,560.230 د.ك من أصل 51,154.950 د.ك).'
                    : 'Top 5 expense items drive 75.38% of total Odoo custody disbursements (38,560.230 KWD of 51,154.950 KWD).'}
                </p>
              </div>
              <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-3 py-1 text-xs font-bold">
                {isAr ? 'قاعدة 80/20 مدققة' : '80/20 Audited'}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 text-start">#</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'بند المصروف بأودو' : 'Expense Category'}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'القطاع' : 'Division'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'النسبة من الإجمالي' : 'Share %'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'التراكمي (Pareto %)' : 'Cumulative %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {paretoData.map((row) => (
                    <tr key={row.rank} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-3 font-mono font-bold text-slate-500">{row.rank}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        {isAr ? row.nameAr : row.nameEn}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.categoryAr}</td>
                      <td className="py-3 px-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                        {row.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                      </td>
                      <td className="py-3 px-3 text-end font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {row.pct}%
                      </td>
                      <td className="py-3 px-3 text-end font-mono font-bold text-purple-600 dark:text-purple-400">
                        {row.cumPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4D Profitability Dimensions Matrix */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-md">
            <h3 className="text-base font-black text-slate-900 dark:text-white sm:text-lg">
              {isAr ? '🌐 إحصائيات الربحية الرباعية بأودو (4D Profitability Analysis)' : '🌐 Odoo 4D Profitability Analysis'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {isAr
                ? 'تحليل الأبعاد الأربعة في أودو: (العلامة التجارية × الفرع × القسم التشغيلي × قناة البيع والتوصيل).'
                : 'Evaluating 4 primary Odoo dimensions: (Brand × Branch × Division × Channel).'}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
                <div className="text-xs font-bold text-slate-500">{isAr ? 'البُعد 1: العلامة التجارية' : 'Dimension 1: Brand'}</div>
                <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">{isAr ? 'تشاينا جاردن (84.8%)' : 'China Garden (84.8%)'}</div>
                <div className="text-xs text-slate-500 mt-1">141,662.650 د.ك · هامش 28.4%</div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
                <div className="text-xs font-bold text-slate-500">{isAr ? 'البُعد 2: الفرع الأعلى كفاءة' : 'Dimension 2: Top Branch'}</div>
                <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">{isAr ? 'مطبخ القرين المركزي' : 'Qurain Central Kitchen'}</div>
                <div className="text-xs text-slate-500 mt-1">36,400.000 د.ك · هامش 32.1%</div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
                <div className="text-xs font-bold text-slate-500">{isAr ? 'البُعد 3: القسم التشغيلي' : 'Dimension 3: Division'}</div>
                <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">{isAr ? 'التوصيل والمنصات (60%)' : 'Delivery Aggregators (60%)'}</div>
                <div className="text-xs text-slate-500 mt-1">103,876.750 د.ك مبيعات مجمعة</div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
                <div className="text-xs font-bold text-slate-500">{isAr ? 'البُعد 4: قناة البيع الأكثر ربحية' : 'Dimension 4: Top Channel'}</div>
                <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">{isAr ? 'الصالات والسفري المباشر' : 'Dine-In & Direct Takeaway'}</div>
                <div className="text-xs text-slate-500 mt-1">58,972.250 د.ك · عمولة 0%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 4: 8 CUSTODIANS LEDGER & SANAD GOVERNANCE                          */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'custody' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white sm:text-lg">
                  {isAr ? '⚖️ مصفوفة إحصاء العهد الـ 8 وتوزيع الـ 51,154.950 د.ك في أودو' : '⚖️ 8 Custodians Ledger & Odoo Petty Cash Matrix (51,154.950 KWD)'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {isAr
                    ? 'كشف إحصائي تفصيلي يوضح الحصة النسبية، عدد المعاملات، المتوسط الحسابي، والانحراف المعياري لكل عهدة.'
                    : 'Detailed breakdown displaying relative share, txn volume, mean ticket size, and standard deviation per custodian.'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'إجمالي العهد: 51,154.950 د.ك' : 'Total Custody: 51,154.950 KWD'}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'العهدة / الشخص المسؤول' : 'Custodian'}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'طبيعة المصروفات' : 'Role / Scope'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'عدد الحركات' : 'Txns'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'المتوسط (د.ك)' : 'Mean (KWD)'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'الانحراف' : 'Std Dev'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'الإجمالي (د.ك)' : 'Total (KWD)'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'النسبة %' : 'Share %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {custodiansData.map((c) => (
                    <tr key={c.nameEn} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        {isAr ? c.nameAr : c.nameEn}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {isAr ? c.roleAr : c.roleEn}
                      </td>
                      <td className="py-3 px-3 text-end font-mono text-slate-500">{c.txCount}</td>
                      <td className="py-3 px-3 text-end font-mono text-slate-700 dark:text-slate-300 font-semibold">{c.avgTxKwd.toFixed(2)}</td>
                      <td className="py-3 px-3 text-end font-mono text-amber-600 dark:text-amber-400">{c.stdDev}</td>
                      <td className="py-3 px-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                        {c.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })}
                      </td>
                      <td className="py-3 px-3 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {c.pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
