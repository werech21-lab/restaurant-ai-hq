/** Approved October 2026 brand and channel figures (Odoo), shared by the scorecard page, its tabs and the filter model. */
import { VERIFIED_BRAND_TOTALS } from './verified-reconciliation'

export interface BrandRow {
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

export interface ChannelRow {
  channel: string;
  orders: number;
  netSales: number;
  share: number;
  avgOrder: number;
  itemsPerOrder: number;
  discountRate: number;
  /** Discount value in KWD; the 11 rows add up exactly to the official 4,152 */
  discountKwd: number;
  drinksPct: number;
  startersPct: number;
  dessertsPct: number;
}

/** Seed brand profile (mix ratios, attach rates, best sellers); totals are reconciled below. */
const SEED_BRANDS_DATA: BrandRow[] = [
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
    orders: 2147,
    netSales: 16033.97,
    share: 9.6,
    avgOrder: 7.47,
    itemsPerOrder: 3.01,
    discountRate: 1.4,
    drinksPct: 11.0,
    startersPct: 69.8,
    cogsPct: 26.2,
    bestSeller: "Orig. Philly CheeseSteak",
  },
  {
    brand: "Tahina",
    orders: 1944,
    netSales: 4428.64,
    share: 2.7,
    avgOrder: 2.28,
    itemsPerOrder: 2.75,
    discountRate: 1.0,
    drinksPct: 81.2,
    startersPct: 14.2,
    cogsPct: 23.5,
    bestSeller: "KWD 1 Chicken Shawarma - Lebanese Bread",
  },
  {
    brand: "Chick & Dip",
    orders: 847,
    netSales: 2664.18,
    share: 1.6,
    avgOrder: 3.15,
    itemsPerOrder: 2.13,
    discountRate: 1.2,
    drinksPct: 23.1,
    startersPct: 16.2,
    cogsPct: 25.1,
    bestSeller: "Crispy Strips Meal",
  },
  {
    brand: "Burgerito",
    orders: 269,
    netSales: 1678.22,
    share: 1,
    avgOrder: 6.24,
    itemsPerOrder: 2.75,
    discountRate: 4.9,
    drinksPct: 17.8,
    startersPct: 25.3,
    cogsPct: 24.9,
    bestSeller: "Smash Burgerito Combo",
  },
  {
    brand: "Crave",
    orders: 128,
    netSales: 624.5,
    share: 0.4,
    avgOrder: 4.88,
    itemsPerOrder: 4.83,
    discountRate: 0.0,
    drinksPct: 72.7,
    startersPct: 37.5,
    cogsPct: 21.8,
    bestSeller: "Artisan Melt Box (4 pcs)",
  },
];

/** 6 verified brands — net sales, orders, share and AOV reconciled to the approved ledger (167,092.160 KWD · 30,540 orders). */
export const BRANDS_DATA: BrandRow[] = SEED_BRANDS_DATA.map((b) => {
  const v = VERIFIED_BRAND_TOTALS[b.brand]
  return v ? { ...b, netSales: v.netSales, orders: v.orders, share: v.share, avgOrder: v.avgOrder } : b
})

export const CHANNELS_DATA: ChannelRow[] = [
  {
    channel: "Shop Sales",
    orders: 14818,
    netSales: 58953.09,
    share: 35.3,
    avgOrder: 3.98,
    itemsPerOrder: 2.34,
    discountRate: 0.8, discountKwd: 475.51,
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
    discountRate: 1.6, discountKwd: 902.66,
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
    discountRate: 6.7, discountKwd: 2544.0,
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
    discountRate: 1.6, discountKwd: 112.20,
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
    discountRate: 0.9, discountKwd: 48.75,
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
    discountRate: 0.1, discountKwd: 0.84,
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
    discountRate: 5.0, discountKwd: 54.31,
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
    discountRate: 0.0, discountKwd: 0.00,
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
    discountRate: 1.3, discountKwd: 10.41,
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
    discountRate: 0.0, discountKwd: 0.00,
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
    discountRate: 9.1, discountKwd: 3.32,
    drinksPct: 66.7,
    startersPct: 133.3,
    dessertsPct: 0.0,
  },
];
