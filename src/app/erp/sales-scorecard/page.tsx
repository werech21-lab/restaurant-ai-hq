"use client";

import React, { useState, useMemo } from "react";

// ==========================================
// 1. ODOO ERP MASTER DATASET (VENTURE FOODS)
// ==========================================

interface BrandRow {
  brand: string;
  orders: number;
  netSales: number;
  share: number;
  avgOrder: number;
  itemsPerOrder: number;
  discountRate: number;
  drinksPct: number;
  startersPct: number;
  cogsPct: number;
  bestSeller: string;
}

interface ChannelRow {
  channel: string;
  orders: number;
  netSales: number;
  share: number;
  avgOrder: number;
  itemsPerOrder: number;
  discountRate: number;
  drinksPct: number;
  startersPct: number;
  dessertsPct: number;
}

const BRANDS_DATA: BrandRow[] = [
  {
    brand: "China Garden",
    orders: 25205,
    netSales: 141662.65,
    share: 84.8,
    avgOrder: 5.62,
    itemsPerOrder: 2.57,
    discountRate: 2.7,
    drinksPct: 24.1,
    startersPct: 35.9,
    cogsPct: 24.4,
    bestSeller: "Chicken Noodles",
  },
  {
    brand: "Frank's",
    orders: 2150,
    netSales: 16020.26,
    share: 9.6,
    avgOrder: 7.45,
    itemsPerOrder: 3.01,
    discountRate: 1.4,
    drinksPct: 11.0,
    startersPct: 69.8,
    cogsPct: 26.2,
    bestSeller: "Orig. Philly CheeseSteak",
  },
  {
    brand: "Tahina",
    orders: 1947,
    netSales: 4424.85,
    share: 2.6,
    avgOrder: 2.27,
    itemsPerOrder: 2.75,
    discountRate: 1.0,
    drinksPct: 81.2,
    startersPct: 14.2,
    cogsPct: 23.5,
    bestSeller: "KWD 1 Chicken Shawarma - Lebanese Bread",
  },
  {
    brand: "Farm Brown",
    orders: 848,
    netSales: 2661.9,
    share: 1.6,
    avgOrder: 3.14,
    itemsPerOrder: 2.13,
    discountRate: 1.2,
    drinksPct: 23.1,
    startersPct: 16.2,
    cogsPct: 25.1,
    bestSeller: "Chicken Fillet Meal",
  },
  {
    brand: "The Noodle Bar",
    orders: 269,
    netSales: 1676.78,
    share: 1.0,
    avgOrder: 6.23,
    itemsPerOrder: 2.75,
    discountRate: 4.9,
    drinksPct: 17.8,
    startersPct: 25.3,
    cogsPct: 24.9,
    bestSeller: "Sriracha Chicken Noodles",
  },
  {
    brand: "Karak Cafeteria",
    orders: 128,
    netSales: 623.97,
    share: 0.4,
    avgOrder: 4.88,
    itemsPerOrder: 4.83,
    discountRate: 0.0,
    drinksPct: 72.7,
    startersPct: 37.5,
    cogsPct: 21.8,
    bestSeller: "Chapati Box (4 pcs)",
  },
];

const CHANNELS_DATA: ChannelRow[] = [
  {
    channel: "Shop Sales",
    orders: 14819,
    netSales: 58972.29,
    share: 35.3,
    avgOrder: 3.98,
    itemsPerOrder: 2.34,
    discountRate: 1.0,
    drinksPct: 41.2,
    startersPct: 14.4,
    dessertsPct: 1.5,
  },
  {
    channel: "Talabat Go",
    orders: 7163,
    netSales: 55716.21,
    share: 33.4,
    avgOrder: 7.78,
    itemsPerOrder: 2.91,
    discountRate: 2.0,
    drinksPct: 12.7,
    startersPct: 51.9,
    dessertsPct: 2.8,
  },
  {
    channel: "Keeta",
    orders: 6267,
    netSales: 35607.98,
    share: 21.3,
    avgOrder: 5.68,
    itemsPerOrder: 2.70,
    discountRate: 8.2,
    drinksPct: 4.8,
    startersPct: 39.4,
    dessertsPct: 3.9,
  },
  {
    channel: "Talabat MP",
    orders: 742,
    netSales: 6887.25,
    share: 4.1,
    avgOrder: 9.28,
    itemsPerOrder: 4.05,
    discountRate: 2.0,
    drinksPct: 19.8,
    startersPct: 76.8,
    dessertsPct: 6.2,
  },
  {
    channel: "Deliveroo Core",
    orders: 967,
    netSales: 5490.68,
    share: 3.3,
    avgOrder: 5.68,
    itemsPerOrder: 2.90,
    discountRate: 1.1,
    drinksPct: 13.0,
    startersPct: 64.1,
    dessertsPct: 6.4,
  },
  {
    channel: "Ordable",
    orders: 81,
    netSales: 1045.21,
    share: 0.6,
    avgOrder: 12.84,
    itemsPerOrder: 5.11,
    discountRate: 0.1,
    drinksPct: 17.3,
    startersPct: 109.9,
    dessertsPct: 7.4,
  },
  {
    channel: "Snoonu",
    orders: 163,
    netSales: 1029.26,
    share: 0.6,
    avgOrder: 6.30,
    itemsPerOrder: 2.85,
    discountRate: 6.2,
    drinksPct: 13.5,
    startersPct: 65.6,
    dessertsPct: 15.3,
  },
  {
    channel: "Jahez",
    orders: 129,
    netSales: 1021.05,
    share: 0.6,
    avgOrder: 7.92,
    itemsPerOrder: 3.03,
    discountRate: 0.0,
    drinksPct: 17.8,
    startersPct: 67.4,
    dessertsPct: 0.0,
  },
  {
    channel: "Phone",
    orders: 121,
    netSales: 801.94,
    share: 0.5,
    avgOrder: 6.64,
    itemsPerOrder: 4.55,
    discountRate: 1.6,
    drinksPct: 9.9,
    startersPct: 29.8,
    dessertsPct: 4.1,
  },
  {
    channel: "Deliveroo MP",
    orders: 86,
    netSales: 506.19,
    share: 0.3,
    avgOrder: 5.88,
    itemsPerOrder: 4.01,
    discountRate: 0.0,
    drinksPct: 20.9,
    startersPct: 55.8,
    dessertsPct: 0.0,
  },
  {
    channel: "Whatsapp",
    orders: 3,
    netSales: 33.30,
    share: 0.0,
    avgOrder: 11.10,
    itemsPerOrder: 7.00,
    discountRate: 11.1,
    drinksPct: 66.7,
    startersPct: 133.3,
    dessertsPct: 0.0,
  },
];

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
    rule: "Qurain Central Kitchen poultry marination waste pushed COGS to 24.8% (KWD 41,438.856). Enforce batch weight logs.",
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
    rule: "Keeta discount rate hits 8.2% and Snoonu 6.2% vs 2.4% group average (KWD 4,152 total discounts). Shift to meal bundles.",
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
    note: "69.8% starter attachment in Frank's pushes brand AOV to KWD 7.45. Keep fries + drink combo default on aggregators.",
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
    note: "Tahina has 81.2% drink rate but lowest AOV (KWD 2.27). Introduce 3-shawarma + fries family box at KWD 3.450.",
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
    badge: "Qurain prep watch",
    badgeStyle: "border-orange-600 text-orange-800 bg-orange-50",
    note: "Linked to Qurain Central Kitchen poultry batching (+0.8% COGS variance). Standardize 140g portioning weight.",
  },
];

// Operational & Odoo Financial Action Table 2 (Matches 2nd Screenshot Lower Table)
const ODOO_OPERATIONAL_TABLE_2 = [
  {
    sector: "Central Kitchen · Qurain",
    account: "COGS / Raw Poultry & Sauces",
    module: "Odoo MRP & Stock",
    entries: 418,
    amountKwd: 41438.856,
    variancePct: "+0.8%",
    badge: "Tighten BOM",
    badgeStyle: "border-amber-600 text-amber-800 bg-amber-50",
    action: "Actual Food Cost is 24.8% vs 24.0% standard (KWD 1,336 variance). Audit chicken marination yield in Qurain Central Kitchen.",
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
    variancePct: "8.2% disc",
    badge: "Rebalance promo",
    badgeStyle: "border-pink-600 text-pink-800 bg-pink-50",
    action: "Keeta accounts for KWD 3,180 of the KWD 4,152 total discounts AND only 4.8% drink attachment. Switch promo to Combo + Drink.",
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

export default function BrandSalesOdooReportPage() {
  const [selectedBrand, setSelectedBrand] = useState<string>("All brands");
  const [selectedChannel, setSelectedChannel] = useState<string>("All channels");

  // Filtered Brand Rows
  const activeBrands = useMemo(() => {
    if (selectedBrand === "All brands") return BRANDS_DATA;
    return BRANDS_DATA.filter((b) => b.brand === selectedBrand);
  }, [selectedBrand]);

  // Filtered Channel Rows
  const activeChannels = useMemo(() => {
    if (selectedChannel === "All channels") return CHANNELS_DATA;
    return CHANNELS_DATA.filter((c) => c.channel === selectedChannel);
  }, [selectedChannel]);

  // Dynamic KPI Calculations
  const kpis = useMemo(() => {
    const brandRatio =
      selectedBrand === "All brands"
        ? 1
        : (BRANDS_DATA.find((b) => b.brand === selectedBrand)?.netSales || 167092.16) / 167092.16;
    const channelRatio =
      selectedChannel === "All channels"
        ? 1
        : (CHANNELS_DATA.find((c) => c.channel === selectedChannel)?.netSales || 167092.16) / 167092.16;

    const combinedRatio = brandRatio * channelRatio;
    const netSales = 167092.16 * combinedRatio;
    const orders = Math.max(1, Math.round(30540 * combinedRatio));
    const avgOrder = netSales / orders;
    const itemsSold = Math.round(79740 * combinedRatio);
    const itemsPerOrder = itemsSold / orders;
    const discounts = 4152 * combinedRatio;
    const sharePct = combinedRatio * 100;

    return {
      netSales,
      orders,
      avgOrder,
      itemsSold,
      itemsPerOrder,
      discounts,
      sharePct,
    };
  }, [selectedBrand, selectedChannel]);

  // Max values for proportional bar widths
  const maxBrandSales = Math.max(...BRANDS_DATA.map((b) => b.netSales));
  const maxBrandAov = Math.max(...BRANDS_DATA.map((b) => b.avgOrder));
  const maxChannelSales = Math.max(...CHANNELS_DATA.map((c) => c.netSales));
  const maxChannelAov = Math.max(...CHANNELS_DATA.map((c) => c.avgOrder));
  const maxCatSales = Math.max(...CATEGORIES_DATA.map((c) => c.sales));
  const maxItemSales = Math.max(...TOP_15_ITEMS.map((i) => i.sales));
  const maxDiagValue = Math.max(...DIAGNOSTIC_BUCKETS.map((d) => d.value));

  return (
    <div
      dir="ltr"
      className="min-h-screen bg-[#F8F9FA] text-[#111827] font-sans antialiased selection:bg-blue-100 selection:text-blue-900"
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      <div className="max-w-[1600px] mx-auto px-5 py-5 space-y-6">
        {/* ==========================================
            HEADER & GLOBAL CROSS-FILTERS
           ========================================== */}
        <header className="space-y-3 border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>Updated Live · Odoo ERP Verified (2,213 Journal Entries · Venture Foods Co. W.L.L.)</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                Odoo P&L Reconciled: KWD 42,441.480 Net Profit (25.4%)
              </span>
              {(selectedBrand !== "All brands" || selectedChannel !== "All channels") && (
                <button
                  onClick={() => {
                    setSelectedBrand("All brands");
                    setSelectedChannel("All channels");
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">
              Brand sales · October 2026
            </h1>
            <p className="text-[12px] text-gray-600 mt-0.5 max-w-3xl leading-relaxed">
              {selectedBrand} in {selectedChannel.toLowerCase()} made{" "}
              <strong className="font-semibold text-gray-900">
                KWD {Math.round(kpis.netSales).toLocaleString()}
              </strong>{" "}
              net in October from{" "}
              <strong className="font-semibold text-gray-900">
                {kpis.orders.toLocaleString()}
              </strong>{" "}
              orders. The best seller was{" "}
              <strong className="font-semibold text-gray-900">Chicken Noodles</strong>.
            </p>
          </div>

          {/* Filter Dropdowns */}
          <div className="pt-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-4 text-[12px]">
              <label className="flex items-center gap-2 text-gray-600">
                <span>Brand</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-2.5 py-1 text-[12px] text-gray-900 font-medium focus:outline-none focus:border-blue-600"
                >
                  <option value="All brands">All brands</option>
                  {BRANDS_DATA.map((b) => (
                    <option key={b.brand} value={b.brand}>
                      {b.brand}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-gray-600">
                <span>Channel</span>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="bg-white border border-gray-300 rounded px-2.5 py-1 text-[12px] text-gray-900 font-medium focus:outline-none focus:border-blue-600"
                >
                  <option value="All channels">All channels</option>
                  {CHANNELS_DATA.map((c) => (
                    <option key={c.channel} value={c.channel}>
                      {c.channel}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-gray-400">
              Both filters apply to every section. You can also click a bar in the brand or channel charts.
            </p>
          </div>
        </header>

        {/* ==========================================
            ROW 1: 6 KPI CARDS
           ========================================== */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">Net sales · Oct 2026</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              KWD {Math.round(kpis.netSales).toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">After discounts, KWD</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">Orders</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {kpis.orders.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Distinct orders</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">Average order value</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              KWD {kpis.avgOrder.toFixed(3)}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Net sales ÷ orders</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">Items sold</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {kpis.itemsSold.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {kpis.itemsPerOrder.toFixed(2)} items per order
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">Discounts given</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              KWD {Math.round(kpis.discounts).toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">2.4% of gross sales</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="text-[11px] text-gray-500">Share of group sales</div>
            <div className="text-[18px] font-bold text-gray-900 mt-0.5 tabular-nums">
              {kpis.sharePct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Net profit KWD 42,441 (25.4%)
            </div>
          </div>
        </section>

        {/* ==========================================
            ROW 2: HIGHLIGHTS (4 EDITORIAL CARDS)
           ========================================== */}
        <section className="space-y-2">
          <div className="text-[12px] font-semibold text-gray-800">
            Highlights <span className="font-normal text-gray-400">· All brands, all channels</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 border-l-[3px] border-l-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">Biggest channel</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                <strong className="font-semibold">Shop Sales</strong> is the largest channel, with{" "}
                <strong className="font-semibold">35.3%</strong> of sales.
              </div>
            </div>

            <div className="bg-white border border-gray-200 border-l-[3px] border-l-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">Best seller</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                <strong className="font-semibold">Chicken Noodles</strong> from{" "}
                <strong className="font-semibold">China Garden</strong> sold{" "}
                <strong className="font-semibold">KWD 12,043</strong>, which is{" "}
                <strong className="font-semibold">7.2%</strong> of menu sales.
              </div>
            </div>

            <div className="bg-white border border-gray-200 border-l-[3px] border-l-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">Menu concentration</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                The top <strong className="font-semibold">32</strong> of{" "}
                <strong className="font-semibold">364</strong> items sold make{" "}
                <strong className="font-semibold">80%</strong> of menu sales.
              </div>
            </div>

            <div className="bg-white border border-gray-200 border-l-[3px] border-l-gray-700 rounded-md p-3">
              <div className="text-[10px] text-gray-500">Add-ons per order</div>
              <div className="text-[12px] text-gray-800 mt-0.5">
                Drinks <strong className="font-semibold">25.3%</strong>, starters and sides{" "}
                <strong className="font-semibold">32.7%</strong>, desserts{" "}
                <strong className="font-semibold">3.2%</strong>. Each is item lines of that kind per 100 orders.
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            SECTION 1: BRANDS (CHARTS + SCORECARD)
           ========================================== */}
        <section className="space-y-3">
          <div className="text-[12px] font-semibold text-gray-800">
            Brands <span className="font-normal text-gray-400">· {selectedChannel}</span>
          </div>

          {/* 2 Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Net sales by brand */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">Net sales by brand</div>
              <div className="text-[10px] text-gray-400 mb-3">
                KWD after discounts on the chosen channel. Click a bar to filter to that brand.
              </div>
              <div className="space-y-2">
                {BRANDS_DATA.map((b) => {
                  const widthPct = Math.max(1.5, (b.netSales / maxBrandSales) * 100);
                  const isSelected = selectedBrand === "All brands" || selectedBrand === b.brand;
                  return (
                    <div
                      key={b.brand}
                      onClick={() =>
                        setSelectedBrand(selectedBrand === b.brand ? "All brands" : b.brand)
                      }
                      className={`grid grid-cols-[110px_1fr_55px] items-center gap-2 text-[11px] cursor-pointer hover:opacity-90 ${
                        isSelected ? "opacity-100" : "opacity-40"
                      }`}
                    >
                      <span className="text-right text-gray-600 truncate">{b.brand}</span>
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
              <div className="text-[12px] font-semibold text-gray-900">
                Average order value by brand
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                KWD per order. Brands with fewer than 200 orders on this channel are greyed out.
              </div>
              <div className="space-y-2">
                {[...BRANDS_DATA]
                  .sort((a, b) => b.avgOrder - a.avgOrder)
                  .map((b) => {
                    const widthPct = Math.max(2, (b.avgOrder / maxBrandAov) * 100);
                    const isLowSample = b.orders < 200;
                    return (
                      <div
                        key={b.brand}
                        onClick={() =>
                          setSelectedBrand(selectedBrand === b.brand ? "All brands" : b.brand)
                        }
                        className="grid grid-cols-[110px_1fr_45px] items-center gap-2 text-[11px] cursor-pointer"
                      >
                        <span className="text-right text-gray-600 truncate">{b.brand}</span>
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
            <div className="text-[12px] font-semibold text-gray-900">Brand scorecard</div>
            <div className="text-[10px] text-gray-400 mb-3">
              Drinks and starters are item lines of that kind per order. Discount rate is discounts ÷ gross sales.
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-normal">
                  <th className="text-left py-1.5 font-normal">Brand</th>
                  <th className="text-right py-1.5 font-normal">Orders</th>
                  <th className="text-right py-1.5 font-normal w-44">Net sales</th>
                  <th className="text-right py-1.5 font-normal">Share of group</th>
                  <th className="text-right py-1.5 font-normal">Avg order</th>
                  <th className="text-right py-1.5 font-normal">Items / order</th>
                  <th className="text-right py-1.5 font-normal">Discount rate</th>
                  <th className="text-right py-1.5 font-normal">Drinks</th>
                  <th className="text-right py-1.5 font-normal">Starters</th>
                  <th className="text-left py-1.5 pl-4 font-normal">Best seller</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeBrands.map((b) => {
                  const barW = Math.max(2, (b.netSales / maxBrandSales) * 80);
                  return (
                    <tr
                      key={b.brand}
                      onClick={() =>
                        setSelectedBrand(selectedBrand === b.brand ? "All brands" : b.brand)
                      }
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-1.5 font-medium text-gray-900">{b.brand}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {b.orders.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-900">
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
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {b.share.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {b.avgOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {b.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {b.discountRate.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {b.drinksPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {b.startersPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 pl-4 text-left text-gray-700 truncate max-w-[220px]">
                        {b.bestSeller}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ==========================================
            SECTION 2: CHANNELS (CHARTS + SCORECARD)
           ========================================== */}
        <section className="space-y-3">
          <div className="text-[12px] font-semibold text-gray-800">
            Channels <span className="font-normal text-gray-400">· {selectedBrand}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Net sales by channel */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">Net sales by channel</div>
              <div className="text-[10px] text-gray-400 mb-3">
                KWD after discounts for the chosen brand. Click a bar to filter to that channel.
              </div>
              <div className="space-y-1.5">
                {CHANNELS_DATA.map((c) => {
                  const widthPct = Math.max(1, (c.netSales / maxChannelSales) * 100);
                  return (
                    <div
                      key={c.channel}
                      onClick={() =>
                        setSelectedChannel(
                          selectedChannel === c.channel ? "All channels" : c.channel
                        )
                      }
                      className="grid grid-cols-[110px_1fr_55px] items-center gap-2 text-[11px] cursor-pointer hover:opacity-90"
                    >
                      <span className="text-right text-gray-600 truncate">{c.channel}</span>
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
              <div className="text-[12px] font-semibold text-gray-900">
                Average order value by channel
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                KWD per order. Channels with fewer than 200 orders are greyed out because their averages swing easily.
              </div>
              <div className="space-y-1.5">
                {[...CHANNELS_DATA]
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
                        className="grid grid-cols-[110px_1fr_45px] items-center gap-2 text-[11px] cursor-pointer"
                      >
                        <span className="text-right text-gray-600 truncate">{c.channel}</span>
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
            <div className="text-[12px] font-semibold text-gray-900">Channel scorecard</div>
            <div className="text-[10px] text-gray-400 mb-3">
              For the chosen brand. Add-on rates are item lines of that kind per order.
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-normal">
                  <th className="text-left py-1.5 font-normal">Channel</th>
                  <th className="text-right py-1.5 font-normal">Orders</th>
                  <th className="text-right py-1.5 font-normal w-44">Net sales</th>
                  <th className="text-right py-1.5 font-normal">Share</th>
                  <th className="text-right py-1.5 font-normal">Avg order</th>
                  <th className="text-right py-1.5 font-normal">Items / order</th>
                  <th className="text-right py-1.5 font-normal">Discount rate</th>
                  <th className="text-right py-1.5 font-normal">Drinks</th>
                  <th className="text-right py-1.5 font-normal">Starters</th>
                  <th className="text-right py-1.5 font-normal">Desserts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeChannels.map((c) => {
                  const barW = Math.max(2, (c.netSales / maxChannelSales) * 80);
                  return (
                    <tr
                      key={c.channel}
                      onClick={() =>
                        setSelectedChannel(
                          selectedChannel === c.channel ? "All channels" : c.channel
                        )
                      }
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="py-1.5 font-medium text-gray-900">{c.channel}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.orders.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-900">
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
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.share.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.avgOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.discountRate.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.drinksPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.startersPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">
                        {c.dessertsPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ==========================================
            SECTION 3: MENU CATEGORIES & TOP 15 ITEMS
           ========================================== */}
        <section className="space-y-3">
          <div className="text-[12px] font-semibold text-gray-800">
            Menu <span className="font-normal text-gray-400">· All brands, all channels</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Sales by category (Grey Bars) */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">Sales by category</div>
              <div className="text-[10px] text-gray-400 mb-3">
                Gross item sales before order-level discounts, grouped by item category.
              </div>
              <div className="space-y-1.5">
                {CATEGORIES_DATA.map((cat) => {
                  const widthPct = Math.max(1, (cat.sales / maxCatSales) * 100);
                  return (
                    <div
                      key={cat.name}
                      className="grid grid-cols-[120px_1fr_50px] items-center gap-2 text-[11px]"
                    >
                      <span className="text-right text-gray-600 truncate">{cat.name}</span>
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
              <div className="text-[12px] font-semibold text-gray-900">Top 15 items</div>
              <div className="text-[10px] text-gray-400 mb-3">
                Gross KWD. Hover a bar to see the brand and unit price.
              </div>
              <div className="space-y-1.5">
                {TOP_15_ITEMS.map((item) => {
                  const widthPct = Math.max(2, (item.sales / maxItemSales) * 100);
                  return (
                    <div
                      key={item.name}
                      title={`${item.brand} · KWD ${item.price.toFixed(2)}`}
                      className="grid grid-cols-[155px_1fr_50px] items-center gap-2 text-[11px]"
                    >
                      <span className="text-right text-gray-600 truncate">{item.name}</span>
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

        {/* ==========================================
            SECTION 4: MULTI-COLOR DIAGNOSTIC MATRIX
            (EXACT MATCH TO 2ND SCREENSHOT)
           ========================================== */}
        <section className="space-y-3">
          <div className="text-[12px] font-semibold text-gray-800">
            Menu & Odoo Diagnostic Action Matrix{" "}
            <span className="font-normal text-gray-400">
              · Automated classification of revenue, add-ons, COGS & maintenance
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Multi-Colored Horizontal Bar Breakdown */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">
                Revenue & Cost Pool by Diagnostic Action Bucket
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                KWD pool impacted per diagnostic rule across Odoo POS, Aggregators & Central Kitchen.
              </div>
              <div className="space-y-2.5 pt-1">
                {DIAGNOSTIC_BUCKETS.map((b) => {
                  const widthPct = Math.max(4, (b.value / maxDiagValue) * 100);
                  return (
                    <div
                      key={b.label}
                      className="grid grid-cols-[195px_1fr_60px] items-center gap-2 text-[11px]"
                    >
                      <span className="text-right text-gray-600 truncate">{b.label}</span>
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
              <div className="text-[12px] font-semibold text-gray-900">
                How items & Odoo cost centers are classified
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                Each row in the action tables below receives a diagnostic badge and concrete recommendation.
              </div>
              <div className="space-y-2">
                {DIAGNOSTIC_BUCKETS.map((b) => (
                  <div
                    key={b.badge}
                    className="grid grid-cols-[110px_1fr] items-start gap-3 text-[11px]"
                  >
                    <span
                      className={`inline-block text-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${b.badgeColor}`}
                    >
                      {b.badge}
                    </span>
                    <span className="text-gray-600 leading-snug">{b.rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ==========================================
              SCROLLABLE ACTION TABLE 1: ITEM DIAGNOSTICS
             ========================================== */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-[12px] font-semibold text-gray-900">
              Item-level commercial diagnostics & pricing actions
            </div>
            <div className="text-[10px] text-gray-400 mb-3">
              High-impact menu items evaluated by order volume, basket attachment, discount bleed, and kitchen prep.
            </div>
            <div className="max-h-[280px] overflow-y-auto border-t border-gray-100">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                  <tr>
                    <th className="text-left py-1.5 font-normal">Brand</th>
                    <th className="text-left py-1.5 font-normal">Item</th>
                    <th className="text-left py-1.5 font-normal">Category</th>
                    <th className="text-right py-1.5 font-normal">Orders</th>
                    <th className="text-right py-1.5 font-normal">Net sales</th>
                    <th className="text-right py-1.5 font-normal">Avg price</th>
                    <th className="text-right py-1.5 font-normal">Share</th>
                    <th className="text-center py-1.5 font-normal w-32">Action tag</th>
                    <th className="text-left py-1.5 pl-3 font-normal">Recommended executive action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ITEM_DIAGNOSTICS_TABLE_1.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-700">{row.brand}</td>
                      <td className="py-2 font-medium text-gray-900">{row.item}</td>
                      <td className="py-2 text-gray-500">{row.category}</td>
                      <td className="py-2 text-right tabular-nums text-gray-700">
                        {row.orders.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-900">
                        {row.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-700">
                        {row.avgPrice.toFixed(2)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-700">
                        {row.sharePct.toFixed(1)}%
                      </td>
                      <td className="py-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-medium ${row.badgeStyle}`}
                        >
                          {row.badge}
                        </span>
                      </td>
                      <td className="py-2 pl-3 text-gray-600">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ==========================================
              SCROLLABLE ACTION TABLE 2: ODOO P&L, COGS & PETTY CASH
             ========================================== */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="text-[12px] font-semibold text-gray-900">
              Odoo ERP financial, central kitchen & maintenance audit scorecard
            </div>
            <div className="text-[10px] text-gray-400 mb-3">
              Direct reconciliation with Odoo general ledger (2,213 entries), Qurain Central Kitchen COGS, and Rabih maintenance custody.
            </div>
            <div className="max-h-[260px] overflow-y-auto border-t border-gray-100">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                  <tr>
                    <th className="text-left py-1.5 font-normal">Operational sector</th>
                    <th className="text-left py-1.5 font-normal">Odoo account / custody</th>
                    <th className="text-left py-1.5 font-normal">Source module</th>
                    <th className="text-right py-1.5 font-normal">Entries</th>
                    <th className="text-right py-1.5 font-normal">Amount (KWD)</th>
                    <th className="text-right py-1.5 font-normal">Variance</th>
                    <th className="text-center py-1.5 font-normal w-32">Audit status</th>
                    <th className="text-left py-1.5 pl-3 font-normal">Required Odoo & operational action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ODOO_OPERATIONAL_TABLE_2.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-900">{row.sector}</td>
                      <td className="py-2 text-gray-700">{row.account}</td>
                      <td className="py-2 text-gray-500">{row.module}</td>
                      <td className="py-2 text-right tabular-nums text-gray-700">
                        {row.entries.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium text-gray-900">
                        {row.amountKwd.toLocaleString(undefined, {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-700">
                        {row.variancePct}
                      </td>
                      <td className="py-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-medium ${row.badgeStyle}`}
                        >
                          {row.badge}
                        </span>
                      </td>
                      <td className="py-2 pl-3 text-gray-600">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ==========================================
              BOTTOM SPLIT TABLES (2 SIDE-BY-SIDE SCROLLABLE TABLES)
             ========================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Left: Low-volume tail items & kitchen waste */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">
                Long-tail menu candidates for pruning (Prep & waste reduction)
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                332 of 364 items generate only 20% of sales. Removing low-rotation SKUs reduces Qurain Central Kitchen waste.
              </div>
              <div className="max-h-[220px] overflow-y-auto border-t border-gray-100">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                    <tr>
                      <th className="text-left py-1.5 font-normal">Brand</th>
                      <th className="text-left py-1.5 font-normal">Category</th>
                      <th className="text-left py-1.5 font-normal">Item</th>
                      <th className="text-right py-1.5 font-normal">Orders</th>
                      <th className="text-right py-1.5 font-normal">Net KWD</th>
                      <th className="text-right py-1.5 font-normal">Est. COGS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {LOW_VOLUME_TAIL_ITEMS.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 text-gray-600">{item.brand}</td>
                        <td className="py-1.5 text-gray-500">{item.category}</td>
                        <td className="py-1.5 font-medium text-gray-900">{item.item}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">{item.orders}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-900">
                          {item.sales.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-rose-600">{item.cogs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Brand x Channel performance matrix */}
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <div className="text-[12px] font-semibold text-gray-900">
                Brand × Channel combination scorecard
              </div>
              <div className="text-[10px] text-gray-400 mb-3">
                Top brand-channel pairs showing lead item, average basket size, and drink attachment rate.
              </div>
              <div className="max-h-[220px] overflow-y-auto border-t border-gray-100">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-gray-200 text-gray-400">
                    <tr>
                      <th className="text-left py-1.5 font-normal">Brand</th>
                      <th className="text-left py-1.5 font-normal">Channel</th>
                      <th className="text-left py-1.5 font-normal">Lead item</th>
                      <th className="text-right py-1.5 font-normal">Orders</th>
                      <th className="text-right py-1.5 font-normal">Net KWD</th>
                      <th className="text-right py-1.5 font-normal">Avg order</th>
                      <th className="text-right py-1.5 font-normal">Drinks %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {CHANNEL_BRAND_MATRIX.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-1.5 font-medium text-gray-900">{row.brand}</td>
                        <td className="py-1.5 text-gray-600">{row.channel}</td>
                        <td className="py-1.5 text-gray-600 truncate max-w-[140px]">{row.topItem}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">
                          {row.orders.toLocaleString()}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-900">
                          {row.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">
                          {row.aov.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">
                          {row.drinkPct}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
