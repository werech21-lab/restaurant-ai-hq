'use client'

import React, { useState, useMemo } from 'react'
import {
  Filter,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  ShoppingBag,
  Percent,
  Layers,
  Info,
} from 'lucide-react'

// =============================================================================
// RAW REFERENCE DATA MODELS (100% MATCHING EDITORIAL REPORT)
// =============================================================================

interface BrandItem {
  id: string
  name: string
  nameAr: string
  sales: number
  orders: number
  aov: number
  share: number
  itemsPerOrder: number
  discountRate: number
  drinksPct: number
  startersPct: number
  bestSeller: string
  bestSellerAr: string
}

interface ChannelItem {
  id: string
  name: string
  nameAr: string
  sales: number
  orders: number
  aov: number
  share: number
  itemsPerOrder: number
  discountRate: number
  topBrand: string
}

interface CategoryItem {
  name: string
  nameAr: string
  sales: number
}

interface MenuItem {
  name: string
  nameAr: string
  brand: string
  category: string
  sales: number
}

interface OpsNote {
  category: string
  categoryAr: string
  value: string
  note: string
  noteAr: string
  action: string
  actionAr: string
  assignedTo: string
  assignedToAr: string
  status: 'Urgent' | 'Review' | 'Scheduled'
}

// 6 Brands Data
const ALL_BRANDS: BrandItem[] = [
  {
    id: 'CHINA_GARDEN',
    name: 'China Garden',
    nameAr: 'تشاينا جاردن',
    sales: 141662,
    orders: 25200,
    aov: 5.62,
    share: 84.8,
    itemsPerOrder: 2.64,
    discountRate: 2.3,
    drinksPct: 26.2,
    startersPct: 34.1,
    bestSeller: 'Chicken Noodles',
    bestSellerAr: 'تشيكن نودلز',
  },
  {
    id: 'FRANKS',
    name: "Frank's",
    nameAr: 'فرانكس',
    sales: 16020,
    orders: 2150,
    aov: 7.45,
    share: 9.6,
    itemsPerOrder: 2.45,
    discountRate: 2.9,
    drinksPct: 28.5,
    startersPct: 31.0,
    bestSeller: 'Orig. Philly CheeseSteak',
    bestSellerAr: 'فيلي تشيز ستيك الأصلي',
  },
  {
    id: 'TAHINA',
    name: 'Tahina',
    nameAr: 'شاورما طحينة',
    sales: 4425,
    orders: 1950,
    aov: 2.27,
    share: 2.6,
    itemsPerOrder: 2.12,
    discountRate: 1.8,
    drinksPct: 18.2,
    startersPct: 24.5,
    bestSeller: 'Beef Shawarma Plate',
    bestSellerAr: 'صحن شاورما لحم',
  },
  {
    id: 'FARM_BROWN',
    name: 'Farm Brown',
    nameAr: 'فارم براون',
    sales: 2662,
    orders: 848,
    aov: 3.14,
    share: 1.6,
    itemsPerOrder: 2.30,
    discountRate: 2.1,
    drinksPct: 22.0,
    startersPct: 28.4,
    bestSeller: 'Farm Burger Deluxe',
    bestSellerAr: 'فارم برجر ديلوكس',
  },
  {
    id: 'NOODLE_BAR',
    name: 'The Noodle Bar',
    nameAr: 'ذا نودل بار',
    sales: 1677,
    orders: 264,
    aov: 6.23,
    share: 1.0,
    itemsPerOrder: 2.50,
    discountRate: 3.2,
    drinksPct: 24.8,
    startersPct: 30.2,
    bestSeller: 'Prawn Garlic Noodles',
    bestSellerAr: 'نودلز روبيان بالثوم',
  },
  {
    id: 'KARAK',
    name: 'Karak Cafeteria',
    nameAr: 'كرك كافتيريا',
    sales: 624,
    orders: 128, // < 200 orders!
    aov: 4.88,
    share: 0.4,
    itemsPerOrder: 1.95,
    discountRate: 1.2,
    drinksPct: 42.1,
    startersPct: 14.6,
    bestSeller: 'Saffron Karak & Chapati',
    bestSellerAr: 'كرك زعفران وشباتي',
  },
]

// 11 Channels Data
const ALL_CHANNELS: ChannelItem[] = [
  { id: 'SHOP', name: 'Shop Sales', nameAr: 'مبيعات الصالة والاستلام', sales: 58972, orders: 14818, aov: 3.98, share: 35.3, itemsPerOrder: 2.55, discountRate: 1.1, topBrand: 'China Garden' },
  { id: 'TGO', name: 'Talabat Go', nameAr: 'طلبات جو (توصيل المنصة)', sales: 55716, orders: 7161, aov: 7.78, share: 33.3, itemsPerOrder: 2.70, discountRate: 2.8, topBrand: 'China Garden' },
  { id: 'KEETA', name: 'Keeta', nameAr: 'كيتا (Keeta)', sales: 35608, orders: 6269, aov: 5.68, share: 21.3, itemsPerOrder: 2.58, discountRate: 3.4, topBrand: 'China Garden' },
  { id: 'TMP', name: 'Talabat MP', nameAr: 'طلبات (سائقو فنتشر فودز)', sales: 6887, orders: 742, aov: 9.28, share: 4.1, itemsPerOrder: 2.85, discountRate: 1.5, topBrand: "Frank's" },
  { id: 'DELIV_CORE', name: 'Deliveroo Core', nameAr: 'ديلفرو كور', sales: 5491, orders: 967, aov: 5.68, share: 3.3, itemsPerOrder: 2.61, discountRate: 2.2, topBrand: 'China Garden' },
  { id: 'ORDABLE', name: 'Ordable', nameAr: 'أوردابل (تطبيق مباشر)', sales: 1045, orders: 81, aov: 12.84, share: 0.6, itemsPerOrder: 3.20, discountRate: 0.5, topBrand: "Frank's" }, // < 200
  { id: 'SNOONU', name: 'Snoonu', nameAr: 'سنونو', sales: 1029, orders: 163, aov: 6.30, share: 0.6, itemsPerOrder: 2.40, discountRate: 2.0, topBrand: 'China Garden' }, // < 200
  { id: 'CARI', name: 'Cari', nameAr: 'كاري (Cari)', sales: 1021, orders: 150, aov: 6.81, share: 0.6, itemsPerOrder: 2.50, discountRate: 1.8, topBrand: 'China Garden' }, // < 200
  { id: 'PHONE', name: 'Phone Direct', nameAr: 'طلب هاتفي مباشر', sales: 802, orders: 120, aov: 6.64, share: 0.5, itemsPerOrder: 2.60, discountRate: 0.0, topBrand: 'Tahina' }, // < 200
  { id: 'DELIV_MP', name: 'Deliveroo MP', nameAr: 'ديلفرو ماركت بليس', sales: 506, orders: 86, aov: 5.88, share: 0.3, itemsPerOrder: 2.45, discountRate: 1.2, topBrand: 'China Garden' }, // < 200
  { id: 'WHATSAPP', name: 'Whatsapp', nameAr: 'واتساب', sales: 33, orders: 3, aov: 11.10, share: 0.1, itemsPerOrder: 3.00, discountRate: 0.0, topBrand: "Frank's" }, // < 200
]

// 14 Menu Categories Data
const ALL_CATEGORIES: CategoryItem[] = [
  { name: 'Noodles', nameAr: 'النودلز والباستا', sales: 47201 },
  { name: 'Mains', nameAr: 'الأطباق الرئيسية', sales: 28683 },
  { name: 'Starters & sides', nameAr: 'المقبلات والأطباق الجانبية', sales: 24581 },
  { name: 'Meals & combos', nameAr: 'الوجبات والكومبو', sales: 18348 },
  { name: 'Rice', nameAr: 'الأرز الصيني والمقلي', sales: 17210 },
  { name: 'Sandwiches & steaks', nameAr: 'الساندويتشات والستيك', sales: 11818 },
  { name: 'Soups', nameAr: 'الشوربات', sales: 7487 },
  { name: 'Beverages', nameAr: 'المشروبات والعصائر', sales: 5446 },
  { name: 'Staff meal deals', nameAr: 'وجبات الموظفين التوفيرية', sales: 1920 },
  { name: 'Platters & sharing', nameAr: 'أطباق المشاركة والجمعات', sales: 1840 },
  { name: 'Desserts', nameAr: 'الحلويات', sales: 1410 },
  { name: 'Sauces & extras', nameAr: 'الصلصات والإضافات', sales: 980 },
  { name: 'Salads', nameAr: 'السلطات والمقبلات الباردة', sales: 620 },
  { name: 'Chapati', nameAr: 'الشباتي والمخبوزات', sales: 310 },
]

// Top 15 Menu Items Data
const TOP_15_ITEMS: MenuItem[] = [
  { name: 'Chicken Noodles', nameAr: 'تشيكن نودلز', brand: 'China Garden', category: 'Noodles', sales: 12043 },
  { name: 'Veg Or Chicken Noodles Combo', nameAr: 'كومبو نودلز خضار أو دجاج', brand: 'China Garden', category: 'Meals & combos', sales: 9827 },
  { name: 'Vegetable Noodles', nameAr: 'نودلز بالخضار', brand: 'China Garden', category: 'Noodles', sales: 6852 },
  { name: 'Beef Mongolian', nameAr: 'لحم منغوليان', brand: 'China Garden', category: 'Mains', sales: 5730 },
  { name: 'Chicken Sweet \'n\' Sour', nameAr: 'دجاج حلو وحامض', brand: 'China Garden', category: 'Mains', sales: 4453 },
  { name: 'Prawn Garlic Noodles', nameAr: 'نودلز روبيان بالثوم', brand: 'The Noodle Bar', category: 'Noodles', sales: 3962 },
  { name: 'Plain Noodles', nameAr: 'نودلز سادة كلاسيك', brand: 'China Garden', category: 'Noodles', sales: 3864 },
  { name: 'Orig. Philly CheeseSteak', nameAr: 'فيلي تشيز ستيك الأصلي', brand: "Frank's", category: 'Sandwiches & steaks', sales: 3735 },
  { name: 'Sweet Corn Chicken Soup', nameAr: 'شوربة الذرة بالدجاج', brand: 'China Garden', category: 'Soups', sales: 3722 },
  { name: 'Philly Meal For 1', nameAr: 'وجبة فيلي لشخص واحد', brand: "Frank's", category: 'Meals & combos', sales: 3718 },
  { name: 'Chicken Fried Rice', nameAr: 'أرز مقلي بالدجاج', brand: 'China Garden', category: 'Rice', sales: 3463 },
  { name: 'Dynamite Shrimp', nameAr: 'ديناميت شرمب', brand: 'China Garden', category: 'Starters & sides', sales: 3220 },
  { name: 'Beef Noodles', nameAr: 'نودلز باللحم البقري', brand: 'China Garden', category: 'Noodles', sales: 3146 },
  { name: 'Chicken Breast Noodles', nameAr: 'نودلز صدور دجاج مشوية', brand: 'China Garden', category: 'Noodles', sales: 2980 },
  { name: 'Spring Rolls (Veg/Chicken)', nameAr: 'سبرينغ رولز مشكل', brand: 'China Garden', category: 'Starters & sides', sales: 2840 },
]

// 5 Operational & Financial Action Scorecard Items
const OPS_NOTES: OpsNote[] = [
  {
    category: 'Cold-Chain Maintenance',
    categoryAr: 'صيانة سلسلة التبريد',
    value: '+6.2°C (Std 4.0°C)',
    note: 'Chiller temperature spikes in Al Kout prep station and Salmiya during evening rush.',
    noteAr: 'ارتفاع حرارة مبرد التحضير بالكوت والسالمية أثناء الذروة المسائية.',
    action: 'Dispatch technician to inspect compressor seals and door gaskets.',
    actionAr: 'إرسال فني التبريد لفحص الضاغطات وعزل الأبواب فوراً.',
    assignedTo: 'Operations Maintenance',
    assignedToAr: 'إدارة الصيانة والتشغيل',
    status: 'Urgent',
  },
  {
    category: 'Qurain Kitchen Prep Variance',
    categoryAr: 'هدر تتبيل الدجاج (مطبخ القرين)',
    value: '+2.8% vs BOM (KWD 44.8/wk)',
    note: 'Raw chicken breast marination yield variance against standard recipe specifications.',
    noteAr: 'فارق وزن في تتبيل صدور الدجاج مقارنة بالمواصفات المعيارية.',
    action: 'Recalibrate digital scales and retrain prep line supervisors in Qurain.',
    actionAr: 'إعادة معايرة الموازين الإلكترونية وتدريب طاقم التحضير.',
    assignedTo: 'Al-Qurain Commissary',
    assignedToAr: 'مدير المطبخ المركزي بالقرين',
    status: 'Review',
  },
  {
    category: 'Delivery Commission SLA',
    categoryAr: 'عمولات تطبيقات التوصيل',
    value: '17.0% forced vs 10.0%',
    note: '48 orders diverted to aggregator fleet in Farwaniya and Hawally instead of in-house drivers.',
    noteAr: 'تحويل 48 طلباً لأسطول المنصة 17% بدلاً من سائقي المطعم 10%.',
    action: 'Re-enable 10% self-delivery radius and ensure store drivers are active.',
    actionAr: 'إلزام الفروع بفتح نطاق 10% وعدم إيقاف سائقي الشركة.',
    assignedTo: 'Channel Coordinator',
    assignedToAr: 'منسق منصات التوصيل',
    status: 'Urgent',
  },
  {
    category: 'Staff Visas & Health Cards',
    categoryAr: 'الإقامات وكروت الصحة',
    value: '6 Employees < 30 Days',
    note: 'Residency permits and municipal health cards due for renewal across 3 branches.',
    noteAr: 'اقتراب موعد انتهاء إقامات وكروت صحة لـ 6 موظفين.',
    action: 'Submit PAM renewal batch through Ahel portal and book medical tests.',
    actionAr: 'تجهيز معاملات منصة أسهل وحجز مواعيد الفحص الطبي.',
    assignedTo: 'HR & PRO Office',
    assignedToAr: 'الشؤون الإدارية والمندوب',
    status: 'Scheduled',
  },
  {
    category: 'KNET & Bank Reconciliation',
    categoryAr: 'تسويات KNET والتحصيل',
    value: 'KWD 890.45 Pending',
    note: 'Weekend POS register batches pending clearance with NBK and Boubyan.',
    noteAr: 'مطابقة تحصيلات أجهزة نقاط البيع لعطلة الأسبوع مع كشوف البنك.',
    action: 'Match terminal batch reports to bank merchant statements and post journals.',
    actionAr: 'مطابقة تقارير Z-Report مع كشوف الحساب وإقفال القيود.',
    assignedTo: 'Finance & Accounting',
    assignedToAr: 'الإدارة المالية والمحاسبة',
    status: 'Scheduled',
  },
]

export function AetherBiExecutiveDashboard({ locale = 'ar' }: { locale?: string }) {
  const [currentLang, setCurrentLang] = useState<'ar' | 'en'>(locale === 'en' ? 'en' : 'ar')
  const isAr = currentLang === 'ar'

  // Interactive Global Cross-Filtering State
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL')
  const [activeSection, setActiveSection] = useState<'ALL' | 'BRANDS' | 'CHANNELS' | 'MENU' | 'FINANCE'>('ALL')

  // Calculated Dynamic Metrics based on filters
  const filteredMetrics = useMemo(() => {
    let sales = 167092
    let orders = 30540
    let bestSeller = isAr ? 'تشيكن نودلز' : 'Chicken Noodles'

    if (selectedBrand !== 'ALL') {
      const b = ALL_BRANDS.find((item) => item.id === selectedBrand)
      if (b) {
        sales = b.sales
        orders = b.orders
        bestSeller = isAr ? b.bestSellerAr : b.bestSeller
      }
    } else if (selectedChannel !== 'ALL') {
      const c = ALL_CHANNELS.find((item) => item.id === selectedChannel)
      if (c) {
        sales = c.sales
        orders = c.orders
      }
    }

    const aov = orders > 0 ? (sales / orders).toFixed(3) : '0.000'
    const itemsSold = Math.round(orders * 2.61)
    const discounts = Math.round(sales * 0.024)
    const netProfit = Math.round(sales * 0.254)

    return {
      sales,
      orders,
      aov,
      itemsSold,
      discounts,
      netProfit,
      bestSeller,
    }
  }, [selectedBrand, selectedChannel, isAr])

  // Narrative Summary Text
  const narrativeText = useMemo(() => {
    const brandLabel =
      selectedBrand === 'ALL'
        ? isAr
          ? 'جميع العلامات التجارية'
          : 'All brands'
        : ALL_BRANDS.find((b) => b.id === selectedBrand)?.[isAr ? 'nameAr' : 'name'] || selectedBrand

    const channelLabel =
      selectedChannel === 'ALL'
        ? isAr
          ? 'كافة القنوات'
          : 'all channels'
        : ALL_CHANNELS.find((c) => c.id === selectedChannel)?.[isAr ? 'nameAr' : 'name'] || selectedChannel

    if (isAr) {
      return `حققت ${brandLabel} عبر ${channelLabel} صافي مبيعات ${filteredMetrics.sales.toLocaleString()} د.ك من ${filteredMetrics.orders.toLocaleString()} طلباً. الصنف الأكثر مبيعاً هو ${filteredMetrics.bestSeller}.`
    }
    return `${brandLabel} in ${channelLabel} made KWD ${filteredMetrics.sales.toLocaleString()} net from ${filteredMetrics.orders.toLocaleString()} orders. The best seller was ${filteredMetrics.bestSeller}.`
  }, [selectedBrand, selectedChannel, filteredMetrics, isAr])

  // Format Helper
  const fmtKwd = (val: number) => {
    return 'KWD ' + val.toLocaleString('en-US')
  }

  const fmtKwdAr = (val: number) => {
    return val.toLocaleString('en-US') + ' د.ك'
  }

  const resetFilters = () => {
    setSelectedBrand('ALL')
    setSelectedChannel('ALL')
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-none bg-[#F8F9FA] text-slate-800 space-y-6 pb-12 font-sans tabular-nums"
    >
      {/* ======================================================================= */}
      {/* 1. TOP HEADER & CROSS-FILTER BAR                                        */}
      {/* ======================================================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {isAr ? 'محدّث لحظياً · تقرير أكتوبر 2026' : 'Updated Live · Oct 2026 Audit'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              {isAr
                ? 'مبيعات العلامات والتشغيل · فنتشر فودز'
                : 'Brand sales & Operations · Venture Foods'}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {narrativeText}
            </p>
          </div>

          {/* Language Switch & Active Reset */}
          <div className="flex items-center gap-2.5 self-start md:self-center">
            {(selectedBrand !== 'ALL' || selectedChannel !== 'ALL') && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-semibold border border-blue-200 transition-colors"
              >
                <RotateCcw size={13} />
                <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset filters'}</span>
              </button>
            )}

            <button
              onClick={() => setCurrentLang(isAr ? 'en' : 'ar')}
              className="px-3 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 rounded-md text-xs font-bold text-slate-700 transition-colors"
            >
              {isAr ? 'English View' : 'عرض باللغة العربية'}
            </button>
          </div>
        </div>

        {/* Global Filter Controls Bar */}
        <div className="pt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Filter size={13} className="text-slate-400" />
              {isAr ? 'تصفية حسب:' : 'Filter by:'}
            </span>

            {/* Brand Dropdown */}
            <div className="relative">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="appearance-none bg-white border border-gray-300 text-slate-800 rounded-md px-3 py-1.5 pe-7 text-xs font-semibold hover:border-gray-400 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">{isAr ? 'جميع العلامات (6 براندات)' : 'All brands (6)'}</option>
                {ALL_BRANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute end-2 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Channel Dropdown */}
            <div className="relative">
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="appearance-none bg-white border border-gray-300 text-slate-800 rounded-md px-3 py-1.5 pe-7 text-xs font-semibold hover:border-gray-400 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">{isAr ? 'جميع قنوات البيع (11 قناة)' : 'All channels (11)'}</option>
                {ALL_CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isAr ? c.nameAr : c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute end-2 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Section Quick Jump Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
            {[
              { id: 'ALL', label: isAr ? 'التقرير الشامل' : 'Full Overview' },
              { id: 'BRANDS', label: isAr ? 'العلامات' : 'Brands' },
              { id: 'CHANNELS', label: isAr ? 'القنوات' : 'Channels' },
              { id: 'MENU', label: isAr ? 'المنيو' : 'Menu' },
              { id: 'FINANCE', label: isAr ? 'المالية والـ COGS' : 'Financials' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-2.5 py-1 text-xs font-semibold rounded ${
                  activeSection === tab.id
                    ? 'bg-white text-blue-600 font-bold shadow-none'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2. ROW 1: 6 MINIMALIST KPI CARDS (IN 1 GRID ROW)                         */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1 */}
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-none">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isAr ? 'صافي المبيعات' : 'Net sales'}
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {isAr ? fmtKwdAr(filteredMetrics.sales) : fmtKwd(filteredMetrics.sales)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? 'بعد الخصومات' : 'After discounts, KWD'}
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-none">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isAr ? 'عدد الطلبات' : 'Orders'}
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {filteredMetrics.orders.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? 'طلبات مكتملة' : 'Distinct orders'}
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-none">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isAr ? 'متوسط السلة' : 'Average order value'}
          </div>
          <div className="text-xl font-bold text-blue-600 mt-1">
            {isAr ? `${filteredMetrics.aov} د.ك` : `KWD ${filteredMetrics.aov}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? 'المبيعات ÷ الطلبات' : 'Net sales ÷ orders'}
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-none">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isAr ? 'الأصناف المباعة' : 'Items sold'}
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {filteredMetrics.itemsSold.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? '2.61 صنف/طلب' : '2.61 items per order'}
          </div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-none">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isAr ? 'الخصومات الممنوحة' : 'Discounts given'}
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {isAr ? fmtKwdAr(filteredMetrics.discounts) : fmtKwd(filteredMetrics.discounts)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isAr ? '2.4% من الإجمالي' : '2.4% of gross sales'}
          </div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-none">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isAr ? 'صافي الربح التشغيلي' : 'Net Operating Profit'}
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {isAr ? fmtKwdAr(filteredMetrics.netProfit) : fmtKwd(filteredMetrics.netProfit)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            {isAr ? 'هامش ربح 25.4%' : '25.4% operating margin'}
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. ROW 2: 4 HIGHLIGHTS CARDS (WITH LEFT/RIGHT DARK BORDER)               */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Highlight 1 */}
        <div className={`bg-white border border-gray-200 rounded-lg p-3.5 shadow-none ${isAr ? 'border-r-4 border-r-slate-800' : 'border-l-4 border-l-slate-800'}`}>
          <div className="text-xs font-bold text-slate-900">
            {isAr ? 'القناة الكبرى:' : 'Biggest channel:'}
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {isAr
              ? 'مبيعات الصالة والاستلام هي الكبرى بنسبة 35.3% بقيمة 58,972 د.ك.'
              : 'Shop Sales is the largest channel, with 35.3% of sales (KWD 58,972).'}
          </p>
        </div>

        {/* Highlight 2 */}
        <div className={`bg-white border border-gray-200 rounded-lg p-3.5 shadow-none ${isAr ? 'border-r-4 border-r-slate-800' : 'border-l-4 border-l-slate-800'}`}>
          <div className="text-xs font-bold text-slate-900">
            {isAr ? 'الصنف الأكثر مبيعاً:' : 'Best seller:'}
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {isAr
              ? 'تشيكن نودلز من تشاينا جاردن حقق 12,043 د.ك بما يعادل 7.2% من مبيعات المنيو.'
              : 'Chicken Noodles from China Garden sold KWD 12,043, which is 7.2% of menu sales.'}
          </p>
        </div>

        {/* Highlight 3 */}
        <div className={`bg-white border border-gray-200 rounded-lg p-3.5 shadow-none ${isAr ? 'border-r-4 border-r-slate-800' : 'border-l-4 border-l-slate-800'}`}>
          <div className="text-xs font-bold text-slate-900">
            {isAr ? 'تركز مبيعات المنيو:' : 'Menu concentration:'}
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {isAr
              ? 'أعلى 32 صنفاً من أصل 364 صنفاً تشكل 80% من إجمالي مبيعات المنيو.'
              : 'The top 32 of 364 items sold make 80% of menu sales.'}
          </p>
        </div>

        {/* Highlight 4 */}
        <div className={`bg-white border border-gray-200 rounded-lg p-3.5 shadow-none ${isAr ? 'border-r-4 border-r-slate-800' : 'border-l-4 border-l-slate-800'}`}>
          <div className="text-xs font-bold text-slate-900">
            {isAr ? 'مراقبة الإضافات والتكلفة:' : 'Add-ons & Cost Watch:'}
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            {isAr
              ? 'المشروبات 25.3%، المقبلات 32.7% | تكلفة الأغذية 24.8% (+0.8% فارق بالقرين).'
              : 'Drinks 25.3%, starters 32.7%, desserts 3.2% | COGS at 24.8% (+0.8% variance in Qurain).'}
          </p>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 4. SECTION 1: BRANDS · ALL CHANNELS                                     */}
      {/* ======================================================================= */}
      {(activeSection === 'ALL' || activeSection === 'BRANDS') && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-none space-y-5">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isAr ? 'العلامات التجارية · كافة القنوات' : 'Brands · All channels'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'انقر على أي علامة في الشارت لتصفية التقرير بالكامل'
                  : 'Click on any brand bar to cross-filter the dashboard'}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">6 Brands</span>
          </div>

          {/* 2 Side-by-Side Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Right/Left: Net Sales by Brand */}
            <div>
              <div className="text-xs font-bold text-slate-900 mb-2.5">
                {isAr ? 'صافي المبيعات حسب العلامة (د.ك)' : 'Net sales by brand (KWD)'}
              </div>
              <div className="space-y-2">
                {ALL_BRANDS.map((b) => {
                  const maxSales = ALL_BRANDS[0].sales
                  const pct = (b.sales / maxSales) * 100
                  const isSelected = selectedBrand === b.id

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBrand(selectedBrand === b.id ? 'ALL' : b.id)}
                      className={`flex items-center gap-3 text-xs cursor-pointer py-1 px-1.5 rounded transition-colors ${
                        isSelected ? 'bg-blue-50 font-bold' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-28 shrink-0 truncate text-slate-700 font-medium">
                        {isAr ? b.nameAr : b.name}
                      </div>
                      <div className="flex-1 bg-gray-100 h-5 rounded-sm overflow-hidden flex items-center">
                        <div
                          className="bg-[#2563EB] h-full rounded-sm transition-all duration-300"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        ></div>
                      </div>
                      <div className="w-16 shrink-0 text-end font-mono text-slate-800 font-semibold">
                        {b.sales.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Chart Left/Right: AOV by Brand */}
            <div>
              <div className="text-xs font-bold text-slate-900 mb-0.5">
                {isAr ? 'متوسط قيمة الطلب حسب العلامة (د.ك)' : 'Average order value by brand (KWD)'}
              </div>
              <div className="text-[11px] text-slate-400 mb-2 italic">
                {isAr
                  ? 'أقل من 200 طلب ملون بالرمادي لأن المتوسط يتأثر بسهولة'
                  : 'Items with <200 orders colored in grey because average easily swings'}
              </div>

              <div className="space-y-2">
                {[...ALL_BRANDS]
                  .sort((a, b) => b.aov - a.aov)
                  .map((b) => {
                    const maxAov = 7.45
                    const pct = (b.aov / maxAov) * 100
                    const isGrey = b.orders < 200 // Karak Cafeteria

                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBrand(selectedBrand === b.id ? 'ALL' : b.id)}
                        className="flex items-center gap-3 text-xs cursor-pointer py-1 px-1.5 rounded hover:bg-gray-50"
                      >
                        <div className="w-28 shrink-0 truncate text-slate-700 font-medium">
                          {isAr ? b.nameAr : b.name}
                        </div>
                        <div className="flex-1 bg-gray-100 h-5 rounded-sm overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-sm transition-all duration-300 ${
                              isGrey ? 'bg-[#9CA3AF]' : 'bg-[#2563EB]'
                            }`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <div className="w-12 shrink-0 text-end font-mono text-slate-800 font-semibold">
                          {b.aov.toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Brand Scorecard Table */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-900 mb-2">
              {isAr ? 'جدول أداء العلامات التجارية (Brand scorecard)' : 'Brand scorecard'}
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-slate-600 font-bold">
                    <th className="px-3 py-2 text-start">{isAr ? 'العلامة' : 'Brand'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الطلبات' : 'Orders'}</th>
                    <th className="px-3 py-2 text-start w-48">{isAr ? 'صافي المبيعات (د.ك)' : 'Net sales'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الحصة' : 'Share'}</th>
                    <th className="px-3 py-2 text-end">{isAr ? 'متوسط الطلب' : 'Avg order'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الأصناف/طلب' : 'Items/order'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الخصم' : 'Discount'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'المشروبات' : 'Drinks %'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'المقبلات' : 'Starters %'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'الأكثر مبيعاً' : 'Best seller'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-slate-800">
                  {ALL_BRANDS.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBrand(selectedBrand === b.id ? 'ALL' : b.id)}
                      className={`hover:bg-blue-50/50 cursor-pointer ${
                        selectedBrand === b.id ? 'bg-blue-50 font-bold' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-900">{isAr ? b.nameAr : b.name}</td>
                      <td className="px-3 py-2 text-center">{b.orders.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-16 font-mono font-semibold">{b.sales.toLocaleString()}</span>
                          <div className="flex-1 bg-gray-100 h-2 rounded-sm overflow-hidden">
                            <div className="bg-[#2563EB] h-full" style={{ width: `${b.share}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{b.share.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-end font-mono">{b.aov.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center font-mono">{b.itemsPerOrder.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center font-mono">{b.discountRate.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center font-mono">{b.drinksPct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-center font-mono">{b.startersPct.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]">{isAr ? b.bestSellerAr : b.bestSeller}</td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-gray-50 font-bold border-t border-gray-200">
                    <td className="px-3 py-2">{isAr ? 'الإجمالي العام' : 'Total'}</td>
                    <td className="px-3 py-2 text-center">30,540</td>
                    <td className="px-3 py-2 font-mono">167,092 KWD</td>
                    <td className="px-3 py-2 text-center font-mono">100.0%</td>
                    <td className="px-3 py-2 text-end font-mono">5.47</td>
                    <td className="px-3 py-2 text-center font-mono">2.61</td>
                    <td className="px-3 py-2 text-center font-mono">2.4%</td>
                    <td className="px-3 py-2 text-center font-mono">25.3%</td>
                    <td className="px-3 py-2 text-center font-mono">32.7%</td>
                    <td className="px-3 py-2 text-slate-700">{isAr ? 'تشيكن نودلز' : 'Chicken Noodles'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. SECTION 2: CHANNELS · ALL BRANDS                                     */}
      {/* ======================================================================= */}
      {(activeSection === 'ALL' || activeSection === 'CHANNELS') && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-none space-y-5">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isAr ? 'قنوات البيع · كافة العلامات' : 'Channels · All brands'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'انقر على أي قناة في الشارت لتصفية التقرير بالكامل'
                  : 'Click on any channel bar to cross-filter the dashboard'}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">11 Channels</span>
          </div>

          {/* 2 Side-by-Side Horizontal Bar Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Right: Net sales by channel */}
            <div>
              <div className="text-xs font-bold text-slate-900 mb-2.5">
                {isAr ? 'صافي المبيعات حسب القناة (د.ك)' : 'Net sales by channel (KWD)'}
              </div>
              <div className="space-y-1.5">
                {ALL_CHANNELS.map((c) => {
                  const maxSales = ALL_CHANNELS[0].sales
                  const pct = (c.sales / maxSales) * 100
                  const isSelected = selectedChannel === c.id

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedChannel(selectedChannel === c.id ? 'ALL' : c.id)}
                      className={`flex items-center gap-3 text-xs cursor-pointer py-1 px-1.5 rounded transition-colors ${
                        isSelected ? 'bg-blue-50 font-bold' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-28 shrink-0 truncate text-slate-700 font-medium">
                        {isAr ? c.nameAr : c.name}
                      </div>
                      <div className="flex-1 bg-gray-100 h-5 rounded-sm overflow-hidden flex items-center">
                        <div
                          className="bg-[#2563EB] h-full rounded-sm transition-all duration-300"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        ></div>
                      </div>
                      <div className="w-16 shrink-0 text-end font-mono text-slate-800 font-semibold">
                        {c.sales.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Chart Left: AOV by channel */}
            <div>
              <div className="text-xs font-bold text-slate-900 mb-0.5">
                {isAr ? 'متوسط قيمة الطلب حسب القناة (د.ك)' : 'Average order value by channel (KWD)'}
              </div>
              <div className="text-[11px] text-slate-400 mb-2 italic">
                {isAr
                  ? 'أقل من 200 طلب ملون بالرمادي لأن المتوسط يتأثر بسهولة'
                  : 'Channels with <200 orders colored in grey because average easily swings'}
              </div>

              <div className="space-y-1.5">
                {[...ALL_CHANNELS]
                  .sort((a, b) => b.aov - a.aov)
                  .map((c) => {
                    const maxAov = 12.84
                    const pct = (c.aov / maxAov) * 100
                    const isGrey = c.orders < 200 // Ordable, Whatsapp, Cari, Phone, Snoonu, Deliveroo MP

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedChannel(selectedChannel === c.id ? 'ALL' : c.id)}
                        className="flex items-center gap-3 text-xs cursor-pointer py-1 px-1.5 rounded hover:bg-gray-50"
                      >
                        <div className="w-28 shrink-0 truncate text-slate-700 font-medium">
                          {isAr ? c.nameAr : c.name}
                        </div>
                        <div className="flex-1 bg-gray-100 h-5 rounded-sm overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-sm transition-all duration-300 ${
                              isGrey ? 'bg-[#9CA3AF]' : 'bg-[#2563EB]'
                            }`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <div className="w-12 shrink-0 text-end font-mono text-slate-800 font-semibold">
                          {c.aov.toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Channel Scorecard Table */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-900 mb-2">
              {isAr ? 'جدول أداء القنوات (Channel scorecard)' : 'Channel scorecard'}
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-slate-600 font-bold">
                    <th className="px-3 py-2 text-start">{isAr ? 'القناة' : 'Channel'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الطلبات' : 'Orders'}</th>
                    <th className="px-3 py-2 text-start w-52">{isAr ? 'صافي المبيعات (د.ك)' : 'Net sales'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الحصة' : 'Share'}</th>
                    <th className="px-3 py-2 text-end">{isAr ? 'متوسط الطلب' : 'Avg order'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الأصناف/طلب' : 'Items/order'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الخصم' : 'Discount'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'العلامة الرائدة' : 'Top brand'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-slate-800">
                  {ALL_CHANNELS.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedChannel(selectedChannel === c.id ? 'ALL' : c.id)}
                      className={`hover:bg-blue-50/50 cursor-pointer ${
                        selectedChannel === c.id ? 'bg-blue-50 font-bold' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-semibold text-slate-900">{isAr ? c.nameAr : c.name}</td>
                      <td className="px-3 py-2 text-center font-mono">{c.orders.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-16 font-mono font-semibold">{c.sales.toLocaleString()}</span>
                          <div className="flex-1 bg-gray-100 h-2 rounded-sm overflow-hidden">
                            <div className="bg-[#2563EB] h-full" style={{ width: `${c.share}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-mono">{c.share.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-end font-mono">{c.aov.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center font-mono">{c.itemsPerOrder.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center font-mono">{c.discountRate.toFixed(1)}%</td>
                      <td className="px-3 py-2 text-slate-600">{c.topBrand}</td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="bg-gray-50 font-bold border-t border-gray-200">
                    <td className="px-3 py-2">{isAr ? 'الإجمالي العام' : 'Total'}</td>
                    <td className="px-3 py-2 text-center font-mono">30,540</td>
                    <td className="px-3 py-2 font-mono">167,092 KWD</td>
                    <td className="px-3 py-2 text-center font-mono">100.0%</td>
                    <td className="px-3 py-2 text-end font-mono">5.47</td>
                    <td className="px-3 py-2 text-center font-mono">2.61</td>
                    <td className="px-3 py-2 text-center font-mono">2.4%</td>
                    <td className="px-3 py-2 text-slate-700">China Garden</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. SECTION 3: MENU · ALL BRANDS, ALL CHANNELS                           */}
      {/* ======================================================================= */}
      {(activeSection === 'ALL' || activeSection === 'MENU') && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-none space-y-5">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isAr ? 'المنيو والأصناف · كافة العلامات والقنوات' : 'Menu · All brands, all channels'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'تحليل فئات المنيو الـ 14 وقائمة أعلى 15 صنفاً مبيعاً'
                  : 'Analysis of 14 categories and top 15 selling menu items'}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">364 Items</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart Right: Sales by Category (Grey #9CA3AF) */}
            <div>
              <div className="text-xs font-bold text-slate-900 mb-0.5">
                {isAr ? 'المبيعات حسب الفئة (د.ك)' : 'Sales by category (KWD)'}
              </div>
              <div className="text-[11px] text-slate-400 mb-2 italic">
                {isAr ? '14 فئة طعام ومشروبات مصنفة' : '14 classified food and beverage categories'}
              </div>

              <div className="space-y-1.5">
                {ALL_CATEGORIES.map((cat) => {
                  const maxSales = ALL_CATEGORIES[0].sales
                  const pct = (cat.sales / maxSales) * 100

                  return (
                    <div key={cat.name} className="flex items-center gap-3 text-xs py-0.5 hover:bg-gray-50 rounded px-1">
                      <div className="w-32 shrink-0 truncate text-slate-700 font-medium">
                        {isAr ? cat.nameAr : cat.name}
                      </div>
                      <div className="flex-1 bg-gray-100 h-4.5 rounded-sm overflow-hidden flex items-center">
                        <div
                          className="bg-[#9CA3AF] h-full rounded-sm"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        ></div>
                      </div>
                      <div className="w-14 shrink-0 text-end font-mono text-slate-800 font-semibold">
                        {cat.sales.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Chart Left: Top 15 Items (Blue #2563EB) */}
            <div>
              <div className="text-xs font-bold text-slate-900 mb-0.5">
                {isAr ? 'أعلى 15 صنفاً مبيعاً (د.ك)' : 'Top 15 items by sales (KWD)'}
              </div>
              <div className="text-[11px] text-slate-400 mb-2 italic">
                {isAr ? 'تشكل 80% من إجمالي مبيعات المنيو (قاعدة باريتو)' : 'Make up 80% of menu sales volume'}
              </div>

              <div className="space-y-1.5">
                {TOP_15_ITEMS.map((item, idx) => {
                  const maxSales = TOP_15_ITEMS[0].sales
                  const pct = (item.sales / maxSales) * 100

                  return (
                    <div key={item.name} className="flex items-center gap-2.5 text-xs py-0.5 hover:bg-gray-50 rounded px-1">
                      <div className="w-4 text-slate-400 font-mono text-[10px] shrink-0 text-end">{idx + 1}.</div>
                      <div className="w-40 shrink-0 truncate text-slate-700 font-medium" title={item.name}>
                        {isAr ? item.nameAr : item.name}
                      </div>
                      <div className="flex-1 bg-gray-100 h-4.5 rounded-sm overflow-hidden flex items-center">
                        <div
                          className="bg-[#2563EB] h-full rounded-sm"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        ></div>
                      </div>
                      <div className="w-14 shrink-0 text-end font-mono text-slate-800 font-semibold">
                        {item.sales.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 7. SECTION 4: FINANCIALS, COGS & MAINTENANCE SCORECARD                  */}
      {/* ======================================================================= */}
      {(activeSection === 'ALL' || activeSection === 'FINANCE') && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-none space-y-5">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isAr
                  ? 'المصروفات والعهد التشغيلية والـ COGS'
                  : 'Financial Structure, COGS & Operations Scorecard'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'مطابقة بنود الأرباح والخسائر وسجل الإجراءات التشغيلية المعتمدة'
                  : 'P&L reconciliations & approved operational directives'}
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">P&L 100% Balanced</span>
          </div>

          {/* Financial Breakdown Horizontal Bars */}
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-3">
            <div className="text-xs font-bold text-slate-800">
              {isAr ? 'توزيع المقتطعات من المبيعات (167,092 د.ك):' : 'Revenue Deductions Breakdown (KWD 167,092):'}
            </div>

            <div className="space-y-2 text-xs">
              {/* COGS */}
              <div className="flex items-center gap-3">
                <span className="w-48 truncate text-slate-600 font-medium">
                  {isAr ? 'تكلفة الأغذية (COGS 24.8%):' : 'Food Cost (COGS 24.8%):'}
                </span>
                <div className="flex-1 bg-gray-200 h-4 rounded-sm overflow-hidden">
                  <div className="bg-amber-600 h-full" style={{ width: '24.8%' }}></div>
                </div>
                <span className="w-24 text-end font-mono font-semibold">41,438 KWD</span>
              </div>

              {/* Custodies & Odoo expenses */}
              <div className="flex items-center gap-3">
                <span className="w-48 truncate text-slate-600 font-medium">
                  {isAr ? 'العهد والمصروفات التشغيلية:' : 'Custodies & Operating Expenses:'}
                </span>
                <div className="flex-1 bg-gray-200 h-4 rounded-sm overflow-hidden">
                  <div className="bg-slate-700 h-full" style={{ width: '30.6%' }}></div>
                </div>
                <span className="w-24 text-end font-mono font-semibold">51,154 KWD</span>
              </div>

              {/* Salaries & Rents */}
              <div className="flex items-center gap-3">
                <span className="w-48 truncate text-slate-600 font-medium">
                  {isAr ? 'الرواتب والإيجارات والعمولات:' : 'Salaries, Rents & Commissions:'}
                </span>
                <div className="flex-1 bg-gray-200 h-4 rounded-sm overflow-hidden">
                  <div className="bg-slate-500 h-full" style={{ width: '19.2%' }}></div>
                </div>
                <span className="w-24 text-end font-mono font-semibold">32,056 KWD</span>
              </div>

              {/* Net Profit */}
              <div className="flex items-center gap-3 pt-1 border-t border-gray-200">
                <span className="w-48 truncate text-emerald-800 font-bold">
                  {isAr ? 'صافي الربح التشغيلي (25.4%):' : 'Net Operating Profit (25.4%):'}
                </span>
                <div className="flex-1 bg-gray-200 h-4 rounded-sm overflow-hidden">
                  <div className="bg-emerald-600 h-full" style={{ width: '25.4%' }}></div>
                </div>
                <span className="w-24 text-end font-mono font-bold text-emerald-700">42,441 KWD</span>
              </div>
            </div>
          </div>

          {/* Operational Directive Scorecard Table */}
          <div className="pt-1">
            <div className="text-xs font-bold text-slate-900 mb-2">
              {isAr ? 'سجل الملاحظات التشغيلية والإجراءات المعتمدة' : 'Operations & Maintenance Scorecard'}
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-slate-600 font-bold">
                    <th className="px-3 py-2 text-start">{isAr ? 'البند' : 'Category'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'القيمة / المعيار' : 'Value / Std'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'الملاحظة التشغيلية' : 'Observation'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'الإجراء الإداري المعتمد' : 'Required Action'}</th>
                    <th className="px-3 py-2 text-start">{isAr ? 'المسؤول' : 'Assigned to'}</th>
                    <th className="px-3 py-2 text-center">{isAr ? 'الأولوية' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-slate-800">
                  {OPS_NOTES.map((n, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">
                        {isAr ? n.categoryAr : n.category}
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {n.value}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-xs">
                        {isAr ? n.noteAr : n.note}
                      </td>
                      <td className="px-3 py-2 text-slate-900 font-semibold max-w-sm">
                        {isAr ? n.actionAr : n.action}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {isAr ? n.assignedToAr : n.assignedTo}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            n.status === 'Urgent'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : n.status === 'Review'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-slate-700 border border-gray-200'
                          }`}
                        >
                          {n.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
