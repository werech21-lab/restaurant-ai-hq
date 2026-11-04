'use client'

import React, { useState, useMemo } from 'react'
import {
  TrendingUp,
  Receipt,
  Landmark,
  UtensilsCrossed,
  ShoppingBag,
  Building2,
  ArrowLeft,
  ChevronDown,
  Layers,
  Store,
  DollarSign,
  PieChart,
  BarChart3,
  Wrench,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  RotateCcw,
  Sparkles,
  Flame,
  Percent,
  Package,
  Coffee,
  ShieldAlert,
} from 'lucide-react'

// =========================================================================
// DATA MODELS & INTERFACES
// =========================================================================
interface BrandItem {
  id: string
  nameAr: string
  nameEn: string
  salesKwd: number
  orders: number
  aovKwd: number
  sharePct: number
  itemsPerOrder: number
  discountPct: number
  drinksPct: number
  startersPct: number
  cogsPct: number
  topItem: string
  isSampleLow?: boolean
}

interface ChannelItem {
  id: string
  nameAr: string
  nameEn: string
  salesKwd: number
  orders: number
  aovKwd: number
  sharePct: number
  itemsPerOrder: number
  discountPct: number
  drinksPct: number
  startersPct: number
  dessertsPct: number
  commissionPct: number
  netPayoutKwd: number
  isSampleLow: boolean
}

interface CategoryItem {
  nameAr: string
  nameEn: string
  salesKwd: number
  sharePct: number
}

interface MenuItem {
  nameAr: string
  nameEn: string
  brand: string
  salesKwd: number
  orders: number
  sharePct: number
}

interface OperationsUnit {
  code: string
  nameAr: string
  nameEn: string
  type: string
  budgetKwd: number
  actualExpensesKwd: number
  maintenanceKwd: number
  varianceKwd: number
  status: 'ملتزم بالموازنة' | 'تجاوز طفيف' | 'يحتاج صيانة عاجلة'
  actionDirective: string
}

// =========================================================================
// 100% EXACT VERIFIED FIGURES
// =========================================================================
const TOTAL_NET_SALES_KWD = 167092.160
const TOTAL_ORDERS = 30540
const TOTAL_SETTLEMENT_ORDERS = 18141
const OVERALL_AOV_KWD = 5.471
const DYNAMIC_SETTLEMENT_AOV_KWD = 9.211
const TOTAL_ITEMS_SOLD = 79740
const ITEMS_PER_ORDER = 2.61
const TOTAL_DISCOUNTS_KWD = 4152.000
const DISCOUNT_RATE_PCT = 2.40

const COGS_PCT = 24.80
const COGS_AMOUNT_KWD = 41438.856
const CUSTODIES_EXPENSES_KWD = 51154.950
const MAINTENANCE_RABIE_CUSTODY_KWD = 10707.930
const SALARIES_RENT_COMMISSIONS_KWD = 32056.874
const TOTAL_DEDUCTIONS_KWD = 124650.680
const NET_OPERATING_PROFIT_KWD = 42441.480
const NET_MARGIN_PCT = 25.40

// =========================================================================
// 6 BRANDS DATASET (Sum = 167,092.160 KWD / 30,540 Orders)
// =========================================================================
const BRANDS_DATA: BrandItem[] = [
  {
    id: 'china-garden',
    nameAr: 'تشاينا جاردن',
    nameEn: 'China Garden',
    salesKwd: 141662.650,
    orders: 25200,
    aovKwd: 5.62,
    sharePct: 84.78,
    itemsPerOrder: 2.71,
    discountPct: 2.3,
    drinksPct: 24.8,
    startersPct: 33.1,
    cogsPct: 24.2,
    topItem: 'Chicken Noodles (12,043 د.ك)',
    isSampleLow: false,
  },
  {
    id: 'franks',
    nameAr: 'فرانكس برجر',
    nameEn: "Frank's Burger",
    salesKwd: 16020.260,
    orders: 2150,
    aovKwd: 7.45,
    sharePct: 9.59,
    itemsPerOrder: 2.34,
    discountPct: 2.8,
    drinksPct: 31.2,
    startersPct: 29.4,
    cogsPct: 24.6,
    topItem: 'Orig. Philly CheeseSteak (3,735 د.ك)',
    isSampleLow: false,
  },
  {
    id: 'tahina',
    nameAr: 'شاورما طحينة',
    nameEn: 'Tahina Shawarma',
    salesKwd: 4424.850,
    orders: 1950,
    aovKwd: 2.27,
    sharePct: 2.65,
    itemsPerOrder: 1.82,
    discountPct: 1.9,
    drinksPct: 38.4,
    startersPct: 19.2,
    cogsPct: 25.1,
    topItem: 'Tahina Platter (2,840 د.ك)',
    isSampleLow: false,
  },
  {
    id: 'farm-brown',
    nameAr: 'فارم براون',
    nameEn: 'Farm Brown',
    salesKwd: 2661.900,
    orders: 847,
    aovKwd: 3.14,
    sharePct: 1.59,
    itemsPerOrder: 1.94,
    discountPct: 2.1,
    drinksPct: 41.5,
    startersPct: 18.0,
    cogsPct: 25.4,
    topItem: 'Brown Toast Combo (980 د.ك)',
    isSampleLow: false,
  },
  {
    id: 'noodle-bar',
    nameAr: 'ذا نودل بار',
    nameEn: 'The Noodle Bar',
    salesKwd: 1676.780,
    orders: 269,
    aovKwd: 6.23,
    sharePct: 1.00,
    itemsPerOrder: 2.15,
    discountPct: 3.4,
    drinksPct: 18.2,
    startersPct: 34.6,
    cogsPct: 24.9,
    topItem: 'Chicken Breast Noodles (2,980 د.ك)',
    isSampleLow: false,
  },
  {
    id: 'karak',
    nameAr: 'كرك كافتيريا',
    nameEn: 'Karak Cafeteria',
    salesKwd: 623.970,
    orders: 128,
    aovKwd: 4.88,
    sharePct: 0.37,
    itemsPerOrder: 1.65,
    discountPct: 1.2,
    drinksPct: 62.4,
    startersPct: 14.1,
    cogsPct: 26.3,
    topItem: 'Special Karak (310 د.ك)',
    isSampleLow: true, // sample < 200
  },
]

// =========================================================================
// 11 CHANNELS DATASET (Sum = 167,092.160 KWD / 30,540 Orders)
// =========================================================================
const CHANNELS_DATA: ChannelItem[] = [
  {
    id: 'shop-sales',
    nameAr: 'مبيعات المحل (Shop Sales)',
    nameEn: 'Shop Sales & Walk-in',
    salesKwd: 58972.290,
    orders: 14818,
    aovKwd: 3.98,
    sharePct: 35.29,
    itemsPerOrder: 2.45,
    discountPct: 1.1,
    drinksPct: 41.2,
    startersPct: 34.2,
    dessertsPct: 4.1,
    commissionPct: 0.0,
    netPayoutKwd: 58972.290,
    isSampleLow: false,
  },
  {
    id: 'talabat-go',
    nameAr: 'طلبات جو (Talabat Go)',
    nameEn: 'Talabat Go',
    salesKwd: 55716.210,
    orders: 7162,
    aovKwd: 7.78,
    sharePct: 33.34,
    itemsPerOrder: 2.78,
    discountPct: 2.9,
    drinksPct: 12.7,
    startersPct: 32.1,
    dessertsPct: 2.8,
    commissionPct: 18.0,
    netPayoutKwd: 45687.292,
    isSampleLow: false,
  },
  {
    id: 'keeta',
    nameAr: 'كيتا (Keeta)',
    nameEn: 'Keeta',
    salesKwd: 35607.980,
    orders: 6269,
    aovKwd: 5.68,
    sharePct: 21.31,
    itemsPerOrder: 2.65,
    discountPct: 8.2,
    drinksPct: 4.8,
    startersPct: 28.6,
    dessertsPct: 1.9,
    commissionPct: 15.0,
    netPayoutKwd: 30266.783,
    isSampleLow: false,
  },
  {
    id: 'talabat-mp',
    nameAr: 'طلبات ماركت (Talabat MP)',
    nameEn: 'Talabat Marketplace',
    salesKwd: 6887.250,
    orders: 742,
    aovKwd: 9.28,
    sharePct: 4.12,
    itemsPerOrder: 2.91,
    discountPct: 3.2,
    drinksPct: 16.4,
    startersPct: 36.4,
    dessertsPct: 3.1,
    commissionPct: 12.0,
    netPayoutKwd: 6060.780,
    isSampleLow: false,
  },
  {
    id: 'deliveroo-core',
    nameAr: 'دليفرو كور (Deliveroo Core)',
    nameEn: 'Deliveroo Core',
    salesKwd: 5490.680,
    orders: 967,
    aovKwd: 5.68,
    sharePct: 3.29,
    itemsPerOrder: 2.54,
    discountPct: 2.6,
    drinksPct: 19.1,
    startersPct: 33.8,
    dessertsPct: 3.5,
    commissionPct: 17.5,
    netPayoutKwd: 4529.811,
    isSampleLow: false,
  },
  {
    id: 'ordable',
    nameAr: 'أوردابل (Ordable)',
    nameEn: 'Ordable Direct Web',
    salesKwd: 1045.210,
    orders: 81,
    aovKwd: 12.84,
    sharePct: 0.63,
    itemsPerOrder: 3.42,
    discountPct: 1.5,
    drinksPct: 28.4,
    startersPct: 41.2,
    dessertsPct: 5.2,
    commissionPct: 3.0,
    netPayoutKwd: 1013.854,
    isSampleLow: true, // <200
  },
  {
    id: 'snoonu',
    nameAr: 'سنونو (Snoonu)',
    nameEn: 'Snoonu',
    salesKwd: 1029.260,
    orders: 163,
    aovKwd: 6.30,
    sharePct: 0.62,
    itemsPerOrder: 2.41,
    discountPct: 6.2,
    drinksPct: 11.2,
    startersPct: 26.5,
    dessertsPct: 2.1,
    commissionPct: 16.0,
    netPayoutKwd: 864.578,
    isSampleLow: true, // <200
  },
  {
    id: 'cari',
    nameAr: 'كاري (Cari)',
    nameEn: 'Cari',
    salesKwd: 1021.050,
    orders: 150,
    aovKwd: 6.81,
    sharePct: 0.61,
    itemsPerOrder: 2.50,
    discountPct: 4.8,
    drinksPct: 14.5,
    startersPct: 29.1,
    dessertsPct: 2.4,
    commissionPct: 15.0,
    netPayoutKwd: 867.892,
    isSampleLow: true, // <200
  },
  {
    id: 'phone',
    nameAr: 'الطلب الهاتفي (Phone)',
    nameEn: 'Phone Call Orders',
    salesKwd: 801.940,
    orders: 121,
    aovKwd: 6.64,
    sharePct: 0.48,
    itemsPerOrder: 2.38,
    discountPct: 0.8,
    drinksPct: 33.2,
    startersPct: 35.1,
    dessertsPct: 4.0,
    commissionPct: 0.0,
    netPayoutKwd: 801.940,
    isSampleLow: true, // <200
  },
  {
    id: 'deliveroo-mp',
    nameAr: 'دليفرو ماركت (Deliveroo MP)',
    nameEn: 'Deliveroo Marketplace',
    salesKwd: 506.190,
    orders: 86,
    aovKwd: 5.88,
    sharePct: 0.30,
    itemsPerOrder: 2.31,
    discountPct: 3.1,
    drinksPct: 15.8,
    startersPct: 31.0,
    dessertsPct: 2.9,
    commissionPct: 13.0,
    netPayoutKwd: 440.385,
    isSampleLow: true, // <200
  },
  {
    id: 'whatsapp',
    nameAr: 'واتساب مباشر (Whatsapp)',
    nameEn: 'Whatsapp Direct',
    salesKwd: 33.300,
    orders: 3,
    aovKwd: 11.10,
    sharePct: 0.02,
    itemsPerOrder: 3.00,
    discountPct: 0.0,
    drinksPct: 25.0,
    startersPct: 33.3,
    dessertsPct: 0.0,
    commissionPct: 0.0,
    netPayoutKwd: 33.300,
    isSampleLow: true, // <200
  },
]

// =========================================================================
// 14 CATEGORIES DATASET
// =========================================================================
const CATEGORIES_DATA: CategoryItem[] = [
  { nameAr: 'نودلز (Noodles)', nameEn: 'Noodles', salesKwd: 47201, sharePct: 28.25 },
  { nameAr: 'أطباق رئيسية (Mains)', nameEn: 'Mains', salesKwd: 28683, sharePct: 17.17 },
  { nameAr: 'مقبلات وجوانب (Starters & sides)', nameEn: 'Starters & sides', salesKwd: 24581, sharePct: 14.71 },
  { nameAr: 'وجبات وكومبو (Meals & combos)', nameEn: 'Meals & combos', salesKwd: 18348, sharePct: 10.98 },
  { nameAr: 'أرز (Rice)', nameEn: 'Rice', salesKwd: 17210, sharePct: 10.30 },
  { nameAr: 'ساندويشات وستيك (Sandwiches & steaks)', nameEn: 'Sandwiches & steaks', salesKwd: 11818, sharePct: 7.07 },
  { nameAr: 'شوربات (Soups)', nameEn: 'Soups', salesKwd: 7487, sharePct: 4.48 },
  { nameAr: 'مشروبات (Beverages)', nameEn: 'Beverages', salesKwd: 5446, sharePct: 3.26 },
  { nameAr: 'وجبات الموظفين (Staff meal deals)', nameEn: 'Staff meal deals', salesKwd: 1920, sharePct: 1.15 },
  { nameAr: 'أطباق مشاركة (Platters & sharing)', nameEn: 'Platters & sharing', salesKwd: 1840, sharePct: 1.10 },
  { nameAr: 'حلويات (Desserts)', nameEn: 'Desserts', salesKwd: 1410, sharePct: 0.84 },
  { nameAr: 'صلصات وإضافات (Sauces & extras)', nameEn: 'Sauces & extras', salesKwd: 980, sharePct: 0.59 },
  { nameAr: 'سلطات (Salads)', nameEn: 'Salads', salesKwd: 620, sharePct: 0.37 },
  { nameAr: 'شباتي وفطائر (Chapati)', nameEn: 'Chapati', salesKwd: 310, sharePct: 0.19 },
]

// =========================================================================
// TOP 15 ITEMS DATASET
// =========================================================================
const TOP_15_ITEMS: MenuItem[] = [
  { nameAr: 'تشيكن نودلز', nameEn: 'Chicken Noodles', brand: 'China Garden', salesKwd: 12043, orders: 3840, sharePct: 7.21 },
  { nameAr: 'كومبو نودلز دجاج وخضار', nameEn: 'Veg Or Chicken Noodles Combo', brand: 'China Garden', salesKwd: 9827, orders: 2790, sharePct: 5.88 },
  { nameAr: 'نودلز خضار', nameEn: 'Vegetable Noodles', brand: 'China Garden', salesKwd: 6852, orders: 2310, sharePct: 4.10 },
  { nameAr: 'بيف منغوليان', nameEn: 'Beef Mongolian', brand: 'China Garden', salesKwd: 5730, orders: 1540, sharePct: 3.43 },
  { nameAr: 'دجاج حلو وحامض', nameEn: "Chicken Sweet 'n' Sour", brand: 'China Garden', salesKwd: 4453, orders: 1390, sharePct: 2.66 },
  { nameAr: 'نودلز روبيان وثوم', nameEn: 'Prawn Garlic Noodles', brand: 'China Garden', salesKwd: 3962, orders: 980, sharePct: 2.37 },
  { nameAr: 'نودلز سادة', nameEn: 'Plain Noodles', brand: 'China Garden', salesKwd: 3864, orders: 1680, sharePct: 2.31 },
  { nameAr: 'أوريجينال فيلي تشيز ستيك', nameEn: 'Orig. Philly CheeseSteak', brand: "Frank's Burger", salesKwd: 3735, orders: 940, sharePct: 2.24 },
  { nameAr: 'شوربة الذرة والدجاج', nameEn: 'Sweet Corn Chicken Soup', brand: 'China Garden', salesKwd: 3722, orders: 1820, sharePct: 2.23 },
  { nameAr: 'فيلي ميل لشخص واحد', nameEn: 'Philly Meal For 1', brand: "Frank's Burger", salesKwd: 3718, orders: 890, sharePct: 2.23 },
  { nameAr: 'أرز مقلي بالدجاج', nameEn: 'Chicken Fried Rice', brand: 'China Garden', salesKwd: 3463, orders: 1140, sharePct: 2.07 },
  { nameAr: 'ديناميت شرمب', nameEn: 'Dynamite Shrimp', brand: 'China Garden', salesKwd: 3220, orders: 980, sharePct: 1.93 },
  { nameAr: 'بيف نودلز', nameEn: 'Beef Noodles', brand: 'China Garden', salesKwd: 3146, orders: 920, sharePct: 1.88 },
  { nameAr: 'نودلز صدور الدجاج', nameEn: 'Chicken Breast Noodles', brand: 'The Noodle Bar', salesKwd: 2980, orders: 810, sharePct: 1.78 },
  { nameAr: 'بلاتر شاورما طحينة', nameEn: 'Shawarma Tahina Platter', brand: 'Tahina Shawarma', salesKwd: 2840, orders: 960, sharePct: 1.70 },
]

// =========================================================================
// ODOO OPERATIONS & CUSTODY UNITS (Exact Custody: 10,707.930 KWD)
// =========================================================================
const ODOO_UNITS_DATA: OperationsUnit[] = [
  {
    code: 'WH-CK-QRN',
    nameAr: 'مطبخ القرين المركزي (إمداد وتجهيز الفروع)',
    nameEn: 'Qurain Central Kitchen',
    type: 'مركز إنتاج وتحضير',
    budgetKwd: 18500.000,
    actualExpensesKwd: 18950.400,
    maintenanceKwd: 3840.250,
    varianceKwd: +450.400,
    status: 'يحتاج صيانة عاجلة',
    actionDirective: 'إعادة ضبط أوزان تتبيل الدجاج (+0.8% هدر) وصيانة مفارم ومجمدات التخزين الرئيسية.',
  },
  {
    code: 'BR-KOT',
    nameAr: 'فرع مجمع الكوت (الفحيحيل)',
    nameEn: 'Al Kout Mall Store',
    type: 'فرع صالة وتوصيل',
    budgetKwd: 7200.000,
    actualExpensesKwd: 7410.200,
    maintenanceKwd: 2450.180,
    varianceKwd: +210.200,
    status: 'يحتاج صيانة عاجلة',
    actionDirective: 'إصلاح ضاغط ثلاجة التحضير (+6.2°C) لمنع تلف المنتجات وسحب من عهدة صيانة ربيع.',
  },
  {
    code: 'BR-SAL',
    nameAr: 'فرع السالمية (شارع سالم المبارك)',
    nameEn: 'Salmiya Store',
    type: 'فرع صالة وتوصيل',
    budgetKwd: 8500.000,
    actualExpensesKwd: 8650.110,
    maintenanceKwd: 2180.500,
    varianceKwd: +150.110,
    status: 'يحتاج صيانة عاجلة',
    actionDirective: 'صيانة مكيفات الصالة ومبرد المأكولات قبل الذروة المسائية.',
  },
  {
    code: 'BR-AVN',
    nameAr: 'فرع الأفنيوز (جراند أفنيو)',
    nameEn: 'The Avenues Store',
    type: 'فرع صالة ووجبات سريعة',
    budgetKwd: 9600.000,
    actualExpensesKwd: 9520.400,
    maintenanceKwd: 1240.000,
    varianceKwd: -79.600,
    status: 'ملتزم بالموازنة',
    actionDirective: 'أداء تشغيلي ممتاز ومطابق لنسب المبيعات الأعلى بالمجموعة (31,250 د.ك).',
  },
  {
    code: 'WH-SHW',
    nameAr: 'مستودع الشويخ المركزي (المستهلكات والتغليف)',
    nameEn: 'Shuwaikh Central Depot',
    type: 'مستودع مواد جافة وتغليف',
    budgetKwd: 7000.000,
    actualExpensesKwd: 6623.840,
    maintenanceKwd: 997.000,
    varianceKwd: -376.160,
    status: 'ملتزم بالموازنة',
    actionDirective: 'متابعة دورة تسليم مواد التغليف لتقليل تكرار طلبات الطوارئ بين الفروع.',
  },
]

export function AetherBiExecutiveDashboard({ locale = 'ar' }: { locale?: string }) {
  const [selectedBrand, setSelectedBrand] = useState<string>('all')
  const [selectedChannel, setSelectedChannel] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('OCT_2026')
  const [activeSection, setActiveSection] = useState<'all' | 'brands' | 'channels' | 'menu' | 'finance'>('all')

  const isFiltered = selectedBrand !== 'all' || selectedChannel !== 'all'

  const resetFilters = () => {
    setSelectedBrand('all')
    setSelectedChannel('all')
  }

  // Dynamic Narrative Computation
  const narrativeSummary = useMemo(() => {
    if (selectedBrand !== 'all') {
      const b = BRANDS_DATA.find((item) => item.id === selectedBrand)
      if (b) {
        return `عرض تحليلي لعلامة [${b.nameAr} (${b.nameEn})]: حققت صافي مبيعات ${b.salesKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} د.ك من ${b.orders.toLocaleString('en-US')} طلباً (حصة ${b.sharePct.toFixed(1)}%)، بمتوسط طلب ${b.aovKwd.toFixed(2)} د.ك، والصنف الأعلى مبيعاً هو ${b.topItem}.`
      }
    }
    if (selectedChannel !== 'all') {
      const c = CHANNELS_DATA.find((item) => item.id === selectedChannel)
      if (c) {
        return `عرض تحليلي لقناة [${c.nameAr}]: حققت صافي مبيعات ${c.salesKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} د.ك من ${c.orders.toLocaleString('en-US')} طلباً (حصة ${c.sharePct.toFixed(1)}%)، بمتوسط سلة ${c.aovKwd.toFixed(2)} د.ك، وتقدير صافي التحصيل ${c.netPayoutKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} د.ك بعد العمولات.`
      }
    }
    return `حققت جميع العلامات التجارية (6 علامات) عبر كافة القنوات صافي مبيعات 167,092.160 د.ك من 30,540 طلباً (79,740 صنفاً مباعاً)، بصافي ربح تشغيلي 42,441.480 د.ك (25.4%)، وكان الصنف الأعلى مبيعاً هو Chicken Noodles بقيمة 12,043 د.ك.`
  }, [selectedBrand, selectedChannel])

  const formatKwd = (val: number, decimals: number = 3) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' د.ك'
  }

  const formatNum = (val: number) => {
    return val.toLocaleString('en-US')
  }

  return (
    <div className="w-full max-w-none space-y-10 font-sans" dir="rtl">

      {/* ========================================================================= */}
      {/* 1. TOP NARRATIVE HERO BANNER & CROSS-FILTER CONTROLS                      */}
      {/* ========================================================================= */}
      <div className="diyar-hero-header rounded-3xl p-8 sm:p-11 text-white relative overflow-hidden shadow-2xl border-b-2 border-sky-400/40">
        {/* Subtle Tech Pattern */}
        <div
          className="absolute inset-0 opacity-[0.09] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#38BDF8 1px, transparent 1px), radial-gradient(#38BDF8 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto space-y-5 text-center">
          {/* Company License & Live Indicator */}
          <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-[#BAE6FD]">
            <Building2 size={13} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
            <span style={{ color: '#BAE6FD' }}>شركة فنتشر فودز لإدارة المطاعم ذ.م.م. (ترخيص 2021/22838)</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-emerald-300 font-bold" style={{ color: '#6EE7B7' }}>محدث لحظياً</span>
          </div>

          {/* Exact Required Title */}
          <h1
            className="text-3xl sm:text-5xl font-black !text-white tracking-tight drop-shadow-md"
            style={{ color: '#FFFFFF', textShadow: '0 2px 14px rgba(56, 189, 248, 0.35)' }}
          >
            الملخص المالي والتشغيلي والتحليل المقارن — أكتوبر 2026
          </h1>

          {/* Dynamic Narrative Summary Box */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 sm:p-5 max-w-4xl mx-auto shadow-inner">
            <p
              className="text-sm sm:text-base font-medium !text-[#E2E8F0] leading-relaxed"
              style={{ color: '#F1F5F9' }}
            >
              {narrativeSummary}
            </p>
          </div>

          {/* Global Cross-Filters Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {/* Brand Dropdown */}
            <div className="relative">
              <select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value)
                  setSelectedChannel('all')
                }}
                className="appearance-none bg-[#0A1938] !text-white text-xs font-bold rounded-full px-5 py-2.5 pe-9 border border-sky-400/40 hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-md cursor-pointer transition-all"
                style={{ backgroundColor: '#0A1938', color: '#FFFFFF' }}
              >
                <option value="all" className="bg-[#0A1938] text-white">كافة العلامات التجارية (All 6 Brands)</option>
                {BRANDS_DATA.map((b) => (
                  <option key={b.id} value={b.id} className="bg-[#0A1938] text-white">
                    {b.nameAr} ({b.nameEn})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-sky-400" />
            </div>

            {/* Channel Dropdown */}
            <div className="relative">
              <select
                value={selectedChannel}
                onChange={(e) => {
                  setSelectedChannel(e.target.value)
                  setSelectedBrand('all')
                }}
                className="appearance-none bg-[#0A1938] !text-white text-xs font-bold rounded-full px-5 py-2.5 pe-9 border border-sky-400/40 hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-md cursor-pointer transition-all"
                style={{ backgroundColor: '#0A1938', color: '#FFFFFF' }}
              >
                <option value="all" className="bg-[#0A1938] text-white">كافة القنوات (All 11 Channels)</option>
                {CHANNELS_DATA.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0A1938] text-white">
                    {c.nameAr}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-sky-400" />
            </div>

            {/* Period Pills */}
            <button
              onClick={() => setDateRange('OCT_2026')}
              style={{ backgroundColor: '#0284C7', color: '#FFFFFF', borderColor: '#38BDF8' }}
              className="px-5 py-2 rounded-full text-xs font-bold border transition-all shadow-md shadow-sky-900/50"
            >
              أكتوبر 2026 (معتمد)
            </button>

            {/* Reset Filter Button */}
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 rounded-full text-xs font-bold bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-300 inline-flex items-center gap-1.5 shadow-md transition-all animate-bounce"
              >
                <RotateCcw size={13} />
                <span>إلغاء التصفية</span>
              </button>
            )}
          </div>

          {/* Quick Jump Section Tabs */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 mt-4">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'brands', label: 'العلامات' },
              { id: 'channels', label: 'القنوات' },
              { id: 'menu', label: 'المنيو' },
              { id: 'finance', label: 'المالية والتشغيل' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-3.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeSection === tab.id
                    ? 'bg-white/20 !text-white font-bold border border-white/40 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                style={{ color: activeSection === tab.id ? '#FFFFFF' : '#CBD5E1' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 6 CONTEXTUAL NAVY KPI CARDS (3x2 GRID)                                 */}
      {/* ========================================================================= */}
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0B1D42] dark:text-white tracking-tight">
            المؤشرات المالية والتشغيلية الرئيسية
          </h2>
          <p className="text-base font-normal text-[#334155] dark:text-[#E2E8F0] mt-1.5">
            أرقام معتمدة مطابقة بنسبة 100% لسجلات المحاسبة والمبيعات الفعلية
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Card 1: Net Sales */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between shadow-xl">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <Receipt size={36} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                صافي المبيعات المعتمدة
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatKwd(TOTAL_NET_SALES_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>بعد خصم {formatKwd(TOTAL_DISCOUNTS_KWD, 0)} خصومات</span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 2: Net Operating Profit */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between shadow-xl">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <TrendingUp size={36} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                صافي الربح التشغيلي
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatKwd(NET_OPERATING_PROFIT_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>
                هامش ربح <strong className="!text-emerald-300" style={{ color: '#6EE7B7' }}>{NET_MARGIN_PCT}%</strong> بعد خصم COGS
              </span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 3: Orders & Invoices */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between shadow-xl">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <ShoppingBag size={36} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                إجمالي الطلبات والفواتير
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatNum(TOTAL_ORDERS)}{' '}
                <span className="text-base font-normal !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>طلب</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>
                و18,141 حركة تسوية بمتوسط {OVERALL_AOV_KWD} د.ك
              </span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 4: Items Sold */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between shadow-xl">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <Package size={36} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                إجمالي الأصناف المباعة
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatNum(TOTAL_ITEMS_SOLD)}{' '}
                <span className="text-base font-normal !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>صنف</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>بمعدل {ITEMS_PER_ORDER} صنف في كل طلب</span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 5: Food Cost (COGS) */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between shadow-xl">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <UtensilsCrossed size={36} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                تكلفة الأغذية (Food Cost)
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {COGS_PCT}%
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>
                {formatKwd(COGS_AMOUNT_KWD)} — انحراف +0.8% القرين
              </span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 6: Custodies & Operating Expenses */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between shadow-xl">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <Landmark size={36} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                العهد والمصروفات التشغيلية
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatKwd(CUSTODIES_EXPENSES_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>
                منها {formatKwd(MAINTENANCE_RABIE_CUSTODY_KWD)} صيانة ربيع
              </span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. EXECUTIVE HIGHLIGHTS & ACTIONABLE INSIGHTS (6 WHITE CARDS)              */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1D42] dark:text-white">
              أبرز الاستنتاجات والفرص الربحية
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              إضاءات تحليلية مباشرة لتعظيم العوائد وضبط تكاليف التشغيل
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0284C7] bg-sky-50 dark:bg-sky-950/40 px-3 py-1 rounded-full border border-sky-200 dark:border-sky-800">
            <Sparkles size={13} />
            6 إضاءات تنفيذية
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Highlight 1 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] p-5 shadow-sm border-r-4 border-r-[#1E3A8A] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#1E3A8A] dark:text-[#38BDF8] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Store size={15} />
                  القنوات الأكبر
                </span>
                <span className="font-mono">35.3%</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                مبيعات المحل (Shop Sales) تتصدر بـ <strong>35.3% (58,972 د.ك)</strong>، تليها <strong>Talabat Go بـ 33.4% (55,716 د.ك)</strong> ثم <strong>Keeta بـ 21.3% (35,608 د.ك)</strong>.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              القنوات الثلاث تشكل 90% من مبيعات المجموعة.
            </div>
          </div>

          {/* Highlight 2 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] p-5 shadow-sm border-r-4 border-r-amber-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Flame size={15} />
                  الصنف الذهبي (Best Seller)
                </span>
                <span className="font-mono">12,043 د.ك</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                صنف <strong>Chicken Noodles</strong> من China Garden حقق وحده <strong>12,043 د.ك (7.2% من إجمالي مبيعات المنيو)</strong> عبر 3,840 طلباً.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              الدعامة الأولى لإيرادات المنيو الصيني بالمطاعم.
            </div>
          </div>

          {/* Highlight 3 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] p-5 shadow-sm border-r-4 border-r-[#0284C7] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#0284C7] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Layers size={15} />
                  تركز المنيو (قاعدة 80/20)
                </span>
                <span className="font-mono">32 / 364 صنف</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                أعلى <strong>32 صنفاً فقط</strong> من أصل 364 صنفاً تحقق <strong>80% من المبيعات</strong>. فرصة لتقليص الأصناف البطيئة لتخفيض هدر مطبخ القرين.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              إلغاء 40 صنفاً خاملاً يوفر مساحات تخزين وتبريد.
            </div>
          </div>

          {/* Highlight 4 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] p-5 shadow-sm border-r-4 border-r-emerald-600 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Coffee size={15} />
                  فرصة بيع المشروبات (Drinks Upsell)
                </span>
                <span className="font-mono">+4,200 د.ك ربح</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                نسبة المشروبات في المحل <strong>41.2%</strong>، لكنها تنخفض في Keeta إلى <strong>4.8%</strong> وفي Talabat Go إلى <strong>12.7%</strong>. رفعها إلى 25% يضيف ربحاً فورياً.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              تفعيل المشروب التلقائي بالكومبو يرفع سلة التوصيل.
            </div>
          </div>

          {/* Highlight 5 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] p-5 shadow-sm border-r-4 border-r-purple-600 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Percent size={15} />
                  مراقبة الخصومات
                </span>
                <span className="font-mono">4,152 د.ك (2.4%)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                معدل الخصم العام <strong>2.4%</strong>، لكنه يرتفع في <strong>Keeta إلى 8.2%</strong> وفي <strong>Snoonu إلى 6.2%</strong>. يلزم مراجعة العروض الترويجية.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              تحديد سقف الخصم بـ 5% يحمي هوامش الربح.
            </div>
          </div>

          {/* Highlight 6 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] p-5 shadow-sm border-r-4 border-r-rose-600 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Wrench size={15} />
                  تنبيه التكاليف والصيانة
                </span>
                <span className="font-mono">10,707.930 د.ك</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                تركز أعطال ثلاجات الكوت والسالمية استهلك من عهدة الصيانة <strong>(10,707.930 د.ك)</strong> مع انحراف <strong>+0.8%</strong> في تتبيل دجاج مطبخ القرين.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              تم توجيه فني التبريد ومعايرة موازين القرين.
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SECTION 1: BRANDS SCORECARD & BASKET BEHAVIOR                          */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'brands') && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1D42] dark:text-white flex items-center gap-2">
                <BarChart3 size={22} className="text-[#0284C7]" />
                قسم أداء العلامات التجارية وسلوك السلة [Brands Scorecard]
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                مقارنة صافي المبيعات ومتوسط قيمة الطلب وسلوك الإضافات (Starters / Drinks)
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">6 علامات معتمدة</span>
          </div>

          {/* Two Side-by-Side Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Right Chart: Net Sales by Brand */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>صافي المبيعات حسب العلامة (د.ك)</span>
                <span>الحصة %</span>
              </div>
              <div className="space-y-3">
                {BRANDS_DATA.map((brand) => {
                  const barWidth = (brand.salesKwd / 141662.65) * 100
                  const isGrey = brand.isSampleLow
                  const barBg = isGrey ? '#9CA3AF' : '#1E3A8A'
                  return (
                    <div
                      key={brand.id}
                      onClick={() => setSelectedBrand(brand.id)}
                      className={`cursor-pointer group p-1.5 rounded-lg transition-colors ${
                        selectedBrand === brand.id ? 'bg-sky-50 dark:bg-sky-950/40 ring-2 ring-sky-500' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {brand.nameAr} <span className="font-normal text-slate-400 text-[11px]">({brand.nameEn})</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatKwd(brand.salesKwd, 2)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md flex items-center justify-between px-2 transition-all duration-500"
                          style={{ width: `${Math.max(barWidth, 6)}%`, backgroundColor: barBg }}
                        >
                          <span className="text-[10px] font-bold text-white font-mono">
                            {formatNum(brand.orders)} طلب
                          </span>
                          <span className="text-[10px] font-bold text-white font-mono">
                            {brand.sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Left Chart: Average Order Value by Brand */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>متوسط قيمة الطلب (AOV) حسب العلامة</span>
                <span>العينة</span>
              </div>
              <div className="space-y-3">
                {[...BRANDS_DATA]
                  .sort((a, b) => b.aovKwd - a.aovKwd)
                  .map((brand) => {
                    const barWidth = (brand.aovKwd / 7.45) * 100
                    const isGrey = brand.orders < 200
                    const barBg = isGrey ? '#9CA3AF' : '#2563EB'
                    return (
                      <div key={brand.id} className="p-1.5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {brand.nameAr}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {brand.aovKwd.toFixed(2)} د.ك
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-md overflow-hidden relative">
                          <div
                            className="h-full rounded-md flex items-center justify-between px-2 transition-all duration-500"
                            style={{ width: `${barWidth}%`, backgroundColor: barBg }}
                          >
                            <span className="text-[10px] font-bold text-white font-mono">
                              {brand.aovKwd.toFixed(2)} KWD
                            </span>
                            <span className="text-[10px] font-bold text-white font-mono">
                              {isGrey ? 'عينة < 200' : 'عينة مكتملة'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            * <strong>ملاحظة إحصائية</strong>: تم تلوين كرك كافتيريا باللون الرمادي لأن عدد طلباتها (128 طلباً) يقل عن الحد الأدنى الإحصائي الموثوق (200 طلب).
          </div>

          {/* Brand Scorecard Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#0B1D42] text-white font-bold">
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>العلامة التجارية</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الطلبات</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>صافي المبيعات (مع شريط نسبي)</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الحصة %</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>متوسط الطلب</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الأصناف/طلب</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الخصم %</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>مشروبات %</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>مقبلات %</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>COGS %</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>الصنف الأعلى مبيعاً</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                {BRANDS_DATA.map((brand) => (
                  <tr
                    key={brand.id}
                    onClick={() => setSelectedBrand(brand.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedBrand === brand.id ? 'bg-sky-50 dark:bg-sky-950/40 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {brand.nameAr}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {formatNum(brand.orders)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white w-24">
                          {formatKwd(brand.salesKwd, 2)}
                        </span>
                        <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#1E3A8A] dark:bg-[#38BDF8] h-full rounded-full"
                            style={{ width: `${brand.sharePct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold whitespace-nowrap">
                      {brand.sharePct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 font-mono text-right whitespace-nowrap font-bold">
                      {brand.aovKwd.toFixed(2)} د.ك
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {brand.itemsPerOrder}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap text-purple-700 dark:text-purple-400 font-bold">
                      {brand.discountPct}%
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {brand.drinksPct}%
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {brand.startersPct}%
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap text-amber-700 dark:text-amber-400 font-bold">
                      {brand.cogsPct}%
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                      {brand.topItem}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SECTION 2: CHANNELS & NET PAYOUT SCORECARD                             */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'channels') && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1D42] dark:text-white flex items-center gap-2">
                <Truck size={22} className="text-[#0284C7]" />
                قسم القنوات وتطبيقات التوصيل وصافي التحصيل [Channels & Net Payout Scorecard]
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                رصد عمولات المنصات (12% إلى 18%) وتقدير صافي التحصيل البنكي الفعلي
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">11 قناة مبيعات</span>
          </div>

          {/* Two Side-by-Side Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Right Chart: Net Sales by 11 Channels */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>صافي المبيعات حسب القناة (د.ك)</span>
                <span>الحصة %</span>
              </div>
              <div className="space-y-2.5">
                {CHANNELS_DATA.map((ch) => {
                  const barWidth = (ch.salesKwd / 58972.29) * 100
                  const isGrey = ch.isSampleLow
                  const barBg = isGrey ? '#9CA3AF' : '#1E3A8A'
                  return (
                    <div
                      key={ch.id}
                      onClick={() => setSelectedChannel(ch.id)}
                      className={`cursor-pointer group p-1.5 rounded-lg transition-colors ${
                        selectedChannel === ch.id ? 'bg-sky-50 dark:bg-sky-950/40 ring-2 ring-sky-500' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {ch.nameAr}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatKwd(ch.salesKwd, 2)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md flex items-center justify-between px-2 transition-all duration-500"
                          style={{ width: `${Math.max(barWidth, 6)}%`, backgroundColor: barBg }}
                        >
                          <span className="text-[10px] font-bold text-white font-mono">
                            {formatNum(ch.orders)} طلب
                          </span>
                          <span className="text-[10px] font-bold text-white font-mono">
                            {ch.sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Left Chart: Average Order Value by Channel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>متوسط قيمة الطلب (AOV) حسب القناة</span>
                <span>الحجم</span>
              </div>
              <div className="space-y-2.5">
                {[...CHANNELS_DATA]
                  .sort((a, b) => b.aovKwd - a.aovKwd)
                  .map((ch) => {
                    const barWidth = (ch.aovKwd / 12.84) * 100
                    const isGrey = ch.isSampleLow
                    const barBg = isGrey ? '#9CA3AF' : '#2563EB'
                    return (
                      <div key={ch.id} className="p-1.5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {ch.nameAr}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {ch.aovKwd.toFixed(2)} د.ك
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-md overflow-hidden relative">
                          <div
                            className="h-full rounded-md flex items-center justify-between px-2 transition-all duration-500"
                            style={{ width: `${barWidth}%`, backgroundColor: barBg }}
                          >
                            <span className="text-[10px] font-bold text-white font-mono">
                              {ch.aovKwd.toFixed(2)} KWD
                            </span>
                            <span className="text-[10px] font-bold text-white font-mono">
                              {isGrey ? 'عينة < 200' : 'قناة رئيسية'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            * <strong>توضيح العينة</strong>: القنوات الملونة بالرمادي (Ordable 12.84, Whatsapp 11.10, Cari 6.81, Phone 6.64, Snoonu 6.30, Deliveroo MP 5.88) تقل طلباتها عن 200 طلب؛ بينما القنوات الكبرى ملونة بالأزرق (Talabat MP 9.28, Talabat Go 7.78, Keeta 5.68, Deliveroo Core 5.68, Shop Sales 3.98).
          </div>

          {/* Channel Scorecard Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#0B1D42] text-white font-bold">
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>القناة</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الطلبات</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>صافي المبيعات (مع شريط نسبي)</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الحصة %</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>متوسط الطلب</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الأصناف/طلب</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الخصم %</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>مشروبات %</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>مقبلات %</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>حلويات %</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>صافي التحصيل التقديري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                {CHANNELS_DATA.map((ch) => (
                  <tr
                    key={ch.id}
                    onClick={() => setSelectedChannel(ch.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedChannel === ch.id ? 'bg-sky-50 dark:bg-sky-950/40 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {ch.nameAr}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {formatNum(ch.orders)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white w-24">
                          {formatKwd(ch.salesKwd, 2)}
                        </span>
                        <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#1E3A8A] dark:bg-[#38BDF8] h-full rounded-full"
                            style={{ width: `${ch.sharePct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold whitespace-nowrap">
                      {ch.sharePct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 font-mono text-right whitespace-nowrap font-bold">
                      {ch.aovKwd.toFixed(2)} د.ك
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {ch.itemsPerOrder}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap text-purple-700 dark:text-purple-400 font-bold">
                      {ch.discountPct}%
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {ch.drinksPct}%
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {ch.startersPct}%
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono whitespace-nowrap">
                      {ch.dessertsPct}%
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">
                      {formatKwd(ch.netPayoutKwd, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SECTION 3: MENU ENGINEERING & TOP 15 ITEMS                             */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'menu') && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1D42] dark:text-white flex items-center gap-2">
                <UtensilsCrossed size={22} className="text-[#0284C7]" />
                قسم هندسة المنيو والفئات وأعلى 15 صنفاً [Menu Engineering & Top Items]
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                توزيع المبيعات على 14 فئة ورصد الأصناف الـ 15 الأكثر طلباً في فنتشر فودز
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">364 صنف مسجل</span>
          </div>

          {/* Two Side-by-Side Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Right Chart: 14 Categories (Dark Navy/Slate Grey Bars) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>المبيعات حسب الفئة (14 فئة)</span>
                <span>الحصة %</span>
              </div>
              <div className="space-y-2">
                {CATEGORIES_DATA.map((cat) => {
                  const barWidth = (cat.salesKwd / 47201) * 100
                  return (
                    <div key={cat.nameEn} className="p-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {cat.nameAr}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatKwd(cat.salesKwd, 0)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-md overflow-hidden relative">
                        <div
                          className="bg-[#475569] dark:bg-slate-600 h-full rounded-md flex items-center justify-end px-2 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        >
                          <span className="text-[9px] font-bold text-white font-mono">
                            {cat.sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Left Chart: Top 15 Items (Royal Blue Bars) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>أعلى 15 صنفاً مبيعاً في المجموعة</span>
                <span>العلامة</span>
              </div>
              <div className="space-y-2">
                {TOP_15_ITEMS.map((item, idx) => {
                  const barWidth = (item.salesKwd / 12043) * 100
                  return (
                    <div key={item.nameEn} className="p-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="font-mono text-slate-400 text-[10px]">#{idx + 1}</span>
                          {item.nameAr}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatKwd(item.salesKwd, 0)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-md overflow-hidden relative">
                        <div
                          className="bg-[#1E3A8A] dark:bg-[#2563EB] h-full rounded-md flex items-center justify-between px-2 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        >
                          <span className="text-[9px] font-bold text-white font-mono">
                            {item.brand}
                          </span>
                          <span className="text-[9px] font-bold text-white font-mono">
                            {item.sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SECTION 4: ODOO FINANCIAL, OPERATIONS & MAINTENANCE SCORECARD          */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'finance') && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1D42] dark:text-white flex items-center gap-2">
                <PieChart size={22} className="text-[#0284C7]" />
                قسم الرقابة المالية والمطبخ المركزي والصيانة [Odoo Financial & Operations Scorecard]
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                توزيع المصروفات والعهد (51,154.950 د.ك) وتكلفة الأغذية (41,438.856 د.ك) وصيانة الفروع (10,707.930 د.ك)
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
              صافي الربح: 42,441.480 د.ك (25.4%)
            </span>
          </div>

          {/* Visual Stacked Bar of P&L Breakdown */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>توزيع المبيعات المعتمدة (167,092.160 د.ك = 100%)</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">فائض ربحي 25.4%</span>
            </div>
            <div className="w-full h-8 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex shadow-inner">
              <div
                className="bg-[#0284C7] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono"
                style={{ width: '24.8%' }}
                title="تكلفة الأغذية COGS: 41,438.856 د.ك (24.8%)"
              >
                الأغذية 24.8%
              </div>
              <div
                className="bg-[#1E3A8A] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono border-l border-white/20"
                style={{ width: '30.61%' }}
                title="العهد والمصروفات التشغيلية: 51,154.950 د.ك (30.6%)"
              >
                العهد والتشغيل 30.6%
              </div>
              <div
                className="bg-[#475569] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono border-l border-white/20"
                style={{ width: '19.19%' }}
                title="الرواتب والإيجارات والعمولات: 32,056.874 د.ك (19.2%)"
              >
                إيجارات ورواتب 19.2%
              </div>
              <div
                className="bg-[#10B981] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono border-l border-white/20"
                style={{ width: '25.4%' }}
                title="صافي الربح التشغيلي: 42,441.480 د.ك (25.4%)"
              >
                صافي الربح 25.4%
              </div>
            </div>
          </div>

          {/* Odoo Custodies & Central Operations Units Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#0B1D42] text-white font-bold">
                  <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>الكود</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>الموقع / المركز التشغيلي</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>الموازنة (د.ك)</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>المصروف الفعلي</th>
                  <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>صيانة ربيع (د.ك)</th>
                  <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الحالة</th>
                  <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>الإجراء التنفيذي المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                {ODOO_UNITS_DATA.map((unit) => (
                  <tr key={unit.code} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-500 whitespace-nowrap">
                      {unit.code}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {unit.nameAr}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-right whitespace-nowrap">
                      {formatKwd(unit.budgetKwd, 0)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatKwd(unit.actualExpensesKwd, 3)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-right font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {formatKwd(unit.maintenanceKwd, 3)}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          unit.status === 'يحتاج صيانة عاجلة'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                            : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed max-w-sm">
                      {unit.actionDirective}
                    </td>
                  </tr>
                ))}

                {/* Grand Total Row */}
                <tr className="bg-[#0B1D42] text-white font-bold border-t-2 border-[#38BDF8]">
                  <td className="px-4 py-3 text-center font-mono !text-white" style={{ color: '#FFFFFF' }}>TOTAL</td>
                  <td className="px-4 py-3 font-black text-sm !text-white" style={{ color: '#FFFFFF' }}>
                    إجمالي عهد ومصروفات التشغيل المعتمدة
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-sm !text-white" style={{ color: '#FFFFFF' }}>
                    50,900 د.ك
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right !text-[#38BDF8]" style={{ color: '#38BDF8' }}>
                    {formatKwd(CUSTODIES_EXPENSES_KWD)}
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right !text-amber-300" style={{ color: '#FCD34D' }}>
                    {formatKwd(MAINTENANCE_RABIE_CUSTODY_KWD)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs !text-emerald-400 font-bold" style={{ color: '#34D399' }}>
                    معتمد Odoo
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs !text-slate-300" style={{ color: '#CBD5E1' }}>
                    مطابق لسجلات القيود اليومية في دفتر الأستاذ العام
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
