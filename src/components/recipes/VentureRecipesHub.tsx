'use client'

import React, { useState } from 'react'
import {
  BookOpen,
  Scale,
  Bike,
  TrendingUp,
  Factory,
  ArrowRightLeft,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Building2,
  UtensilsCrossed,
  Package,
  Layers,
  Sparkles,
  Percent,
  Printer,
  Edit3,
} from 'lucide-react'
import { AutomatedGlBridge } from '@/components/finance/AutomatedGlBridge'
import { ThemeToggle } from '@/components/ThemeToggle'

export interface MultiLevelBomRecipe {
  id: string
  sku: string
  nameAr: string
  nameEn: string
  brandId: string
  brandNameAr: string
  brandNameEn: string
  categoryAr: string
  categoryEn: string
  sellingPrice: number
  targetCostPercent: number
  rawLevel1: Array<{ code: string; nameAr: string; nameEn: string; qty: string; unitCost: number; yieldPercent: number; costKwd: number }>
  prepLevel2: Array<{ code: string; nameAr: string; nameEn: string; qty: string; unitCost: number; costKwd: number }>
  packagingLevel3: Array<{ code: string; nameAr: string; nameEn: string; qty: string; unitCost: number; costKwd: number }>
}

export function formatUnit(qty: string, isAr: boolean): string {
  if (!isAr) return qty
  return qty
    .replace(/(\d+)\s*g\b/gi, '$1 غرام')
    .replace(/(\d+)\s*ml\b/gi, '$1 مل')
    .replace(/(\d+)\s*L\b/gi, '$1 لتر')
    .replace(/(\d+)\s*kg\b/gi, '$1 كجم')
    .replace(/(\d+)\s*unit\b/gi, '$1 علبة')
    .replace(/(\d+)\s*units\b/gi, '$1 علب')
    .replace(/(\d+)\s*set\b/gi, '$1 طقم')
    .replace(/(\d+)\s*sets\b/gi, '$1 أطقم')
    .replace(/(\d+)\s*pcs\b/gi, '$1 حبة')
    .replace(/(\d+)\s*slices\b/gi, '$1 شريحة')
}

export const DETAILED_RECIPES: MultiLevelBomRecipe[] = [
  // Frank's Steak
  {
    id: 'rec-01',
    sku: 'MS01',
    nameAr: 'ستيك بلاك أنجوس ريب آي 300 غرام',
    nameEn: 'Black Angus Ribeye Steak 300g',
    brandId: 'franks',
    brandNameAr: 'فرانكس ستيك',
    brandNameEn: "Frank's Steak",
    categoryAr: 'الستيك الفاخر',
    categoryEn: 'Premium Steaks',
    sellingPrice: 9.850,
    targetCostPercent: 28.0,
    rawLevel1: [
      { code: 'RW01-BF01', nameAr: 'لحم أنجوس خام مبرد (أسترالي)', nameEn: 'Chilled Angus Ribeye', qty: '330g', unitCost: 6.800, yieldPercent: 91.0, costKwd: 2.244 },
      { code: 'RW01-BT01', nameAr: 'زبدة وأعشاب إكليل الجبل', nameEn: 'Herb Butter', qty: '25g', unitCost: 3.200, yieldPercent: 100, costKwd: 0.080 },
    ],
    prepLevel2: [
      { code: 'PP03-PPR', nameAr: 'صوص الفلفل الأسود (المطبخ المركزي)', nameEn: 'Black Pepper Demi Prep', qty: '80ml', unitCost: 2.800, costKwd: 0.224 },
      { code: 'PP03-MSH', nameAr: 'بطاطا مهروسة متبلة', nameEn: 'Mashed Potato CK Prep', qty: '150g', unitCost: 1.100, costKwd: 0.165 },
    ],
    packagingLevel3: [
      { code: 'PI02-STK', nameAr: 'علبة ستيك حرارية محكمة الإغلاق', nameEn: 'Thermal Steak Box', qty: '1 unit', unitCost: 0.220, costKwd: 0.220 },
      { code: 'PI02-CUT', nameAr: 'طقم شوكة وسكين خشبي فاخر', nameEn: 'Wood Cutlery Set', qty: '1 set', unitCost: 0.080, costKwd: 0.080 },
    ],
  },
  {
    id: 'rec-02',
    sku: 'MS02',
    nameAr: 'ستريبلوين أنجوس مع صوص المشروم',
    nameEn: 'Striploin Steak with Mushroom Sauce',
    brandId: 'franks',
    brandNameAr: 'فرانكس ستيك',
    brandNameEn: "Frank's Steak",
    categoryAr: 'الستيك الفاخر',
    categoryEn: 'Premium Steaks',
    sellingPrice: 8.750,
    targetCostPercent: 27.5,
    rawLevel1: [
      { code: 'RW01-BF02', nameAr: 'لحم ستريبلوين أنجوس معتق', nameEn: 'Aged Striploin Beef', qty: '290g', unitCost: 6.200, yieldPercent: 93.0, costKwd: 1.798 },
      { code: 'RW01-OIL', nameAr: 'زيت زيتون بكر وتوابل', nameEn: 'Olive Oil & Seasoning', qty: '15ml', unitCost: 2.100, yieldPercent: 100, costKwd: 0.032 },
    ],
    prepLevel2: [
      { code: 'PP03-MSH', nameAr: 'صوص المشروم الطازج بالكريمة', nameEn: 'Fresh Cream Mushroom Sauce', qty: '70ml', unitCost: 2.600, costKwd: 0.182 },
    ],
    packagingLevel3: [
      { code: 'PI02-STK', nameAr: 'علبة ستيك حرارية محكمة', nameEn: 'Thermal Steak Box', qty: '1 unit', unitCost: 0.220, costKwd: 0.220 },
    ],
  },
  {
    id: 'rec-03',
    sku: 'MS03',
    nameAr: 'برجر ترافل أنجوس ديلوكس',
    nameEn: 'Angus Truffle Deluxe Burger',
    brandId: 'franks',
    brandNameAr: 'فرانكس ستيك',
    brandNameEn: "Frank's Steak",
    categoryAr: 'البرجر الفاخر',
    categoryEn: 'Gourmet Burgers',
    sellingPrice: 4.500,
    targetCostPercent: 26.0,
    rawLevel1: [
      { code: 'RW01-BF03', nameAr: 'لحم أنجوس مفروم طازج', nameEn: 'Fresh Angus Beef', qty: '180g', unitCost: 3.800, yieldPercent: 88.0, costKwd: 0.684 },
      { code: 'RW01-BN01', nameAr: 'خبز بريوش فاخر طازج', nameEn: 'Brioche Bun', qty: '1 pc', unitCost: 0.120, yieldPercent: 100, costKwd: 0.120 },
      { code: 'RW01-CH01', nameAr: 'جبن شيدر أصفر معتق', nameEn: 'Cheddar Cheese', qty: '2 slices', unitCost: 0.080, yieldPercent: 100, costKwd: 0.160 },
    ],
    prepLevel2: [
      { code: 'PP03-TRF', nameAr: 'مايونيز الترافل الأسود (تحضير مركزي)', nameEn: 'Black Truffle Mayo CK', qty: '30g', unitCost: 4.500, costKwd: 0.135 },
    ],
    packagingLevel3: [
      { code: 'PI02-BOX', nameAr: 'علبة برجر كرافت مقوى', nameEn: 'Kraft Burger Box', qty: '1 unit', unitCost: 0.080, costKwd: 0.080 },
    ],
  },

  // China Garden
  {
    id: 'rec-04',
    sku: 'CG01',
    nameAr: 'دجاج كانتون تشاينا جاردن المميز',
    nameEn: 'China Garden Special Canton Chicken',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'الأطباق الصينية والآسيوية',
    categoryEn: 'Chinese & Asian Mains',
    sellingPrice: 4.500,
    targetCostPercent: 25.5,
    rawLevel1: [
      { code: 'RW01-CK01', nameAr: 'صدور دجاج طازجة مقطعة مكعبات', nameEn: 'Fresh Diced Chicken Breast', qty: '220g', unitCost: 2.400, yieldPercent: 92.0, costKwd: 0.528 },
      { code: 'RW01-VG01', nameAr: 'فلفل رومي وبصل وجزر طازج', nameEn: 'Mixed Bell Peppers & Onions', qty: '120g', unitCost: 0.650, yieldPercent: 95.0, costKwd: 0.078 },
      { code: 'RW01-RC01', nameAr: 'أرز بسمتي أبيض مطهو بالبخار', nameEn: 'Steamed Jasmine Rice', qty: '200g', unitCost: 0.550, yieldPercent: 100, costKwd: 0.110 },
      { code: 'RW01-SS01', nameAr: 'زيت سمسم وصلصة صويا فاخرة', nameEn: 'Sesame Oil & Premium Soy Sauce', qty: '25ml', unitCost: 1.800, yieldPercent: 100, costKwd: 0.045 },
    ],
    prepLevel2: [
      { code: 'PP03-CGS', nameAr: 'خلطة صوص كانتون السرية (المطبخ المركزي)', nameEn: 'China Garden Canton Secret Sauce', qty: '60ml', unitCost: 2.400, costKwd: 0.144 },
    ],
    packagingLevel3: [
      { code: 'PI02-BOX', nameAr: 'علبة وجبات صينية حرارية محكمة الإغلاق', nameEn: 'Thermal Asian Meal Container', qty: '1 unit', unitCost: 0.120, costKwd: 0.120 },
      { code: 'PI02-CUT', nameAr: 'طقم شوكة وعيدان أكل صينية ومحارم', nameEn: 'Chopsticks & Cutlery Kit', qty: '1 set', unitCost: 0.045, costKwd: 0.045 },
    ],
  },
  {
    id: 'rec-05',
    sku: 'CG02',
    nameAr: 'روبيان سويت آند سور مع أرز مقلي',
    nameEn: 'Sweet & Sour Shrimp with Fried Rice',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'الأطباق الصينية والآسيوية',
    categoryEn: 'Chinese & Asian Mains',
    sellingPrice: 5.250,
    targetCostPercent: 26.5,
    rawLevel1: [
      { code: 'RW01-SHR', nameAr: 'روبيان جامبو طازج مقشر', nameEn: 'Fresh Jumbo Shrimp', qty: '160g', unitCost: 4.800, yieldPercent: 95.0, costKwd: 0.768 },
      { code: 'RW01-RIC', nameAr: 'أرز ياسمين مقلي بالبيض والخضار', nameEn: 'Egg Fried Rice', qty: '220g', unitCost: 0.750, yieldPercent: 100, costKwd: 0.165 },
    ],
    prepLevel2: [
      { code: 'PP03-SNS', nameAr: 'صوص سويت آند سور الكلاسيكي', nameEn: 'Classic Sweet & Sour Sauce', qty: '70ml', unitCost: 2.200, costKwd: 0.154 },
    ],
    packagingLevel3: [
      { code: 'PI02-BWL', nameAr: 'وعاء وجبات صينية حراري', nameEn: 'Thermal Asian Bowl', qty: '1 unit', unitCost: 0.140, costKwd: 0.140 },
    ],
  },
  {
    id: 'rec-06',
    sku: 'CG04',
    nameAr: 'سبرينغ رول خضار مقرمش (4 حبات)',
    nameEn: 'Crispy Veggie Spring Rolls (4 Pcs)',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'المقبلات والجانبية',
    categoryEn: 'Appetizers & Sides',
    sellingPrice: 1.750,
    targetCostPercent: 22.0,
    rawLevel1: [
      { code: 'RW01-VEG', nameAr: 'خضار مشكلة طازجة مفرومة', nameEn: 'Minced Veggies', qty: '140g', unitCost: 0.600, yieldPercent: 96.0, costKwd: 0.084 },
      { code: 'RW01-WRP', nameAr: 'رقائق سبرينغ رول مقرمشة', nameEn: 'Spring Roll Wrappers', qty: '4 pcs', unitCost: 0.040, yieldPercent: 100, costKwd: 0.160 },
    ],
    prepLevel2: [
      { code: 'PP03-SWT', nameAr: 'صوص التغميس الحار والحلو', nameEn: 'Sweet Chili Dip', qty: '30ml', unitCost: 1.500, costKwd: 0.045 },
    ],
    packagingLevel3: [
      { code: 'PI02-APP', nameAr: 'علبة مقبلات كرتونية فاخرة', nameEn: 'Appetizer Box', qty: '1 unit', unitCost: 0.070, costKwd: 0.070 },
    ],
  },

  // Marina Kashta Exhibition Specials (China Garden)
  {
    id: 'rec-07',
    sku: 'EXCG0001',
    nameAr: 'بوكس دجاج كانتون كشتة المارينا الخاص',
    nameEn: 'Marina Kashta Special Canton Chicken Box',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'معارض كشتة المارينا',
    categoryEn: 'Marina Kashta Exhibition',
    sellingPrice: 3.950,
    targetCostPercent: 24.0,
    rawLevel1: [
      { code: 'RW01-CK01', nameAr: 'دجاج كانتون متبل مسبقاً', nameEn: 'Marinated Canton Chicken', qty: '180g', unitCost: 2.200, yieldPercent: 94.0, costKwd: 0.396 },
      { code: 'RW01-NOD', nameAr: 'نودلز كانتون سريعة الطهي', nameEn: 'Canton Noodles', qty: '160g', unitCost: 0.600, yieldPercent: 100, costKwd: 0.096 },
    ],
    prepLevel2: [
      { code: 'PP03-CGS', nameAr: 'صوص كانتون كشتة المارينا المركز', nameEn: 'Kashta Canton Sauce', qty: '50ml', unitCost: 2.400, costKwd: 0.120 },
    ],
    packagingLevel3: [
      { code: 'PI02-KSH', nameAr: 'بوكس كشتة كرافت مطبوع للمعارض', nameEn: 'Printed Kashta Kraft Box', qty: '1 unit', unitCost: 0.180, costKwd: 0.180 },
    ],
  },
  {
    id: 'rec-08',
    sku: 'EXCG0002',
    nameAr: 'كومبو نودلز وروبيان كشتة المارينا',
    nameEn: 'Marina Kashta Shrimp & Noodle Combo',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'معارض كشتة المارينا',
    categoryEn: 'Marina Kashta Exhibition',
    sellingPrice: 4.500,
    targetCostPercent: 25.0,
    rawLevel1: [
      { code: 'RW01-SHR', nameAr: 'روبيان مقلي مقرمش جاهز', nameEn: 'Crispy Battered Shrimp', qty: '130g', unitCost: 4.200, yieldPercent: 95.0, costKwd: 0.546 },
      { code: 'RW01-NOD', nameAr: 'نودلز ووك كشتة خاصة', nameEn: 'Wok Noodles', qty: '170g', unitCost: 0.600, yieldPercent: 100, costKwd: 0.102 },
    ],
    prepLevel2: [
      { code: 'PP03-WOK', nameAr: 'صوص الووك الحلو والمدخن', nameEn: 'Smoky Sweet Wok Sauce', qty: '40ml', unitCost: 2.000, costKwd: 0.080 },
    ],
    packagingLevel3: [
      { code: 'PI02-KSH', nameAr: 'بوكس كشتة كرافت مطبوع للمعارض', nameEn: 'Printed Kashta Kraft Box', qty: '1 unit', unitCost: 0.180, costKwd: 0.180 },
    ],
  },

  // Tahina
  {
    id: 'rec-09',
    sku: 'SH01',
    nameAr: 'صحن شاورما لحم عربي مع طحينة',
    nameEn: 'Arabic Beef Shawarma Platter',
    brandId: 'tahina',
    brandNameAr: 'شاورما طحينة',
    brandNameEn: 'Tahina',
    categoryAr: 'الشاورما والبلاتر',
    categoryEn: 'Shawarma Platters',
    sellingPrice: 2.850,
    targetCostPercent: 25.0,
    rawLevel1: [
      { code: 'RW01-BF08', nameAr: 'لحم شاورما تندرلوين متبل', nameEn: 'Marinated Beef Shawarma', qty: '190g', unitCost: 3.200, yieldPercent: 82.0, costKwd: 0.608 },
      { code: 'RW01-BKH', nameAr: 'خبز صاج عربي طازج', nameEn: 'Arabic Saj Bread', qty: '2 pcs', unitCost: 0.050, yieldPercent: 100, costKwd: 0.100 },
    ],
    prepLevel2: [
      { code: 'PP03-THN', nameAr: 'طحينة خاصة بالليمون والكمون', nameEn: 'Tahina Sauce CK Prep', qty: '60g', unitCost: 1.800, costKwd: 0.108 },
      { code: 'PP03-GAR', nameAr: 'مخللات مشكلة متبلة', nameEn: 'Mixed Pickles Prep', qty: '50g', unitCost: 0.900, costKwd: 0.045 },
    ],
    packagingLevel3: [
      { code: 'PI02-PLT', nameAr: 'طبق بلاتر مقسم 3 خانات مع غطاء شفاف', nameEn: '3-Compartment Platter with Lid', qty: '1 unit', unitCost: 0.140, costKwd: 0.140 },
    ],
  },
  {
    id: 'rec-10',
    sku: 'SH02',
    nameAr: 'شاورما دجاج صاج بالثوم والمخلل',
    nameEn: 'Chicken Saj Shawarma with Garlic',
    brandId: 'tahina',
    brandNameAr: 'شاورما طحينة',
    brandNameEn: 'Tahina',
    categoryAr: 'الساندوتشات والصاج',
    categoryEn: 'Sandwiches & Wraps',
    sellingPrice: 1.750,
    targetCostPercent: 24.0,
    rawLevel1: [
      { code: 'RW01-CK02', nameAr: 'صدور دجاج متبلة للشاورما', nameEn: 'Marinated Shawarma Chicken', qty: '140g', unitCost: 2.100, yieldPercent: 85.0, costKwd: 0.294 },
      { code: 'RW01-SAJ', nameAr: 'خبز صاج فاخر', nameEn: 'Saj Bread', qty: '1 pc', unitCost: 0.050, yieldPercent: 100, costKwd: 0.050 },
    ],
    prepLevel2: [
      { code: 'PP03-GAR', nameAr: 'كريمة الثوم اللبنانية (تحضير مركزي)', nameEn: 'Garlic Cream Prep', qty: '35g', unitCost: 1.400, costKwd: 0.049 },
    ],
    packagingLevel3: [
      { code: 'PI02-WRP', nameAr: 'ورق لف ساندوتش طحينة', nameEn: 'Tahina Wrapping Paper', qty: '1 pc', unitCost: 0.030, costKwd: 0.030 },
    ],
  },

  // Farm Brown
  {
    id: 'rec-11',
    sku: 'FB01',
    nameAr: 'أومليت فارم براون بالسبانخ والفيتا',
    nameEn: 'Farm Brown Spinach & Feta Omelette',
    brandId: 'farmbrown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'الفطور والبرانش',
    categoryEn: 'Breakfast & Brunch',
    sellingPrice: 3.250,
    targetCostPercent: 21.0,
    rawLevel1: [
      { code: 'RW01-EGG', nameAr: 'بيض كويتي طازج مبستر', nameEn: 'Fresh Farm Eggs', qty: '3 pcs', unitCost: 0.090, yieldPercent: 100, costKwd: 0.270 },
      { code: 'RW01-SPN', nameAr: 'سبانخ طازجة صغيرة وجبن فيتا يوناني', nameEn: 'Baby Spinach & Feta', qty: '65g', unitCost: 2.800, yieldPercent: 95.0, costKwd: 0.182 },
      { code: 'RW01-BRD', nameAr: 'خبز ساوردو محمص بالزبدة', nameEn: 'Toasted Sourdough Bread', qty: '2 slices', unitCost: 0.060, yieldPercent: 100, costKwd: 0.120 },
    ],
    prepLevel2: [
      { code: 'PP03-DRS', nameAr: 'صلصة الخردل والعسل الخاصة', nameEn: 'Honey Mustard Dressing Prep', qty: '25ml', unitCost: 1.800, costKwd: 0.045 },
    ],
    packagingLevel3: [
      { code: 'PI02-BRN', nameAr: 'صندوق برانش كرافت أنيق مع أدوات خشبية', nameEn: 'Eco Brunch Box & Cutlery', qty: '1 unit', unitCost: 0.130, costKwd: 0.130 },
    ],
  },
  {
    id: 'rec-12',
    sku: 'FB02',
    nameAr: 'ساندوتش بيض وتارك بالحلوم المشوي',
    nameEn: 'Halloumi & Scrambled Egg Brioche',
    brandId: 'farmbrown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'الفطور والبرانش',
    categoryEn: 'Breakfast & Brunch',
    sellingPrice: 2.650,
    targetCostPercent: 22.5,
    rawLevel1: [
      { code: 'RW01-HLM', nameAr: 'جبن حلوم قبرصي مشوي', nameEn: 'Grilled Halloumi', qty: '70g', unitCost: 3.500, yieldPercent: 92.0, costKwd: 0.245 },
      { code: 'RW01-EGG', nameAr: 'بيض مخفوق بالزبدة الكريمة', nameEn: 'Scrambled Eggs with Butter', qty: '2 pcs', unitCost: 0.090, yieldPercent: 100, costKwd: 0.180 },
      { code: 'RW01-BN01', nameAr: 'خبز بريوش دائري محمص', nameEn: 'Brioche Bun', qty: '1 pc', unitCost: 0.120, yieldPercent: 100, costKwd: 0.120 },
    ],
    prepLevel2: [
      { code: 'PP03-PST', nameAr: 'بيستو الطماطم المجففة', nameEn: 'Sun-dried Tomato Pesto Prep', qty: '20g', unitCost: 2.500, costKwd: 0.050 },
    ],
    packagingLevel3: [
      { code: 'PI02-WRP', nameAr: 'غلاف ساندوتش حراري برانش', nameEn: 'Thermal Sandwich Wrap', qty: '1 pc', unitCost: 0.040, costKwd: 0.040 },
    ],
  },

  // The Noodle Bar
  {
    id: 'rec-13',
    sku: 'NB01',
    nameAr: 'نودلز ووك الروبيان والخضار الحار',
    nameEn: 'Spicy Wok Shrimp & Veggie Noodles',
    brandId: 'noodle',
    brandNameAr: 'ذا نودل بار',
    brandNameEn: 'The Noodle Bar',
    categoryAr: 'النودلز والآسيوي',
    categoryEn: 'Noodles & Asian',
    sellingPrice: 3.750,
    targetCostPercent: 25.0,
    rawLevel1: [
      { code: 'RW01-SHR', nameAr: 'روبيان ووك طازج منظف', nameEn: 'Fresh Wok Shrimp', qty: '140g', unitCost: 4.800, yieldPercent: 95.0, costKwd: 0.672 },
      { code: 'RW01-NOD', nameAr: 'نودلز قمح طازجة مسلوقة', nameEn: 'Fresh Wheat Noodles', qty: '180g', unitCost: 0.850, yieldPercent: 100, costKwd: 0.153 },
      { code: 'RW01-VEG', nameAr: 'براعم فاصوليا وملفوف وجزر', nameEn: 'Bean Sprouts & Cabbage', qty: '70g', unitCost: 0.600, yieldPercent: 95.0, costKwd: 0.042 },
    ],
    prepLevel2: [
      { code: 'PP03-WOK', nameAr: 'خلطة صوص الووك والسيشوان', nameEn: 'Szechuan Wok Sauce Prep', qty: '50ml', unitCost: 2.200, costKwd: 0.110 },
    ],
    packagingLevel3: [
      { code: 'PI02-NWK', nameAr: 'وعاء نودلز كرتوني دائري مقاوم للتسريب', nameEn: 'Leakproof Noodle Pail', qty: '1 unit', unitCost: 0.150, costKwd: 0.150 },
    ],
  },

  // Karak Cafeteria
  {
    id: 'rec-14',
    sku: 'KR01',
    nameAr: 'شاي كرك زعفران مميز (ترمس 1 لتر)',
    nameEn: 'Signature Saffron Karak Tea (1L Flask)',
    brandId: 'karak',
    brandNameAr: 'كرك كافتيريا',
    brandNameEn: 'Karak Cafeteria',
    categoryAr: 'المشروبات والكرك',
    categoryEn: 'Beverages & Karak',
    sellingPrice: 2.500,
    targetCostPercent: 18.0,
    rawLevel1: [
      { code: 'RW01-TEA', nameAr: 'أوراق شاي سيلاني فاخر وزعفران إيراني أصلي', nameEn: 'Ceylon Tea & Saffron', qty: '35g', unitCost: 8.500, yieldPercent: 100, costKwd: 0.297 },
      { code: 'RW01-MLK', nameAr: 'حليب مبخر هولندي ممتاز مع هيل وسكر', nameEn: 'Evaporated Milk & Cardamom', qty: '450ml', unitCost: 0.800, yieldPercent: 100, costKwd: 0.360 },
    ],
    prepLevel2: [],
    packagingLevel3: [
      { code: 'PI02-FLK', nameAr: 'ترمس كرك حراري كرتوني 1 لتر مع فوهة سكب', nameEn: 'Thermal 1L Karak Flask', qty: '1 unit', unitCost: 0.320, costKwd: 0.320 },
      { code: 'PI02-CUP', nameAr: 'أكواب كرك ورقية سميكة ومحارم', nameEn: 'Paper Cups Kit', qty: '4 pcs', unitCost: 0.020, costKwd: 0.080 },
    ],
  },
  {
    id: 'rec-15',
    sku: 'KR02',
    nameAr: 'شباتي جبن كرافت وعسل سدر أصلي',
    nameEn: 'Kraft Cheese & Sidr Honey Chapati',
    brandId: 'karak',
    brandNameAr: 'كرك كافتيريا',
    brandNameEn: 'Karak Cafeteria',
    categoryAr: 'المعجنات والشباتي',
    categoryEn: 'Pastries & Chapati',
    sellingPrice: 0.950,
    targetCostPercent: 21.0,
    rawLevel1: [
      { code: 'RW01-CHP', nameAr: 'عجينة شباتي مجهزة ومفرودة', nameEn: 'Chapati Dough Prep', qty: '1 pc', unitCost: 0.060, yieldPercent: 100, costKwd: 0.060 },
      { code: 'RW01-CHS', nameAr: 'جبن كرافت أصلي مبشور', nameEn: 'Grated Kraft Cheese', qty: '40g', unitCost: 2.800, yieldPercent: 100, costKwd: 0.112 },
      { code: 'RW01-HNY', nameAr: 'عسل سدر طبيعي نقي', nameEn: 'Pure Sidr Honey', qty: '20g', unitCost: 3.500, yieldPercent: 100, costKwd: 0.070 },
    ],
    prepLevel2: [],
    packagingLevel3: [
      { code: 'PI02-WRP', nameAr: 'قرطاس شباتي حراري مشمع', nameEn: 'Chapati Waxed Pouch', qty: '1 pc', unitCost: 0.025, costKwd: 0.025 },
    ],
  },
]

export const VARIANCE_ANALYSIS_DATA = [
  { itemAr: 'لحم بلاك أنجوس ريب آي', itemEn: 'Angus Ribeye (RW01-BF01)', unitAr: 'كجم', unitEn: 'KG', unitCost: 6.800, theoUsage: 1420.5, actualUsage: 1512.0, diffQty: -91.5, diffKwd: -622.200, causeAr: 'زيادة في وزن الغرف للشيف على الجريل', causeEn: 'Over-portioning at grill station', riskAr: 'مرتفع', riskEn: 'HIGH' },
  { itemAr: 'لحم مفروم أنجوس 80/20', itemEn: 'Minced Beef 80/20 (RW01-BF04)', unitAr: 'كجم', unitEn: 'KG', unitCost: 3.800, theoUsage: 2180.0, actualUsage: 2245.0, diffQty: -65.0, diffKwd: -247.000, causeAr: 'فاقد تصافي أثناء التشكيل وعجز هدر', causeEn: 'Prep forming loss & unlogged waste', riskAr: 'متوسط', riskEn: 'MEDIUM' },
  { itemAr: 'صدور دجاج طازجة متبلة', itemEn: 'Chicken Breast (RW01-CK02)', unitAr: 'كجم', unitEn: 'KG', unitCost: 2.100, theoUsage: 3450.0, actualUsage: 3495.0, diffQty: -45.0, diffKwd: -94.500, causeAr: 'فروقات طفيفة ضمن النسبة المقبولة (1.3%)', causeEn: 'Acceptable prep yield variance (1.3%)', riskAr: 'منخفض', riskEn: 'LOW' },
  { itemAr: 'بطاطا بلجيكية 9/9 مفرزة', itemEn: 'Frozen Fries 9/9 (RW01-POT)', unitAr: 'كجم', unitEn: 'KG', unitCost: 0.850, theoUsage: 4800.0, actualUsage: 5120.0, diffQty: -320.0, diffKwd: -272.000, causeAr: 'تعبئة أكياس الفرايز بدون ميزان معياري', causeEn: 'Overfilling fry pouches without scale', riskAr: 'مرتفع', riskEn: 'HIGH' },
  { itemAr: 'زيت قلي نباتي نقي', itemEn: 'Vegetable Frying Oil', unitAr: 'لتر', unitEn: 'Liter', unitCost: 0.650, theoUsage: 1200.0, actualUsage: 1240.0, diffQty: -40.0, diffKwd: -26.000, causeAr: 'تغيير دوري لزيوت المقليات (طبيعي)', causeEn: 'Periodic oil change schedule', riskAr: 'منخفض', riskEn: 'LOW' },
  { itemAr: 'علب ستيك حرارية فاخرة', itemEn: 'Thermal Steak Box (PI02-STK)', unitAr: 'علبة', unitEn: 'Unit', unitCost: 0.220, theoUsage: 4100, actualUsage: 4210, diffQty: -110, diffKwd: -24.200, causeAr: 'تلف كرتون أثناء التخزين والتعبئة', causeEn: 'Packaging damage in storage', riskAr: 'منخفض', riskEn: 'LOW' },
]

export function VentureRecipesHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const [activeTab, setActiveTab] = useState<'bom' | 'variance' | 'channelSim' | 'priceCreep' | 'batchPrep' | 'glBridge' | 'legacy'>('bom')
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('rec-01')
  const [simChannelItem, setSimChannelItem] = useState<string>('rec-01')
  const [batchScaleQty, setBatchScaleQty] = useState<number>(100)
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL')
  const [recipeSearch, setRecipeSearch] = useState<string>('')
  const [notice, setNotice] = useState<string | null>(null)

  const selectedRecipe = DETAILED_RECIPES.find((r) => r.id === selectedRecipeId) || DETAILED_RECIPES[0]
  const simRecipe = DETAILED_RECIPES.find((r) => r.id === simChannelItem) || DETAILED_RECIPES[0]

  // Recipe Cost Calculations
  const rawSum = selectedRecipe.rawLevel1.reduce((a, b) => a + b.costKwd, 0)
  const prepSum = selectedRecipe.prepLevel2.reduce((a, b) => a + b.costKwd, 0)
  const packSum = selectedRecipe.packagingLevel3.reduce((a, b) => a + b.costKwd, 0)
  const totalCost = rawSum + prepSum + packSum
  const actualCostPercent = (totalCost / selectedRecipe.sellingPrice) * 100
  const grossMarginKwd = selectedRecipe.sellingPrice - totalCost
  const grossMarginPercent = (grossMarginKwd / selectedRecipe.sellingPrice) * 100

  // Channel Simulation Calculations for simRecipe
  const simRawSum = simRecipe.rawLevel1.reduce((a, b) => a + b.costKwd, 0)
  const simPrepSum = simRecipe.prepLevel2.reduce((a, b) => a + b.costKwd, 0)
  const simPackSum = simRecipe.packagingLevel3.reduce((a, b) => a + b.costKwd, 0)
  const simTotalFoodCost = simRawSum + simPrepSum
  const simPackagingCost = simPackSum

  // Filter recipes by brand and search query
  const filteredRecipes = DETAILED_RECIPES.filter((r) => {
    if (selectedBrandFilter !== 'ALL' && r.brandId !== selectedBrandFilter) return false
    if (recipeSearch.trim()) {
      const q = recipeSearch.toLowerCase()
      const matchCode = r.sku.toLowerCase().includes(q)
      const matchNameAr = r.nameAr.toLowerCase().includes(q)
      const matchNameEn = r.nameEn.toLowerCase().includes(q)
      if (!matchCode && !matchNameAr && !matchNameEn) return false
    }
    return true
  })

  const handlePrintRecipeCard = () => {
    window.print()
    setNotice(
      isAr
        ? `تم إرسال بطاقة الوصفة المعيارية للشيف (${selectedRecipe.nameAr}) إلى أمر الطباعة بنجاح!`
        : `Recipe spec card (${selectedRecipe.nameEn}) sent to printer successfully!`
    )
    setTimeout(() => setNotice(null), 5000)
  }

  const handleAddIngredient = () => {
    setNotice(
      isAr
        ? `تم فتح وضع تعديل المكونات وأسعار الموردين للوصفة (${selectedRecipe.nameAr}) وتحديث قاعدة بيانات التكاليف!`
        : `Ingredient edit & supplier price update mode enabled for (${selectedRecipe.nameEn})!`
    )
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0a0d12] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* Top Header Bar with Navigation & Theme Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <BookOpen size={14} />
              {isAr ? 'محاسبة تكاليف الوصفات وهندسة الأغذية المعيارية' : 'Standard Recipe Cost Accounting & Menu Engineering'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'فنتشر فودز · 364 وصفة معتمدة' : 'Venture Foods · 364 Audited SKUs'}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl tracking-tight">
            {isAr ? 'مركز هندسة تكلفة الغذاء وضبط الانحراف المالي' : 'Food Cost Accounting & CFO Variance Command Center'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-4xl">
            {isAr
              ? 'شجرة المكونات متعددة المستويات (خام + تحضيرات + تغليف)، تحليل الانحراف النظري مقابل الفعلي، ومحاكي ربحية المنصات'
              : 'Multi-level BOM (Raw Materials, Central Preps, Packaging), theoretical vs actual cost variance, and channel net margin simulator'}
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800 transition-all shadow-sm"
          >
            <span>🏠</span>
            <span>{isAr ? 'العودة للوحة القيادة' : 'Back to Dashboard'}</span>
          </a>

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

      {/* Top CFO KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-xs font-medium text-slate-400">{isAr ? 'متوسط نسبة تكلفة الغذاء' : 'Avg Food Cost %'}</div>
          <div className="text-xl font-black text-emerald-400 mt-1">27.8%</div>
          <div className="text-xs text-slate-400 mt-0.5">{isAr ? 'الهدف المعتمد للشركة: < 29%' : 'Corporate Target: <29%'}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-xs font-medium text-slate-400">{isAr ? 'متوسط نسبة تكلفة التغليف' : 'Avg Packaging Cost %'}</div>
          <div className="text-xl font-black text-indigo-400 mt-1">3.2%</div>
          <div className="text-xs text-slate-400 mt-0.5">{isAr ? '0.175 د.ك للطلب' : '0.175 KWD/order'}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-xs font-medium text-slate-400">{isAr ? 'عجز الانحراف الشهري الفعلي' : 'Monthly Variance Loss'}</div>
          <div className="text-xl font-black text-rose-400 mt-1">-1,286.900 <span className="text-xs text-slate-400">د.ك</span></div>
          <div className="text-xs text-rose-300 mt-0.5">{isAr ? 'أغلبها زيادة أوزان غرف اللحوم' : 'Mainly meat over-portioning'}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-xs font-medium text-slate-400">{isAr ? 'الوصفات المعتمدة النشطة' : 'Active Recipe SKUs'}</div>
          <div className="text-xl font-black text-white mt-1">364 <span className="text-xs text-slate-400">صنفاً</span></div>
          <div className="text-xs text-slate-400 mt-0.5">{isAr ? 'عبر 6 مطاعم والمطبخ المركزي' : 'Across 6 brands + Central Kitchen'}</div>
        </div>
      </div>

      {/* 6 Specialized Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'bom', labelAr: '🍲 بطاقات الوصفات وشجرة المكونات القياسية', labelEn: 'Multi-Level BOM Cards', icon: BookOpen },
          { key: 'variance', labelAr: '⚖️ تحليل الانحراف المالي: النظري مقابل الفعلي', labelEn: 'Theoretical vs Actual Variance', icon: Scale },
          { key: 'channelSim', labelAr: '🛵 محاكي ربحية الطبق عبر قنوات البيع', labelEn: 'Channel Net Margin Simulator', icon: Bike },
          { key: 'priceCreep', labelAr: '📈 أثر تضخم أسعار المشتريات على الوصفات', labelEn: 'Price Creep & Margin Alert', icon: TrendingUp },
          { key: 'batchPrep', labelAr: '🏭 حاسبة تشغيلات المطبخ المركزي', labelEn: 'Central Kitchen Batch Scaling', icon: Factory },
          { key: 'glBridge', labelAr: '🔗 الربط المالي والقيود التلقائية الرباعية', labelEn: 'Automated 4D Financial Bridge', icon: ArrowRightLeft },
          ...(liveChildren ? [{ key: 'legacy', labelAr: '⚙️ سجل الوصفات في قاعدة البيانات المركزية', labelEn: 'Central Database Recipes Registry', icon: Building2 }] : []),
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon size={15} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: Multi-Level BOM Cards */}
      {activeTab === 'bom' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recipes Selector List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-bold text-slate-400 mb-1">
              {isAr ? 'اختر الوصفة لعرض شجرة المكونات وتفصيل التكلفة:' : 'Select Recipe to Inspect BOM Tree:'}
            </div>

            {/* Quick Search Input */}
            <div className="relative">
              <Search size={15} className="absolute right-3 top-3 text-slate-500" />
              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder={isAr ? 'بحث سريع باسم الوصفة أو الكود (MS01, CG01, EXCG...)...' : 'Search recipe by name or SKU...'}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pr-10 pl-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* 6 Official Brands Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { id: 'ALL', labelAr: 'الكل', labelEn: 'All Brands' },
                { id: 'chinagarden', labelAr: 'تشاينا جاردن', labelEn: 'China Garden' },
                { id: 'franks', labelAr: 'فرانكس', labelEn: "Frank's" },
                { id: 'tahina', labelAr: 'شاورما طحينة', labelEn: 'Tahina' },
                { id: 'farmbrown', labelAr: 'فارم براون', labelEn: 'Farm Brown' },
                { id: 'noodle', labelAr: 'ذا نودل بار', labelEn: 'The Noodle Bar' },
                { id: 'karak', labelAr: 'كرك كافتيريا', labelEn: 'Karak Cafeteria' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrandFilter(b.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    selectedBrandFilter === b.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {isAr ? b.labelAr : b.labelEn}
                </button>
              ))}
            </div>

            {/* Recipes Cards List */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredRecipes.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-500">
                  {isAr ? 'لم يتم العثور على وصفات مطابقة لخيارات البحث' : 'No matching recipes found'}
                </div>
              ) : (
                filteredRecipes.map((rec) => {
                  const isSelected = rec.id === selectedRecipeId
                  const rSum = rec.rawLevel1.reduce((a, b) => a + b.costKwd, 0)
                  const pSum = rec.prepLevel2.reduce((a, b) => a + b.costKwd, 0)
                  const kSum = rec.packagingLevel3.reduce((a, b) => a + b.costKwd, 0)
                  const tCost = rSum + pSum + kSum
                  const costPct = (tCost / rec.sellingPrice) * 100

                  return (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecipeId(rec.id)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-lg'
                          : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">{rec.sku}</span>
                        <span className="text-xs text-slate-400">{isAr ? rec.brandNameAr : rec.brandNameEn}</span>
                      </div>
                      <h4 className="mt-1.5 text-xs font-bold text-white leading-tight">{isAr ? rec.nameAr : rec.nameEn}</h4>
                      <div className="mt-2 flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                        <span className="text-slate-400 text-xs">{isAr ? 'سعر البيع:' : 'Price:'} <strong className="text-white">{rec.sellingPrice.toFixed(3)}</strong> {isAr ? 'د.ك' : 'KWD'}</span>
                        <span className="font-mono font-bold text-emerald-400 text-xs">
                          {isAr ? `نسبة التكلفة: ${costPct.toFixed(1)}%` : `${costPct.toFixed(1)}% Cost`}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Detailed 3-Level BOM Tree & Financial Breakdown (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-5">
              {/* Recipe Headline Info & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{selectedRecipe.sku}</span>
                    <h3 className="text-lg font-black text-white">{isAr ? selectedRecipe.nameAr : selectedRecipe.nameEn}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {isAr ? selectedRecipe.brandNameAr : selectedRecipe.brandNameEn} · {isAr ? selectedRecipe.categoryAr : selectedRecipe.categoryEn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handlePrintRecipeCard}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:border-emerald-500 hover:text-white transition-all shadow-sm"
                    title={isAr ? 'طباعة بطاقة الوصفة للشيف' : 'Print Chef Recipe Spec'}
                  >
                    <Printer size={14} className="text-emerald-400" />
                    <span>{isAr ? 'طباعة بطاقة الوصفة المعيارية للشيف' : 'Print Recipe Spec'}</span>
                  </button>

                  <button
                    onClick={handleAddIngredient}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all shadow-sm"
                    title={isAr ? 'إضافة مكون أو تعديل أسعار الموردين' : 'Add ingredient / update costs'}
                  >
                    <Plus size={14} className="text-emerald-400" />
                    <span>{isAr ? 'إضافة مكون / تعديل أسعار الموردين' : 'Edit BOM / Prices'}</span>
                  </button>
                </div>
              </div>

              {/* Price & Cost Waterfall KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-400">{isAr ? 'المواد الخام الأولية' : 'Raw Materials'}</div>
                  <div className="text-sm font-black text-blue-400 font-mono mt-0.5">{rawSum.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-400">{isAr ? 'تحضيرات المطبخ المركزي' : 'Central Kitchen Preps'}</div>
                  <div className="text-sm font-black text-amber-400 font-mono mt-0.5">{prepSum.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-400">{isAr ? 'مواد التغليف والسفري' : 'Packaging & Takeaway'}</div>
                  <div className="text-sm font-black text-purple-400 font-mono mt-0.5">{packSum.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="text-xs text-slate-400">{isAr ? 'إجمالي التكلفة / نسبة الغذاء' : 'Total Cost / Food Cost %'}</div>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">{totalCost.toFixed(3)} {isAr ? 'د.ك' : 'KWD'} ({actualCostPercent.toFixed(1)}%)</div>
                </div>
              </div>

              {/* Level 1: Raw Materials Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Layers size={14} />
                  {isAr ? 'المستوى الأول: المواد الخام الأولية المباشرة' : 'Level 1: Direct Raw Materials'}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="py-2 px-3">{isAr ? 'كود المادة' : 'SKU'}</th>
                        <th className="py-2 px-3">{isAr ? 'المكون الخام' : 'Ingredient'}</th>
                        <th className="py-2 px-3">{isAr ? 'الكمية / الوزن' : 'Qty / Portion'}</th>
                        <th className="py-2 px-3">{isAr ? 'نسبة التصافي بعد التنظيف والطهي (%)' : 'Yield (%)'}</th>
                        <th className="py-2 px-3 text-left">{isAr ? 'التكلفة (د.ك)' : 'Cost (KWD)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {selectedRecipe.rawLevel1.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-indigo-400">{item.code}</td>
                          <td className="py-2 px-3 font-sans text-white">{isAr ? item.nameAr : item.nameEn}</td>
                          <td className="py-2 px-3 text-slate-300 font-sans">{formatUnit(item.qty, isAr)}</td>
                          <td className="py-2 px-3 text-slate-400">{item.yieldPercent}%</td>
                          <td className="py-2 px-3 text-emerald-400 text-left font-bold">{item.costKwd.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Level 2: Sub-Recipes / Central Preps */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Factory size={14} />
                  {isAr ? 'المستوى الثاني: تحضيرات وصوصات المطبخ المركزي' : 'Level 2: Central Kitchen Preps & Sauces'}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-right text-xs">
                    {selectedRecipe.prepLevel2.length === 0 ? (
                      <tbody>
                        <tr>
                          <td className="py-3 px-3 text-center text-slate-500 font-sans">
                            {isAr ? 'لا توجد تحضيرات مسبقة مطلوبة لهذه الوصفة' : 'No pre-preparations required for this recipe'}
                          </td>
                        </tr>
                      </tbody>
                    ) : (
                      <>
                        <thead>
                          <tr className="border-b border-slate-800 text-xs text-slate-400">
                            <th className="py-2 px-3">{isAr ? 'كود التحضير' : 'SKU'}</th>
                            <th className="py-2 px-3">{isAr ? 'اسم الصوص / التتبيلة' : 'Prep Name'}</th>
                            <th className="py-2 px-3">{isAr ? 'الكمية' : 'Qty'}</th>
                            <th className="py-2 px-3 text-left">{isAr ? 'سعر التحويل والتكلفة (د.ك)' : 'Internal Cost (KWD)'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {selectedRecipe.prepLevel2.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 text-amber-400">{item.code}</td>
                              <td className="py-2 px-3 font-sans text-white">{isAr ? item.nameAr : item.nameEn}</td>
                              <td className="py-2 px-3 text-slate-300 font-sans">{formatUnit(item.qty, isAr)}</td>
                              <td className="py-2 px-3 text-emerald-400 text-left font-bold">{item.costKwd.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </>
                    )}
                  </table>
                </div>
              </div>

              {/* Level 3: Packaging & Disposables */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Package size={14} />
                  {isAr ? 'المستوى الثالث: مواد التغليف والعلب وأدوات السفري' : 'Level 3: Packaging & Takeaway Materials'}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="py-2 px-3">{isAr ? 'كود التغليف' : 'SKU'}</th>
                        <th className="py-2 px-3">{isAr ? 'الصنف / العلبة' : 'Package Item'}</th>
                        <th className="py-2 px-3">{isAr ? 'الكمية' : 'Qty'}</th>
                        <th className="py-2 px-3 text-left">{isAr ? 'التكلفة (د.ك)' : 'Cost (KWD)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {selectedRecipe.packagingLevel3.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-purple-400">{item.code}</td>
                          <td className="py-2 px-3 font-sans text-white">{isAr ? item.nameAr : item.nameEn}</td>
                          <td className="py-2 px-3 text-slate-300 font-sans">{formatUnit(item.qty, isAr)}</td>
                          <td className="py-2 px-3 text-emerald-400 text-left font-bold">{item.costKwd.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Theoretical vs Actual Food Cost Variance */}
      {activeTab === 'variance' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <Scale size={18} className="text-amber-400" />
                {isAr ? 'تحليل الانحراف المالي: الاستهلاك النظري مقابل الفعلي' : 'Theoretical vs Actual Food Cost Variance Analysis'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'أداة الإدارة المالية لكشف الهدر غير المسجل، زيادة أوزان الغرف، والفاقد المخزني بالدينار الكويتي'
                  : 'CFO auditing tool comparing POS theoretical BOM consumption vs actual inventory stock counts'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-3">{isAr ? 'المادة الخام الرئيسية' : 'Key Raw Material'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'الاستهلاك النظري (المبيعات)' : 'Theoretical Usage'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'الاستهلاك الفعلي (الجرد)' : 'Actual Usage'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'فارق الكمية' : 'Variance Qty'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'الأثر المالي (د.ك)' : 'KWD Impact'}</th>
                  <th className="py-3 px-3">{isAr ? 'التشخيص والسبب الجذري' : 'Root Cause Diagnosis'}</th>
                  <th className="py-3 px-3 text-center">{isAr ? 'مستوى الخطر' : 'Risk Level'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {VARIANCE_ANALYSIS_DATA.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors font-sans">
                    <td className="py-3 px-3 font-bold text-white">{isAr ? row.itemAr : row.itemEn}</td>
                    <td className="py-3 px-3 font-mono text-left text-slate-300">{row.theoUsage.toLocaleString()} {isAr ? row.unitAr : row.unitEn}</td>
                    <td className="py-3 px-3 font-mono text-left text-white font-bold">{row.actualUsage.toLocaleString()} {isAr ? row.unitAr : row.unitEn}</td>
                    <td className="py-3 px-3 font-mono text-left text-rose-400 font-bold">{row.diffQty} {isAr ? row.unitAr : row.unitEn}</td>
                    <td className="py-3 px-3 font-mono text-left text-rose-400 font-black">{row.diffKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</td>
                    <td className="py-3 px-3 text-xs text-slate-300">{isAr ? row.causeAr : row.causeEn}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        row.riskEn === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : row.riskEn === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {isAr ? row.riskAr : row.riskEn}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-slate-950 font-bold text-xs">
                  <td className="py-3 px-3 text-slate-200">{isAr ? 'إجمالي الخسارة المالية للانحراف' : 'Total Audited Variance Loss'}</td>
                  <td colSpan={3}></td>
                  <td className="py-3 px-3 text-left font-mono text-rose-400 text-sm font-black">-1,286.900 د.ك</td>
                  <td colSpan={2} className="py-3 px-3 text-xs text-slate-400 font-sans">
                    {isAr ? 'تتطلب تدريب الطهاة على وزن قطع الستيك وضبط معايرة الفرايز' : 'Requires portion control recalibration'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Channel Net Margin Simulator */}
      {activeTab === 'channelSim' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <Bike size={18} className="text-blue-400" />
                {isAr ? 'محاكي ربحية الطبق عبر قنوات البيع' : 'Channel Net Margin Simulator'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'مقارنة صافي ربح الطبق بالدينار والنسبة المئوية بعد خصم (تكلفة الغذاء + التغليف + عمولة المنصة + الرسوم البنكية)'
                  : 'Compare dish net profit across In-Store, Takeaway, Company Fleet, Talabat, Deliveroo, and Keeta'}
              </p>
            </div>

            {/* Select Dish */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">{isAr ? 'اختر الطبق للمحاكاة:' : 'Select Dish:'}</span>
              <select
                value={simChannelItem}
                onChange={(e) => setSimChannelItem(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:outline-none"
              >
                {DETAILED_RECIPES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sku} - {isAr ? r.nameAr : r.nameEn} ({r.sellingPrice.toFixed(3)} {isAr ? 'د.ك' : 'KWD'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-3">{isAr ? 'قناة البيع' : 'Sales Channel'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'سعر البيع للعميل' : 'Gross Price'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'تكلفة الطعام' : 'Food Cost'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'تكلفة التغليف' : 'Packaging'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'عمولة المنصة' : 'Aggregator Fee'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'صافي الربح (د.ك)' : 'Net Margin (KWD)'}</th>
                  <th className="py-3 px-3 text-center">{isAr ? 'هامش الربح %' : 'Net Margin %'}</th>
                  <th className="py-3 px-3">{isAr ? 'توصية التسعير الذكي' : 'Pricing Recommendation'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {[
                  { channelAr: 'طلب محلي بالفرع (مباشر 0%)', channelEn: 'Dine-In (Direct 0%)', commission: 0.0, pack: 0.000, price: simRecipe.sellingPrice, badge: 'text-emerald-400' },
                  { channelAr: 'سفري / استلام كاونتر (مباشر 0%)', channelEn: 'Takeaway (Direct 0%)', commission: 0.0, pack: simPackagingCost, price: simRecipe.sellingPrice, badge: 'text-blue-400' },
                  { channelAr: 'توصيل أسطول الشركة (10%)', channelEn: 'Talabat Fleet TMP (10%)', commission: 0.10, pack: simPackagingCost, price: simRecipe.sellingPrice, badge: 'text-amber-400' },
                  { channelAr: 'منصة طلبات (17%)', channelEn: 'Talabat GO (17%)', commission: 0.17, pack: simPackagingCost, price: simRecipe.sellingPrice, badge: 'text-orange-400' },
                  { channelAr: 'منصة ديليفرو (18%)', channelEn: 'Deliveroo (18%)', commission: 0.18, pack: simPackagingCost, price: simRecipe.sellingPrice, badge: 'text-teal-400' },
                  { channelAr: 'منصة كيتا (12%)', channelEn: 'Keeta (12%)', commission: 0.12, pack: simPackagingCost, price: simRecipe.sellingPrice, badge: 'text-yellow-400' },
                ].map((row, idx) => {
                  const commKwd = row.price * row.commission
                  const netProfit = row.price - simTotalFoodCost - row.pack - commKwd
                  const netMarginPct = (netProfit / row.price) * 100
                  const optimalPrice = (simTotalFoodCost + row.pack) / (1 - row.commission - 0.60)

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors font-sans">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${row.badge.replace('text-', 'bg-')}`}></span>
                        {isAr ? row.channelAr : row.channelEn}
                      </td>
                      <td className="py-3 px-3 font-mono text-left text-white">{row.price.toFixed(3)}</td>
                      <td className="py-3 px-3 font-mono text-left text-slate-400">{simTotalFoodCost.toFixed(3)}</td>
                      <td className="py-3 px-3 font-mono text-left text-indigo-400">{row.pack.toFixed(3)}</td>
                      <td className="py-3 px-3 font-mono text-left text-rose-400">{commKwd > 0 ? `-${commKwd.toFixed(3)} (${(row.commission * 100).toFixed(0)}%)` : '-'}</td>
                      <td className="py-3 px-3 font-mono text-left font-black text-emerald-400 text-sm">{netProfit.toFixed(3)}</td>
                      <td className="py-3 px-3 font-mono text-center font-bold text-white">{netMarginPct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-xs text-slate-300">
                        {row.commission > 0.12 ? (
                          <span className="text-amber-400 font-mono text-xs">
                            {isAr ? `يُنصح برفع السعر إلى ${optimalPrice.toFixed(3)} د.ك لحماية هامش 60%` : `Recommend ${optimalPrice.toFixed(3)} KWD on app`}
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-xs">
                            {isAr ? 'السعر مثالي ويحقق هامشاً ممتازاً' : 'Optimal margin achieved'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Price Creep & Margin Alert */}
      {activeTab === 'priceCreep' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <TrendingUp size={18} className="text-rose-400" />
                {isAr ? 'رادار تضخم أسعار المشتريات وأثره على هوامش الوصفات' : 'Ingredient Price Creep Impact & Margin Alert'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'كشف تلقائي للمواد الخام التي ارتفعت أسعارها في فواتير الشراء الأخيرة وتأثيرها على نسبة تكلفة الوجبات'
                  : 'Automatic alerts on raw material cost inflation and impact on dish contribution margins'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { itemAr: 'لحم أنجوس خام مبرد (أسترالي)', oldPrice: '6.200 د.ك/كجم', newPrice: '6.800 د.ك/كجم', change: '+9.7%', affectedRecipes: 'ستيك ريب آي، ستريبلوين، ترافل برجر', marginErosion: '-2.4% في هامش الربح', actionAr: 'تعديل سعر المنيو بالمنصات بمقدار +0.250 د.ك أو تحسين التقطيع بالمطبخ المركزي', badge: 'bg-rose-500/20 text-rose-400' },
              { itemAr: 'زيت قلي نباتي نقي', oldPrice: '0.580 د.ك/لتر', newPrice: '0.650 د.ك/لتر', change: '+12.1%', affectedRecipes: 'جميع أصناف البطاطا والمقليات والزنجر', marginErosion: '-0.9% في هامش الربح', actionAr: 'التعاقد السنوي بالطن مع شركة مطاحن الدقيق والمخابز الكويتية', badge: 'bg-amber-500/20 text-amber-400' },
              { itemAr: 'علب ستيك حرارية فاخرة', oldPrice: '0.190 د.ك/حبة', newPrice: '0.220 د.ك/حبة', change: '+15.8%', affectedRecipes: 'طلبات التوصيل لبراند فرانكس', marginErosion: '-0.5% في هامش الربح', actionAr: 'طلب حاوية كاملة (40 قدم) مباشرة من المصنع لتخفيض السعر إلى 0.160 د.ك', badge: 'bg-amber-500/20 text-amber-400' },
            ].map((alert, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-mono font-bold ${alert.badge}`}>{alert.change}</span>
                    {alert.itemAr}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {alert.oldPrice} ➔ <strong className="text-rose-400">{alert.newPrice}</strong>
                  </div>
                </div>

                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">{isAr ? 'الوصفات المتأثرة:' : 'Affected Dishes:'}</span> {alert.affectedRecipes}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="text-rose-400 font-bold">
                    {isAr ? 'تآكل الهامش الربحي:' : 'Margin Erosion:'} {alert.marginErosion}
                  </div>
                  <div className="text-emerald-400 text-xs bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    💡 {alert.actionAr}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: Central Kitchen Batch Scaling */}
      {activeTab === 'batchPrep' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <Factory size={18} className="text-amber-400" />
                {isAr ? 'حاسبة تشغيلات المطبخ المركزي وسعر التحويل الداخلي' : 'Central Kitchen Batch Scaling & Yield Calculator'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'حساب تكلفة إنتاج دفعات الصوصات والمتبلات الكبيرة وتحديد سعر التحويل الداخلي لفروع الشركة العشرة'
                  : 'Batch scaling, cooking yield loss, and internal transfer pricing charged to 10 retail branches'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">{isAr ? 'حجم الدفعة المطلوبة:' : 'Batch Target Size:'}</span>
              {[25, 50, 100, 200].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setBatchScaleQty(sz)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold font-mono transition-all ${
                    batchScaleQty === sz
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {sz} {isAr ? 'لتر/كجم' : 'L/KG'}
                </button>
              ))}
            </div>
          </div>

          {/* Batch Costing Model */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="text-xs text-slate-400">{isAr ? 'المنتج الوسيط التحضيري' : 'Target Sub-Recipe'}</div>
              <div className="text-base font-black text-white">{isAr ? 'صوص الترافل المميز (تحضير المطبخ المركزي)' : 'Truffle Sauce (PP03-TRF)'}</div>
              <div className="text-xs text-amber-400">{isAr ? 'تحضير مسبق للستيك والدجاج الكانتون' : "Special Prep for Frank's & China Garden"}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="text-xs text-slate-400">{isAr ? 'نسبة الفاقد أثناء الطهي والتبريد' : 'Cooking & Cooling Yield %'}</div>
              <div className="text-base font-black text-emerald-400 font-mono">92.0% {isAr ? 'صافي التصافي' : 'Net Yield'}</div>
              <div className="text-xs text-slate-400">{isAr ? '8% فاقد تبخر وانكماش طبيعي' : '8% evaporation loss'}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="text-xs text-slate-400">{isAr ? 'سعر التحويل الداخلي للفروع' : 'Internal Transfer Cost / Liter'}</div>
              <div className="text-lg font-black text-indigo-400 font-mono">2.850 {isAr ? 'د.ك / لتر' : 'KWD / Liter'}</div>
              <div className="text-xs text-emerald-400">{isAr ? 'محمل بنصيب العمالة والتشغيل بالمطبخ المركزي' : 'Includes labor & overhead allocation'}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h4 className="text-xs font-bold text-slate-300 mb-3">
              {isAr ? `المكونات المطلوبة لإنتاج دفعة ${batchScaleQty} لتر صوص ترافل:` : `Ingredients required for ${batchScaleQty}L Truffle Sauce batch:`}
            </h4>
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-sans">
                  <th className="py-2 px-3">{isAr ? 'المكون الخام' : 'Raw Ingredient'}</th>
                  <th className="py-2 px-3 text-left">{isAr ? 'الكمية المحسوبة' : 'Calculated Qty'}</th>
                  <th className="py-2 px-3 text-left">{isAr ? 'سعر الوحدة' : 'Unit Cost'}</th>
                  <th className="py-2 px-3 text-left">{isAr ? 'الإجمالي (د.ك)' : 'Total Cost (KWD)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                <tr>
                  <td className="py-2 px-3 font-sans text-white">{isAr ? 'معجون ترافل إيطالي أصلي' : 'Italian Truffle Paste'}</td>
                  <td className="py-2 px-3 text-left text-amber-400">{(batchScaleQty * 0.12).toFixed(2)} {isAr ? 'كجم' : 'KG'}</td>
                  <td className="py-2 px-3 text-left text-slate-300">12.500 {isAr ? 'د.ك/كجم' : 'KWD/KG'}</td>
                  <td className="py-2 px-3 text-left text-emerald-400 font-bold">{(batchScaleQty * 0.12 * 12.5).toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans text-white">{isAr ? 'مايونيز فاخر كامل الدسم' : 'Full-Fat Mayonnaise'}</td>
                  <td className="py-2 px-3 text-left text-amber-400">{(batchScaleQty * 0.65).toFixed(2)} {isAr ? 'لتر' : 'L'}</td>
                  <td className="py-2 px-3 text-left text-slate-300">0.950 {isAr ? 'د.ك/لتر' : 'KWD/L'}</td>
                  <td className="py-2 px-3 text-left text-emerald-400 font-bold">{(batchScaleQty * 0.65 * 0.95).toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-sans text-white">{isAr ? 'كريمة طبخ طازجة + توابل خاصة' : 'Fresh Cooking Cream & Spices'}</td>
                  <td className="py-2 px-3 text-left text-amber-400">{(batchScaleQty * 0.23).toFixed(2)} {isAr ? 'لتر' : 'L'}</td>
                  <td className="py-2 px-3 text-left text-slate-300">1.400 {isAr ? 'د.ك/لتر' : 'KWD/L'}</td>
                  <td className="py-2 px-3 text-left text-emerald-400 font-bold">{(batchScaleQty * 0.23 * 1.4).toFixed(3)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 font-bold text-xs bg-slate-900/80">
                  <td className="py-2 px-3 text-white font-sans">{isAr ? 'إجمالي تكلفة المواد المباشرة للدفعة' : 'Total Direct Batch Cost'}</td>
                  <td colSpan={2}></td>
                  <td className="py-2 px-3 text-left text-emerald-400 font-mono text-sm">
                    {(batchScaleQty * (0.12 * 12.5 + 0.65 * 0.95 + 0.23 * 1.4)).toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: Automated Financial GL Bridge */}
      {activeTab === 'glBridge' && (
        <AutomatedGlBridge locale={currentLocale} />
      )}

      {/* TAB 7: Central Database Recipes Registry */}
      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          {liveChildren}
        </div>
      )}
    </div>
  )
}
