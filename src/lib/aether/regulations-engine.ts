/**
 * Kuwait F&B & Corporate Regulatory Intelligence & Playbook Engine (`/erp/regulations`).
 * Covers Kuwait Municipality & PAFN (Ardiya Central Kitchen + 7 branches), Public Authority for
 * Manpower & Delivery Permits, MOCI Pricing/Promos & Aggregator Rules, and Mall/EXB/Fire Force Rules.
 */

import type { GlobalBranch } from '@/lib/aether/global-filter-engine'

export type RegulationTrackId =
  | 'municipality-pafn'
  | 'manpower-delivery'
  | 'moci-pricing'
  | 'malls-exb'

export interface RegulationPlaybookItem {
  id: string
  track: RegulationTrackId
  code: string
  titleAr: string
  titleEn: string
  authorityAr: string
  authorityEn: string
  effectiveDate: string
  deadlineDate: string
  costImpactKwd: number
  penaltyAvoidedKwd: number
  severity: 'critical' | 'high' | 'standard'
  summaryAr: string
  summaryEn: string
  mitigationStepsAr: string[]
  mitigationStepsEn: string[]
}

export const REGULATIONS_STORAGE_KEY = 'vf_kuwait_regulations_v1'
export const REG_STOP_ORDERS_STORAGE_KEY = 'vf_reg_stop_orders_v1'

/**
 * Realistic baseline branch compliance checkpoints across the 7 active Venture Foods locations
 * (19 of 28 checkpoints compliant = 68% out of the box), leaving specific pending branches
 * highlighted per upcoming deadline while keeping every branch toggle 100% interactive.
 */
export const DEFAULT_REGULATION_BRANCH_READINESS: Record<
  string,
  Record<Exclude<GlobalBranch, 'all'>, boolean>
> = {
  // REG-KW-01 (Deadline 2026-11-30): 5/7 compliant — Salmiya & Al-Kout pending 21-day health card renewal
  'reg-pafn-ardiya-coldchain': {
    avenues: true,
    '360-mall': true,
    assima: true,
    promenade: true,
    salmiya: false,
    'al-kout': false,
    ardiya: true,
  },
  // REG-KW-02 (Deadline 2026-12-15): 5/7 compliant — Avenues & Assima pending TMP rider permit match
  'reg-pam-delivery-permits': {
    avenues: false,
    '360-mall': true,
    assima: false,
    promenade: true,
    salmiya: true,
    'al-kout': true,
    ardiya: true,
  },
  // REG-KW-03 (Deadline 2026-11-25): 5/7 compliant — Promenade & Ardiya pending MOCI promo notice sync
  'reg-moci-pricing-platforms': {
    avenues: true,
    '360-mall': true,
    assima: true,
    promenade: false,
    salmiya: true,
    'al-kout': true,
    ardiya: false,
  },
  // REG-KW-04 (Deadline 2026-12-05): 4/7 compliant — Promenade, Salmiya & Al-Kout pending hood/EXB permit
  'reg-kff-malls-exb': {
    avenues: true,
    '360-mall': true,
    assima: true,
    promenade: false,
    salmiya: false,
    'al-kout': false,
    ardiya: true,
  },
}

export const REGULATION_TRACK_OPTIONS: readonly {
  id: 'all' | RegulationTrackId
  ar: string
  en: string
}[] = [
  { id: 'all', ar: 'كل التشريعات', en: 'All Regulations' },
  { id: 'municipality-pafn', ar: 'البلدية والغذاء والعارضية', en: 'Municipality & PAFN' },
  { id: 'manpower-delivery', ar: 'القوى العاملة والتوصيل', en: 'Manpower & Delivery' },
  { id: 'moci-pricing', ar: 'التجارة والعروض والمنصات', en: 'MOCI & Platforms' },
  { id: 'malls-exb', ar: 'المجمعات والمعارض EXB', en: 'Malls, Fire & EXB' },
] as const

export const SEEDED_REGULATIONS: RegulationPlaybookItem[] = [
  {
    id: 'reg-pafn-ardiya-coldchain',
    track: 'municipality-pafn',
    code: 'REG-KW-01',
    titleAr: 'اشتراطات هيئة الغذاء والبلدية لسلسلة التبريد والشهادات الصحية بمطبخ العارضية والفروع',
    titleEn: 'PAFN & Municipality Cold-Chain, Allergen Labeling & Health Cards (Ardiya + 7 Branches)',
    authorityAr: 'الهيئة العامة للغذاء والتغذية (PAFN) + بلدية الكويت',
    authorityEn: 'Public Authority for Food & Nutrition (PAFN) + Kuwait Municipality',
    effectiveDate: '2026-11-01',
    deadlineDate: '2026-11-30',
    costImpactKwd: 320,
    penaltyAvoidedKwd: 3500,
    severity: 'critical',
    summaryAr:
      'إلزامية توثيق درجات حرارة سيارات النقل المبرد من مطبخ العارضية المركزي للفروع السبعة، وتجديد كروت الصحة قبل ٢١ يوماً من الانتهاء، وملصق تاريخ التحضير والمسببات.',
    summaryEn:
      'Mandatory digital cold-chain logs on Ardiya dispatch vans to all 7 branches, 21-day advance health card renewals, and prep/allergen batch stickers.',
    mitigationStepsAr: [
      'تسجيل حرارة ثلاجات العارضية وسيارات التوزيع مرتين يومياً (٧ صباحاً و٤ عصراً) قبل خروج الشحنة.',
      'تجديد الكروت الصحية لـ 6 موظفين تنتهي بطاقاتهم خلال الشهر الحالي عبر نظام البلدية الإلكتروني.',
      'تثبيت ملصق تاريخ وساعة التحضير وتنبيه مسببات الحساسية على كافة الصوصات والتتبيلات المرسلة للفروع.',
      'إيقاف استلام أي توريد دواجن أو بحريات في العارضية تتجاوز حرارته +4 درجات مئوية فوراً.',
    ],
    mitigationStepsEn: [
      'Log Ardiya walk-in chillers & dispatch van temperatures twice daily (7 AM & 4 PM).',
      'Renew 6 expiring staff Municipality health cards 21 days ahead of expiry.',
      'Apply batch prep-time & allergen labels across all semi-finished sauces sent to branches.',
      'Reject any protein supplier delivery at Ardiya exceeding +4°C upon arrival.',
    ],
  },
  {
    id: 'reg-pam-delivery-permits',
    track: 'manpower-delivery',
    code: 'REG-KW-02',
    titleAr: 'ضوابط القوى العاملة والمرور لتصاريح سائقي التوصيل (TMP) ومطابقة موقع العمل',
    titleEn: 'Manpower (PAM) & Traffic Rules for Own-Fleet Delivery Riders (TMP) & Branch Assignment',
    authorityAr: 'الهيئة العامة للقوى العاملة + الإدارة العامة للمرور',
    authorityEn: 'Public Authority for Manpower (PAM) + General Traffic Dept',
    effectiveDate: '2026-11-10',
    deadlineDate: '2026-12-15',
    costImpactKwd: 480,
    penaltyAvoidedKwd: 4000,
    severity: 'critical',
    summaryAr:
      'حظر تشغيل أي سائق توصيل بدون تصريح توصيل سارٍ ومطابقة ملف الإقامة والخوذة والسترة العاكسة، لحماية أسطول TMP (عمولة 15% بدلاً من 25%).',
    summaryEn:
      'Strict enforcement of rider permits, sponsor residency match, and safety gear to protect our 15%-fee TMP fleet advantage.',
    mitigationStepsAr: [
      'فحص مطابقة إقامات وتصاريح جميع سائقي التوصيل المسندين لطلبات TMP والروابط المباشرة.',
      'تثبيت جدول مناوبات العمالة في كل فرع بما يطابق إذن العمل المسجل في منصة أسهل للقوى العاملة.',
      'تزويد السائقين بحقائب حفظ حرارة معتمدة وسترات سلامة لمنع سحب المركبة أو إيقاف الرخصة.',
      'منع الاستعانة بأي سائق خارجي غير مكفول أو غير مصرح رسمياً تحت أي ظرف في ساعات الذروة.',
    ],
    mitigationStepsEn: [
      'Verify PAM work permits & traffic delivery clearances for every active TMP rider.',
      'Sync branch staff rosters with registered As’hal work-site files across all 7 locations.',
      'Equip all riders with certified thermal boxes & reflective vests.',
      'Strictly prohibit unpermitted casual drivers during weekend peak hours.',
    ],
  },
  {
    id: 'reg-moci-pricing-platforms',
    track: 'moci-pricing',
    code: 'REG-KW-03',
    titleAr: 'قرارات وزارة التجارة بشأن تثبيت الأسعار وترخيص العروض الترويجية ومنصات التوصيل',
    titleEn: 'MOCI Menu Price Transparency, Promotional Permit Rules & Delivery Platform Fairness',
    authorityAr: 'وزارة التجارة والصناعة (MOCI) — حماية المستهلك',
    authorityEn: 'Ministry of Commerce & Industry (MOCI) — Consumer Protection',
    effectiveDate: '2026-11-05',
    deadlineDate: '2026-11-25',
    costImpactKwd: 95,
    penaltyAvoidedKwd: 2500,
    severity: 'high',
    summaryAr:
      'وجوب تطابق السعر المعلن مع فاتورة الكاشير في أودو 17، وبيان بلد المنشأ للحوم، وإخطار التجارة قبل إطلاق عروض الخصم، ورفض شروط الحصرية السعرية المخالفة.',
    summaryEn:
      'Ensure 100% match between displayed menu prices and Odoo 17 POS receipts, meat origin disclosure, and MOCI promo notifications.',
    mitigationStepsAr: [
      'مطابقة أسعار الكاشير في أودو 17 مع منيو الصالة والباركود ومنصات طلبات وكيتا ودليفرو بنسبة 100%.',
      'إبراز لوحة بلد المنشأ للحوم والدواجن بوضوح عند كاشير الفروع السبعة.',
      'استخراج إخطار عرض ترويجي إلكتروني من بوابة التجارة قبل أي حملة خصم تتجاوز الأسعار الأساسية.',
      'توثيق أي خصم غير معتمد تفرضه المنصات ورفعه لإدارة الحساب لاسترداد الفرق فوراً.',
    ],
    mitigationStepsEn: [
      'Audit 100% price parity between Odoo 17 POS registers, dine-in QR menus, and delivery apps.',
      'Display clear meat & poultry country-of-origin plaques at all 7 branch counters.',
      'File electronic MOCI promotional notice prior to launching discounted campaigns.',
      'Log and dispute any unauthorized aggregator-forced promo deductions.',
    ],
  },
  {
    id: 'reg-kff-malls-exb',
    track: 'malls-exb',
    code: 'REG-KW-04',
    titleAr: 'اشتراطات قوة الإطفاء العام وعقود المجمعات وتراخيص البوثات والمعارض الموسمية (EXB)',
    titleEn: 'Kuwait Fire Force (KFF), Mall Lease Clauses & Seasonal Exhibition Booth (EXB) Permits',
    authorityAr: 'قوة الإطفاء العام + إدارات المجمعات والجهات المنظمة للمعارض',
    authorityEn: 'Kuwait Fire Force (KFF) + Mall Management & EXB Organizers',
    effectiveDate: '2026-11-12',
    deadlineDate: '2026-12-05',
    costImpactKwd: 260,
    penaltyAvoidedKwd: 3000,
    severity: 'standard',
    summaryAr:
      'تنظيف فلاتر ومداخن المطابخ دورياً وتوثيق شهادة الإطفاء في البروميناد والسالمية والفروع، واستكمال تراخيص البلدية والإطفاء المؤقتة قبل دفع عربون أي معرض EXB.',
    summaryEn:
      'Certified hood/ansul maintenance across Promenade, Salmiya & all branches, plus mandatory temporary KFF/Municipality clearance before signing EXB booth contracts.',
    mitigationStepsAr: [
      'اعتماد شهادة صيانة نظام Ansul وتنظيف الشفاطات الشهرية في مطبخ العارضية والبروميناد والسالمية.',
      'ربط توقيع أي عقد معرض موسمي (EXB) بشرطين: إيجار ≤ 15% من المبيعات المتوقعة + ترخيص بلدية وإطفاء سارٍ.',
      'التقيد التام بساعات التحميل والتنزيل الليلية في المجمعات لتفادي غرامات الإدارة.',
      'توفير طفايات حريق صالحة وحقيبة إسعافات أولية معتمدة داخل كل بوث معرض موسمي.',
    ],
    mitigationStepsEn: [
      'Maintain monthly certified Ansul & hood-cleaning logs across Ardiya, Promenade & Salmiya.',
      'Gate every EXB booth contract on <=15% rent-to-sales cap + valid temporary KFF/Municipality permit.',
      'Enforce mall loading-bay delivery windows to eliminate lease penalty notices.',
      'Stage inspected fire extinguishers & first-aid kits inside every seasonal EXB booth.',
    ],
  },
]

export function sanitizeRegulations(raw: unknown): RegulationPlaybookItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return SEEDED_REGULATIONS
  const validTracks = new Set<string>([
    'municipality-pafn',
    'manpower-delivery',
    'moci-pricing',
    'malls-exb',
  ])
  const out: RegulationPlaybookItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Partial<RegulationPlaybookItem>
    if (!r.id || !r.titleAr) continue
    const track: RegulationTrackId =
      r.track && validTracks.has(r.track) ? r.track : 'municipality-pafn'
    out.push({
      id: String(r.id),
      track,
      code: typeof r.code === 'string' && r.code ? r.code : `REG-KW-0${out.length + 1}`,
      titleAr: String(r.titleAr),
      titleEn: typeof r.titleEn === 'string' && r.titleEn ? r.titleEn : String(r.titleAr),
      authorityAr:
        typeof r.authorityAr === 'string' && r.authorityAr ? r.authorityAr : 'الجهات الرقابية — الكويت',
      authorityEn:
        typeof r.authorityEn === 'string' && r.authorityEn ? r.authorityEn : 'Kuwait Regulatory Authority',
      effectiveDate:
        typeof r.effectiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.effectiveDate)
          ? r.effectiveDate
          : '2026-11-15',
      deadlineDate:
        typeof r.deadlineDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.deadlineDate)
          ? r.deadlineDate
          : '2026-12-15',
      costImpactKwd: Math.max(0, Number(r.costImpactKwd) || 0),
      penaltyAvoidedKwd: Math.max(0, Number(r.penaltyAvoidedKwd) || 1000),
      severity:
        r.severity === 'critical' || r.severity === 'high' || r.severity === 'standard'
          ? r.severity
          : 'high',
      summaryAr: typeof r.summaryAr === 'string' ? r.summaryAr : String(r.titleAr),
      summaryEn: typeof r.summaryEn === 'string' ? r.summaryEn : String(r.titleAr),
      mitigationStepsAr:
        Array.isArray(r.mitigationStepsAr) && r.mitigationStepsAr.length > 0
          ? r.mitigationStepsAr.map(String)
          : ['تعميم خطة الامتثال على الفروع السبعة ومطبخ العارضية وتوثيق التنفيذ.'],
      mitigationStepsEn:
        Array.isArray(r.mitigationStepsEn) && r.mitigationStepsEn.length > 0
          ? r.mitigationStepsEn.map(String)
          : ['Broadcast compliance checklist across all 7 branches and Ardiya Central Kitchen.'],
    })
  }
  return out.length > 0 ? out : SEEDED_REGULATIONS
}

export function buildRegulationCircularText(
  reg: RegulationPlaybookItem,
  isAr: boolean,
  sealId?: string,
): string {
  const stamp = sealId ?? `VF-REG-${new Date().getFullYear()}`
  if (!isAr) {
    return [
      `📢 *OFFICIAL REGULATORY PLAYBOOK CIRCULAR — VENTURE FOODS CO. W.L.L.*`,
      `🔖 Executive Seal: ${stamp} | Code: ${reg.code}`,
      `🏛️ Authority: ${reg.authorityEn}`,
      `📌 Regulation: ${reg.titleEn}`,
      `⏳ Effective: ${reg.effectiveDate} | Mandatory Deadline: ${reg.deadlineDate}`,
      `💰 Compliance Budget: ${reg.costImpactKwd.toLocaleString('en-US')} KWD (Shields ${reg.penaltyAvoidedKwd.toLocaleString('en-US')} KWD in fines)`,
      `🛠️ Mandatory Action Plan:`,
      ...reg.mitigationStepsEn.map((s, idx) => `${idx + 1}. ${s}`),
      `✅ All 7 Branch Managers & Ardiya Central Kitchen must confirm readiness immediately.`,
    ].join('\n')
  }

  return [
    `📢 *تعميم امتثال رقابي وتشريعي رسمي — شركة فنتشر فودز لإدارة المطاعم ذ.م.م*`,
    `🔖 رقم الختم التنفيذي: ${stamp} | الرمز: ${reg.code}`,
    `🏛️ الجهة الرقابية: ${reg.authorityAr}`,
    `📌 التشريع / القرار: ${reg.titleAr}`,
    `⏳ تاريخ السريان: ${reg.effectiveDate} | المهلة الإلزامية: ${reg.deadlineDate}`,
    `💰 تكلفة الامتثال المعتمدة: ${reg.costImpactKwd.toLocaleString('en-US')} د.ك (تفادي غرامات بقيمة ${reg.penaltyAvoidedKwd.toLocaleString('en-US')} د.ك)`,
    `🛠️ خطة التعامل الإلزامية:`,
    ...reg.mitigationStepsAr.map((s, idx) => `${idx + 1}. ${s}`),
    `✅ يلتزم مديرو الفروع السبعة ومطبخ العارضية المركزي بتأكيد الجاهزية الفورية وعدم السماح بأي مخالفة.`,
  ].join('\n')
}

export function buildRegulationStopDirective(
  reg: RegulationPlaybookItem,
  isAr: boolean,
): string {
  if (!isAr) {
    return `⛔ *IMMEDIATE REGULATORY STOP ORDER (${reg.code}) — VENTURE FOODS*\n• Authority: ${reg.authorityEn}\n• Rule: ${reg.titleEn}\n• Executive Directive: Immediately halt any non-compliant operation, shipment, or unpermitted activity across all 7 branches & Ardiya Central Kitchen until verified compliant.`
  }
  return `⛔ *أمر إيقاف فوري لأي مخالفة رقابية (${reg.code}) — فنتشر فودز*\n• الجهة الرقابية: ${reg.authorityAr}\n• التشريع: ${reg.titleAr}\n• أمر المدير التنفيذي: يُوقف فوراً أي إجراء تشغيلي أو توريد أو عرض يخالف هذا الاشتراط في الفروع السبعة ومطبخ العارضية المركزي لحين استكمال المطابقة الرسمية.`
}
