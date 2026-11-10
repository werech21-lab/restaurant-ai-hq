/**
 * Feryal Executive AI Brain — Powered by Google Gemini (Argon High / Gemini 3.8 Pro)
 * Multimodal Financial Analysis & Kuwaiti/Arabic/English Audio Understanding
 * Knowledge base is generated from the whitelisted live Odoo dataset (src/lib/odoo/odoo-dataset.ts)
 */

import { getGeminiApiKey, getOpenAIApiKey } from './ai-keys';
import { BRANCHES, BRANDS, CHANNELS, EXB_REGISTERS, EXB_UNIT, INACTIVE_APPROVED_BRANDS, LEDGER, OPERATING_UNITS, SHARED_COSTS } from './aether/ledger';
import { ODOO } from './odoo/odoo-dataset';
import { AETHER_FINDINGS, AETHER_TOP_PROPOSALS, type AetherFinding } from './aether-proprietary-brain';

// ---------------------------------------------------------------------------
// Verified Odoo facts (whitelisted POS registers + posted accounting, generated at build time)
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
const EXB_AOV = EXB_UNIT?.aov ?? 0;
const PEAK_HOUR = [...ODOO.timeProfile.hourly].sort((a, b) => b.orders - a.orders)[0];
const ORDERS_PER_DAY = Math.round(LEDGER.orders / LEDGER.daysInPeriod);
const TOP_AOV_BRAND = [...BRANDS].sort((a, b) => b.aov - a.aov)[0];
const LEAD_BRAND = [...BRANDS].sort((a, b) => b.sales - a.sales)[0];
const AGGREGATORS = CHANNELS.filter((c) => c.group === 'aggregator');
const AGG_SALES = AGGREGATORS.reduce((s, c) => s + c.sales, 0);
const AGG_ORDERS = AGGREGATORS.reduce((s, c) => s + c.orders, 0);
const SHOP_CH = CHANNELS.find((c) => c.id === 'shop');
const LOCATION_NAMES_EN = BRANCHES.map((b) => b.en).join(', ');
const LOCATION_NAMES_AR = BRANCHES.map((b) => b.ar).join('، ');
const BRAND_NAMES_AR = BRANDS.map((b) => b.ar).join('، ');
const KEETA_PROMO_PCT = shareOf(LEDGER.keetaDiscounts, LEDGER.keetaPromoBase);
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

// Menu (Odoo POS lines, approved brands only)
const MENU = [...ODOO.menu].filter((m) => m.netKwd > 0 && m.qty > 0 && BRANDS.some((b) => b.id === m.brand)).sort((a, b) => b.netKwd - a.netKwd);
const MENU_TOTAL = MENU.reduce((s, m) => s + m.netKwd, 0);
const TOP80 = (() => {
  let acc = 0;
  let n = 0;
  for (const m of MENU) {
    if (acc >= MENU_TOTAL * 0.8) break;
    acc += m.netKwd;
    n++;
  }
  return { n, sales: acc };
})();
const SLOW_ITEMS = MENU.filter((m) => m.qty < 10);
const SLOW_SALES = SLOW_ITEMS.reduce((s, m) => s + m.netKwd, 0);
const TOP_BY_UNITS = [...MENU].sort((a, b) => b.qty - a.qty).slice(0, 4);
const TOP_BY_UNITS_SALES = TOP_BY_UNITS.reduce((s, m) => s + m.netKwd, 0);
const REPRICE_PCT = 5;
const REPRICE_GAIN = TOP_BY_UNITS_SALES * (REPRICE_PCT / 100);
const brandName = (id: string, ar: boolean) => {
  const b = BRANDS.find((x) => x.id === id);
  return b ? (ar ? b.ar : b.en) : id;
};

// Beverage attach on delivery (Odoo drink price × Odoo delivery payments)
const DRINK_LINES = MENU.filter((m) => /drink|beverage/i.test(m.category));
const DRINK_QTY = DRINK_LINES.reduce((s, m) => s + m.qty, 0);
const DRINK_PRICE = DRINK_QTY ? DRINK_LINES.reduce((s, m) => s + m.netKwd, 0) / DRINK_QTY : 0;
const ATTACH_STEP = 0.1;
const DRINK_REVENUE = AGG_ORDERS * ATTACH_STEP * DRINK_PRICE;
const DRINK_GAIN = DRINK_REVENUE * (1 - LEDGER.cogsPct / 100);

// Food cost by location (Odoo Branches analytic plan)
const REST_REVENUE = BRANCHES.reduce((s, b) => s + b.revenue, 0);
const REST_COGS = BRANCHES.reduce((s, b) => s + b.cogs, 0);
const REST_COGS_PCT = shareOf(REST_COGS, REST_REVENUE);
const COGS_GAPS = BRANCHES.map((b) => ({ b, pct: shareOf(b.cogs, b.revenue), excess: b.cogs - b.revenue * (REST_COGS_PCT / 100) }))
  .filter((x) => x.excess > 0)
  .sort((a, b) => b.excess - a.excess);
const COGS_EXCESS = COGS_GAPS.reduce((s, x) => s + x.excess, 0);

// Location margin gap (Odoo Branches analytic plan)
const REST_PROFIT = BRANCHES.reduce((s, b) => s + b.profit, 0);
const REST_MARGIN = shareOf(REST_PROFIT, REST_REVENUE);
const LOW_MARGIN = [...BRANCHES].sort((a, b) => a.marginPct - b.marginPct)[0];
const LOW_MARGIN_UPLIFT = LOW_MARGIN ? Math.max(0, LOW_MARGIN.revenue * ((REST_MARGIN - LOW_MARGIN.marginPct) / 100)) : 0;

export interface FeryalProposal {
  id: string;
  titleAr: string;
  titleEn: string;
  solutionAr: string;
  solutionEn: string;
  outcomeAr: string;
  outcomeEn: string;
  monthlyKwd: number;
  promptAr: string;
  promptEn: string;
}

/** Executive proposals = the background brain's best finding per domain (verified Odoo data only). */
export const FERYAL_PROPOSALS: FeryalProposal[] = AETHER_TOP_PROPOSALS.map((f) => ({
  id: f.id,
  titleAr: f.titleAr,
  titleEn: f.titleEn,
  solutionAr: `${f.faultAr} ${f.fixAr}`,
  solutionEn: `${f.faultEn} ${f.fixEn}`,
  outcomeAr: f.resultAr,
  outcomeEn: f.resultEn,
  monthlyKwd: f.monthlyKwd,
  promptAr: `ناقشي معي بالتفصيل مقترح "${f.titleAr}": ما الخلل بالضبط، وما خطوات الحل، وما المقترح الأفضل للنمو، وما النتيجة المتوقعة؟`,
  promptEn: `Let's go deeper on "${f.titleEn}": what exactly is the fault, what are the fix steps, what is the best growth move, and what result should we expect?`,
}));

export const FERYAL_VENTURE_FOODS_KNOWLEDGE = `
You are "Feryal" (فريال), the Executive Solutions & Proposals Advisor for Venture Foods Restaurants Management Co. W.L.L. (شركة فنتشر فودز لإدارة المطاعم ذ.م.م — Licence ${LEDGER.licence}), connected to the company's Odoo ERP.
Speak with a warm, authoritative Gulf executive tone in Arabic, or a sharp C-level tone in English.

ANTI-HALLUCINATION LOCK (mandatory):
- Base every diagnosis, proposal, and projected outcome strictly on verified Venture Foods Odoo POS & accounting facts. Never invent branches, brands, items, or experimental figures that do not exist in our Odoo database.
- Mention ONLY the brands and restaurant locations listed below. Never mention any other branch, area as a branch, brand, supplier name, or vendor.
- Every number you state must come from the facts below or be a transparent calculation on them (state the assumption, for example "if 10% of delivery orders add a drink").
- If a question needs data that is not listed below, say clearly that it is not available in the synced Odoo data and suggest what Odoo report would answer it.

VERIFIED ODOO FACTS — ${LEDGER.periodLabelEn.toUpperCase()} (whitelisted POS registers; synced ${LEDGER.syncedAt}):
1. Sales: POS net sales ${n3(LEDGER.netSales)} KWD · ${n0(LEDGER.orders)} orders · average basket ${n3(LEDGER.aov)} KWD · about ${n0(ORDERS_PER_DAY)} orders per day · busiest hour ${hourLabel(PEAK_HOUR?.hour ?? 0)} (${n0(PEAK_HOUR?.orders ?? 0)} orders).
   Item sales before order-level promotions ${n3(LEDGER.itemSales)} KWD; total discounts ${n3(LEDGER.discounts)} KWD (${n1(LEDGER.discountsPct)}%).
2. Posted accounting (whitelisted locations): revenue ${n3(LEDGER.revenue)} KWD · food cost ${n3(LEDGER.cogs)} KWD (${n1(LEDGER.cogsPct)}%) · operating expenses ${n3(LEDGER.opex)} KWD (${n1(LEDGER.opexPct)}%) · depreciation ${n3(LEDGER.depreciation)} KWD · net operating profit ${n3(LEDGER.netProfit)} KWD (${n1(LEDGER.marginPct)}% margin).
3. Restaurant locations (${BRANCHES.length}, Odoo Branches analytic plan, ranked by operating profit):
${RANKED_BY_PROFIT.map((b, i) => `   ${i + 1}. ${b.en} (${b.ar}): POS net ${n3(b.sales)} KWD · ${n0(b.orders)} orders · revenue ${n3(b.revenue)} · food cost ${n1(shareOf(b.cogs, b.revenue))}% · operating profit ${n3(b.profit)} KWD (${n1(b.marginPct)}%).`).join('\n')}
   Highest profit: ${TOP_PROFIT?.en}. Highest POS sales: ${TOP_SALES?.en}. Restaurant average food cost ${n1(REST_COGS_PCT)}%, average margin ${n1(REST_MARGIN)}%.
4. Other Odoo units (not branches): Exhibitions & Booths (EXB, registers ${EXB_REGISTERS.map((r) => r.posConfigId).join(', ')}) ${n3(EXB_UNIT?.sales ?? 0)} KWD · ${n0(EXB_UNIT?.orders ?? 0)} orders · basket ${n3(EXB_AOV)} KWD · food cost ${n1(EXB_COGS_PCT)}% · operating profit ${n3(EXB_PNL?.operatingProfit ?? 0)} KWD (${n1(EXB_MARGIN_PCT)}%).
   School canteens (Fresh Daily Canteen): ${CANTEENS.map((u) => `${u.en} ${n3(u.sales)} KWD`).join('; ')} — ${n3(CANTEEN_SALES)} KWD across ${n0(CANTEEN_ORDERS)} orders.
   Shared cost centres: head office ${n3(SHARED_COSTS.headOffice.operatingProfit)} KWD, central kitchen ${n3(SHARED_COSTS.centralKitchen.operatingProfit)} KWD.
5. Brands with October sales (item basis):
${BRANDS.map((b) => `   - ${b.en} (${b.ar}): ${n3(b.sales)} KWD · ${n0(b.orders)} orders · basket ${n3(b.aov)} KWD · ${n1(shareOf(b.sales, BRAND_ITEM_SUM))}% of item sales.`).join('\n')}
   Approved brands without October sales: ${INACTIVE_APPROVED_BRANDS.map((b) => `${b.en} (${b.ar})`).join(', ') || 'none'}. ${LEAD_BRAND?.en} leads the mix; ${TOP_AOV_BRAND?.en} has the highest basket.
6. Sales channels (${CHANNELS.length} Odoo payment channels):
${CHANNELS.map((c) => `   - ${c.en} (${c.ar}): ${n3(c.sales)} KWD · ${n0(c.orders)} payments${c.promo > 0 ? ` · promotions ${n3(c.promo)} KWD` : ''}.`).join('\n')}
   Delivery platforms ${n3(AGG_SALES)} KWD (${n1(shareOf(AGG_SALES, LEDGER.netSales))}% of net sales, ${n0(AGG_ORDERS)} payments); shop sales ${n3(SHOP_CH?.sales ?? 0)} KWD. Keeta promotions ${n3(LEDGER.keetaDiscounts)} KWD = ${n1(KEETA_PROMO_PCT)}% of Keeta item sales.
7. Menu: ${MENU.length} items sold; top ${TOP80.n} make 80% of item sales; ${SLOW_ITEMS.length} items sold fewer than 10 units (${n3(SLOW_SALES)} KWD). Highest-volume items: ${TOP_BY_UNITS.map((m) => `${m.name} (${brandName(m.brand, false)}, ${n0(m.qty)} units, ${n3(m.priceKwd)} KWD)`).join('; ')}. Average drink price ${n3(DRINK_PRICE)} KWD.
   Per-item recipe cost is not readable by the BI service user, so item margins use the group food-cost percentage.
8. Background Aether brain findings (verified Odoo POS, accounting, purchasing and POS-session data; ordered by priority):
${AETHER_FINDINGS.map((f, i) => `   ${i + 1}. [${f.domain}] ${f.titleEn} — Fault: ${f.faultEn} Fix: ${f.fixEn} Growth: ${f.growthEn} Expected: ${f.resultEn}`).join('\n')}

ANSWER FORMAT (always, unless the user only greets you):
- Arabic answers use exactly these three headings, each on its own line starting with "### ":
  ### المقترح والحل العملي
  ### آلية التنفيذ الواقعية
  ### النتائج المتوقعة في حال النجاح
- English answers use exactly: "### Practical Solution", "### Execution Plan", "### Expected Outcomes Upon Success".
- Under the execution heading use a short numbered list (3 to 5 steps). Under the outcomes heading use 2 to 3 bullets with KWD figures derived from the facts above.
- Keep the whole answer between 120 and 220 words, clear enough to be read aloud.
- Language isolation: Arabic answers contain no Latin letters (use the Arabic names in parentheses above, "أودو" for Odoo and "د.ك" for KWD); the only exception is an Odoo product name that has no Arabic name. English answers contain no Arabic script.
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
  // Daily break-even = daily booth rent ÷ Odoo EXB gross profit per order (basket × (1 − EXB food cost)).
  const exbGrossPerOrder = EXB_AOV * (1 - EXB_COGS_PCT / 100);
  const breakEvenOrders = durationDays > 0 && exbGrossPerOrder > 0 ? Math.ceil(boothRentKwd / durationDays / exbGrossPerOrder) : 0;
  const defaultResult: ContractDeepAuditResult = {
    risksAr: [
      `البند 4 (القوة القاهرة والأحوال الجوية): ينص العقد الحالي على عدم استرداد الإيجار (${boothRentKwd.toLocaleString()} د.ك) عند إغلاق الفعالية بسبب الأمطار الغزيرة أو الغبار.`,
      'البند 7 (رسوم الخدمات والنظافة والأمن): رسوم خدمات مفتوحة غير مسقفة قد ترفع التكلفة الفعلية فوق القيمة الإيجارية المتفق عليها.',
      'البند 9 (المواصفات الفنية والكهرباء): عدم النص صراحةً على توفير قاطع كهرباء ثلاثي الطور بقدرة 60 أمبير مستقل لتشغيل قلايات البوث وأجهزة الووك.',
      'البند 11 (غرامات التأخير والتراخيص): غرامات يومية عن أي تأخير في إصدار ترخيص بلدية الكويت المؤقت أو الشهادات الصحية حتى لو كان التأخير من المنظم.',
    ],
    risksEn: [
      `Clause 4 (Force Majeure & Weather): Contract states booth rent (${boothRentKwd.toLocaleString()} KWD) is non-refundable during rain or dust storm closures.`,
      'Clause 7 (Uncapped Service & Cleaning Fees): Open-ended organizer service charges that could inflate the total lease cost beyond the agreed rent.',
      'Clause 9 (Technical & 3-Phase Power): No explicit guarantee of a dedicated 3-Phase (60 Amp) breaker required for Wok stations and commercial fryers.',
      'Clause 11 (Delay Penalties & MOCI/Municipality Permits): Daily penalties even if temporary municipality license issuance is delayed by the organizer.',
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
      `هندسة الكومبو: إلزامية المشروب في وجبات المعارض لرفع متوسط الفاتورة فوق ${n3(EXB_AOV)} د.ك (فعلي أودو)، وخفض تكلفة الأغذية من ${n1(EXB_COGS_PCT)}% نحو متوسط المجموعة ${n1(LEDGER.cogsPct)}%.`,
      'إدارة طوابير الذروة المسائية (6 م - 11 م): تخصيص كاشير متنقل بجهاز كي نت لاسلكي في طابور الانتظار لفصل الدفع عن شباك الاستلام.',
      `ربط مركز التكلفة في أودو: فتح حساب تحليلي مستقل (${eventName}) ومراقبة نقطة التعادل اليومية البالغة ${n0(breakEvenOrders)} طلباً بناءً على متوسط سلة المعارض وتكلفة أغذيتها في أودو.`,
    ],
    solutionsEn: [
      'Sub-90-Second Booth Service: Pre-portion and marinate 85% of items in 140g calibrated batches at the central kitchen for rapid final sear at the booth.',
      `EXB Combo Engineering: Make a drink mandatory in booth combos to lift the basket above the ${n3(EXB_AOV)} KWD Odoo actual, and bring food cost from ${n1(EXB_COGS_PCT)}% toward the ${n1(LEDGER.cogsPct)}% group level.`,
      'Peak Queue Management (6 PM – 11 PM): Deploy a mobile handheld KNET/Apple Pay cashier along the queue to decouple payment from order pickup.',
      `Odoo Analytical Cost Center: Open a dedicated analytic account (${eventName}) and track the daily break-even of ${n0(breakEvenOrders)} orders, derived from the Odoo EXB basket and food cost.`,
    ],
    verdictBadgeAr: '✅ يوصى بالاعتماد وتوقيع العقد بعد تعديل البند 4 (الطقس) والبند 7 (سقف الخدمات 5%)',
    verdictBadgeEn: '✅ Approved for Signing Subject to Amending Clause 4 (Weather) & Clause 7 (5% Fee Cap)',
    voiceSummaryAr: `يا هلا! قمت بتشريح عقد وتصور فعالية ${eventName} لمدة ${durationDays} يوماً بإيجار ${boothRentKwd} دينار كويتي. نقطة التعادل اليومية ${n0(breakEvenOrders)} طلباً بناءً على متوسط سلة المعارض في أودو، وأنصحك بتوقيع العقد فوراً بعد إضافة بند تعويض أيام الأمطار وتحديد سقف رسوم الخدمات بخمسة بالمئة، مع الاعتماد على منيو المعارض السريعة من المطبخ المركزي.`,
    voiceSummaryEn: `I have completed the deep audit of the ${eventName} contract for ${durationDays} days at ${boothRentKwd} Kuwaiti Dinars booth rent. The daily break-even is ${n0(breakEvenOrders)} orders based on the Odoo exhibitions basket and food cost. I recommend signing immediately after adding the weather-closure rent credit in Clause 4 and capping service fees at 5 percent in Clause 7.`,
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

const SECTION_HEADINGS = {
  ar: ['المقترح والحل العملي', 'آلية التنفيذ الواقعية', 'النتائج المتوقعة في حال النجاح'],
  en: ['Practical Solution', 'Execution Plan', 'Expected Outcomes Upon Success'],
} as const;

function threeSections(lang: 'ar' | 'en', solution: string, steps: string[], outcomes: string[]) {
  const [h1, h2, h3] = SECTION_HEADINGS[lang];
  return [`### ${h1}`, solution, '', `### ${h2}`, ...steps.map((s, i) => `${i + 1}. ${s}`), '', `### ${h3}`, ...outcomes.map((o) => `- ${o}`)].join('\n');
}

function findingReply(f: AetherFinding, lang: 'ar' | 'en') {
  const isAr = lang === 'ar';
  return threeSections(
    lang,
    isAr ? `${f.faultAr} ${f.fixAr}` : `${f.faultEn} ${f.fixEn}`,
    isAr ? f.stepsAr : f.stepsEn,
    [isAr ? f.resultAr : f.resultEn, isAr ? `المقترح الأفضل للنمو: ${f.growthAr}` : `Best growth move: ${f.growthEn}`],
  );
}

/**
 * Deterministic fallback built on the background brain's verified findings,
 * always answering in the three-section executive format.
 */
export function getDeterministicFeryalReply(query: string, lang: 'ar' | 'en'): string {
  const q = query.toLowerCase();
  const isAr = lang === 'ar';
  const has = (...keys: string[]) => keys.some((k) => q.includes(k));
  const best = (domain: AetherFinding['domain'], id?: string) =>
    (id ? AETHER_FINDINGS.find((f) => f.id === id) : undefined) ?? AETHER_FINDINGS.filter((f) => f.domain === domain).sort((a, b) => b.monthlyKwd - a.monthlyKwd)[0];

  const pick =
    has('كيتا', 'keeta', 'tgo', 'tmp', 'طلبات', 'talabat', 'خصم', 'عروض', 'discount', 'promo', 'توصيل', 'delivery', 'قناة', 'قنوات', 'channel', 'تسوي', 'settlement')
      ? best('delivery')
      : has('مشروب', 'drink', 'beverage', 'سلة', 'basket', 'upsell')
        ? best('menu', 'menu-attach')
        : has('منيو', 'صنف', 'أصناف', 'menu', 'item', 'سعر', 'price', 'تسعير')
          ? best('menu')
          : has('مورد', 'supplier', 'purchase', 'مشتريات', 'creep')
            ? best('operations', 'ops-price-creep')
            : has('تكلفة', 'هدر', 'مطبخ', 'cogs', 'food cost', 'waste', 'kitchen', 'cost', 'تشغيل', 'operation', 'إلغاء', 'cancel')
              ? best('operations')
              : has('إيجار', 'ايجار', 'أجار', 'rent', 'lease', 'فرع', 'فروع', 'موقع', 'مواقع', 'branch', 'location', 'نمو', 'growth', ...BRANCHES.flatMap((b) => [b.en.toLowerCase(), b.ar]))
                ? best('branches')
                : undefined;
  if (pick) return findingReply(pick, lang);

  if (has('معرض', 'معارض', 'exb', 'فعالي', 'event', 'booth', 'بوث')) {
    return threeSections(
      lang,
      isAr
        ? `حققت وحدة المعارض والأجنحة في أودو ${n3(EXB_UNIT?.sales ?? 0)} د.ك عبر ${n0(EXB_UNIT?.orders ?? 0)} طلباً بمتوسط سلة ${n3(EXB_AOV)} د.ك، وربحاً تشغيلياً ${n3(EXB_PNL?.operatingProfit ?? 0)} د.ك بهامش ${n1(EXB_MARGIN_PCT)}%. نرفع متوسط السلة بوجبات مجمّعة مع مشروب في كل بوث.`
        : `The Exhibitions & Booths unit sold ${n3(EXB_UNIT?.sales ?? 0)} KWD across ${n0(EXB_UNIT?.orders ?? 0)} orders in Odoo at a ${n3(EXB_AOV)} KWD basket, with ${n3(EXB_PNL?.operatingProfit ?? 0)} KWD operating profit (${n1(EXB_MARGIN_PCT)}% margin). Lift the basket with drink bundles at every booth.`,
      isAr
        ? ['تصميم وجبة مجمّعة مع مشروب لكل بوث.', `خفض تكلفة الأغذية في المعارض من ${n1(EXB_COGS_PCT)}% نحو متوسط المجموعة ${n1(LEDGER.cogsPct)}%.`, 'متابعة مبيعات كل جهاز معارض يومياً في أودو.']
        : ['Design a drink bundle for every booth.', `Bring EXB food cost from ${n1(EXB_COGS_PCT)}% toward the ${n1(LEDGER.cogsPct)}% group level.`, 'Track each exhibition register daily in Odoo.'],
      isAr
        ? [`كل 0.250 د.ك إضافية في متوسط السلة على ${n0(EXB_UNIT?.orders ?? 0)} طلباً = ${n0((EXB_UNIT?.orders ?? 0) * 0.25)} د.ك مبيعات إضافية شهرياً.`]
        : [`Every 0.250 KWD added to the basket across ${n0(EXB_UNIT?.orders ?? 0)} orders = +${n0((EXB_UNIT?.orders ?? 0) * 0.25)} KWD sales per month.`],
    );
  }

  const total = FERYAL_PROPOSALS.reduce((s, p) => s + p.monthlyKwd, 0);
  return threeSections(
    lang,
    isAr
      ? `صافي مبيعات نقاط البيع في أودو لشهر ${LEDGER.periodLabelAr} ${n3(LEDGER.netSales)} د.ك عبر ${n0(LEDGER.orders)} طلباً، والربح التشغيلي ${n3(LEDGER.netProfit)} د.ك بهامش ${n1(LEDGER.marginPct)}%. أقترح البدء بأعلى الحلول أثراً.`
      : `Odoo POS net sales for ${LEDGER.periodLabelEn} are ${n3(LEDGER.netSales)} KWD across ${n0(LEDGER.orders)} orders, with ${n3(LEDGER.netProfit)} KWD operating profit (${n1(LEDGER.marginPct)}% margin). I propose starting with the highest-impact fixes.`,
    FERYAL_PROPOSALS.map((p) => (isAr ? p.titleAr : p.titleEn)),
    [
      ...FERYAL_PROPOSALS.map((p) => (isAr ? p.outcomeAr : p.outcomeEn)),
      isAr ? `الأثر المجمّع المتوقع نحو ${n0(total)} د.ك شهرياً.` : `Combined expected impact of about ${n0(total)} KWD per month.`,
    ],
  );
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
    ? 'أجيبي باللغة العربية فقط بلهجة خليجية تنفيذية راقية، وبالأقسام الثلاثة: المقترح والحل العملي، آلية التنفيذ الواقعية، النتائج المتوقعة في حال النجاح، مع أرقام أودو الموثقة بالدينار الكويتي فقط.'
    : 'Answer strictly in clear executive English using the three sections Practical Solution, Execution Plan and Expected Outcomes Upon Success, citing only verified Odoo figures in KWD.';

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
      maxOutputTokens: 900,
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
          max_tokens: 800,
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
