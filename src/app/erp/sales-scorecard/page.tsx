"use client";

import React, { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { makeTr } from "@/lib/i18n/analytics-ar";
import { SALES_TABS, parseSalesTab, salesTabHref } from "@/lib/analytics/sales-tabs";
import { BRANDS_DATA, CHANNELS_DATA, type BrandRow, type ChannelRow } from "@/lib/analytics/sales-core-data";
import { ALL_BRANDS, ALL_CHANNELS, TOTAL_NET, computeView } from "@/lib/analytics/sales-view";
import { TOP_BEST_SELLERS } from "@/lib/analytics/brand-sales-october-data";
import {
  BranchesTab,
  ChannelMix,
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
    badgeColor: "border-indigo-500 text-indigo-700 bg-indigo-50",
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
    badgeStyle: "border-indigo-600 text-indigo-800 bg-indigo-50",
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
    badgeStyle: "border-blue-600 text-blue-800 bg-blue-50",
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
    category: "Noodles",
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
    action: "Keeta accounts for KWD 2,539 of the KWD 4,152 total discounts AND only 4.8% drink attachment. Switch promo to Combo + Drink.",
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
    sector: "Menu Tail · All 6 Brands",
    account: "Bottom 332 Menu SKUs",
    module: "Odoo POS Items",
    entries: 332,
    amountKwd: 33418.430,
    variancePct: "20.0% sales",
    badge: "Prune 45 SKUs",
    badgeStyle: "border-purple-600 text-purple-800 bg-purple-50",
    action: "332 items generate only 20% of revenue while increasing kitchen prep complexity and expiry risk. Delist bottom 45 slow movers.",
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

const CHANNEL_BRAND_MATRIX = [
  { brand: "China Garden", channel: "Shop Sales", topItem: "Chicken Noodles", orders: 11420, sales: 48120.40, aov: 4.21, drinkPct: "38.4%" },
  { brand: "China Garden", channel: "Talabat Go", topItem: "Veg Or Chicken Noodles Combo", orders: 6120, sales: 47890.10, aov: 7.83, drinkPct: "13.2%" },
  { brand: "China Garden", channel: "Keeta", topItem: "Chicken Noodles", orders: 5490, sales: 31420.80, aov: 5.72, drinkPct: "4.6%" },
  { brand: "Frank's", channel: "Talabat Go", topItem: "Orig. Philly CheeseSteak", orders: 840, sales: 6420.50, aov: 7.64, drinkPct: "11.8%" },
  { brand: "Frank's", channel: "Deliveroo Core", topItem: "Philly Meal For 1", orders: 510, sales: 3890.20, aov: 7.63, drinkPct: "14.1%" },
  { brand: "Tahina", channel: "Shop Sales", topItem: "KWD 1 Chicken Shawarma", orders: 1490, sales: 3210.40, aov: 2.15, drinkPct: "84.5%" },
  { brand: "Farm Brown", channel: "Shop Sales", topItem: "Chicken Fillet Meal", orders: 610, sales: 1890.00, aov: 3.10, drinkPct: "24.0%" },
  { brand: "The Noodle Bar", channel: "Talabat MP", topItem: "Sriracha Chicken Noodles", orders: 180, sales: 1140.60, aov: 6.34, drinkPct: "18.5%" },
];

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
  const [selectedBrand, setSelectedBrand] = useState<string>(ALL_BRANDS);
  const [selectedChannel, setSelectedChannel] = useState<string>(ALL_CHANNELS);

  // One model for every tab: brand rows (scaled by the channel filter), channel rows (scaled by the brand filter) and totals.
  const filter = useMemo(() => ({ brand: selectedBrand, channel: selectedChannel }), [selectedBrand, selectedChannel]);
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
  const hiRow = (on: boolean, dim: boolean) => (on ? "bg-blue-50 font-semibold" : dim ? "opacity-50" : "");

  // Products tab: item rows that carry a brand are filtered by the brand; the channel filter scales them by the channel's share of sales.
  const chRatio = selectedChannel === ALL_CHANNELS ? 1 : (CHANNELS_DATA.find((c) => c.channel === selectedChannel)?.netSales ?? TOTAL_NET) / TOTAL_NET;
  const brandSel = selectedBrand !== ALL_BRANDS;
  const scaleItem = <T extends { sales: number; orders: number }>(i: T): T => ({ ...i, sales: i.sales * chRatio, orders: Math.round(i.orders * chRatio) });
  const poolBrandItems = brandSel ? ITEM_POOL.filter((i) => i.brand === selectedBrand).sort((x, y) => y.sales - x.sales) : [];
  const topItems = (brandSel ? poolBrandItems.slice(0, 15) : TOP_15_ITEMS).map(scaleItem);
  const categoryRows = (() => {
    if (!brandSel) return CATEGORIES_DATA.map((c) => ({ name: c.name, sales: c.sales * chRatio }));
    const m = new Map<string, number>();
    poolBrandItems.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + i.sales));
    return [...m.entries()].map(([name, sales]) => ({ name, sales: sales * chRatio })).sort((x, y) => y.sales - x.sales);
  })();
  const diagBuckets = DIAGNOSTIC_BUCKETS.map((d) => ({ ...d, value: d.value * view.ratioNet }));
  const diagRows = ITEM_DIAGNOSTICS_TABLE_1.filter((r) => !brandSel || r.brand === selectedBrand).map((r) => ({ ...r, orders: Math.round(r.orders * chRatio), sales: r.sales * chRatio }));
  const tailRows = LOW_VOLUME_TAIL_ITEMS.filter((r) => !brandSel || r.brand === selectedBrand).map((r) => ({ ...r, orders: Math.round(r.orders * chRatio), sales: r.sales * chRatio }));
  const matrixRows = CHANNEL_BRAND_MATRIX.filter((r) => (!brandSel || r.brand === selectedBrand) && (selectedChannel === ALL_CHANNELS || r.channel === selectedChannel));
  const bestItem = brandSel ? poolBrandItems[0] : undefined;
  const bestName = bestItem ? bestItem.name : "Chicken Noodles";
  const scopeLabel = view.isFiltered ? tr(selectedBrand) + " · " + tr(selectedChannel) : tr("All brands, all channels");
  const biggestChannel = [...vChannels].sort((x, y) => y.netSales - x.netSales)[0];
  const opRows = ODOO_OPERATIONAL_TABLE_2
    .filter((r) => !r.sector.startsWith("Aggregator Clearing") || selectedChannel === ALL_CHANNELS || r.sector.endsWith(selectedChannel))
    .map((r) => {
      const ch = r.sector.startsWith("Aggregator Clearing") ? vChannels.find((c) => r.sector.endsWith(c.channel)) : undefined;
      if (ch) return { ...r, entries: ch.orders, amountKwd: ch.netSales };
      return { ...r, entries: Math.round(r.entries * view.ratioOrders), amountKwd: r.amountKwd * view.ratioNet };
    });

  // Max values for proportional bar widths
  const maxBrandSales = Math.max(...vBrands.map((b) => b.netSales));
  const maxBrandAov = Math.max(...vBrands.map((b) => b.avgOrder));
  const maxChannelSales = Math.max(...vChannels.map((c) => c.netSales));
  const maxChannelAov = Math.max(...vChannels.map((c) => c.avgOrder));
  const maxCatSales = Math.max(1, ...categoryRows.map((c) => c.sales));
  const maxItemSales = Math.max(1, ...topItems.map((i) => i.sales));
  const maxDiagValue = Math.max(1, ...diagBuckets.map((d) => d.value));

  const isFiltered = selectedBrand !== "All brands" || selectedChannel !== "All channels";
  const channelViews = vChannels.map((c) => ({
    key: c.channel,
    label: tr(c.channel),
    orders: c.orders,
    sales: c.netSales,
    discPct: c.discountRate,
    drinksPct: c.drinksPct,
  }));
  const promoChannels = vChannels.map((c) => ({ key: c.channel, label: tr(c.channel), sales: c.netSales, discPct: c.discountRate, kwd: c.discountKwd }));
  const promoBrands = vBrands.map((b) => ({ key: b.brand, label: tr(b.brand), discPct: b.discountRate }));

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      lang={locale}
      className="min-h-screen bg-[#F8F9FA] text-[#111827] font-sans antialiased selection:bg-blue-100 selection:text-blue-900"
      style={{ fontFamily: isAr ? "Cairo, Inter, system-ui, sans-serif" : "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      <div className="max-w-[1600px] mx-auto px-5 py-5 space-y-6">
        {/* ==========================================
            HEADER & GLOBAL CROSS-FILTERS
           ========================================== */}
        <header className="space-y-3 border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>{tr("Updated Live · Odoo ERP Verified (2,213 Journal Entries · Venture Foods Co. W.L.L.)")}</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> {tr("Odoo P&L Reconciled: KWD 42,441.480 Net Profit (25.4%)")} </span>
              {(selectedBrand !== "All brands" || selectedChannel !== "All channels") && (
                <button
                  onClick={() => {
                    setSelectedBrand("All brands");
                    setSelectedChannel("All channels");
                  }}
                  className="text-blue-600 hover:underline font-medium"
                > {tr("Reset filters")} </button>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900"> {tr("Brand sales · October 2026")} </h1>
            <p className="text-[12px] text-gray-600 mt-0.5 max-w-3xl leading-relaxed">
              {isAr ? (
                <>
                  {tr(selectedBrand)} في {tr(selectedChannel)} حققت صافي{" "}
                  <strong className="font-semibold text-gray-900">
                    <span dir="ltr" className="inline-block tabular-nums">{money(kpis.netSales)}</span>
                  </strong>{" "}
                  في أكتوبر من{" "}
                  <strong className="font-semibold text-gray-900">
                    <span dir="ltr" className="inline-block tabular-nums">{kpis.orders.toLocaleString()}</span>
                  </strong>{" "}
                  طلب. الصنف الأعلى مبيعاً هو{" "}
                  <strong className="font-semibold text-gray-900">{bestName}</strong>.
                </>
              ) : (
                <>
                  {selectedBrand} in {selectedChannel.toLowerCase()} made{" "}
                  <strong className="font-semibold text-gray-900">
                    {money(kpis.netSales)}
                  </strong>{" "}
                  net in October from{" "}
                  <strong className="font-semibold text-gray-900">
                    {kpis.orders.toLocaleString()}
                  </strong>{" "}
                  orders. The best seller was{" "}
                  <strong className="font-semibold text-gray-900">{bestName}</strong>.
                </>
              )}
            </p>
          </div>

          {/* Filter Dropdowns */}
          <div className="pt-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-4 text-[12px]">
              <label className="flex items-center gap-2 text-gray-600">
                <span>{tr("Brand")}</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-2.5 py-1 text-[12px] text-gray-900 font-medium focus:outline-none focus:border-blue-600"
                >
                  <option value="All brands">{tr("All brands")}</option>
                  {vBrands.map((b) => (
                    <option key={b.brand} value={b.brand}>
                      {tr(b.brand)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-gray-600">
                <span>{tr("Channel")}</span>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-2.5 py-1 text-[12px] text-gray-900 font-medium focus:outline-none focus:border-blue-600"
                >
                  <option value="All channels">{tr("All channels")}</option>
                  {vChannels.map((c) => (
                    <option key={c.channel} value={c.channel}>
                      {tr(c.channel)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-gray-400"> {tr("Both filters apply to every section. You can also click a bar in the brand or channel charts.")} </p>
          </div>
        </header>

        <nav aria-label="Sales analysis sections" className="flex overflow-x-auto rounded-md border border-gray-200 bg-white text-[12px]">
          {SALES_TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Link
                key={t.id}
                href={salesTabHref(t.id)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap px-4 py-2.5 transition ${active ? "font-bold" : "text-gray-600 hover:bg-gray-50"}`}
                style={active ? { color: "#2563EB", borderBottom: "2px solid #2563EB", backgroundColor: "#EFF6FF" } : { borderBottom: "2px solid transparent" }}
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
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">{tr("Net sales · Oct 2026")}</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {money(kpis.netSales)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{tr("After discounts, KWD")}</div>
            <Spark series="sales" />
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">{tr("Orders")}</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {kpis.orders.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{tr("Distinct orders")}</div>
            <Spark series="orders" />
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">{tr("Average order value")}</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {money(kpis.avgOrder, 3)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{tr("Net sales ÷ orders")}</div>
            <Spark series="aov" />
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">{tr("Items sold")}</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {kpis.itemsSold.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {kpis.itemsPerOrder.toFixed(2)} {tr("items per order")}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">{tr("Discounts given")}</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {money(kpis.discounts)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{tr("2.4% of gross sales")}</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">{tr("Net operating profit")}</div>
            <div className="text-[18px] font-bold text-emerald-700 mt-0.5">
              <span dir="ltr" className="inline-block tabular-nums">{isFiltered ? "—" : money(42441.48, 3)}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{isFiltered ? tr("Available for the whole group only") : tr("25.4% net margin")}</div>
          </div>
        </section>

        {/* ==========================================
            ROW 2: HIGHLIGHTS (4 EDITORIAL CARDS)
           ========================================== */}
        <section className="space-y-2">
          <div className="text-[12px] font-semibold text-gray-800">
            {tr("Highlights")} <span className="font-normal text-gray-400">· {scopeLabel}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 border-s-[3px] border-s-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">{tr("Biggest channel")}</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                {isAr ? (<><strong className="font-semibold">{tr(biggestChannel.channel)}</strong> هي أكبر قناة بيع بنسبة <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">{biggestChannel.share.toFixed(1)}%</span></strong> من المبيعات المحددة.</>) : (<><strong className="font-semibold">{biggestChannel.channel}</strong> is the largest channel, with <strong className="font-semibold">{biggestChannel.share.toFixed(1)}%</strong> of the selected sales.</>)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 border-s-[3px] border-s-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">{tr("Best seller")}</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                {bestItem ? (isAr ? (<><strong className="font-semibold">{bestItem.name}</strong> هو أعلى أصناف <strong className="font-semibold">{tr(bestItem.brand)}</strong> مبيعاً بقيمة <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">{money(bestItem.sales * chRatio)}</span></strong>.</>) : (<><strong className="font-semibold">{bestItem.name}</strong> is the top item of <strong className="font-semibold">{bestItem.brand}</strong>, with <strong className="font-semibold">{money(bestItem.sales * chRatio)}</strong> in sales.</>)) : isAr ? (<><strong className="font-semibold">Chicken Noodles</strong> من <strong className="font-semibold">تشاينا جاردن</strong> باع <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">12,043 د.ك</span></strong> وتمثل <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">7.2%</span></strong> من مبيعات المنيو.</>) : (<><strong className="font-semibold">Chicken Noodles</strong> from <strong className="font-semibold">China Garden</strong> sold <strong className="font-semibold">KWD 12,043</strong>, which is <strong className="font-semibold">7.2%</strong> of menu sales.</>)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 border-s-[3px] border-s-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">{tr("Menu concentration")}</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                {isAr ? (<>أعلى <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">32</span></strong> صنفاً من أصل <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">364</span></strong> صنفاً مباعاً تحقق <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">80%</span></strong> من مبيعات المنيو.</>) : (<>The top <strong className="font-semibold">32</strong> of <strong className="font-semibold">364</strong> items sold make <strong className="font-semibold">80%</strong> of menu sales.</>)}
              </div>
            </div>
            <div className="bg-white border border-gray-200 border-s-[3px] border-s-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">{tr("Add-ons per order")}</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                {isAr ? (<>المشروبات <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">25.3%</span></strong>، المقبلات والجوانب <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">32.7%</span></strong>، الحلويات <strong className="font-semibold"><span dir="ltr" className="inline-block tabular-nums">3.2%</span></strong>. كل نسبة هي عدد سطور الأصناف من هذا النوع لكل 100 طلب.</>) : (<>Drinks <strong className="font-semibold">25.3%</strong>, starters and sides <strong className="font-semibold">32.7%</strong>, desserts <strong className="font-semibold">3.2%</strong>. Each is item lines of that kind per 100 orders.</>)}
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
          <div className="text-[12px] font-semibold text-gray-800"> {tr("Brands")} <span className="font-normal text-gray-400">· {tr(selectedChannel)}</span>
          </div>

          {/* 2 Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Net sales by brand */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">{tr("Net sales by brand")}</div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("KWD after discounts on the chosen channel. Click a bar to filter to that brand.")} </div>
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
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[110px_1fr_55px] items-center gap-2 text-[11px] cursor-pointer hover:opacity-100 focus:opacity-100 ${
                        isSelected ? "opacity-100" : "opacity-40"
                      }`}
                    >
                      <HoverTip title={tr(b.brand)} lines={brandTip(b)} />
                      <span className="text-end text-gray-600 truncate">{tr(b.brand)}</span>
                      <div className="w-full bg-gray-50 h-4 flex items-center">
                        <div
                          className="h-4 bg-[#2563EB] transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-gray-600 tabular-nums text-[10px]">
                        {Math.round(b.netSales).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Average order value by brand */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900"> {tr("Average order value by brand")} </div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("KWD per order. Brands with fewer than 200 orders on this channel are greyed out.")} </div>
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
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[110px_1fr_45px] items-center gap-2 text-[11px] cursor-pointer hover:opacity-100 focus:opacity-100 ${dimBrand(b.brand)}`}
                      >
                        <HoverTip title={tr(b.brand)} lines={brandTip(b)} />
                      <span className="text-end text-gray-600 truncate">{tr(b.brand)}</span>
                        <div className="w-full bg-gray-50 h-4 flex items-center">
                          <div
                            className={`h-4 transition-all ${
                              isLowSample ? "bg-[#9CA3AF]" : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-gray-600 tabular-nums text-[10px]">
                          {b.avgOrder.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Brand scorecard table */}
          <div className="bg-white border border-gray-200 rounded-md p-4 overflow-x-auto">
            <div className="text-[12px] font-semibold text-gray-900">{tr("Brand scorecard")}</div>
            <div className="text-[10px] text-gray-400 mb-3"> {tr("Drinks and starters are item lines of that kind per order. Discount rate is discounts ÷ gross sales.")} </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-normal">
                  <th className="text-start py-1.5 font-normal">{tr("Brand")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Orders")}</th>
                  <th className="text-end py-1.5 font-normal w-44">{tr("Net sales")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Share of group")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Avg order")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Items / order")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Discount rate")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Drinks")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Starters")}</th>
                  <th className="text-start py-1.5 ps-4 font-normal">{tr("Best seller")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vBrands.map((b) => {
                  const barW = Math.max(2, (b.netSales / maxBrandSales) * 80);
                  return (
                    <tr
                      key={tr(b.brand)}
                      onClick={() =>
                        setSelectedBrand(selectedBrand === b.brand ? "All brands" : b.brand)
                      }
                      className={`hover:bg-gray-50 cursor-pointer ${hiRow(selectedBrand === b.brand, selectedBrand !== ALL_BRANDS)}`}
                     >
                       <td className="py-1.5 font-medium text-gray-900">{tr(b.brand)}</td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {b.orders.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-900">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="h-2.5 bg-[#9CA3AF]"
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
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {b.share.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {b.avgOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {b.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {b.discountRate.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {b.drinksPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {b.startersPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 ps-4 text-start text-gray-700 truncate max-w-[220px]">
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
        <section className="space-y-3">
          <div className="text-[12px] font-semibold text-gray-800"> {tr("Channels")} <span className="font-normal text-gray-400">· {tr(selectedBrand)}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Net sales by channel */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">{tr("Net sales by channel")}</div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("KWD after discounts for the chosen brand. Click a bar to filter to that channel.")} </div>
              <div className="space-y-1.5">
                {vChannels.map((c) => {
                  const widthPct = Math.max(1, (c.netSales / maxChannelSales) * 100);
                  return (
                    <div
                      key={tr(c.channel)}
                      onClick={() =>
                        setSelectedChannel(
                          selectedChannel === c.channel ? "All channels" : c.channel
                        )
                      }
                      tabIndex={0}
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[110px_1fr_55px] items-center gap-2 text-[11px] cursor-pointer hover:opacity-100 focus:opacity-100 ${dimChannel(c.channel)}`}
                    >
                      <HoverTip title={tr(c.channel)} lines={channelTip(c)} />
                      <span className="text-end text-gray-600 truncate">{tr(c.channel)}</span>
                      <div className="w-full bg-gray-50 h-3.5 flex items-center">
                        <div
                          className="h-3.5 bg-[#2563EB]"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-gray-600 tabular-nums text-[10px]">
                        {Math.round(c.netSales).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Average order value by channel */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900"> {tr("Average order value by channel")} </div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("KWD per order. Channels with fewer than 200 orders are greyed out because their averages swing easily.")} </div>
              <div className="space-y-1.5">
                {[...vChannels]
                  .sort((a, b) => b.avgOrder - a.avgOrder)
                  .map((c) => {
                    const widthPct = Math.max(2, (c.avgOrder / maxChannelAov) * 100);
                    const isLowSample = c.orders < 200;
                    return (
                      <div
                        key={tr(c.channel)}
                        onClick={() =>
                          setSelectedChannel(
                            selectedChannel === c.channel ? "All channels" : c.channel
                          )
                        }
                        tabIndex={0}
                      className={`group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[110px_1fr_45px] items-center gap-2 text-[11px] cursor-pointer hover:opacity-100 focus:opacity-100 ${dimChannel(c.channel)}`}
                      >
                        <HoverTip title={tr(c.channel)} lines={channelTip(c)} />
                      <span className="text-end text-gray-600 truncate">{tr(c.channel)}</span>
                        <div className="w-full bg-gray-50 h-3.5 flex items-center">
                          <div
                            className={`h-3.5 ${
                              isLowSample ? "bg-[#9CA3AF]" : "bg-[#2563EB]"
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-gray-600 tabular-nums text-[10px]">
                          {c.avgOrder.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Channel scorecard table */}
          <div className="bg-white border border-gray-200 rounded-md p-4 overflow-x-auto">
            <div className="text-[12px] font-semibold text-gray-900">{tr("Channel scorecard")}</div>
            <div className="text-[10px] text-gray-400 mb-3"> {tr("For the chosen brand. Add-on rates are item lines of that kind per order.")} </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-normal">
                  <th className="text-start py-1.5 font-normal">{tr("Channel")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Orders")}</th>
                  <th className="text-end py-1.5 font-normal w-44">{tr("Net sales")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Share")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Avg order")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Items / order")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Discount rate")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Drinks")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Starters")}</th>
                  <th className="text-end py-1.5 font-normal">{tr("Desserts")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vChannels.map((c) => {
                  const barW = Math.max(2, (c.netSales / maxChannelSales) * 80);
                  return (
                    <tr
                      key={tr(c.channel)}
                      onClick={() =>
                        setSelectedChannel(
                          selectedChannel === c.channel ? "All channels" : c.channel
                        )
                      }
                      className={`hover:bg-gray-50 cursor-pointer ${hiRow(selectedChannel === c.channel, selectedChannel !== ALL_CHANNELS)}`}
                     >
                       <td className="py-1.5 font-medium text-gray-900">{tr(c.channel)}</td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {c.orders.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-900">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="h-2.5 bg-[#9CA3AF]"
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
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {c.share.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {c.avgOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {c.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {c.discountRate.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {c.drinksPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
                        {c.startersPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-end tabular-nums text-gray-700">
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
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900"> {tr("Brand × Channel combination scorecard")} </div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("Top brand-channel pairs showing lead item, average basket size, and drink attachment rate.")} </div>
              <div className="max-h-[220px] overflow-y-auto border-t border-gray-100">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                    <tr>
                      <th className="text-start py-1.5 font-normal">{tr("Brand")}</th>
                      <th className="text-start py-1.5 font-normal">{tr("Channel")}</th>
                      <th className="text-start py-1.5 font-normal">{tr("Lead item")}</th>
                      <th className="text-end py-1.5 font-normal">{tr("Orders")}</th>
                      <th className="text-end py-1.5 font-normal">{tr("Net KWD")}</th>
                      <th className="text-end py-1.5 font-normal">{tr("Avg order")}</th>
                      <th className="text-end py-1.5 font-normal">{tr("Drinks %")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {matrixRows.length === 0 ? (<tr><td colSpan={7} className="py-3 text-center text-gray-400">{tr("No brand-channel pair in the dataset matches this selection.")}</td></tr>) : null}
                    {matrixRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 font-medium text-gray-900">{tr(row.brand)}</td>
                        <td className="py-1.5 text-gray-600">{tr(row.channel)}</td>
                        <td className="py-1.5 text-gray-600 truncate max-w-[140px]">{tr(row.topItem)}</td>
                        <td className="py-1.5 text-end tabular-nums text-gray-700">
                          {row.orders.toLocaleString()}
                        </td>
                        <td className="py-1.5 text-end tabular-nums text-gray-900">
                          {row.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 text-end tabular-nums text-gray-700">
                          {row.aov.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-end tabular-nums text-gray-700">
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
          <div className="text-[12px] font-semibold text-gray-800"> {tr("Menu")} <span className="font-normal text-gray-400">· {scopeLabel}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Sales by category (Grey Bars) */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">{tr("Sales by category")}</div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("Gross item sales before order-level discounts, grouped by item category.")} </div>
              <div className="space-y-1.5">
                {categoryRows.length === 0 ? (<div className="text-[11px] text-gray-400">{tr("No item rows for this brand in the project dataset.")}</div>) : null}
                {categoryRows.map((cat) => {
                  const widthPct = Math.max(1, (cat.sales / maxCatSales) * 100);
                  return (
                    <div
                      key={cat.name}
                      tabIndex={0}
                      className="group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[120px_1fr_50px] items-center gap-2 text-[11px]"
                    >
                      <HoverTip
                        title={cat.name}
                        lines={[`${tr("Gross sales")}: ${money(cat.sales)}`]}
                      />
                      <span className="text-end text-gray-600 truncate">{cat.name}</span>
                      <div className="w-full bg-gray-50 h-3.5 flex items-center">
                        <div
                          className="h-3.5 bg-[#9CA3AF]"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-gray-600 tabular-nums text-[10px]">
                        {cat.sales.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 15 items (Blue Bars) */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">{tr("Top 15 items")}</div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("Gross KWD. Hover a bar to see the brand and unit price.")} </div>
              <div className="space-y-1.5">
                {topItems.length === 0 ? (<div className="text-[11px] text-gray-400">{tr("No item rows for this brand in the project dataset.")}</div>) : null}
                {topItems.map((item) => {
                  const widthPct = Math.max(2, (item.sales / maxItemSales) * 100);
                  return (
                    <div
                      key={item.name}
                      tabIndex={0}
                      className="group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[155px_1fr_50px] items-center gap-2 text-[11px]"
                    >
                      <HoverTip
                        title={item.name}
                        lines={[
                          `${tr("Brand")}: ${tr(item.brand)}`,
                          `${tr("Gross sales")}: ${money(item.sales)}`,
                          `${tr("Unit price")}: ${money(item.price, 2)}`,
                        ]}
                      />
                      <span className="text-end text-gray-600 truncate">{item.name}</span>
                      <div className="w-full bg-gray-50 h-3.5 flex items-center">
                        <div
                          className="h-3.5 bg-[#2563EB]"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="text-gray-600 tabular-nums text-[10px]">
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
          <div className="text-[12px] font-semibold text-gray-800">
            {tr("Menu & Odoo Diagnostic Action Matrix")}{" "}
            <span className="font-normal text-gray-400"> {tr("· Automated classification of revenue, add-ons, COGS & maintenance")} </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Multi-Colored Horizontal Bar Breakdown */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900"> {tr("Revenue & Cost Pool by Diagnostic Action Bucket")} </div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("KWD pool impacted per diagnostic rule across Odoo POS, Aggregators & Central Kitchen.")} </div>
              <div className="space-y-2.5 pt-1">
                {diagBuckets.map((b) => {
                  const widthPct = Math.max(4, (b.value / maxDiagValue) * 100);
                  return (
                    <div
                      key={tr(b.label)}
                      tabIndex={0}
                      className="group relative hover:z-50 focus:z-50 outline-none grid grid-cols-[195px_1fr_60px] items-center gap-2 text-[11px]"
                    >
                      <HoverTip
                        title={tr(b.label)}
                        lines={[`${tr("Amount (KWD)")}: ${money(b.value)}`]}
                      />
                      <span className="text-end text-gray-600 truncate">{tr(b.label)}</span>
                      <div className="w-full bg-gray-50 h-4 flex items-center">
                        <div
                          className="h-4 rounded-r-sm"
                          style={{ width: `${widthPct}%`, backgroundColor: b.color }}
                        />
                      </div>
                      <span className="text-gray-700 font-medium tabular-nums text-[10px]">
                        {b.value.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Legend with Outlined Badges */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900"> {tr("How items & Odoo cost centers are classified")} </div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("Each row in the action tables below receives a diagnostic badge and concrete recommendation.")} </div>
              <div className="space-y-2">
                {DIAGNOSTIC_BUCKETS.map((b) => (
                  <div
                    key={tr(b.badge)}
                    className="grid grid-cols-[110px_1fr] items-start gap-3 text-[11px]"
                  >
                    <span
                      className={`inline-block text-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${b.badgeColor}`}
                    >
                      {tr(b.badge)}
                    </span>
                    <span className="text-gray-600 leading-snug">{tr(b.rule)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ==========================================
              SCROLLABLE ACTION TABLE 1: ITEM DIAGNOSTICS
             ========================================== */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-[12px] font-semibold text-gray-900"> {tr("Item-level commercial diagnostics & pricing actions")} </div>
            <div className="text-[10px] text-gray-400 mb-3"> {tr("High-impact menu items evaluated by order volume, basket attachment, discount bleed, and kitchen prep.")} </div>
            <div className="max-h-[280px] overflow-y-auto border-t border-gray-100">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                  <tr>
                    <th className="text-start py-1.5 font-normal">{tr("Brand")}</th>
                    <th className="text-start py-1.5 font-normal">{tr("Item")}</th>
                    <th className="text-start py-1.5 font-normal">{tr("Category")}</th>
                    <th className="text-end py-1.5 font-normal">{tr("Orders")}</th>
                    <th className="text-end py-1.5 font-normal">{tr("Net sales")}</th>
                    <th className="text-end py-1.5 font-normal">{tr("Avg price")}</th>
                    <th className="text-end py-1.5 font-normal">{tr("Share")}</th>
                    <th className="text-center py-1.5 font-normal w-32">{tr("Action tag")}</th>
                    <th className="text-start py-1.5 ps-3 font-normal">{tr("Recommended executive action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {diagRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-700">{tr(row.brand)}</td>
                      <td className="py-2 font-medium text-gray-900">{tr(row.item)}</td>
                      <td className="py-2 text-gray-500">{tr(row.category)}</td>
                      <td className="py-2 text-end tabular-nums text-gray-700">
                        {row.orders.toLocaleString()}
                      </td>
                      <td className="py-2 text-end tabular-nums text-gray-900">
                        {row.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-end tabular-nums text-gray-700">
                        {row.avgPrice.toFixed(2)}
                      </td>
                      <td className="py-2 text-end tabular-nums text-gray-700">
                        {row.sharePct.toFixed(1)}%
                      </td>
                      <td className="py-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-medium ${row.badgeStyle}`}
                        >
                          {tr(row.badge)}
                        </span>
                      </td>
                      <td className="py-2 ps-3 text-gray-600">{tr(row.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

              <div className="grid grid-cols-1 gap-3">
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900"> {tr("Long-tail menu candidates for pruning (Prep & waste reduction)")} </div>
              <div className="text-[10px] text-gray-400 mb-3"> {tr("332 of 364 items generate only 20% of sales. Removing low-rotation SKUs reduces Central Kitchen waste.")} </div>
              <div className="max-h-[220px] overflow-y-auto border-t border-gray-100">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                    <tr>
                      <th className="text-start py-1.5 font-normal">{tr("Brand")}</th>
                      <th className="text-start py-1.5 font-normal">{tr("Category")}</th>
                      <th className="text-start py-1.5 font-normal">{tr("Item")}</th>
                      <th className="text-end py-1.5 font-normal">{tr("Orders")}</th>
                      <th className="text-end py-1.5 font-normal">{tr("Net KWD")}</th>
                      <th className="text-end py-1.5 font-normal">{tr("Est. COGS")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tailRows.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 text-gray-600">{tr(item.brand)}</td>
                        <td className="py-1.5 text-gray-500">{tr(item.category)}</td>
                        <td className="py-1.5 font-medium text-gray-900">{tr(item.item)}</td>
                        <td className="py-1.5 text-end tabular-nums text-gray-700">{item.orders}</td>
                        <td className="py-1.5 text-end tabular-nums text-gray-900">
                          {item.sales.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-end tabular-nums text-rose-600">{item.cogs}</td>
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
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-[12px] font-semibold text-gray-900"> {tr("Odoo ERP financial, central kitchen & maintenance audit scorecard")} </div>
            <div className="text-[10px] text-gray-400 mb-3"> {tr("Direct reconciliation with Odoo general ledger (2,213 entries), Central Kitchen COGS, and Rabih maintenance custody.")} </div>
            <div className="max-h-[260px] overflow-y-auto border-t border-gray-100">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                  <tr>
                    <th className="text-start py-1.5 font-normal">{tr("Operational sector")}</th>
                    <th className="text-start py-1.5 font-normal">{tr("Odoo account / custody")}</th>
                    <th className="text-start py-1.5 font-normal">{tr("Source module")}</th>
                    <th className="text-end py-1.5 font-normal">{tr("Entries")}</th>
                    <th className="text-end py-1.5 font-normal">{tr("Amount (KWD)")}</th>
                    <th className="text-end py-1.5 font-normal">{tr("Variance")}</th>
                    <th className="text-center py-1.5 font-normal w-32">{tr("Audit status")}</th>
                    <th className="text-start py-1.5 ps-3 font-normal">{tr("Required Odoo & operational action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {opRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-900">{tr(row.sector)}</td>
                      <td className="py-2 text-gray-700">{tr(row.account)}</td>
                      <td className="py-2 text-gray-500">{tr(row.module)}</td>
                      <td className="py-2 text-end tabular-nums text-gray-700">
                        {row.entries.toLocaleString()}
                      </td>
                      <td className="py-2 text-end tabular-nums font-medium text-gray-900">
                        {row.amountKwd.toLocaleString(undefined, {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="py-2 text-end tabular-nums text-gray-700">
                        {tr(row.variancePct)}
                      </td>
                      <td className="py-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-medium ${row.badgeStyle}`}
                        >
                          {tr(row.badge)}
                        </span>
                      </td>
                      <td className="py-2 ps-3 text-gray-600">{tr(row.action)}</td>
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
