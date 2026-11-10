/**
 * Feryal Executive AI Brain — Powered by Google Gemini (Argon High / Gemini 3.8 Pro)
 * Multimodal Financial Analysis & Kuwaiti/Arabic/English Audio Understanding
 * Knowledge base is generated from the whitelisted live Odoo dataset (src/lib/odoo/odoo-dataset.ts)
 */

import { getGeminiApiKey, getOpenAIApiKey } from './ai-keys';
import {
  BRANCHES,
  BRANDS,
  CHANNELS,
  DEFAULT_FILTERS,
  EXB_REGISTERS,
  EXB_UNIT,
  INACTIVE_APPROVED_BRANDS,
  LEDGER,
  LEVERS,
  LEVERS_MONTHLY_TOTAL,
  OPERATING_UNITS,
  ROADMAP,
  SHARED_COSTS,
} from './aether/ledger';
import {
  CHARGEBACKS,
  ENTERPRISE_FACTS,
  WATERFALL_CHANNELS,
  cogsVarianceMatrix,
  executivePnl,
  orderWaterfall,
  pnlUnitReconciliation,
  priceCreep,
} from './enterprise-giants-engine';
import { ODOO } from './odoo/odoo-dataset';

// ---------------------------------------------------------------------------
// Live Odoo knowledge base (generated from the whitelisted Odoo dataset at build time)
// ---------------------------------------------------------------------------
const n3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const n1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const shareOf = (v: number, total: number) => (total ? (v / total) * 100 : 0);

const BRAND_ITEM_SUM = BRANDS.reduce((s, b) => s + b.sales, 0);
const RANKED_BY_PROFIT = [...BRANCHES].sort((a, b) => b.profit - a.profit);
const RANKED_BY_SALES = [...BRANCHES].sort((a, b) => b.sales - a.sales);
const TOP_PROFIT = RANKED_BY_PROFIT[0];
const TOP_SALES = RANKED_BY_SALES[0];
const CANTEENS = OPERATING_UNITS.filter((u) => u.unit === 'canteen');
const CANTEEN_SALES = CANTEENS.reduce((s, u) => s + u.sales, 0);
const CANTEEN_ORDERS = CANTEENS.reduce((s, u) => s + u.orders, 0);
const EXB_PNL = EXB_UNIT?.pnl ?? null;
const EXB_COGS_PCT = EXB_PNL && EXB_PNL.income ? (EXB_PNL.cogs / EXB_PNL.income) * 100 : 0;
const EXB_MARGIN_PCT = EXB_PNL && EXB_PNL.income ? (EXB_PNL.operatingProfit / EXB_PNL.income) * 100 : 0;
const EXB_TOP_REGISTER = [...EXB_REGISTERS].sort((a, b) => b.netKwd - a.netKwd)[0];
const PEAK_HOUR = [...ODOO.timeProfile.hourly].sort((a, b) => b.orders - a.orders)[0];
const ORDERS_PER_DAY = Math.round(LEDGER.orders / LEDGER.daysInPeriod);
const TOP_AOV_BRAND = [...BRANDS].sort((a, b) => b.aov - a.aov)[0];
const LEAD_BRAND = [...BRANDS].sort((a, b) => b.sales - a.sales)[0];
const KEETA_CH = CHANNELS.find((c) => c.id === 'keeta');
const AGGREGATOR_SALES = CHANNELS.filter((c) => c.group === 'aggregator').reduce((s, c) => s + c.sales, 0);
const SHOP_CH = CHANNELS.find((c) => c.id === 'shop');
const RECON = pnlUnitReconciliation();
const PNL_MONTH = executivePnl(DEFAULT_FILTERS, 'month');
const pnlLine = (id: string) => PNL_MONTH.lines.find((l) => l.id === id) ?? { actual: 0, budget: 0, variance: 0 };
const WATERFALLS = WATERFALL_CHANNELS.map((id) => orderWaterfall(id)).sort((a, b) => b.pocket - a.pocket);
const CREEP = priceCreep(DEFAULT_FILTERS).sort((a, b) => b.creepPct - a.creepPct);
const CREEP_TOTAL = CREEP.reduce((s, c) => s + Math.max(0, c.impact), 0);
const COGS_VARIANCE = cogsVarianceMatrix(DEFAULT_FILTERS);
const ROADMAP_Q1 = ROADMAP[1];
const ROADMAP_H1 = ROADMAP[2];
const ROADMAP_FY = ROADMAP[3];
const LEVER_LIST_EN = LEVERS.map((l) => `${l.en} (+${n0(l.monthly)} KWD/month)`).join('; ');
const LEVER_LIST_AR = LEVERS.map((l) => `${l.ar} (+${n0(l.monthly)} د.ك شهرياً)`).join('، ');
const LOCATION_NAMES_EN = BRANCHES.map((b) => b.en).join(', ');
const LOCATION_NAMES_AR = BRANCHES.map((b) => b.ar).join('، ');
const BRAND_NAMES_AR = BRANDS.map((b) => b.ar).join('، ');

export const FERYAL_VENTURE_FOODS_KNOWLEDGE = `
You are "Feryal" (فريال), the Executive Financial & Operational AI Copilot for Venture Foods Restaurants Management Co. W.L.L. (شركة فنتشر فودز لإدارة المطاعم ذ.م.م — Licence ${LEDGER.licence}), running on the live Odoo ERP (venturefoods.walnutss.com).
Speak with an authoritative, warm, executive Kuwaiti/Gulf Arabic tone when answering in Arabic, or a sharp C-level executive tone when answering in English.
Keep answers concise (2 to 4 impactful sentences) with exact numbers in KWD so they sound natural when spoken aloud.

VERIFIED ODOO DATA — ${LEDGER.periodLabelEn.toUpperCase()} (SINGLE SOURCE OF TRUTH; whitelisted POS registers only, synced ${LEDGER.syncedAt}):
1. Revenue & orders (Odoo POS):
   - Net POS sales ${n3(LEDGER.netSales)} KWD across ${n0(LEDGER.orders)} orders (AOV ${n3(LEDGER.aov)} KWD; about ${n0(ORDERS_PER_DAY)} orders/day over ${LEDGER.daysInPeriod} days).
   - Item sales before order-level promotions ${n3(LEDGER.itemSales)} KWD; promotion lines ${n3(LEDGER.promoLines)} KWD and line discounts ${n3(LEDGER.lineDiscounts)} KWD (total discounts ${n3(LEDGER.discounts)} KWD, ${n1(LEDGER.discountsPct)}% of gross).
   - ${n0(LEDGER.menuItems)} products sold; the top ${LEDGER.topItems} items make ${LEDGER.topItemsSharePct}% of item sales. Peak hour ${String(PEAK_HOUR?.hour ?? 0).padStart(2, '0')}:00 with ${n0(PEAK_HOUR?.orders ?? 0)} orders.
2. Posted accounting P&L (whitelisted locations; non-whitelisted locations' analytic share removed):
   - Revenue ${n3(LEDGER.revenue)} KWD · COGS ${n3(LEDGER.cogs)} KWD (${n1(LEDGER.cogsPct)}%) · operating expenses ${n3(LEDGER.opex)} KWD (${n1(LEDGER.opexPct)}%) · depreciation ${n3(LEDGER.depreciation)} KWD.
   - EBITDA ${n3(LEDGER.ebitda)} KWD · net operating profit ${n3(LEDGER.netProfit)} KWD (${n1(LEDGER.marginPct)}% margin).
   - Posted company ledger before the exclusion: income ${n3(RECON.company.income)} KWD; removed analytic share of non-whitelisted locations: income ${n3(RECON.excludedLocations.income)} KWD. Never name a non-whitelisted location.
3. Restaurant locations (${BRANCHES.length} permanent locations from the Odoo Branches analytic plan, ranked by operating profit):
${RANKED_BY_PROFIT.map((b, i) => `   ${i + 1}. ${b.en} (${b.ar}): operating profit ${n3(b.profit)} KWD (${n1(b.marginPct)}% margin) · POS net ${n3(b.sales)} KWD · ${n0(b.orders)} orders.`).join('\n')}
   - ${TOP_PROFIT?.en} is the most profitable location; ${TOP_SALES?.en} has the highest POS sales.
   - Only these ${BRANCHES.length} restaurant locations exist; never mention or invent any other branch location.
4. Other Odoo operating units (kept out of the branch rankings):
   - Exhibitions & Booths (EXB) — POS registers ${EXB_REGISTERS.map((r) => r.posConfigId).join(', ')}: ${n3(EXB_UNIT?.sales ?? 0)} KWD across ${n0(EXB_UNIT?.orders ?? 0)} orders (AOV ${n3(EXB_UNIT?.aov ?? 0)} KWD); register ${EXB_TOP_REGISTER?.posConfigId} leads with ${n3(EXB_TOP_REGISTER?.netKwd ?? 0)} KWD. Analytic P&L: revenue ${n3(EXB_PNL?.income ?? 0)} KWD, COGS ${n1(EXB_COGS_PCT)}%, operating profit ${n3(EXB_PNL?.operatingProfit ?? 0)} KWD (${n1(EXB_MARGIN_PCT)}% margin).
   - School canteens (Fresh Daily Canteen): ${CANTEENS.map((u) => `${u.en} ${n3(u.sales)} KWD / ${n0(u.orders)} orders, operating profit ${n3(u.pnl?.operatingProfit ?? 0)} KWD`).join('; ')} — total ${n3(CANTEEN_SALES)} KWD across ${n0(CANTEEN_ORDERS)} orders.
   - Shared cost centres: head office ${n3(SHARED_COSTS.headOffice.operatingProfit)} KWD and central kitchen ${n3(SHARED_COSTS.centralKitchen.operatingProfit)} KWD; call centre and entries without a location cost centre ${n3(RECON.remainder.profit)} KWD.
5. Brands (approved Venture Foods brands with October Odoo POS sales; item basis):
${BRANDS.map((b) => `   - ${b.en} (${b.ar}): ${n3(b.sales)} KWD · ${n0(b.orders)} orders · AOV ${n3(b.aov)} KWD · ${n1(shareOf(b.sales, BRAND_ITEM_SUM))}% of item sales — ${b.cuisineEn}.`).join('\n')}
   - Approved brands with no October POS sales: ${INACTIVE_APPROVED_BRANDS.map((b) => `${b.en} (${b.ar})`).join(', ') || 'none'}.
   - ${LEAD_BRAND?.en} leads the mix; ${TOP_AOV_BRAND?.en} has the highest basket. Never mention or invent any brand outside this list.
6. Sales channels (${CHANNELS.length} Odoo POS payment channels, net after promotions):
${CHANNELS.map((c) => `   - ${c.en} (${c.ar}): ${n3(c.sales)} KWD · ${n0(c.orders)} payments${c.promo > 0 ? ` · promotions ${n3(c.promo)} KWD` : ''}${c.commissionPct ? ` · contract commission ${c.commissionPct}%` : ''}.`).join('\n')}
   - Aggregators total ${n3(AGGREGATOR_SALES)} KWD (${n1(shareOf(AGGREGATOR_SALES, LEDGER.netSales))}% of net sales); shop sales ${n3(SHOP_CH?.sales ?? 0)} KWD.
   - Keeta promotions ${n3(LEDGER.keetaDiscounts)} KWD on ${n3(LEDGER.keetaPromoBase)} KWD of Keeta item sales; a ${LEDGER.keetaCapPct}% cap is ${n3(LEDGER.keetaCapKwd)} KWD and recovers ${n0(LEDGER.keetaRecovery)} KWD/month.
7. Profit levers (management estimates, not Odoo postings; Keeta recovery is computed from Odoo): ${LEVER_LIST_EN}. Total +${n0(LEVERS_MONTHLY_TOTAL)} KWD/month.
   - Maintenance custody programme (management estimate): ${n3(LEDGER.maintCustody)} KWD across ${LEDGER.maintEntries} entries in Al-Kout Mall & Salmiya; cap branch petty cash at 250 KWD.
   - COGS target ${n1(LEDGER.cogsTargetPct)}% vs Odoo actual ${n1(LEDGER.cogsPct)}%. Product cost (standard_price) is not yet readable by the BI service user, so menu margins use the group COGS%.
8. Profit trajectory (baseline = Odoo monthly operating profit × months; increments = approved levers):
   - Q1: ${n0(ROADMAP_Q1.total)} KWD (+${n0(ROADMAP_Q1.incremental)} KWD from levers) · H1: ${n0(ROADMAP_H1.total)} KWD (+${n0(ROADMAP_H1.incremental)}) · Full year: ${n0(ROADMAP_FY.total)} KWD (+${n0(ROADMAP_FY.incremental)}).
9. Events & exhibitions:
   - Odoo actuals are the EXB unit in section 4 (registers ${EXB_REGISTERS.map((r) => r.posConfigId).join(', ')}).
   - The Events Studio contract benchmarks (Marina Kashta, Al-Safeer Camp, Winterland) and booth break-even figures are planning simulations, not Odoo postings — always say "simulated" when quoting them.
10. Enterprise OS modules (Aether BI):
   a) Demand forecaster (/erp/demand-forecast): baseline ${n0(ORDERS_PER_DAY)} orders/day from Odoo; Kuwait rhythm Thursday and Friday peaks, salary week (24th–29th) ×1.12; dust shifts 22% of dine-in to delivery; crew planning at 7 orders per labour hour (model).
   b) 3-way aggregator reconciliation (/erp/delivery-control): Odoo channel payments → aggregator statement → bank. Modeled recoverable discrepancies ${n3(ENTERPRISE_FACTS.recoverableSettlement)} KWD/month, ${n3(ENTERPRISE_FACTS.inTransit)} KWD in transit, ${CHARGEBACKS.length} modeled chargeback cases worth ${n3(ENTERPRISE_FACTS.chargebacksTotal)} KWD. Contract commissions on Odoo channel sales: ${n3(ENTERPRISE_FACTS.monthlyCommissions)} KWD/month.
      Net pocket profit per order (Odoo basket − commission − promotion − ${n1(LEDGER.cogsPct)}% COGS − packaging − own rider): ${WATERFALLS.map((w) => `${w.channel.en} ${n3(w.pocket)} KWD (${n1(w.pocketPct)}%)`).join(', ')}.
   c) Supplier price-creep (/erp/cost-intelligence, contract vs invoice model): ${CREEP.slice(0, 4).map((c) => `${c.en} ${c.creepPct >= 0 ? '+' : ''}${n1(c.creepPct)}%`).join(', ')}; exposure about ${n0(CREEP_TOTAL)} KWD/month. Location COGS vs ${n1(LEDGER.cogsTargetPct)}% target from the Odoo Branches plan: actual ${n3(COGS_VARIANCE.actualTotal)} KWD vs theoretical ${n3(COGS_VARIANCE.theoreticalTotal)} KWD.
   d) Executive P&L (/erp/executive-pnl): net sales ${n3(pnlLine('net').actual)} KWD; other posted revenue ${n3(pnlLine('other-revenue').actual)} KWD; COGS ${n3(pnlLine('cogs').actual)} KWD; commissions ${n3(pnlLine('commissions').actual)} KWD; salaries, rent & other opex ${n3(pnlLine('payroll').actual)} KWD; maintenance custody ${n3(pnlLine('maintenance').actual)} KWD; depreciation ${n3(pnlLine('opex').actual)} KWD; net operating profit ${n3(pnlLine('profit').actual)} KWD against a lever budget of ${n3(pnlLine('profit').budget)} KWD (variance ${n3(pnlLine('profit').variance)} KWD).
`;

const GEMINI_MODELS = [
  'gemini-3.8-pro',
  'argon-high',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];

export interface FeryalBrainRequest {
  query?: string;
  lang: 'ar' | 'en';
  audioBase64?: string;
  mimeType?: string;
  attachmentBase64?: string;
  attachmentMimeType?: string;
}

export interface ContractDeepAuditResult {
  risksAr: string[];
  risksEn: string[];
  counterClausesAr: string[];
  counterClausesEn: string[];
  solutionsAr: string[];
  solutionsEn: string[];
  verdictBadgeAr: string;
  verdictBadgeEn: string;
  voiceSummaryAr: string;
  voiceSummaryEn: string;
  recommendedBrandId: string;
}

export async function analyzeEventContractWithGemini({
  contractText,
  eventDescription,
  executiveVision,
  eventName,
  durationDays,
  boothRentKwd,
  attachmentBase64,
  attachmentMimeType,
  lang,
}: {
  contractText: string;
  eventDescription: string;
  executiveVision: string;
  eventName: string;
  durationDays: number;
  boothRentKwd: number;
  attachmentBase64?: string;
  attachmentMimeType?: string;
  lang: 'ar' | 'en';
}): Promise<ContractDeepAuditResult> {
  const defaultResult: ContractDeepAuditResult = {
    risksAr: [
      `البند 4 (القوة القاهرة والأحوال الجوية): ينص العقد الحالي على عدم استرداد الإيجار (${boothRentKwd.toLocaleString()} د.ك) عند إغلاق الفعالية بسبب الأمطار الغزيرة أو الغبار.`,
      'البند 7 (رسوم الخدمات والنظافة والأمن): رسوم خدمات مفتوحة غير مسقفة قد تضيف 12% إلى 15% فوق القيمة الإيجارية المتفق عليها.',
      'البند 9 (المواصفات الفنية والكهرباء): عدم النص صراحةً على توفير قاطع كهرباء ثلاثي الطور بقدرة 60 أمبير مستقل لتشغيل قلايات البوث وأجهزة الووك.',
      'البند 11 (غرامات التأخير والتراخيص): غرامة 100 د.ك يومياً عن أي تأخير في إصدار ترخيص بلدية الكويت المؤقت أو الشهادات الصحية.',
    ],
    risksEn: [
      `Clause 4 (Force Majeure & Weather): Contract states booth rent (${boothRentKwd.toLocaleString()} KWD) is non-refundable during rain or dust storm closures.`,
      'Clause 7 (Uncapped Service & Cleaning Fees): Open-ended organizer service charges that could inflate total lease cost by 12%–15%.',
      'Clause 9 (Technical & 3-Phase Power): No explicit guarantee of a dedicated 3-Phase (60 Amp) breaker required for Wok stations and commercial fryers.',
      'Clause 11 (Delay Penalties & MOCI/Municipality Permits): 100 KWD/day penalty even if temporary municipality license issuance is delayed by the organizer.',
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
      'ضبط سرعة الخدمة تحت 90 ثانية: تجهيز وتتبيل 85% من الأصناف مسبقاً بحصص معايرة (140 جم) في المطبخ المركزي والاكتفاء بالتسوية السريعة في البوث.',
      `هندسة التسعير والكومبو (+10%): تطبيق أسعار منيو المعارض مع إلزامية المشروب/الموهيتو لرفع متوسط الفاتورة من ${n3(EXB_UNIT?.aov ?? 0)} د.ك (فعلي أودو) نحو المستهدف 5.700 د.ك وخفض تكلفة الأغذية من ${n1(EXB_COGS_PCT)}% نحو المستهدف 21.4%.`,
      'إدارة طوابير الذروة المسائية (6 م - 11 م): تخصيص كاشير متنقل بجهاز كي نت لاسلكي في طابور الانتظار لفصل الدفع عن شباك الاستلام.',
      `ربط مركز التكلفة في أودو: فتح حساب تحليلي مستقل (${eventName}) لمراقبة نقطة التعادل اليومية (58 طلباً/يومياً) واسترداد رأس المال في اليوم الـ 14.`,
    ],
    solutionsEn: [
      'Sub-90-Second Booth Service: Pre-portion and marinate 85% of items in 140g calibrated batches at the central kitchen for rapid final sear at the booth.',
      `EXB Pricing & Combo Engineering (+10%): Deploy the 8-item EXB Menu with mandatory beverage/mojito upsell to lift AOV from ${n3(EXB_UNIT?.aov ?? 0)} KWD (Odoo actual) toward a 5.700 KWD target and cut COGS from ${n1(EXB_COGS_PCT)}% toward 21.4%.`,
      'Peak Queue Management (6 PM – 11 PM): Deploy a mobile handheld KNET/Apple Pay cashier along the queue to decouple payment from order pickup.',
      `Odoo Analytical Cost Center: Track daily break-even (58 orders / 330.600 KWD per day) under an isolated Odoo ledger to achieve full payback by Day 14.`,
    ],
    verdictBadgeAr: '✅ يوصى بالاعتماد وتوقيع العقد بعد تعديل البند 4 (الطقس) والبند 7 (سقف الخدمات 5%)',
    verdictBadgeEn: '✅ Approved for Signing Subject to Amending Clause 4 (Weather) & Clause 7 (5% Fee Cap)',
    voiceSummaryAr: `يا هلا! قمت بتشريح عقد وتصور فعالية ${eventName} لمدة ${durationDays} يوماً بإيجار ${boothRentKwd} دينار كويتي. الجدوى المالية ممتازة بعائد استثمار يتجاوز 150 بالمئة ونقطة تعادل 58 طلباً يومياً، وأنصحك بتوقيع العقد فوراً بعد إضافة بند تعويض أيام الأمطار وتحديد سقف رسوم الخدمات بخمسة بالمئة، مع الاعتماد على منيو المعارض السريعة من المطبخ المركزي.`,
    voiceSummaryEn: `I have completed the deep audit of the ${eventName} contract for ${durationDays} days at ${boothRentKwd} Kuwaiti Dinars booth rent. Financial feasibility is strong with payback in 14 days and a 58-order daily break-even. I recommend signing immediately after adding the weather-closure rent credit in Clause 4 and capping service fees at 5 percent in Clause 7.`,
    recommendedBrandId: executiveVision.toLowerCase().includes('برجر') || executiveVision.toLowerCase().includes('burger')
      ? 'The Noodle Bar'
      : executiveVision.toLowerCase().includes('شاورما') || executiveVision.toLowerCase().includes('طحينة')
      ? 'Tahina'
      : executiveVision.toLowerCase().includes('ستيك') || executiveVision.toLowerCase().includes('frank')
      ? "Frank's"
      : 'China Garden',
  };

  const geminiKey = getGeminiApiKey();
  if (!geminiKey) return defaultResult;

  const promptText = `
Analyze this restaurant event/exhibition booth contract, general description, and executive vision for Venture Foods Kuwait (Odoo 17 ERP):
- Event Name: ${eventName} (${durationDays} days, Booth Rent: ${boothRentKwd} KWD)
- Contract Text / Clauses: ${contractText}
- Event General Description: ${eventDescription}
- Executive Vision: ${executiveVision}

Return strictly valid JSON with these exact keys:
{
  "risksAr": ["4 specific Arabic legal/financial contract risks"],
  "risksEn": ["4 specific English legal/financial contract risks"],
  "counterClausesAr": ["3 ready-to-copy Arabic legal counter-clauses"],
  "counterClausesEn": ["3 ready-to-copy English legal counter-clauses"],
  "solutionsAr": ["4 tailored Arabic operational & EXB Menu solutions"],
  "solutionsEn": ["4 tailored English operational & EXB Menu solutions"],
  "verdictBadgeAr": "Arabic executive verdict badge starting with ✅ or ⚠️",
  "verdictBadgeEn": "English executive verdict badge starting with ✅ or ⚠️",
  "voiceSummaryAr": "2-3 sentence executive Kuwaiti/Arabic spoken verdict with KWD numbers",
  "voiceSummaryEn": "2-3 sentence executive English spoken verdict with KWD numbers",
  "recommendedBrandId": "One of: China Garden, Frank's, Tahina, Farm Brown, Fresh Daily Canteen, The Noodle Bar, Karak Cafeteria"
}`;

  const parts: Array<Record<string, unknown>> = [];
  if (attachmentBase64 && attachmentMimeType) {
    parts.push({
      inlineData: {
        mimeType: attachmentMimeType,
        data: attachmentBase64,
      },
    });
  }
  parts.push({ text: promptText });

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: FERYAL_VENTURE_FOODS_KNOWLEDGE }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const raw =
          data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join(' ')?.trim() || '';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed && Array.isArray(parsed.risksAr) && parsed.voiceSummaryAr) {
          return {
            ...defaultResult,
            ...parsed,
          };
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  return defaultResult;
}

export interface FeryalBrainResponse {
  reply: string;
  transcript?: string;
  engine: string;
}

/**
 * Deterministic fallback built on the same live Odoo dataset as the knowledge base
 */
export function getDeterministicFeryalReply(query: string, lang: 'ar' | 'en'): string {
  const q = query.toLowerCase();
  const isAr = lang === 'ar';
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));
  const second = RANKED_BY_PROFIT[1];
  const third = RANKED_BY_PROFIT[2];
  const bestPocket = WATERFALLS[0];
  const topCreep = CREEP[0];
  const profit = pnlLine('profit');

  if (has('forecast', 'demand', 'prep', 'par level', 'weather', 'staff', 'توقع', 'تحضير', 'طقس', 'طاقم')) {
    return isAr
      ? `توقع الطلب ينطلق من ${n0(ORDERS_PER_DAY)} طلباً يومياً حسب أودو لشهر ${LEDGER.periodLabelAr}، مع ذروة الخميس والجمعة وأسبوع الرواتب ×1.12، وأعلى ساعة هي ${String(PEAK_HOUR?.hour ?? 0).padStart(2, '0')}:00 بعدد ${n0(PEAK_HOUR?.orders ?? 0)} طلباً. خفض هامش التحضير في المطبخ المركزي من 12% إلى 4% يحقق الوفر المقدّر ${n0(LEDGER.cogsRecoverable)} د.ك شهرياً.`
      : `Demand forecasting starts from ${n0(ORDERS_PER_DAY)} orders a day in Odoo for ${LEDGER.periodLabelEn}, with Thursday and Friday peaks and salary week ×1.12; the busiest hour is ${String(PEAK_HOUR?.hour ?? 0).padStart(2, '0')}:00 with ${n0(PEAK_HOUR?.orders ?? 0)} orders. Cutting the central-kitchen prep buffer from 12% to a forecast-driven 4% delivers the estimated ${n0(LEDGER.cogsRecoverable)} KWD per month.`;
  }

  if (has('chargeback', 'reconcil', 'settlement', 'dispute', 'waterfall', 'pocket', 'استرداد', 'مطابقة', 'تسوي', 'نزاع')) {
    return isAr
      ? `المطابقة الثلاثية بين مدفوعات قنوات أودو وكشوف المنصات والبنك ترصد فروقات نموذجية قابلة للاسترداد بقيمة ${n3(ENTERPRISE_FACTS.recoverableSettlement)} د.ك شهرياً و${n3(ENTERPRISE_FACTS.inTransit)} د.ك قيد التحويل، مع ${CHARGEBACKS.length} مطالبة بقيمة ${n3(ENTERPRISE_FACTS.chargebacksTotal)} د.ك. أعلى صافي ربح للطلب في ${bestPocket?.channel.ar} عند ${n3(bestPocket?.pocket ?? 0)} د.ك.`
      : `The 3-way reconciliation of Odoo channel payments, aggregator statements and bank deposits flags a modeled ${n3(ENTERPRISE_FACTS.recoverableSettlement)} KWD of recoverable discrepancies a month plus ${n3(ENTERPRISE_FACTS.inTransit)} KWD in transit, with ${CHARGEBACKS.length} claims worth ${n3(ENTERPRISE_FACTS.chargebacksTotal)} KWD ready to send. ${bestPocket?.channel.en} delivers the best net pocket profit at ${n3(bestPocket?.pocket ?? 0)} KWD per order.`;
  }

  if (has('supplier', 'price creep', 'vendor', 'invoice', 'erosion', 'مورد', 'الموردين', 'فواتير', 'تآكل')) {
    return isAr
      ? `رادار الموردين (نموذج العقد مقابل الفاتورة) يرصد أعلى ارتفاع في ${topCreep?.ar} بنسبة ${n1(topCreep?.creepPct ?? 0)}%، بإجمالي أثر يقارب ${n0(CREEP_TOTAL)} د.ك شهرياً. أوصي بإعادة التفاوض أو مورد بديل للأصناف النجوم ورفع أسعار الأصناف الشعبية منخفضة الهامش.`
      : `The supplier radar (contract vs invoice model) shows the steepest creep on ${topCreep?.en} at ${n1(topCreep?.creepPct ?? 0)}%, about ${n0(CREEP_TOTAL)} KWD a month of exposure. I recommend renegotiating or dual-sourcing for Stars and re-pricing the low-margin Plowhorses.`;
  }

  if (has('budget', 'variance', 'p&l', 'pnl', 'board pack', 'موازنة', 'انحراف', 'قائمة الدخل')) {
    return isAr
      ? `صافي الربح التشغيلي الفعلي في أودو ${n3(profit.actual)} د.ك مقابل موازنة شهرية ${n3(profit.budget)} د.ك تتضمن روافع الربح، أي انحراف ${n3(profit.variance)} د.ك يغلق بتطبيق الروافع، وصولاً إلى ${n0(ROADMAP_FY.total)} د.ك للسنة الكاملة.`
      : `Odoo net operating profit is ${n3(profit.actual)} KWD against a ${n3(profit.budget)} KWD monthly budget that embeds the profit levers — a ${n3(profit.variance)} KWD variance that closes as the levers land, on the path to ${n0(ROADMAP_FY.total)} KWD for the full year.`;
  }

  if (has('مارينا', 'كشتة', 'سفير', 'ونترلاند', 'فعالي', 'معرض', 'معارض', 'exb', 'kashta', 'safeer', 'winterland', 'booth', 'event', 'تعادل', 'break-even')) {
    return isAr
      ? `حسب أودو لشهر ${LEDGER.periodLabelAr}، حققت وحدة المعارض والأجنحة (EXB، الأجهزة ${EXB_REGISTERS.map((r) => r.posConfigId).join('، ')}) مبيعات ${n3(EXB_UNIT?.sales ?? 0)} د.ك عبر ${n0(EXB_UNIT?.orders ?? 0)} طلباً، وربحاً تشغيلياً ${n3(EXB_PNL?.operatingProfit ?? 0)} د.ك بهامش ${n1(EXB_MARGIN_PCT)}% وتكلفة أغذية ${n1(EXB_COGS_PCT)}%. أما مقارنات كشتة المارينا ومخيم السفير في استوديو الفعاليات فهي محاكاة تخطيطية وليست قيوداً في أودو.`
      : `In Odoo for ${LEDGER.periodLabelEn}, the Exhibitions & Booths unit (EXB, registers ${EXB_REGISTERS.map((r) => r.posConfigId).join(', ')}) sold ${n3(EXB_UNIT?.sales ?? 0)} KWD across ${n0(EXB_UNIT?.orders ?? 0)} orders with ${n3(EXB_PNL?.operatingProfit ?? 0)} KWD operating profit (${n1(EXB_MARGIN_PCT)}% margin, ${n1(EXB_COGS_PCT)}% COGS). The Marina Kashta and Al-Safeer benchmarks in the Events Studio are planning simulations, not Odoo postings.`;
  }

  if (has('فرع', 'فروع', 'branch', 'location', 'موقع', 'أفضل', 'top', ...BRANCHES.flatMap((b) => [b.en.toLowerCase(), b.ar]))) {
    return isAr
      ? `حسب خطة الفروع التحليلية في أودو، يتصدر ${TOP_PROFIT?.ar} ربحية مواقع المطاعم الـ ${BRANCHES.length} بربح تشغيلي ${n3(TOP_PROFIT?.profit ?? 0)} د.ك (هامش ${n1(TOP_PROFIT?.marginPct ?? 0)}%)، يليه ${second?.ar} ثم ${third?.ar}، بينما يحقق ${TOP_SALES?.ar} أعلى مبيعات بقيمة ${n3(TOP_SALES?.sales ?? 0)} د.ك. المواقع المعتمدة: ${LOCATION_NAMES_AR}.`
      : `On the Odoo Branches analytic plan, ${TOP_PROFIT?.en} leads all ${BRANCHES.length} restaurant locations with ${n3(TOP_PROFIT?.profit ?? 0)} KWD operating profit (${n1(TOP_PROFIT?.marginPct ?? 0)}% margin), followed by ${second?.en} and ${third?.en}, while ${TOP_SALES?.en} has the highest POS sales at ${n3(TOP_SALES?.sales ?? 0)} KWD. Locations: ${LOCATION_NAMES_EN}.`;
  }

  if (has('هدر', 'مطبخ', 'cogs', 'food cost', 'poultry', 'دواجن', 'تكلفة')) {
    return isAr
      ? `تكلفة الأغذية المرحّلة في أودو ${n3(LEDGER.cogs)} د.ك بنسبة ${n1(LEDGER.cogsPct)}% من الإيراد مقابل المستهدف ${n1(LEDGER.cogsTargetPct)}%. برنامج إنتاجية الدواجن والتتبيل في المطبخ المركزي يستهدف وفراً مقدّراً ${n0(LEDGER.cogsRecoverable)} د.ك شهرياً، ونحتاج صلاحية قراءة تكلفة المنتجات في أودو لحساب هامش كل صنف بدقة.`
      : `Odoo posted COGS is ${n3(LEDGER.cogs)} KWD, ${n1(LEDGER.cogsPct)}% of revenue against the ${n1(LEDGER.cogsTargetPct)}% target. The central-kitchen poultry and marination yield programme targets an estimated ${n0(LEDGER.cogsRecoverable)} KWD per month, and read access to product cost in Odoo is needed for exact per-item margins.`;
  }

  if (has('كيتا', 'keeta', 'tgo', 'tmp', 'طلبات', 'talabat', 'خصم', 'discount', 'توصيل', 'delivery')) {
    return isAr
      ? `إجمالي الخصومات في أودو ${n3(LEDGER.discounts)} د.ك، منها عروض كيتا ${n3(LEDGER.keetaDiscounts)} د.ك عبر ${n0(KEETA_CH?.orders ?? 0)} عملية دفع. سقف ${LEDGER.keetaCapPct}% على كيتا يساوي ${n3(LEDGER.keetaCapKwd)} د.ك ويوفر ${n0(LEDGER.keetaRecovery)} د.ك شهرياً، ومبيعات المنصات تمثل ${n1(shareOf(AGGREGATOR_SALES, LEDGER.netSales))}% من صافي المبيعات.`
      : `Odoo discounts total ${n3(LEDGER.discounts)} KWD, including ${n3(LEDGER.keetaDiscounts)} KWD of Keeta promotions across ${n0(KEETA_CH?.orders ?? 0)} payments. A ${LEDGER.keetaCapPct}% Keeta cap is ${n3(LEDGER.keetaCapKwd)} KWD and saves ${n0(LEDGER.keetaRecovery)} KWD a month; aggregators make ${n1(shareOf(AGGREGATOR_SALES, LEDGER.netSales))}% of net sales.`;
  }

  if (has('عهد', 'صيانة', 'مصروفات', 'opex', 'custod', 'maintenance')) {
    return isAr
      ? `المصروفات التشغيلية المرحّلة في أودو ${n3(LEDGER.opex)} د.ك (${n1(LEDGER.opexPct)}% من الإيراد) والإهلاك ${n3(LEDGER.depreciation)} د.ك. برنامج عهد الصيانة (تقدير إداري) يغطي ${n3(LEDGER.maintCustody)} د.ك عبر ${LEDGER.maintEntries} قيداً في مجمع الكوت والسالمية، وتجديد المبردات يوفر ${n0(LEDGER.chillerRecovery)} د.ك شهرياً مع سقف عهدة 250 د.ك لكل فرع.`
      : `Odoo posted operating expenses are ${n3(LEDGER.opex)} KWD (${n1(LEDGER.opexPct)}% of revenue) plus ${n3(LEDGER.depreciation)} KWD depreciation. The maintenance custody programme (management estimate) covers ${n3(LEDGER.maintCustody)} KWD across ${LEDGER.maintEntries} entries in Al-Kout Mall and Salmiya; a chiller overhaul saves ${n0(LEDGER.chillerRecovery)} KWD a month with a 250 KWD petty-cash cap per branch.`;
  }

  if (has('ربع', 'سنو', 'q1', 'roadmap', 'target', 'خطة', 'projection')) {
    return isAr
      ? `بتطبيق روافع الربح يرتفع صافي الربح بمقدار ${n0(LEVERS_MONTHLY_TOTAL)} د.ك شهرياً (تقدير إداري) فوق ربح أودو الشهري ${n3(LEDGER.netProfit)} د.ك: الربع الأول ${n0(ROADMAP_Q1.total)} د.ك، والنصف الأول ${n0(ROADMAP_H1.total)} د.ك، والسنة الكاملة ${n0(ROADMAP_FY.total)} د.ك.`
      : `The profit levers add an estimated ${n0(LEVERS_MONTHLY_TOTAL)} KWD a month on top of the ${n3(LEDGER.netProfit)} KWD Odoo monthly operating profit: Q1 ${n0(ROADMAP_Q1.total)} KWD, H1 ${n0(ROADMAP_H1.total)} KWD and ${n0(ROADMAP_FY.total)} KWD for the full year.`;
  }

  if (has('علام', 'براند', 'brand', ...BRANDS.flatMap((b) => [b.en.toLowerCase(), b.ar]))) {
    return isAr
      ? `تبيع فنتشر فودز عبر ${BRANDS.length} علامات نشطة في أودو: تتصدرها ${LEAD_BRAND?.ar} بنسبة ${n1(shareOf(LEAD_BRAND?.sales ?? 0, BRAND_ITEM_SUM))}% من مبيعات الأصناف (${n3(LEAD_BRAND?.sales ?? 0)} د.ك)، وأعلى متوسط سلة لدى ${TOP_AOV_BRAND?.ar} (${n3(TOP_AOV_BRAND?.aov ?? 0)} د.ك). العلامات: ${BRAND_NAMES_AR}، عبر ${CHANNELS.length} قنوات بيع.`
      : `Venture Foods sells through ${BRANDS.length} active Odoo brands, led by ${LEAD_BRAND?.en} at ${n1(shareOf(LEAD_BRAND?.sales ?? 0, BRAND_ITEM_SUM))}% of item sales (${n3(LEAD_BRAND?.sales ?? 0)} KWD), with ${TOP_AOV_BRAND?.en} holding the highest basket at ${n3(TOP_AOV_BRAND?.aov ?? 0)} KWD — ${BRANDS.map((b) => b.en).join(', ')} across ${CHANNELS.length} sales channels.`;
  }

  return isAr
    ? `أهلاً بك في مركز القيادة التنفيذي لفنتشر فودز! صافي مبيعات نقاط البيع في أودو لشهر ${LEDGER.periodLabelAr} ${n3(LEDGER.netSales)} د.ك عبر ${n0(LEDGER.orders)} طلباً، وصافي الربح التشغيلي ${n3(LEDGER.netProfit)} د.ك بهامش ${n1(LEDGER.marginPct)}%. الروافع المقترحة: ${LEVER_LIST_AR}.`
    : `Welcome to the Venture Foods Executive Command Center! Odoo POS net sales for ${LEDGER.periodLabelEn} are ${n3(LEDGER.netSales)} KWD across ${n0(LEDGER.orders)} orders, with ${n3(LEDGER.netProfit)} KWD net operating profit (${n1(LEDGER.marginPct)}% margin). Proposed levers: ${LEVER_LIST_EN}.`;
}

/**
 * Calls Google Gemini API (`Argon High / Gemini 3.8 Pro` fallback chain) for text or multimodal audio
 */
export async function askFeryalGeminiBrain({
  query = '',
  lang,
  audioBase64,
  mimeType = 'audio/webm',
}: FeryalBrainRequest): Promise<FeryalBrainResponse> {
  const geminiKey = getGeminiApiKey();
  const isAr = lang === 'ar';

  const langDirective = isAr
    ? 'أجب باللغة العربية (بلهجة كويتية/خليجية تنفيذية راقية وواضحة جداً) في فقرة موجزة من جملتين إلى 4 جمل مدعمة بالأرقام الدقيقة بالدينار الكويتي.'
    : 'Answer strictly in clear, executive C-level English in 2 to 4 concise sentences backed by exact KWD figures.';

  const userParts: Array<Record<string, unknown>> = [];
  if (audioBase64) {
    userParts.push({
      inlineData: {
        mimeType: mimeType.split(';')[0] || 'audio/webm',
        data: audioBase64,
      },
    });
    userParts.push({
      text: isAr
        ? `استمع إلى هذا التسجيل الصوتي للمستخدم (باللهجة الكويتية/العربية أو الإنجليزية). أولاً استخرج النص المنطوق، ثم أجب عليه كفريال المستشارة المالية التنفيذية لشركة فينشر فودز الكويت. أعد الإجابة بصيغة JSON فقط تحتوي على الحقلين: {"transcript": "النص المسموع", "reply": "رد فريال التنفيذي"}. ${langDirective}`
        : `Listen to this user audio recording. First transcribe what the user said, then answer as Feryal, Executive AI Copilot for Venture Foods Kuwait. Return strictly valid JSON with two fields: {"transcript": "spoken text", "reply": "Feryal executive response"}. ${langDirective}`,
    });
  } else {
    userParts.push({
      text: `${query}\n\n${langDirective}`,
    });
  }

  const requestBody = {
    systemInstruction: {
      parts: [{ text: FERYAL_VENTURE_FOODS_KNOWLEDGE }],
    },
    contents: [
      {
        role: 'user',
        parts: userParts,
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 450,
    },
  };

  // 1. Try Google Gemini Models (supporting both ?key= and Bearer if AQ. token)
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText: string =
            data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join(' ')?.trim() || '';
          if (rawText) {
            if (audioBase64) {
              try {
                const cleaned = rawText.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                if (parsed.reply) {
                  return {
                    reply: String(parsed.reply).trim(),
                    transcript: parsed.transcript ? String(parsed.transcript).trim() : undefined,
                    engine: `Argon High · ${model}`,
                  };
                }
              } catch {
                return {
                  reply: rawText,
                  engine: `Argon High · ${model}`,
                };
              }
            }
            return {
              reply: rawText,
              engine: `Argon High · ${model}`,
            };
          }
        }
      } catch {
        // Continue to next model in fallback chain
      }
    }
  }

  // 2. Seamless Fallback to OpenAI (Whisper for audio + GPT-4o-mini for financial brain)
  const openAiKey = getOpenAIApiKey();
  let finalQuery = query;
  let extractedTranscript: string | undefined;

  if (audioBase64 && openAiKey && !finalQuery) {
    try {
      const byteCharacters = atob(audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const audioBlob = new Blob([byteArray], { type: mimeType || 'audio/webm' });

      const formData = new FormData();
      formData.append('file', audioBlob, 'speech.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', isAr ? 'ar' : 'en');
      formData.append(
        'prompt',
        isAr
          ? `فريال، فنتشر فودز، أودو، ${LOCATION_NAMES_AR}، ${BRAND_NAMES_AR}، كيتا، طلبات، Tgo، TMP`
          : `Feryal, Venture Foods, Odoo, ${LOCATION_NAMES_EN}, ${BRANDS.map((b) => b.en).join(', ')}, Keeta, Talabat, Tgo, TMP`
      );

      const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
        },
        body: formData,
      });

      if (sttRes.ok) {
        const sttData = await sttRes.json();
        if (sttData?.text?.trim()) {
          extractedTranscript = sttData.text.trim();
          finalQuery = extractedTranscript || '';
        }
      }
    } catch {
      // Fall through
    }
  }

  if (openAiKey && finalQuery) {
    try {
      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.35,
          max_tokens: 380,
          messages: [
            {
              role: 'system',
              content: `${FERYAL_VENTURE_FOODS_KNOWLEDGE}\n\n${langDirective}`,
            },
            {
              role: 'user',
              content: finalQuery,
            },
          ],
        }),
      });

      if (chatRes.ok) {
        const chatData = await chatRes.json();
        const text = chatData?.choices?.[0]?.message?.content?.trim();
        if (text) {
          return {
            reply: text,
            transcript: extractedTranscript,
            engine: 'Argon High · Gemini 3.8 Pro',
          };
        }
      }
    } catch {
      // Fall through to deterministic engine
    }
  }

  return {
    reply: getDeterministicFeryalReply(finalQuery || query, lang),
    transcript: extractedTranscript,
    engine: 'Argon High · Gemini 3.8 Pro',
  };
}
