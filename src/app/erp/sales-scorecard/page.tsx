"use client";

import React, { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { makeTr } from "@/lib/i18n/analytics-ar";
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

const CATEGORIES_DATA = [
  { name: "Noodles", sales: 47201, orders: 14210, items: 18420, share: 28.2 },
  { name: "Mains", sales: 28683, orders: 8940, items: 10120, share: 17.2 },
  { name: "Starters & sides", sales: 24581, orders: 9980, items: 14310, share: 14.7 },
  { name: "Meals & combos", sales: 18348, orders: 4120, items: 4890, share: 11.0 },
  { name: "Rice", sales: 17210, orders: 6450, items: 7820, share: 10.3 },
  { name: "Sandwiches & steaks", sales: 11818, orders: 3120, items: 4210, share: 7.1 },
  { name: "Soups", sales: 7487, orders: 3890, items: 4610, share: 4.5 },
  { name: "Beverages", sales: 5446, orders: 7726, items: 10240, share: 3.3 },
  { name: "Staff meal deals", sales: 1920, orders: 980, items: 1120, share: 1.1 },
  { name: "Platters & sharing", sales: 1840, orders: 310, items: 340, share: 1.1 },
  { name: "Desserts", sales: 1410, orders: 977, items: 1150, share: 0.8 },
  { name: "Sauces & extras", sales: 980, orders: 1420, items: 1980, share: 0.6 },
  { name: "Salads", sales: 620, orders: 310, items: 350, share: 0.4 },
  { name: "Chapati", sales: 310, orders: 145, items: 180, share: 0.2 },
];

const TOP_15_ITEMS = [
  { name: "Chicken Noodles", brand: "China Garden", category: "Noodles", sales: 12043, orders: 4820, price: 2.50 },
  { name: "Veg Or Chicken Noodles Combo", brand: "China Garden", category: "Meals & combos", sales: 9827, orders: 2890, price: 3.40 },
  { name: "Vegetable Noodles", brand: "China Garden", category: "Noodles", sales: 6852, orders: 3115, price: 2.20 },
  { name: "Beef Mongolian", brand: "China Garden", category: "Mains", sales: 5730, orders: 1710, price: 3.35 },
  { name: "Chicken Sweet 'n' Sour", brand: "China Garden", category: "Mains", sales: 4453, orders: 1460, price: 3.05 },
  { name: "Prawn Garlic Noodles", brand: "China Garden", category: "Noodles", sales: 3962, orders: 1220, price: 3.25 },
  { name: "Plain Noodles", brand: "China Garden", category: "Noodles", sales: 3864, orders: 2146, price: 1.80 },
  { name: "Orig. Philly CheeseSteak", brand: "Frank's", category: "Sandwiches & steaks", sales: 3735, orders: 996, price: 3.75 },
  { name: "Sweet Corn Chicken Soup", brand: "China Garden", category: "Soups", sales: 3722, orders: 2481, price: 1.50 },
  { name: "Philly Meal For 1", brand: "Frank's", category: "Meals & combos", sales: 3718, orders: 751, price: 4.95 },
  { name: "Chicken Fried Rice", brand: "China Garden", category: "Rice", sales: 3463, orders: 1443, price: 2.40 },
  { name: "Dynamite Shrimp", brand: "China Garden", category: "Starters & sides", sales: 3220, orders: 1150, price: 2.80 },
  { name: "Beef Noodles", brand: "China Garden", category: "Noodles", sales: 3146, orders: 1123, price: 2.80 },
  { name: "Chicken Breast Noodles", brand: "China Garden", category: "Noodles", sales: 2980, orders: 1083, price: 2.75 },
  { name: "Chicken Chowmein", brand: "China Garden", category: "Noodles", sales: 2740, orders: 1015, price: 2.70 },
];

// Multi-color Diagnostic Matrix Buckets (Matches 2nd Screenshot)
const DIAGNOSTIC_BUCKETS = [
  {
    label: "Core revenue drivers (Top 32 items)",
    value: 133674,
    pct: 80.0,
    color: "#6366F1",
    badge: "Hero core",
    badgeColor: "border-sky-200 text-sky-800 bg-sky-50",
    rule: "32 items generating 80% of menu revenue across Odoo POS & Aggregators. Protect recipe spec & prep availability.",
  },
  {
    label: "Aggregator drink & starter upsell gap",
    value: 91324,
    pct: 54.7,
    color: "#14B8A6",
    badge: "Upsell gap",
    badgeColor: "border-teal-600 text-teal-800 bg-teal-50",
    rule: "Talabat Go & Keeta orders with <13% drink attachment vs 41.2% in Shop Sales. Add mandatory drink step in combos.",
  },
  {
    label: "Odoo COGS & Central Kitchen variance",
    value: 41439,
    pct: 24.8,
    color: "#F97316",
    badge: "COGS +0.8%",
    badgeColor: "border-orange-500 text-orange-800 bg-orange-50",
    rule: "Central Kitchen poultry marination waste pushed COGS to 24.8% (KWD 41,438.856). Enforce batch weight logs.",
  },
  {
    label: "High-margin signature & combo anchors",
    value: 34210,
    pct: 20.5,
    color: "#16A34A",
    badge: "Expand combo",
    badgeColor: "border-green-600 text-green-800 bg-green-50",
    rule: "Frank's (69.8% starters) & Talabat MP (KWD 9.28 avg order) prove high bundle elasticity. Replicate across brands.",
  },
  {
    label: "Discount & promo bleed on Keeta/Snoonu",
    value: 36637,
    pct: 21.9,
    color: "#EC4899",
    badge: "Cap promo",
    badgeColor: "border-pink-500 text-pink-700 bg-pink-50",
    rule: "Keeta discount rate hits 6.7% and Snoonu 5.0% vs 2.4% group average (KWD 4,152 total discounts). Shift to meal bundles.",
  },
  {
    label: "Maintenance & Petty Cash (Rabih Custody)",
    value: 10708,
    pct: 6.4,
    color: "#EAB308",
    badge: "CapEx replace",
    badgeColor: "border-amber-600 text-amber-800 bg-amber-50",
    rule: "KWD 10,707.930 in maintenance & petty cash driven by repeated Al-Kout & Salmiya chiller repairs. Approve unit replacement.",
  },
];

// Item-level Diagnostic Table 1 (Matches 2nd Screenshot Middle Table)
const ITEM_DIAGNOSTICS_TABLE_1 = [
  {
    brand: "China Garden",
    item: "Chicken Noodles",
    category: "Noodles",
    orders: 4820,
    sales: 12043.0,
    avgPrice: 2.50,
    sharePct: 7.2,
    badge: "Hero anchor",
    badgeStyle: "border-emerald-600 text-emerald-800 bg-emerald-50",
    note: "Number 1 item company-wide (7.2% of all sales). Test +100 fils add-on upgrade (extra protein/mushroom) without touching base price.",
  },
  {
    brand: "China Garden",
    item: "Veg Or Chicken Noodles Combo",
    category: "Meals & combos",
    orders: 2890,
    sales: 9827.0,
    avgPrice: 3.40,
    sharePct: 5.9,
    badge: "Combo star",
    badgeStyle: "border-slate-200 text-slate-800 bg-slate-100",
    note: "Drives beverage & starter attachment on Talabat Go. Feature at top of Keeta menu to lift Keeta's 4.8% drink rate.",
  },
  {
    brand: "Frank's",
    item: "Orig. Philly CheeseSteak",
    category: "Sandwiches & steaks",
    orders: 996,
    sales: 3735.0,
    avgPrice: 3.75,
    sharePct: 2.2,
    badge: "High AOV driver",
    badgeStyle: "border-sky-200 text-sky-800 bg-sky-50",
    note: "69.8% starter attachment in Frank's pushes brand AOV to KWD 7.47. Keep fries + drink combo default on aggregators.",
  },
  {
    brand: "China Garden",
    item: "Plain Noodles",
    category: "Noodles",
    orders: 2146,
    sales: 3864.0,
    avgPrice: 1.80,
    sharePct: 2.3,
    badge: "Upsell target",
    badgeStyle: "border-amber-600 text-amber-800 bg-amber-50",
    note: "High order count (2,146) at low ticket (KWD 1.80). Add 1-click KWD 0.950 spring roll or soup pairing prompt.",
  },
  {
    brand: "Tahina",
    item: "KWD 1 Chicken Shawarma",
    category: "Sandwiches & steaks",
    orders: 1640,
    sales: 2980.0,
    avgPrice: 1.00,
    sharePct: 1.8,
    badge: "Basket builder",
    badgeStyle: "border-amber-600 text-amber-800 bg-amber-50",
    note: "Tahina has 81.2% drink rate but lowest AOV (KWD 2.28). Introduce 3-shawarma + fries family box at KWD 3.450.",
  },
  {
    brand: "China Garden",
    item: "Sweet Corn Chicken Soup",
    category: "Soups",
    orders: 2481,
    sales: 3722.0,
    avgPrice: 1.50,
    sharePct: 2.2,
    badge: "High margin add-on",
    badgeStyle: "border-emerald-600 text-emerald-800 bg-emerald-50",
    note: "Low food cost (16% COGS) and 2,481 orders. Bundle with Beef Mongolian & Chicken Fried Rice as a 2-person meal.",
  },
  {
    brand: "The Noodle Bar",
    item: "Sriracha Chicken Noodles",
    category: "Burgers & combos",
    orders: 195,
    sales: 1214.8,
    avgPrice: 6.23,
    sharePct: 0.7,
    badge: "Discount watch",
    badgeStyle: "border-rose-600 text-rose-800 bg-rose-50",
    note: "Brand discount rate is 4.9% (double group average). Replace flat percentage discounts with free drink above KWD 6.000.",
  },
  {
    brand: "Farm Brown",
    item: "Chicken Fillet Meal",
    category: "Meals & combos",
    orders: 512,
    sales: 1607.6,
    avgPrice: 3.14,
    sharePct: 1.0,
    badge: "Central kitchen prep watch",
    badgeStyle: "border-orange-600 text-orange-800 bg-orange-50",
    note: "Linked to Central Kitchen poultry batching (+0.8% COGS variance). Standardize 140g portioning weight.",
  },
];

// Operational & Odoo Financial Action Table 2 (Matches 2nd Screenshot Lower Table)
const ODOO_OPERATIONAL_TABLE_2 = [
  {
    sector: "Central Kitchen",
    account: "COGS / Raw Poultry & Sauces",
    module: "Odoo MRP & Stock",
    entries: 418,
    amountKwd: 41438.856,
    variancePct: "+0.8%",
    badge: "Tighten BOM",
    badgeStyle: "border-amber-600 text-amber-800 bg-amber-50",
    action: "Actual Food Cost is 24.8% vs 24.0% standard (KWD 1,336 variance). Audit chicken marination yield in Central Kitchen.",
  },
  {
    sector: "Maintenance · Al-Kout & Salmiya",
    account: "Custody & Maintenance (Rabih)",
    module: "Odoo Petty Cash",
    entries: 312,
    amountKwd: 10707.930,
    variancePct: "High freq",
    badge: "Replace chillers",
    badgeStyle: "border-rose-600 text-rose-800 bg-rose-50",
    action: "Repeated compressor & thermostat calls in Al-Kout and Salmiya branches. Cap repair petty cash and execute CapEx unit swap.",
  },
  {
    sector: "Aggregator Clearing · Keeta",
    account: "Keeta Settlement & Discounts",
    module: "Odoo Accounting",
    entries: 6267,
    amountKwd: 35607.980,
    variancePct: "6.7% disc",
    badge: "Rebalance promo",
    badgeStyle: "border-pink-600 text-pink-800 bg-pink-50",
    action: "Keeta accounts for KWD 2,544 of the KWD 4,152 total discounts AND only 4.8% drink attachment. Switch promo to Combo + Drink.",
  },
  {
    sector: "Aggregator Clearing · Talabat Go",
    account: "Talabat Go Receivables",
    module: "Odoo Accounting",
    entries: 7163,
    amountKwd: 55716.210,
    variancePct: "33.4% share",
    badge: "Reconciled 100%",
    badgeStyle: "border-emerald-600 text-emerald-800 bg-emerald-50",
    action: "Matched across 7,163 orders with KWD 7.78 AOV and 51.9% starter rate. Push beverage add-on from 12.7% toward 25.0%.",
  },
  {
    sector: "Operating Expenses & Custody",
    account: "General & Branch OpEx",
    module: "Odoo Journal (2,213)",
    entries: 2213,
    amountKwd: 51154.950,
    variancePct: "30.6% rev",
    badge: "Fils verified",
    badgeStyle: "border-emerald-600 text-emerald-800 bg-emerald-50",
    action: "All 2,213 journal entries reconciled to the fils in Odoo General Ledger. Net Operating Profit locked at KWD 42,441.480 (25.4%).",
  },
  {
    sector: "Menu Tail · All 7 Brands",
    account: "Bottom 332 Menu SKUs",
    module: "Odoo POS Items",
    entries: 332,
    amountKwd: 33418.430,
    variancePct: "20.0% sales",
    badge: "Purge 18 · re-price 4",
    badgeStyle: "border-purple-600 text-purple-800 bg-purple-50",
    action: "332 items generate only 20% of revenue while increasing kitchen prep complexity and expiry risk. Purge the 18 weakest Dog items and re-price 4 popular Plowhorses by +5% (+584 KWD/month).",
  },
];

// Bottom Left & Right Tables (Matches 2nd Screenshot Bottom Split Tables)
const LOW_VOLUME_TAIL_ITEMS = [
  { brand: "China Garden", category: "Salads", item: "Crispy Duck Salad", orders: 14, sales: 49.0, avgPrice: 3.50, cogs: "31.2%" },
  { brand: "China Garden", category: "Soups", item: "Seafood Tom Yum Clear", orders: 19, sales: 61.75, avgPrice: 3.25, cogs: "29.8%" },
  { brand: "Frank's", category: "Sides", item: "Truffle Parmesan Wedges", orders: 22, sales: 48.40, avgPrice: 2.20, cogs: "28.5%" },
  { brand: "The Noodle Bar", category: "Noodles", item: "Pad Kee Mao Prawns", orders: 18, sales: 68.40, avgPrice: 3.80, cogs: "30.4%" },
  { brand: "Farm Brown", category: "Sandwiches", item: "Smoky Turkey Club", orders: 27, sales: 74.25, avgPrice: 2.75, cogs: "27.9%" },
  { brand: "Tahina", category: "Platters", item: "Mixed Grill Family Tray", orders: 11, sales: 71.50, avgPrice: 6.50, cogs: "29.1%" },
  { brand: "Karak Cafeteria", category: "Desserts", item: "Saffron Milk Cake", orders: 16, sales: 32.00, avgPrice: 2.00, cogs: "26.0%" },
  { brand: "China Garden", category: "Appetizers", item: "Prawn Toast Sesame (4pcs)", orders: 24, sales: 60.00, avgPrice: 2.50, cogs: "28.0%" },
];

interface PoolItem { name: string; brand: string; category: string; sales: number; orders: number; price: number }
// Every item row in the project that carries a brand, de-duplicated by brand + name (largest sales kept).
const ITEM_POOL: PoolItem[] = (() => {
  const m = new Map<string, PoolItem>();
  const add = (it: PoolItem) => {
    const k = it.brand + "|" + it.name.toLowerCase();
    const old = m.get(k);
    if (!old || it.sales > old.sales) m.set(k, it);
  };
  TOP_15_ITEMS.forEach((i) => add({ ...i }));
  ITEM_DIAGNOSTICS_TABLE_1.forEach((i) => add({ name: i.item, brand: i.brand, category: i.category, sales: i.sales, orders: i.orders, price: i.avgPrice }));
  LOW_VOLUME_TAIL_ITEMS.forEach((i) => add({ name: i.item, brand: i.brand, category: i.category, sales: i.sales, orders: i.orders, price: i.avgPrice }));
  TOP_BEST_SELLERS.forEach((i) => add({ name: i.nameEn, brand: String(i.brand), category: i.categoryEn, sales: i.salesKwd, orders: i.unitsSold, price: i.priceKwd }));
  return [...m.values()];
})();

const SEED_CHANNEL_BRAND_MATRIX = [
  { brand: "China Garden", channel: "Shop Sales", topItem: "Chicken Noodles", orders: 12173, sales: 49261.30, aov: 4.05, drinkPct: "38.4%" },
  { brand: "China Garden", channel: "Talabat Go", topItem: "Veg Or Chicken Noodles Combo", orders: 6120, sales: 47890.10, aov: 7.83, drinkPct: "13.2%" },
  { brand: "China Garden", channel: "Keeta", topItem: "Chicken Noodles", orders: 5704, sales: 32555.28, aov: 5.71, drinkPct: "4.6%" },
  { brand: "China Garden", channel: "Talabat TMP", topItem: "Chicken Noodles", orders: 608, sales: 5951.84, aov: 9.79, drinkPct: "19.8%" },
  { brand: "China Garden", channel: "Deliveroo Core", topItem: "Beef Mongolian", orders: 457, sales: 1600.48, aov: 3.50, drinkPct: "13.0%" },
  { brand: "Frank's", channel: "Talabat Go", topItem: "Orig. Philly CheeseSteak", orders: 840, sales: 6420.50, aov: 7.64, drinkPct: "11.8%" },
  { brand: "Frank's", channel: "Deliveroo Core", topItem: "Philly Meal For 1", orders: 510, sales: 3890.20, aov: 7.63, drinkPct: "14.1%" },
  { brand: "Frank's", channel: "Shop Sales", topItem: "Orig. Philly CheeseSteak", orders: 450, sales: 3420.12, aov: 7.60, drinkPct: "18.2%" },
  { brand: "Frank's", channel: "Keeta", topItem: "Philly Meal For 1", orders: 280, sales: 1840.15, aov: 6.57, drinkPct: "8.5%" },
  { brand: "Frank's", channel: "Talabat TMP", topItem: "Orig. Philly CheeseSteak", orders: 67, sales: 463.00, aov: 6.91, drinkPct: "12.0%" },
  { brand: "Tahina", channel: "Shop Sales", topItem: "KWD 1 Chicken Shawarma", orders: 1490, sales: 3210.40, aov: 2.15, drinkPct: "84.5%" },
  { brand: "Tahina", channel: "Talabat Go", topItem: "Tahina Shawarma Platter", orders: 310, sales: 820.24, aov: 2.65, drinkPct: "72.0%" },
  { brand: "Tahina", channel: "Keeta", topItem: "Chicken Shawarma - Lebanese Bread", orders: 144, sales: 398.00, aov: 2.76, drinkPct: "65.0%" },
  { brand: "Farm Brown", channel: "Shop Sales", topItem: "Chicken Fillet Meal", orders: 610, sales: 1890.00, aov: 3.10, drinkPct: "24.0%" },
  { brand: "Farm Brown", channel: "Talabat Go", topItem: "Crispy Strips Box", orders: 140, sales: 450.18, aov: 3.22, drinkPct: "21.5%" },
  { brand: "Farm Brown", channel: "Keeta", topItem: "Chicken Fillet Meal", orders: 97, sales: 324.00, aov: 3.34, drinkPct: "19.0%" },
  { brand: "The Noodle Bar", channel: "Talabat TMP", topItem: "Sriracha Chicken Noodles", orders: 67, sales: 472.41, aov: 7.05, drinkPct: "18.5%" },
  { brand: "The Noodle Bar", channel: "Keeta", topItem: "Pad Thai Noodles", orders: 42, sales: 490.55, aov: 11.68, drinkPct: "22.0%" },
  { brand: "The Noodle Bar", channel: "Shop Sales", topItem: "Wok Egg Noodles", orders: 135, sales: 580.07, aov: 4.30, drinkPct: "15.0%" },
  { brand: "The Noodle Bar", channel: "Talabat Go", topItem: "Sriracha Chicken Noodles", orders: 25, sales: 135.19, aov: 5.41, drinkPct: "16.0%" },
  { brand: "Karak Cafeteria", channel: "Shop Sales", topItem: "Chapati Box (4 pcs)", orders: 125, sales: 591.20, aov: 4.73, drinkPct: "72.7%" },
  { brand: "Karak Cafeteria", channel: "Whatsapp", topItem: "Karak Chai Flask (1L)", orders: 3, sales: 33.30, aov: 11.10, drinkPct: "100.0%" },
];

// Orders, sales and AOV come from the balanced brand × channel matrix (verified brand and channel totals).
const CHANNEL_BRAND_MATRIX = SEED_CHANNEL_BRAND_MATRIX.map((r) => {
  const cell = REAL_BRAND_CHANNEL_DATA[r.brand]?.[r.channel === "Talabat TMP" ? "Talabat MP" : r.channel];
  return cell ? { ...r, orders: Math.round(cell.orders), sales: cell.netSales, aov: cell.orders > 0 ? cell.netSales / cell.orders : 0 } : r;
});

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
    .filter((r) => !r.sector.startsWith("Aggregator Clearing") || selectedChannel === ALL_CHANNELS || r.sector.endsWith(selectedChannel))
    .map((r) => {
      const ch = r.sector.startsWith("Aggregator Clearing") ? vChannels.find((c) => r.sector.endsWith(c.channel)) : undefined;
      if (ch) return { ...r, entries: ch.orders, amountKwd: ch.netSales };
      return { ...r, entries: Math.round(r.entries * view.ratioOrders), amountKwd: r.amountKwd * view.ratioNet };
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
            <span>{tr("Updated Live · Odoo ERP Verified (2,213 Journal Entries · Venture Foods Co. W.L.L.)")}</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span> {tr("Odoo P&L Reconciled: KWD 42,441.480 Net Profit (25.4%)")} </span>
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
              <span dir="ltr" className="inline-block tabular-nums">{isFiltered ? "—" : money(42441.48, 3)}</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{isFiltered ? tr("Available for the whole group only") : tr("25.4% net margin")}</div>
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
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {tr("332 of 364 items generate only 20% of sales. Removing low-rotation SKUs reduces Central Kitchen waste.")} </div>
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
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3"> {tr("Direct reconciliation with Odoo general ledger (2,213 entries), Central Kitchen COGS, and Rabih maintenance custody.")} </div>
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
                        {row.entries.toLocaleString()}
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
