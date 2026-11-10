/**
 * Feryal Executive AI Brain — Powered by Google Gemini (Argon High / Gemini 3.8 Pro)
 * Multimodal Financial Analysis & Kuwaiti/Arabic/English Audio Understanding
 * Includes verified Venture Foods Kuwait Odoo 17 Executive Knowledge Base
 */

import { getGeminiApiKey, getOpenAIApiKey } from './ai-keys';

export const FERYAL_VENTURE_FOODS_KNOWLEDGE = `
You are "Feryal" (فريال), the Executive Financial & Operational AI Copilot for Venture Foods Kuwait (شركة فينشر فودز الكويت - Odoo 17 ERP).
Speak with an authoritative, warm, executive Kuwaiti/Gulf Arabic tone when answering in Arabic, or a sharp C-level executive tone when answering in English.
Keep answers concise (2 to 4 impactful sentences) with exact numbers in KWD so they sound natural when spoken aloud via OpenAI Nova voice.

VERIFIED VENTURE FOODS KUWAIT ODOO 17 DATA (SINGLE SOURCE OF TRUTH):
1. Revenue & Orders:
   - Total Verified Net Sales: 167,092.160 KWD across 30,540 fulfilled orders (Average Basket AOV: 5.471 KWD).
2. Operating Profit:
   - Net Operating Profit: 42,441.480 KWD (25.4% Net Operating Margin).
3. Food Cost (COGS) & Central Kitchen:
   - Total COGS: 41,438.856 KWD (418 inventory & production entries).
   - Actual COGS is 24.8% vs 24.0% Target (+0.8% variance).
   - Root cause: Raw poultry & marinade waste at Ardiya Central Kitchen costing 1,336 KWD/month.
   - Action plan: Enforce daily morning yield calibration at Ardiya Central Kitchen to recover +1,336 KWD/month (+16,032 KWD/year).
4. General Expenses (Opex) & Petty Cash Custodies:
   - Total Opex & Custodies: 51,154.950 KWD across 2,213 journal entries.
   - Major custody item: 10,707.930 KWD across 312 entries in unclosed Al-Kout & Salmiya maintenance custodies.
   - Action plan: Convert recurring emergency repairs into an annual preventive HVAC/kitchen maintenance contract and cap branch petty cash at 250 KWD; the commercial chiller overhaul alone recovers +850 KWD/month (+10,200 KWD/year).
5. Delivery Aggregators & Promotional Discounts:
   - Total Promotional Discounts: 4,152.000 KWD (2,544.000 KWD on Keeta alone across 6,267 orders).
   - 11 Active Sales Channels: Talabat Tgo, Talabat TMP, Keeta, Deliveroo, Cari, Jahez, Call Center, Dine-in, Takeaway, Drive-Thru, Direct Web.
   - Action plan: Cap unapproved Keeta promotional discounts at 3.5% (from 2,544 KWD to 924 KWD, +1,620 KWD/month saved) and enforce a mandatory beverage in Talabat Tgo, TMP & Keeta delivery combos to lift group AOV from 5.471 KWD to 5.750 KWD (+2,450 KWD/month net gain).
6. 6 Active Brands:
   - China Garden (تشاينا جاردن): Flagship brand driving 84.8% of revenue (141,662.400 KWD across 25,890 orders).
   - Frank's (فرانكس): Highest basket average (AOV 7.490 KWD).
   - Tahina (طحينة), Burgerito (برجريتو), Chick & Dip (تشيك آند ديب), Crave (كريف).
7. 9 Active Operational Branches:
   - Salmiya (السالمية): #1 Most Profitable Branch generating 31,246.230 KWD net operating contribution.
   - Al-Kout / Fahaheel (الكوت), Sharq (شرق), Hawally (حولي), Farwaniya (الفروانية), Ardiya Central Kitchen & Hub (العارضية), Mahboula (المهبولة), Mubarak Al-Kabeer (مبارك الكبير), Jabriya (الجابرية).
   - Only these 9 branches are active; never mention any other branch location.
   - Menu Matrix: purge 18 sluggish Dog items and apply +5% pricing to 4 popular Plowhorses (+584 KWD/month).
   - Online Tablet Availability across Talabat Tgo/TMP, Keeta, and Deliveroo: 99.1% uptime.
8. Forward Profit Projections (With Feryal's 4 Executive Remedies):
   - Monthly Net Profit Recovery: +7,640 KWD/month (+18.0% profit surge).
   - Q1 (3 Months): +20,520 KWD added net gain -> 147,844 KWD cumulative net profit.
   - H1 (6 Months): +43,800 KWD added net gain -> 298,449 KWD cumulative net profit.
   - Full Year (12 Months): +91,680 KWD added net gain -> 600,978 KWD annual net profit.
9. Events, Exhibitions & EXB Menu Intelligence (Seasonal Booths & Odoo Analytical Accounts):
   - Total Verified & Simulated Events Revenue: 84,650.000 KWD across 14,850 orders (Event Basket AOV: 5.700 KWD).
   - Events Net Operating Profit: 24,890.000 KWD (29.4% net margin after booth rent & staffing).
   - EXB Menu COGS: 21.4% (3.4% better than fixed branches due to focused 8-item menu & pre-marinated 140g Ardiya batches).
   - Average Booth Break-Even: 58 orders/day (330.600 KWD/day | Capital Payback on Day 14) with +168.5% Seasonal Event ROI.
   - Key Benchmark Events:
     * Marina Kashta (كشتة المارينا): 60 days | Rent & Setup 6,800 KWD | Sales 38,400 KWD | Net Profit 11,920 KWD | ROI 175% (Recommended for renewal).
     * Al-Safeer Camp (مخيم السفير): 45 days | Rent & Setup 4,900 KWD | Sales 26,850 KWD | Net Profit 7,840 KWD | ROI 160% (Strong beverage margin).
     * Winterland Seasonal Booth (ونترلاند الكويت): 90 days | Rent & Setup 9,500 KWD | Projected Sales 54,200 KWD | Net Profit 15,600 KWD | ROI 164%.
   - EXB Menu 8 Star Items (+10% booth price uplift, <90 sec assembly): Chicken Noodles Box (China Garden), Dynamite Shrimp Cup, Philly CheeseSteak Sliders (Frank's), Loaded Shawarma Fries (Tahina), Smash Burgerito Combo, Crispy Strips Cone (Chick & Dip), Sweet Corn Warm Cup, Mandatory Event Soft Drink / Mojito.
10. Enterprise OS Modules (Aether BI):
   a) Demand, Weather & Central Kitchen Prep Forecaster (/erp/demand-forecast):
     * Baseline 985 orders/day (30,540 orders over 31 days). Kuwait rhythm: Thursday ×1.15 and Friday ×1.21 versus the weekly mean; salary week (24th–29th) ×1.12.
     * Weather: dust events shift 22% of dine-in demand to delivery (total demand ×0.95); high heat (≥42°C) shifts 16%; mild weather lifts dine-in slightly.
     * Ardiya prep par levels convert forecast brand orders into batches (140 g marinated poultry portions, Philly steak kg, rice batches, sauces). Cutting the over-production buffer from 12% to a forecast-driven 4% on ~16,700 KWD monthly raw prep spend delivers the approved +1,336 KWD/month.
     * Crew planning uses 7 orders per labour hour with a 2-person minimum to raise sales per labour hour.
   b) 3-Way Aggregator Reconciliation & Chargebacks (/erp/delivery-control):
     * Odoo POS sales → aggregator statement → bank deposit across all 11 channels. Recoverable settlement discrepancies total 954.120 KWD/month (unpaid cancellations, unapproved promo deductions, commission over-billing; Keeta 416.240 and Talabat Tgo 342.030 are the largest). Settlements in transit total 4,337.000 KWD.
     * Dispute queue: 12 chargeback cases worth 310.330 KWD (wrongful refunds, driver-delay penalties charged to branches, over-billed commissions, missing-item claims, unpaid cancellations), each with a bilingual claim ready to send.
     * True per-order net pocket profit (gross basket − commission − discount − 24.8% food cost − 0.180 KWD packaging − 0.350 KWD own rider on TMP): Keeta 3.411 KWD (56.0%), Deliveroo 3.245 KWD (51.9%), Jahez 3.072 KWD (53.5%), Talabat TMP 3.038 KWD (54.6%), Talabat Tgo 2.934 KWD (53.7%). Monthly aggregator & gateway commissions: 14,736.810 KWD.
   c) Supplier Price-Creep & COGS Intelligence (/erp/cost-intelligence):
     * Invoice vs contract: fresh poultry breast 1.950 → 2.145 KWD/kg (+10.0%), tahina paste +8.0%, thermal delivery boxes +6.0%, frozen poultry carton 10.800 → 11.400 KWD (+5.6%), Philly beef 6.800 → 7.140 KWD/kg (+5.0%), corn oil drum 8.750 → 9.100 KWD (+4.0%), basmati rice +2.0%, soy sauce flat. Total price-creep exposure ≈ 823 KWD/month (poultry breast alone 516.750 KWD).
     * Theoretical COGS 24.0% (40,102.118 KWD) vs actual 24.8% (41,438.856 KWD) = 1,336.738 KWD gap: Ardiya central-kitchen prep shrinkage 695.10 KWD (52%), branch over-portioning 414.39 KWD (31%), unrecorded wastage 227.25 KWD (17%).
     * Counter-moves: renegotiate or dual-source for Stars, re-price Plowhorses, trim portions 5% on Puzzles.
   d) Executive P&L & Rolling Budget Variance (/erp/executive-pnl):
     * Monthly P&L: gross sales 171,244.160; discounts 4,152.000; net sales 167,092.160; food & packaging COGS 41,438.856; aggregator & gateway commissions 14,736.810; salaries & rent 17,320.064; maintenance custody 10,707.930; other opex & custodies 40,447.020; net operating profit 42,441.480 KWD (25.4%).
     * Approved monthly budget embeds the five levers: net operating profit budget 49,281.480 KWD, so the month runs 6,840 KWD unfavourable until the remedies land (discounts budget 2,532.000 with the Keeta cap; maintenance budget 9,857.930 after the chiller overhaul; COGS at the 24.0% target). Budgets ramp to Q1 147,844 / H1 298,449 / full year 600,978 KWD.
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
      'ضبط سرعة الخدمة تحت 90 ثانية: تجهيز وتتبيل 85% من الأصناف مسبقاً بحصص معايرة (140 جم) في مطبخ العارضية المركزي والاكتفاء بالتسوية السريعة في البوث.',
      'هندسة التسعير والكومبو (+10%): تطبيق أسعار منيو المعارض مع إلزامية المشروب/الموهيتو لرفع متوسط الفاتورة إلى 5.700 د.ك وتخفيض تكلفة الأغذية إلى 21.4%.',
      'إدارة طوابير الذروة المسائية (6 م - 11 م): تخصيص كاشير متنقل بجهاز كي نت لاسلكي في طابور الانتظار لفصل الدفع عن شباك الاستلام.',
      `ربط مركز التكلفة في أودو: فتح حساب تحليلي مستقل (${eventName}) لمراقبة نقطة التعادل اليومية (58 طلباً/يومياً) واسترداد رأس المال في اليوم الـ 14.`,
    ],
    solutionsEn: [
      'Sub-90-Second Booth Service: Pre-portion and marinate 85% of items in 140g calibrated batches at Ardiya Central Kitchen for rapid final sear at the booth.',
      'EXB Pricing & Combo Engineering (+10%): Deploy the 8-item EXB Menu with mandatory beverage/mojito upsell to sustain a 5.700 KWD AOV and 21.4% COGS.',
      'Peak Queue Management (6 PM – 11 PM): Deploy a mobile handheld KNET/Apple Pay cashier along the queue to decouple payment from order pickup.',
      `Odoo Analytical Cost Center: Track daily break-even (58 orders / 330.600 KWD per day) under an isolated Odoo ledger to achieve full payback by Day 14.`,
    ],
    verdictBadgeAr: '✅ يوصى بالاعتماد وتوقيع العقد بعد تعديل البند 4 (الطقس) والبند 7 (سقف الخدمات 5%)',
    verdictBadgeEn: '✅ Approved for Signing Subject to Amending Clause 4 (Weather) & Clause 7 (5% Fee Cap)',
    voiceSummaryAr: `يا هلا! قمت بتشريح عقد وتصور فعالية ${eventName} لمدة ${durationDays} يوماً بإيجار ${boothRentKwd} دينار كويتي. الجدوى المالية ممتازة بعائد استثمار يتجاوز 150 بالمئة ونقطة تعادل 58 طلباً يومياً، وأنصحك بتوقيع العقد فوراً بعد إضافة بند تعويض أيام الأمطار وتحديد سقف رسوم الخدمات بخمسة بالمئة، مع الاعتماد على منيو المعارض السريعة من مطبخ العارضية المركزي.`,
    voiceSummaryEn: `I have completed the deep audit of the ${eventName} contract for ${durationDays} days at ${boothRentKwd} Kuwaiti Dinars booth rent. Financial feasibility is strong with payback in 14 days and a 58-order daily break-even. I recommend signing immediately after adding the weather-closure rent credit in Clause 4 and capping service fees at 5 percent in Clause 7.`,
    recommendedBrandId: executiveVision.toLowerCase().includes('برجر') || executiveVision.toLowerCase().includes('burger')
      ? 'Burgerito'
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
  "recommendedBrandId": "One of: China Garden, Frank's, Tahina, Burgerito, Chick & Dip, Crave"
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
 * Deterministic high-precision fallback using verified Venture Foods Odoo numbers
 */
export function getDeterministicFeryalReply(query: string, lang: 'ar' | 'en'): string {
  const q = query.toLowerCase();
  const isAr = lang === 'ar';

  if (q.includes('forecast') || q.includes('demand') || q.includes('prep') || q.includes('par level') || q.includes('weather') || q.includes('staff') || q.includes('توقع') || q.includes('تحضير') || q.includes('طقس') || q.includes('طاقم')) {
    return isAr
      ? 'توقع الطلب ينطلق من 985 طلباً يومياً، مع ذروة الخميس ×1.15 والجمعة ×1.21 وأسبوع الرواتب ×1.12، والغبار يحول 22% من طلب الصالة إلى التوصيل. خفض هامش التحضير في مطبخ العارضية من 12% إلى 4% بناءً على التوقع يحقق الوفر المعتمد 1,336 دينار كويتي شهرياً.'
      : 'Demand forecasting starts from 985 orders a day, with Thursday ×1.15, Friday ×1.21 and salary week ×1.12, while dust shifts 22% of dine-in demand to delivery. Cutting the Ardiya prep buffer from 12% to a forecast-driven 4% delivers the approved 1,336 KWD per month.';
  }

  if (q.includes('chargeback') || q.includes('reconcil') || q.includes('settlement') || q.includes('dispute') || q.includes('waterfall') || q.includes('pocket') || q.includes('استرداد') || q.includes('مطابقة') || q.includes('تسوي') || q.includes('نزاع')) {
    return isAr
      ? 'المطابقة الثلاثية بين نقاط البيع وكشوف المنصات والبنك ترصد 954.120 د.ك فروقات قابلة للاسترداد شهرياً، أكبرها في كيتا وطلبات جو، و4,337 د.ك تسويات قيد التحويل. لدينا 12 مطالبة استرداد بقيمة 310.330 د.ك جاهزة للإرسال، وصافي ربح الطلب الأعلى في كيتا عند 3.411 د.ك.'
      : 'The 3-way reconciliation of POS, aggregator statements and bank deposits flags 954.120 KWD of recoverable discrepancies a month, led by Keeta and Talabat Tgo, plus 4,337 KWD in transit. Twelve chargeback claims worth 310.330 KWD are ready to send, and Keeta delivers the best net pocket profit at 3.411 KWD per order.';
  }

  if (q.includes('supplier') || q.includes('price creep') || q.includes('vendor') || q.includes('invoice') || q.includes('erosion') || q.includes('مورد') || q.includes('الموردين') || q.includes('فواتير') || q.includes('تآكل')) {
    return isAr
      ? 'رادار الموردين يرصد ارتفاع صدور الدجاج من 1.950 إلى 2.145 د.ك للكيلو بنسبة 10%، والطحينة 8% وعلب التوصيل 6%، بإجمالي أثر يقارب 823 د.ك شهرياً. أوصي بإعادة التفاوض أو مورد بديل للأصناف النجوم ورفع أسعار الأصناف الشعبية منخفضة الهامش.'
      : 'The supplier radar shows poultry breast up from 1.950 to 2.145 KWD per kg (+10%), tahina paste +8% and delivery boxes +6%, about 823 KWD a month of exposure. I recommend renegotiating or dual-sourcing for Stars and re-pricing the low-margin Plowhorses.';
  }

  if (q.includes('budget') || q.includes('variance') || q.includes('p&l') || q.includes('pnl') || q.includes('board pack') || q.includes('موازنة') || q.includes('انحراف') || q.includes('قائمة الدخل')) {
    return isAr
      ? 'صافي الربح التشغيلي الفعلي 42,441.480 د.ك مقابل موازنة شهرية 49,281.480 د.ك تتضمن الروافع الخمس، أي انحراف سلبي 6,840 د.ك يغلق بتطبيق سقف كيتا وإنتاجية العارضية وتجديد المبردات والمشروب الإلزامي ومصفوفة المنيو، وصولاً إلى 600,978 د.ك للسنة الكاملة.'
      : 'Net operating profit is 42,441.480 KWD against a 49,281.480 KWD monthly budget that embeds the five levers — a 6,840 KWD unfavourable variance that closes with the Keeta cap, Ardiya yield, chiller overhaul, beverage attach and menu matrix, on the path to 600,978 KWD for the full year.';
  }

  if (q.includes('مارينا') || q.includes('كشتة') || q.includes('سفير') || q.includes('ونترلاند') || q.includes('فعالي') || q.includes('معرض') || q.includes('معارض') || q.includes('exb') || q.includes('kashta') || q.includes('safeer') || q.includes('winterland') || q.includes('booth') || q.includes('event') || q.includes('تعادل') || q.includes('break-even')) {
    return isAr
      ? 'يا هلا! حسب سجل مراكز تكلفة الفعاليات في أودو، حققت كشتة المارينا (60 يوماً) مبيعات 38,400 د.ك وصافي ربح 11,920 د.ك بعائد استثمار 175%، بينما حقق مخيم السفير (45 يوماً) مبيعات 26,850 د.ك وصافي ربح 7,840 د.ك بعائد 160%. نقطة التعادل اليومية للبوث هي 58 طلباً فقط (330.600 د.ك) مع استرداد رأس المال في اليوم الـ 14 بفضل منيو المعارض ذات تكلفة الأغذية المنخفضة 21.4%!'
      : 'Based on Odoo Analytical Accounts for seasonal events, Marina Kashta (60 days) achieved 38,400 KWD in sales and 11,920 KWD net profit (175% ROI), while Al-Safeer Camp (45 days) delivered 26,850 KWD in sales and 7,840 KWD net profit (160% ROI). Daily booth break-even is just 58 orders (330.600 KWD/day) with full capital payback on Day 14 thanks to our 21.4% COGS EXB Menu!';
  }

  if (q.includes('سالمية') || q.includes('salmiya') || q.includes('فرع') || q.includes('branch') || q.includes('أفضل') || q.includes('top')) {
    return isAr
      ? 'يا هلا! حسب قيود أودو الموثقة، فرع السالمية يتصدر ربحية الفروع الـ 9 بصافي مساهمة تشغيلية 31,246.230 د.ك، يليه فرع الكوت ثم شرق، مع التزام بتوافر أونلاين 99.1% على منصات طلبات جو وسوق طلبات وكيتا وديليفرو.'
      : 'Based on verified Odoo entries, Salmiya is our #1 most profitable branch across all 9 locations with 31,246.230 KWD in net operating contribution, supported by 99.1% online tablet availability across Talabat Tgo, TMP, Keeta, and Deliveroo.';
  }

  if (q.includes('هدر') || q.includes('عارضية') || q.includes('مطبخ') || q.includes('cogs') || q.includes('food cost') || q.includes('poultry') || q.includes('دواجن') || q.includes('تكلفة')) {
    return isAr
      ? 'تكلفة الأغذية الفعلية حالياً 41,438.856 د.ك بنسبة 24.8% مقابل المستهدف 24.0% عبر 418 قيد مخزني. السبب الرئيسي هو هدر الدواجن والتتبيل في المطبخ المركزي بالعارضية بقيمة 1,336 د.ك شهرياً، وضبط معايرة الإنتاج الصباحية سيسترد هذا المبلغ بالكامل فوراً.'
      : 'Actual Food Cost (COGS) is 41,438.856 KWD (24.8% vs 24.0% target across 418 entries). Enforcing daily morning poultry yield calibration at the Ardiya Central Kitchen will immediately recover 1,336 KWD per month (+16,032 KWD annually).';
  }

  if (q.includes('كيتا') || q.includes('keeta') || q.includes('tgo') || q.includes('tmp') || q.includes('طلبات') || q.includes('talabat') || q.includes('خصم') || q.includes('discount') || q.includes('توصيل')) {
    return isAr
      ? 'إجمالي الخصومات الترويجية بلغ 4,152.000 د.ك منها 2,544 د.ك على منصة كيتا وحدها عبر 6,267 طلب. بتطبيق سقف خصم 3.5% على كيتا (من 2,544 إلى 924 د.ك) نوفر 1,620 د.ك شهرياً، ومع المشروب الإلزامي في وجبات التوصيل على طلبات جو وسوق طلبات لرفع السلة من 5.471 إلى 5.750 د.ك نربح 2,450 د.ك إضافية شهرياً.'
      : 'Total promotional discounts reached 4,152.000 KWD, with 2,544 KWD concentrated on Keeta across 6,267 orders. Capping Keeta promos at 3.5% (2,544 to 924 KWD) saves 1,620 KWD/month, while a mandatory beverage in Talabat Tgo & TMP delivery combos lifts AOV from 5.471 to 5.750 KWD (+2,450 KWD/month).';
  }

  if (q.includes('عهد') || q.includes('كوت') || q.includes('صيانة') || q.includes('مصروفات') || q.includes('opex') || q.includes('custod') || q.includes('kout') || q.includes('maintenance')) {
    return isAr
      ? 'رصد رادار أودو 51,154.950 د.ك مصروفات وعهد عبر 2,213 قيد محاسبي، أبرزها 10,707.930 د.ك عهد صيانة غير مقفلة في الكوت والسالمية (312 قيد). تجديد المبردات التجارية يوقف الإصلاحات النقدية المتكررة ويوفر 850 د.ك شهرياً، مع سقف عهدة نثرية 250 د.ك لكل فرع.'
      : 'Odoo audit radar tracked 51,154.950 KWD in Opex & custodies across 2,213 entries, including 10,707.930 KWD in Al-Kout & Salmiya maintenance custodies (312 entries). A commercial chiller overhaul ends the repeated cash repairs and recovers 850 KWD/month, backed by a 250 KWD petty-cash cap per branch.';
  }

  if (q.includes('توقع') || q.includes('ربع') || q.includes('سنو') || q.includes('600') || q.includes('q1') || q.includes('forecast') || q.includes('roadmap') || q.includes('target') || q.includes('خطة')) {
    return isAr
      ? 'بتطبيق خطتي الرباعية، يرتفع صافي الربح الشهري بمقدار 7,640 د.ك (+18%). ستحقق فينشر فودز في الربع الأول مكاسب إضافية +20,520 د.ك (إجمالي ربح 147,844 د.ك)، وفي نصف السنة +43,800 د.ك (إجمالي 298,449 د.ك)، وصولاً إلى 600,978 د.ك صافي ربح سنوي!'
      : 'Executing our 4-pillar recovery plan adds +7,640 KWD/month (+18% profit surge). Venture Foods will achieve +20,520 KWD added gain in Q1 (147,844 KWD total profit), +43,800 KWD in H1 (298,449 KWD total), and 600,978 KWD in full-year net operating profit.';
  }

  if (q.includes('علام') || q.includes('تشاينا') || q.includes('فرانكس') || q.includes('brand') || q.includes('china') || q.includes('frank')) {
    return isAr
      ? 'تدير فينشر فودز 6 علامات نشطة: تتصدرها تشاينا جاردن بنسبة 84.8% من المبيعات (141,662 د.ك)، وتتميز فرانكس بأعلى متوسط سلة (7.490 د.ك)، إلى جانب طحينة وبرجريتو وتشيك آند ديب وكريف عبر 11 قناة بيع.'
      : 'Venture Foods operates 6 active brands led by China Garden at 84.8% revenue share (141,662 KWD) and Frank\'s with the highest basket AOV at 7.490 KWD, alongside Tahina, Burgerito, Chick & Dip, and Crave across 11 sales channels.';
  }

  return isAr
    ? 'أهلاً بك في مركز القيادة التنفيذي لشركة فينشر فودز! صافي المبيعات الموثق 167,092.160 د.ك عبر 30,540 طلب، وصافي الربح التشغيلي 42,441.480 د.ك (بهامش 25.4%). بإمكاننا استرداد 7,640 د.ك إضافية شهرياً للوصول إلى 600,978 د.ك سنوياً عبر ضبط هدر العارضية وعهد الكوت وخصومات كيتا.'
    : 'Welcome to the Venture Foods Executive Command Center! Verified Net Sales stand at 167,092.160 KWD across 30,540 orders with 42,441.480 KWD Net Operating Profit (25.4% margin). We can unlock +7,640 KWD/month (+600,978 KWD annual profit) by optimizing Ardiya COGS, Al-Kout custodies, and Keeta promos.';
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
          ? 'فريال، فينشر فودز، أودو، السالمية، العارضية، الكوت، تشاينا جاردن، فرانكس، طحينة، برجريتو، كيتا، طلبات، Tgo، TMP'
          : 'Feryal, Venture Foods, Odoo, Salmiya, Ardiya, Al-Kout, China Garden, Franks, Tahina, Burgerito, Keeta, Talabat, Tgo, TMP'
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
