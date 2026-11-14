/**
 * Venture Foods Restaurant Management W.L.L. — Enterprise HRMS & Kuwait Labor Law No. 6/2010 Data Models & Calculators.
 * Covers 6 Brands, 7 Branches + Central Kitchen, PAM (Asahal) Quotas, Overseas Visa 18 Pipeline,
 * PRO / Mandoub Action Queue, Leaves & Air Tickets, Shifts & Overtime, Loans & Disciplinary,
 * Staff Accommodation & Transport, Kuwait EOSB Indemnity Calculator, Official Letters, and 12 Executive Reports.
 */

export type HrCommandTabKey =
  | 'employees'
  | 'payroll'
  | 'planningGantt'
  | 'expensesCustody'
  | 'recruitment'
  | 'residency'
  | 'leaves'
  | 'attendance'
  | 'loans'
  | 'housing'
  | 'eosb'
  | 'letters'
  | 'reports'

export type PamBranchQuota = {
  licenseCode: string
  brandAr: string
  brandEn: string
  branchAr: string
  branchEn: string
  pamFileNumber: string
  allowedCeiling: number
  registeredCount: number
  openOverseasVisas: number
}

export type OverseasStage =
  | 'REQUISITION'
  | 'INTERVIEW_TEST'
  | 'VISA_18_ISSUED'
  | 'GAMCA_EMBASSY'
  | 'FLIGHT_BOOKED'
  | 'KUWAIT_BIOMETRICS_MUNICIPALITY'
  | 'CIVIL_ID_DEPLOYED'

export type OverseasCandidate = {
  id: string
  refCode: string
  fullNameEn: string
  fullNameAr: string
  nationalityEn: string
  nationalityAr: string
  passportNo: string
  roleEn: string
  roleAr: string
  brandEn: string
  brandAr: string
  branchEn: string
  branchAr: string
  stage: OverseasStage
  visa18Number: string
  arrivalEta: string
  agencyFeeKwd: number
  visaFeeKwd: number
  medicalAndCardKwd: number
  flightTicketKwd: number
  offeredBasicKwd: number
}

export type MandoubTask = {
  id: string
  txCode: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  authorityEn: 'PAM / Asahal' | 'MOI Residency Affairs' | 'Kuwait Municipality' | 'PACI Civil ID' | 'Traffic Dept'
  authorityAr: 'أسهل / القوى العاملة' | 'شؤون الإقامة' | 'بلدية الكويت' | 'البطاقة المدنية PACI' | 'المرور'
  taskEn: string
  taskAr: string
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'READY_FOR_COLLECTION' | 'COMPLETED'
  govFeeKwd: number
  dueDate: string
  assignedPro: string
}

export type LeaveVacationRecord = {
  id: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  brandEn: string
  brandAr: string
  leaveType: 'ANNUAL' | 'SICK_KUWAIT_LAW' | 'EMERGENCY' | 'MATERNITY' | 'HAJJ' | 'UNPAID'
  annualBalanceDays: number
  requestedDays: number
  departureDate: string
  expectedReturnDate: string
  destinationEn: string
  destinationAr: string
  ticketBooked: boolean
  ticketCostKwd: number
  airlineRef: string
  status: 'APPROVED' | 'ON_VACATION' | 'RETURNED' | 'PENDING'
}

export type ShiftRosterRow = {
  id: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  branchEn: string
  branchAr: string
  shiftCode: 'MORNING_A' | 'EVENING_B' | 'SPLIT_KITCHEN' | 'NIGHT_CLOSING'
  shiftTime: string
  date: string
  checkIn: string
  checkOut: string
  regularHours: number
  overtimeHours: number
  overtimeMultiplier: 1.25 | 1.5 | 2.0
  overtimePayKwd: number
  approved: boolean
}

export type LoanAndDisciplinaryRow = {
  id: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  branchEn: string
  branchAr: string
  recordType: 'LOAN_ADVANCE' | 'DISCIPLINARY_ACTION'
  titleEn: string
  titleAr: string
  totalLoanKwd: number
  monthlyInstallmentKwd: number
  remainingBalanceKwd: number
  penaltyDaysDeducted: number
  penaltyAmountKwd: number
  date: string
  status: 'ACTIVE' | 'DEDUCTING' | 'CLOSED'
}

export type StaffHousingFlat = {
  id: string
  flatCode: string
  areaEn: string
  areaAr: string
  buildingEn: string
  buildingAr: string
  flatNumber: string
  capacity: number
  occupiedCount: number
  occupantsEn: string[]
  occupantsAr: string[]
  monthlyRentKwd: number
  leaseExpiryDate: string
  busRouteEn: string
  busRouteAr: string
  driverNameEn: string
  driverNameAr: string
}

export const OVERSEAS_STAGES: Array<{
  key: OverseasStage
  step: number
  ar: string
  en: string
  badgeColor: string
}> = [
  {
    key: 'REQUISITION',
    step: 1,
    ar: '1. طلب احتياج من الفرع/المطبخ',
    en: '1. Branch/Kitchen Requisition',
    badgeColor: 'border-slate-500/40 bg-slate-800/60 text-slate-200',
  },
  {
    key: 'INTERVIEW_TEST',
    step: 2,
    ar: '2. المقابلة وتجربة الطبخ',
    en: '2. Interview & Trade Test',
    badgeColor: 'border-sky-500/40 bg-sky-950/50 text-sky-200',
  },
  {
    key: 'VISA_18_ISSUED',
    step: 3,
    ar: '3. إصدار إذن العمل وفيزا 18',
    en: '3. PAM Work Permit & Visa 18 Issued',
    badgeColor: 'border-indigo-500/40 bg-indigo-950/50 text-indigo-200',
  },
  {
    key: 'GAMCA_EMBASSY',
    step: 4,
    ar: '4. الفحص الطبي ببلد المنشأ والتصديق',
    en: '4. GAMCA Medical & Embassy Stamping',
    badgeColor: 'border-purple-500/40 bg-purple-950/50 text-purple-200',
  },
  {
    key: 'FLIGHT_BOOKED',
    step: 5,
    ar: '5. تذكرة الطيران وموعد الوصول للكويت',
    en: '5. Flight Booked & Kuwait Arrival ETA',
    badgeColor: 'border-amber-500/40 bg-amber-950/50 text-amber-200',
  },
  {
    key: 'KUWAIT_BIOMETRICS_MUNICIPALITY',
    step: 6,
    ar: '6. البصمات والفحص المحلي وكرت البلدية',
    en: '6. Kuwait Medical, Fingerprints & Municipality Card',
    badgeColor: 'border-teal-500/40 bg-teal-950/50 text-teal-200',
  },
  {
    key: 'CIVIL_ID_DEPLOYED',
    step: 7,
    ar: '7. إصدار البطاقة المدنية ومباشرة العمل',
    en: '7. Civil ID Issued & Branch Deployed',
    badgeColor: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200',
  },
]

export const PAM_QUOTA_LIST: PamBranchQuota[] = [
  {
    licenseCode: 'LIC-SAL-01',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    branchAr: 'فرع السالمية',
    branchEn: 'Salmiya Branch',
    pamFileNumber: 'PAM-2019-88410',
    allowedCeiling: 24,
    registeredCount: 21,
    openOverseasVisas: 2,
  },
  {
    licenseCode: 'LIC-AVE-02',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    branchAr: 'فرع الأفنيوز',
    branchEn: 'Avenues Branch',
    pamFileNumber: 'PAM-2020-88412',
    allowedCeiling: 26,
    registeredCount: 23,
    openOverseasVisas: 2,
  },
  {
    licenseCode: 'LIC-360-03',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    branchAr: 'فرع 360 مول',
    branchEn: '360 Mall Branch',
    pamFileNumber: 'PAM-2021-88415',
    allowedCeiling: 20,
    registeredCount: 18,
    openOverseasVisas: 1,
  },
  {
    licenseCode: 'LIC-ASM-04',
    brandAr: 'ذا نودل بار',
    brandEn: 'The Noodle Bar',
    branchAr: 'فرع العاصمة مول',
    branchEn: 'Assima Mall Branch',
    pamFileNumber: 'PAM-2022-90112',
    allowedCeiling: 18,
    registeredCount: 15,
    openOverseasVisas: 2,
  },
  {
    licenseCode: 'LIC-KOUT-05',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    branchAr: 'فرع الكوت مول',
    branchEn: 'Al-Kout Mall Branch',
    pamFileNumber: 'PAM-2020-88419',
    allowedCeiling: 18,
    registeredCount: 16,
    openOverseasVisas: 1,
  },
  {
    licenseCode: 'LIC-ARD-06',
    brandAr: 'فرانكس ستيك + فارم براون',
    brandEn: "Frank's Steak & Farm Brown",
    branchAr: 'فرع العارضية الحرفية',
    branchEn: 'Ardiya Branch',
    pamFileNumber: 'PAM-2021-91204',
    allowedCeiling: 22,
    registeredCount: 19,
    openOverseasVisas: 2,
  },
  {
    licenseCode: 'LIC-PRM-07',
    brandAr: 'كرك كافيتريا',
    brandEn: 'Karak Cafeteria',
    branchAr: 'فرع البروميناد مول',
    branchEn: 'Promenade Mall Branch',
    pamFileNumber: 'PAM-2022-93011',
    allowedCeiling: 14,
    registeredCount: 12,
    openOverseasVisas: 1,
  },
  {
    licenseCode: 'LIC-KOT-08',
    brandAr: 'شاورما طحينة',
    brandEn: 'Tahina Shawarma',
    branchAr: 'فرع الكوت مول',
    branchEn: 'Al-Kout Mall Branch',
    pamFileNumber: 'PAM-2021-94100',
    allowedCeiling: 16,
    registeredCount: 14,
    openOverseasVisas: 1,
  },
  {
    licenseCode: 'LIC-ARD-09',
    brandAr: 'تشاينا جاردن + طحينة',
    brandEn: 'China Garden & Tahina',
    branchAr: 'فرع العارضية الحرفية',
    branchEn: 'Ardiya Craft Branch',
    pamFileNumber: 'PAM-2023-95220',
    allowedCeiling: 14,
    registeredCount: 11,
    openOverseasVisas: 2,
  },
  {
    licenseCode: 'LIC-SHW-10',
    brandAr: 'فارم براون',
    brandEn: 'Farm Brown Bakery',
    branchAr: 'فرع الشويخ',
    branchEn: 'Shuwaikh Branch',
    pamFileNumber: 'PAM-2022-96105',
    allowedCeiling: 12,
    registeredCount: 10,
    openOverseasVisas: 1,
  },
  {
    licenseCode: 'LIC-CK-11',
    brandAr: 'فنتشر فودز — المطبخ المركزي',
    brandEn: 'Venture Foods Central Kitchen',
    branchAr: 'المطبخ المركزي',
    branchEn: 'Central Kitchen',
    pamFileNumber: 'PAM-2018-70001',
    allowedCeiling: 32,
    registeredCount: 27,
    openOverseasVisas: 3,
  },
]

export const INITIAL_OVERSEAS_CANDIDATES: OverseasCandidate[] = [
  {
    id: 'ov-1',
    refCode: 'OV-2026-101',
    fullNameEn: 'Rajesh Kumar Sharma',
    fullNameAr: 'راجيش كومار شارما',
    nationalityEn: 'India',
    nationalityAr: 'الهند',
    passportNo: 'Z4891203',
    roleEn: 'Wok Demi Chef de Partie',
    roleAr: 'شيف ووك أول',
    brandEn: 'China Garden',
    brandAr: 'تشاينا جاردن',
    branchEn: 'Avenues Branch',
    branchAr: 'فرع الأفنيوز',
    stage: 'FLIGHT_BOOKED',
    visa18Number: 'V18-99201442',
    arrivalEta: '2026-11-08',
    agencyFeeKwd: 120.0,
    visaFeeKwd: 70.0,
    medicalAndCardKwd: 45.0,
    flightTicketKwd: 95.0,
    offeredBasicKwd: 280.0,
  },
  {
    id: 'ov-2',
    refCode: 'OV-2026-102',
    fullNameEn: 'Maria Angelica Santos',
    fullNameAr: 'ماريا أنجليكا سانتوس',
    nationalityEn: 'Philippines',
    nationalityAr: 'الفلبين',
    passportNo: 'P8172635A',
    roleEn: 'Branch Hostess & Cashier',
    roleAr: 'مضيفة وكاشير فرع',
    brandEn: 'The Noodle Bar',
    brandAr: 'ذا نودل بار',
    branchEn: 'Assima Mall Branch',
    branchAr: 'فرع العاصمة مول',
    stage: 'GAMCA_EMBASSY',
    visa18Number: 'V18-99201890',
    arrivalEta: '2026-11-18',
    agencyFeeKwd: 150.0,
    visaFeeKwd: 70.0,
    medicalAndCardKwd: 45.0,
    flightTicketKwd: 145.0,
    offeredBasicKwd: 260.0,
  },
  {
    id: 'ov-3',
    refCode: 'OV-2026-103',
    fullNameEn: 'Mahmoud Elsayed Hassan',
    fullNameAr: 'محمود السيد حسن',
    nationalityEn: 'Egypt',
    nationalityAr: 'مصر',
    passportNo: 'A29384751',
    roleEn: 'Shawarma & Grill Master',
    roleAr: 'معلم شاورما ومشاوي',
    brandEn: 'Tahina Shawarma',
    brandAr: 'شاورما طحينة',
    branchEn: 'Mubarak Al-Kabeer Branch',
    branchAr: 'فرع مبارك الكبير',
    stage: 'KUWAIT_BIOMETRICS_MUNICIPALITY',
    visa18Number: 'V18-99198201',
    arrivalEta: '2026-10-29',
    agencyFeeKwd: 90.0,
    visaFeeKwd: 70.0,
    medicalAndCardKwd: 45.0,
    flightTicketKwd: 75.0,
    offeredBasicKwd: 270.0,
  },
  {
    id: 'ov-4',
    refCode: 'OV-2026-104',
    fullNameEn: 'Bikram Thapa Magar',
    fullNameAr: 'بيكرام ثابا ماغار',
    nationalityEn: 'Nepal',
    nationalityAr: 'نيبال',
    passportNo: 'NP1129834',
    roleEn: 'Central Kitchen Prep Commis',
    roleAr: 'طباخ تحضير — المطبخ المركزي',
    brandEn: 'Venture Foods Central Kitchen',
    brandAr: 'المطبخ المركزي',
    branchEn: 'Central Kitchen',
    branchAr: 'المطبخ المركزي',
    stage: 'VISA_18_ISSUED',
    visa18Number: 'V18-99204510',
    arrivalEta: '2026-11-25',
    agencyFeeKwd: 110.0,
    visaFeeKwd: 70.0,
    medicalAndCardKwd: 45.0,
    flightTicketKwd: 115.0,
    offeredBasicKwd: 210.0,
  },
  {
    id: 'ov-5',
    refCode: 'OV-2026-105',
    fullNameEn: 'Kasun Perera Jayawardena',
    fullNameAr: 'كاسون بيريرا جاياواردينا',
    nationalityEn: 'Sri Lanka',
    nationalityAr: 'سريلانكا',
    passportNo: 'N7741290',
    roleEn: 'Artisan Bakery & Pastry Chef',
    roleAr: 'شيف مخبوزات وحلويات',
    brandEn: 'Farm Brown Bakery',
    brandAr: 'فارم براون',
    branchEn: 'Shuwaikh Branch',
    branchAr: 'فرع الشويخ',
    stage: 'INTERVIEW_TEST',
    visa18Number: 'PENDING-PAM',
    arrivalEta: '2026-12-05',
    agencyFeeKwd: 115.0,
    visaFeeKwd: 70.0,
    medicalAndCardKwd: 45.0,
    flightTicketKwd: 105.0,
    offeredBasicKwd: 295.0,
  },
  {
    id: 'ov-6',
    refCode: 'OV-2026-106',
    fullNameEn: 'Mohammad Kamrul Islam',
    fullNameAr: 'محمد قمر الإسلام',
    nationalityEn: 'Bangladesh',
    nationalityAr: 'بنغلاديش',
    passportNo: 'B00928371',
    roleEn: 'Kitchen Steward & Hygiene Specialist',
    roleAr: 'مسؤول نظافة وتعقيم مطبخ',
    brandEn: 'China Garden',
    brandAr: 'تشاينا جاردن',
    branchEn: 'Salmiya Branch',
    branchAr: 'فرع السالمية',
    stage: 'CIVIL_ID_DEPLOYED',
    visa18Number: 'V18-99180044',
    arrivalEta: '2026-10-15',
    agencyFeeKwd: 85.0,
    visaFeeKwd: 70.0,
    medicalAndCardKwd: 45.0,
    flightTicketKwd: 90.0,
    offeredBasicKwd: 185.0,
  },
  {
    id: 'ov-7',
    refCode: 'OV-2026-107',
    fullNameEn: 'Arjun Nair Gopalan',
    fullNameAr: 'أرجون ناير غوبالان',
    nationalityEn: 'India',
    nationalityAr: 'الهند',
    passportNo: 'V9081234',
    roleEn: 'Karak & Paratha Specialist',
    roleAr: 'معلم كرك وبراتا',
    brandEn: 'Karak Cafeteria',
    brandAr: 'كرك كافيتريا',
    branchEn: 'Promenade Mall Branch',
    branchAr: 'فرع البروميناد مول',
    stage: 'REQUISITION',
    visa18Number: 'DRAFT-REQ',
    arrivalEta: '2026-12-12',
    agencyFeeKwd: 110.0,
    visaFeeKwd: 70.0,
    medicalAndCardKwd: 45.0,
    flightTicketKwd: 95.0,
    offeredBasicKwd: 230.0,
  },
]

export const MANDOUB_PRO_QUEUE: MandoubTask[] = [
  {
    id: 'pro-1',
    txCode: 'ASAHAL-88219',
    employeeCode: '1042',
    employeeNameEn: 'Anand Rao',
    employeeNameAr: 'أناند راو',
    authorityEn: 'PAM / Asahal',
    authorityAr: 'أسهل / القوى العاملة',
    taskEn: 'Article 18 Work Permit Annual Renewal (2 Years)',
    taskAr: 'تجديد إذن العمل مادة 18 (سنتان) عبر بوابة أسهل',
    status: 'IN_PROGRESS',
    govFeeKwd: 70.0,
    dueDate: '2026-11-06',
    assignedPro: 'Amjad Samir (+965 97386411)',
  },
  {
    id: 'pro-2',
    txCode: 'MUN-44109',
    employeeCode: '1018',
    employeeNameEn: 'Nelson Baluso',
    employeeNameAr: 'نيلسون بالوسو',
    authorityEn: 'Kuwait Municipality',
    authorityAr: 'بلدية الكويت',
    taskEn: 'Food Handler Municipality Health Card Renewal (Central Kitchen)',
    taskAr: 'تجديد شهادة صحية لمتداولي الأغذية — المطبخ المركزي',
    status: 'SUBMITTED',
    govFeeKwd: 15.0,
    dueDate: '2026-11-05',
    assignedPro: 'Amjad Samir (+965 97386411)',
  },
  {
    id: 'pro-3',
    txCode: 'MOI-77301',
    employeeCode: 'OV-2026-103',
    employeeNameEn: 'Mahmoud Elsayed Hassan',
    employeeNameAr: 'محمود السيد حسن',
    authorityEn: 'MOI Residency Affairs',
    authorityAr: 'شؤون الإقامة',
    taskEn: 'First-Time Visa 18 Residency Stamping & Health Insurance',
    taskAr: 'بصمات وتثبيت إقامة مادة 18 لأول مرة + الضمان الصحي',
    status: 'IN_PROGRESS',
    govFeeKwd: 130.0,
    dueDate: '2026-11-07',
    assignedPro: 'Amjad Samir (+965 97386411)',
  },
  {
    id: 'pro-4',
    txCode: 'PACI-55910',
    employeeCode: '1088',
    employeeNameEn: 'Juven Ray Cuizon',
    employeeNameAr: 'جوفين راي كويزون',
    authorityEn: 'PACI Civil ID',
    authorityAr: 'البطاقة المدنية PACI',
    taskEn: 'Civil ID Card Collection & Kuwait Mobile ID Activation',
    taskAr: 'استلام البطاقة المدنية وتفعيل تطبيق هويتي PACI',
    status: 'READY_FOR_COLLECTION',
    govFeeKwd: 5.0,
    dueDate: '2026-11-04',
    assignedPro: 'Amjad Samir (+965 97386411)',
  },
  {
    id: 'pro-5',
    txCode: 'TRF-31094',
    employeeCode: '1104',
    employeeNameEn: 'Munir Ahmed',
    employeeNameAr: 'منير أحمد',
    authorityEn: 'Traffic Dept',
    authorityAr: 'المرور',
    taskEn: 'Fleet Delivery Van Registration & Driver License Verification',
    taskAr: 'تجديد دفتر فان التوصيل المبرد ومطابقة رخصة القيادة',
    status: 'COMPLETED',
    govFeeKwd: 35.0,
    dueDate: '2026-11-01',
    assignedPro: 'Amjad Samir (+965 97386411)',
  },
]

export const LEAVE_VACATION_RECORDS: LeaveVacationRecord[] = [
  {
    id: 'lv-1',
    employeeCode: '1019',
    employeeNameEn: 'Sheila Bulibuli',
    employeeNameAr: 'شيلا بوليبولي',
    brandEn: 'China Garden',
    brandAr: 'تشاينا جاردن',
    leaveType: 'ANNUAL',
    annualBalanceDays: 34,
    requestedDays: 30,
    departureDate: '2026-10-20',
    expectedReturnDate: '2026-11-19',
    destinationEn: 'Manila, Philippines (MNL)',
    destinationAr: 'مانيلا، الفلبين',
    ticketBooked: true,
    ticketCostKwd: 165.0,
    airlineRef: 'KU-412 / PNR: 8XK92A',
    status: 'ON_VACATION',
  },
  {
    id: 'lv-2',
    employeeCode: '1033',
    employeeNameEn: 'Sunil Ponukumatla',
    employeeNameAr: 'سونيل بونوكوماتلا',
    brandEn: 'Venture Foods Central Kitchen',
    brandAr: 'المطبخ المركزي',
    leaveType: 'ANNUAL',
    annualBalanceDays: 42,
    requestedDays: 30,
    departureDate: '2026-11-15',
    expectedReturnDate: '2026-12-15',
    destinationEn: 'Hyderabad, India (HYD)',
    destinationAr: 'حيدر أباد، الهند',
    ticketBooked: true,
    ticketCostKwd: 112.5,
    airlineRef: 'J9-403 / PNR: 4M29LP',
    status: 'APPROVED',
  },
  {
    id: 'lv-3',
    employeeCode: '1051',
    employeeNameEn: 'Samy Sabry',
    employeeNameAr: 'سامي صبري',
    brandEn: 'HQ Finance & Accounting',
    brandAr: 'الإدارة المالية',
    leaveType: 'ANNUAL',
    annualBalanceDays: 28,
    requestedDays: 14,
    departureDate: '2026-10-01',
    expectedReturnDate: '2026-10-15',
    destinationEn: 'Cairo, Egypt (CAI)',
    destinationAr: 'القاهرة، مصر',
    ticketBooked: true,
    ticketCostKwd: 88.0,
    airlineRef: 'MS-611 / PNR: 9TR41Q',
    status: 'RETURNED',
  },
  {
    id: 'lv-4',
    employeeCode: '1077',
    employeeNameEn: 'Kapil Dev',
    employeeNameAr: 'كابيل ديف',
    brandEn: "Frank's Steak & Farm Brown",
    brandAr: 'فرانكس ستيك وفارم براون',
    leaveType: 'SICK_KUWAIT_LAW',
    annualBalanceDays: 24,
    requestedDays: 5,
    departureDate: '2026-11-01',
    expectedReturnDate: '2026-11-06',
    destinationEn: 'Inside Kuwait (MOH Medical Report)',
    destinationAr: 'داخل الكويت (طبيعة مرضية معتمدة — 100% أجر لأول 15 يوماً)',
    ticketBooked: false,
    ticketCostKwd: 0,
    airlineRef: 'MOH-SICK-99812',
    status: 'APPROVED',
  },
]

export const SHIFT_ROSTER_RECORDS: ShiftRosterRow[] = [
  {
    id: 'sh-1',
    employeeCode: '1042',
    employeeNameEn: 'Anand Rao',
    employeeNameAr: 'أناند راو',
    branchEn: 'Avenues Branch',
    branchAr: 'فرع الأفنيوز',
    shiftCode: 'MORNING_A',
    shiftTime: '08:00 - 16:00',
    date: '2026-11-03',
    checkIn: '07:54',
    checkOut: '18:00',
    regularHours: 8,
    overtimeHours: 2,
    overtimeMultiplier: 1.25,
    overtimePayKwd: 5.625,
    approved: true,
  },
  {
    id: 'sh-2',
    employeeCode: '1018',
    employeeNameEn: 'Nelson Baluso',
    employeeNameAr: 'نيلسون بالوسو',
    branchEn: 'Central Kitchen',
    branchAr: 'المطبخ المركزي',
    shiftCode: 'MORNING_A',
    shiftTime: '06:00 - 14:00',
    date: '2026-11-03',
    checkIn: '05:55',
    checkOut: '16:00',
    regularHours: 8,
    overtimeHours: 2,
    overtimeMultiplier: 1.5,
    overtimePayKwd: 7.5,
    approved: true,
  },
  {
    id: 'sh-3',
    employeeCode: '1088',
    employeeNameEn: 'Juven Ray Cuizon',
    employeeNameAr: 'جوفين راي كويزون',
    branchEn: 'Salmiya Branch',
    branchAr: 'فرع السالمية',
    shiftCode: 'EVENING_B',
    shiftTime: '15:00 - 23:00',
    date: '2026-11-03',
    checkIn: '14:58',
    checkOut: '00:30',
    regularHours: 8,
    overtimeHours: 1.5,
    overtimeMultiplier: 1.5,
    overtimePayKwd: 4.95,
    approved: true,
  },
  {
    id: 'sh-4',
    employeeCode: '1095',
    employeeNameEn: 'Rabih Yehia',
    employeeNameAr: 'ربيع يحيى',
    branchEn: '360 Mall Branch',
    branchAr: 'فرع 360 مول',
    shiftCode: 'SPLIT_KITCHEN',
    shiftTime: '11:00 - 22:00 (Break 15:00-17:00)',
    date: '2026-11-03',
    checkIn: '10:55',
    checkOut: '23:00',
    regularHours: 8,
    overtimeHours: 1,
    overtimeMultiplier: 2.0,
    overtimePayKwd: 6.25,
    approved: false,
  },
]

export const LOANS_AND_DISCIPLINARY_RECORDS: LoanAndDisciplinaryRow[] = [
  {
    id: 'ld-1',
    employeeCode: '1042',
    employeeNameEn: 'Anand Rao',
    employeeNameAr: 'أناند راو',
    branchEn: 'Avenues Branch',
    branchAr: 'فرع الأفنيوز',
    recordType: 'LOAN_ADVANCE',
    titleEn: 'Emergency Family Housing Advance (6 Installments)',
    titleAr: 'سلفة شخصية طارئة مقسطة على 6 أشهر',
    totalLoanKwd: 300.0,
    monthlyInstallmentKwd: 50.0,
    remainingBalanceKwd: 150.0,
    penaltyDaysDeducted: 0,
    penaltyAmountKwd: 0,
    date: '2026-08-01',
    status: 'DEDUCTING',
  },
  {
    id: 'ld-2',
    employeeCode: '1088',
    employeeNameEn: 'Juven Ray Cuizon',
    employeeNameAr: 'جوفين راي كويزون',
    branchEn: 'Salmiya Branch',
    branchAr: 'فرع السالمية',
    recordType: 'LOAN_ADVANCE',
    titleEn: 'Residency Family Dependent Fee Advance',
    titleAr: 'سلفة رسوم تجديد إقامة عائلة',
    totalLoanKwd: 200.0,
    monthlyInstallmentKwd: 40.0,
    remainingBalanceKwd: 80.0,
    penaltyDaysDeducted: 0,
    penaltyAmountKwd: 0,
    date: '2026-07-01',
    status: 'DEDUCTING',
  },
  {
    id: 'ld-3',
    employeeCode: '1120',
    employeeNameEn: 'Dispatcher Courier #14',
    employeeNameAr: 'سائق توصيل #14',
    branchEn: 'Ardiya Branch',
    branchAr: 'فرع العارضية',
    recordType: 'DISCIPLINARY_ACTION',
    titleEn: 'Written Warning + 1 Day Deduction (Aggregator Peak Delay)',
    titleAr: 'إنذار كتابي رسمي + خصم يوم عمل (تأخير وقت الذروة)',
    totalLoanKwd: 0,
    monthlyInstallmentKwd: 0,
    remainingBalanceKwd: 0,
    penaltyDaysDeducted: 1,
    penaltyAmountKwd: 7.5,
    date: '2026-10-25',
    status: 'ACTIVE',
  },
]

export const STAFF_HOUSING_FLATS: StaffHousingFlat[] = [
  {
    id: 'flat-1',
    flatCode: 'HSG-SAL-101',
    areaEn: 'Salmiya — Block 10',
    areaAr: 'السالمية — قطعة 10',
    buildingEn: 'Al-Dana Residential Tower',
    buildingAr: 'برج الدانة السكني',
    flatNumber: 'Flat 12 (Floor 3)',
    capacity: 12,
    occupiedCount: 11,
    occupantsEn: ['Anand Rao', 'Juven Ray Cuizon', 'Salmiya Kitchen Team (9 staff)'],
    occupantsAr: ['أناند راو', 'جوفين راي كويزون', 'طاقم مطبخ وصالة السالمية (9 موظفين)'],
    monthlyRentKwd: 420.0,
    leaseExpiryDate: '2027-03-31',
    busRouteEn: 'Route A: Salmiya Housing ↔ Salmiya & Assima Branches',
    busRouteAr: 'خط أ: سكن السالمية ↔ فرع السالمية والعاصمة مول',
    driverNameEn: 'Munir Ahmed (+965 97386411)',
    driverNameAr: 'منير أحمد',
  },
  {
    id: 'flat-2',
    flatCode: 'HSG-FAR-202',
    areaEn: 'Farwaniya — Block 4',
    areaAr: 'الفروانية — قطعة 4',
    buildingEn: 'Al-Noor Staff Building',
    buildingAr: 'عمارة النور لسكن الموظفين',
    flatNumber: 'Flats 4 & 5 (Floor 2)',
    capacity: 18,
    occupiedCount: 16,
    occupantsEn: ['Avenues & Ardiya & 360 Mall Chefs & Commis (16 staff)'],
    occupantsAr: ['طهاة وموظفو الأفنيوز والعارضية و360 مول (16 موظفاً)'],
    monthlyRentKwd: 580.0,
    leaseExpiryDate: '2027-06-30',
    busRouteEn: 'Route B: Farwaniya Housing ↔ Avenues, Ardiya & 360 Mall',
    busRouteAr: 'خط ب: سكن الفروانية ↔ الأفنيوز والعارضية و360 مول',
    driverNameEn: 'Fleet Bus #2 (Coaster 26-Seater)',
    driverNameAr: 'باص الشركة رقم 2 (تويوتا كوستر)',
  },
  {
    id: 'flat-3',
    flatCode: 'HSG-SLM-303',
    areaEn: 'Sabah Al-Salem / Salmiya Sector',
    areaAr: 'صباح السالم / قطاع السالمية',
    buildingEn: 'Al-uruba Complex B',
    buildingAr: 'مجمع العروبة ب',
    flatNumber: 'Flats 7, 8 & 9',
    capacity: 24,
    occupiedCount: 22,
    occupantsEn: ['Nelson Baluso', 'Sunil Ponukumatla', 'Central Kitchen & Kout Team (20 staff)'],
    occupantsAr: ['نيلسون بالوسو', 'سونيل بونوكوماتلا', 'طاقم المطبخ المركزي والكوت (20 موظفاً)'],
    monthlyRentKwd: 750.0,
    leaseExpiryDate: '2027-01-31',
    busRouteEn: 'Route C: Sabah Al-Salem ↔ Central Kitchen & Al-Kout Mall',
    busRouteAr: 'خط ج: صباح السالم ↔ المطبخ المركزي والكوت مول',
    driverNameEn: 'Fleet Bus #1 (Coaster 30-Seater)',
    driverNameAr: 'باص الشركة رقم 1 (كوستر 30 راكباً)',
  },
]

export type KuwaitEosbInput = {
  hireDate: string
  lastWorkingDate: string
  basicSalaryKwd: number
  allowancesKwd: number
  reason: 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_EXPIRY'
  unusedLeaveDays: number
  workedDaysInFinalMonth: number
  outstandingLoanKwd: number
}

export type KuwaitEosbResult = {
  years: number
  months: number
  days: number
  totalServiceYearsDecimal: number
  remunerationBaseKwd: number
  dailyWage26Kwd: number
  dailyWage30Kwd: number
  firstFiveYearsIndemnityKwd: number
  afterFiveYearsIndemnityKwd: number
  grossFullIndemnityKwd: number
  resignationEntitlementRatio: number
  resignationEntitlementLabelEn: string
  resignationEntitlementLabelAr: string
  netIndemnityPayableKwd: number
  leaveEncashmentKwd: number
  finalMonthSalaryKwd: number
  outstandingLoanKwd: number
  finalSettlementNetKwd: number
}

/**
 * Kuwait Labor Law No. 6 of 2010 (Articles 51, 52, 53, 70):
 * - Monthly-paid workers: 15 days remuneration for each of the first 5 years + 1 month (30 days) for each year thereafter.
 * - Daily rate for EOSB & Annual Leave encashment = Monthly Remuneration / 26 working days.
 * - Resignation entitlement (Article 53):
 *   * < 3 years service: 0%
 *   * >= 3 and < 5 years: 50% (1/2)
 *   * >= 5 and < 10 years: 66.67% (2/3)
 *   * >= 10 years: 100%
 * - Termination / Contract Expiry: 100% of accrued indemnity.
 */
export function calculateKuwaitEosb(input: KuwaitEosbInput): KuwaitEosbResult {
  const start = new Date(input.hireDate)
  const end = new Date(input.lastWorkingDate)
  const diffMs = Math.max(0, end.getTime() - start.getTime())
  const totalDays = Math.floor(diffMs / 86_400_000)

  const years = Math.floor(totalDays / 365)
  const remAfterYears = totalDays - years * 365
  const months = Math.floor(remAfterYears / 30)
  const days = remAfterYears - months * 30
  const totalServiceYearsDecimal = Math.round((totalDays / 365) * 1000) / 1000

  const remunerationBaseKwd = Math.max(0, Number(input.basicSalaryKwd || 0) + Number(input.allowancesKwd || 0))
  const dailyWage26Kwd = remunerationBaseKwd / 26
  const dailyWage30Kwd = remunerationBaseKwd / 30

  const firstFiveYears = Math.min(5, totalServiceYearsDecimal)
  const afterFiveYears = Math.max(0, totalServiceYearsDecimal - 5)

  const firstFiveYearsIndemnityKwd = firstFiveYears * 15 * dailyWage26Kwd
  const afterFiveYearsIndemnityKwd = afterFiveYears * 30 * dailyWage26Kwd
  // Cap at 1.5 years of remuneration per Article 51
  const rawGrossIndemnity = firstFiveYearsIndemnityKwd + afterFiveYearsIndemnityKwd
  const grossFullIndemnityKwd = Math.min(rawGrossIndemnity, remunerationBaseKwd * 18)

  let ratio = 1
  let labelEn = '100% Full Entitlement (Termination / Contract Expiry — Art. 51)'
  let labelAr = 'استحقاق كامل 100% (إنهاء خدمات / انتهاء عقد — مادة 51)'

  if (input.reason === 'RESIGNATION') {
    if (totalServiceYearsDecimal < 3) {
      ratio = 0
      labelEn = '0% Entitlement (Resignation under 3 years — Art. 53)'
      labelAr = '0% غير مستحق (استقالة لأقل من 3 سنوات — مادة 53)'
    } else if (totalServiceYearsDecimal < 5) {
      ratio = 0.5
      labelEn = '50% Half Entitlement (Resignation 3 to <5 years — Art. 53)'
      labelAr = '50% نصف المكافأة (استقالة من 3 إلى أقل من 5 سنوات — مادة 53)'
    } else if (totalServiceYearsDecimal < 10) {
      ratio = 2 / 3
      labelEn = '66.67% Two-Thirds Entitlement (Resignation 5 to <10 years — Art. 53)'
      labelAr = '66.67% ثلثا المكافأة (استقالة من 5 إلى أقل من 10 سنوات — مادة 53)'
    } else {
      ratio = 1
      labelEn = '100% Full Entitlement (Resignation 10+ years — Art. 53)'
      labelAr = '100% المكافأة الكاملة (استقالة بعد 10 سنوات فأكثر — مادة 53)'
    }
  }

  const netIndemnityPayableKwd = grossFullIndemnityKwd * ratio
  const leaveEncashmentKwd = Math.max(0, Number(input.unusedLeaveDays || 0)) * dailyWage26Kwd
  const finalMonthSalaryKwd = Math.max(0, Number(input.workedDaysInFinalMonth || 0)) * dailyWage30Kwd
  const outstandingLoanKwd = Math.max(0, Number(input.outstandingLoanKwd || 0))

  const finalSettlementNetKwd = Math.max(
    0,
    netIndemnityPayableKwd + leaveEncashmentKwd + finalMonthSalaryKwd - outstandingLoanKwd,
  )

  const round3 = (n: number) => Math.round(n * 1000) / 1000

  return {
    years,
    months,
    days,
    totalServiceYearsDecimal,
    remunerationBaseKwd: round3(remunerationBaseKwd),
    dailyWage26Kwd: round3(dailyWage26Kwd),
    dailyWage30Kwd: round3(dailyWage30Kwd),
    firstFiveYearsIndemnityKwd: round3(firstFiveYearsIndemnityKwd),
    afterFiveYearsIndemnityKwd: round3(afterFiveYearsIndemnityKwd),
    grossFullIndemnityKwd: round3(grossFullIndemnityKwd),
    resignationEntitlementRatio: Math.round(ratio * 10000) / 100,
    resignationEntitlementLabelEn: labelEn,
    resignationEntitlementLabelAr: labelAr,
    netIndemnityPayableKwd: round3(netIndemnityPayableKwd),
    leaveEncashmentKwd: round3(leaveEncashmentKwd),
    finalMonthSalaryKwd: round3(finalMonthSalaryKwd),
    outstandingLoanKwd: round3(outstandingLoanKwd),
    finalSettlementNetKwd: round3(finalSettlementNetKwd),
  }
}

export type ExecutiveHrReportMeta = {
  id: number
  code: string
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  badge: string
}

export const EXECUTIVE_12_HR_REPORTS: ExecutiveHrReportMeta[] = [
  {
    id: 1,
    code: 'RPT-01-MASTER-PAYROLL',
    titleAr: '1. كشف مسير الرواتب الشامل حسب الفرع والبراند',
    titleEn: '1. Master Payroll by Branch & Brand',
    subtitleAr: 'تفصيل الأساسي والبدلات والإضافي والاستقطاعات وصافي الراتب بـ 0.000 د.ك',
    subtitleEn: 'Full breakdown of basic, allowances, overtime, deductions & net KWD across 6 brands & 7 branches',
    badge: 'PAYROLL',
  },
  {
    id: 2,
    code: 'RPT-02-NBK-WPS',
    titleAr: '2. كشف تحويلات البنوك وحماية الأجور (NBK WPS)',
    titleEn: '2. NBK WPS Bank Transfer Sheet',
    subtitleAr: 'ملف حماية الأجور الرسمي شاملاً الرقم المدني والـ IBAN والبنك وصافي التحويل',
    subtitleEn: 'Official Wage Protection System sheet with Civil ID, IBAN, Bank code & Net transfer KWD',
    badge: 'WPS / NBK',
  },
  {
    id: 3,
    code: 'RPT-03-RESIDENCY-HEALTH',
    titleAr: '3. كشف الإقامات والجوازات وكروت البلدية',
    titleEn: '3. Residency, Civil ID, Passport & Health Card Master Sheet',
    subtitleAr: 'تواريخ انتهاء إقامة مادة 18، إذن العمل، البطاقة المدنية، الجواز، وكرت صحة البلدية',
    subtitleEn: 'Article 18 residency, PAM work permit, Civil ID, passport & Municipality card expiry dates',
    badge: 'COMPLIANCE',
  },
  {
    id: 4,
    code: 'RPT-04-OVERSEAS-VISA18',
    titleAr: '4. تقرير الاستقدام الخارجي والفيز النشطة',
    titleEn: '4. Overseas Recruitment & Visa 18 Pipeline Report',
    subtitleAr: 'متابعة المرشحين من الخارج عبر المراحل الـ 7 وتكلفة الاستقدام بالدينار الكويتي',
    subtitleEn: '7-stage overseas recruitment pipeline, visa 18 numbers, arrival ETAs & KWD landing cost',
    badge: 'VISA 18',
  },
  {
    id: 5,
    code: 'RPT-05-PAM-QUOTA',
    titleAr: '5. تقرير كوتا القوى العاملة وتقدير الاحتياج',
    titleEn: '5. PAM Quota & Vacancies Report',
    subtitleAr: 'السقف المسموح في تقدير الاحتياج لكل رخصة/فرع مقابل المسجلين والشواغر المتاحة',
    subtitleEn: 'Public Authority for Manpower allowed ceiling vs registered headcount & open vacancies',
    badge: 'PAM / ASAHAL',
  },
  {
    id: 6,
    code: 'RPT-06-LEAVES-VACATION',
    titleAr: '6. تقرير أرصدة الإجازات والموظفين المسافرين',
    titleEn: '6. Leave Balances & On-Vacation Staff Report',
    subtitleAr: 'أرصدة الإجازات السنوية والمرضية وتذاكر السفر وتواريخ المغادرة والعودة',
    subtitleEn: 'Accrued annual/sick leave balances, booked flight tickets, departure & airport return dates',
    badge: 'LEAVES',
  },
  {
    id: 7,
    code: 'RPT-07-EOSB-PROVISION',
    titleAr: '7. تقرير مخصصات نهاية الخدمة والإجازات التراكمي للمحاسبة',
    titleEn: '7. EOSB Indemnity & Leave Accrual Financial Provision',
    subtitleAr: 'المخصص المالي التراكمي لمكافأة نهاية الخدمة وبدل الإجازات وفق قانون العمل الكويتي',
    subtitleEn: 'Cumulative financial ledger provision for Kuwait EOSB indemnity & unused leave liability',
    badge: 'FINANCE GL',
  },
  {
    id: 8,
    code: 'RPT-08-ATTENDANCE-OT',
    titleAr: '8. تقرير الحضور، التأخير، وتكلفة الساعات الإضافية',
    titleEn: '8. Attendance, Lateness & Overtime Cost Report',
    subtitleAr: 'ساعات العمل الفعلية، دقائق التأخير، وتكلفة الإضافي المعتمدة (1.25x / 1.50x / 2.00x)',
    subtitleEn: 'Biometric attendance logs, lateness penalties & approved overtime cost by branch',
    badge: 'BIOMETRICS',
  },
  {
    id: 9,
    code: 'RPT-09-LOANS-DEDUCTIONS',
    titleAr: '9. كشف السلف والأقساط الشهرية المتبقية',
    titleEn: '9. Active Loans & Deductions Ledger',
    subtitleAr: 'إجمالي السلف، القسط الشهري المستقطع، الرصيد المتبقي، والجزاءات القانونية',
    subtitleEn: 'Staff advances, monthly payroll installments, remaining balances & disciplinary deductions',
    badge: 'LOANS',
  },
  {
    id: 10,
    code: 'RPT-10-HOUSING-TRANSPORT',
    titleAr: '10. تقرير سكن العمال وتوزيع الغرف والإيجارات',
    titleEn: '10. Staff Accommodation & Housing Report',
    subtitleAr: 'شقق سكن الشركة، السعة، نسبة الإشغال، الإيجار الشهري، وخطوط باصات الموظفين',
    subtitleEn: 'Company flats, bed capacity, occupancy, monthly rent KWD, lease expiry & transport buses',
    badge: 'HOUSING',
  },
  {
    id: 11,
    code: 'RPT-11-TURNOVER-HIRES',
    titleAr: '11. تقرير دوران العمالة، التعيينات، والاستقالات',
    titleEn: '11. Employee Turnover, Hires & Exits Report',
    subtitleAr: 'مؤشرات التوطين والاستبقاء، التعيينات الجديدة، الاستقالات، ونسب الدوران الوظيفي',
    subtitleEn: 'Retention rates, new joiners, resignations, terminations & branch stability metrics',
    badge: 'ANALYTICS',
  },
  {
    id: 12,
    code: 'RPT-12-MISSING-DOCS',
    titleAr: '12. تقرير تدقيق نواقص ملفات الموظفين',
    titleEn: '12. Missing Employee Documents Compliance Report',
    subtitleAr: 'فحص اكتمال الخزانة الرقمية (البطاقة المدنية، الجواز، كرت البلدية، العقد، الـ IBAN)',
    subtitleEn: 'Audit of missing Civil IDs, passports, Municipality health cards, contracts & IBANs',
    badge: 'AUDIT',
  },
]
