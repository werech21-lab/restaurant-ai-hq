'use client'

import React, { useState, useEffect } from 'react'
import {
  Flame,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Trash2,
  Gauge,
  Layers,
  Building2,
  Package,
  ShieldAlert,
  ArrowRightLeft,
  UtensilsCrossed,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export interface KdsTicket {
  id: string
  ticketNo: string
  orderRef: string
  orderRefAr: string
  orderRefEn: string
  branchId: string
  brandId: string
  brandNameAr: string
  brandNameEn: string
  channelAr: string
  channelEn: string
  channelBadge: string
  station: 'WOK' | 'GRILL' | 'FRYER' | 'SHAWARMA' | 'PACKING'
  stationAr: string
  stationEn: string
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'TGO' | 'TMP' | 'DELIVEROO' | 'KEETA'
  minutesElapsed: number
  status: 'PENDING' | 'PREPPING' | 'READY' | 'BUMPED'
  items: Array<{
    nameAr: string
    nameEn: string
    qty: number
    notesAr?: string
    notesEn?: string
    sku: string
    rawIngredients: Array<{ code: string; nameAr: string; nameEn: string; qty: string; costKwd: number }>
    prepIngredients: Array<{ code: string; nameAr: string; nameEn: string; qty: string; costKwd: number }>
    packagingItems: Array<{ code: string; nameAr: string; nameEn: string; qty: string; costKwd: number }>
  }>
}

export interface KitchenLocation {
  id: string
  nameAr: string
  nameEn: string
  chefAr: string
  chefEn: string
  brands: string[]
}

export const KITCHEN_LOCATIONS: KitchenLocation[] = [
  {
    id: 'ALL',
    nameAr: 'جميع المطابخ والفروع النشطة (نظرة شاملة — الشيف التنفيذي: أليكس محرم قبول #2023)',
    nameEn: 'All Active Kitchens & Branches (Overview — Executive Chef: Alex Muharram Qaboul #2023)',
    chefAr: 'الشيف التنفيذي: أليكس محرم قبول (#2023)',
    chefEn: 'Executive Chef: Alex Muharram Qaboul (#2023)',
    brands: ['ALL'],
  },
  {
    id: 'CK_MAIN',
    nameAr: 'المطبخ المركزي والإنتاج — مبارك الكبير (الشيف المسؤول: بابو تشاند رانا #1279)',
    nameEn: 'Central Production Kitchen (Chef in Charge: Babu Chand Rana #1279)',
    chefAr: 'الشيف المسؤول: بابو تشاند رانا (#1279)',
    chefEn: 'Head Chef: Babu Chand Rana (#1279)',
    brands: ['chinagarden', 'franks', 'shawarma', 'noodle', 'farmbrown', 'karak'],
  },
  {
    id: 'SALMIYA',
    nameAr: 'مطبخ فرع السالمية المركزي — متعدد العلامات (الشيف: أنورول كو #1200)',
    nameEn: 'Salmiya Central Branch Kitchen — Multi-Brand (Chef: Anwarul Ku #1200)',
    chefAr: 'الشيف: أنورول كو (#1200)',
    chefEn: 'Chef: Anwarul Ku (#1200)',
    brands: ['farmbrown', 'shawarma', 'karak', 'franks'],
  },
  {
    id: 'ARDHIYA',
    nameAr: 'مطبخ فرع العارضية — متعدد العلامات (الشيف: أميلا مادورانغا #1956)',
    nameEn: 'Ardhiya Branch Kitchen — Multi-Brand (Chef: Amila Maduranga #1956)',
    chefAr: 'الشيف: أميلا مادورانغا (#1956)',
    chefEn: 'Chef: Amila Maduranga (#1956)',
    brands: ['farmbrown', 'karak', 'franks', 'chinagarden'],
  },
  {
    id: 'MAK',
    nameAr: 'مطبخ فرع مبارك الكبير (الشيف: شيترا بهادر #1968)',
    nameEn: 'Mubarak Al-Kabeer Branch Kitchen (Chef: Chitra Bahadur #1968)',
    chefAr: 'الشيف: شيترا بهادر (#1968)',
    chefEn: 'Chef: Chitra Bahadur (#1968)',
    brands: ['karak', 'chinagarden', 'shawarma'],
  },
  {
    id: 'HAWALLI',
    nameAr: 'مطبخ فرع بروميناد حولي (الشيف: دونر ناينغو #1924)',
    nameEn: 'Hawalli Promenade Kitchen (Chef: Donner Nainggo #1924)',
    chefAr: 'الشيف: دونر ناينغو (#1924)',
    chefEn: 'Chef: Donner Nainggo (#1924)',
    brands: ['karak', 'franks', 'chinagarden'],
  },
  {
    id: 'AVENUES',
    nameAr: 'مطبخ فرع مجمع الأفنيوز — تشاينا جاردن (الشيف: بيشالاريال #1989)',
    nameEn: 'The Avenues Mall Kitchen — China Garden (Chef: Bishal Aryal #1989)',
    chefAr: 'الشيف: بيشالاريال (#1989)',
    chefEn: 'Chef: Bishal Aryal (#1989)',
    brands: ['chinagarden', 'franks'],
  },
  {
    id: 'SHUWAIKH',
    nameAr: 'مطبخ فرع 360 مول (الشيف: ديبراج غوتام #2021)',
    nameEn: '360 Mall Kitchen (Chef: Deepraj Gautam #2021)',
    chefAr: 'الشيف: ديبراج غوتام (#2021)',
    chefEn: 'Chef: Deepraj Gautam (#2021)',
    brands: ['franks', 'noodle', 'farmbrown'],
  },
  {
    id: 'JABRIYA',
    nameAr: 'مطبخ فرع العاصمة مول — شرق (الشيف: هيمراج بيشواكارما #1975)',
    nameEn: 'Al Asimah Mall Kitchen — Sharq (Chef: Hemraj Bishwakarma #1975)',
    chefAr: 'الشيف: هيمراج بيشواكارما (#1975)',
    chefEn: 'Chef: Hemraj Bishwakarma (#1975)',
    brands: ['karak', 'noodle', 'shawarma'],
  },
  {
    id: 'KHIRAN',
    nameAr: 'مطبخ فرع الكوت مول — الفحيحيل (الشيف: ديل كومار شريستا #1955)',
    nameEn: 'Al Kout Mall Kitchen — Fahaheel (Chef: Dil Kumar Shrestha #1955)',
    chefAr: 'الشيف: ديل كومار شريستا (#1955)',
    chefEn: 'Chef: Dil Kumar Shrestha (#1955)',
    brands: ['franks', 'chinagarden'],
  },
  {
    id: 'FARWANIYA',
    nameAr: 'مطبخ فرع الفروانية (الشيف: دان بهادر #1967)',
    nameEn: 'Farwaniya Branch Kitchen (Chef: Dhan Bahadur #1967)',
    chefAr: 'الشيف: دان بهادر (#1967)',
    chefEn: 'Chef: Dhan Bahadur (#1967)',
    brands: ['chinagarden', 'shawarma'],
  },
]

export const INITIAL_KDS_TICKETS: KdsTicket[] = [
  {
    id: 'tk-101',
    ticketNo: 'TK-4819',
    orderRef: 'ORD-TAL-9910',
    orderRefAr: 'طلب منصة طلبات #9910',
    orderRefEn: 'Talabat Order #9910',
    branchId: 'AVENUES',
    brandId: 'franks',
    brandNameAr: 'فرانكس ستيك',
    brandNameEn: "Frank's Steak",
    channelAr: 'منصة طلبات (توصيل طلبات 17%)',
    channelEn: 'Talabat GO (17%)',
    channelBadge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    station: 'GRILL',
    stationAr: 'محطة الجريل والستيك',
    stationEn: 'Grill & Steak Station',
    orderType: 'TGO',
    minutesElapsed: 22,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'ستيك ريب آي 300 غرام (استواء متوسط إلى كامل)',
        nameEn: 'Black Angus Ribeye 300g (Medium Well)',
        qty: 1,
        sku: 'MS01',
        notesAr: 'بدون بصل مكرمل - صوص فلفل أسود جانبي',
        notesEn: 'No caramelized onions - pepper sauce on the side',
        rawIngredients: [
          { code: 'RW01-BF01', nameAr: 'لحم بلاك أنجوس خام', nameEn: 'Raw Angus Ribeye', qty: '320g', costKwd: 2.150 },
          { code: 'RW01-BT01', nameAr: 'زبدة نيوزيلندية وأعشاب', nameEn: 'Herb Butter', qty: '25g', costKwd: 0.180 },
        ],
        prepIngredients: [
          { code: 'PP03-PPR', nameAr: 'صوص الفلفل الأسود (تحضير مركزي)', nameEn: 'Pepper Sauce CK Prep', qty: '60ml', costKwd: 0.220 },
        ],
        packagingItems: [
          { code: 'PI02-STK', nameAr: 'علبة ستيك حرارية فاخرة', nameEn: 'Thermal Steak Box', qty: '1 unit', costKwd: 0.250 },
          { code: 'PI02-CUT', nameAr: 'طقم شوكة وسكين خشبية فاخرة', nameEn: 'Wood Cutlery Set', qty: '1 set', costKwd: 0.100 },
        ],
      },
    ],
  },
  {
    id: 'tk-102',
    ticketNo: 'TK-4820',
    orderRef: 'ORD-POS-1042',
    orderRefAr: 'طلب كاشير #1042',
    orderRefEn: 'POS Order #1042',
    branchId: 'AVENUES',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    channelAr: 'سفري / استلام كاونتر',
    channelEn: 'Takeaway / Counter',
    channelBadge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    station: 'FRYER',
    stationAr: 'محطة المقليات والبرجر',
    stationEn: 'Fryer & Burger Station',
    orderType: 'TAKEAWAY',
    minutesElapsed: 16,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'دجاج كانتون تشاينا جاردن المميز',
        nameEn: 'China Garden Special Canton Chicken',
        qty: 2,
        sku: 'TH01',
        notesAr: 'إكسترا مخلل وجبن شيدر أمريكي',
        notesEn: 'Extra pickles and cheddar cheese',
        rawIngredients: [
          { code: 'RW01-BF04', nameAr: 'لحم مفروم طازج', nameEn: 'Fresh Minced Beef', qty: '180g', costKwd: 0.850 },
          { code: 'RW01-BN01', nameAr: 'خبز بريوش طازج', nameEn: 'Brioche Bun', qty: '2 pcs', costKwd: 0.220 },
          { code: 'RW01-CH01', nameAr: 'جبن شيدر أمريكي', nameEn: 'Cheddar Cheese', qty: '4 slices', costKwd: 0.280 },
        ],
        prepIngredients: [
          { code: 'PP03-CGS', nameAr: 'صوص كانتون الخاص', nameEn: 'Canton Secret Sauce', qty: '60ml', costKwd: 0.144 },
        ],
        packagingItems: [
          { code: 'PI02-WRP', nameAr: 'ورق تغليف برجر مشمع', nameEn: 'Waxed Burger Wrap', qty: '2 pcs', costKwd: 0.060 },
        ],
      },
      {
        nameAr: 'بطاطا كرينكل مقرمشة',
        nameEn: 'Crinkle Cut Crispy Fries',
        qty: 2,
        sku: 'TH03',
        rawIngredients: [
          { code: 'RW01-POT', nameAr: 'بطاطا بلجيكية 9/9 مفرزة', nameEn: 'Frozen Fries', qty: '350g', costKwd: 0.320 },
          { code: 'RW01-OIL', nameAr: 'زيت قلي نباتي نقي', nameEn: 'Vegetable Frying Oil', qty: '60ml', costKwd: 0.080 },
        ],
        prepIngredients: [],
        packagingItems: [
          { code: 'PI02-FRY', nameAr: 'باوتش بطاطا كرافت', nameEn: 'Kraft Fry Pouch', qty: '2 units', costKwd: 0.080 },
        ],
      },
    ],
  },
  {
    id: 'tk-103',
    ticketNo: 'TK-4821',
    orderRef: 'ORD-DLV-8831',
    orderRefAr: 'طلب منصة ديليفرو #8831',
    orderRefEn: 'Deliveroo Order #8831',
    branchId: 'SALMIYA',
    brandId: 'shawarma',
    brandNameAr: 'شاورما طحينة',
    brandNameEn: 'Tahina',
    channelAr: 'منصة ديليفرو',
    channelEn: 'Deliveroo (18%)',
    channelBadge: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    station: 'SHAWARMA',
    stationAr: 'محطة الشاورما والخبز',
    stationEn: 'Shawarma & Bakery',
    orderType: 'DELIVEROO',
    minutesElapsed: 8,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'شاورما دجاج صاج بالثوم والمخلل',
        nameEn: 'Chicken Saj Shawarma',
        qty: 3,
        sku: 'SH02',
        rawIngredients: [
          { code: 'RW01-CK02', nameAr: 'صدور دجاج طازجة متبلة', nameEn: 'Marinated Chicken', qty: '270g', costKwd: 0.650 },
          { code: 'RW01-SAJ', nameAr: 'خبز صاج صاجي مخبوز', nameEn: 'Fresh Saj Bread', qty: '3 pcs', costKwd: 0.150 },
        ],
        prepIngredients: [
          { code: 'PP03-GAR', nameAr: 'كريمة الثوم اللبنانية المميزة', nameEn: 'Garlic Cream CK Prep', qty: '60g', costKwd: 0.120 },
        ],
        packagingItems: [
          { code: 'PI02-BOX', nameAr: 'بوكس كرافت مقسم 3 قطع', nameEn: 'Kraft Trio Box', qty: '1 unit', costKwd: 0.150 },
        ],
      },
    ],
  },
  {
    id: 'tk-104',
    ticketNo: 'TK-4822',
    orderRef: 'ORD-TMP-5501',
    orderRefAr: 'طلب أسطول الشركة #5501',
    orderRefEn: 'Fleet Order #5501',
    branchId: 'JABRIYA',
    brandId: 'noodle',
    brandNameAr: 'ذا نودل بار',
    brandNameEn: 'The Noodle Bar',
    channelAr: 'طلبات (توصيل أسطول الشركة 10%)',
    channelEn: 'Talabat TMP Fleet (10%)',
    channelBadge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    station: 'WOK',
    stationAr: 'محطة الووك والآسيوي',
    stationEn: 'Wok & Asian Station',
    orderType: 'TMP',
    minutesElapsed: 5,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'نودلز ووك الروبيان والخضار الحار',
        nameEn: 'Spicy Wok Shrimp Noodles',
        qty: 1,
        sku: 'NB01',
        rawIngredients: [
          { code: 'RW01-SHR', nameAr: 'روبيان جامبو طازج منظف', nameEn: 'Jumbo Shrimp', qty: '140g', costKwd: 0.850 },
          { code: 'RW01-NOD', nameAr: 'نودلز قمح طازجة مسلوقة', nameEn: 'Fresh Wheat Noodles', qty: '180g', costKwd: 0.220 },
        ],
        prepIngredients: [
          { code: 'PP03-WOK', nameAr: 'صوص الووك والسيشوان', nameEn: 'Wok Szechuan Sauce', qty: '50ml', costKwd: 0.150 },
        ],
        packagingItems: [
          { code: 'PI02-NWK', nameAr: 'وعاء نودلز كرتوني دائري مقاوم للتسريب', nameEn: 'Leakproof Noodle Pail', qty: '1 unit', costKwd: 0.220 },
        ],
      },
    ],
  },
  {
    id: 'tk-105',
    ticketNo: 'TK-4823',
    orderRef: 'ORD-CK-0012',
    orderRefAr: 'أمر إنتاج مركزي #0012',
    orderRefEn: 'Central Batch #0012',
    branchId: 'CK_MAIN',
    brandId: 'chinagarden',
    brandNameAr: 'المطبخ المركزي',
    brandNameEn: 'Central Kitchen',
    channelAr: 'توريد داخلي لفروع الشركة',
    channelEn: 'Internal Branch Transfer',
    channelBadge: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    station: 'WOK',
    stationAr: 'محطة الووك والآسيوي',
    stationEn: 'Wok & Asian Station',
    orderType: 'TAKEAWAY',
    minutesElapsed: 12,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'دفعة صوص كانتون الخاص المجهز (50 لتر)',
        nameEn: 'Canton Secret Sauce Bulk 50L',
        qty: 1,
        sku: 'PP03-CGS',
        notesAr: 'مطابق للمواصفة القياسية وتاريخ الصلاحية 7 أيام',
        notesEn: 'Standard spec with 7-day shelf life',
        rawIngredients: [
          { code: 'RW01-SOY', nameAr: 'صوص صويا فاخر معتق', nameEn: 'Aged Soy Sauce', qty: '20L', costKwd: 14.500 },
          { code: 'RW01-SES', nameAr: 'زيت سمسم نقي ومستخلصات', nameEn: 'Sesame Oil', qty: '5L', costKwd: 6.200 },
        ],
        prepIngredients: [],
        packagingItems: [
          { code: 'PI02-JUG', nameAr: 'جالون غذائي معقم 10 لتر', nameEn: 'Food-Grade Jug 10L', qty: '5 units', costKwd: 1.250 },
        ],
      },
    ],
  },
  {
    id: 'tk-106',
    ticketNo: 'TK-4824',
    orderRef: 'ORD-KTA-3309',
    orderRefAr: 'طلب منصة كيتا #3309',
    orderRefEn: 'Keeta Order #3309',
    branchId: 'ARDHIYA',
    brandId: 'franks',
    brandNameAr: 'فرانكس ستيك',
    brandNameEn: "Frank's Steak",
    channelAr: 'منصة كيتا',
    channelEn: 'Keeta (12%)',
    channelBadge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    station: 'GRILL',
    stationAr: 'محطة الجريل والستيك',
    stationEn: 'Grill & Steak Station',
    orderType: 'KEETA',
    minutesElapsed: 11,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'برجر ترافل أنجوس ديلوكس',
        nameEn: 'Angus Truffle Deluxe Burger',
        qty: 2,
        sku: 'MS03',
        notesAr: 'إكسترا مايونيز ترافل وبطاطا مقرمشة',
        notesEn: 'Extra truffle mayo and crispy fries',
        rawIngredients: [
          { code: 'RW01-BF03', nameAr: 'لحم أنجوس مفروم طازج', nameEn: 'Fresh Angus Beef', qty: '360g', costKwd: 1.800 },
          { code: 'RW01-BN02', nameAr: 'خبز بريوش سمسم', nameEn: 'Brioche Bun', qty: '2 pcs', costKwd: 0.240 },
        ],
        prepIngredients: [
          { code: 'PP03-TRF', nameAr: 'مايونيز الترافل الأسود', nameEn: 'Black Truffle Mayo', qty: '40g', costKwd: 0.350 },
        ],
        packagingItems: [
          { code: 'PI02-BOX', nameAr: 'علبة برجر كرافت مقوى', nameEn: 'Kraft Burger Box', qty: '2 units', costKwd: 0.160 },
        ],
      },
    ],
  },
  {
    id: 'tk-107',
    ticketNo: 'TK-4825',
    orderRef: 'ORD-POS-1049',
    orderRefAr: 'طلب كاشير #1049',
    orderRefEn: 'POS Order #1049',
    branchId: 'MAK',
    brandId: 'karak',
    brandNameAr: 'كرك كافتيريا',
    brandNameEn: 'Karak Cafeteria',
    channelAr: 'سفري / استلام كاونتر',
    channelEn: 'Takeaway / Counter',
    channelBadge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    station: 'PACKING',
    stationAr: 'محطة التغليف والتسليم النهائي',
    stationEn: 'Packing & Final Dispatch',
    orderType: 'TAKEAWAY',
    minutesElapsed: 3,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'شاي كرك زعفران مميز (ترمس 1 لتر)',
        nameEn: 'Signature Saffron Karak Tea (1L Flask)',
        qty: 1,
        sku: 'KR01',
        rawIngredients: [
          { code: 'RW01-TEA', nameAr: 'أوراق شاي سيلاني فاخر وزعفران', nameEn: 'Ceylon Tea & Saffron', qty: '30g', costKwd: 0.450 },
          { code: 'RW01-MLK', nameAr: 'حليب مبخر ممتاز', nameEn: 'Evaporated Milk', qty: '400ml', costKwd: 0.300 },
        ],
        prepIngredients: [],
        packagingItems: [
          { code: 'PI02-FLK', nameAr: 'ترمس كرك حراري 1 لتر', nameEn: 'Thermal Karak Flask 1L', qty: '1 unit', costKwd: 0.400 },
          { code: 'PI02-CUP', nameAr: 'أكواب كرك ورقية سميكة', nameEn: 'Paper Cups Set', qty: '4 pcs', costKwd: 0.080 },
        ],
      },
    ],
  },
  {
    id: 'tk-108',
    ticketNo: 'TK-4826',
    orderRef: 'ORD-TAL-9934',
    orderRefAr: 'طلب منصة طلبات #9934',
    orderRefEn: 'Talabat Order #9934',
    branchId: 'HAWALLI',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    channelAr: 'منصة طلبات (توصيل طلبات 17%)',
    channelEn: 'Talabat GO (17%)',
    channelBadge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    station: 'FRYER',
    stationAr: 'محطة المقليات والبرجر',
    stationEn: 'Fryer & Burger Station',
    orderType: 'TGO',
    minutesElapsed: 7,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'سبرينغ رول خضار مقرمش (4 حبات)',
        nameEn: 'Crispy Veggie Spring Rolls (4 Pcs)',
        qty: 2,
        sku: 'CG04',
        rawIngredients: [
          { code: 'RW01-VEG', nameAr: 'خضار آسيوية طازجة مفرومة', nameEn: 'Fresh Asian Veggies', qty: '200g', costKwd: 0.300 },
          { code: 'RW01-WRP', nameAr: 'عجينة سبرينغ رول مقرمشة', nameEn: 'Spring Roll Wrappers', qty: '8 pcs', costKwd: 0.200 },
        ],
        prepIngredients: [
          { code: 'PP03-SNS', nameAr: 'صوص سويت آند سور', nameEn: 'Sweet & Sour Dip', qty: '40ml', costKwd: 0.100 },
        ],
        packagingItems: [
          { code: 'PI02-BOX', nameAr: 'علبة مقبلات كرتونية فاخرة', nameEn: 'Appetizer Box', qty: '2 units', costKwd: 0.120 },
        ],
      },
    ],
  },
  {
    id: 'tk-109',
    ticketNo: 'TK-4827',
    orderRef: 'ORD-POS-1055',
    orderRefAr: 'طلب كاشير #1055',
    orderRefEn: 'POS Order #1055',
    branchId: 'SHUWAIKH',
    brandId: 'farmbrown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    channelAr: 'طلب محلي بالفرع',
    channelEn: 'Dine-In / Store Order',
    channelBadge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    station: 'GRILL',
    stationAr: 'محطة الجريل والستيك',
    stationEn: 'Grill & Steak Station',
    orderType: 'DINE_IN',
    minutesElapsed: 4,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'أومليت فارم براون بالسبانخ والفيتا',
        nameEn: 'Farm Brown Spinach & Feta Omelette',
        qty: 1,
        sku: 'FB01',
        rawIngredients: [
          { code: 'RW01-EGG', nameAr: 'بيض طازج كويتي عضوي', nameEn: 'Organic Fresh Eggs', qty: '3 pcs', costKwd: 0.280 },
          { code: 'RW01-SPN', nameAr: 'سبانخ وجبن فيتا يوناني', nameEn: 'Spinach & Feta', qty: '60g', costKwd: 0.320 },
        ],
        prepIngredients: [],
        packagingItems: [
          { code: 'PI02-PLT', nameAr: 'صحن تقديم فخار صديق للبيئة', nameEn: 'Eco Plate Dine-in', qty: '1 unit', costKwd: 0.050 },
        ],
      },
    ],
  },
  {
    id: 'tk-110',
    ticketNo: 'TK-4828',
    orderRef: 'ORD-DLV-8845',
    orderRefAr: 'طلب منصة ديليفرو #8845',
    orderRefEn: 'Deliveroo Order #8845',
    branchId: 'KHIRAN',
    brandId: 'franks',
    brandNameAr: 'فرانكس ستيك',
    brandNameEn: "Frank's Steak",
    channelAr: 'منصة ديليفرو',
    channelEn: 'Deliveroo (18%)',
    channelBadge: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    station: 'GRILL',
    stationAr: 'محطة الجريل والستيك',
    stationEn: 'Grill & Steak Station',
    orderType: 'DELIVEROO',
    minutesElapsed: 9,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'ستريبلوين أنجوس مع صوص المشروم',
        nameEn: 'Striploin Steak with Mushroom Sauce',
        qty: 1,
        sku: 'MS02',
        rawIngredients: [
          { code: 'RW01-BF02', nameAr: 'لحم ستريبلوين أنجوس معتق', nameEn: 'Aged Striploin Beef', qty: '280g', costKwd: 2.100 },
        ],
        prepIngredients: [
          { code: 'PP03-MSH', nameAr: 'صوص المشروم الطازج بالكريمة', nameEn: 'Fresh Cream Mushroom Sauce', qty: '60ml', costKwd: 0.250 },
        ],
        packagingItems: [
          { code: 'PI02-STK', nameAr: 'علبة ستيك حرارية فاخرة', nameEn: 'Thermal Steak Box', qty: '1 unit', costKwd: 0.250 },
        ],
      },
    ],
  },
  {
    id: 'tk-111',
    ticketNo: 'TK-4829',
    orderRef: 'ORD-TAL-9950',
    orderRefAr: 'طلب منصة طلبات #9950',
    orderRefEn: 'Talabat Order #9950',
    branchId: 'FARWANIYA',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    channelAr: 'منصة طلبات (توصيل طلبات 17%)',
    channelEn: 'Talabat GO (17%)',
    channelBadge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    station: 'WOK',
    stationAr: 'محطة الووك والآسيوي',
    stationEn: 'Wok & Asian Station',
    orderType: 'TGO',
    minutesElapsed: 6,
    status: 'PREPPING',
    items: [
      {
        nameAr: 'روبيان سويت آند سور مع أرز مقلي',
        nameEn: 'Sweet & Sour Shrimp with Fried Rice',
        qty: 1,
        sku: 'CG02',
        rawIngredients: [
          { code: 'RW01-SHR', nameAr: 'روبيان طازج مقشر', nameEn: 'Fresh Peeled Shrimp', qty: '150g', costKwd: 0.950 },
          { code: 'RW01-RIC', nameAr: 'أرز ياسمين مقلي بالبيض والخضار', nameEn: 'Jasmine Fried Rice', qty: '200g', costKwd: 0.250 },
        ],
        prepIngredients: [
          { code: 'PP03-SNS', nameAr: 'صوص سويت آند سور الكلاسيكي', nameEn: 'Classic Sweet & Sour Sauce', qty: '50ml', costKwd: 0.150 },
        ],
        packagingItems: [
          { code: 'PI02-BWL', nameAr: 'وعاء وجبات صينية حراري', nameEn: 'Thermal Chinese Bowl', qty: '1 unit', costKwd: 0.200 },
        ],
      },
    ],
  },
]

export function VentureKdsHub({
  locale = 'ar',
}: {
  locale?: 'ar' | 'en'
}) {
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const [activeTab, setActiveTab] = useState<'liveTickets' | 'backflush' | 'wasteLogger' | 'velocity'>('liveTickets')
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL')
  const [selectedStation, setSelectedStation] = useState<string>('ALL')
  const [tickets, setTickets] = useState<KdsTicket[]>(INITIAL_KDS_TICKETS)
  const [bumpedTickets, setBumpedTickets] = useState<KdsTicket[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  // Waste Logger Form State
  const [wasteDishName, setWasteDishName] = useState('ستيك ريب آي 300 غرام')
  const [wasteStation, setWasteStation] = useState('GRILL')
  const [wasteCookName, setWasteCookName] = useState('كبير الطهاة: الشيف رافي')
  const [wasteReason, setWasteReason] = useState('احتراق أثناء الطهي على الجريل')
  const [wasteCost, setWasteCost] = useState('2.750')
  const [wasteLogs, setWasteLogs] = useState<Array<{ id: string; time: string; item: string; station: string; cook: string; reason: string; cost: number; gl: string }>>([
    { id: 'WST-401', time: '11:45 ص', item: 'ستيك ريب آي 300 غرام (MS01)', station: 'محطة الجريل', cook: 'الشيف رافي', reason: 'احتراق على الجريل وتجاوز درجة الاستواء المطلوبة', cost: 2.750, gl: '501020 هدر مطبخ' },
    { id: 'WST-402', time: '12:15 م', item: '2x دجاج كانتون تشاينا جاردن (CG01)', station: 'محطة المقليات', cook: 'شيف بيلال', reason: 'خطأ كاشير - تكرار إضافة المكونات', cost: 1.560, gl: '501020 هدر مطبخ' },
    { id: 'WST-403', time: '01:10 م', item: 'طبق نودلز روبيان (NB01)', station: 'محطة الووك', cook: 'شيف أرون', reason: 'طلب العميل بدون فلفل وتم تحضيره حاراً', cost: 1.220, gl: '501020 هدر مطبخ' },
  ])

  // Timer Tick effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTickets((prev) =>
        prev.map((t) => ({ ...t, minutesElapsed: t.minutesElapsed + 0.1 }))
      )
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const currentKitchen = KITCHEN_LOCATIONS.find((k) => k.id === selectedBranch) || KITCHEN_LOCATIONS[0]

  const handleBumpOrder = (ticketId: string) => {
    const target = tickets.find((t) => t.id === ticketId)
    if (!target) return
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setBumpedTickets((prev) => [{ ...target, status: 'BUMPED' }, ...prev])
    setNotice(
      isAr
        ? `تم اعتماد وتجهيز التذكرة ${target.ticketNo} بنجاح، وخصم مكونات الوصفة الخام (RW01) والتجهيزات (PP03) والتغليف (PI02) وترحيل تكلفة الطبق آلياً لدفتر الأستاذ!`
        : `Ticket ${target.ticketNo} bumped! BOM ingredients deducted from stock & food cost posted to general ledger!`
    )
    setTimeout(() => setNotice(null), 5000)
  }

  const handleLogWaste = (e: React.FormEvent) => {
    e.preventDefault()
    const newLog = {
      id: `WST-${Math.floor(100 + Math.random() * 900)}`,
      time: isAr ? 'الآن' : 'Just now',
      item: wasteDishName,
      station: wasteStation === 'GRILL' ? (isAr ? 'محطة الجريل' : 'Grill Station') : wasteStation === 'FRYER' ? (isAr ? 'محطة المقليات' : 'Fryer Station') : (isAr ? 'محطة الووك' : 'Wok Station'),
      cook: wasteCookName,
      reason: wasteReason,
      cost: parseFloat(wasteCost) || 0,
      gl: isAr ? '501020 مصروف هدر مطبخ' : '501020 Kitchen Spoilage',
    }
    setWasteLogs((prev) => [newLog, ...prev])
    setNotice(
      isAr
        ? `تم تسجيل الهدر بمبلغ ${wasteCost} د.ك وترحيله فورياً لحساب (مصروف هدر وتوالف المطبخ 501020) في المحاسبة العامة!`
        : `Kitchen waste ${wasteCost} KWD recorded and posted to Spoilage Expense GL 501020!`
    )
    setTimeout(() => setNotice(null), 5000)
  }

  // Filter Tickets
  const filteredTickets = tickets.filter((t) => {
    // Branch Filter
    if (selectedBranch !== 'ALL') {
      const branchMatches = t.branchId === selectedBranch
      const brandMatches = currentKitchen.brands.includes(t.brandId)
      if (!branchMatches && !brandMatches) return false
    }
    // Station Filter
    if (selectedStation !== 'ALL' && t.station !== selectedStation) return false
    return true
  })

  // Urgent Penalty Risk Counter (> 20 min)
  const penaltyRiskCount = filteredTickets.filter((t) => t.minutesElapsed >= 20).length
  const approachingSlaCount = filteredTickets.filter((t) => t.minutesElapsed >= 15 && t.minutesElapsed < 20).length

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#07090f] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
              <Flame size={14} />
              {isAr ? 'شاشة تحضير المطبخ الذكية ومراقبة زمن التجهيز' : 'Smart Kitchen Display System & Penalty Shield'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-1 text-xs font-bold text-indigo-300">
              <UtensilsCrossed size={13} className="text-indigo-400" />
              <span>{isAr ? currentKitchen.chefAr : currentKitchen.chefEn}</span>
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl tracking-tight">
            {isAr ? 'لوحة تحكم محطات المطبخ والخصم اللحظي للمخزون' : 'Kitchen Station Command & Real-Time Backflushing'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-4xl">
            {isAr
              ? 'مراقبة زمن تحضير الوجبات بالثواني، تفادي تأخير منصات التوصيل (15–20 دقيقة)، والخصم اللحظي للمكونات من المخزون وفق الوصفات القياسية'
              : 'Real-time dish prep monitoring, aggregator penalty avoidance (15-20 min), and automated inventory deduction per standard recipes'}
          </p>
        </div>

        {/* Global Controls, Branch Selector & Language */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-amber-500/50 hover:bg-slate-800 transition-all shadow-sm"
          >
            <span>🏠</span>
            <span>{isAr ? 'العودة للوحة القيادة' : 'Back to Dashboard'}</span>
          </a>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-xs sm:max-w-md"
            title={isAr ? 'اختيار الفرع أو المطبخ المركزي' : 'Select Branch or Central Kitchen'}
          >
            {KITCHEN_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {isAr ? loc.nameAr : loc.nameEn}
              </option>
            ))}
          </select>

          <ThemeToggle />

          <button
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
          >
            {isAr ? 'عربي | EN' : 'EN | عربي'}
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3.5 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* SLA Penalty Shield Alert Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'التذاكر النشطة بالمطبخ' : 'Active Kitchen Tickets'}</div>
          <div className="text-xl font-black text-white mt-1">{filteredTickets.length} <span className="text-xs text-slate-400">{isAr ? 'تذكرة' : 'tickets'}</span></div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {isAr ? `الموقع: ${currentKitchen.nameAr.split('(')[0].trim()}` : `Location: ${currentKitchen.nameEn.split('(')[0].trim()}`}
          </div>
        </div>

        <div className={`rounded-xl border p-3.5 ${penaltyRiskCount > 0 ? 'border-rose-500/50 bg-rose-950/40 animate-pulse' : 'border-slate-800 bg-slate-900/80'}`}>
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'خطر غرامة تأخير المنصات (> 20 دقيقة)' : 'Penalty Risk (>20m)'}</div>
          <div className={`text-xl font-black mt-1 ${penaltyRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {penaltyRiskCount} <span className="text-xs text-slate-400">{isAr ? 'تذاكر معرضة للغرامة' : 'at penalty risk'}</span>
          </div>
          <div className="text-[10px] text-rose-300 mt-0.5">{isAr ? 'غرامة تأخير طلبات/ديليفرو 1.500 د.ك' : 'Risk of 1.500 KWD delivery penalty'}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'اقتراب من الحد الزمني المسموح (15 - 20 دقيقة)' : 'Approaching Prep Limit (15-20m)'}</div>
          <div className="text-xl font-black text-amber-400 mt-1">{approachingSlaCount} <span className="text-xs text-slate-400">{isAr ? 'تذكرة تحذير' : 'warning tickets'}</span></div>
          <div className="text-[10px] text-amber-300/80 mt-0.5">{isAr ? 'أولوية تحضير وتجهيز فورية' : 'High prep priority'}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'متوسط سرعة إعداد التذكرة' : 'Avg Ticket Prep Velocity'}</div>
          <div className="text-xl font-black text-emerald-400 mt-1">7.4 <span className="text-xs text-slate-400">{isAr ? 'دقائق' : 'minutes'}</span></div>
          <div className="text-[10px] text-emerald-400/80 mt-0.5">{isAr ? 'ضمن المعيار الذهبي المعتمد للشركة' : 'Within corporate target (<9m)'}</div>
        </div>
      </div>

      {/* 4 Specialized Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'liveTickets', labelAr: '🔥 لوحة التذاكر الحية ومراقبة زمن التحضير', labelEn: 'Live Tickets & Prep Time Command', icon: Flame },
          { key: 'backflush', labelAr: '📦 الخصم اللحظي للمكونات وحساب تكلفة الأغذية الآلي', labelEn: 'Inventory Backflushing & Food Cost Trigger', icon: TrendingDown },
          { key: 'wasteLogger', labelAr: '🗑️ سجل هدر المطبخ وإعادة الطبخ المالي', labelEn: 'Kitchen Waste & Re-fire Financial Logger', icon: Trash2 },
          { key: 'velocity', labelAr: '⏱️ كفاءة وسرعة محطات المطبخ وتكلفة الساعة', labelEn: 'Station Velocity & Efficiency', icon: Gauge },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon size={15} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: Live Kitchen Tickets & Penalty Shield */}
      {activeTab === 'liveTickets' && (
        <div className="space-y-4">
          {/* Station Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', labelAr: 'جميع المحطات (5)', labelEn: 'All Stations (5)' },
                { id: 'GRILL', labelAr: 'محطة الجريل والستيك', labelEn: 'Grill & Steak Station' },
                { id: 'WOK', labelAr: 'محطة الووك والآسيوي', labelEn: 'Wok & Asian Station' },
                { id: 'SHAWARMA', labelAr: 'محطة الشاورما والمقبلات', labelEn: 'Shawarma & Appetizers' },
                { id: 'FRYER', labelAr: 'محطة المقليات والبرجر', labelEn: 'Fryer & Burger Station' },
                { id: 'PACKING', labelAr: 'محطة التغليف والتسليم النهائي', labelEn: 'Packing & Final Dispatch' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStation(st.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedStation === st.id
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {isAr ? st.labelAr : st.labelEn}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              {isAr ? `تحديث فوري بالثواني · ${filteredTickets.length} تذاكر قيد الطهي` : `Real-time sync · ${filteredTickets.length} tickets prepping`}
            </div>
          </div>

          {/* Tickets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTickets.map((ticket) => {
              const minutes = Math.floor(ticket.minutesElapsed)
              const seconds = Math.floor((ticket.minutesElapsed - minutes) * 60)
              const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

              const isDanger = ticket.minutesElapsed >= 20
              const isWarning = ticket.minutesElapsed >= 15 && ticket.minutesElapsed < 20
              const isAmber = ticket.minutesElapsed >= 10 && ticket.minutesElapsed < 15

              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl border bg-slate-900/90 p-4 shadow-xl flex flex-col justify-between transition-all ${
                    isDanger
                      ? 'border-rose-500/80 shadow-rose-950/50 animate-pulse'
                      : isWarning
                      ? 'border-orange-500/80 shadow-orange-950/40'
                      : isAmber
                      ? 'border-amber-500/50'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Ticket Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-black text-white">{ticket.ticketNo}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({isAr ? ticket.orderRefAr : ticket.orderRefEn})
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-amber-400 mt-0.5">
                          {isAr ? ticket.brandNameAr : ticket.brandNameEn}
                        </div>
                      </div>

                      {/* Live Prep Timer Badge */}
                      <div
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-mono font-black ${
                          isDanger
                            ? 'bg-rose-500 text-white animate-bounce'
                            : isWarning
                            ? 'bg-orange-500 text-black'
                            : isAmber
                            ? 'bg-amber-500 text-black'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        <Clock size={12} />
                        {timeString}
                      </div>
                    </div>

                    {/* Channel & Station Tag */}
                    <div className="flex items-center justify-between gap-1 mt-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ticket.channelBadge}`}>
                        {isAr ? ticket.channelAr : ticket.channelEn}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {isAr ? ticket.stationAr : ticket.stationEn}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-2.5">
                      {ticket.items.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-start justify-between text-xs font-bold text-white">
                            <span>
                              <span className="font-mono text-amber-400 mr-1">{item.qty}x</span>
                              {isAr ? item.nameAr : item.nameEn}
                            </span>
                            <span className="font-mono text-[10px] text-indigo-400">{item.sku}</span>
                          </div>
                          {(item.notesAr || item.notesEn) && (
                            <div className="rounded bg-slate-950/80 px-2 py-1 text-[10px] font-medium text-rose-300 border border-rose-500/20">
                              ⚠️ {isAr ? item.notesAr : item.notesEn}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions: Mark Ready / Bump */}
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleBumpOrder(ticket.id)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
                    >
                      <CheckCircle2 size={15} />
                      {isAr ? '✅ جاهز للتسليم والاعتماد' : '✅ Bump / Mark Ready'}
                    </button>
                    <div className="text-center text-[9px] text-slate-400 mt-1.5 leading-tight">
                      {isAr ? 'الضغط يخصم المكونات من المخزون ويرحّل تكلفة الطبق آلياً' : 'Triggers inventory backflushing & food cost GL post'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Real-Time Inventory Backflushing & Food Cost Trigger */}
      {activeTab === 'backflush' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <TrendingDown size={18} className="text-emerald-400" />
                {isAr ? 'الخصم اللحظي للمخزون وترحيل تكلفة الأغذية المباعة' : 'Inventory Backflushing & Automated Food Cost Trigger'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'تفكيك فوري لشجرة الوصفة القياسية عند خروج كل طلب من المطبخ، وخصم المواد الخام والتحضيرات ومواد التغليف من رصيد الفرع'
                  : 'Real-time standard recipe BOM explosion upon kitchen fulfillment, reducing branch inventory & posting direct food cost'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {filteredTickets.map((ticket) => {
              const totalTicketCogs = ticket.items.reduce((acc, it) => {
                const rawSum = it.rawIngredients.reduce((s, r) => s + r.costKwd, 0)
                const prepSum = it.prepIngredients.reduce((s, p) => s + p.costKwd, 0)
                const packSum = it.packagingItems.reduce((s, k) => s + k.costKwd, 0)
                return acc + (rawSum + prepSum + packSum) * it.qty
              }, 0)

              return (
                <div key={ticket.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-white">{ticket.ticketNo}</span>
                      <span className="text-xs font-bold text-amber-400">({isAr ? ticket.brandNameAr : ticket.brandNameEn})</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {isAr ? ticket.orderRefAr : ticket.orderRefEn}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400">{isAr ? 'إجمالي تكلفة الطبق المحسوبة:' : 'Calculated Food Cost:'}</span>
                      <span className="font-mono text-sm font-black text-emerald-400 ml-2">
                        {totalTicketCogs.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                    </div>
                  </div>

                  {/* Exploded BOM Breakdown */}
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="text-xs font-bold text-white flex items-center justify-between">
                        <span>{item.qty}x {isAr ? item.nameAr : item.nameEn} ({item.sku})</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                        {/* Raw materials */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1">
                          <div className="text-[10px] font-bold text-blue-400">{isAr ? 'مواد خام (لحوم/دواجن/خضار)' : 'Raw Materials RW01'}</div>
                          {item.rawIngredients.map((r, ri) => (
                            <div key={ri} className="flex justify-between text-slate-300">
                              <span>{isAr ? r.nameAr : r.nameEn} ({r.qty})</span>
                              <span className="font-mono text-white">{r.costKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                            </div>
                          ))}
                        </div>

                        {/* Central Preps */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1">
                          <div className="text-[10px] font-bold text-amber-400">{isAr ? 'تحضيرات المطبخ المركزي (صوصات وتتبيل)' : 'Central Kitchen Preps PP03'}</div>
                          {item.prepIngredients.length === 0 ? (
                            <div className="text-slate-500">{isAr ? 'لا توجد تحضيرات مسبقة' : 'No preps required'}</div>
                          ) : (
                            item.prepIngredients.map((p, pi) => (
                              <div key={pi} className="flex justify-between text-slate-300">
                                <span>{isAr ? p.nameAr : p.nameEn} ({p.qty})</span>
                                <span className="font-mono text-white">{p.costKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Packaging Disposables */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1">
                          <div className="text-[10px] font-bold text-purple-400">{isAr ? 'مواد التغليف والاستهلاك' : 'Packaging & Disposables PI02'}</div>
                          {item.packagingItems.map((k, ki) => (
                            <div key={ki} className="flex justify-between text-slate-300">
                              <span>{isAr ? k.nameAr : k.nameEn}</span>
                              <span className="font-mono text-white">{k.costKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Kitchen Waste & Re-fire Logger */}
      {activeTab === 'wasteLogger' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Waste Input Form (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Trash2 size={18} className="text-rose-400" />
              {isAr ? 'تسجيل هدر المطبخ وإعادة الطهي' : 'Kitchen Waste & Re-fire Financial Logger'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'توثيق أي وجبة محترقة أو خطأ إعداد بالوزن والتكلفة لترحيلها لحساب (مصروف هدر وتوالف المطبخ 501020)'
                : 'Log burned, dropped or misprepared dishes with direct cost to record in Spoilage GL account 501020'}
            </p>

            <form onSubmit={handleLogWaste} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'اسم الطبق أو الصنف التالف:' : 'Dish Name / SKU:'}</label>
                <input
                  type="text"
                  value={wasteDishName}
                  onChange={(e) => setWasteDishName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">{isAr ? 'محطة المطبخ:' : 'Station:'}</label>
                  <select
                    value={wasteStation}
                    onChange={(e) => setWasteStation(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="GRILL">{isAr ? 'محطة الجريل والستيك' : 'Grill Station'}</option>
                    <option value="FRYER">{isAr ? 'محطة المقليات والبرجر' : 'Fryer Station'}</option>
                    <option value="WOK">{isAr ? 'محطة الووك والآسيوي' : 'Wok Station'}</option>
                    <option value="SHAWARMA">{isAr ? 'محطة الشاورما والمقبلات' : 'Shawarma'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">{isAr ? 'التكلفة المباشرة (د.ك):' : 'Direct Cost (KWD):'}</label>
                  <input
                    type="text"
                    value={wasteCost}
                    onChange={(e) => setWasteCost(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs font-bold text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'اسم الطاهي / المسؤول:' : 'Cook / Responsible Chef:'}</label>
                <input
                  type="text"
                  value={wasteCookName}
                  onChange={(e) => setWasteCookName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'سبب التلف / إعادة الطهي:' : 'Failure Reason / Cause:'}</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="احتراق أثناء الطهي على الجريل">{isAr ? 'احتراق أثناء الطهي وتجاوز درجة الاستواء' : 'Burned during cooking'}</option>
                  <option value="خطأ كاشير في إدخال المكونات">{isAr ? 'خطأ كاشير في إدخال تفاصيل الصنف' : 'Cashier input error'}</option>
                  <option value="تعديل أو إلغاء من العميل بعد التحضير">{isAr ? 'تعديل أو إلغاء من العميل بعد بدء التحضير' : 'Customer cancel post-prep'}</option>
                  <option value="انتهاء فترة الصلاحية الاستهلاكية للتحضير المسبق">{isAr ? 'انتهاء فترة الحفظ الاستهلاكية للتحضير المسبق' : 'FIFO prep storage expiry'}</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-rose-500 py-3 text-xs font-bold text-white hover:bg-rose-400 transition-all shadow-lg shadow-rose-500/10"
              >
                {isAr ? 'ترحيل قيد الهدر لدفتر الأستاذ (حساب 501020)' : 'Post Spoilage Expense to General Ledger'}
              </button>
            </form>
          </div>

          {/* Waste Logs Table (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white">
                {isAr ? 'سجل الهدر والتوالف المالي المعتمد لليوم' : "Today's Audited Kitchen Spoilage Log"}
              </h3>
              <div className="font-mono text-xs font-bold text-rose-400">
                {isAr ? 'المجموع اليومي:' : 'Total Waste:'} {wasteLogs.reduce((a, b) => a + b.cost, 0).toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-2">{isAr ? 'المرجع' : 'Ref'}</th>
                    <th className="py-2.5 px-2">{isAr ? 'الوقت والصنف' : 'Time & Item'}</th>
                    <th className="py-2.5 px-2">{isAr ? 'السبب والمسوغ' : 'Reason'}</th>
                    <th className="py-2.5 px-2 text-left">{isAr ? 'التكلفة (د.ك)' : 'Cost (KWD)'}</th>
                    <th className="py-2.5 px-2">{isAr ? 'الحساب المحاسبي' : 'GL Account'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {wasteLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-2 font-mono text-slate-400">{log.id}</td>
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-white">{log.item}</div>
                        <div className="text-[10px] text-slate-400">{log.time} · {log.cook}</div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-300 text-[11px]">{log.reason}</td>
                      <td className="py-2.5 px-2 font-mono font-bold text-rose-400 text-left">{log.cost.toFixed(3)}</td>
                      <td className="py-2.5 px-2 font-mono text-[10px] text-indigo-400">{log.gl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Station Velocity & Kitchen Labor Efficiency */}
      {activeTab === 'velocity' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg">
                {isAr ? 'تحليل كفاءة وسرعة محطات المطبخ وتكلفة الساعة' : 'Kitchen Station Velocity & Labor Productivity Analysis'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'مؤشرات أداء سرعة تجهيز الطلبات وساعات الذروة وتكلفة عمالة المطبخ المحملة على كل تذكرة'
                  : 'Fulfillment speed benchmarks, peak hour throughput, and kitchen labor cost allocated per dish'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { stationAr: 'محطة الجريل والستيك (فرانكس)', stationEn: "Grill & Steak (Frank's)", avgTime: isAr ? '11.2 دقيقة' : '11.2 min', target: isAr ? '12.0 دقيقة' : '12.0 min', throughput: isAr ? '48 طبق/ساعة' : '48 plates/hr', laborCost: isAr ? '0.450 د.ك' : '0.450 KWD', badge: 'text-amber-400' },
              { stationAr: 'محطة الووك والصيني (تشاينا جاردن)', stationEn: 'Wok & Asian (China Garden)', avgTime: isAr ? '6.4 دقائق' : '6.4 min', target: isAr ? '7.0 دقائق' : '7.0 min', throughput: isAr ? '110 طلب/ساعة' : '110 orders/hr', laborCost: isAr ? '0.280 د.ك' : '0.280 KWD', badge: 'text-emerald-400' },
              { stationAr: 'محطة الشاورما والخبز', stationEn: 'Shawarma & Bakery', avgTime: isAr ? '4.8 دقائق' : '4.8 min', target: isAr ? '5.5 دقائق' : '5.5 min', throughput: isAr ? '140 ساندوتش/ساعة' : '140 wraps/hr', laborCost: isAr ? '0.210 د.ك' : '0.210 KWD', badge: 'text-emerald-400' },
              { stationAr: 'محطة الووك والنودلز الآسيوي', stationEn: 'Wok & Noodle Station', avgTime: isAr ? '7.8 دقائق' : '7.8 min', target: isAr ? '8.5 دقائق' : '8.5 min', throughput: isAr ? '55 طبق/ساعة' : '55 dishes/hr', laborCost: isAr ? '0.380 د.ك' : '0.380 KWD', badge: 'text-blue-400' },
            ].map((st, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="font-bold text-white text-xs">{isAr ? st.stationAr : st.stationEn}</div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-[11px]">{isAr ? 'متوسط زمن الإعداد:' : 'Avg Prep Time:'}</span>
                  <span className={`font-mono text-sm font-black ${st.badge}`}>{st.avgTime}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{isAr ? 'الطاقة بساعة الذروة:' : 'Peak Throughput:'}</span>
                  <span className="font-mono text-white font-bold">{st.throughput}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{isAr ? 'تكلفة العمالة/الطلب:' : 'Labor Cost/Ticket:'}</span>
                  <span className="font-mono text-indigo-400 font-bold">{st.laborCost}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
