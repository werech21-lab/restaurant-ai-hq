"use client";

import React, { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { makeTr, registerAnalyticsAr } from "@/lib/i18n/analytics-ar";
import { BRANDS, CHANNELS, LEDGER, MENU_ITEMS } from "@/lib/aether/ledger";
import { ODOO } from "@/lib/odoo/odoo-dataset";
import { SALES_TABS, parseSalesTab, salesTabHref } from "@/lib/analytics/sales-tabs";
import { BRANDS_DATA, CHANNELS_DATA, type BrandRow, type ChannelRow } from "@/lib/analytics/sales-core-data";
import { ALL_BRANDS, ALL_CHANNELS, TOTAL_NET, BRANCH_NET, REAL_BRAND_CHANNEL_DATA, computeView, type PeriodType, type SalesFilter } from "@/lib/analytics/sales-view";
import {
  TopAnalyticsFilterBar,
  VENTURE_BRANCHES,
  PERIOD_MULTIPLIERS,
  type PeriodOption,
  DeliveryModeBadge,
} from "@/components/analytics/top-analytics-filter-bar";
import { TOP_BEST_SELLERS } from "@/lib/analytics/brand-sales-october-data";
import {
  BranchesTab,
  ChannelMix,
  ChannelModeBadge,
  ChannelRecs,
  DailyCurve,
  HoverTip,
  NeedsAttention,
  NewCustomerTab,
  OperationsTab,
  PeakHoursTab,
  PromotionsTab,
  RevenueConcentration,
  Spark,
} from "@/components/analytics/sales-tabs";

// ==========================================
// 1. ODOO ERP MASTER DATASET (VENTURE FOODS)
// ==========================================

// All rows below are generated from the live Odoo dataset (whitelisted POS registers).
const SC_BRAND_EN = (id: string) => BRANDS.find((b) => b.id === id)?.en ?? id;
const SC_MENU = [...ODOO.menu].filter((m) => m.netKwd > 0 && m.qty > 0 && BRANDS.some((b) => b.id === m.brand));
const SC_MENU_TOTAL = SC_MENU.reduce((s, m) => s + m.netKwd, 0);
const SC_BY_SALES = [...SC_MENU].sort((a, b) => b.netKwd - a.netKwd);
const scFmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const SC_CATEGORY_AR: Record<string, string> = {
  Noodles: "النودلز",
  "Main Course": "الأطباق الرئيسية",
  Appetizers: "المقبلات",
  Rice: "الأرز",
  "2KD Keeta": "عروض 2 د.ك كيتا",
  "New Products": "منتجات جديدة",
  Sandwiches: "الساندويتشات",
  "Soups And Salads": "الشوربات والسلطات",
  Drinks: "المشروبات",
  Meals: "الوجبات",
  "Staff Meal Deal": "وجبات الموظفين",
  "EXB Menu 8 TAH EXPO": "منيو معرض طحينة",
  Sides: "الأطباق الجانبية",
  "Platters/Gathering": "صواني التجمعات",
  "Noodles & Rice": "النودلز والأرز",
  Beverage: "المشروبات",
  "Kids Meal": "وجبات الأطفال",
  Desserts: "الحلويات",
  "EXB Menu 2 CG - Camp": "منيو معرض تشاينا جاردن",
  Shawarma: "الشاورما",
  "Kids Menu": "قائمة الأطفال",
  "Extra Sauces": "صوصات إضافية",
  Croissant: "الكرواسون",
  Chapati: "الجباتي",
  Starters: "المقبلات",
  Wraps: "اللفائف",
};

const CATEGORIES_DATA = (() => {
  const m = new Map<string, { name: string; sales: number; orders: number; items: number }>();
  for (const it of SC_MENU) {
    const row = m.get(it.category) ?? { name: it.category, sales: 0, orders: 0, items: 0 };
    row.sales += it.netKwd;
    row.orders += it.qty;
    row.items += it.qty;
    m.set(it.category, row);
  }
  return [...m.values()]
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 14)
    .map((c) => ({ ...c, sales: Math.round(c.sales), share: Math.round((c.sales / SC_MENU_TOTAL) * 1000) / 10 }));
})();

const TOP_15_ITEMS = SC_BY_SALES.slice(0, 15).map((m) => ({
  name: m.name,
  brand: SC_BRAND_EN(m.brand),
  category: m.category,
  sales: m.netKwd,
  orders: m.qty,
  price: m.priceKwd,
}));

const SC_TOP80 = (() => {
  let acc = 0;
  let n = 0;
  for (const m of SC_BY_SALES) {
    if (acc >= SC_MENU_TOTAL * 0.8) break;
    acc += m.netKwd;
    n++;
  }
  return { n, sales: acc };
})();
const SC_AGG = CHANNELS.filter((c) => c.group === "aggregator");
const SC_AGG_SALES = SC_AGG.reduce((s, c) => s + c.sales, 0);
const SC_COMBO_SALES = SC_MENU.filter((m) => /meal|combo|platter|gathering|box/i.test(`${m.category} ${m.name}`)).reduce((s, m) => s + m.netKwd, 0);
const SC_KEETA = CHANNELS.find((c) => c.id === "keeta");
const SC_SNOONU = CHANNELS.find((c) => c.id === "snoonu");
const scPromoPct = (c?: { promo: number; itemSales: number }) => (c && c.itemSales ? (c.promo / c.itemSales) * 100 : 0);

const DIAGNOSTIC_BUCKETS = [
  {
    label: `Core revenue drivers (Top ${SC_TOP80.n} items)`,
    labelAr: `محركات الإيراد الأساسية (أعلى ${SC_TOP80.n} صنفاً)`,
    value: Math.round(SC_TOP80.sales),
    pct: Math.round((SC_TOP80.sales / SC_MENU_TOTAL) * 1000) / 10,
    color: "#0EA5E9",
    badge: "Hero core",
    rule: `${SC_TOP80.n} of ${SC_MENU.length} Odoo items generate 80% of item sales. Protect recipe spec & prep availability.`,
    ruleAr: `${SC_TOP80.n} صنفاً من أصل ${SC_MENU.length} في أودو تحقق 80% من مبيعات الأصناف. احمِ مواصفات الوصفة وتوافر التحضير.`,
  },
  {
    label: "Aggregator channel sales",
    labelAr: "مبيعات قنوات التوصيل",
    value: Math.round(SC_AGG_SALES),
    pct: Math.round((SC_AGG_SALES / LEDGER.netSales) * 1000) / 10,
    color: "#14B8A6",
    badge: "Upsell gap",
    rule: `${SC_AGG.length} aggregator channels carry ${scFmt((SC_AGG_SALES / LEDGER.netSales) * 100, 1)}% of Odoo net sales. Add a mandatory drink step in delivery combos.`,
    ruleAr: `${SC_AGG.length} قنوات توصيل تحمل ${scFmt((SC_AGG_SALES / LEDGER.netSales) * 100, 1)}% من صافي مبيعات أودو. أضف خطوة المشروب الإلزامي في وجبات التوصيل.`,
  },
  {
    label: "Odoo COGS (posted)",
    labelAr: "تكلفة الأغذية في أودو (مرحّلة)",
    value: Math.round(LEDGER.cogs),
    pct: LEDGER.cogsPct,
    color: "#F97316",
    badge: `COGS vs ${LEDGER.cogsTargetPct}%`,
    rule: `Posted COGS is ${LEDGER.cogsPct}% of revenue (KWD ${scFmt(LEDGER.cogs, 3)}) against the ${LEDGER.cogsTargetPct}% target. Enforce batch weight logs.`,
    ruleAr: `تكلفة الأغذية المرحّلة ${LEDGER.cogsPct}% من الإيراد (${scFmt(LEDGER.cogs, 3)} د.ك) مقابل المستهدف ${LEDGER.cogsTargetPct}%. فعّل سجلات أوزان الدفعات.`,
  },
  {
    label: "Meals, combos & platters",
    labelAr: "الوجبات والكومبو والصواني",
    value: Math.round(SC_COMBO_SALES),
    pct: Math.round((SC_COMBO_SALES / SC_MENU_TOTAL) * 1000) / 10,
    color: "#16A34A",
    badge: "Expand combo",
    rule: `Bundled items sell KWD ${scFmt(SC_COMBO_SALES)} in Odoo. Replicate the best-selling bundles across brands.`,
    ruleAr: `الأصناف المجمّعة تبيع ${scFmt(SC_COMBO_SALES)} د.ك في أودو. كرر أفضل الوجبات المجمّعة عبر العلامات.`,
  },
  {
    label: "Discounts & promotions",
    labelAr: "الخصومات والعروض",
    value: Math.round(LEDGER.discounts),
    pct: LEDGER.discountsPct,
    color: "#EC4899",
    badge: "Cap promo",
    rule: `Keeta promotions run at ${scFmt(scPromoPct(SC_KEETA), 1)}% and Snoonu at ${scFmt(scPromoPct(SC_SNOONU), 1)}% of item sales vs ${LEDGER.discountsPct}% group (KWD ${scFmt(LEDGER.discounts, 3)} total). Shift to meal bundles.`,
    ruleAr: `عروض كيتا عند ${scFmt(scPromoPct(SC_KEETA), 1)}% وسنونو عند ${scFmt(scPromoPct(SC_SNOONU), 1)}% من مبيعات الأصناف مقابل ${LEDGER.discountsPct}% للمجموعة (${scFmt(LEDGER.discounts, 3)} د.ك إجمالاً). حوّلها إلى وجبات مجمّعة.`,
  },
  {
    label: "Maintenance custody (management estimate)",
    labelAr: "عهدة الصيانة (تقدير إداري)",
    value: Math.round(LEDGER.maintCustody),
    pct: Math.round((LEDGER.maintCustody / LEDGER.opex) * 1000) / 10,
    color: "#EAB308",
    badge: "CapEx replace",
    rule: `KWD ${scFmt(LEDGER.maintCustody, 3)} across ${LEDGER.maintEntries} custody entries at Al-Kout Mall & Salmiya. A chiller overhaul saves KWD ${LEDGER.chillerRecovery}/month.`,
    ruleAr: `${scFmt(LEDGER.maintCustody, 3)} د.ك عبر ${LEDGER.maintEntries} قيد عهدة في مجمع الكوت والسالمية. تجديد المبردات يوفر ${LEDGER.chillerRecovery} د.ك شهرياً.`,
  },
].map((b) => ({
  ...b,
  badgeColor:
    b.color === "#F97316" ? "border-orange-500 text-orange-800 bg-orange-50"
    : b.color === "#EC4899" ? "border-pink-500 text-pink-700 bg-pink-50"
    : b.color === "#EAB308" ? "border-amber-600 text-amber-800 bg-amber-50"
    : b.color === "#16A34A" ? "border-green-600 text-green-800 bg-green-50"
    : b.color === "#14B8A6" ? "border-teal-600 text-teal-800 bg-teal-50"
    : "border-sky-200 text-sky-800 bg-sky-50",
}));

const SC_QUADRANT_BADGE = {
  star: { en: "Protect star", ar: "حماية الصنف النجم", style: "border-emerald-600 text-emerald-800 bg-emerald-50" },
  plowhorse: { en: "Re-price +5%", ar: "رفع السعر 5%", style: "border-amber-600 text-amber-800 bg-amber-50" },
  puzzle: { en: "Promote", ar: "ترويج", style: "border-sky-600 text-sky-800 bg-sky-50" },
  dog: { en: "Review / purge", ar: "مراجعة أو استبعاد", style: "border-rose-600 text-rose-800 bg-rose-50" },
} as const;

const ITEM_DIAGNOSTICS_TABLE_1 = (() => {
  const rows: (typeof SC_MENU)[number][] = [];
  for (const b of BRANDS) {
    const items = SC_BY_SALES.filter((m) => m.brand === b.id);
    rows.push(...items.slice(0, b.id === "china-garden" ? 3 : 1));
  }
  return rows.map((m) => {
    const brand = BRANDS.find((b) => b.id === m.brand)!;
    const mi = MENU_ITEMS.find((x) => x.brand === m.brand && x.en === m.name);
    const quadrant = mi?.quadrant ?? "puzzle";
    const qb = SC_QUADRANT_BADGE[quadrant];
    const priceVsAov = brand.aov ? (m.priceKwd / brand.aov) * 100 : 0;
    const note = `${scFmt(m.qty)} units at KWD ${scFmt(m.priceKwd, 3)} (${scFmt(priceVsAov, 0)}% of the ${brand.en} basket of KWD ${scFmt(brand.aov, 3)}); ${scFmt((m.netKwd / SC_MENU_TOTAL) * 100, 1)}% of group item sales.`;
    const noteAr = `${scFmt(m.qty)} وحدة بسعر ${scFmt(m.priceKwd, 3)} د.ك (${scFmt(priceVsAov, 0)}% من متوسط سلة ${brand.ar} البالغ ${scFmt(brand.aov, 3)} د.ك)؛ ${scFmt((m.netKwd / SC_MENU_TOTAL) * 100, 1)}% من مبيعات أصناف المجموعة.`;
    return {
      brand: brand.en,
      item: m.name,
      category: m.category,
      orders: m.qty as number,
      sales: m.netKwd as number,
      avgPrice: m.priceKwd as number,
      sharePct: Math.round((m.netKwd / SC_MENU_TOTAL) * 1000) / 10,
      badge: qb.en,
      badgeAr: qb.ar,
      badgeStyle: qb.style,
      note,
      noteAr,
    };
  });
})();

// Operational & Odoo financial action table
const SC_TGO = ODOO.channels.find((c) => c.id === "talabat-tgo");
const SC_KEETA_ODOO = ODOO.channels.find((c) => c.id === "keeta");
const SC_CK = ODOO.pnl.sharedCosts.centralKitchen;
const SC_TAIL_COUNT = Math.max(0, SC_MENU.length - SC_TOP80.n);
const SC_TAIL_SALES = Math.max(0, SC_MENU_TOTAL - SC_TOP80.sales);
const ODOO_OPERATIONAL_TABLE_2: {
  sector: string; sectorAr: string; account: string; accountAr: string; module: string; moduleAr: string;
  entries: number | null; amountKwd: number; variancePct: string; variancePctAr: string;
  badge: string; badgeAr: string; badgeStyle: string; action: string; actionAr: string; channelKey?: string;
}[] = [
  {
    sector: "Central Kitchen (shared cost centre)",
    sectorAr: "المطبخ المركزي (مركز تكلفة مشترك)",
    account: "COGS, kitchen expenses & depreciation",
    accountAr: "تكلفة الأغذية ومصروفات المطبخ والإهلاك",
    module: "Odoo Analytic (Branches plan)",
    moduleAr: "أودو التحليلي (خطة الفروع)",
    entries: null,
    amountKwd: SC_CK.cogs + SC_CK.expense + SC_CK.depreciation,
    variancePct: `${LEDGER.cogsPct}% group COGS`,
    variancePctAr: `${LEDGER.cogsPct}% تكلفة المجموعة`,
    badge: "Tighten BOM",
    badgeAr: "ضبط قوائم المواد",
    badgeStyle: "border-amber-600 text-amber-800 bg-amber-50",
    action: `Group COGS is ${LEDGER.cogsPct}% vs ${LEDGER.cogsTargetPct}% target. Audit poultry marination yield at the central kitchen (estimated recovery KWD ${scFmt(LEDGER.cogsRecoverable)}/month).`,
    actionAr: `تكلفة المجموعة ${LEDGER.cogsPct}% مقابل المستهدف ${LEDGER.cogsTargetPct}%. راجع إنتاجية تتبيل الدواجن في المطبخ المركزي (وفر مقدّر ${scFmt(LEDGER.cogsRecoverable)} د.ك شهرياً).`,
  },
  {
    sector: "Maintenance · Al-Kout Mall & Salmiya",
    sectorAr: "الصيانة · مجمع الكوت والسالمية",
    account: "Custody & maintenance (management estimate)",
    accountAr: "العهد والصيانة (تقدير إداري)",
    module: "Odoo Petty Cash",
    moduleAr: "العهد النثرية في أودو",
    entries: LEDGER.maintEntries,
    amountKwd: LEDGER.maintCustody,
    variancePct: "High freq",
    variancePctAr: "تكرار مرتفع",
    badge: "Replace chillers",
    badgeAr: "استبدال المبردات",
    badgeStyle: "border-rose-600 text-rose-800 bg-rose-50",
    action: `Repeated compressor & thermostat calls at Al-Kout Mall and Salmiya. Cap repair petty cash and execute the chiller overhaul (+KWD ${LEDGER.chillerRecovery}/month).`,
    actionAr: `بلاغات متكررة للضواغط والثرموستات في مجمع الكوت والسالمية. ضع سقفاً للعهدة ونفّذ تجديد المبردات (+${LEDGER.chillerRecovery} د.ك شهرياً).`,
  },
  {
    sector: `Aggregator Clearing · ${SC_KEETA_ODOO?.odooName ?? "Keeta"}`,
    sectorAr: "مقاصة المنصات · كيتا",
    account: "Keeta settlement & promotions",
    accountAr: "تسويات وعروض كيتا",
    module: "Odoo POS payments",
    moduleAr: "مدفوعات نقاط بيع أودو",
    entries: SC_KEETA_ODOO?.orders ?? 0,
    amountKwd: SC_KEETA_ODOO?.netKwd ?? 0,
    variancePct: `${scFmt(scPromoPct(SC_KEETA), 1)}% promo`,
    variancePctAr: `${scFmt(scPromoPct(SC_KEETA), 1)}% عروض`,
    badge: "Rebalance promo",
    badgeAr: "إعادة موازنة العروض",
    badgeStyle: "border-pink-600 text-pink-800 bg-pink-50",
    action: `Keeta promotions are KWD ${scFmt(LEDGER.keetaDiscounts, 3)} of KWD ${scFmt(LEDGER.discounts, 3)} total discounts. A ${LEDGER.keetaCapPct}% cap recovers KWD ${scFmt(LEDGER.keetaRecovery)}/month.`,
    actionAr: `عروض كيتا ${scFmt(LEDGER.keetaDiscounts, 3)} د.ك من أصل ${scFmt(LEDGER.discounts, 3)} د.ك إجمالي الخصومات. سقف ${LEDGER.keetaCapPct}% يسترد ${scFmt(LEDGER.keetaRecovery)} د.ك شهرياً.`,
    channelKey: SC_KEETA_ODOO?.odooName,
  },
  {
    sector: `Aggregator Clearing · ${SC_TGO?.odooName ?? "Talabat Go"}`,
    sectorAr: "مقاصة المنصات · طلبات جو",
    account: "Talabat Go receivables",
    accountAr: "ذمم طلبات جو",
    module: "Odoo POS payments",
    moduleAr: "مدفوعات نقاط بيع أودو",
    entries: SC_TGO?.orders ?? 0,
    amountKwd: SC_TGO?.netKwd ?? 0,
    variancePct: `${scFmt(SC_TGO?.sharePct ?? 0, 1)}% share`,
    variancePctAr: `${scFmt(SC_TGO?.sharePct ?? 0, 1)}% حصة`,
    badge: "Settlement check",
    badgeAr: "مطابقة التسوية",
    badgeStyle: "border-emerald-600 text-emerald-800 bg-emerald-50",
    action: `${scFmt(SC_TGO?.orders ?? 0)} Talabat Go payments at KWD ${scFmt(SC_TGO && SC_TGO.orders ? SC_TGO.netKwd / SC_TGO.orders : 0, 3)} average. Match against the Talabat statement and push the beverage add-on.`,
    actionAr: `${scFmt(SC_TGO?.orders ?? 0)} دفعة طلبات جو بمتوسط ${scFmt(SC_TGO && SC_TGO.orders ? SC_TGO.netKwd / SC_TGO.orders : 0, 3)} د.ك. طابقها مع كشف طلبات وادفع بإضافة المشروب.`,
    channelKey: SC_TGO?.odooName,
  },
  {
    sector: "Operating Expenses",
    sectorAr: "المصروفات التشغيلية",
    account: "General & location opex (posted)",
    accountAr: "المصروفات العامة ومصروفات المواقع (مرحّلة)",
    module: "Odoo General Ledger",
    moduleAr: "دفتر الأستاذ العام في أودو",
    entries: null,
    amountKwd: LEDGER.opex,
    variancePct: `${LEDGER.opexPct}% rev`,
    variancePctAr: `${LEDGER.opexPct}% من الإيراد`,
    badge: "Posted",
    badgeAr: "مرحّل",
    badgeStyle: "border-emerald-600 text-emerald-800 bg-emerald-50",
    action: `Whitelisted net operating profit is KWD ${scFmt(LEDGER.netProfit, 3)} (${LEDGER.marginPct}% margin) after KWD ${scFmt(LEDGER.depreciation, 3)} depreciation.`,
    actionAr: `صافي الربح التشغيلي للمواقع المعتمدة ${scFmt(LEDGER.netProfit, 3)} د.ك (هامش ${LEDGER.marginPct}%) بعد إهلاك ${scFmt(LEDGER.depreciation, 3)} د.ك.`,
  },
  {
    sector: `Menu Tail · All ${BRANDS.length} Brands`,
    sectorAr: `ذيل المنيو · العلامات الـ ${BRANDS.length}`,
    account: `Bottom ${SC_TAIL_COUNT} menu items`,
    accountAr: `أدنى ${SC_TAIL_COUNT} صنفاً في المنيو`,
    module: "Odoo POS Items",
    moduleAr: "أصناف نقاط بيع أودو",
    entries: SC_TAIL_COUNT,
    amountKwd: SC_TAIL_SALES,
    variancePct: `${scFmt((SC_TAIL_SALES / SC_MENU_TOTAL) * 100, 1)}% sales`,
    variancePctAr: `${scFmt((SC_TAIL_SALES / SC_MENU_TOTAL) * 100, 1)}% من المبيعات`,
    badge: `Purge ${LEDGER.menuDogsPurge} · re-price ${LEDGER.menuPlowhorsesReprice}`,
    badgeAr: `استبعاد ${LEDGER.menuDogsPurge} · تسعير ${LEDGER.menuPlowhorsesReprice}`,
    badgeStyle: "border-slate-500 text-slate-800 bg-slate-50",
    action: `${SC_TAIL_COUNT} items generate only ${scFmt((SC_TAIL_SALES / SC_MENU_TOTAL) * 100, 1)}% of item sales while adding prep complexity. Purge the ${LEDGER.menuDogsPurge} weakest Dogs and re-price ${LEDGER.menuPlowhorsesReprice} Plowhorses by +5% (+KWD ${LEDGER.menuMatrixGain}/month).`,
    actionAr: `${SC_TAIL_COUNT} صنفاً تحقق ${scFmt((SC_TAIL_SALES / SC_MENU_TOTAL) * 100, 1)}% فقط من مبيعات الأصناف مع زيادة تعقيد التحضير. استبعد أضعف ${LEDGER.menuDogsPurge} صنفاً وارفع أسعار ${LEDGER.menuPlowhorsesReprice} أصناف بنسبة 5% (+${LEDGER.menuMatrixGain} د.ك شهرياً).`,
  },
];

// Lowest-rotation Odoo items (pruning candidates); recipe cost is not readable, so the group COGS % is shown.
const LOW_VOLUME_TAIL_ITEMS = [...SC_MENU]
  .sort((a, b) => a.qty - b.qty || a.netKwd - b.netKwd)
  .slice(0, 10)
  .map((m) => ({ brand: SC_BRAND_EN(m.brand), category: m.category, item: m.name, orders: m.qty as number, sales: m.netKwd as number, avgPrice: m.priceKwd as number, cogs: `${LEDGER.cogsPct}%*` }));

registerAnalyticsAr({
  ...Object.fromEntries(Object.entries(SC_CATEGORY_AR)),
  ...Object.fromEntries(DIAGNOSTIC_BUCKETS.flatMap((b) => [[b.label, b.labelAr], [b.rule, b.ruleAr]])),
  ...Object.fromEntries(ITEM_DIAGNOSTICS_TABLE_1.flatMap((r) => [[r.badge, r.badgeAr], [r.note, r.noteAr]])),
  ...Object.fromEntries(ODOO_OPERATIONAL_TABLE_2.flatMap((r) => [[r.sector, r.sectorAr], [r.account, r.accountAr], [r.module, r.moduleAr], [r.variancePct, r.variancePctAr], [r.badge, r.badgeAr], [r.action, r.actionAr]])),
  "Hero core": "النواة الأساسية",
  "Upsell gap": "فجوة البيع الإضافي",
  "Expand combo": "توسيع الكومبو",
  "Cap promo": "سقف العروض",
  "CapEx replace": "استبدال رأسمالي",
  [`COGS vs ${LEDGER.cogsTargetPct}%`]: `التكلفة مقابل ${LEDGER.cogsTargetPct}%`,
});

interface PoolItem { name: string; brand: string; category: string; sales: number; orders: number; price: number }
// Every Odoo menu item with a brand, de-duplicated by brand + name.
const ITEM_POOL: PoolItem[] = (() => {
  const m = new Map<string, PoolItem>();
  const add = (it: PoolItem) => {
    const k = it.brand + "|" + it.name.toLowerCase();
    const old = m.get(k);
    if (!old || it.sales > old.sales) m.set(k, it);
  };
  SC_MENU.forEach((i) => add({ name: i.name, brand: SC_BRAND_EN(i.brand), category: i.category, sales: i.netKwd, orders: i.qty, price: i.priceKwd }));
  TOP_BEST_SELLERS.forEach((i) => add({ name: i.nameEn, brand: String(i.brand), category: i.categoryEn, sales: i.salesKwd, orders: i.unitsSold, price: i.priceKwd }));
  return [...m.values()];
})();

// Brand × channel matrix: exact Odoo brand × channel sales and orders; top item and drink attach are brand-level Odoo figures.
const CHANNEL_BRAND_MATRIX = ODOO.brandChannel
  .filter((c) => c.netKwd > 0 && BRANDS.some((b) => b.id === c.brand))
  .map((c) => {
    const ch = ODOO.channels.find((x) => x.id === c.channel);
    const ob = ODOO.brands.find((b) => b.id === c.brand);
    const top = SC_BY_SALES.find((m) => m.brand === c.brand);
    return {
      brand: SC_BRAND_EN(c.brand),
      channel: ch?.odooName ?? c.channel,
      topItem: top?.name ?? "—",
      orders: c.orders as number,
      sales: c.netKwd as number,
      aov: c.orders ? c.netKwd / c.orders : 0,
      drinkPct: `${scFmt(ob?.drinksPct ?? 0, 1)}%`,
    };
  })
  .sort((a, b) => b.sales - a.sales);

// ==========================================
// 2. MAIN COMPONENT (HIGH-DENSITY TUFTE BI)
// ==========================================

function ScorecardInner() {
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const tab = parseSalesTab(searchParams.get("tab"));
  const isAr = locale === "ar";
  const tr = useMemo(() => makeTr(locale), [locale]);
  const money = (n: number, d = 0) => {
    const v = n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    return isAr ? `${v} د.ك` : `KWD ${v}`;
  };
  const brandTip = (b: BrandRow) => [
    `${tr("Net sales")}: ${money(b.netSales, 2)}`,
    `${tr("Orders")}: ${b.orders.toLocaleString("en-US")}`,
    `${tr("Avg order")}: ${money(b.avgOrder, 2)}`,
    `${tr("Items / order")}: ${b.itemsPerOrder.toFixed(2)}`,
    `${tr("Share of group")}: ${b.share.toFixed(1)}%`,
  ];
  const channelTip = (c: ChannelRow) => [
    `${tr("Net sales")}: ${money(c.netSales, 2)}`,
    `${tr("Orders")}: ${c.orders.toLocaleString("en-US")}`,
    `${tr("Avg order")}: ${money(c.avgOrder, 2)}`,
    `${tr("Share of group")}: ${c.share.toFixed(1)}%`,
    `${tr("Discount rate")}: ${c.discountRate.toFixed(1)}%`,
    `${tr("Drinks %")}: ${c.drinksPct.toFixed(1)}%`,
  ];
  const [selectedBrand, setSelectedBrand] = useState<string>("All brands");
  const [selectedBranch, setSelectedBranch] = useState<string>("All branches");
  const [selectedChannel, setSelectedChannel] = useState<string>("All channels");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("month");

  const brandsList = useMemo(() => BRANDS_DATA.map((b) => b.brand), []);
  const channelsList = useMemo(() => CHANNELS_DATA.map((c) => c.channel), []);

  // One model for every tab: brand rows, channel rows, branch scaling, and period multiplier
  const filter: SalesFilter = useMemo(
    () => ({
      brand: selectedBrand,
      channel: selectedChannel,
      branch: selectedBranch,
      period: selectedPeriod,
    }),
    [selectedBrand, selectedChannel, selectedBranch, selectedPeriod]
  );
  const view = useMemo(() => computeView(filter), [filter]);
  const vBrands = view.brands;
  const vChannels = view.channels;
  const kpis = {
    netSales: view.net,
    orders: view.orders,
    avgOrder: view.avgOrder,
    itemsSold: view.items,
    itemsPerOrder: view.itemsPerOrder,
    discounts: view.discounts,
    sharePct: view.ratioNet * 100,
  };
  const dimBrand = (name: string) => (selectedBrand !== ALL_BRANDS && selectedBrand !== name ? "opacity-40" : "");
  const dimChannel = (name: string) => (selectedChannel !== ALL_CHANNELS && selectedChannel !== name ? "opacity-40" : "");
  const hiRow = (on: boolean, dim: boolean) => (on ? "bg-sky-50/70 dark:bg-sky-950/40 font-semibold" : dim ? "opacity-50" : "");

  // Products tab scaling
  const brandSel = selectedBrand !== ALL_BRANDS && selectedBrand !== "All brands";
  const pFactor = selectedPeriod === "day" ? 1 / 31 : selectedPeriod === "year" ? 12 : 1;
  const scaleItem = <T extends { sales: number; orders: number }>(i: T): T => {
    if (view.orders === 0 || view.net === 0) {
      return { ...i, sales: 0, orders: 0 };
    }
    const scaledNet = i.sales * (view.net / (brandSel ? (BRANDS_DATA.find((b) => b.brand === selectedBrand)?.netSales ?? TOTAL_NET) : TOTAL_NET));
    const scaledOrd = Math.max(1, Math.round(i.orders * pFactor));
    return {
      ...i,
      sales: scaledNet,
      orders: scaledOrd,
    };
  };
  const poolBrandItems = brandSel ? ITEM_POOL.filter((i) => i.brand === selectedBrand).sort((x, y) => y.sales - x.sales) : [];
  const topItems = (brandSel ? poolBrandItems.slice(0, 15) : TOP_15_ITEMS).map(scaleItem);
  const categoryRows = (() => {
    if (!brandSel) return CATEGORIES_DATA.map((c) => ({ name: c.name, sales: c.sales * pFactor }));
    const m = new Map<string, number>();
    poolBrandItems.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + i.sales));
    return [...m.entries()].map(([name, sales]) => ({ name, sales: sales * pFactor })).sort((x, y) => y.sales - x.sales);
  })();
  const diagBuckets = DIAGNOSTIC_BUCKETS.map((d) => ({ ...d, value: d.value * pFactor }));
  const diagRows = ITEM_DIAGNOSTICS_TABLE_1.filter((r) => !brandSel || r.brand === selectedBrand).map((r) => {
    const orders = r.orders === 0 ? 0 : selectedPeriod === "day" ? Math.max(1, Math.round(r.orders / 31)) : Math.round(r.orders * pFactor);
    const sales = r.sales * pFactor;
    return {
      ...r,
      orders,
      sales,
    };
  });
  const tailRows = LOW_VOLUME_TAIL_ITEMS.filter((r) => !brandSel || r.brand === selectedBrand).map((r) => {
    const orders = r.orders === 0 ? 0 : selectedPeriod === "day" ? Math.max(1, Math.round(r.orders / 31)) : Math.round(r.orders * pFactor);
    const sales = r.sales * pFactor;
    return {
      ...r,
      orders,
      sales,
    };
  });
  const matrixRows = CHANNEL_BRAND_MATRIX.filter(
    (r) =>
      (!brandSel || r.brand === selectedBrand) &&
      (selectedChannel === ALL_CHANNELS || selectedChannel === "All channels" || r.channel === selectedChannel)
  ).map((r) => {
    const orders = r.orders === 0 ? 0 : selectedPeriod === "day" ? Math.max(1, Math.round(r.orders / 31)) : Math.round(r.orders * pFactor);
    const sales = r.sales * pFactor;
    return {
      ...r,
      orders,
      sales,
      aov: orders > 0 ? sales / orders : r.aov,
    };
  });
  const bestItem = brandSel ? poolBrandItems[0] : undefined;
  const bestName = bestItem ? bestItem.name : "Chicken Noodles";
  const branchObj = VENTURE_BRANCHES.find((b) => b.id === selectedBranch);
  const scopeLabel = [
    selectedBrand !== "All brands" && selectedBrand !== ALL_BRANDS ? tr(selectedBrand) : isAr ? "كل العلامات" : "All brands",
    selectedBranch !== "All branches" && selectedBranch !== "ALL" ? (isAr ? branchObj?.nameAr : branchObj?.nameEn) : null,
    selectedChannel !== "All channels" && selectedChannel !== ALL_CHANNELS ? tr(selectedChannel) : isAr ? "كل القنوات" : "All channels",
    selectedPeriod === "day" ? (isAr ? "اليومي" : "Daily") : selectedPeriod === "year" ? (isAr ? "السنة" : "Yearly") : null,
  ].filter(Boolean).join(" · ");

  const biggestChannel = [...vChannels].sort((x, y) => y.netSales - x.netSales)[0];
  const opRows = ODOO_OPERATIONAL_TABLE_2
    .filter((r) => !r.channelKey || selectedChannel === ALL_CHANNELS || selectedChannel === "All channels" || r.channelKey === selectedChannel)
    .map((r) => {
      const ch = r.channelKey ? vChannels.find((c) => c.channel === r.channelKey) : undefined;
      if (ch) return { ...r, entries: ch.orders as number | null, amountKwd: ch.netSales };
      return { ...r, entries: r.entries == null ? null : Math.round(r.entries * view.ratioOrders), amountKwd: r.amountKwd * view.ratioNet };
    });

  // Max values for proportional bar widths
  const maxBrandSales = Math.max(1, ...vBrands.map((b) => b.netSales));
  const maxBrandAov = Math.max(1, ...vBrands.map((b) => b.avgOrder));
  const maxChannelSales = Math.max(1, ...vChannels.map((c) => c.netSales));
  const maxChannelAov = Math.max(1, ...vChannels.map((c) => c.avgOrder));
  const maxCatSales = Math.max(1, ...categoryRows.map((c) => c.sales));
  const maxItemSales = Math.max(1, ...topItems.map((i) => i.sales));
  const maxDiagValue = Math.max(1, ...diagBuckets.map((d) => d.value));

  const isFiltered = view.isFiltered;
  const chLabel = (ch: string) => {
    if (ch === "Talabat Go") return isAr ? tr("Talabat Go") : "Talabat Go (Tgo)";
    if (ch === "Talabat MP" || ch === "Talabat TMP") return isAr ? tr("Talabat TMP") : "Talabat TMP (TMP)";
    if (ch === "Deliveroo MP" || ch === "Deliveroo TMP") return isAr ? tr("Deliveroo TMP") : "Deliveroo TMP (TMP)";
    return tr(ch);
  };
  const channelViews = vChannels.map((c) => ({
    key: c.channel,
    label: chLabel(c.channel),
    orders: c.orders,
    sales: c.netSales,
    discPct: c.discountRate,
    drinksPct: c.drinksPct,
  }));
  const promoChannels = vChannels.map((c) => ({ key: c.channel, label: chLabel(c.channel), sales: c.netSales, discPct: c.discountRate, kwd: c.discountKwd }));
  const promoBrands = vBrands.map((b) => ({ key: b.brand, label: tr(b.brand), discPct: b.discountRate }));

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      lang={locale}
      className="w-full font-sans antialiased text-slate-900 dark:text-slate-100"
      style={{ fontFamily: isAr ? "'IBM Plex Sans Arabic', Cairo, Inter, system-ui, sans-serif" : "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      <div className="ae-stagger w-full min-w-0 space-y-6">
        {/* ==========================================
            HEADER & GLOBAL CROSS-FILTERS
           ========================================== */}
        <header className="ae-masthead space-y-4 p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
            <span>{isAr ? `أودو مباشر · آخر مزامنة ${LEDGER.syncedAt.slice(0, 10)} · شركة فنتشر فودز ذ.م.م` : `Live Odoo · last sync ${LEDGER.syncedAt.slice(0, 10)} · Venture Foods Co. W.L.L.`}</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span> {isAr ? `قائمة الدخل في أودو: صافي الربح ${scFmt(LEDGER.netProfit, 3)} د.ك (${LEDGER.marginPct}%)` : `Odoo P&L: KWD ${scFmt(LEDGER.netProfit, 3)} Net Profit (${LEDGER.marginPct}%)`} </span>
              {(selectedBrand !== "All brands" || selectedChannel !== "All channels" || selectedBranch !== "All branches" || selectedPeriod !== "month") && (
                <button
                  onClick={() => {
                    setSelectedBrand("All brands");
                    setSelectedBranch("All branches");
                    setSelectedChannel("All channels");
                    setSelectedPeriod("month");
                  }}
                  className="ae-pill-light ae-pill-sm"
                >
                  {tr("Reset filters")}
                </button>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              {selectedPeriod === "day"
                ? isAr ? "المعدل اليومي لمبيعات العلامات التجارية · أكتوبر 2026" : "Daily Average Brand Sales · October 2026"
                : selectedPeriod === "year"
                ? isAr ? "التقدير السنوي التراكمي لمبيعات العلامات التجارية · 2026" : "Annual Projected Brand Sales · 2026"
                : tr("Brand sales · October 2026")}
            </h1>
            <p className="text-[13px] md:text-sm font-medium text-slate-700 mt-1 max-w-3xl leading-relaxed">
              {isAr ? (
                <>
                  {tr(selectedBrand)}
                  {selectedBranch !== "All branches" && selectedBranch !== "ALL" ? ` في ${branchObj?.nameAr}` : ""} في {chLabel(selectedChannel)} حققت صافي{" "}
                  <strong className="font-bold text-slate-900">
                    <span dir="ltr" className="inline-block tabular-nums">{money(kpis.netSales)}</span>
                  </strong>{" "}
                  {selectedPeriod === "day" ? "كمعدل يومي" : selectedPeriod === "year" ? "كتوقع سنوي" : "في أكتوبر"} من{" "}
                  <strong className="font-bold text-slate-900">
                    <span dir="ltr" className="inline-block tabular-nums">{kpis.orders.toLocaleString()}</span>
                  </strong>{" "}
                  طلب. الصنف الأعلى مبيعاً هو{" "}
                  <strong className="font-bold text-slate-900">{bestName}</strong>.
                </>
              ) : (
                <>
                  {selectedBrand}
                  {selectedBranch !== "All branches" && selectedBranch !== "ALL" ? ` in ${branchObj?.nameEn}` : ""} in {chLabel(selectedChannel)} made{" "}
                  <strong className="font-bold text-slate-900">
                    {money(kpis.netSales)}
                  </strong>{" "}
                  net {selectedPeriod === "day" ? "per day (daily average)" : selectedPeriod === "year" ? "annual projection" : "in October"} from{" "}
                  <strong className="font-bold text-slate-900">
                    {kpis.orders.toLocaleString()}
                  </strong>{" "}
                  orders. The best seller was{" "}
                  <strong className="font-bold text-slate-900">{bestName}</strong>.
                </>
              )}
            </p>
          </div>

          {/* Top Analytics Filter Bar */}
          <div className="pt-2">
            <TopAnalyticsFilterBar
              lang={isAr ? "ar" : "en"}
              selectedBrand={selectedBrand}
              setSelectedBrand={setSelectedBrand}
              selectedBranch={selectedBranch}
              setSelectedBranch={setSelectedBranch}
              selectedChannel={selectedChannel}
              setSelectedChannel={setSelectedChannel}
              selectedPeriod={selectedPeriod}
              setSelectedPeriod={setSelectedPeriod}
              brandsList={brandsList}
              channelsList={channelsList}
            />
          </div>
        </header>

        <nav aria-label={isAr ? "أقسام تحليل المبيعات" : "Sales analysis sections"} className="ae-tabs">
          {SALES_TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Link
                key={t.id}
                href={salesTabHref(t.id)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : "false"}
              >
                {isAr ? t.ar : t.en}
              </Link>
            );
          })}
        </nav>

        {tab === "core-sales" && (
          <div className="space-y-6">
        {/* ==========================================
            ROW 1: 6 KPI CARDS
           ========================================== */}
        <section className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 items-stretch">
          <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
            <div className="text-xs font-semibold text-slate-600">{tr("Net sales · Oct 2026")}</div>
            <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums break-words leading-tight">
              {money(kpis.netSales)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{tr("After discounts, KWD")}</div>
            <Spark series="sales" />
          </div>

          <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
            <div className="text-xs font-semibold text-slate-600">{tr("Orders")}</div>
            <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums break-words leading-tight">
              {kpis.orders.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{tr("Distinct orders")}</div>
            <Spark series="orders" />
          </div>

          <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
            <div className="text-xs font-semibold text-slate-600">{tr("Average order value")}</div>
            <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums break-words leading-tight">
              {money(kpis.avgOrder, 3)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{tr("Net sales ÷ orders")}</div>
            <Spark series="aov" />
          </div>

          <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
            <div className="text-xs font-semibold text-slate-600">{tr("Items sold")}</div>
            <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums break-words leading-tight">
              {kpis.itemsSold.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              {kpis.itemsPerOrder.toFixed(2)} {tr("items per order")}
            </div>
          </div>

          <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
            <div className="text-xs font-semibold text-slate-600">{tr("Discounts given")}</div>
            <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums break-words leading-tight">
              {money(kpis.discounts)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{tr("2.4% of gross sales")}</div>
          </div>

          <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
            <div className="text-xs font-semibold text-slate-600">{tr("Net operating profit")}</div>
            <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-emerald-700 mt-1 break-words leading-tight">
              <span dir="ltr" className="inline-block tabular-nums">{isFiltered ? "—" : money(LEDGER.netProfit, 3)}</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{isFiltered ? tr("Available for the whole group only") : isAr ? `هامش صافي ${LEDGER.marginPct}%` : `${LEDGER.marginPct}% net margin`}</div>
          </div>
        </section>

        {/* ==========================================
            ROW 2: HIGHLIGHTS (4 EDITORIAL CARDS)
           ========================================== */}
        <section className="space-y-2">
          <div className="text-[15px] font-bold text-slate-900">
            {tr("Highlights")} <span className="font-semibold text-slate-500 text-xs">· {scopeLabel}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="ae-tile-soft rounded-2xl p-4 min-w-0">
              <div className="text-xs font-semibold text-slate-500">{tr("Biggest channel")}</div>
              <div className="text-[13px] font-medium text-slate-800 mt-1">
                {isAr ? (<><strong className="font-bold text-slate-900">{chLabel(biggestChannel.channel)}</strong> هي أكبر قناة بيع بنسبة <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">{biggestChannel.share.toFixed(1)}%</span></strong> من المبيعات المحددة.</>) : (<><strong className="font-bold text-slate-900">{chLabel(biggestChannel.channel)}</strong> is the largest channel, with <strong className="font-bold text-slate-900">{biggestChannel.share.toFixed(1)}%</strong> of the selected sales.</>)}
              </div>
            </div>
            <div className="ae-tile-soft rounded-2xl p-4 min-w-0">
              <div className="text-xs font-semibold text-slate-500">{tr("Best seller")}</div>
              <div className="text-[13px] font-medium text-slate-800 mt-1">
                {bestItem ? (isAr ? (<><strong className="font-bold text-slate-900">{bestItem.name}</strong> هو أعلى أصناف <strong className="font-bold text-slate-900">{tr(bestItem.brand)}</strong> مبيعاً بقيمة <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">{money(bestItem.sales * view.ratioNet)}</span></strong>.</>) : (<><strong className="font-bold text-slate-900">{bestItem.name}</strong> is the top item of <strong className="font-bold text-slate-900">{bestItem.brand}</strong>, with <strong className="font-bold text-slate-900">{money(bestItem.sales * view.ratioNet)}</strong> in sales.</>)) : isAr ? (<><strong className="font-bold text-slate-900">Chicken Noodles</strong> من <strong className="font-bold text-slate-900">تشاينا جاردن</strong> باع <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">{money(12043 * view.ratioNet)}</span></strong> وتمثل <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">7.2%</span></strong> من مبيعات المنيو.</>) : (<><strong className="font-bold text-slate-900">Chicken Noodles</strong> from <strong className="font-bold text-slate-900">China Garden</strong> sold <strong className="font-bold text-slate-900">{money(12043 * view.ratioNet)}</strong>, which is <strong className="font-bold text-slate-900">7.2%</strong> of menu sales.</>)}
              </div>
            </div>
            <div className="ae-tile-soft rounded-2xl p-4 min-w-0">
              <div className="text-xs font-semibold text-slate-500">{tr("Menu concentration")}</div>
              <div className="text-[13px] font-medium text-slate-800 mt-1">
                {isAr ? (<>أعلى <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">32</span></strong> صنفاً من أصل <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">364</span></strong> صنفاً مباعاً تحقق <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">80%</span></strong> من مبيعات المنيو.</>) : (<>The top <strong className="font-bold text-slate-900">32</strong> of <strong className="font-bold text-slate-900">364</strong> items sold make <strong className="font-bold text-slate-900">80%</strong> of menu sales.</>)}
              </div>
            </div>
            <div className="ae-tile-soft rounded-2xl p-4 min-w-0">
              <div className="text-xs font-semibold text-slate-500">{tr("Add-ons per order")}</div>
              <div className="text-[13px] font-medium text-slate-800 mt-1">
                {isAr ? (<>المشروبات <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">25.3%</span></strong>، المقبلات والجوانب <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">32.7%</span></strong>، الحلويات <strong className="font-bold text-slate-900"><span dir="ltr" className="inline-block tabular-nums">3.2%</span></strong>. كل نسبة هي عدد سطور الأصناف من هذا النوع لكل 100 طلب.</>) : (<>Drinks <strong className="font-bold text-slate-900">25.3%</strong>, starters and sides <strong className="font-bold text-slate-900">32.7%</strong>, desserts <strong className="font-bold text-slate-900">3.2%</strong>. Each is item lines of that kind per 100 orders.</>)}
              </div>
            </div>
          </div>
        </section>


            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="lg:col-span-2"><DailyCurve ratio={view.ratioNet} /></div>
              <NeedsAttention />
            </div>
        {/* ==========================================
            SECTION 1: BRANDS (CHARTS + SCORECARD)
           ========================================== */}
        <section className="space-y-3">
          <div className="text-[15px] font-bold text-slate-900"> {tr("Brands")} <span className="font-semibold text-slate-500 text-xs">· {chLabel(selectedChannel)}</span>
          </div>

          {/* 2 Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Net sales by brand */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900">{tr("Net sales by brand")}</div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("KWD after discounts on the chosen channel. Click a bar to filter to that brand.")} </div>
              <div className="space-y-2">
                {vBrands.map((b) => {
                  const widthPct = Math.max(1.5, (b.netSales / maxBrandSales) * 100);
                  const isSelected = selectedBrand === "All brands" || selectedBrand === b.brand;
                  return (
                    <div
                      key={tr(b.brand)}
                      onClick={() =>
                        setSelectedBrand(selectedBrand === b.brand ? "All brands" : b.brand)
                      }
                      tabIndex={0}
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[125px_1fr_65px] items-center gap-2.5 text-[13px] cursor-pointer hover:opacity-100 focus:opacity-100 ${
                        isSelected ? "opacity-100" : "opacity-40"
                      }`}
                    >
                      <HoverTip title={tr(b.brand)} lines={brandTip(b)} />
                      <span className="text-end font-semibold text-slate-800 truncate">{tr(b.brand)}</span>
                      <div className="w-full bg-slate-100 h-4 flex items-center rounded-xs">
                        <div
                          className="h-4 bg-[#0284C7] transition-all rounded-xs"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-slate-900 font-bold tabular-nums text-xs">
                        {Math.round(b.netSales).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Average order value by brand */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900"> {tr("Average order value by brand")} </div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("KWD per order. Brands with fewer than 200 orders on this channel are greyed out.")} </div>
              <div className="space-y-2">
                {[...vBrands]
                  .sort((a, b) => b.avgOrder - a.avgOrder)
                  .map((b) => {
                    const widthPct = Math.max(2, (b.avgOrder / maxBrandAov) * 100);
                    const isLowSample = b.orders < 200;
                    return (
                      <div
                        key={tr(b.brand)}
                        onClick={() =>
                          setSelectedBrand(selectedBrand === b.brand ? "All brands" : b.brand)
                        }
                        tabIndex={0}
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[125px_1fr_55px] items-center gap-2.5 text-[13px] cursor-pointer hover:opacity-100 focus:opacity-100 ${dimBrand(b.brand)}`}
                      >
                        <HoverTip title={tr(b.brand)} lines={brandTip(b)} />
                      <span className="text-end font-semibold text-slate-800 truncate">{tr(b.brand)}</span>
                        <div className="w-full bg-slate-100 h-4 flex items-center rounded-xs">
                          <div
                            className={`h-4 transition-all rounded-xs ${
                              isLowSample ? "bg-[#9CA3AF]" : "bg-[#0284C7]"
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-slate-900 font-bold tabular-nums text-xs">
                          {b.avgOrder.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Brand scorecard table */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none ring-1 ring-slate-200/70 dark:ring-slate-800 p-4 md:p-5 overflow-x-auto ae-table-wrap min-w-0">
            <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{tr("Brand scorecard")}</div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {tr("Drinks and starters are item lines of that kind per order. Discount rate is discounts ÷ gross sales.")} </div>
            <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
              <thead className="bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="text-start py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Brand")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Orders")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap w-48">{tr("Net sales")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Share of group")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Avg order")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Items / order")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Discount rate")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Drinks")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Starters")}</th>
                  <th className="text-start py-3.5 ps-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Best seller")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {vBrands.map((b) => {
                  const barW = Math.max(2, (b.netSales / maxBrandSales) * 80);
                  return (
                    <tr
                      key={tr(b.brand)}
                      onClick={() =>
                        setSelectedBrand(selectedBrand === b.brand ? "All brands" : b.brand)
                      }
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer ${hiRow(selectedBrand === b.brand, selectedBrand !== ALL_BRANDS)}`}
                     >
                       <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{tr(b.brand)}</td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {b.orders.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="h-2.5 bg-[#0284C7] rounded-xs"
                            style={{ width: `${barW}px` }}
                          />
                          <span>
                            {b.netSales.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {b.share.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {b.avgOrder.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {b.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {b.discountRate.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {b.drinksPct.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {b.startersPct.toFixed(1)}%
                      </td>
                      <td className="py-3.5 ps-4 text-start font-medium text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                        {tr(b.bestSeller)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

          </div>
        )}

        {tab === "customer-channel" && (
          <div className="space-y-6">
        {/* ==========================================
            SECTION 2: CHANNELS (CHARTS + SCORECARD)
           ========================================== */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[15px] font-bold text-slate-900">
              {tr("Channels")} <span className="font-semibold text-slate-500 text-xs">· {tr(selectedBrand)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-900">
                <ChannelModeBadge channel="Talabat Go" />
                <span>{isAr ? "توصيل المنصة (طلبات Tgo)" : "Platform Delivery (Talabat Go)"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-sky-900">
                <ChannelModeBadge channel="Talabat MP" />
                <span>{isAr ? "توصيل المطعم (طلبات وديليفرو TMP)" : "Restaurant Delivery (Talabat TMP & Deliveroo TMP)"}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Net sales by channel */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900">{tr("Net sales by channel")}</div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("KWD after discounts for the chosen brand. Click a bar to filter to that channel.")} </div>
              <div className="space-y-2">
                {vChannels.map((c) => {
                  const widthPct = Math.max(1, (c.netSales / maxChannelSales) * 100);
                  return (
                    <div
                      key={c.channel}
                      onClick={() =>
                        setSelectedChannel(
                          selectedChannel === c.channel ? "All channels" : c.channel
                        )
                      }
                      tabIndex={0}
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[175px_1fr_65px] items-center gap-2.5 text-[13px] cursor-pointer hover:opacity-100 focus:opacity-100 ${dimChannel(c.channel)}`}
                    >
                      <HoverTip title={chLabel(c.channel)} lines={channelTip(c)} />
                      <span className="flex items-center justify-end gap-1.5 font-semibold text-slate-800 truncate">
                        <span className="truncate">{chLabel(c.channel)}</span>
                        <ChannelModeBadge channel={c.channel} />
                      </span>
                      <div className="w-full bg-slate-100 h-4 flex items-center rounded-xs">
                        <div
                          className="h-4 bg-[#0284C7] rounded-xs"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-slate-900 font-bold tabular-nums text-xs">
                        {Math.round(c.netSales).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Average order value by channel */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900"> {tr("Average order value by channel")} </div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("KWD per order. Channels with fewer than 200 orders are greyed out because their averages swing easily.")} </div>
              <div className="space-y-2">
                {[...vChannels]
                  .sort((a, b) => b.avgOrder - a.avgOrder)
                  .map((c) => {
                    const widthPct = Math.max(2, (c.avgOrder / maxChannelAov) * 100);
                    const isLowSample = c.orders < 200;
                    return (
                      <div
                        key={c.channel}
                        onClick={() =>
                          setSelectedChannel(
                            selectedChannel === c.channel ? "All channels" : c.channel
                          )
                        }
                        tabIndex={0}
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[175px_1fr_55px] items-center gap-2.5 text-[13px] cursor-pointer hover:opacity-100 focus:opacity-100 ${dimChannel(c.channel)}`}
                      >
                        <HoverTip title={chLabel(c.channel)} lines={channelTip(c)} />
                      <span className="flex items-center justify-end gap-1.5 font-semibold text-slate-800 truncate">
                        <span className="truncate">{chLabel(c.channel)}</span>
                        <ChannelModeBadge channel={c.channel} />
                      </span>
                        <div className="w-full bg-slate-100 h-4 flex items-center rounded-xs">
                          <div
                            className={`h-4 rounded-xs ${
                              isLowSample ? "bg-[#9CA3AF]" : "bg-[#0284C7]"
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-slate-900 font-bold tabular-nums text-xs">
                          {c.avgOrder.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Channel scorecard table */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none ring-1 ring-slate-200/70 dark:ring-slate-800 p-4 md:p-5 overflow-x-auto ae-table-wrap min-w-0">
            <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{tr("Channel scorecard")}</div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {tr("For the chosen brand. Add-on rates are item lines of that kind per order.")} </div>
            <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
              <thead className="bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="text-start py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Channel")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Orders")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap w-48">{tr("Net sales")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Share")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Avg order")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Items / order")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Discount rate")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Drinks")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Starters")}</th>
                  <th className="text-end py-3.5 px-4 text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{tr("Desserts")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {vChannels.map((c) => {
                  const barW = Math.max(2, (c.netSales / maxChannelSales) * 80);
                  return (
                    <tr
                      key={c.channel}
                      onClick={() =>
                        setSelectedChannel(
                          selectedChannel === c.channel ? "All channels" : c.channel
                        )
                      }
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer ${hiRow(selectedChannel === c.channel, selectedChannel !== ALL_CHANNELS)}`}
                     >
                       <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                         <span className="inline-flex items-center gap-2">
                           <span>{chLabel(c.channel)}</span>
                           <ChannelModeBadge channel={c.channel} />
                         </span>
                       </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {c.orders.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="h-2.5 bg-[#0284C7] rounded-xs"
                            style={{ width: `${barW}px` }}
                          />
                          <span>
                            {c.netSales.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {c.share.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {c.avgOrder.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {c.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {c.discountRate.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {c.drinksPct.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {c.startersPct.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {c.dessertsPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

            <ChannelMix channels={channelViews} selectedChannel={selectedChannel} />
            <ChannelRecs channels={channelViews} />
            <div className="grid grid-cols-1 gap-3">
            <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none ring-1 ring-slate-200/70 dark:ring-slate-800 p-4 md:p-5 overflow-x-auto ae-table-wrap min-w-0">
              <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100"> {tr("Brand × Channel combination scorecard")} </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {tr("Top brand-channel pairs showing lead item, average basket size, and drink attachment rate.")} </div>
              <div className="max-h-[300px] overflow-y-auto border-t border-slate-100 dark:border-slate-800">
                <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
                  <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Brand")}</th>
                      <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Channel")}</th>
                      <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Lead item")}</th>
                      <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Orders")}</th>
                      <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Net KWD")}</th>
                      <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Avg order")}</th>
                      <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Drinks %")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {matrixRows.length === 0 ? (<tr><td colSpan={7} className="py-6 text-center text-slate-500 dark:text-slate-400">{tr("No brand-channel pair in the dataset matches this selection.")}</td></tr>) : null}
                    {matrixRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{tr(row.brand)}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span>{chLabel(row.channel)}</span>
                            <ChannelModeBadge channel={row.channel} />
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{tr(row.topItem)}</td>
                        <td className="py-3.5 px-4 text-end tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          {row.orders.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-end tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {row.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {row.aov.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {row.drinkPct}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </div>
        )}

        {tab === "new-customer" && <NewCustomerTab view={view} />}

        {tab === "products" && (
          <div className="space-y-6">
            <RevenueConcentration />
        {/* ==========================================
            SECTION 3: MENU CATEGORIES & TOP 15 ITEMS
           ========================================== */}
        <section className="space-y-3">
          <div className="text-[15px] font-bold text-slate-900"> {tr("Menu")} <span className="font-semibold text-slate-500 text-xs">· {scopeLabel}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Sales by category (Grey Bars) */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900">{tr("Sales by category")}</div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("Gross item sales before order-level discounts, grouped by item category.")} </div>
              <div className="space-y-2">
                {categoryRows.length === 0 ? (<div className="text-[13px] text-slate-500">{tr("No item rows for this brand in the project dataset.")}</div>) : null}
                {categoryRows.map((cat) => {
                  const widthPct = Math.max(1, (cat.sales / maxCatSales) * 100);
                  return (
                    <div
                      key={cat.name}
                      tabIndex={0}
                      className="group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[135px_1fr_60px] items-center gap-2.5 text-[13px]"
                    >
                      <HoverTip
                        title={cat.name}
                        lines={[`${tr("Gross sales")}: ${money(cat.sales)}`]}
                      />
                      <span className="text-end font-semibold text-slate-800 truncate">{cat.name}</span>
                      <div className="w-full bg-slate-100 h-4 flex items-center rounded-xs">
                        <div
                          className="h-4 bg-[#9CA3AF] rounded-xs"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-slate-900 font-bold tabular-nums text-xs">
                        {cat.sales.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 15 items (Blue Bars) */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900">{tr("Top 15 items")}</div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("Gross KWD. Hover a bar to see the brand and unit price.")} </div>
              <div className="space-y-2">
                {topItems.length === 0 ? (<div className="text-[13px] text-slate-500">{tr("No item rows for this brand in the project dataset.")}</div>) : null}
                {topItems.map((item) => {
                  const widthPct = Math.max(2, (item.sales / maxItemSales) * 100);
                  return (
                    <div
                      key={item.name}
                      tabIndex={0}
                      className="group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[175px_1fr_60px] items-center gap-2.5 text-[13px]"
                    >
                      <HoverTip
                        title={item.name}
                        lines={[
                          `${tr("Brand")}: ${tr(item.brand)}`,
                          `${tr("Gross sales")}: ${money(item.sales)}`,
                          `${tr("Unit price")}: ${money(item.price, 2)}`,
                        ]}
                      />
                      <span className="text-end font-semibold text-slate-800 truncate">{item.name}</span>
                      <div className="w-full bg-slate-100 h-4 flex items-center rounded-xs">
                        <div
                          className="h-4 bg-[#0284C7] rounded-xs"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-slate-900 font-bold tabular-nums text-xs">
                        {item.sales.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

            <section className="space-y-3">
          <div className="text-[15px] font-bold text-slate-900">
            {tr("Menu & Odoo Diagnostic Action Matrix")}{" "}
            <span className="font-semibold text-slate-500 text-xs"> {tr("· Automated classification of revenue, add-ons, COGS & maintenance")} </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Multi-Colored Horizontal Bar Breakdown */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900"> {tr("Revenue & Cost Pool by Diagnostic Action Bucket")} </div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("KWD pool impacted per diagnostic rule across Odoo POS, Aggregators & Central Kitchen.")} </div>
              <div className="space-y-2.5 pt-1">
                {diagBuckets.map((b) => {
                  const widthPct = Math.max(4, (b.value / maxDiagValue) * 100);
                  return (
                    <div
                      key={tr(b.label)}
                      tabIndex={0}
                      className="group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[215px_1fr_65px] items-center gap-2.5 text-[13px]"
                    >
                      <HoverTip
                        title={tr(b.label)}
                        lines={[`${tr("Amount (KWD)")}: ${money(b.value)}`]}
                      />
                      <span className="text-end font-semibold text-slate-800 truncate">{tr(b.label)}</span>
                      <div className="w-full bg-slate-100 h-4 flex items-center rounded-xs">
                        <div
                          className="h-4 rounded-r-sm"
                          style={{ width: `${widthPct}%`, backgroundColor: b.color }}
                        />
                      </div>
                      <span className="text-slate-900 font-bold tabular-nums text-xs">
                        {b.value.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Legend with Outlined Badges */}
            <div className="ae-tile rounded-2xl p-4 md:p-5 min-w-0 overflow-x-auto">
              <div className="text-[15px] font-bold text-slate-900"> {tr("How items & Odoo cost centers are classified")} </div>
              <div className="text-xs font-semibold text-slate-600 mb-3"> {tr("Each row in the action tables below receives a diagnostic badge and concrete recommendation.")} </div>
              <div className="space-y-2.5">
                {DIAGNOSTIC_BUCKETS.map((b) => (
                  <div
                    key={tr(b.badge)}
                    className="grid grid-cols-[120px_1fr] items-start gap-3 text-[13px]"
                  >
                    <span
                      className={`inline-block text-center px-2.5 py-0.5 rounded-full border text-xs font-bold ${b.badgeColor}`}
                    >
                      {tr(b.badge)}
                    </span>
                    <span className="text-slate-700 font-medium leading-snug">{tr(b.rule)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ==========================================
              SCROLLABLE ACTION TABLE 1: ITEM DIAGNOSTICS
             ========================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none ring-1 ring-slate-200/70 dark:ring-slate-800 p-4 md:p-5 overflow-x-auto ae-table-wrap min-w-0">
            <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100"> {tr("Item-level commercial diagnostics & pricing actions")} </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {tr("High-impact menu items evaluated by order volume, basket attachment, discount bleed, and kitchen prep.")} </div>
            <div className="max-h-[340px] overflow-y-auto border-t border-slate-100 dark:border-slate-800">
              <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
                <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Brand")}</th>
                    <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Item")}</th>
                    <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Category")}</th>
                    <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Orders")}</th>
                    <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Net sales")}</th>
                    <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Avg price")}</th>
                    <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Share")}</th>
                    <th className="text-center py-3.5 px-4 font-bold whitespace-nowrap w-36">{tr("Action tag")}</th>
                    <th className="text-start py-3.5 ps-4 font-bold whitespace-nowrap">{tr("Recommended executive action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {diagRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150">
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{tr(row.brand)}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{tr(row.item)}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{tr(row.category)}</td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {row.orders.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {row.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {row.avgPrice.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {row.sharePct.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-bold ${row.badgeStyle}`}
                        >
                          {tr(row.badge)}
                        </span>
                      </td>
                      <td className="py-3.5 ps-4 font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{tr(row.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none ring-1 ring-slate-200/70 dark:ring-slate-800 p-4 md:p-5 overflow-x-auto ae-table-wrap min-w-0">
              <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100"> {tr("Long-tail menu candidates for pruning (Prep & waste reduction)")} </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {isAr ? `${SC_TAIL_COUNT} من ${SC_MENU.length} صنفاً تحقق ${scFmt((SC_TAIL_SALES / SC_MENU_TOTAL) * 100, 1)}% فقط من المبيعات. إزالة الأصناف بطيئة الدوران تقلل هدر المطبخ المركزي. (* تكلفة المجموعة لعدم إتاحة تكلفة الوصفات)` : `${SC_TAIL_COUNT} of ${SC_MENU.length} items generate only ${scFmt((SC_TAIL_SALES / SC_MENU_TOTAL) * 100, 1)}% of sales. Removing low-rotation SKUs reduces central-kitchen waste. (* group COGS; recipe cost is not readable)`} </div>
              <div className="max-h-[300px] overflow-y-auto border-t border-slate-100 dark:border-slate-800">
                <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
                  <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Brand")}</th>
                      <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Category")}</th>
                      <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Item")}</th>
                      <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Orders")}</th>
                      <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Net KWD")}</th>
                      <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Est. COGS")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {tailRows.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150">
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{tr(item.brand)}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{tr(item.category)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{tr(item.item)}</td>
                        <td className="py-3.5 px-4 text-end tabular-nums font-semibold text-slate-800 dark:text-slate-200">{item.orders}</td>
                        <td className="py-3.5 px-4 text-end tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {item.sales.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-end tabular-nums font-bold text-rose-700 dark:text-rose-400">{item.cogs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
            </section>
          </div>
        )}

        {tab === "promotions" && <PromotionsTab channels={promoChannels} brands={promoBrands} totalDiscounts={view.discounts} totalNet={view.net} selectedChannel={selectedChannel} selectedBrand={selectedBrand} />}

        {tab === "branches" && <BranchesTab filter={filter} />}

        {tab === "peak-hours" && <PeakHoursTab view={view} />}

        {tab === "operation-performance" && (
          <div className="space-y-6">
            <OperationsTab view={view} />
            <section className="space-y-3">
          {/* ==========================================
              SCROLLABLE ACTION TABLE 2: ODOO P&L, COGS & PETTY CASH
             ========================================== */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none ring-1 ring-slate-200/70 dark:ring-slate-800 p-4 md:p-5 overflow-x-auto ae-table-wrap min-w-0">
            <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100"> {tr("Odoo ERP financial, central kitchen & maintenance audit scorecard")} </div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {isAr ? "مطابقة مباشرة مع دفتر الأستاذ العام في أودو (المواقع المعتمدة) ومركز تكلفة المطبخ المركزي وعهدة الصيانة (تقدير إداري)." : "Direct reconciliation with the Odoo general ledger (whitelisted locations), the central-kitchen cost centre and maintenance custody (management estimate)."} </div>
            <div className="max-h-[340px] overflow-y-auto border-t border-slate-100 dark:border-slate-800">
              <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
                <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Operational sector")}</th>
                    <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Odoo account / custody")}</th>
                    <th className="text-start py-3.5 px-4 font-bold whitespace-nowrap">{tr("Source module")}</th>
                    <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Entries")}</th>
                    <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Amount (KWD)")}</th>
                    <th className="text-end py-3.5 px-4 font-bold whitespace-nowrap">{tr("Variance")}</th>
                    <th className="text-center py-3.5 px-4 font-bold whitespace-nowrap w-36">{tr("Audit status")}</th>
                    <th className="text-start py-3.5 ps-4 font-bold whitespace-nowrap">{tr("Required Odoo & operational action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {opRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{tr(row.sector)}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{tr(row.account)}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{tr(row.module)}</td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {row.entries == null ? "—" : row.entries.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {row.amountKwd.toLocaleString(undefined, {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-end tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                        {tr(row.variancePct)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-bold ${row.badgeStyle}`}
                        >
                          {tr(row.badge)}
                        </span>
                      </td>
                      <td className="py-3.5 ps-4 font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{tr(row.action)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrandSalesOdooReportPage() {
  return (
    <Suspense fallback={null}>
      <ScorecardInner />
    </Suspense>
  );
}
