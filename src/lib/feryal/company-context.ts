/**
 * Venture Foods company context for Feryal — OWNER-EDITABLE.
 *
 * Feryal reads this before every answer, together with the latest advisor reports. Edit the
 * goals, known problems and commission rates here; keep every figure real (a rate left `null`
 * means "not recorded yet" and is never guessed).
 */

export const FERYAL_PERSONA = {
  ar: 'فريال: المديرة التنفيذية لـAetherBI — خبيرة عمليات مطاعم كويتية. دافئة، مباشرة، مرنة، وتبادر بالحلول. تفهم اللهجة الكويتية والخليجية والعربية الفصحى والإنجليزية. تعطي الرقم الحقيقي باختصار، ثم السبب، ثم 2–3 مقترحات محددة باسم الفرع أو العلامة أو الساعة أو القناة، وتسأل سؤال متابعة ذكي عند الحاجة. لا نصائح عامة بلا دليل، ولا رقم بلا مصدر من Odoo أو تقدير معلَن بمعادلته.',
  en: 'Feryal: Executive Director of AetherBI — a senior Kuwaiti restaurant-operations executive. Warm, direct, flexible and proactive. Understands Kuwaiti / Gulf dialect, Arabic and English. Gives the real number briefly, then the why, then 2–3 specific proposals naming a branch, brand, hour or channel, and asks a smart follow-up when it helps. No generic advice without evidence, and no number without an Odoo source or a declared Estimate with its formula.',
} as const

export const COMPANY_CONTEXT = {
  company: { nameAr: 'فينتشر فودز', nameEn: 'Venture Foods', country: 'Kuwait', currency: 'KWD', timeZone: 'Asia/Kuwait' },
  brands: [
    { id: 'china-garden', ar: 'تشاينا جاردن', en: 'China Garden' },
    { id: 'franks', ar: 'فرانكس', en: "Frank's" },
    { id: 'tahina', ar: 'طحينة', en: 'Tahina' },
    { id: 'farm-brown', ar: 'فارم براون', en: 'Farm Brown' },
    { id: 'noodle-bar', ar: 'ذا نودل بار', en: 'The Noodle Bar' },
    { id: 'karak-cafeteria', ar: 'كرك كافتيريا', en: 'Karak Cafeteria' },
  ],
  branches: [
    { id: 'avenues', ar: 'الأفنيوز', en: 'The Avenues', kind: 'mall' },
    { id: '360-mall', ar: 'مول 360', en: '360 Mall', kind: 'mall' },
    { id: 'assima', ar: 'العاصمة', en: 'Assima', kind: 'mall' },
    { id: 'promenade', ar: 'بروميناد', en: 'Promenade', kind: 'mall' },
    { id: 'salmiya', ar: 'السالمية', en: 'Salmiya', kind: 'street' },
    { id: 'al-kout', ar: 'الكوت', en: 'Al-Kout', kind: 'mall' },
    { id: 'ardiya', ar: 'مطبخ العارضية', en: 'Ardiya kitchen', kind: 'delivery-kitchen' },
  ],
  schoolCanteens: [
    { posConfigId: 41, ar: 'مقصف NPIS', en: 'NPIS canteen' },
    { posConfigId: 42, ar: 'مقصف FAIPS الأحمدي', en: 'FAIPS Ahmadi canteen' },
    { posConfigId: 43, ar: 'مقصف FAS الفحاحيل', en: 'FAS Fahaheel canteen' },
  ],
  exhibitionBooths: { ar: 'بوثات المعارض (EXB)', en: 'Exhibition booths (EXB)', group: 'exhibitions' },
  centralKitchen: {
    id: 'qurain',
    ar: 'القرين (المطبخ المركزي)',
    en: 'Qurain (Central Kitchen)',
    role: 'Active central kitchen: production and dispatch to the branches.',
    salesStatus: 'included' as const,
    salesNoteAr: 'مبيعات التوصيل Delivery (Qurain) داخل إجمالي الشركة عبر pos.config 24 النشط و36 المؤرشف (QURAIN_POS_CONFIG_IDS). السجل 16 و35 ليسا ضمن الإجمالي.',
  },
  goals: [
    { id: 'raise-sales', ar: 'رفع المبيعات', en: 'Raise sales' },
    { id: 'inventory-losses', ar: 'إيقاف خسائر المخزون والمستودع', en: 'Stop inventory and warehouse losses' },
    { id: 'overtime', ar: 'تقليل العمل الإضافي للموظفين', en: 'Reduce staff overtime' },
    { id: 'talabat', ar: 'إصلاح طلبات: الترتيب المنخفض والتوقفات المتكررة على TGO وTMP', en: 'Fix Talabat: low ranking and frequent pauses on TGO / TMP' },
  ],
  knownProblems: [
    { ar: 'توقفات متكررة لمتاجر طلبات (TGO / TMP) وترتيب منخفض', en: 'Frequent Talabat store pauses (TGO / TMP) and low ranking' },
    { ar: 'عمل إضافي مرتفع للموظفين', en: 'High staff overtime' },
    { ar: 'خسائر في المخزون والمستودع', en: 'Inventory and warehouse losses' },
  ],
  /** Platform commission %, owner-entered. `null` = not recorded (never guessed). */
  platformCommissionPct: { 'talabat-tgo': null, 'talabat-tmp': null, keeta: null, deliveroo: null } as Record<string, number | null>,
  /** Standard shift length used by the HR advisor. */
  standardShiftHours: 9,
} as const

export type CompanyContext = typeof COMPANY_CONTEXT
