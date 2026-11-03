/**
 * Venture Foods Restaurant Management Co. W.L.L. (CR 412891)
 * Exhibitions, Ministry Camps & Special Events Management & Menu Engineering Engine
 * 
 * Historical & Active events:
 * 1. Kuwait International Perfume Exhibition (Mishref Fairground Hall 5)
 * 2. Ministry of Defense Spring Officers Camp (Subiya / North Kuwait)
 * 3. Ministry of Interior Winter Officers Camp (Kabd / Mesayel)
 * 4. Safir Hotel Luxury Fashion & Ramadan Pop-Ups (Bneid Al-Qar)
 * 5. Mishref Ramadan Food & Hospitality Fair
 * 6. Khiran Chalets & Winter Fest Pop-Up
 */

export type EventStatus = 'feasibility' | 'licensing' | 'active' | 'closed'

export type EventType = 'mega_expo' | 'ministry_camp' | 'hotel_popup' | 'youth_sports' | 'seasonal'

export interface VentureEventCosts {
  boothRentalKwd: number
  securityDepositKwd: number
  securityDepositStatus: 'pending' | 'refunded' | 'partially_retained'
  constructionFitoutKwd: number
  permitsPowerKwd: number
  transportLogisticsKwd: number
  foodPackagingCogsKwd: number
  staffLaborOvertimeKwd: number
  wasteCompsKwd: number
  totalCostsKwd: number
}

export interface VentureEventRevenue {
  grossSalesKwd: number
  netSalesKwd: number
  knetSalesKwd: number
  applePaySalesKwd: number
  cashSalesKwd: number
  totalOrders: number
  aovKwd: number
  dailySalesVelocityKwd: number
}

export interface VentureEventProfitability {
  breakEvenPointKwd: number
  breakEvenDay: number
  netProfitKwd: number
  roiPercent: number
  profitMarginPercent: number
}

export interface VentureEvent {
  id: string
  code: string
  nameAr: string
  nameEn: string
  organizerAr: string
  organizerEn: string
  locationAr: string
  locationEn: string
  startDate: string
  endDate: string
  daysCount: number
  boothAreaSqM: number
  status: EventStatus
  eventType: EventType
  costCenterCode: string
  primaryBrands: string[]
  conceptDescriptionAr: string
  conceptDescriptionEn: string
  costs: VentureEventCosts
  revenue: VentureEventRevenue
  profitability: VentureEventProfitability
  assignedStaffCount: number
  projectManager: string
  notes: string
  bestSellingItemAr: string
  bestSellingItemEn: string
  leadSponsorOrClient?: string
}

export interface EventMenuItem {
  id: string
  nameAr: string
  nameEn: string
  brandAr: string
  brandEn: string
  brandKey: string
  categoryAr: string
  categoryEn: string
  recipeCostKwd: number
  packagingCostKwd: number // PI02* packaging
  totalUnitCostKwd: number
  eventSellingPriceKwd: number
  unitMarginKwd: number
  marginPercent: number
  prepTimeMinutes: number
  dailyParLevelWeekday: number
  dailyParLevelWeekend: number
  wasteRisk: 'very_low' | 'low' | 'medium'
  keyAllergensAr: string
  keyAllergensEn: string
  specialCookingEquipment: string
}

export interface BrandEventSuitability {
  brandKey: string
  nameAr: string
  nameEn: string
  suitabilityScore: number // 1 - 100
  recommendedFor: EventType[]
  strengthsAr: string
  strengthsEn: string
  topEventItems: string[]
  recommendedCombinations: string[]
  historicalRoiPercent: number
}

export interface ProjectTaskItem {
  id: string
  phaseNumber: 1 | 2 | 3 | 4
  titleAr: string
  titleEn: string
  assignee: string
  roleAr: string
  roleEn: string
  daysOffset: string
  dueDate: string
  status: 'completed' | 'in_progress' | 'pending' | 'blocked'
  requiredDocumentAr?: string
  requiredDocumentEn?: string
}

export interface EquipmentChecklistItem {
  id: string
  nameAr: string
  nameEn: string
  category: 'cooking' | 'refrigeration' | 'pos_it' | 'safety' | 'furniture'
  assetCode: string
  assignedSourceWarehouse: string
  condition: 'excellent' | 'good' | 'maintenance_needed'
  powerWattage: string
  verifiedAtDispatch: boolean
  verifiedAtReturn: boolean
  returnStatus: 'pending' | 'returned_intact' | 'damaged' | 'missing'
}

export interface StaffRosterMember {
  id: string
  name: string
  roleAr: string
  roleEn: string
  civilId: string
  originBranchAr: string
  originBranchEn: string
  baladiyaHealthCardNo: string
  baladiyaExpiryDate: string
  isHealthCardValid: boolean
  dailyShiftHours: number
  overtimeRateHourlyKwd: number
  assignedStation: string
}

export interface CentralKitchenPrepQuota {
  itemCode: string
  nameAr: string
  nameEn: string
  unit: string
  weekdayParLevel: number
  weekendParLevel: number
  morningDispatchTime: string
  eveningDispatchTime: string
  tempRequirement: string
  shelfLifeHours: number
}

export interface BreakEvenSimulationInput {
  boothRentKwd: number
  fitoutSignageKwd: number
  permitsTransportKwd: number
  daysCount: number
  staffCount: number
  dailyWagePerStaffKwd: number
  expectedAovKwd: number
  estimatedCogsPercent: number // e.g. 26%
  dailyOtherFixedCostKwd: number
}

export interface BreakEvenSimulationResult {
  totalFixedCostsKwd: number
  totalLaborCostKwd: number
  totalPreOpeningCostsKwd: number
  dailyFixedCostKwd: number
  contributionMarginPercent: number
  contributionMarginPerOrderKwd: number
  totalBreakEvenSalesKwd: number
  totalBreakEvenOrders: number
  dailyBreakEvenOrders: number
  dailyBreakEvenSalesKwd: number
  projectedBreakEvenDay: number
  projectedNetProfitAtSales: (projectedTotalSalesKwd: number) => {
    projectedRevenueKwd: number
    totalCogsKwd: number
    grossProfitKwd: number
    netProfitKwd: number
    roiPercent: number
    profitMarginPercent: number
  }
}

// -------------------------------------------------------------
// HISTORICAL & ACTIVE VENTURE FOODS EVENTS REPOSITORY
// -------------------------------------------------------------

export const VENTURE_FOODS_EVENTS: VentureEvent[] = [
  {
    id: 'EVT-MISHREF-PERFUME-2026',
    code: 'VF-EVT-01',
    nameAr: 'معرض الكويت الدولي للعطور وأدوات التجميل - أرض المعارض بمشرف (صالة 5)',
    nameEn: 'Kuwait International Perfume Exhibition - Mishref Fairground (Hall 5)',
    organizerAr: 'شركة معرض الكويت الدولي (KIF)',
    organizerEn: 'Kuwait International Fair Co.',
    locationAr: 'مشرف - أرض المعارض الدولية - الصالة الكبرى 5 بوث F-12',
    locationEn: 'Mishref Fairground - Grand Hall 5 Booth F-12',
    startDate: '2026-10-22',
    endDate: '2026-11-02',
    daysCount: 12,
    boothAreaSqM: 36,
    status: 'closed',
    eventType: 'mega_expo',
    costCenterCode: 'CC-EVT-701',
    primaryBrands: ["The Noodle Bar", "Frank's", "Karak Cafeteria"],
    conceptDescriptionAr: 'بوث مدمج ثلاثي يقدم نودلز سريعة التحضير في أكواب، برجر فيلي ستيك، وكرك حار للمتسوقين والزوار.',
    conceptDescriptionEn: 'Triple concept booth serving grab-and-go noodle cups, Philly cheesesteaks, and hot artisanal karak for shoppers.',
    costs: {
      boothRentalKwd: 4800.000,
      securityDepositKwd: 1000.000,
      securityDepositStatus: 'refunded',
      constructionFitoutKwd: 1450.000,
      permitsPowerKwd: 320.000,
      transportLogisticsKwd: 420.000,
      foodPackagingCogsKwd: 5680.000,
      staffLaborOvertimeKwd: 1840.000,
      wasteCompsKwd: 180.000,
      totalCostsKwd: 14690.000,
    },
    revenue: {
      grossSalesKwd: 26450.000,
      netSalesKwd: 26450.000,
      knetSalesKwd: 16840.000,
      applePaySalesKwd: 7420.000,
      cashSalesKwd: 2190.000,
      totalOrders: 5420,
      aovKwd: 4.880,
      dailySalesVelocityKwd: 2204.167,
    },
    profitability: {
      breakEvenPointKwd: 14690.000,
      breakEvenDay: 7,
      netProfitKwd: 11760.000,
      roiPercent: 80.05,
      profitMarginPercent: 44.46,
    },
    assignedStaffCount: 8,
    projectManager: 'Choukrallah Nassif (Operations Director)',
    notes: 'حقق بوث صالة 5 نجاحاً باهراً؛ أصناف النودلز والكرك حققت 61% من المبيعات لسرعة تسليمها خلال أقل من دقيقتين.',
    bestSellingItemAr: 'كوب نودلز الدجاج المقرمش (Chicken Noodles Cup)',
    bestSellingItemEn: 'Crispy Chicken Noodles Cup',
    leadSponsorOrClient: 'Kuwait International Fair (KIF)',
  },
  {
    id: 'EVT-MOD-CAMP-2026',
    code: 'VF-EVT-02',
    nameAr: 'مخيم ضباط وزارة الدفاع الربيعي - الصبية (طريق الشيخ جابر)',
    nameEn: 'Ministry of Defense Spring Officers Camp - Subiya',
    organizerAr: 'وزارة الدفاع - قطاع الشؤون العسكرية والنوادي والأنشطة',
    organizerEn: 'Ministry of Defense - Military Affairs & Officers Club',
    locationAr: 'شمال الكويت - الصبية - مجمع مخيم ضباط الجيش قطاع A',
    locationEn: 'Subiya - Kuwait Military Officers Spring Camp Sector A',
    startDate: '2026-11-15',
    endDate: '2026-12-30',
    daysCount: 45,
    boothAreaSqM: 64,
    status: 'active',
    eventType: 'ministry_camp',
    costCenterCode: 'CC-EVT-702',
    primaryBrands: ["Tahina", "China Garden", "Karak Cafeteria"],
    conceptDescriptionAr: 'خيمة مطعم متكاملة مزودة بطلبات سيارات وجلسات داخلية تقدم بوكسات الشاورما العائلية، صواني النودلز الصينية، والشاي والمشروبات الدافئة.',
    conceptDescriptionEn: 'Full dining tent & drive-thru hub serving family shawarma boxes, Chinese party trays, and winter hot brews.',
    costs: {
      boothRentalKwd: 6500.000,
      securityDepositKwd: 1500.000,
      securityDepositStatus: 'pending',
      constructionFitoutKwd: 2800.000,
      permitsPowerKwd: 650.000,
      transportLogisticsKwd: 1150.000,
      foodPackagingCogsKwd: 12400.000,
      staffLaborOvertimeKwd: 4200.000,
      wasteCompsKwd: 390.000,
      totalCostsKwd: 28090.000,
    },
    revenue: {
      grossSalesKwd: 48920.000,
      netSalesKwd: 48920.000,
      knetSalesKwd: 29840.000,
      applePaySalesKwd: 14680.000,
      cashSalesKwd: 4400.000,
      totalOrders: 9230,
      aovKwd: 5.300,
      dailySalesVelocityKwd: 1087.111,
    },
    profitability: {
      breakEvenPointKwd: 28090.000,
      breakEvenDay: 26,
      netProfitKwd: 20830.000,
      roiPercent: 74.15,
      profitMarginPercent: 42.58,
    },
    assignedStaffCount: 12,
    projectManager: 'Abdulrahman Mohamed (Area Manager - Camps)',
    notes: 'المخيم نشط حالياً مع ذروة مبيعات قوية في عطلة نهاية الأسبوع (الخميس والجمعة والسبت). تزويد يومي مرتين بسيارة البراد من مطبخ القرين.',
    bestSellingItemAr: 'بوكس شاورما الدجاج العائلي + ترمس الكرك',
    bestSellingItemEn: 'Family Chicken Shawarma Box + Karak Thermos',
    leadSponsorOrClient: 'Ministry of Defense Officers Welfare',
  },
  {
    id: 'EVT-MOI-CAMP-2026',
    code: 'VF-EVT-03',
    nameAr: 'مخيم وزارة الداخلية الشتوي - المسايل / كبد',
    nameEn: 'Ministry of Interior Winter Officers Camp - Kabd / Messila',
    organizerAr: 'وزارة الداخلية - صندوق رعاية الضباط والأنشطة الاجتماعية',
    organizerEn: 'Ministry of Interior - Officers Welfare & Social Fund',
    locationAr: 'كبد - مخيم وزارة الداخلية العائلي بوث 4 المركزي',
    locationEn: 'Kabd - MOI Family Camp Central Hub Booth 4',
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    daysCount: 30,
    boothAreaSqM: 48,
    status: 'licensing',
    eventType: 'ministry_camp',
    costCenterCode: 'CC-EVT-703',
    primaryBrands: ["Frank's", "Tahina", "Farm Brown"],
    conceptDescriptionAr: 'بوث شبابي عائلي يجمع بين سلايدرز وبرجر فرانكس الأمريكي الفاخر وشاورما وفلافل طحينة مع بوكسات الإفطار الصحي من فارم براون.',
    conceptDescriptionEn: 'Youth and family hub combining Frank’s smashed sliders, Tahina shawarma, and Farm Brown fresh breakfast boxes.',
    costs: {
      boothRentalKwd: 4200.000,
      securityDepositKwd: 1000.000,
      securityDepositStatus: 'pending',
      constructionFitoutKwd: 1950.000,
      permitsPowerKwd: 480.000,
      transportLogisticsKwd: 820.000,
      foodPackagingCogsKwd: 8900.000,
      staffLaborOvertimeKwd: 2750.000,
      wasteCompsKwd: 260.000,
      totalCostsKwd: 19360.000,
    },
    revenue: {
      grossSalesKwd: 34500.000,
      netSalesKwd: 34500.000,
      knetSalesKwd: 21400.000,
      applePaySalesKwd: 10350.000,
      cashSalesKwd: 2750.000,
      totalOrders: 6900,
      aovKwd: 5.000,
      dailySalesVelocityKwd: 1150.000,
    },
    profitability: {
      breakEvenPointKwd: 19360.000,
      breakEvenDay: 17,
      netProfitKwd: 15140.000,
      roiPercent: 78.20,
      profitMarginPercent: 43.88,
    },
    assignedStaffCount: 8,
    projectManager: 'Abdullah Abdulghafar (Executive Secretary & Legal)',
    notes: 'المشروع في مرحلة التجهيز والترخيص النهائي مع بلدية الكويت والإطفاء. بدء التجهيز الفعلي الأسبوع القادم.',
    bestSellingItemAr: 'بوكس ميني سلايدرز فرانكس (Frank\'s Slider Box)',
    bestSellingItemEn: 'Frank\'s Mini Slider Party Box',
    leadSponsorOrClient: 'Ministry of Interior Kuwait',
  },
  {
    id: 'EVT-SAFIR-POPUP-2026',
    code: 'VF-EVT-04',
    nameAr: 'معرض وبازار فندق السفير الفاخر - بنيد القار (قاعة اللؤلؤة)',
    nameEn: 'Safir Hotel Luxury Fashion & Ramadan Pop-Up - Bneid Al-Qar',
    organizerAr: 'إدارة فعاليات فندق السفير & بازار لاكشري كويت',
    organizerEn: 'Safir Hotels & Resorts Management & Luxury Pop-Up Events',
    locationAr: 'بنيد القار - فندق السفير - قاعة اللؤلؤة بوث VIP-03',
    locationEn: 'Bneid Al-Qar - Safir Hotel Pearl Grand Ballroom VIP-03',
    startDate: '2026-11-05',
    endDate: '2026-11-12',
    daysCount: 8,
    boothAreaSqM: 24,
    status: 'feasibility',
    eventType: 'hotel_popup',
    costCenterCode: 'CC-EVT-704',
    primaryBrands: ["The Noodle Bar", "Farm Brown", "Karak Cafeteria"],
    conceptDescriptionAr: 'بوث فندقي راقٍ يقدم نودلز تروفل فاخرة، سلطات كينوا عضوية، ومشروبات باردة وساخنة بلمسة فندقية راقية وعبوات صديقة للبيئة.',
    conceptDescriptionEn: 'High-end boutique pop-up serving artisanal truffle noodles, organic quinoa bowls, and designer beverages.',
    costs: {
      boothRentalKwd: 3200.000,
      securityDepositKwd: 800.000,
      securityDepositStatus: 'pending',
      constructionFitoutKwd: 1600.000,
      permitsPowerKwd: 250.000,
      transportLogisticsKwd: 280.000,
      foodPackagingCogsKwd: 3100.000,
      staffLaborOvertimeKwd: 1120.000,
      wasteCompsKwd: 150.000,
      totalCostsKwd: 9700.000,
    },
    revenue: {
      grossSalesKwd: 17280.000,
      netSalesKwd: 17280.000,
      knetSalesKwd: 11230.000,
      applePaySalesKwd: 5180.000,
      cashSalesKwd: 870.000,
      totalOrders: 2700,
      aovKwd: 6.400,
      dailySalesVelocityKwd: 2160.000,
    },
    profitability: {
      breakEvenPointKwd: 9700.000,
      breakEvenDay: 5,
      netProfitKwd: 7580.000,
      roiPercent: 78.14,
      profitMarginPercent: 43.87,
    },
    assignedStaffCount: 5,
    projectManager: 'Choukrallah Nassif (Operations Director)',
    notes: 'دراسة جدوى واعدة جداً نظراً للقدرة الشرائية المرتفعة لجمهور معرض فندق السفير، ومتوسط الفاتورة المتوقع 6.400 د.ك.',
    bestSellingItemAr: 'نودلز لحم التروفل الفاخرة + بودينغ الكينوا',
    bestSellingItemEn: 'Luxury Truffle Beef Noodles + Quinoa Bowl',
    leadSponsorOrClient: 'Safir Hotel Kuwait',
  },
  {
    id: 'EVT-MISHREF-FOOD-2025',
    code: 'VF-EVT-05',
    nameAr: 'معرض الغذاء والأواني الرمضاني السنوي - أرض المعارض بمشرف (صالة 4)',
    nameEn: 'Mishref Ramadan Food & Hospitality Fair - Mishref (Hall 4)',
    organizerAr: 'شركة معرض الكويت الدولي (KIF)',
    organizerEn: 'Kuwait International Fair Co.',
    locationAr: 'مشرف - أرض المعارض - صالة 4 بوث A-10',
    locationEn: 'Mishref Fairground - Hall 4 Booth A-10',
    startDate: '2026-03-01',
    endDate: '2026-03-14',
    daysCount: 14,
    boothAreaSqM: 40,
    status: 'closed',
    eventType: 'mega_expo',
    costCenterCode: 'CC-EVT-690',
    primaryBrands: ["China Garden", "Tahina", "Karak Cafeteria"],
    conceptDescriptionAr: 'بوث رمضاني للأطعمة السريعة ومشروبات الإفطار والسحور.',
    conceptDescriptionEn: 'Ramadan fast-casual booth featuring Iftar & Suhoor ready sets.',
    costs: {
      boothRentalKwd: 5200.000,
      securityDepositKwd: 1000.000,
      securityDepositStatus: 'refunded',
      constructionFitoutKwd: 1550.000,
      permitsPowerKwd: 350.000,
      transportLogisticsKwd: 460.000,
      foodPackagingCogsKwd: 6780.000,
      staffLaborOvertimeKwd: 2180.000,
      wasteCompsKwd: 280.000,
      totalCostsKwd: 16800.000,
    },
    revenue: {
      grossSalesKwd: 29800.000,
      netSalesKwd: 29800.000,
      knetSalesKwd: 18450.000,
      applePaySalesKwd: 8900.000,
      cashSalesKwd: 2450.000,
      totalOrders: 6200,
      aovKwd: 4.806,
      dailySalesVelocityKwd: 2128.571,
    },
    profitability: {
      breakEvenPointKwd: 16800.000,
      breakEvenDay: 8,
      netProfitKwd: 13000.000,
      roiPercent: 77.38,
      profitMarginPercent: 43.62,
    },
    assignedStaffCount: 9,
    projectManager: 'Abdulrahman Mohamed (Area Manager)',
    notes: 'فعالية سنوية دورية عالية الموثوقية وتعد معياراً لأداء المعارض الربيعية والرمضانية.',
    bestSellingItemAr: 'بوكس مكس المقبلات الصينية + كرك حار',
    bestSellingItemEn: 'Asian Appetizer Dimsum Box + Karak',
  },
  {
    id: 'EVT-WINTERLAND-CHALET-2025',
    code: 'VF-EVT-06',
    nameAr: 'موسم فعاليات الشتاء والشاليهات - الخيران / وندرلاند كويت',
    nameEn: 'Khiran Chalets & Winter Fest Pop-Up Hub',
    organizerAr: 'شركة المشروعات السياحية والجهات المنظمة للشاليهات',
    organizerEn: 'Touristic Enterprises Co. & Chalet Event Ops',
    locationAr: 'الخيران - المارينا والواجهة البحرية كشك K-08',
    locationEn: 'Khiran Marina Waterfront Kiosk K-08',
    startDate: '2025-12-01',
    endDate: '2026-01-30',
    daysCount: 60,
    boothAreaSqM: 50,
    status: 'closed',
    eventType: 'seasonal',
    costCenterCode: 'CC-EVT-650',
    primaryBrands: ["Frank's", "The Noodle Bar", "Karak Cafeteria"],
    conceptDescriptionAr: 'كشك شتوي متنقل يخدم مرتادي الشاليهات في الخيران والفعاليات الشاطئية.',
    conceptDescriptionEn: 'Winter pop-up catering to chalet weekenders and coastal festivals.',
    costs: {
      boothRentalKwd: 9800.000,
      securityDepositKwd: 2000.000,
      securityDepositStatus: 'refunded',
      constructionFitoutKwd: 3200.000,
      permitsPowerKwd: 950.000,
      transportLogisticsKwd: 1950.000,
      foodPackagingCogsKwd: 15400.000,
      staffLaborOvertimeKwd: 6400.000,
      wasteCompsKwd: 700.000,
      totalCostsKwd: 38400.000,
    },
    revenue: {
      grossSalesKwd: 67500.000,
      netSalesKwd: 67500.000,
      knetSalesKwd: 42500.000,
      applePaySalesKwd: 19800.000,
      cashSalesKwd: 5200.000,
      totalOrders: 13500,
      aovKwd: 5.000,
      dailySalesVelocityKwd: 1125.000,
    },
    profitability: {
      breakEvenPointKwd: 38400.000,
      breakEvenDay: 35,
      netProfitKwd: 29100.000,
      roiPercent: 75.78,
      profitMarginPercent: 43.11,
    },
    assignedStaffCount: 14,
    projectManager: 'Choukrallah Nassif (Operations Director)',
    notes: 'أطول الفعاليات موسماً وحققت أعلى إجمالي أرباح نقدية بلغت 29,100 د.ك.',
    bestSellingItemAr: 'برجر فرانكس سموك هاوس + شاي كرك زعفران',
    bestSellingItemEn: 'Frank\'s Smokehouse Burger + Saffron Karak',
  },
  {
    id: 'EVT-007',
    code: 'VF-EVT-MARINA-2026',
    nameAr: 'كشتة المارينا الشتوية - تشاينا جاردن (Marina Kashta)',
    nameEn: 'Marina Kashta Winter Pop-Up (China Garden)',
    organizerAr: 'شركة ريختر كريتيف لتنظيم المعارض (بدر نبيل العيسى)',
    organizerEn: 'Richter Creative Exhibition Organizers (Bader Nabeel AlEssa)',
    locationAr: 'الواجهة البحرية لمارينا كريسنت - السالمية (بوث قياسي 3×3م - 9 م²)',
    locationEn: 'Marina Crescent Waterfront Promenade, Salmiya (Normal Booth 3x3m - 9 sqm)',
    startDate: '2026-11-26',
    endDate: '2027-01-02',
    daysCount: 38,
    boothAreaSqM: 9,
    status: 'active',
    eventType: 'seasonal',
    costCenterCode: 'CC-EVT-701',
    primaryBrands: ['China Garden'],
    conceptDescriptionAr: 'مشاركة حصرية لبراند تشاينا جاردن وفق عقد 1976 المشروط بمنع الغاز واللهب المكشوف 100% والاعتماد على مقالي الووك الحثية الكهربائية (Induction Woks 3.5kW) مع أكواب وبوكسات المشي والأكل السريعة.',
    conceptDescriptionEn: 'Exclusive China Garden participation under contract 1976 strictly prohibiting LPG/gas/open flames, utilizing 100% electric induction woks for fast-turnaround walk & eat cups and rice bowls.',
    costs: {
      boothRentalKwd: 1300.000,
      securityDepositKwd: 250.000,
      securityDepositStatus: 'pending',
      constructionFitoutKwd: 650.000,
      permitsPowerKwd: 150.000,
      transportLogisticsKwd: 200.000,
      foodPackagingCogsKwd: 1546.600,
      staffLaborOvertimeKwd: 950.000,
      wasteCompsKwd: 0.000,
      totalCostsKwd: 4796.600,
    },
    revenue: {
      grossSalesKwd: 7030.000,
      netSalesKwd: 7030.000,
      knetSalesKwd: 4920.000,
      applePaySalesKwd: 1750.000,
      cashSalesKwd: 360.000,
      totalOrders: 2757,
      aovKwd: 2.550,
      dailySalesVelocityKwd: 185.000,
    },
    profitability: {
      breakEvenPointKwd: 4167.000,
      breakEvenDay: 22,
      netProfitKwd: 2233.400,
      roiPercent: 68.72,
      profitMarginPercent: 31.77,
    },
    assignedStaffCount: 3,
    projectManager: 'Chef Wang & Ops Supervisor (China Garden Salmiya)',
    notes: 'عقد مشاركة كشتة المارينا (1976) المبرم مع شركة ريختر كريتيف (بدر نبيل العيسى). ترخيص تجاري 2021/22838 - أحمد عصام الإبراهيم (286031101513). إيجار 1,300 د.ك + تأمين مسترد 250 د.ك بحساب GL 110400. ممنوع الغاز 100%. دعم لوجستي فوري من فرع السالمية.',
    bestSellingItemAr: 'كاس نودلز دجاج كشتة EXB + كاس داينمايت روبيان',
    bestSellingItemEn: 'EXB Marina Chicken Noodles Cup + Dynamite Shrimp Walk-Cup',
  },
];

// -------------------------------------------------------------
// BRAND SUITABILITY & RECOMMENDATION MATRIX
// -------------------------------------------------------------

export const BRAND_SUITABILITY_MATRIX: BrandEventSuitability[] = [
  {
    brandKey: 'the-noodle-bar',
    nameAr: 'ذا نودل بار (The Noodle Bar)',
    nameEn: 'The Noodle Bar',
    suitabilityScore: 96,
    recommendedFor: ['mega_expo', 'hotel_popup', 'youth_sports'],
    strengthsAr: 'سرعة تحضير فائقة (< 2 دقيقة في أكواب نودلز)، هامش ربح مرتفع جداً (68%)، نفايات صفرية تقريباً، وعلامة عصرية محبوبة للشباب في المعارض.',
    strengthsEn: 'Ultra-fast preparation (<2 min in takeaway cups), high gross margin (68%), minimal food waste, trendy youth appeal in high-density expos.',
    topEventItems: ['Chicken Noodles Cup', 'Dynamite Shrimp Cup', 'Crispy Beef Bao Buns'],
    recommendedCombinations: ['Karak Cafeteria', "Frank's"],
    historicalRoiPercent: 81.2,
  },
  {
    brandKey: 'franks',
    nameAr: 'فرانكس (Frank\'s Handhelds & Burgers)',
    nameEn: 'Frank\'s',
    suitabilityScore: 94,
    recommendedFor: ['mega_expo', 'ministry_camp', 'youth_sports'],
    strengthsAr: 'سندويشات فيلي ستيك وبرجر مقسمة جاهزة للطلب السريع، إقبال شبابي وعائلي كثيف، وقيمة فاتورة مرتفعة (AOV > 5 د.ك).',
    strengthsEn: 'Famous Philly cheesesteaks and smash sliders with rapid assembly, wide consumer appeal, and high average ticket value.',
    topEventItems: ['Orig. Philly CheeseSteak', 'Smashed Double Cheeseburger', 'Loaded Truffle Beef Fries'],
    recommendedCombinations: ['The Noodle Bar', 'Karak Cafeteria'],
    historicalRoiPercent: 79.5,
  },
  {
    brandKey: 'tahina',
    nameAr: 'طحينة (Tahina Shawarma & Grills)',
    nameEn: 'Tahina',
    suitabilityScore: 92,
    recommendedFor: ['ministry_camp', 'mega_expo'],
    strengthsAr: 'الشاورما والصواني العربية تلائم 100% طبيعة المخيمات الشتوية والضباط والعائلات، حجم حصص مشبع وسهولة طلب بوكسات المشاركة.',
    strengthsEn: 'Shawarma and authentic Middle Eastern comfort food perfectly suited for Kuwait winter camps, officers gatherings, and family boxes.',
    topEventItems: ['Chicken Shawarma Box', 'Falafel & Halloumi Slider Trio', 'Beef Shawarma Platter'],
    recommendedCombinations: ['Karak Cafeteria', "Frank's"],
    historicalRoiPercent: 76.8,
  },
  {
    brandKey: 'karak-cafeteria',
    nameAr: 'كرك كافتيريا (Karak Cafeteria)',
    nameEn: 'Karak Cafeteria',
    suitabilityScore: 98,
    recommendedFor: ['mega_expo', 'ministry_camp', 'hotel_popup', 'seasonal', 'youth_sports'],
    strengthsAr: 'شريك ذهبي إلزامي في كل فعالية؛ هوامش ربح خيالية تتجاوز 75%، يحقق مبيعات متواصلة طوال ساعات النهار والمساء في أجواء الشتاء والمعارض.',
    strengthsEn: 'Mandatory cross-sell anchor across all Kuwait pop-ups; ultra-high profit margins (>75%), steady order volume day and night during cold months.',
    topEventItems: ['Chapati & Karak Box', 'Saffron & Cardamom Karak Flask (1L)', 'Mini Cheese Sambusa Platter'],
    recommendedCombinations: ['The Noodle Bar', 'Tahina', "Frank's"],
    historicalRoiPercent: 88.4,
  },
  {
    brandKey: 'farm-brown',
    nameAr: 'فارم براون (Farm Brown Artisanal & Healthy)',
    nameEn: 'Farm Brown',
    suitabilityScore: 84,
    recommendedFor: ['hotel_popup', 'ministry_camp'],
    strengthsAr: 'سلطات كينوا عضوية، عصائر طازجة، وسندويشات إفطار خفيفة، مثالية للمعارض الفندقية الراقية وبازارات الأزياء التي تطلب خيارات صحية وخفيفة.',
    strengthsEn: 'Organic bowls, cold pressed juices, and artisanal wraps designed for upscale hotel ballrooms and high-income health-conscious pop-ups.',
    topEventItems: ['Farm Brown Quinoa Protein Bowl', 'Avocado Toast Box', 'Cold-Pressed Green Glow Juice'],
    recommendedCombinations: ['Karak Cafeteria', 'The Noodle Bar'],
    historicalRoiPercent: 75.1,
  },
  {
    brandKey: 'china-garden',
    nameAr: 'تشاينا جاردن (China Garden Wok & Dimsum)',
    nameEn: 'China Garden',
    suitabilityScore: 86,
    recommendedFor: ['ministry_camp', 'mega_expo'],
    strengthsAr: 'وجبات أرز صيني سريعة وبوكسات دجاج حلو وحامض تناسب الوجبات العائلية الكبيرة في مخيمات الدفاع والداخلية.',
    strengthsEn: 'Fried rice boxes and Sweet & Sour chicken trays ideal for filling family meals and large military camp group orders.',
    topEventItems: ['Sweet & Sour Chicken Rice Box', 'Crispy Vegetable Spring Rolls', 'Beef Broccoli Rice Bowl'],
    recommendedCombinations: ['Tahina', 'Karak Cafeteria'],
    historicalRoiPercent: 74.3,
  },
]

// -------------------------------------------------------------
// RECOMMENDED HIGH-MARGIN EVENT MENU (12 GOLDEN ITEMS)
// -------------------------------------------------------------

export const GOLDEN_EVENT_MENU: EventMenuItem[] = [
  {
    id: 'EVT-MNU-01',
    nameAr: 'كوب نودلز الدجاج المقرمش (نودلز سريعة)',
    nameEn: 'Crispy Chicken Noodles Cup',
    brandAr: 'ذا نودل بار',
    brandEn: 'The Noodle Bar',
    brandKey: 'the-noodle-bar',
    categoryAr: 'نودلز وأكواب',
    categoryEn: 'Noodles & Cups',
    recipeCostKwd: 0.680,
    packagingCostKwd: 0.120,
    totalUnitCostKwd: 0.800,
    eventSellingPriceKwd: 2.500,
    unitMarginKwd: 1.700,
    marginPercent: 68.0,
    prepTimeMinutes: 1.8,
    dailyParLevelWeekday: 150,
    dailyParLevelWeekend: 350,
    wasteRisk: 'very_low',
    keyAllergensAr: 'غلوتين، صويا، سمسم',
    keyAllergensEn: 'Gluten, Soy, Sesame',
    specialCookingEquipment: 'سخان ماء مغلي / Induction Cooker',
  },
  {
    id: 'EVT-MNU-02',
    nameAr: 'سندويش فيلي تشيز ستيك الأصلي',
    nameEn: 'Orig. Philly CheeseSteak Sub',
    brandAr: 'فرانكس',
    brandEn: 'Frank\'s',
    brandKey: 'franks',
    categoryAr: 'سندويشات وبرجر',
    categoryEn: 'Sandwiches & Subs',
    recipeCostKwd: 0.980,
    packagingCostKwd: 0.140,
    totalUnitCostKwd: 1.120,
    eventSellingPriceKwd: 3.250,
    unitMarginKwd: 2.130,
    marginPercent: 65.5,
    prepTimeMinutes: 2.5,
    dailyParLevelWeekday: 120,
    dailyParLevelWeekend: 280,
    wasteRisk: 'low',
    keyAllergensAr: 'ألبان، غلوتين',
    keyAllergensEn: 'Dairy, Gluten',
    specialCookingEquipment: 'فلات جريل مسطح كهربائي / Flat Grill',
  },
  {
    id: 'EVT-MNU-03',
    nameAr: 'بوكس شاورما الدجاج ميني مع صوص طحينة والبطاطا',
    nameEn: 'Mini Chicken Shawarma Box & Fries',
    brandAr: 'طحينة',
    brandEn: 'Tahina',
    brandKey: 'tahina',
    categoryAr: 'شاورما ومقبلات',
    categoryEn: 'Shawarma & Platters',
    recipeCostKwd: 0.720,
    packagingCostKwd: 0.150,
    totalUnitCostKwd: 0.870,
    eventSellingPriceKwd: 2.750,
    unitMarginKwd: 1.880,
    marginPercent: 68.4,
    prepTimeMinutes: 2.0,
    dailyParLevelWeekday: 140,
    dailyParLevelWeekend: 320,
    wasteRisk: 'low',
    keyAllergensAr: 'سمسم (طحينة)، غلوتين',
    keyAllergensEn: 'Sesame, Gluten',
    specialCookingEquipment: 'شواية شاورما كهربائية / Shawarma Machine',
  },
  {
    id: 'EVT-MNU-04',
    nameAr: 'كوب ديناميت روبيان مقرمش صوص سبيشال',
    nameEn: 'Dynamite Crispy Shrimp Cup',
    brandAr: 'ذا نودل بار',
    brandEn: 'The Noodle Bar',
    brandKey: 'the-noodle-bar',
    categoryAr: 'مقبلات وسناكس',
    categoryEn: 'Appetizers & Snacks',
    recipeCostKwd: 0.850,
    packagingCostKwd: 0.130,
    totalUnitCostKwd: 0.980,
    eventSellingPriceKwd: 2.950,
    unitMarginKwd: 1.970,
    marginPercent: 66.8,
    prepTimeMinutes: 2.2,
    dailyParLevelWeekday: 90,
    dailyParLevelWeekend: 220,
    wasteRisk: 'low',
    keyAllergensAr: 'قشريات (روبيان)، بيض، سمسم',
    keyAllergensEn: 'Crustacean, Egg, Sesame',
    specialCookingEquipment: 'قلاية عميقة مزدوجة / Double Electric Fryer',
  },
  {
    id: 'EVT-MNU-05',
    nameAr: 'سماش دبل تشيز برجر فرانكس مع صوص سري',
    nameEn: 'Frank\'s Smashed Double Cheeseburger',
    brandAr: 'فرانكس',
    brandEn: 'Frank\'s',
    brandKey: 'franks',
    categoryAr: 'سندويشات وبرجر',
    categoryEn: 'Burgers',
    recipeCostKwd: 0.820,
    packagingCostKwd: 0.110,
    totalUnitCostKwd: 0.930,
    eventSellingPriceKwd: 2.650,
    unitMarginKwd: 1.720,
    marginPercent: 64.9,
    prepTimeMinutes: 2.4,
    dailyParLevelWeekday: 110,
    dailyParLevelWeekend: 260,
    wasteRisk: 'low',
    keyAllergensAr: 'ألبان، غلوتين',
    keyAllergensEn: 'Dairy, Gluten',
    specialCookingEquipment: 'فلات جريل صاج / Flat Top Grill',
  },
  {
    id: 'EVT-MNU-06',
    nameAr: 'سلطة كينوا فارم براون بالدجاج المشوي والأفوكادو',
    nameEn: 'Farm Brown Quinoa & Grilled Chicken Bowl',
    brandAr: 'فارم براون',
    brandEn: 'Farm Brown',
    brandKey: 'farm-brown',
    categoryAr: 'خيارات صحية وفندقية',
    categoryEn: 'Salads & Healthy Bowls',
    recipeCostKwd: 0.950,
    packagingCostKwd: 0.160,
    totalUnitCostKwd: 1.110,
    eventSellingPriceKwd: 3.500,
    unitMarginKwd: 2.390,
    marginPercent: 68.3,
    prepTimeMinutes: 1.5,
    dailyParLevelWeekday: 60,
    dailyParLevelWeekend: 140,
    wasteRisk: 'medium',
    keyAllergensAr: 'مكسرات خفيفة',
    keyAllergensEn: 'Tree Nuts',
    specialCookingEquipment: 'ثلاجة تحضير وسلطات باردة / Prep Chiller',
  },
  {
    id: 'EVT-MNU-07',
    nameAr: 'بوكس أرز تشاينا جاردن بالدجاج الحلو والحامض',
    nameEn: 'Sweet & Sour Chicken Fried Rice Box',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    brandKey: 'china-garden',
    categoryAr: 'أرز وصواني آسيوية',
    categoryEn: 'Rice & Wok Boxes',
    recipeCostKwd: 0.760,
    packagingCostKwd: 0.140,
    totalUnitCostKwd: 0.900,
    eventSellingPriceKwd: 2.750,
    unitMarginKwd: 1.850,
    marginPercent: 67.3,
    prepTimeMinutes: 2.0,
    dailyParLevelWeekday: 100,
    dailyParLevelWeekend: 240,
    wasteRisk: 'very_low',
    keyAllergensAr: 'صويا، غلوتين',
    keyAllergensEn: 'Soy, Gluten',
    specialCookingEquipment: 'سخان طعام ماريماري / Bain Marie Warmer',
  },
  {
    id: 'EVT-MNU-08',
    nameAr: 'بوكس شاباتي حار وجبن + كرك زعفران مميز',
    nameEn: 'Fresh Chapati Cheese Box & Saffron Karak',
    brandAr: 'كرك كافتيريا',
    brandEn: 'Karak Cafeteria',
    brandKey: 'karak-cafeteria',
    categoryAr: 'شاي ومخبوزات وسناكس',
    categoryEn: 'Bakery & Hot Drinks',
    recipeCostKwd: 0.280,
    packagingCostKwd: 0.090,
    totalUnitCostKwd: 0.370,
    eventSellingPriceKwd: 1.500,
    unitMarginKwd: 1.130,
    marginPercent: 75.3,
    prepTimeMinutes: 1.2,
    dailyParLevelWeekday: 220,
    dailyParLevelWeekend: 500,
    wasteRisk: 'very_low',
    keyAllergensAr: 'ألبان، غلوتين',
    keyAllergensEn: 'Dairy, Gluten',
    specialCookingEquipment: 'صاج شاباتي + سخان كرك كهربائي / Karak Warmer',
  },
  {
    id: 'EVT-MNU-09',
    nameAr: 'بطاطا مقرمشة مغطاة بلحم التروفل والجبن الذائب',
    nameEn: 'Loaded Truffle Beef & Cheddar Fries',
    brandAr: 'فرانكس',
    brandEn: 'Frank\'s',
    brandKey: 'franks',
    categoryAr: 'مقبلات وسناكس',
    categoryEn: 'Loaded Sides',
    recipeCostKwd: 0.520,
    packagingCostKwd: 0.100,
    totalUnitCostKwd: 0.620,
    eventSellingPriceKwd: 1.950,
    unitMarginKwd: 1.330,
    marginPercent: 68.2,
    prepTimeMinutes: 2.0,
    dailyParLevelWeekday: 120,
    dailyParLevelWeekend: 280,
    wasteRisk: 'very_low',
    keyAllergensAr: 'ألبان',
    keyAllergensEn: 'Dairy',
    specialCookingEquipment: 'قلاية بطاطا / Electric Fryer',
  },
  {
    id: 'EVT-MNU-10',
    nameAr: 'ترمس كرك فنتشر فودز العائلي الفاخر (1 لتر سفري)',
    nameEn: 'Family Karak Stainless Thermos (1L Dispenser)',
    brandAr: 'كرك كافتيريا',
    brandEn: 'Karak Cafeteria',
    brandKey: 'karak-cafeteria',
    categoryAr: 'مشروبات دافئة وسفري',
    categoryEn: 'Hot Flasks & Sharing',
    recipeCostKwd: 0.650,
    packagingCostKwd: 0.350,
    totalUnitCostKwd: 1.000,
    eventSellingPriceKwd: 3.500,
    unitMarginKwd: 2.500,
    marginPercent: 71.4,
    prepTimeMinutes: 1.0,
    dailyParLevelWeekday: 45,
    dailyParLevelWeekend: 120,
    wasteRisk: 'very_low',
    keyAllergensAr: 'ألبان، حبهان، زعفران',
    keyAllergensEn: 'Dairy, Cardamom, Saffron',
    specialCookingEquipment: 'سخان شاي كبير / Large Tea Urn',
  },
  {
    id: 'EVT-MNU-11',
    nameAr: 'باو لحم بقري كريسبي مع صوص هويسين الآسيوي',
    nameEn: 'Crispy Beef Hoisin Bao Buns (2 Pcs)',
    brandAr: 'ذا نودل بار',
    brandEn: 'The Noodle Bar',
    brandKey: 'the-noodle-bar',
    categoryAr: 'باو ومخبوزات على البخار',
    categoryEn: 'Steamed Bao',
    recipeCostKwd: 0.740,
    packagingCostKwd: 0.120,
    totalUnitCostKwd: 0.860,
    eventSellingPriceKwd: 2.600,
    unitMarginKwd: 1.740,
    marginPercent: 66.9,
    prepTimeMinutes: 2.0,
    dailyParLevelWeekday: 80,
    dailyParLevelWeekend: 180,
    wasteRisk: 'low',
    keyAllergensAr: 'غلوتين، صويا',
    keyAllergensEn: 'Gluten, Soy',
    specialCookingEquipment: 'قدر تبخير بامبو كهربائي / Bamboo Steamer',
  },
  {
    id: 'EVT-MNU-12',
    nameAr: 'ثلاثي سلايدرز الفلافل والحلوم المشوي مع صوص الطحينة',
    nameEn: 'Falafel & Grilled Halloumi Slider Trio',
    brandAr: 'طحينة',
    brandEn: 'Tahina',
    brandKey: 'tahina',
    categoryAr: 'سلايدرز وسندويشات خفيفة',
    categoryEn: 'Sliders',
    recipeCostKwd: 0.480,
    packagingCostKwd: 0.120,
    totalUnitCostKwd: 0.600,
    eventSellingPriceKwd: 2.250,
    unitMarginKwd: 1.650,
    marginPercent: 73.3,
    prepTimeMinutes: 1.8,
    dailyParLevelWeekday: 90,
    dailyParLevelWeekend: 210,
    wasteRisk: 'very_low',
    keyAllergensAr: 'ألبان، سمسم، غلوتين',
    keyAllergensEn: 'Dairy, Sesame, Gluten',
    specialCookingEquipment: 'جريل كهربائي / Electric Grill',
  },
]

// -------------------------------------------------------------
// 4-PHASE PROJECT MANAGEMENT WORKFLOW
// -------------------------------------------------------------

export const DEFAULT_EVENT_PROJECT_TASKS: ProjectTaskItem[] = [
  // Phase 1: Contracting & Permits (-30 to -14 days)
  {
    id: 'TSK-P1-01',
    phaseNumber: 1,
    titleAr: 'مراجعة وتوقيع عقد إيجار البوث والموقع وسداد الدفعة الأولى',
    titleEn: 'Review & Sign Booth Space Agreement and Issue Initial Deposit',
    assignee: 'Abdullah Abdulghafar',
    roleAr: 'أمين السر العام والشؤون القانونية',
    roleEn: 'Executive Secretary & Legal',
    daysOffset: '-30 days',
    dueDate: '2026-10-01',
    status: 'completed',
    requiredDocumentAr: 'عقد استئجار معتمد + إشعار تحويل البنك',
    requiredDocumentEn: 'Signed Lease Agreement + Bank Wire Confirmation',
  },
  {
    id: 'TSK-P1-02',
    phaseNumber: 1,
    titleAr: 'إصدار كفالة/شيك التأمين المسترد وتوثيقه محاسبياً على حساب 110400',
    titleEn: 'Issue Refundable Security Deposit Check & Post to Account 110400',
    assignee: 'Hesham (Financial Controller)',
    roleAr: 'مدير الحسابات والرقابة المالية',
    roleEn: 'Finance Controller',
    daysOffset: '-25 days',
    dueDate: '2026-10-05',
    status: 'completed',
    requiredDocumentAr: 'سند صرف تأمين + صورة شيك الضمان',
    requiredDocumentEn: 'Security Deposit Voucher + Check Copy',
  },
  {
    id: 'TSK-P1-03',
    phaseNumber: 1,
    titleAr: 'استخراج ترخيص بلدية الكويت المؤقت للمطاعم والفعاليات',
    titleEn: 'Obtain Kuwait Municipality Temporary Food & Event Permit',
    assignee: 'PRO Operations Officer',
    roleAr: 'مندوب الشؤون الحكومية والتراخيص',
    roleEn: 'Government Relations Officer',
    daysOffset: '-20 days',
    dueDate: '2026-10-10',
    status: 'completed',
    requiredDocumentAr: 'شهادة ترخيص البلدية المؤقتة السارية',
    requiredDocumentEn: 'Valid Baladiya Temporary Event Permit',
  },
  {
    id: 'TSK-P1-04',
    phaseNumber: 1,
    titleAr: 'فحص سريان كروت الصحة البلدية لجميع طاقم الفعالية (100% كروت سارية)',
    titleEn: 'Audit Baladiya Health Cards for 100% of Event Staff Roster',
    assignee: 'HR Compliance Officer',
    roleAr: 'مسؤول الامتثال والموارد البشرية',
    roleEn: 'HR Compliance Officer',
    daysOffset: '-15 days',
    dueDate: '2026-10-15',
    status: 'completed',
    requiredDocumentAr: 'سجل تدقيق كروت الصحة للموظفين الـ 12',
    requiredDocumentEn: 'Staff Health Cards Audit Roster',
  },

  // Phase 2: Engineering & Logistics (-7 to -3 days)
  {
    id: 'TSK-P2-01',
    phaseNumber: 2,
    titleAr: 'اعتماد مخطط ديكور البوث (3D Fit-out) والشاشات المضيئة واللوحات',
    titleEn: 'Approve 3D Booth Fit-Out, Backlit Menus & Signage Specs',
    assignee: 'Brand Marketing & Operations Lead',
    roleAr: 'مدير التسويق والعمليات',
    roleEn: 'Marketing & Ops Lead',
    daysOffset: '-7 days',
    dueDate: '2026-10-17',
    status: 'completed',
    requiredDocumentAr: 'مخطط الديكور الهندسي المعتمد',
    requiredDocumentEn: 'Approved 3D Booth Schematic',
  },
  {
    id: 'TSK-P2-02',
    phaseNumber: 2,
    titleAr: 'فحص الأحمال الكهربائية والكابلات مع إدارة المعرض (توفير 3-Phase 32A)',
    titleEn: 'Verify Power Distribution & 3-Phase 32A Connection with Venue',
    assignee: 'Maintenance & Facility Lead',
    roleAr: 'مسؤول الصيانة والخدمات اللوجستية',
    roleEn: 'Maintenance Supervisor',
    daysOffset: '-5 days',
    dueDate: '2026-10-19',
    status: 'completed',
    requiredDocumentAr: 'محضر فحص التمديدات الكهربائية والسلامة',
    requiredDocumentEn: 'Electrical Load & Safety Clearance',
  },
  {
    id: 'TSK-P2-03',
    phaseNumber: 2,
    titleAr: 'نقل وتركيب المعدات (شواية الشاورما، الفريزر، القلايات، وماكينات الكرك)',
    titleEn: 'Transport & Install Cooking Assets (Shawarma Grill, Fryers, Warmers)',
    assignee: 'Logistics Fleet Team',
    roleAr: 'فريق الحركة والنقل المركزي',
    roleEn: 'Central Transport Fleet',
    daysOffset: '-4 days',
    dueDate: '2026-10-20',
    status: 'completed',
    requiredDocumentAr: 'سند إذن خروج أصول ومعدات من القرين',
    requiredDocumentEn: 'Asset Dispatch Gate Pass from Al-Qurain',
  },
  {
    id: 'TSK-P2-04',
    phaseNumber: 2,
    titleAr: 'تجهيز وبرمجة أجهزة الكاشير /pos والـ K-Net وراوتر الـ 5G المتنقل',
    titleEn: 'Configure & Test POS Hub, K-Net Terminals & Backup 5G Router',
    assignee: 'IT & POS Systems Specialist',
    roleAr: 'أخصائي تكنولوجيا المعلومات ونقاط البيع',
    roleEn: 'IT & POS Specialist',
    daysOffset: '-3 days',
    dueDate: '2026-10-21',
    status: 'completed',
    requiredDocumentAr: 'تقرير اختبار شبكة الدفع والربط المالي',
    requiredDocumentEn: 'Payment Gateway Connectivity Test Log',
  },

  // Phase 3: Daily Operations & Replenishment (During Event)
  {
    id: 'TSK-P3-01',
    phaseNumber: 3,
    titleAr: 'شحنة التزويد الصباحية (10:00 ص) بسيارة البراد من المطبخ المركزي بالقرين',
    titleEn: 'Morning Stock Replenishment (10:00 AM) via Al-Qurain Chiller Van',
    assignee: 'Al-Qurain Central Kitchen Dispatcher',
    roleAr: 'مسؤول تسليم المطبخ المركزي',
    roleEn: 'Central Kitchen Dispatcher',
    daysOffset: 'Daily 10:00 AM',
    dueDate: 'Ongoing',
    status: 'in_progress',
    requiredDocumentAr: 'مانيفيست تسليم بضاعة ومواد غذائية PP03*',
    requiredDocumentEn: 'Food Delivery Transfer Manifest PP03*',
  },
  {
    id: 'TSK-P3-02',
    phaseNumber: 3,
    titleAr: 'فحص درجات حرارة الثلاجات والمواد الأولية مرتين يومياً (< 4°C)',
    titleEn: 'Log Cold Storage Temperatures Twice Daily (< 4°C HACCP Check)',
    assignee: 'Event Quality Officer',
    roleAr: 'مراقب الجودة وسلامة الغذاء',
    roleEn: 'Food Safety Officer',
    daysOffset: 'Daily 12:00 PM & 6:00 PM',
    dueDate: 'Ongoing',
    status: 'in_progress',
    requiredDocumentAr: 'سجل درجات الحرارة والهاسب الميداني',
    requiredDocumentEn: 'HACCP Daily Temperature Sheet',
  },
  {
    id: 'TSK-P3-03',
    phaseNumber: 3,
    titleAr: 'الإغلاق اليومي للصندوق والـ Z-Report ومطابقة رول الكي نت والإيداع الآمن',
    titleEn: 'Daily Shift Close, Z-Report Generation & K-Net Terminal Audit',
    assignee: 'Head Cashier / Supervisor',
    roleAr: 'مشرف الكاشير وإدارة المعرض',
    roleEn: 'Event Shift Supervisor',
    daysOffset: 'Daily 11:30 PM',
    dueDate: 'Ongoing',
    status: 'in_progress',
    requiredDocumentAr: 'شريط تقرير Z + كشف مطابقة الكي نت والمصروفات',
    requiredDocumentEn: 'Z-Report Slip + K-Net Batch Settlement',
  },

  // Phase 4: Teardown, Stock Return & Financial Close (+1 to +5 days)
  {
    id: 'TSK-P4-01',
    phaseNumber: 4,
    titleAr: 'جرد البضائع المتبقية وإرجاع الصالح لمستودع القرين المركزي (RW01/PI02)',
    titleEn: 'Physical Stock Count & Return Remaining Goods to Al-Qurain Hub',
    assignee: 'Inventory Lead & Storekeeper',
    roleAr: 'مسؤول المخازن والجرد',
    roleEn: 'Inventory Supervisor',
    daysOffset: '+1 day',
    dueDate: '2026-11-03',
    status: 'completed',
    requiredDocumentAr: 'محضر إرجاع بضاعة ومواد لمستودع القرين',
    requiredDocumentEn: 'Stock Return Inspection Voucher',
  },
  {
    id: 'TSK-P4-02',
    phaseNumber: 4,
    titleAr: 'تفكيك البوث وشحن المعدات الثابتة وإجراء الصيانة الوقائية الفورية',
    titleEn: 'Dismantle Booth, Haul Assets & Perform Preventive Maintenance',
    assignee: 'Facilities & Logistics Team',
    roleAr: 'فريق الحركة والصيانة',
    roleEn: 'Facilities Logistics',
    daysOffset: '+2 days',
    dueDate: '2026-11-04',
    status: 'completed',
    requiredDocumentAr: 'محضر استلام المعدات والأصول بحالة سليمة',
    requiredDocumentEn: 'Asset Receipt & Maintenance Signoff',
  },
  {
    id: 'TSK-P4-03',
    phaseNumber: 4,
    titleAr: 'استلام كتاب إخلاء الطرف الرسمي من إدارة المعرض/المخيم',
    titleEn: 'Obtain Official Venue Site Clearance & Handover Sign-off',
    assignee: 'Abdullah Abdulghafar',
    roleAr: 'أمين السر العام والشؤون القانونية',
    roleEn: 'Executive Secretary & Legal',
    daysOffset: '+3 days',
    dueDate: '2026-11-05',
    status: 'completed',
    requiredDocumentAr: 'كتاب براءة الذمة وإخلاء طرف الموقع',
    requiredDocumentEn: 'Official Venue Clearance Letter',
  },
  {
    id: 'TSK-P4-04',
    phaseNumber: 4,
    titleAr: 'استرداد مبلغ التأمين المسترد وتغذية الحساب البنكي وإقفال مركز التكلفة',
    titleEn: 'Collect Security Deposit Refund, Reconcile P&L & Close Cost Center',
    assignee: 'Hesham (Financial Controller)',
    roleAr: 'مدير الحسابات والرقابة المالية',
    roleEn: 'Finance Controller',
    daysOffset: '+5 days',
    dueDate: '2026-11-07',
    status: 'completed',
    requiredDocumentAr: 'إشعار استرداد التأمين + القيد المحاسبي الختامي',
    requiredDocumentEn: 'Deposit Refund Receipt + Closing Journal Entry',
  },
]

// -------------------------------------------------------------
// CENTRAL KITCHEN QUOTA & INVENTORY
// -------------------------------------------------------------

export const CENTRAL_KITCHEN_EVENT_QUOTAS: CentralKitchenPrepQuota[] = [
  {
    itemCode: 'PP03-NDL-PREP',
    nameAr: 'نودلز مسلوقة ومتبلة مسبقاً (جاهزة للتقليب)',
    nameEn: 'Pre-Cooked & Seasoned Egg Noodles',
    unit: 'كجم (KG)',
    weekdayParLevel: 40,
    weekendParLevel: 90,
    morningDispatchTime: '09:30 AM',
    eveningDispatchTime: '04:00 PM',
    tempRequirement: 'درجة حرارة 2°C إلى 4°C',
    shelfLifeHours: 24,
  },
  {
    itemCode: 'PP03-CHK-MARIN',
    nameAr: 'شاورما دجاج متبلة وجاهزة للسيخ (خلطة فنتشر السرية)',
    nameEn: 'Marinated Shawarma Chicken Skewers',
    unit: 'كجم (KG)',
    weekdayParLevel: 50,
    weekendParLevel: 120,
    morningDispatchTime: '09:00 AM',
    eveningDispatchTime: '03:30 PM',
    tempRequirement: 'درجة حرارة 1°C إلى 3°C',
    shelfLifeHours: 36,
  },
  {
    itemCode: 'PP03-STK-SLICED',
    nameAr: 'شرائح لحم ريب آي فيلي ستيك رفيعة متبلة',
    nameEn: 'Thinly Sliced Ribeye Philly Steak',
    unit: 'كجم (KG)',
    weekdayParLevel: 30,
    weekendParLevel: 75,
    morningDispatchTime: '09:30 AM',
    eveningDispatchTime: '04:00 PM',
    tempRequirement: 'درجة حرارة 1°C إلى 3°C',
    shelfLifeHours: 24,
  },
  {
    itemCode: 'PP03-KRK-BASE',
    nameAr: 'مركز شاي الكرك المخمر بالزعفران والهيل المركز',
    nameEn: 'Concentrated Saffron & Cardamom Karak Base',
    unit: 'لتر (L)',
    weekdayParLevel: 60,
    weekendParLevel: 150,
    morningDispatchTime: '09:00 AM',
    eveningDispatchTime: '03:30 PM',
    tempRequirement: 'درجة حرارة 4°C',
    shelfLifeHours: 48,
  },
  {
    itemCode: 'PI02-CUP-NDL-500',
    nameAr: 'أكواب نودلز حرارية سريعة مع الشوكة والغطاء',
    nameEn: 'Heat-Resistant Noodle Takeaway Cups + Lid',
    unit: 'كرتون (500 حبة)',
    weekdayParLevel: 1,
    weekendParLevel: 3,
    morningDispatchTime: '10:00 AM',
    eveningDispatchTime: 'حسب الطلب',
    tempRequirement: 'جاف ومعقم',
    shelfLifeHours: 8760,
  },
  {
    itemCode: 'PI02-BX-SHW-M',
    nameAr: 'علب وجبات الشاورما الورقية المقواة المقاومة للزيوت',
    nameEn: 'Grease-Resistant Shawarma Boxes Medium',
    unit: 'كرتون (300 حبة)',
    weekdayParLevel: 1,
    weekendParLevel: 3,
    morningDispatchTime: '10:00 AM',
    eveningDispatchTime: 'حسب الطلب',
    tempRequirement: 'جاف ومعقم',
    shelfLifeHours: 8760,
  },
]

// -------------------------------------------------------------
// EVENT EQUIPMENT & ASSETS
// -------------------------------------------------------------

export const EVENT_EQUIPMENT_ROSTER: EquipmentChecklistItem[] = [
  {
    id: 'EQ-01',
    nameAr: 'ثلاجة عرض مشروبات وحلويات زجاجية متنقلة',
    nameEn: 'Mobile Display Upright Drink Chiller',
    category: 'refrigeration',
    assetCode: 'AST-REF-204',
    assignedSourceWarehouse: 'مستودع القرين المركزي للأصول',
    condition: 'excellent',
    powerWattage: '1200W (Single Phase 220V)',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-02',
    nameAr: 'فريزر صندوقي متنقل للمجمدات والآيس كريم',
    nameEn: 'Mobile Chest Storage Deep Freezer',
    category: 'refrigeration',
    assetCode: 'AST-FRZ-108',
    assignedSourceWarehouse: 'مستودع القرين المركزي للأصول',
    condition: 'excellent',
    powerWattage: '1500W (Single Phase 220V)',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-03',
    nameAr: 'شواية شاورما كهربائية عمودية متنقلة 4 شمعات',
    nameEn: 'Commercial 4-Burner Electric Shawarma Machine',
    category: 'cooking',
    assetCode: 'AST-SHW-015',
    assignedSourceWarehouse: 'المطبخ المركزي - معدات الفعاليات',
    condition: 'excellent',
    powerWattage: '4500W (3-Phase 380V)',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-04',
    nameAr: 'قلاية عميقة مزدوجة كهربائية 2x8 لتر للبطاطا والروبيان',
    nameEn: 'Double Electric Deep Fryer 2x8L',
    category: 'cooking',
    assetCode: 'AST-FRY-022',
    assignedSourceWarehouse: 'المطبخ المركزي - معدات الفعاليات',
    condition: 'good',
    powerWattage: '3600W (Single Phase 220V)',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-05',
    nameAr: 'فلات جريل صاج كهربائي للبرجر وسندويشات فيلي ستيك',
    nameEn: 'Electric Flat-Top Griddle for Sliders & Subs',
    category: 'cooking',
    assetCode: 'AST-GRL-031',
    assignedSourceWarehouse: 'المطبخ المركزي - معدات الفعاليات',
    condition: 'excellent',
    powerWattage: '3000W (Single Phase 220V)',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-06',
    nameAr: 'سخان شاي كرك وبان ماري ستانلس ستيل كبير 25 لتر',
    nameEn: 'Commercial Stainless Steel Karak Warmer 25L',
    category: 'cooking',
    assetCode: 'AST-KRK-009',
    assignedSourceWarehouse: 'فرع كرك كافتيريا - أصول الفعاليات',
    condition: 'excellent',
    powerWattage: '1800W (Single Phase 220V)',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-07',
    nameAr: 'محطة كاشير متكاملة (شاشة لمس POS + طابعة فواتير)',
    nameEn: 'Integrated Touch POS Terminal + Thermal Printer',
    category: 'pos_it',
    assetCode: 'AST-POS-104',
    assignedSourceWarehouse: 'مستودع تقنية المعلومات - المقر الرئيسي',
    condition: 'excellent',
    powerWattage: '250W',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-08',
    nameAr: 'جهاز شبكة كي نت متنقل NBK K-Net 4G Wireless Terminal',
    nameEn: 'NBK Mobile K-Net Wireless Payment Terminal',
    category: 'pos_it',
    assetCode: 'AST-KNET-042',
    assignedSourceWarehouse: 'الإدارة المالية - حساب بنك الكويت الوطني',
    condition: 'excellent',
    powerWattage: 'Battery + 15W Charger',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
  {
    id: 'EQ-09',
    nameAr: 'طفاية حريق بودرة كيميائية 6 كجم معتمدة من الإطفاء KFSD',
    nameEn: 'KFSD Certified 6KG Dry Powder Fire Extinguisher',
    category: 'safety',
    assetCode: 'AST-SAF-011',
    assignedSourceWarehouse: 'مستودع السلامة والأمن الصناعي',
    condition: 'excellent',
    powerWattage: 'N/A',
    verifiedAtDispatch: true,
    verifiedAtReturn: true,
    returnStatus: 'returned_intact',
  },
]

// -------------------------------------------------------------
// EVENT STAFF ROSTER & BALADIYA HEALTH CARD VALIDATION
// -------------------------------------------------------------

export const EVENT_STAFF_ROSTER: StaffRosterMember[] = [
  {
    id: 'STF-01',
    name: 'Mohamed Rafiq',
    roleAr: 'طاهي رئيسي ومشرف كيتشن المعرض',
    roleEn: 'Event Head Chef & Kitchen Supervisor',
    civilId: '289041203491',
    originBranchAr: 'المطبخ المركزي بالقرين',
    originBranchEn: 'Al-Qurain Central Kitchen',
    baladiyaHealthCardNo: 'BAL-HC-89412',
    baladiyaExpiryDate: '2027-05-14',
    isHealthCardValid: true,
    dailyShiftHours: 10,
    overtimeRateHourlyKwd: 2.250,
    assignedStation: 'محطة الشاورما والنودلز السريعة',
  },
  {
    id: 'STF-02',
    name: 'Kashif Mehmood',
    roleAr: 'معلم شواية وفلات جريل',
    roleEn: 'Grill & Flat-Top Cook',
    civilId: '292071802914',
    originBranchAr: 'فرع فرانكس - السالمية',
    originBranchEn: 'Frank\'s Salmiya Branch',
    baladiyaHealthCardNo: 'BAL-HC-77319',
    baladiyaExpiryDate: '2027-04-20',
    isHealthCardValid: true,
    dailyShiftHours: 9,
    overtimeRateHourlyKwd: 1.950,
    assignedStation: 'محطة فيلي ستيك والبرجر',
  },
  {
    id: 'STF-03',
    name: 'Suresh Kumar',
    roleAr: 'باريستا كرك ومعلم شاباتي',
    roleEn: 'Karak Barista & Chapati Baker',
    civilId: '286121401823',
    originBranchAr: 'فرع كرك كافتيريا - حولي',
    originBranchEn: 'Karak Cafeteria Hawally',
    baladiyaHealthCardNo: 'BAL-HC-65201',
    baladiyaExpiryDate: '2027-08-30',
    isHealthCardValid: true,
    dailyShiftHours: 9,
    overtimeRateHourlyKwd: 1.800,
    assignedStation: 'محطة الكرك والشاباتي الساخن',
  },
  {
    id: 'STF-04',
    name: 'Ahmed El-Sayed',
    roleAr: 'كاشير رئيسي ومشرف نقطة البيع والتحصيل',
    roleEn: 'Lead Cashier & Terminal Supervisor',
    civilId: '295031104829',
    originBranchAr: 'فرع طحينة - العارضية الحرفية',
    originBranchEn: 'Tahina Ardiya Branch',
    baladiyaHealthCardNo: 'BAL-HC-90145',
    baladiyaExpiryDate: '2027-03-12',
    isHealthCardValid: true,
    dailyShiftHours: 9,
    overtimeRateHourlyKwd: 2.000,
    assignedStation: 'شاشة الكاشير K-Net / POS',
  },
  {
    id: 'STF-05',
    name: 'Al-Amin Hossein',
    roleAr: 'مساعد تجهيز وتغليف طلبات',
    roleEn: 'Food Packager & Runner',
    civilId: '298101502118',
    originBranchAr: 'المطبخ المركزي بالقرين',
    originBranchEn: 'Al-Qurain Central Kitchen',
    baladiyaHealthCardNo: 'BAL-HC-54189',
    baladiyaExpiryDate: '2027-01-18',
    isHealthCardValid: true,
    dailyShiftHours: 9,
    overtimeRateHourlyKwd: 1.650,
    assignedStation: 'محطة التجميع والتسليم السريع',
  },
  {
    id: 'STF-06',
    name: 'Rowell Bautista',
    roleAr: 'مراقب جودة ونظافة وسلامة الغذاء HACCP',
    roleEn: 'Quality, Sanitation & HACCP Monitor',
    civilId: '291081903417',
    originBranchAr: 'قسم الجودة المركزي',
    originBranchEn: 'Central QA Department',
    baladiyaHealthCardNo: 'BAL-HC-92304',
    baladiyaExpiryDate: '2027-06-25',
    isHealthCardValid: true,
    dailyShiftHours: 8,
    overtimeRateHourlyKwd: 2.100,
    assignedStation: 'مراقبة درجات الحرارة والامتثال الصحي',
  },
]

// -------------------------------------------------------------
// BREAK-EVEN SIMULATION CALCULATOR
// -------------------------------------------------------------

export function calculateBreakEven(input: BreakEvenSimulationInput): BreakEvenSimulationResult {
  const totalLaborCostKwd = input.staffCount * input.dailyWagePerStaffKwd * input.daysCount
  const totalPreOpeningCostsKwd = input.boothRentKwd + input.fitoutSignageKwd + input.permitsTransportKwd
  const totalFixedCostsKwd = totalPreOpeningCostsKwd + totalLaborCostKwd + (input.dailyOtherFixedCostKwd * input.daysCount)
  const dailyFixedCostKwd = input.daysCount > 0 ? totalFixedCostsKwd / input.daysCount : 0

  // Contribution margin = Selling Price * (1 - COGS%)
  const contributionMarginPercent = 100 - input.estimatedCogsPercent
  const contributionMarginPerOrderKwd = input.expectedAovKwd * (contributionMarginPercent / 100)

  // Break-even orders = Total Fixed Costs / Margin per Order
  const totalBreakEvenOrders = contributionMarginPerOrderKwd > 0
    ? Math.ceil(totalFixedCostsKwd / contributionMarginPerOrderKwd)
    : 0

  const dailyBreakEvenOrders = input.daysCount > 0 ? Math.ceil(totalBreakEvenOrders / input.daysCount) : 0
  const totalBreakEvenSalesKwd = totalBreakEvenOrders * input.expectedAovKwd
  const dailyBreakEvenSalesKwd = input.daysCount > 0 ? totalBreakEvenSalesKwd / input.daysCount : 0

  // Break-even day estimate based on daily sales velocity
  const projectedBreakEvenDay = dailyBreakEvenSalesKwd > 0 && dailyFixedCostKwd > 0
    ? Math.min(input.daysCount, Math.ceil(totalPreOpeningCostsKwd / (dailyBreakEvenSalesKwd * (contributionMarginPercent / 100) - input.dailyWagePerStaffKwd * input.staffCount)))
    : Math.ceil(input.daysCount / 2)

  return {
    totalFixedCostsKwd,
    totalLaborCostKwd,
    totalPreOpeningCostsKwd,
    dailyFixedCostKwd,
    contributionMarginPercent,
    contributionMarginPerOrderKwd,
    totalBreakEvenSalesKwd,
    totalBreakEvenOrders,
    dailyBreakEvenOrders,
    dailyBreakEvenSalesKwd,
    projectedBreakEvenDay: Math.max(1, projectedBreakEvenDay),
    projectedNetProfitAtSales: (projectedTotalSalesKwd: number) => {
      const totalCogsKwd = projectedTotalSalesKwd * (input.estimatedCogsPercent / 100)
      const grossProfitKwd = projectedTotalSalesKwd - totalCogsKwd
      const netProfitKwd = grossProfitKwd - totalFixedCostsKwd
      const roiPercent = totalFixedCostsKwd > 0 ? (netProfitKwd / totalFixedCostsKwd) * 100 : 0
      const profitMarginPercent = projectedTotalSalesKwd > 0 ? (netProfitKwd / projectedTotalSalesKwd) * 100 : 0
      return {
        projectedRevenueKwd: projectedTotalSalesKwd,
        totalCogsKwd,
        grossProfitKwd,
        netProfitKwd,
        roiPercent,
        profitMarginPercent,
      }
    },
  }
}

// -------------------------------------------------------------
// EVENT RECOMMENDATION HELPER
// -------------------------------------------------------------

export function recommendBrandForEvent(
  eventType: EventType,
  expectedDailyVisitors: number,
  averageBudgetPerPerson: 'budget' | 'medium' | 'premium'
): {
  primaryBrands: string[]
  recommendedConceptAr: string
  recommendedConceptEn: string
  reasoningAr: string
  reasoningEn: string
  projectedAovKwd: number
  recommendedMenu: EventMenuItem[]
  suggestedBoothSqM: number
  recommendedStaffCount: number
} {
  switch (eventType) {
    case 'mega_expo':
      return {
        primaryBrands: ['The Noodle Bar', "Frank's", 'Karak Cafeteria'],
        recommendedConceptAr: 'ثلاثي الوجبات السريعة (Triple Grab & Go Concept): نودلز أكواب + برجر فيلي ستيك + شاي كرك',
        recommendedConceptEn: 'Triple Grab & Go Concept: Quick Noodle Cups + Philly Cheesesteak + Hot Karak & Chapati',
        reasoningAr: 'المعارض الضخمة مثل معرض العطور بمشرف تتطلب سرعة تسليم فائقة (< 2.5 دقيقة) وتدفق طلبات هائل في مساحة مدمجة، وأصناف الكرك والنودلز تحقق 68%+ هامش ربح دون الحاجة لتجهيزات معقدة.',
        reasoningEn: 'High footfall expos like Mishref Perfume Fair require sub-3-minute ticket velocity, compact takeaway containers, and high-margin staples.',
        projectedAovKwd: 4.880,
        recommendedMenu: GOLDEN_EVENT_MENU.filter((m) =>
          ['the-noodle-bar', 'franks', 'karak-cafeteria'].includes(m.brandKey)
        ),
        suggestedBoothSqM: 36,
        recommendedStaffCount: 8,
      }
    case 'ministry_camp':
      return {
        primaryBrands: ['Tahina', "Frank's", 'Karak Cafeteria'],
        recommendedConceptAr: 'مفهوم المخيم العائلي المتنوع: شاورما ومشاوي طحينة + سلايدرز فرانكس + ترامس الكرك الدافئة',
        recommendedConceptEn: 'Family & Officers Camp Hub: Tahina Shawarma & Grills + Frank’s Sliders + Hot Karak Thermoses',
        reasoningAr: 'مخيمات الدفاع والداخلية تستهدف العائلات والضباط ومجموعات الأصدقاء؛ الطلب يكون عائلياً ووجبات مشاركة وخدمة دافئة مريحة مع متوسط فاتورة مرتفع ومبيعات مستمرة لـ 30-45 يوماً.',
        reasoningEn: 'Defense and Interior camps feature family gatherings and group dining. High ticket size, sharing boxes, and winter warmers deliver strong long-term ROI.',
        projectedAovKwd: 5.300,
        recommendedMenu: GOLDEN_EVENT_MENU.filter((m) =>
          ['tahina', 'franks', 'karak-cafeteria', 'china-garden'].includes(m.brandKey)
        ),
        suggestedBoothSqM: 55,
        recommendedStaffCount: 11,
      }
    case 'hotel_popup':
      return {
        primaryBrands: ['The Noodle Bar', 'Farm Brown', 'Karak Cafeteria'],
        recommendedConceptAr: 'مفهوم البوتيك الفندقي الراقي: أطباق نودلز تروفل فاخرة + سلطات كينوا عضوية + مشروبات حرفية',
        recommendedConceptEn: 'Luxury Boutique Pop-Up: Truffle Beef Noodles + Organic Quinoa Bowls + Artisanal Karak',
        reasoningAr: 'رواد فنادق النخبة مثل فندق السفير يبحثون عن الجودة العالية، التقديم الأنيق، النظافة التامة، والمنتجات الصحية ذات القيمة المضافة العالية، ومتوسط الفاتورة يصل إلى 6.400 د.ك.',
        reasoningEn: 'Affluent hotel visitors prioritize pristine aesthetic presentation, minimal kitchen smoke/smell, and organic or gourmet options with superior price tolerance.',
        projectedAovKwd: 6.400,
        recommendedMenu: GOLDEN_EVENT_MENU.filter((m) =>
          ['the-noodle-bar', 'farm-brown', 'karak-cafeteria'].includes(m.brandKey)
        ),
        suggestedBoothSqM: 24,
        recommendedStaffCount: 5,
      }
    case 'youth_sports':
    case 'seasonal':
    default:
      return {
        primaryBrands: ["Frank's", 'The Noodle Bar', 'Karak Cafeteria'],
        recommendedConceptAr: 'المفهوم الشبابي الحيوي: برجر سماش وسلايدرز + نودلز ديناميت + بطاطا محملة ومشروبات مثلجة وساخنة',
        recommendedConceptEn: 'High-Energy Youth Hub: Smashed Burgers + Dynamite Noodles + Loaded Fries & Karak',
        reasoningAr: 'الفعاليات الشبابية ومواسم الشتاء تتطلب أغذية مريحة ومشبعة وسريعة التحضير وتناسب الحركة والاستهلاك المباشر أثناء متابعة الأنشطة.',
        reasoningEn: 'Fast-paced youth crowds crave comfort food, loaded fries, and grab-and-go boxes that are convenient to eat on the move.',
        projectedAovKwd: 5.100,
        recommendedMenu: GOLDEN_EVENT_MENU,
        suggestedBoothSqM: 40,
        recommendedStaffCount: 9,
      }
  }
}


// =============================================================
// OFFICIAL EXB MENUS (EXFB*, EXCG*, EXFR*, EXTH*, EXTNB*, EXKR*)
// Official Source: EXB Menu 6FB-11/2026 & Venture Foods Brand Menus
// =============================================================

export interface EXBMenuItem {
  code: string
  nameAr: string
  nameEn: string
  brandKey: string
  brandNameAr: string
  brandNameEn: string
  categoryAr: string
  categoryEn: string
  standardBranchPriceKwd: number
  previousExbPriceKwd: number
  recommendedExbPriceKwd: number
  foodPackagingCogsKwd: number
  prepTimeSeconds: number
  activeOnMenu: boolean
  isSpecialSpecialty?: boolean
  notes?: string
}

export const OFFICIAL_EXB_MENUS: EXBMenuItem[] = [
  // Farm Brown (EXB Menu 6FB-11/2026: EXFB0001 - EXFB0017)
  {
    code: 'EXFB0001',
    nameAr: 'سلطة كينوا فارم براون بالدجاج المشوي والفيتا',
    nameEn: 'Farm Brown Quinoa & Grilled Chicken Bowl',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'سلطات وبوكسات صحية',
    categoryEn: 'Healthy Bowls',
    standardBranchPriceKwd: 3.250,
    previousExbPriceKwd: 3.500,
    recommendedExbPriceKwd: 3.750,
    foodPackagingCogsKwd: 1.110,
    prepTimeSeconds: 90,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXFB0002',
    nameAr: 'توست بريوش الأفوكادو وجبنة الحلوم المشوية',
    nameEn: 'Avocado & Halloumi Brioche Toast',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'توست وساندويتشات',
    categoryEn: 'Toasts & Sandwiches',
    standardBranchPriceKwd: 2.250,
    previousExbPriceKwd: 2.500,
    recommendedExbPriceKwd: 2.750,
    foodPackagingCogsKwd: 0.720,
    prepTimeSeconds: 120,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0003',
    nameAr: 'كرواسون الديك الرومي المدخن وجبن إيمنتال',
    nameEn: 'Smoked Turkey & Emmental Croissant',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'مخبوزات وفطور سريع',
    categoryEn: 'Bakery & Breakfast',
    standardBranchPriceKwd: 1.950,
    previousExbPriceKwd: 2.200,
    recommendedExbPriceKwd: 2.450,
    foodPackagingCogsKwd: 0.650,
    prepTimeSeconds: 60,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0004',
    nameAr: 'سوبربول الآساي العضوي بالغرانولا والتوت البري',
    nameEn: 'Organic Acai Energy Superbowl',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'أساي وحلويات صحية',
    categoryEn: 'Acai & Desserts',
    standardBranchPriceKwd: 2.850,
    previousExbPriceKwd: 3.000,
    recommendedExbPriceKwd: 3.250,
    foodPackagingCogsKwd: 0.880,
    prepTimeSeconds: 75,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXFB0005',
    nameAr: 'عصير الديتوكس الأخضر المعصور على البارد',
    nameEn: 'Cold-Pressed Green Detox Elixir',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'مشروبات وعصائر طازجة',
    categoryEn: 'Cold Pressed Juices',
    standardBranchPriceKwd: 1.750,
    previousExbPriceKwd: 1.950,
    recommendedExbPriceKwd: 2.100,
    foodPackagingCogsKwd: 0.480,
    prepTimeSeconds: 30,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0006',
    nameAr: 'شوفان معتق باللبن الزبادي والتوت المشكل',
    nameEn: 'Overnight Oats & Wild Berries',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'أساي وحلويات صحية',
    categoryEn: 'Breakfast Cups',
    standardBranchPriceKwd: 1.650,
    previousExbPriceKwd: 1.850,
    recommendedExbPriceKwd: 1.950,
    foodPackagingCogsKwd: 0.420,
    prepTimeSeconds: 30,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0007',
    nameAr: 'سلطة سيزر الدجاج المشوي مع أوراق الكيل المقرمشة',
    nameEn: 'Grilled Chicken & Kale Caesar Bowl',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'سلطات وبوكسات صحية',
    categoryEn: 'Healthy Bowls',
    standardBranchPriceKwd: 2.950,
    previousExbPriceKwd: 3.200,
    recommendedExbPriceKwd: 3.500,
    foodPackagingCogsKwd: 0.950,
    prepTimeSeconds: 90,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0008',
    nameAr: 'توستي خبز الساوردو بفطر التروفل وجبنة الموزاريلا',
    nameEn: 'Truffle Mushroom Sourdough Toastie',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'توست وساندويتشات',
    categoryEn: 'Toasts & Sandwiches',
    standardBranchPriceKwd: 2.500,
    previousExbPriceKwd: 2.750,
    recommendedExbPriceKwd: 2.950,
    foodPackagingCogsKwd: 0.780,
    prepTimeSeconds: 110,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0009',
    nameAr: 'بارفيه اللبن اليوناني الحرفي بالعسل والجوز',
    nameEn: 'Artisanal Greek Yogurt & Honey Parfait',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'أساي وحلويات صحية',
    categoryEn: 'Breakfast Cups',
    standardBranchPriceKwd: 1.500,
    previousExbPriceKwd: 1.750,
    recommendedExbPriceKwd: 1.850,
    foodPackagingCogsKwd: 0.380,
    prepTimeSeconds: 30,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0010',
    nameAr: 'بودينغ بذور الشيا بالمانجو وحليب جوز الهند',
    nameEn: 'Chia Seed Mango Coconut Pudding',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'أساي وحلويات صحية',
    categoryEn: 'Breakfast Cups',
    standardBranchPriceKwd: 1.600,
    previousExbPriceKwd: 1.800,
    recommendedExbPriceKwd: 1.950,
    foodPackagingCogsKwd: 0.410,
    prepTimeSeconds: 30,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0011',
    nameAr: 'ماتشا لاتيه ياباني عضوي بحليب جوز الهند',
    nameEn: 'Organic Japanese Coconut Matcha Latte',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'مشروبات وعصائر طازجة',
    categoryEn: 'Specialty Beverages',
    standardBranchPriceKwd: 2.100,
    previousExbPriceKwd: 2.300,
    recommendedExbPriceKwd: 2.500,
    foodPackagingCogsKwd: 0.520,
    prepTimeSeconds: 60,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0012',
    nameAr: 'شيك بروتين الفانيليا العضوي مع زبدة اللوز',
    nameEn: 'Vanilla Whey Protein Power Shake',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'مشروبات وعصائر طازجة',
    categoryEn: 'Specialty Beverages',
    standardBranchPriceKwd: 2.250,
    previousExbPriceKwd: 2.500,
    recommendedExbPriceKwd: 2.750,
    foodPackagingCogsKwd: 0.650,
    prepTimeSeconds: 45,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0013',
    nameAr: 'سلطة الشمندر المشوي وجبن الماعز والجوز المحمص',
    nameEn: 'Roasted Beetroot & Goat Cheese Salad',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'سلطات وبوكسات صحية',
    categoryEn: 'Healthy Bowls',
    standardBranchPriceKwd: 2.750,
    previousExbPriceKwd: 3.000,
    recommendedExbPriceKwd: 3.250,
    foodPackagingCogsKwd: 0.820,
    prepTimeSeconds: 80,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0014',
    nameAr: 'شريحة كيك الموز واللوز الخالية من الغلوتين',
    nameEn: 'Gluten-Free Banana Almond Bread',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'مخبوزات وفطور سريع',
    categoryEn: 'Bakery & Breakfast',
    standardBranchPriceKwd: 1.250,
    previousExbPriceKwd: 1.400,
    recommendedExbPriceKwd: 1.500,
    foodPackagingCogsKwd: 0.280,
    prepTimeSeconds: 30,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0015',
    nameAr: 'قهوة كولد برو عضوية مقطرة ببطء',
    nameEn: 'Organic Slow-Drip Cold Brew',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'مشروبات وعصائر طازجة',
    categoryEn: 'Specialty Beverages',
    standardBranchPriceKwd: 1.850,
    previousExbPriceKwd: 2.000,
    recommendedExbPriceKwd: 2.250,
    foodPackagingCogsKwd: 0.390,
    prepTimeSeconds: 30,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0016',
    nameAr: 'بيغل السلمون المدخن وجبن الكريمة بالهيل',
    nameEn: 'Smoked Salmon & Herbed Cream Bagel',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'توست وساندويتشات',
    categoryEn: 'Toasts & Sandwiches',
    standardBranchPriceKwd: 3.100,
    previousExbPriceKwd: 3.350,
    recommendedExbPriceKwd: 3.650,
    foodPackagingCogsKwd: 1.050,
    prepTimeSeconds: 90,
    activeOnMenu: true,
  },
  {
    code: 'EXFB0017',
    nameAr: 'كرات تروفل الشوكولاتة الداكنة كيتو (3 قطع)',
    nameEn: 'Dark Chocolate Keto Protein Truffles (3 Pcs)',
    brandKey: 'farm-brown',
    brandNameAr: 'فارم براون',
    brandNameEn: 'Farm Brown',
    categoryAr: 'أساي وحلويات صحية',
    categoryEn: 'Acai & Desserts',
    standardBranchPriceKwd: 1.750,
    previousExbPriceKwd: 1.950,
    recommendedExbPriceKwd: 2.100,
    foodPackagingCogsKwd: 0.460,
    prepTimeSeconds: 30,
    activeOnMenu: true,
  },

  // Frank's (EXFR0001 - EXFR0006)
  {
    code: 'EXFR0001',
    nameAr: 'سندويش فيلي تشيز ستيك الأصلي فرانكس',
    nameEn: 'Frank\'s Orig. Philly CheeseSteak Sub',
    brandKey: 'franks',
    brandNameAr: 'فرانكس',
    brandNameEn: 'Frank\'s',
    categoryAr: 'سندويشات فيلي ستيك',
    categoryEn: 'Philly Subs',
    standardBranchPriceKwd: 2.950,
    previousExbPriceKwd: 3.250,
    recommendedExbPriceKwd: 3.500,
    foodPackagingCogsKwd: 1.120,
    prepTimeSeconds: 120,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXFR0002',
    nameAr: 'سماش دبل تشيز برجر فرانكس مع صوص سري',
    nameEn: 'Frank\'s Smashed Double Cheeseburger',
    brandKey: 'franks',
    brandNameAr: 'فرانكس',
    brandNameEn: 'Frank\'s',
    categoryAr: 'سماش برجر',
    categoryEn: 'Smash Burgers',
    standardBranchPriceKwd: 2.450,
    previousExbPriceKwd: 2.650,
    recommendedExbPriceKwd: 2.850,
    foodPackagingCogsKwd: 0.930,
    prepTimeSeconds: 110,
    activeOnMenu: true,
  },
  {
    code: 'EXFR0003',
    nameAr: 'بطاطا مقرمشة محملة بلحم التروفل والجبن الذائب',
    nameEn: 'Loaded Truffle Beef & Cheddar Fries',
    brandKey: 'franks',
    brandNameAr: 'فرانكس',
    brandNameEn: 'Frank\'s',
    categoryAr: 'بطاطا ومقبلات محملة',
    categoryEn: 'Loaded Fries',
    standardBranchPriceKwd: 1.750,
    previousExbPriceKwd: 1.950,
    recommendedExbPriceKwd: 2.150,
    foodPackagingCogsKwd: 0.620,
    prepTimeSeconds: 90,
    activeOnMenu: true,
  },
  {
    code: 'EXFR0004',
    nameAr: 'تندرز دجاج ناشفيل الحار المقرمش (4 قطع)',
    nameEn: 'Nashville Crispy Hot Chicken Tenders (4 Pcs)',
    brandKey: 'franks',
    brandNameAr: 'فرانكس',
    brandNameEn: 'Frank\'s',
    categoryAr: 'دجاج مقلي ومقبلات',
    categoryEn: 'Crispy Chicken',
    standardBranchPriceKwd: 2.250,
    previousExbPriceKwd: 2.450,
    recommendedExbPriceKwd: 2.650,
    foodPackagingCogsKwd: 0.780,
    prepTimeSeconds: 90,
    activeOnMenu: true,
  },
  {
    code: 'EXFR0005',
    nameAr: 'هوت دوج سموك هاوس فرانكس بصوص الخردل والمخلل',
    nameEn: 'Frank\'s Smokehouse Angus Beef Hot Dog',
    brandKey: 'franks',
    brandNameAr: 'فرانكس',
    brandNameEn: 'Frank\'s',
    categoryAr: 'سندويشات فيلي ستيك',
    categoryEn: 'Hot Dogs',
    standardBranchPriceKwd: 1.850,
    previousExbPriceKwd: 2.100,
    recommendedExbPriceKwd: 2.250,
    foodPackagingCogsKwd: 0.580,
    prepTimeSeconds: 80,
    activeOnMenu: true,
  },

  // The Noodle Bar (EXTNB001 - EXTNB005)
  {
    code: 'EXTNB001',
    nameAr: 'كوب نودلز الدجاج المقرمش السريعة',
    nameEn: 'Crispy Chicken Noodles Takeaway Cup',
    brandKey: 'the-noodle-bar',
    brandNameAr: 'ذا نودل بار',
    brandNameEn: 'The Noodle Bar',
    categoryAr: 'أكواب نودلز سريعة',
    categoryEn: 'Noodle Cups',
    standardBranchPriceKwd: 2.250,
    previousExbPriceKwd: 2.500,
    recommendedExbPriceKwd: 2.750,
    foodPackagingCogsKwd: 0.800,
    prepTimeSeconds: 70,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXTNB002',
    nameAr: 'كوب ديناميت روبيان مقرمش صوص سبيشال',
    nameEn: 'Dynamite Crispy Shrimp Cup',
    brandKey: 'the-noodle-bar',
    brandNameAr: 'ذا نودل بار',
    brandNameEn: 'The Noodle Bar',
    categoryAr: 'مقبلات وسناكس سريعة',
    categoryEn: 'Appetizers',
    standardBranchPriceKwd: 2.650,
    previousExbPriceKwd: 2.950,
    recommendedExbPriceKwd: 3.250,
    foodPackagingCogsKwd: 0.980,
    prepTimeSeconds: 80,
    activeOnMenu: true,
  },
  {
    code: 'EXTNB003',
    nameAr: 'باو لحم بقري كريسبي مع صوص هويسين الآسيوي (2 حبة)',
    nameEn: 'Crispy Beef Hoisin Steamed Bao (2 Pcs)',
    brandKey: 'the-noodle-bar',
    brandNameAr: 'ذا نودل بار',
    brandNameEn: 'The Noodle Bar',
    categoryAr: 'باو ومخبوزات بخار',
    categoryEn: 'Steamed Bao',
    standardBranchPriceKwd: 2.350,
    previousExbPriceKwd: 2.600,
    recommendedExbPriceKwd: 2.800,
    foodPackagingCogsKwd: 0.860,
    prepTimeSeconds: 60,
    activeOnMenu: true,
  },
  {
    code: 'EXTNB004',
    nameAr: 'نودلز لحم التروفل الفاخرة بصلصة الفطر الأسود',
    nameEn: 'Luxury Truffle Beef Egg Noodles Bowl',
    brandKey: 'the-noodle-bar',
    brandNameAr: 'ذا نودل بار',
    brandNameEn: 'The Noodle Bar',
    categoryAr: 'أكواب نودلز سريعة',
    categoryEn: 'Noodle Cups',
    standardBranchPriceKwd: 3.250,
    previousExbPriceKwd: 3.600,
    recommendedExbPriceKwd: 3.950,
    foodPackagingCogsKwd: 1.150,
    prepTimeSeconds: 90,
    activeOnMenu: true,
  },

  // Tahina (EXTH0001 - EXTH0005)
  {
    code: 'EXTH0001',
    nameAr: 'بوكس شاورما دجاج ميني مع البطاطا وصوص الثومية',
    nameEn: 'Mini Chicken Shawarma Box & Garlic Fries',
    brandKey: 'tahina',
    brandNameAr: 'طحينة',
    brandNameEn: 'Tahina',
    categoryAr: 'بوكسات الشاورما',
    categoryEn: 'Shawarma Boxes',
    standardBranchPriceKwd: 2.450,
    previousExbPriceKwd: 2.750,
    recommendedExbPriceKwd: 2.950,
    foodPackagingCogsKwd: 0.870,
    prepTimeSeconds: 80,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXTH0002',
    nameAr: 'صينية شاورما لحم عجل بلدي فاخرة مع الخضار',
    nameEn: 'Premium Beef Shawarma Sharing Platter',
    brandKey: 'tahina',
    brandNameAr: 'طحينة',
    brandNameEn: 'Tahina',
    categoryAr: 'بوكسات الشاورما',
    categoryEn: 'Shawarma Platters',
    standardBranchPriceKwd: 3.500,
    previousExbPriceKwd: 3.900,
    recommendedExbPriceKwd: 4.250,
    foodPackagingCogsKwd: 1.250,
    prepTimeSeconds: 100,
    activeOnMenu: true,
  },
  {
    code: 'EXTH0003',
    nameAr: 'ثلاثي سلايدرز الفلافل والحلوم المشوي مع صوص الطحينة',
    nameEn: 'Falafel & Grilled Halloumi Slider Trio',
    brandKey: 'tahina',
    brandNameAr: 'طحينة',
    brandNameEn: 'Tahina',
    categoryAr: 'سلايدرز خفيفة',
    categoryEn: 'Sliders',
    standardBranchPriceKwd: 1.950,
    previousExbPriceKwd: 2.250,
    recommendedExbPriceKwd: 2.450,
    foodPackagingCogsKwd: 0.600,
    prepTimeSeconds: 60,
    activeOnMenu: true,
  },

  // China Garden (EXCG0001 - EXCG0009 - Marina Kashta No-Gas Walk & Eat Edition)
  {
    code: 'EXCG0001',
    nameAr: 'كاس نودلز دجاج كشتة EXB',
    nameEn: 'EXB Marina Chicken Noodles Cup',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'أكواب نودلز للمشي',
    categoryEn: 'Walk & Eat Noodle Cups',
    standardBranchPriceKwd: 2.000,
    previousExbPriceKwd: 2.100,
    recommendedExbPriceKwd: 2.250,
    foodPackagingCogsKwd: 0.420,
    prepTimeSeconds: 45,
    activeOnMenu: true,
  },
  {
    code: 'EXCG0002',
    nameAr: 'كاس نودلز خضار كشتة EXB',
    nameEn: 'EXB Marina Vegetable Noodles Cup',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'أكواب نودلز للمشي',
    categoryEn: 'Walk & Eat Noodle Cups',
    standardBranchPriceKwd: 1.750,
    previousExbPriceKwd: 1.850,
    recommendedExbPriceKwd: 1.950,
    foodPackagingCogsKwd: 0.330,
    prepTimeSeconds: 45,
    activeOnMenu: true,
  },
  {
    code: 'EXCG0003',
    nameAr: 'كاس داينمايت روبيان EXB',
    nameEn: 'EXB Dynamite Shrimp Walk-Cup',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'مأكولات بحرية وسناكس',
    categoryEn: 'Seafood Walk Cups',
    standardBranchPriceKwd: 2.500,
    previousExbPriceKwd: 2.650,
    recommendedExbPriceKwd: 2.750,
    foodPackagingCogsKwd: 0.680,
    prepTimeSeconds: 50,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXCG0004',
    nameAr: 'بوكس دجاج سويت آند ساور مع أرز EXB',
    nameEn: 'EXB Sweet & Sour Chicken Rice Bowl',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'أطباق أرز وووك سريع',
    categoryEn: 'Wok Rice Bowls',
    standardBranchPriceKwd: 2.250,
    previousExbPriceKwd: 2.400,
    recommendedExbPriceKwd: 2.500,
    foodPackagingCogsKwd: 0.520,
    prepTimeSeconds: 60,
    activeOnMenu: true,
  },
  {
    code: 'EXCG0005',
    nameAr: 'بوكس لحم منغولي مع أرز EXB',
    nameEn: 'EXB Mongolian Beef Rice Bowl',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'أطباق أرز وووك سريع',
    categoryEn: 'Wok Rice Bowls',
    standardBranchPriceKwd: 2.500,
    previousExbPriceKwd: 2.650,
    recommendedExbPriceKwd: 2.750,
    foodPackagingCogsKwd: 0.640,
    prepTimeSeconds: 65,
    activeOnMenu: true,
  },
  {
    code: 'EXCG0006',
    nameAr: 'دامبلنغ روبيان ودجاج بالبخار EXB (5 قطع)',
    nameEn: 'EXB Steamed Shrimp & Chicken Dumplings (5 pcs)',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'ديم سم بالبخار الكهربائي',
    categoryEn: 'Electric Steamed Dim Sum',
    standardBranchPriceKwd: 2.000,
    previousExbPriceKwd: 2.150,
    recommendedExbPriceKwd: 2.250,
    foodPackagingCogsKwd: 0.480,
    prepTimeSeconds: 40,
    activeOnMenu: true,
  },
  {
    code: 'EXCG0007',
    nameAr: 'سبرينغ رول خضار مقرمش EXB (3 قطع)',
    nameEn: 'EXB Crispy Veg Spring Rolls (3 pcs)',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'مقبلات وسناكس مقرمشة',
    categoryEn: 'Crispy Appetizers',
    standardBranchPriceKwd: 1.250,
    previousExbPriceKwd: 1.400,
    recommendedExbPriceKwd: 1.500,
    foodPackagingCogsKwd: 0.260,
    prepTimeSeconds: 35,
    activeOnMenu: true,
  },
  {
    code: 'EXCG0008',
    nameAr: 'مشروبات غازية EXB (كوكاكولا / زيرو / سبرايت)',
    nameEn: 'EXB Soft Drinks (Coca-Cola / Zero / Sprite)',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'مشروبات باردة',
    categoryEn: 'Beverages',
    standardBranchPriceKwd: 0.400,
    previousExbPriceKwd: 0.450,
    recommendedExbPriceKwd: 0.500,
    foodPackagingCogsKwd: 0.150,
    prepTimeSeconds: 15,
    activeOnMenu: true,
  },
  {
    code: 'EXCG0009',
    nameAr: 'ماء معدني EXB',
    nameEn: 'EXB Mineral Water',
    brandKey: 'china-garden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    categoryAr: 'مشروبات باردة',
    categoryEn: 'Beverages',
    standardBranchPriceKwd: 0.250,
    previousExbPriceKwd: 0.250,
    recommendedExbPriceKwd: 0.300,
    foodPackagingCogsKwd: 0.070,
    prepTimeSeconds: 10,
    activeOnMenu: true,
  },

  // Karak Cafeteria (EXKR0001 - EXKR0005)
  {
    code: 'EXKR0001',
    nameAr: 'بوكس شاباتي حار وجبن + كرك زعفران مميز',
    nameEn: 'Fresh Chapati Cheese Box & Saffron Karak',
    brandKey: 'karak-cafeteria',
    brandNameAr: 'كرك كافتيريا',
    brandNameEn: 'Karak Cafeteria',
    categoryAr: 'شاي ومخبوزات وسناكس',
    categoryEn: 'Hot Drinks & Chapati',
    standardBranchPriceKwd: 1.250,
    previousExbPriceKwd: 1.500,
    recommendedExbPriceKwd: 1.650,
    foodPackagingCogsKwd: 0.370,
    prepTimeSeconds: 40,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXKR0002',
    nameAr: 'ترمس كرك فنتشر فودز العائلي الفاخر (1 لتر سفري)',
    nameEn: 'Family Saffron Karak Stainless Thermos (1L)',
    brandKey: 'karak-cafeteria',
    brandNameAr: 'كرك كافتيريا',
    brandNameEn: 'Karak Cafeteria',
    categoryAr: 'ترامس ومشروبات دافئة',
    categoryEn: 'Sharing Flasks',
    standardBranchPriceKwd: 2.950,
    previousExbPriceKwd: 3.500,
    recommendedExbPriceKwd: 3.850,
    foodPackagingCogsKwd: 1.000,
    prepTimeSeconds: 50,
    activeOnMenu: true,
    isSpecialSpecialty: true,
  },
  {
    code: 'EXKR0003',
    nameAr: 'شاباتي نوتيلا والموز البلدي الساخن',
    nameEn: 'Hot Nutella & Banana Fresh Chapati Roll',
    brandKey: 'karak-cafeteria',
    brandNameAr: 'كرك كافتيريا',
    brandNameEn: 'Karak Cafeteria',
    categoryAr: 'شاي ومخبوزات وسناكس',
    categoryEn: 'Sweet Chapati',
    standardBranchPriceKwd: 1.100,
    previousExbPriceKwd: 1.350,
    recommendedExbPriceKwd: 1.500,
    foodPackagingCogsKwd: 0.320,
    prepTimeSeconds: 45,
    activeOnMenu: true,
  },
];

// =============================================================
// HISTORICAL BENCHMARK RECORDS (SAFIR ACTUAL/BUDGET, MISHREF, CAMPS)
// =============================================================

export interface HistoricalBenchmarkRecord {
  id: string
  nameAr: string
  nameEn: string
  periodSeason: string
  daysCount: number
  boothRentKwd: number
  dailyRentKwd: number
  dailySalesKwd: number
  dailyBreakEvenKwd: number
  cogsPercent: number
  rentToSalesPercent: number
  netProfitKwd: number
  netProfitPercent: number
  roiPercent: number
  primaryBrands: string[]
  viabilityStatus: 'highly_viable' | 'caution_renegotiate' | 'high_risk'
  verdictAr: string
  verdictEn: string
}

export const HISTORICAL_BENCHMARKS: HistoricalBenchmarkRecord[] = [
  {
    id: 'BENCH-SAFIR-2025-ACTUAL',
    nameAr: 'مخيم وبازار فندق السفير 2025-2026 (الفعلي المعتمد)',
    nameEn: 'Safir Hotel Camp 2025-2026 (Actual Reconciled)',
    periodSeason: 'موسم 2025/2026',
    daysCount: 30,
    boothRentKwd: 4000.000,
    dailyRentKwd: 133.333,
    dailySalesKwd: 1120.000,
    dailyBreakEvenKwd: 615.000,
    cogsPercent: 26.5,
    rentToSalesPercent: 11.9,
    netProfitKwd: 15200.000,
    netProfitPercent: 45.2,
    roiPercent: 82.6,
    primaryBrands: ['Farm Brown', 'The Noodle Bar', 'Karak Cafeteria'],
    viabilityStatus: 'highly_viable',
    verdictAr: 'فعالية ممتازة ذات تدفق نقدي سريع وهوامش صافية مرتفعة، نسبة الإيجار للمبيعات 11.9% وهي ممتازة.',
    verdictEn: 'Outstanding cash flow and net margin. Rent-to-sales ratio was 11.9%, well below threshold.',
  },
  {
    id: 'BENCH-SAFIR-2026-BUDGET',
    nameAr: 'مخيم وبازار فندق السفير 2026-2027 (الميزانية التقديرية)',
    nameEn: 'Safir Hotel Camp 2026-2027 (Budget Target)',
    periodSeason: 'موسم 2026/2027',
    daysCount: 35,
    boothRentKwd: 4800.000,
    dailyRentKwd: 137.143,
    dailySalesKwd: 1350.000,
    dailyBreakEvenKwd: 740.000,
    cogsPercent: 25.8,
    rentToSalesPercent: 10.2,
    netProfitKwd: 21400.000,
    netProfitPercent: 45.3,
    roiPercent: 82.9,
    primaryBrands: ['Farm Brown', 'Frank\'s', 'Karak Cafeteria'],
    viabilityStatus: 'highly_viable',
    verdictAr: 'الميزانية المستهدفة تعتمد زيادة المساحة وإضافة براند فرانكس مع منيو فارم براون 6FB.',
    verdictEn: 'Target budget adds Frank\'s sliders alongside Farm Brown 6FB menu for superior ticket size.',
  },
  {
    id: 'BENCH-MISHREF-PERFUME',
    nameAr: 'معرض الكويت الدولي للعطور - أرض المعارض بمشرف (صالة 5)',
    nameEn: 'Kuwait Perfume Exhibition - Mishref Fairground (Hall 5)',
    periodSeason: 'أكتوبر 2026 (12 يوماً)',
    daysCount: 12,
    boothRentKwd: 4800.000,
    dailyRentKwd: 400.000,
    dailySalesKwd: 2204.167,
    dailyBreakEvenKwd: 1224.167,
    cogsPercent: 21.5,
    rentToSalesPercent: 18.1,
    netProfitKwd: 11760.000,
    netProfitPercent: 44.5,
    roiPercent: 80.1,
    primaryBrands: ['The Noodle Bar', 'Frank\'s', 'Karak Cafeteria'],
    viabilityStatus: 'highly_viable',
    verdictAr: 'أعلى مبيعات يومية على مستوى الكويت (2,204 د.ك/يوم) وسرعة تحضير أقل من دقيقتين.',
    verdictEn: 'Highest daily sales velocity in Kuwait at KWD 2,204/day with sub-2-minute turnaround.',
  },
  {
    id: 'BENCH-MOD-CAMP',
    nameAr: 'مخيم ضباط وزارة الدفاع الربيعي - الصبية',
    nameEn: 'Ministry of Defense Spring Officers Camp - Subiya',
    periodSeason: 'نوفمبر - ديسمبر 2026',
    daysCount: 45,
    boothRentKwd: 6500.000,
    dailyRentKwd: 144.444,
    dailySalesKwd: 1087.111,
    dailyBreakEvenKwd: 624.222,
    cogsPercent: 25.3,
    rentToSalesPercent: 13.3,
    netProfitKwd: 20830.000,
    netProfitPercent: 42.6,
    roiPercent: 74.2,
    primaryBrands: ['Tahina', 'China Garden', 'Karak Cafeteria'],
    viabilityStatus: 'highly_viable',
    verdictAr: 'عائد تراكمي ضخم بفضل طول فترة المخيم (45 يوماً) وإقبال الضباط وعائلاتهم في الويكند.',
    verdictEn: 'Massive cumulative profit due to 45-day duration and robust weekend family volumes.',
  },
  {
    id: 'BENCH-MOI-CAMP',
    nameAr: 'مخيم وزارة الداخلية الشتوي - كبد',
    nameEn: 'Ministry of Interior Winter Officers Camp - Kabd',
    periodSeason: 'ديسمبر 2026 (30 يوماً)',
    daysCount: 30,
    boothRentKwd: 4200.000,
    dailyRentKwd: 140.000,
    dailySalesKwd: 1150.000,
    dailyBreakEvenKwd: 645.333,
    cogsPercent: 25.8,
    rentToSalesPercent: 12.2,
    netProfitKwd: 15140.000,
    netProfitPercent: 43.9,
    roiPercent: 78.2,
    primaryBrands: ['Frank\'s', 'Tahina', 'Farm Brown'],
    viabilityStatus: 'highly_viable',
    verdictAr: 'فعالية مستقرة بهامش ربح ممتاز وتكاليف تشغيل تحت السيطرة.',
    verdictEn: 'Stable and highly profitable with strong operating cost control.',
  },
  {
    id: 'BENCH-MARINA-KASHTA-2026',
    nameAr: 'كشتة المارينا الشتوية - تشاينا جاردن (عقد 2026-2027)',
    nameEn: 'Marina Kashta Winter Pop-Up - China Garden (2026-2027)',
    periodSeason: '26 نوفمبر 2026 إلى 02 يناير 2027 (38 يوماً)',
    daysCount: 38,
    boothRentKwd: 1300.000,
    dailyRentKwd: 34.210,
    dailySalesKwd: 185.000,
    dailyBreakEvenKwd: 109.650,
    cogsPercent: 22.0,
    rentToSalesPercent: 18.5,
    netProfitKwd: 2233.400,
    netProfitPercent: 31.8,
    roiPercent: 68.7,
    primaryBrands: ['China Garden'],
    viabilityStatus: 'highly_viable',
    verdictAr: 'عقد ممتاز جداً، إيجار يومي منخفض (34.210 د.ك/يوم أوفر من بوث السفير 37 د.ك) وتجهيز كهربائي ووك حثي 100% بدون غاز.',
    verdictEn: 'Extremely favorable contract, daily rent KWD 34.21/day (cheaper than Safir booth KWD 37/day) with 100% electric induction wok compliance.',
  },
];

// =============================================================
// 3-SCENARIO FEASIBILITY CALCULATOR (CONSERVATIVE / REALISTIC / OPTIMISTIC)
// =============================================================

export interface ScenarioMetrics {
  trafficFactor: number
  scenarioNameAr: string
  scenarioNameEn: string
  dailyOrders: number
  totalOrders: number
  dailySalesKwd: number
  grossSalesKwd: number
  cogsKwd: number
  cogsPercent: number
  grossProfitKwd: number
  rentKwd: number
  rentToSalesPercent: number
  rentWarning: boolean
  fitoutAmortizedKwd: number
  staffLaborKwd: number
  marketingOpexKwd: number
  totalOpexKwd: number
  netProfitKwd: number
  netProfitMarginPercent: number
  roiPercent: number
  dailyBreakEvenSalesKwd: number
  dailyBreakEvenOrders: number
  breakEvenDay: number
}

export interface ThreeScenarioInput {
  daysCount: number
  totalRentKwd: number
  fitoutKwd: number
  staffCount: number
  dailyWagePerStaffKwd: number
  expectedAovKwd: number
  estimatedCogsPercent: number
  marketingOpexKwd: number
  baselineDailyOrders: number
  selectedBrands: string[]
}

export interface ThreeScenarioOutput {
  conservative: ScenarioMetrics
  realistic: ScenarioMetrics
  optimistic: ScenarioMetrics
  dailyRentKwd: number
  securityDepositKwd: number
  brandBreakdown: {
    brandName: string
    sharePercent: number
    realisticSalesKwd: number
    realisticCogsKwd: number
    realisticGrossProfitKwd: number
  }[]
}

export function calculateThreeScenarios(input: ThreeScenarioInput): ThreeScenarioOutput {
  const days = Math.max(1, input.daysCount);
  const dailyRent = input.totalRentKwd / days;
  const securityDeposit = Math.round(input.totalRentKwd * 0.25); // standard 25% refundable deposit

  const totalLabor = input.staffCount * input.dailyWagePerStaffKwd * days;
  const fixedOverheads = input.totalRentKwd + input.fitoutKwd + totalLabor + input.marketingOpexKwd;

  const buildScenario = (factor: number, nameAr: string, nameEn: string): ScenarioMetrics => {
    const dailyOrders = Math.round(input.baselineDailyOrders * factor);
    const totalOrders = dailyOrders * days;
    const dailySales = dailyOrders * input.expectedAovKwd;
    const grossSales = dailySales * days;

    const cogsKwd = grossSales * (input.estimatedCogsPercent / 100);
    const grossProfit = grossSales - cogsKwd;

    const rentToSales = grossSales > 0 ? (input.totalRentKwd / grossSales) * 100 : 100;
    const rentWarning = rentToSales > 30.0;

    const totalOpex = fixedOverheads;
    const netProfit = grossProfit - (input.totalRentKwd + input.fitoutKwd + totalLabor + input.marketingOpexKwd);
    const margin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;
    const roi = totalOpex > 0 ? (netProfit / totalOpex) * 100 : 0;

    // Break-even
    const marginPerOrder = input.expectedAovKwd * (1 - input.estimatedCogsPercent / 100);
    const totalBeOrders = marginPerOrder > 0 ? Math.ceil(totalOpex / marginPerOrder) : 0;
    const dailyBeOrders = Math.ceil(totalBeOrders / days);
    const dailyBeSales = dailyBeOrders * input.expectedAovKwd;

    const dailyNetContribution = (dailySales * (1 - input.estimatedCogsPercent / 100)) - (input.staffCount * input.dailyWagePerStaffKwd) - dailyRent;
    const preOpening = input.fitoutKwd + input.marketingOpexKwd;
    const beDay = dailyNetContribution > 0
      ? Math.min(days, Math.max(1, Math.ceil(preOpening / dailyNetContribution)))
      : days;

    return {
      trafficFactor: factor,
      scenarioNameAr: nameAr,
      scenarioNameEn: nameEn,
      dailyOrders,
      totalOrders,
      dailySalesKwd: dailySales,
      grossSalesKwd: grossSales,
      cogsKwd,
      cogsPercent: input.estimatedCogsPercent,
      grossProfitKwd: grossProfit,
      rentKwd: input.totalRentKwd,
      rentToSalesPercent: rentToSales,
      rentWarning,
      fitoutAmortizedKwd: input.fitoutKwd,
      staffLaborKwd: totalLabor,
      marketingOpexKwd: input.marketingOpexKwd,
      totalOpexKwd: totalOpex,
      netProfitKwd: netProfit,
      netProfitMarginPercent: margin,
      roiPercent: roi,
      dailyBreakEvenSalesKwd: dailyBeSales,
      dailyBreakEvenOrders: dailyBeOrders,
      breakEvenDay: beDay,
    };
  };

  const conservative = buildScenario(0.80, 'السيناريو المتحفظ (80% حركة زوار)', 'Conservative (80% Footfall)');
  const realistic = buildScenario(1.00, 'السيناريو الواقعي المعتمد (100% الأساس)', 'Realistic Baseline (100%)');
  const optimistic = buildScenario(1.25, 'السيناريو المتفائل (125% ذروة المعرض)', 'Optimistic Peak (125%)');

  // Brand Breakdown (distributed proportionally)
  const brandCount = Math.max(1, input.selectedBrands.length);
  const share = 100 / brandCount;
  const brandBreakdown = input.selectedBrands.map((brandName) => {
    const brandSales = realistic.grossSalesKwd * (share / 100);
    const brandCogs = brandSales * (input.estimatedCogsPercent / 100);
    return {
      brandName,
      sharePercent: share,
      realisticSalesKwd: brandSales,
      realisticCogsKwd: brandCogs,
      realisticGrossProfitKwd: brandSales - brandCogs,
    };
  });

  return {
    conservative,
    realistic,
    optimistic,
    dailyRentKwd: dailyRent,
    securityDepositKwd: securityDeposit,
    brandBreakdown,
  };
}

// =============================================================
// AI CONTRACT INTELLIGENCE & OPERATIONAL RISK RADAR
// =============================================================

export interface EventContractRiskDetail {
  id: string
  titleAr: string
  titleEn: string
  category: 'cooking_flame' | 'engineering_fitout' | 'operating_hours' | 'payment_deposit' | 'moci_compliance'
  severity: 'critical' | 'high' | 'medium'
  extractedClauseAr: string
  extractedClauseEn: string
  systemRecommendationAr: string
  systemRecommendationEn: string
  actionOwner: string
  deadline: string
  equipmentOrActionList?: string[]
}

export interface EventContractIntelligence {
  contractId: string
  contractFileName: string
  eventNameAr: string
  eventNameEn: string
  organizerAr: string
  organizerEn: string
  organizerContact: string
  locationAr: string
  locationEn: string
  commercialLicenseNo: string
  licenseHolderName: string
  licenseHolderCivilId: string
  permittedBrand: string
  startDate: string
  endDate: string
  daysCount: number
  boothDimensions: string
  boothAreaSqM: number
  boothType: string
  rentAmountKwd: number
  securityDepositKwd: number
  totalImmediateDueKwd: number
  paymentMethod: string
  paymentDeadlineHours: number
  withdrawalNoticeDays: number
  depositRefundConditionAr: string
  ministerialDecreeRef: string
  operationalRisks: EventContractRiskDetail[]
  actionPlanMilestones: {
    id: string
    phaseNumber: 1 | 2 | 3 | 4
    phaseAr: string
    phaseEn: string
    titleAr: string
    titleEn: string
    deadlineAr: string
    deadlineEn: string
    ownerAr: string
    detailsAr: string
    detailsEn: string
    completed: boolean
  }[]
  mociPledgeTemplate: {
    decreeNumber: string
    year: string
    companyName: string
    crNumber: string
    licenseNumber: string
    authorizedSignatory: string
    civilId: string
    organizerName: string
    eventName: string
    permittedBrand: string
    boothNumber: string
    clauses: string[]
  }
}

export const MARINA_KASHTA_CONTRACT_DATA: EventContractIntelligence = {
  contractId: 'CTR-1976-MARINA-2026',
  contractFileName: '1976-chinagarden_26_Nov_26_to_02_Jan_27-KD_1300_.pdf',
  eventNameAr: 'كشتة المارينا الشتوية (Marina Kashta)',
  eventNameEn: 'Marina Kashta Winter Festival',
  organizerAr: 'شركة ريختر كريتيف لتنظيم المعارض والمؤتمرات (بدر نبيل العيسى)',
  organizerEn: 'Richter Creative Exhibition Organizers (Bader Nabeel AlEssa)',
  organizerContact: 'Bader Nabeel AlEssa · Richter Creative W.L.L. · Kuwait',
  locationAr: 'الواجهة البحرية لمارينا كريسنت - السالمية، دولة الكويت',
  locationEn: 'Marina Crescent Waterfront Promenade, Salmiya, State of Kuwait',
  commercialLicenseNo: '2021/22838',
  licenseHolderName: 'أحمد عصام محمد الإبراهيم',
  licenseHolderCivilId: '286031101513',
  permittedBrand: 'chinagarden (تشاينا جاردن)',
  startDate: '2026-11-26',
  endDate: '2027-01-02',
  daysCount: 38,
  boothDimensions: '3.00 × 3.00 متر',
  boothAreaSqM: 9.0,
  boothType: 'Normal Booth (بوث قياسي اعتيادي)',
  rentAmountKwd: 1300.000,
  securityDepositKwd: 250.000,
  totalImmediateDueKwd: 1550.000,
  paymentMethod: 'رابط دفع إلكتروني بنكي (Link Payment)',
  paymentDeadlineHours: 48,
  withdrawalNoticeDays: 20,
  depositRefundConditionAr: 'إخلاء الموقع بالكامل وتنظيف الزيوت والشحوم دون أي ضرر لأرضيات المارينا بعد 2 يناير 2027.',
  ministerialDecreeRef: 'القرار الوزاري رقم 303 لسنة 2018 الصادر عن وزارة التجارة والصناعة بشأن تنظيم المعارض المؤقتة',
  operationalRisks: [
    {
      id: 'RISK-01-FLAME',
      titleAr: '🚨 قيد الطبخ والطاقة: حظر الغاز واللهب المكشوف 100%',
      titleEn: '🚨 Cooking & Flame Restriction: 100% Electric Induction Required',
      category: 'cooking_flame',
      severity: 'critical',
      extractedClauseAr: 'يمنع منعاً باتاً استخدام أسطوانات الغاز المسال (LPG) أو الشواء أو أي مصادر للهب المكشوف داخل أو حول البوث تحت طائلة الإخلاء الفوري ومصادرة التأمين.',
      extractedClauseEn: 'Strict prohibition of LPG gas cylinders, open flames, or charcoal grilling. Violations result in immediate eviction and forfeiture of security deposit.',
      systemRecommendationAr: 'تحويل تجهيز بوث تشاينا جاردن إلى معدات كهربائية حثية 100% (Induction Woks 3.5kW + سخان ديم سم كهربائي + قلاية كهربائية + سخان بان ماري كهربائي) مع تقديم طلب مسبق للمنظم لاعتماد الأحمال الكهربائية 3-Phase (15.5 kW).',
      systemRecommendationEn: 'Mandatory switch to 100% commercial induction equipment (2x 3.5kW induction woks, electric steamer, dual fryer, bain-marie). Submit 15.5 kW 3-Phase load approval prior to Nov 15.',
      actionOwner: 'إدارة العمليات والتجهيز الفني (China Garden)',
      deadline: '2026-11-15',
      equipmentOrActionList: [
        '2x طباخ ووك حثي كهربائي احترافي (Commercial Induction Wok 3.5kW)',
        '1x قدر ديم سم ودامبلنغ كهربائي للبخار (Electric Dim Sum Steamer 2.2kW)',
        '1x قلاية كهربائية منضدية مزدوجة (Countertop Dual Electric Fryer 2x2.5kW)',
        '1x سخان طعام كهربائي بان ماري 4 عيون (Electric 4-Pot Bain-Marie 1.8kW)',
        '1x طفاية حريق بودرة جافة 6 كجم + بطانية إخماد حريق معتمدة من الإطفاء',
      ],
    },
    {
      id: 'RISK-02-FITOUT',
      titleAr: '📐 قيد الهندسة والديكور: مساحة 3×3م وسقف ارتفاع 2.5 متر',
      titleEn: '📐 Booth Size & Height Limit: 3x3m, Max Height 2.5m',
      category: 'engineering_fitout',
      severity: 'high',
      extractedClauseAr: 'مساحة البوث 3×3 متر (9 م²)، أقصى ارتفاع للديكورات واللافتات 2.5 متر. ممنوع الحفر في الأرضيات أو استخدام لواصق تتلف الرخام أو وضع أي لوحات خارج محيط الـ 9 م².',
      extractedClauseEn: 'Booth area 3x3m (9 sqm). Maximum decor/signage height 2.5 meters. Strictly no floor drilling, damaging adhesives, or exterior promotional banners outside the 9 sqm footprint.',
      systemRecommendationAr: 'تصميم هيكل خشبي/معدني ذاتي التثبيت (Free-standing Modular Kiosk) بارتفاع واجهة 2.40 متر (هامش أمان 10 سم) واستخدام أثقال قاعدة داخلية لحماية الأرضيات الرخامية.',
      systemRecommendationEn: 'Design free-standing modular kiosk with 2.40m fascia height (10cm safety clearance) and internal base counterweights to protect promenade flooring.',
      actionOwner: 'مهندس الديكور والتنفيذ (Projects Team)',
      deadline: '2026-11-20',
      equipmentOrActionList: [
        'واجهة خشبية عصرية بتصميم صيني راقٍ بارتفاع 2.40 متر وشعار China Garden مضيء',
        'كاونتر خدمة أمامي مدمج بفتحات للشاشات وأجهزة الدفع KNET',
        'حصائر أرضية عازلة من السيليكون السميك لحماية أرضية ممشى المارينا',
      ],
    },
    {
      id: 'RISK-03-HOURS',
      titleAr: '⏰ قيد ساعات العمل: 10:00 ص إلى 10:00 م يومياً لمدة 38 يوماً',
      titleEn: '⏰ Operating Hours & Shift Plan: 10 AM to 10 PM Mandatory (38 Days)',
      category: 'operating_hours',
      severity: 'high',
      extractedClauseAr: 'إلزام المشارك بفتح البوث وتقديم الخدمة طوال ساعات المعرض من الساعة 10:00 صباحاً وحتى 10:00 مساءً (12 ساعة يومياً) طوال الـ 38 يوماً دون أي إغلاق جزئي.',
      extractedClauseEn: 'Mandatory daily operation from 10:00 AM to 10:00 PM (12 hours/day) across all 38 days without unauthorized early closure.',
      systemRecommendationAr: 'جدولة شفتين متداخلين (شفت صباحي 9:30ص - 4:00م، شفت مسائي 3:30م - 10:30م) مع 3 موظفين، وتعيين فرع تشاينا جاردن السالمية (يبعد 4 دقائق) كـ Quick Re-supply Hub للدعم الفوري السريع.',
      systemRecommendationEn: 'Schedule 2 overlapping shifts (Morning 9:30 AM - 4:00 PM, Evening 3:30 PM - 10:30 PM) with 3 staff. Assign China Garden Salmiya branch (4 mins away) as the primary logistics re-supply hub.',
      actionOwner: 'مدير تشغيل الفروع والفعاليات (Operations Director)',
      deadline: '2026-11-24',
      equipmentOrActionList: [
        'شفت صباحي (طباخ + كاشير): 9:30 ص إلى 4:00 م',
        'شفت مسائي (2 طباخ + كاشير): 3:30 م إلى 10:30 م',
        'سيارة فان مبردة لنقل الصوصات والنودلز الطازجة يومياً من مطبخ القرين المركزي',
        'خط تواصل ساخن فوري مع فرع تشاينا جاردن السالمية لتعويض أي نقص في 10 دقائق',
      ],
    },
    {
      id: 'RISK-04-FINANCE',
      titleAr: '💰 المهل المالية: سداد 1,550 د.ك خلال 48 ساعة واسترداد التأمين',
      titleEn: '💰 Payment & Refund Deadlines: KWD 1,550 within 48h, KWD 250 Deposit Refund',
      category: 'payment_deposit',
      severity: 'high',
      extractedClauseAr: 'يسدد مبلغ 1,300 د.ك إيجار + 250 د.ك تأمين مسترد خلال يومين (48 ساعة) عبر Link Payment. آخر موعد للانسحاب قبل الافتتاح بـ 20 يوماً. يسترد التأمين بعد تسليم الموقع نظيفاً.',
      extractedClauseEn: 'Total KWD 1,550 (1,300 rent + 250 refundable deposit) due within 48 hours via Link Payment. Withdrawal notice required 20 days prior to launch. Deposit refunded upon clean handover.',
      systemRecommendationAr: 'إصدار أمر صرف فوري بقيمة 1,550.000 د.ك، وقيد التأمين 250 د.ك بحساب التأمينات المستردة (GL 110400)، والتزام فريق النظافة بإزالة أي أثر للزيوت لاسترداد المبلغ في 3 يناير 2027.',
      systemRecommendationEn: 'Execute instant bank transfer of KWD 1,550.000. Book KWD 250 into GL 110400 (Refundable Deposits). Enforce zero-grease exit protocol on Jan 3, 2027 for 100% deposit retrieval.',
      actionOwner: 'الإدارة المالية والمحاسبة (Finance & Accounting)',
      deadline: '2026-11-05',
      equipmentOrActionList: [
        'سداد 1,550.000 د.ك لشركة ريختر كريتيف عبر الرابط الإلكتروني وإرفاق الإيصال',
        'إرسال صورة الترخيص التجاري 2021/22838 واعتماد التوقيع للمنظم',
        'جدولة متابعة استرداد التأمين (250 د.ك) في التقويم المالي بتاريخ 03/01/2027',
      ],
    },
    {
      id: 'RISK-05-MOCI',
      titleAr: '⚖️ الامتثال الحكومي: إقرار وتعهد وزارة التجارة (القرار 303/2018)',
      titleEn: '⚖️ MOCI Ministerial Decree 303/2018 Compliance & Single-Brand Exclusivity',
      category: 'moci_compliance',
      severity: 'critical',
      extractedClauseAr: 'تعهد والتزام المشارك بأحكام القرار الوزاري 303 لسنة 2018 بإصدار فاتورة بيع لكل مستهلك، وقصر المشاركة حصراً على العلامة التجارية المسجلة في العقد (chinagarden) وحظر إضافة أي علامة أخرى دون إذن خطي.',
      extractedClauseEn: 'Full compliance with MOCI Ministerial Decree 303/2018 requiring consumer receipt issuance and strict exclusivity to chinagarden brand without unauthorized brand mixing.',
      systemRecommendationAr: 'تهيئة جهاز كاشير نقاط البيع المحمول لإصدار فواتير ضريبية ورقية وإلكترونية تحمل اسم تشاينا جاردن وترخيص فنتشر فودز، وحظر عرض أي براند غير مصرح في البوث.',
      systemRecommendationEn: 'Configure mobile POS to print compliant MOCI receipts with China Garden brand and CR 412891 / License 2021/22838 details. Prohibit display of any third-party brands.',
      actionOwner: 'إدارة الحوكمة والامتثال القانوني (Governance & Legal)',
      deadline: '2026-11-25',
      equipmentOrActionList: [
        'توقيع وختم نموذج إقرار وتعهد وزارة التجارة والصناعة (القرار 303/2018)',
        'تخصيص جهاز نقطة بيع POS سريع مزود بطابعة فواتير حرارية ورقية',
        'مراجعة قائمة الأصناف المعروضة واليافطات للتأكد من حصرية براند China Garden',
      ],
    },
  ],
  actionPlanMilestones: [
    {
      id: 'MILE-01-PAYMENT',
      phaseNumber: 1,
      phaseAr: 'المرحلة 1: التعاقد والسداد الرسمي الفوري',
      phaseEn: 'Phase 1: Immediate Contract Execution & Payment',
      titleAr: 'سداد 1,550.000 د.ك وإرسال التراخيص الثبوتية',
      titleEn: 'Execute KWD 1,550 Payment & Transmit Corporate Credentials',
      deadlineAr: 'خلال 48 ساعة من توقيع العقد',
      deadlineEn: 'Within 48 hours of contract signing',
      ownerAr: 'المدير المالي + الإدارة القانونية',
      detailsAr: 'سداد 1,300 د.ك (إيجار) + 250 د.ك (تأمين مسترد) عبر Link Payment لشركة ريختر كريتيف، وإرسال صورة الترخيص التجاري 2021/22838 واعتماد توقيع أحمد عصام الإبراهيم.',
      detailsEn: 'Transfer KWD 1,300 rent + KWD 250 refundable deposit via Richter Creative payment link. Deliver CR 412891, license 2021/22838, and signature authorization.',
      completed: true,
    },
    {
      id: 'MILE-02-FITOUT',
      phaseNumber: 2,
      phaseAr: 'المرحلة 2: التجهيز الهندسي والكهربائي بدون غاز',
      phaseEn: 'Phase 2: Electric Induction Fit-Out & Organizer Approval',
      titleAr: 'اعتماد مخطط البوث 3×3م والأحمال الكهربائية (Induction Setup)',
      titleEn: 'Submit 3x3m Booth Layout & Electric Load Specifications',
      deadlineAr: 'قبل 20 نوفمبر 2026',
      deadlineEn: 'Before November 20, 2026',
      ownerAr: 'مهندس المشاريع + رئيس طهاة تشاينا جاردن',
      detailsAr: 'تقديم مخطط البوث بارتفاع لا يتجاوز 2.50 متر، واعتماد قائمة الأحمال الكهربائية لطباخات الـ Induction Wok وسخان البخار والقلاية الكهربائية (15.5 kW)، وتوفير طفاية حريق وحاويات زيوت مغلقة.',
      detailsEn: 'Submit 3x3m booth design with max 2.50m height. Certify 15.5 kW 3-phase electric power for induction woks and steamers. Equip booth with approved fire extinguisher.',
      completed: false,
    },
    {
      id: 'MILE-03-SUPPLY',
      phaseNumber: 3,
      phaseAr: 'المرحلة 3: التشغيل اليومي وشبكة الإسناد اللوجستي',
      phaseEn: 'Phase 3: Daily Live Operations & Quick Logistics Re-Supply Hub',
      titleAr: 'التوريد الصباحي وربط فرع السالمية كنقطة دعم فوري',
      titleEn: 'Daily Morning Supply & Designate Salmiya Branch Re-Supply Hub',
      deadlineAr: 'يومياً: 26 نوفمبر 2026 – 02 يناير 2027',
      deadlineEn: 'Daily: 26 Nov 2026 to 02 Jan 2027',
      ownerAr: 'مشرف تشغيل الفعالية + مدير فرع السالمية',
      detailsAr: 'التوريد الصباحي الساعة 9:00 ص من المطبخ المركزي بالقرين، مع اعتماد فرع تشاينا جاردن السالمية (على بعد 4 دقائق) كمخزن دعم فوري لتعويض النودلز والصوصات في ذروة المساء.',
      detailsEn: 'Daily 9:00 AM delivery from Qurain central prep facility. Establish Salmiya branch (4 mins away) as rapid replenishment base for busy evening spikes.',
      completed: false,
    },
    {
      id: 'MILE-04-REFUND',
      phaseNumber: 4,
      phaseAr: 'المرحلة 4: الإخلاء النظيف واسترداد التأمين',
      phaseEn: 'Phase 4: Site Handover, Zero-Grease Clearance & Deposit Retrieval',
      titleAr: 'فك البوث، إزالة الزيوت بالكامل، واسترداد الـ 250.000 د.ك',
      titleEn: 'Dismantle Booth, Complete Deep Clean, Retrieve KWD 250 Deposit',
      deadlineAr: '03 يناير 2027',
      deadlineEn: 'January 03, 2027',
      ownerAr: 'فريق الصيانة + قسم المحاسبة المالية',
      detailsAr: 'فك البوث وتسليم الموقع لإدارة المارينا وشركة ريختر كريتيف خالياً تماماً من أي بقع زيوت أو تلفيات، وتأكيد استرداد مبلغ التأمين (250 د.ك) لحساب الشركة البنكي.',
      detailsEn: 'Complete site clearance without ground residue. Obtain signed clearance certificate and reclaim KWD 250.000 deposit to Venture Foods bank account.',
      completed: false,
    },
  ],
  mociPledgeTemplate: {
    decreeNumber: '303',
    year: '2018',
    companyName: 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
    crNumber: '412891',
    licenseNumber: '2021/22838',
    authorizedSignatory: 'أحمد عصام محمد الإبراهيم',
    civilId: '286031101513',
    organizerName: 'شركة ريختر كريتيف لتنظيم المعارض والمؤتمرات (بدر نبيل العيسى)',
    eventName: 'فعالية كشتة المارينا الشتوية (Marina Kashta)',
    permittedBrand: 'تشاينا جاردن (China Garden / chinagarden)',
    boothNumber: 'بوث رقم K-04 (الواجهة البحرية لمارينا كريسنت)',
    clauses: [
      'الالتزام التام بأحكام القرار الوزاري رقم 303 لسنة 2018 وتعديلاته الصادرة عن وزارة التجارة والصناعة بشأن تنظيم المعارض والمهرجانات التجارية المؤقتة.',
      'إصدار فاتورة أو إيصال بيع قانوني معتمد لكل مستهلك يشتري من البوث موضحاً به اسم المنشأة، رقم الترخيص التجاري، قيمة السلعة، وتاريخ الشراء.',
      'قصر المشاركة وعرض المنتجات حصرياً على العلامة التجارية المعتمدة في عقد المشاركة (chinagarden / تشاينا جاردن) والتابعة للترخيص رقم 2021/22838، وحظر عرض أو التنازل أو إشراك أي علامة تجارية أخرى دون موافقة خطية مسبقة من المنظم والوزارة.',
      'عدم استخدام أي مصادر لهب مكشوف أو أسطوانات غاز مسال داخل الموقع والالتزام الكامل بتعليمات قوة الإطفاء العام وإدارة مجمع المارينا.',
      'تحمل كامل المسؤولية المدنية والجزائية والتجارية المترتبة على أي مخالفة، واعتبار هذا الإقرار سنداً رسمياً ملزماً للمنشأة أمام كافة الجهات الرقابية بدولة الكويت.',
    ],
  },
}
