'use client'

import React, { useState } from 'react'
import {
  Monitor,
  Lock,
  CreditCard,
  ShieldAlert,
  Wallet,
  ArrowRightLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  Coins,
  Receipt,
  UserCheck,
  Send,
  Eye,
  DollarSign,
  Percent,
} from 'lucide-react'
import { AutomatedGlBridge } from '@/components/finance/AutomatedGlBridge'
import { ThemeToggle } from '@/components/ThemeToggle'

export interface MenuItem {
  id: string
  code: string
  nameAr: string
  nameEn: string
  brandId: string
  brandNameAr: string
  brandNameEn: string
  categoryAr: string
  categoryEn: string
  sellingPrice: number
  cogsEstimate: number
  packagingCost: number // PI02*
  badge?: string
}

export const POS_CATALOG: MenuItem[] = [
  // Frank's Steak
  { id: 'fr-01', code: 'MS01', nameAr: 'ستيك بلاك أنجوس ريب آي 300 غرام', nameEn: 'Black Angus Ribeye Steak 300g', brandId: 'franks', brandNameAr: "فرانكس ستيك", brandNameEn: "Frank's Steak", categoryAr: 'الستيك الفاخر', categoryEn: 'Premium Steaks', sellingPrice: 9.850, cogsEstimate: 2.750, packagingCost: 0.350, badge: 'Star' },
  { id: 'fr-02', code: 'MS02', nameAr: 'ستريبلوين أنجوس مع صوص المشروم', nameEn: 'Striploin Steak with Mushroom Sauce', brandId: 'franks', brandNameAr: "فرانكس ستيك", brandNameEn: "Frank's Steak", categoryAr: 'الستيك الفاخر', categoryEn: 'Premium Steaks', sellingPrice: 8.750, cogsEstimate: 2.450, packagingCost: 0.350 },
  { id: 'fr-03', code: 'MS03', nameAr: 'برجر ترافل أنجوس ديلوكس', nameEn: 'Angus Truffle Deluxe Burger', brandId: 'franks', brandNameAr: "فرانكس ستيك", brandNameEn: "Frank's Steak", categoryAr: 'البرجر والساندوتش', categoryEn: 'Burgers & Sandwiches', sellingPrice: 4.500, cogsEstimate: 1.150, packagingCost: 0.250 },
  { id: 'fr-04', code: 'MS04', nameAr: 'بطاطا كريسبي بالجبن والبيكون', nameEn: 'Loaded Cheese & Bacon Fries', brandId: 'franks', brandNameAr: "فرانكس ستيك", brandNameEn: "Frank's Steak", categoryAr: 'المقبلات والجانبية', categoryEn: 'Appetizers & Sides', sellingPrice: 2.250, cogsEstimate: 0.520, packagingCost: 0.180 },

  // China Garden
  { id: 'cg-01', code: 'CG01', nameAr: 'دجاج كانتون تشاينا جاردن المميز', nameEn: 'China Garden Special Canton Chicken', brandId: 'chinagarden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', categoryAr: 'الأطباق الصينية والآسيوية', categoryEn: 'Chinese & Asian Mains', sellingPrice: 4.500, cogsEstimate: 1.150, packagingCost: 0.250, badge: 'Best Seller' },
  { id: 'cg-02', code: 'CG02', nameAr: 'روبيان سويت آند سور مع أرز مقلي', nameEn: 'Sweet & Sour Shrimp with Fried Rice', brandId: 'chinagarden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', categoryAr: 'الأطباق الصينية والآسيوية', categoryEn: 'Chinese & Asian Mains', sellingPrice: 5.250, cogsEstimate: 1.450, packagingCost: 0.300 },
  { id: 'cg-03', code: 'CG03', nameAr: 'دجاج بالكاجو والخضار المشكلة', nameEn: 'Cashew Nut Chicken with Mixed Veggies', brandId: 'chinagarden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', categoryAr: 'الأطباق الصينية والآسيوية', categoryEn: 'Chinese & Asian Mains', sellingPrice: 4.250, cogsEstimate: 1.050, packagingCost: 0.250 },
  { id: 'cg-04', code: 'CG04', nameAr: 'سبرينغ رول خضار مقرمش (4 حبات)', nameEn: 'Crispy Veggie Spring Rolls (4 Pcs)', brandId: 'chinagarden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', categoryAr: 'المقبلات والجانبية', categoryEn: 'Appetizers & Sides', sellingPrice: 1.750, cogsEstimate: 0.380, packagingCost: 0.150 },

  // Tahina
  { id: 'th-01', code: 'SH01', nameAr: 'صحن شاورما لحم عربي مع طحينة', nameEn: 'Arabic Beef Shawarma Platter', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', categoryAr: 'الشاورما والساندوتش', categoryEn: 'Shawarma Platters', sellingPrice: 2.850, cogsEstimate: 0.720, packagingCost: 0.200, badge: 'Top Item' },
  { id: 'th-02', code: 'SH02', nameAr: 'شاورما دجاج صاج بالثوم والمخلل', nameEn: 'Chicken Saj Shawarma with Garlic', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', categoryAr: 'الشاورما والساندوتش', categoryEn: 'Shawarma Platters', sellingPrice: 1.750, cogsEstimate: 0.420, packagingCost: 0.150 },
  { id: 'th-03', code: 'SH03', nameAr: 'بوكس شاورما ميني للمشاركة (12 قطعة)', nameEn: 'Mini Shawarma Gathering Box (12 Pcs)', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', categoryAr: 'بوكسات الجمعات', categoryEn: 'Gathering Boxes', sellingPrice: 7.500, cogsEstimate: 1.950, packagingCost: 0.650 },

  // Farm Brown
  { id: 'fb-01', code: 'FB01', nameAr: 'أومليت فارم براون بالسبانخ والفيتا', nameEn: 'Farm Brown Spinach & Feta Omelette', brandId: 'farmbrown', brandNameAr: 'فارم براون', brandNameEn: 'Farm Brown', categoryAr: 'الفطور والبرانش', categoryEn: 'Breakfast & Brunch', sellingPrice: 3.250, cogsEstimate: 0.680, packagingCost: 0.250 },
  { id: 'fb-02', code: 'FB02', nameAr: 'ساندوتش بيض وتارك بالحلوم المشوي', nameEn: 'Halloumi & Scrambled Egg Brioche', brandId: 'farmbrown', brandNameAr: 'فارم براون', brandNameEn: 'Farm Brown', categoryAr: 'الفطور والبرانش', categoryEn: 'Breakfast & Brunch', sellingPrice: 2.650, cogsEstimate: 0.580, packagingCost: 0.200 },

  // The Noodle Bar & Karak
  { id: 'nb-01', code: 'NB01', nameAr: 'نودلز ووك الروبيان والخضار الحار', nameEn: 'Spicy Wok Shrimp & Veggie Noodles', brandId: 'noodle', brandNameAr: 'ذا نودل بار وكرك', brandNameEn: 'The Noodle Bar & Karak', categoryAr: 'النودلز والآسيوي', categoryEn: 'Noodles & Asian', sellingPrice: 3.750, cogsEstimate: 0.950, packagingCost: 0.280 },
  { id: 'nb-02', code: 'KR01', nameAr: 'شاي كرك زعفران مميز (ترمس 1 لتر)', nameEn: 'Signature Saffron Karak Tea (1L Flask)', brandId: 'noodle', brandNameAr: 'ذا نودل بار وكرك', brandNameEn: 'The Noodle Bar & Karak', categoryAr: 'المشروبات والكرك', categoryEn: 'Beverages & Karak', sellingPrice: 2.500, cogsEstimate: 0.350, packagingCost: 0.400 },
]

export const ORDER_CHANNELS = [
  {
    id: 'TAKEAWAY',
    labelAr: 'سفري / استلام كاونتر',
    labelEn: 'Takeaway / Counter Pickup',
    subLabelAr: 'مباشر 0% عمولة',
    subLabelEn: 'Direct 0% Commission',
    commissionRate: 0.0,
    packagingReq: true,
    badgeColor: 'bg-blue-500/20 text-blue-400',
  },
  {
    id: 'DINE_IN',
    labelAr: 'طلب محلي بالفرع',
    labelEn: 'Dine-In / Store Order',
    subLabelAr: 'مباشر 0% عمولة',
    subLabelEn: 'Direct 0% Commission',
    commissionRate: 0.0,
    packagingReq: false,
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
  },
  {
    id: 'TMP_10',
    labelAr: 'توصيل أسطول الشركة (10%)',
    labelEn: 'Talabat TMP Fleet (10%)',
    subLabelAr: 'طلبات توصيل خاص',
    subLabelEn: 'Talabat TMP Fleet',
    commissionRate: 0.10,
    packagingReq: true,
    badgeColor: 'bg-amber-500/20 text-amber-400',
  },
  {
    id: 'TGO_17',
    labelAr: 'منصة طلبات (17%)',
    labelEn: 'Talabat GO (17%)',
    subLabelAr: 'توصيل أسطول طلبات',
    subLabelEn: 'Talabat Fleet Delivery',
    commissionRate: 0.17,
    packagingReq: true,
    badgeColor: 'bg-orange-500/20 text-orange-400',
  },
  {
    id: 'KEETA',
    labelAr: 'منصة كيتا (12%)',
    labelEn: 'Keeta (12%)',
    subLabelAr: 'عمولة المنصة 12%',
    subLabelEn: 'Platform Fee 12%',
    commissionRate: 0.12,
    packagingReq: true,
    badgeColor: 'bg-yellow-500/20 text-yellow-400',
  },
  {
    id: 'DELIVEROO',
    labelAr: 'منصة ديليفرو (18%)',
    labelEn: 'Deliveroo (18%)',
    subLabelAr: 'عمولة المنصة 18%',
    subLabelEn: 'Platform Fee 18%',
    commissionRate: 0.18,
    packagingReq: true,
    badgeColor: 'bg-teal-500/20 text-teal-400',
  },
  {
    id: 'JAHEZ',
    labelAr: 'منصة جاهز (15%)',
    labelEn: 'Jahez (15%)',
    subLabelAr: 'عمولة المنصة 15%',
    subLabelEn: 'Platform Fee 15%',
    commissionRate: 0.15,
    packagingReq: true,
    badgeColor: 'bg-red-500/20 text-red-400',
  },
  {
    id: 'STAFF_0KD',
    labelAr: 'وجبة موظف معتمدة (0 د.ك)',
    labelEn: 'Staff Meal (0 KD)',
    subLabelAr: 'ترحل لحساب 5230 بسعر التكلفة',
    subLabelEn: 'GL Account 5230 at Cost',
    commissionRate: 0.0,
    isStaffMeal: true,
    packagingReq: false,
    badgeColor: 'bg-purple-500/20 text-purple-400',
  },
]

export interface BranchStaffMember {
  id: string
  nameAr: string
  nameEn: string
  roleAr: string
  roleEn: string
}

export interface BranchStaffInfo {
  fullLabelAr: string
  fullLabelEn: string
  staffList: BranchStaffMember[]
}

export const BRANCH_STAFF_MAP: Record<string, BranchStaffInfo> = {
  AVENUES: {
    fullLabelAr: 'المشرف المناوب: إجير ريان بالاتان (#2039) · الكاشير: آنا كاثرين (#1974)',
    fullLabelEn: 'Duty Supervisor: Ejeir Ryan Palatan (#2039) · Cashier: Anna Katherine (#1974)',
    staffList: [
      { id: '2039', nameAr: 'المشرف المناوب: إجير ريان بالاتان (#2039)', nameEn: 'Duty Supervisor: Ejeir Ryan Palatan (#2039)', roleAr: 'مشرف مناوب', roleEn: 'Duty Supervisor' },
      { id: '1974', nameAr: 'الكاشير: آنا كاثرين (#1974)', nameEn: 'Cashier: Anna Katherine (#1974)', roleAr: 'كاشير الفرع', roleEn: 'Branch Cashier' },
    ],
  },
  SALMIYA: {
    fullLabelAr: 'المشرفة المناوبة: عصمت أحمد عبد الرزاق (#1508) · الكاشير: ديلشان (#2001)',
    fullLabelEn: 'Duty Supervisor: Ismat Ahmed Abdelrazzaq (#1508) · Cashier: Dilshan (#2001)',
    staffList: [
      { id: '1508', nameAr: 'المشرفة المناوبة: عصمت أحمد عبد الرزاق (#1508)', nameEn: 'Duty Supervisor: Ismat Ahmed Abdelrazzaq (#1508)', roleAr: 'مشرفة مناوبة', roleEn: 'Duty Supervisor' },
      { id: '2001', nameAr: 'الكاشير: ديلشان (#2001)', nameEn: 'Cashier: Dilshan (#2001)', roleAr: 'كاشير الفرع', roleEn: 'Branch Cashier' },
    ],
  },
  HAWALLI: {
    fullLabelAr: 'المشرفة المناوبة: دونا ماري أفيلا (#2028)',
    fullLabelEn: 'Duty Supervisor: Donna Marie Avila (#2028)',
    staffList: [
      { id: '2028', nameAr: 'المشرفة المناوبة: دونا ماري أفيلا (#2028)', nameEn: 'Duty Supervisor: Donna Marie Avila (#2028)', roleAr: 'مشرفة مناوبة', roleEn: 'Duty Supervisor' },
    ],
  },
  SHUWAIKH: {
    fullLabelAr: 'مدير الفرع المناوب: جيري تيلاديرو (#1300)',
    fullLabelEn: 'Duty Branch Manager: Jerry Tilladero (#1300)',
    staffList: [
      { id: '1300', nameAr: 'مدير الفرع المناوب: جيري تيلاديرو (#1300)', nameEn: 'Duty Branch Manager: Jerry Tilladero (#1300)', roleAr: 'مدير فرع مناوب', roleEn: 'Duty Branch Manager' },
    ],
  },
  KHIRAN: {
    fullLabelAr: 'المشرفة المناوبة: كريستينا هيرنانديز (#2088)',
    fullLabelEn: 'Duty Supervisor: Christina Hernandez (#2088)',
    staffList: [
      { id: '2088', nameAr: 'المشرفة المناوبة: كريستينا هيرنانديز (#2088)', nameEn: 'Duty Supervisor: Christina Hernandez (#2088)', roleAr: 'مشرفة مناوبة', roleEn: 'Duty Supervisor' },
    ],
  },
  JABRIYA: {
    fullLabelAr: 'المشرف المناوب: بايجو كونومال (#1973)',
    fullLabelEn: 'Duty Supervisor: Baiju Kunnummal (#1973)',
    staffList: [
      { id: '1973', nameAr: 'المشرف المناوب: بايجو كونومال (#1973)', nameEn: 'Duty Supervisor: Baiju Kunnummal (#1973)', roleAr: 'مشرف مناوب', roleEn: 'Duty Supervisor' },
    ],
  },
  ARDHIYA: {
    fullLabelAr: 'المشرف المناوب: ديليرام أدهيكاري (#1954)',
    fullLabelEn: 'Duty Supervisor: Diliram Adhikari (#1954)',
    staffList: [
      { id: '1954', nameAr: 'المشرف المناوب: ديليرام أدهيكاري (#1954)', nameEn: 'Duty Supervisor: Diliram Adhikari (#1954)', roleAr: 'مشرف مناوب', roleEn: 'Duty Supervisor' },
    ],
  },
  QURAIN_CK: {
    fullLabelAr: 'مسؤول الفرع: بابو تشاند رانا (#1279)',
    fullLabelEn: 'Branch In-Charge: Babu Chand Rana (#1279)',
    staffList: [
      { id: '1279', nameAr: 'مسؤول الفرع: بابو تشاند رانا (#1279)', nameEn: 'Branch In-Charge: Babu Chand Rana (#1279)', roleAr: 'مسؤول الفرع', roleEn: 'Branch In-Charge' },
    ],
  },
  MAHBOULA: {
    fullLabelAr: 'مشرف الفرع: طاقم العمليات الميداني (#2012)',
    fullLabelEn: 'Branch Supervisor: Field Operations (#2012)',
    staffList: [
      { id: '2012', nameAr: 'مشرف الفرع: طاقم العمليات الميداني (#2012)', nameEn: 'Branch Supervisor: Field Operations (#2012)', roleAr: 'مشرف فرع', roleEn: 'Branch Supervisor' },
    ],
  },
  SABAH_SALEM: {
    fullLabelAr: 'مشرف الفرع: طاقم العمليات الميداني (#2015)',
    fullLabelEn: 'Branch Supervisor: Field Operations (#2015)',
    staffList: [
      { id: '2015', nameAr: 'مشرف الفرع: طاقم العمليات الميداني (#2015)', nameEn: 'Branch Supervisor: Field Operations (#2015)', roleAr: 'مشرف فرع', roleEn: 'Branch Supervisor' },
    ],
  },
}

export const BRANCH_OPTIONS = [
  { id: 'AVENUES', nameAr: 'فرع مجمع الأفنيوز', nameEn: 'The Avenues Mall', code: 'BR-AV' },
  { id: 'SALMIYA', nameAr: 'فرع السالمية شارع سالم المبارك', nameEn: 'Salmiya Salem Al-Mubarak', code: 'BR-SL' },
  { id: 'HAWALLI', nameAr: 'فرع بروميناد حولي', nameEn: 'Hawalli Promenade', code: 'BR-HW' },
  { id: 'SHUWAIKH', nameAr: 'فرع 360 مول والشويخ', nameEn: '360 Mall & Shuwaikh', code: 'BR-SW' },
  { id: 'KHIRAN', nameAr: 'فرع الكوت مول والخيران أوتلت', nameEn: 'Al Kout Mall & Khiran', code: 'BR-KH' },
  { id: 'JABRIYA', nameAr: 'فرع العاصمة مول والجابرية', nameEn: 'Al Asimah Mall & Jabriya', code: 'BR-JB' },
  { id: 'ARDHIYA', nameAr: 'فرع العارضية الحرفية', nameEn: 'Ardhiya Craft Area', code: 'BR-AR' },
  { id: 'QURAIN_CK', nameAr: 'فرع مبارك الكبير / المطبخ المركزي', nameEn: 'Central Kitchen', code: 'BR-CK' },
  { id: 'MAHBOULA', nameAr: 'فرع المهبولة الساحلي', nameEn: 'Mahboula Coastal', code: 'BR-MH' },
  { id: 'SABAH_SALEM', nameAr: 'فرع صباح السالم', nameEn: 'Sabah Al-Salem Branch', code: 'BR-SS' },
]

export function VenturePosHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const [activeTab, setActiveTab] = useState<'terminal' | 'zReport' | 'tender' | 'voids' | 'safeDrop' | 'glBridge' | 'legacy'>('terminal')
  const [selectedBranch, setSelectedBranch] = useState('AVENUES')
  const [selectedBrand, setSelectedBrand] = useState('ALL')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('TAKEAWAY')
  const [selectedCashier, setSelectedCashier] = useState<string>('AUTO')

  // Cart State
  const [cart, setCart] = useState<Array<{ item: MenuItem; qty: number }>>([
    { item: POS_CATALOG[0], qty: 1 },
    { item: POS_CATALOG[4], qty: 2 },
  ])
  const [orderDiscount, setOrderDiscount] = useState<number>(0)
  const [staffMealPin, setStaffMealPin] = useState('')
  const [staffMealAuthorized, setStaffMealAuthorized] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Blind Shift Close State
  const [blindCashCount, setBlindCashCount] = useState<string>('542.850')
  const [blindKnetSlips, setBlindKnetSlips] = useState<string>('895.750')
  const [blindVisaSlips, setBlindVisaSlips] = useState<string>('312.000')
  const [blindZRevealed, setBlindZRevealed] = useState<boolean>(false)

  // Safe Drop State
  const [safeDropAmount, setSafeDropAmount] = useState('350.000')
  const [safeDropBagNo, setSafeDropBagNo] = useState('BG-2026-9042')
  const [pettyExpenseAmount, setPettyExpenseAmount] = useState('3.500')
  const [pettyExpenseReason, setPettyExpenseReason] = useState('شراء كيس ثلج طارئ ونعناع طازج')

    const currentBranchStaff = BRANCH_STAFF_MAP[selectedBranch] || BRANCH_STAFF_MAP.AVENUES
  let activeStaffDisplay = isAr ? currentBranchStaff.fullLabelAr : currentBranchStaff.fullLabelEn
  if (selectedCashier === 'AWAIRA_2049') {
    activeStaffDisplay = isAr
      ? 'المشرف العام: عبد الله عبد الغفار عويره (#2049 — الإدارة التنفيذية)'
      : 'Executive Supervisor: Abdullah Awaira (#2049 — Executive Mgmt)'
  } else if (selectedCashier !== 'AUTO') {
    const found = currentBranchStaff.staffList.find((s) => s.id === selectedCashier)
    if (found) {
      activeStaffDisplay = isAr ? found.nameAr : found.nameEn
    }
  }

  const currentChannelObj = ORDER_CHANNELS.find((c) => c.id === selectedChannel) || ORDER_CHANNELS[0]

  // Filter Catalog
  const filteredCatalog = POS_CATALOG.filter((item) => {
    if (selectedBrand !== 'ALL' && item.brandId !== selectedBrand) return false
    if (selectedCategory !== 'ALL' && item.categoryAr !== selectedCategory && item.categoryEn !== selectedCategory) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchCode = item.code.toLowerCase().includes(q)
      const matchNameAr = item.nameAr.toLowerCase().includes(q)
      const matchNameEn = item.nameEn.toLowerCase().includes(q)
      if (!matchCode && !matchNameAr && !matchNameEn) return false
    }
    return true
  })

  // Cart Calculations
  const rawSubtotal = cart.reduce((acc, c) => acc + c.item.sellingPrice * c.qty, 0)
  const packagingTotal = cart.reduce((acc, c) => acc + (c.item.packagingCost || 0) * c.qty, 0)
  const discountAmount = currentChannelObj.isStaffMeal ? rawSubtotal : (rawSubtotal * orderDiscount) / 100
  const grossSales = currentChannelObj.isStaffMeal ? 0 : rawSubtotal - discountAmount
  const commissionAmount = grossSales * currentChannelObj.commissionRate
  const netStorePayout = grossSales - commissionAmount

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id)
      if (existing) {
        return prev.map((c) => (c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { item, qty: 1 }]
    })
  }

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id === id) {
            const newQty = c.qty + delta
            return newQty > 0 ? { ...c, qty: newQty } : null
          }
          return c
        })
        .filter(Boolean) as Array<{ item: MenuItem; qty: number }>
    )
  }

  const clearCart = () => setCart([])

  const handleCheckout = () => {
    if (cart.length === 0) return
    setNotice(
      isAr
        ? `تم إرسال الطلب بنجاح إلى شاشة المطبخ KDS برقم تذكرة #TK-${Math.floor(1000 + Math.random() * 9000)}، وتم خصم المخزون آلياً وترحيل قيد اليومية!`
        : `Order successfully sent to KDS Ticket #TK-${Math.floor(1000 + Math.random() * 9000)}, inventory backflushed and journal entry generated!`
    )
    clearCart()
    setTimeout(() => setNotice(null), 6000)
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0a0d12] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <Monitor size={14} />
              {isAr ? 'منظومة نقاط البيع والرقابة المالية الميدانية' : 'Enterprise Multi-Brand POS & Field Control'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-1 text-xs font-bold text-indigo-300">
              <UserCheck size={13} className="text-indigo-400" />
              <span>{activeStaffDisplay}</span>
            </span>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              aria-label={isAr ? 'اختيار الكاشير أو المشرف' : 'Select Cashier or Supervisor'}
              className="rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="AUTO">
                {isAr ? 'تلقائي: طاقم الفرع المناوب' : 'Auto: Duty Branch Staff'}
              </option>
              {currentBranchStaff.staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {isAr ? st.nameAr : st.nameEn}
                </option>
              ))}
              <option value="AWAIRA_2049">
                {isAr ? 'عبد الله عبد الغفار عويره (#2049 — الإدارة التنفيذية)' : 'Abdullah Awaira (#2049 — Executive Mgmt)'}
              </option>
            </select>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl tracking-tight">
            {isAr ? 'مركز عمليات الكاشير والضبط المالي بالفرع' : 'Branch POS Terminal & Internal Financial Control'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-4xl">
            {isAr
              ? 'نظام نقاط البيع الموحد للعلامات التجارية الست، إغلاق الوردية الأعمى ومطابقة الصندوق، تسوية كي نت والبنوك، ورقابة الهدر والإلغاءات'
              : 'Unified POS system for all 6 brands, blind shift close & cash reconciliation, K-Net & bank settlement, and waste & void control'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800 transition-all shadow-sm"
          >
            <span>🏠</span>
            <span>{isAr ? 'العودة للوحة القيادة' : 'Back to Dashboard'}</span>
          </a>

          <select
            value={selectedBranch}
            onChange={(e) => {
              setSelectedBranch(e.target.value)
              setSelectedCashier('AUTO')
            }}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {BRANCH_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>
                {isAr ? b.nameAr : b.nameEn}
              </option>
            ))}
          </select>

          <ThemeToggle />

          <button
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
          >
            {isAr ? 'EN | عربي' : 'عربي | EN'}
          </button>
        </div>
      </div>

      {/* Global Notice Toast */}
      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3.5 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 7 Specialized POS Control Units Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'terminal', labelAr: '🖥️ شاشة الكاشير متعددة العلامات', labelEn: 'Multi-Brand POS Terminal', icon: Monitor },
          { key: 'zReport', labelAr: '🔒 إغلاق الوردية الأعمى ومطابقة الصندوق', labelEn: 'Blind Shift Close & Reconciliation', icon: Lock },
          { key: 'tender', labelAr: '💳 تسوية طرق الدفع وعمولات البنوك والمنصات', labelEn: 'Tender Split & Platform Reconciliation', icon: CreditCard },
          { key: 'voids', labelAr: '🛡️ رقابة الخصومات، الإلغاءات، ووجبات الموظفين', labelEn: 'Discounts, Voids & Staff Meals Control', icon: ShieldAlert },
          { key: 'safeDrop', labelAr: '💵 إيداعات الخزنة والمصروفات النثرية بالفرع', labelEn: 'Safe Drops & Branch Petty Cash', icon: Wallet },
          { key: 'glBridge', labelAr: '🔗 الربط المالي والقيود التلقائية الرباعية', labelEn: 'Automated 4D Financial Bridge', icon: ArrowRightLeft },
          ...(liveChildren ? [{ key: 'legacy', labelAr: '⚙️ حالة الاتصال وقاعدة البيانات المحلية', labelEn: 'Local Engine & Connection Status', icon: Building2 }] : []),
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

      {/* TAB 1: Multi-Brand POS Terminal */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Catalog & Filter Section (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Order Channel Selector with Commission Badges */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 shadow-md">
              <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
                <span>{isAr ? 'نوع الطلب وقناة البيع (حساب العمولات والتغليف التلقائي):' : 'Order Channel & Commission Engine:'}</span>
                <span className="font-mono text-emerald-400 text-[11px]">
                  {isAr ? `العمولة: ${(currentChannelObj.commissionRate * 100).toFixed(0)}%` : `Fee: ${(currentChannelObj.commissionRate * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ORDER_CHANNELS.map((ch) => {
                  const selected = selectedChannel === ch.id
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setSelectedChannel(ch.id)}
                      className={`flex flex-col text-right rounded-xl p-2.5 text-xs transition-all border ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10 text-white font-black shadow-md'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-bold">{isAr ? ch.labelAr : ch.labelEn}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {isAr ? ch.subLabelAr : ch.subLabelEn}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Brand Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', labelAr: 'جميع البراندات الـ 6', labelEn: 'All 6 Brands' },
                { id: 'chinagarden', labelAr: 'تشاينا جاردن', labelEn: 'China Garden' },
                { id: 'franks', labelAr: "فرانكس", labelEn: "Frank's" },
                { id: 'tahina', labelAr: 'شاورما طحينة', labelEn: 'Tahina' },
                { id: 'farmbrown', labelAr: 'فارم براون', labelEn: 'Farm Brown' },
                { id: 'noodle', labelAr: 'ذا نودل بار', labelEn: 'The Noodle Bar' },
                { id: 'karak', labelAr: 'كرك كافتيريا', labelEn: 'Karak Cafeteria' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBrand(b.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedBrand === b.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {isAr ? b.labelAr : b.labelEn}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute right-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'البحث الفوري بالاسم أو كود الصنف (MS01, TH01, SH02...)...' : 'Search by item name or SKU code...'}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pr-10 pl-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="cursor-pointer group rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                        {item.code}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isAr ? item.brandNameAr : item.brandNameEn}
                      </span>
                    </div>

                    <h4 className="mt-2 text-xs font-black text-white group-hover:text-emerald-400 transition-colors">
                      {isAr ? item.nameAr : item.nameEn}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isAr ? item.categoryAr : item.categoryEn}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-emerald-400">
                        {item.sellingPrice.toFixed(3)} <span className="text-[10px] text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span>
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {isAr ? `تغليف PI02: ${item.packagingCost.toFixed(3)} د.ك` : `Packaging: ${item.packagingCost.toFixed(3)} KWD`}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        addToCart(item)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart & Ticket Section (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl flex flex-col justify-between min-h-[550px]">
              <div>
                {/* Cart Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {isAr ? 'فاتورة الطلب الحالية' : 'Active Order Basket'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${currentChannelObj.badgeColor}`}>
                        {isAr ? currentChannelObj.labelAr : currentChannelObj.labelEn}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {isAr ? 'رقم الطلب الندائي: #108' : 'Calling Order: #108'}
                      </span>
                    </div>
                  </div>

                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                      title={isAr ? 'تفريغ الفاتورة' : 'Clear Basket'}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      {isAr ? 'الفاتورة فارغة، انقر على الأصناف لإضافتها' : 'Cart is empty. Select items to add.'}
                    </div>
                  ) : (
                    cart.map(({ item, qty }) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[9px] text-indigo-400 font-bold">{item.code}</span>
                            <span className="text-xs font-bold text-white truncate">
                              {isAr ? item.nameAr : item.nameEn}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.sellingPrice.toFixed(3)} × {qty} = <span className="font-bold text-emerald-400">{(item.sellingPrice * qty).toFixed(3)}</span> د.ك
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateCartQty(item.id, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="font-mono text-xs font-bold text-white w-4 text-center">{qty}</span>
                          <button
                            onClick={() => updateCartQty(item.id, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Cart Financial Summary & Checkout */}
              <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
                {/* 0-KD Staff Meal Authorization PIN */}
                {currentChannelObj.isStaffMeal && (
                  <div className="rounded-xl border border-purple-500/40 bg-purple-950/40 p-2.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                      <UserCheck size={13} />
                      {isAr ? 'اعتماد وجبة موظف مجانية (0 د.ك)' : 'Authorize 0-KD Staff Meal'}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        placeholder={isAr ? 'رمز المشرف PIN (مثل 4412)' : 'Manager PIN'}
                        value={staffMealPin}
                        onChange={(e) => setStaffMealPin(e.target.value)}
                        className="w-full rounded-lg border border-purple-500/30 bg-slate-900 px-2.5 py-1 text-xs text-white"
                      />
                      <button
                        onClick={() => {
                          if (staffMealPin === '4412' || staffMealPin.length >= 4) {
                            setStaffMealAuthorized(true)
                            setNotice(isAr ? 'تم اعتماد وجبة الموظف المجانية ومطابقة حساب المصروف 5230' : 'Staff meal authorized under GL 5230')
                          }
                        }}
                        className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500"
                      >
                        {isAr ? 'اعتماد' : 'Auth'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-slate-400">
                  <span>{isAr ? 'المجموع الإجمالي (Gross):' : 'Subtotal (Gross):'}</span>
                  <span className="font-mono text-white">{rawSubtotal.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                </div>

                {currentChannelObj.packagingReq && (
                  <div className="flex justify-between text-slate-400">
                    <span>{isAr ? 'تكلفة التغليف والسفري (PI02*):' : 'Packaging Consumed (PI02):'}</span>
                    <span className="font-mono text-indigo-400">+{packagingTotal.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                  </div>
                )}

                {currentChannelObj.commissionRate > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>{isAr ? `عمولة المنصة (${(currentChannelObj.commissionRate * 100).toFixed(0)}%):` : `Aggregator Fee (${(currentChannelObj.commissionRate * 100).toFixed(0)}%):`}</span>
                    <span className="font-mono">-{commissionAmount.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-400 font-bold">
                    <span>{isAr ? 'خصم وجبة موظف / عرض:' : 'Discount / Staff Meal:'}</span>
                    <span className="font-mono">-{discountAmount.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black">
                  <span className="text-white">{isAr ? 'صافي المبلغ المستحق:' : 'Net Payable Total:'}</span>
                  <span className="text-emerald-400 font-mono text-lg">{grossSales.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                  >
                    <Send size={14} />
                    {isAr ? 'إرسال فوري لشاشة المطبخ' : 'Send to Kitchen'}
                  </button>

                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-3 text-xs font-bold text-white hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    <Printer size={14} />
                    {isAr ? 'دفع وطباعة الفاتورة' : 'Pay & Print'}
                  </button>
                </div>

                {/* Staff Meal Button (Account 5230) */}
                <button
                  type="button"
                  onClick={() => {
                    setOrderDiscount(100);
                    setStaffMealPin('4412');
                    setStaffMealAuthorized(true);
                    setNotice(
                      isAr
                        ? 'تم تسجيل الطلب كوجبة موظف (خصم 100%) وترحيل التكلفة إلى حساب 5230 (تكلفة وجبات الموظفين)!'
                        : 'Staff meal recorded (100% discount) and routed to GL Account 5230 (Staff Meals at Cost).'
                    );
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/50 py-3 text-xs font-black text-purple-300 hover:bg-purple-900/50 hover:border-purple-400 transition-all shadow-md"
                >
                  <UserCheck size={15} />
                  <span>
                    {isAr
                      ? '🍽️ تسجيل كوجبة موظف (يرحل لحساب 5230 بسعر التكلفة)'
                      : '🍽️ Record as Staff Meal (Posted to Acc 5230 at Cost)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Blind Shift Close & Z-Report Reconciliation */}
      {activeTab === 'zReport' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                  <Lock size={18} className="text-amber-400" />
                  {isAr ? 'إغلاق الوردية الأعمى ومطابقة الصندوق' : 'Blind Shift Close & Reconciliation'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? 'يدخل الكاشير النقد الفعلي المعدود ومجاميع إيصالات أجهزة كي نت والبطاقات دون رؤية مبيعات النظام، لمنع التلاعب وكشف العجز أو الزيادة آلياً'
                    : 'Cashier counts actual cash & terminal slips blind without seeing book totals to audit cash variance accurately'}
                </p>
              </div>

              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                {isAr ? 'الوردية الصباحية #104' : 'Morning Shift #104'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* Cash Count Input */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Coins size={15} className="text-emerald-400" />
                  {isAr ? 'النقد الفعلي المعدود بالدرج (د.ك)' : 'Actual Cash Count in Drawer (KWD)'}
                </label>
                <input
                  type="text"
                  value={blindCashCount}
                  onChange={(e) => setBlindCashCount(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500">
                  {isAr ? 'إجمالي فئات النقدية (20، 10، 5، 1، الفكة)' : 'Sum of counted notes and coins in register'}
                </p>
              </div>

              {/* K-Net Terminal Slips Total */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CreditCard size={15} className="text-blue-400" />
                  {isAr ? 'مجموع إيصالات أجهزة كي نت الميدانية (د.ك)' : 'K-Net Terminal Settlement Total (KWD)'}
                </label>
                <input
                  type="text"
                  value={blindKnetSlips}
                  onChange={(e) => setBlindKnetSlips(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-sm font-bold text-blue-400 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500">
                  {isAr ? 'تقرير التسوية من جهاز نقاط البيع البنكي' : 'Batch close slip from bank terminal'}
                </p>
              </div>

              {/* Visa/Mastercard Total */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CreditCard size={15} className="text-purple-400" />
                  {isAr ? 'مجموع البطاقات الائتمانية (د.ك)' : 'Credit Card Settlement Total (KWD)'}
                </label>
                <input
                  type="text"
                  value={blindVisaSlips}
                  onChange={(e) => setBlindVisaSlips(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-sm font-bold text-purple-400 focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-500">
                  {isAr ? 'تسوية فيزا وماستركارد الدولية' : 'International card settlement total'}
                </p>
              </div>
            </div>

            {/* Reveal Reconciliation Action */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => setBlindZRevealed(true)}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-black hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/10"
              >
                <Eye size={16} />
                {isAr ? 'كشف تقرير إغلاق الصندوق ومطابقة الفروقات الدفترية' : 'Reveal Shift Report & Audit Variance'}
              </button>

              {blindZRevealed && (
                <button
                  onClick={() => {
                    setNotice(
                      isAr
                        ? 'تم اعتماد إغلاق الوردية رسمياً، وتوليد القيد المحاسبي اليومي الآلي وترحيله إلى دفتر الأستاذ العام!'
                        : 'Shift closed, Z-Report signed off and automated daily GL voucher posted to Odoo!'
                    )
                  }}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all"
                >
                  <CheckCircle2 size={16} />
                  {isAr ? 'ترحيل قيد إغلاق الوردية إلى المحاسبة العامة' : 'Post Closing Voucher to General Ledger'}
                </button>
              )}
            </div>

            {/* Revealed Z-Report Comparison Table */}
            {blindZRevealed && (
              <div className="mt-6 space-y-4 pt-6 border-t border-slate-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <div className="text-[11px] text-slate-400">{isAr ? 'مبيعات النظام الدفترية' : 'Book Register Sales'}</div>
                    <div className="text-base font-black text-white mt-1">1,750.600 <span className="text-xs text-slate-400">د.ك</span></div>
                    <div className="text-[10px] text-slate-500">142 {isAr ? 'فاتورة مكتملة' : 'closed orders'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <div className="text-[11px] text-slate-400">{isAr ? 'المجموع الفعلي المعدود' : 'Total Counted'}</div>
                    <div className="text-base font-black text-emerald-400 mt-1">1,750.600 <span className="text-xs text-slate-400">د.ك</span></div>
                    <div className="text-[10px] text-slate-500">{isAr ? 'نقداً + كي نت + بطاقات ائتمان' : 'Cash + K-Net + Visa'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <div className="text-[11px] text-slate-400">{isAr ? 'الفارق والعجز/الزيادة' : 'Variance (Over/Short)'}</div>
                    <div className="text-base font-black text-emerald-400 mt-1">0.000 <span className="text-xs text-slate-400">د.ك</span></div>
                    <div className="text-[10px] text-emerald-400/90 font-bold">{isAr ? 'متطابق تماماً 100%' : '100% Balanced'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <div className="text-[11px] text-slate-400">{isAr ? 'حالة القيد الآلي' : 'GL Voucher Status'}</div>
                    <div className="text-base font-black text-indigo-400 mt-1">JV-POS-OCT-3101</div>
                    <div className="text-[10px] text-slate-400">{isAr ? 'جاهز للترحيل الفوري' : 'Ready to post'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Tender Split & Bank/Aggregator Fee Recon */}
      {activeTab === 'tender' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg">
                {isAr ? 'تسوية طرق الدفع وعمولات البنوك والمنصات وتوريد الحساب البنكي' : 'Tender Split & Net Bank Deposit Recon'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'صافي الإيداع المتوقع في حساب الشركة ببنك الكويت الوطني بعد خصم عمولات كي نت وبوابات الدفع ومنصات التوصيل'
                  : 'Audited net settlement deposited to NBK after bank processing fees and delivery commissions'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-3">{isAr ? 'طريقة الدفع / المنصة' : 'Tender Method / Aggregator'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'إجمالي المبيعات (د.ك)' : 'Gross Sales (KWD)'}</th>
                  <th className="py-3 px-3 text-center">{isAr ? 'نسبة العمولة' : 'Fee Rate'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'مبلغ العمولة المحسوم (د.ك)' : 'Commission Deducted (KWD)'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'صافي التوريد للبنك الوطني (د.ك)' : 'Net Bank Deposit (KWD)'}</th>
                  <th className="py-3 px-3 text-center">{isAr ? 'دورة التسوية' : 'Settlement Cycle'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {[
                  { nameAr: 'نقد بالدرج', nameEn: 'Cash in Hand', gross: 412.500, rate: '0.0%', fee: 0.000, net: 412.500, cycle: 'توريد خزينة فوري', badge: 'text-emerald-400' },
                  { nameAr: 'شبكة كي نت (بنك الكويت الوطني)', nameEn: 'K-Net Gateway (NBK)', gross: 895.750, rate: '0.050 د.ك + 0.25%', fee: 14.850, net: 880.900, cycle: 'T+1 يوم عمل', badge: 'text-blue-400' },
                  { nameAr: 'البطاقات الائتمانية العالمية', nameEn: 'Credit Cards', gross: 312.000, rate: '1.75%', fee: 5.460, net: 306.540, cycle: 'T+2 يوم عمل', badge: 'text-purple-400' },
                  { nameAr: 'منصة طلبات (توصيل أسطول المنصة 17%)', nameEn: 'Talabat GO (TGO)', gross: 386.400, rate: '17.0%', fee: 65.688, net: 320.712, cycle: 'أسبوعي الأربعاء', badge: 'text-orange-400' },
                  { nameAr: 'منصة طلبات (توصيل أسطول الشركة 10%)', nameEn: 'Talabat TMP (Fleet)', gross: 215.000, rate: '10.0%', fee: 21.500, net: 193.500, cycle: 'أسبوعي الأربعاء', badge: 'text-amber-400' },
                  { nameAr: 'منصة كيتا (12%)', nameEn: 'Keeta Delivery', gross: 140.000, rate: '12.0%', fee: 16.800, net: 123.200, cycle: 'نصف شهري', badge: 'text-yellow-400' },
                  { nameAr: 'منصة ديليفرو (18%)', nameEn: 'Deliveroo Kuwait', gross: 95.500, rate: '18.0%', fee: 17.190, net: 78.310, cycle: 'أسبوعي الإثنين', badge: 'text-teal-400' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${row.badge.replace('text-', 'bg-')}`}></span>
                      {isAr ? row.nameAr : row.nameEn}
                    </td>
                    <td className="py-3 px-3 text-left font-bold text-white">{row.gross.toFixed(3)}</td>
                    <td className="py-3 px-3 text-center text-slate-400">{row.rate}</td>
                    <td className="py-3 px-3 text-left text-rose-400">-{row.fee.toFixed(3)}</td>
                    <td className="py-3 px-3 text-left font-black text-emerald-400">{row.net.toFixed(3)}</td>
                    <td className="py-3 px-3 text-center text-slate-400 font-sans text-[11px]">{row.cycle}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-slate-950 font-bold text-xs">
                  <td className="py-3 px-3 text-slate-200">{isAr ? 'الإجمالي الموحد للوردية' : 'Shift Total Net Deposit'}</td>
                  <td className="py-3 px-3 text-left text-white font-mono">2,457.150</td>
                  <td></td>
                  <td className="py-3 px-3 text-left text-rose-400 font-mono">-141.488</td>
                  <td className="py-3 px-3 text-left text-emerald-400 font-mono text-sm">2,315.662</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Voids, Refunds & 0-KD Audit */}
      {activeTab === 'voids' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-400" />
                {isAr ? 'سجل رقابة الخصومات، الإلغاءات، ووجبات الموظفين' : 'Discounts, Voids & Staff Meals Audit'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'سجل تدقيق مالي جنائي يوثق أي تعديل أو إلغاء أو وجبة موظف مع اسم المشرف المعتمد ومركز التكلفة المحاسبي'
                  : 'Forensic audit trail of all cashier cancellations, voided lines, discounts, and staff meals'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-3">{isAr ? 'رقم الإجراء' : 'Audit Ref'}</th>
                  <th className="py-3 px-3">{isAr ? 'النوع' : 'Action Type'}</th>
                  <th className="py-3 px-3">{isAr ? 'الأصناف المتأثرة' : 'Items'}</th>
                  <th className="py-3 px-3 text-left">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                  <th className="py-3 px-3">{isAr ? 'السبب والمسوغ التشغيلي' : 'Reason / Justification'}</th>
                  <th className="py-3 px-3">{isAr ? 'المشرف المعتمد' : 'Authorized Manager'}</th>
                  <th className="py-3 px-3">{isAr ? 'مركز التكلفة المحاسبي' : 'Cost Center'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {[
                  { ref: 'AUD-VD-9021', typeAr: 'إلغاء صنف معتمد', typeEn: 'Authorized Void', typeColor: 'text-amber-400 bg-amber-500/10', itemsAr: '2x برجر ترافل أنجوس (MS03)', itemsEn: '2x Angus Truffle Burger (MS03)', amount: 9.000, reasonAr: 'خطأ إدخال كاشير قبل التحضير', reasonEn: 'Cashier error before prep', managerAr: 'شكرالله ناصيف (رمز 4412)', managerEn: 'Shokrallah Nassif (#4412)', ccAr: 'فرانكس الأفنيوز CC-FR-AV', ccEn: 'Franks Avenues' },
                  { ref: 'AUD-RF-1044', typeAr: 'مرتجع نقدي للعميل', typeEn: 'Cash Refund', typeColor: 'text-rose-400 bg-rose-500/10', itemsAr: '1x ستيك ريب آي 300غ (MS01)', itemsEn: '1x Ribeye Steak 300g (MS01)', amount: 9.850, reasonAr: 'طلب العميل درجة نضج محددة وتم تعديلها', reasonEn: 'Customer steak doneness preference', managerAr: 'عبد الله عبد الغفار عويره (#2049)', managerEn: 'Abdullah Awaira (#2049)', ccAr: 'مردودات مبيعات 401090', ccEn: 'Sales Returns 401090' },
                  { ref: 'AUD-ST-0038', typeAr: 'وجبة موظف مصرحة', typeEn: 'Staff Meal', typeColor: 'text-purple-400 bg-purple-500/10', itemsAr: '1x دجاج كانتون تشاينا جاردن + أرز (CG01)', itemsEn: '1x Canton Chicken + Rice (CG01)', amount: 4.050, reasonAr: 'وجبة موظف الوردية الصباحية - شيف تحضير', reasonEn: 'Morning shift staff meal', managerAr: 'عبد الرحمن محمد (رمز 7701)', managerEn: 'Abdulrahman Mohammed (#7701)', ccAr: 'مصروف وجبات موظفين 5230', ccEn: 'Staff Meals 5230' },
                  { ref: 'AUD-DC-3180', typeAr: 'خصم ضيافة استثنائي', typeEn: 'Hospitality Discount', typeColor: 'text-blue-400 bg-blue-500/10', itemsAr: 'طلب ندائي رقم #108', itemsEn: 'Calling Order #108', amount: 3.500, reasonAr: 'خصم اعتذار عن تأخير المشروبات 10 دقائق', reasonEn: 'Drink delay apology discount', managerAr: 'شكرالله ناصيف (رمز 4412)', managerEn: 'Shokrallah Nassif (#4412)', ccAr: 'خصومات مسموح بها 401080', ccEn: 'Allowed Discounts 401080' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors font-sans">
                    <td className="py-3 px-3 font-mono font-bold text-slate-300">{row.ref}</td>
                    <td className="py-3 px-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.typeColor}`}>
                        {isAr ? row.typeAr : row.typeEn}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">{isAr ? row.itemsAr : row.itemsEn}</td>
                    <td className="py-3 px-3 font-mono font-black text-rose-400 text-left">{row.amount.toFixed(3)}</td>
                    <td className="py-3 px-3 text-slate-300 text-xs">{isAr ? row.reasonAr : row.reasonEn}</td>
                    <td className="py-3 px-3 text-slate-300">{isAr ? row.managerAr : row.managerEn}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-indigo-400">{isAr ? row.ccAr : row.ccEn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Safe Drops & Branch Petty Cash Out */}
      {activeTab === 'safeDrop' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Safe Drop Form */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Lock size={17} className="text-emerald-400" />
              {isAr ? 'توريد نقد الخزنة للبنك' : 'Cash Safe Drop to Bank Transit'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'تفريغ فائض النقد من درج الكاشير وإيداعه في خزنة الفرع الحديدية أو تسليمه لسيارة نقل الأموال للبنك الوطني'
                : 'Transfer excess cash from drawer to branch drop-safe or NBK armored courier'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'مبلغ التوريد (د.ك):' : 'Safe Drop Amount (KWD):'}</label>
                <input
                  type="text"
                  value={safeDropAmount}
                  onChange={(e) => setSafeDropAmount(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'رقم كيس الإيداع البنكي المشمع:' : 'Armored Bag Seal #:'}</label>
                <input
                  type="text"
                  value={safeDropBagNo}
                  onChange={(e) => setSafeDropBagNo(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-white"
                />
              </div>

              <button
                onClick={() => {
                  setNotice(isAr ? `تم تسجيل توريد الخزنة بمبلغ ${safeDropAmount} د.ك وإصدار قيد الإيداع البنكي الآلي!` : `Safe drop ${safeDropAmount} KWD recorded & GL entry posted!`)
                }}
                className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
              >
                {isAr ? 'تأكيد التوريد وإصدار إشعار الإيداع' : 'Confirm Safe Drop & Generate Voucher'}
              </button>
            </div>
          </div>

          {/* Emergency Branch Petty Cash Expense Form */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Wallet size={17} className="text-amber-400" />
              {isAr ? 'صرف نثريات طارئة من الدرج' : 'Emergency Branch Petty Cash Out'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'تسجيل أي مشتريات تشغيلية طارئة مدفوعة نقداً من درج الكاشير وربطها بحساب عهدة الفرع 101005'
                : 'Emergency operational petty expense paid from drawer linked to branch petty cash account'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'المبلغ المصروف (د.ك):' : 'Amount Spent (KWD):'}</label>
                <input
                  type="text"
                  value={pettyExpenseAmount}
                  onChange={(e) => setPettyExpenseAmount(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm font-bold text-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'البيان والسبب:' : 'Expense Justification:'}</label>
                <input
                  type="text"
                  value={pettyExpenseReason}
                  onChange={(e) => setPettyExpenseReason(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <button
                onClick={() => {
                  setNotice(isAr ? `تم قيد المصروف النثري ${pettyExpenseAmount} د.ك على عهدة الفرع وإرفاق السند!` : `Petty cash voucher ${pettyExpenseAmount} KWD posted to branch custody!`)
                }}
                className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-black hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/10"
              >
                {isAr ? 'قيد المصروف على عهدة الفرع' : 'Post Petty Cash Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Automated Financial GL Bridge */}
      {activeTab === 'glBridge' && (
        <AutomatedGlBridge locale={currentLocale} />
      )}

      {/* TAB 7: Live Database POS Engine & Connection Status */}
      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
          {liveChildren}
        </div>
      )}

      
    </div>
  )
}
