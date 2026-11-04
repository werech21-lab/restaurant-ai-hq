/**
 * odoo-hr-dashboard-data.ts
 * ==============================================================================
 * VENTURE FOODS RESTAURANTS MANAGEMENT CO. W.L.L. (Lic. 2021/22838)
 * Official Odoo Dashboards Data: Workforce Distribution, Salary Benchmarks
 * & Planning Gantt Weekly Shift Schedule (venturefoods.walnutss.com)
 * ==============================================================================
 */

export interface OdooWorkforceUnit {
  id: string
  nameAr: string
  nameEn: string
  count: number
  pct: number
  icon: string
  color: string
  subtextAr: string
  subtextEn: string
}

export interface OdooSalaryBenchmark {
  rank: number
  roleAr: string
  roleEn: string
  salaryKwd: number
  categoryAr: string
  categoryEn: string
  levelAr: string
  levelEn: string
  statusAr: string
  statusEn: string
}

export type ShiftType = 'morning' | 'evening_peak' | 'event_support' | 'day_off'

export interface ShiftDayInfo {
  dayKey: 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'
  dayNameAr: string
  dayNameEn: string
  type: ShiftType
  timeRangeAr: string
  timeRangeEn: string
  hours: number
}

export interface OdooEmployeeShiftSchedule {
  empCode: string
  empNameAr: string
  empNameEn: string
  jobTitleAr: string
  jobTitleEn: string
  branchAr: string
  branchEn: string
  brandAr: string
  brandEn: string
  weeklyHours: number
  days: ShiftDayInfo[]
}

// ------------------------------------------------------------------------------
// 1. WORKFORCE DISTRIBUTION (166 EMPLOYEES ACROSS OPERATIONAL UNITS)
// ------------------------------------------------------------------------------
export const ODOO_WORKFORCE_UNITS_6: OdooWorkforceUnit[] = [
  {
    id: 'restaurant_ops',
    nameAr: 'وحدة عمليات المطاعم والفروع',
    nameEn: 'Restaurant Operations & Branches Unit',
    count: 110,
    pct: 66.27,
    icon: '🏬',
    color: '#10b981',
    subtextAr: 'صالة وخدمة ومطابخ الفروع الـ 10',
    subtextEn: 'FOH & BOH across 10 active branches',
  },
  {
    id: 'central_kitchen',
    nameAr: 'وحدة المطبخ المركزي والإنتاج',
    nameEn: 'Central Kitchen & Production Unit',
    count: 30,
    pct: 18.07,
    icon: '👨‍🍳',
    color: '#3b82f6',
    subtextAr: 'تحضير مسبق وتجهيز اللحوم والصلصات بالقرين',
    subtextEn: 'Qurain batch prep & butchery',
  },
  {
    id: 'hr_admin',
    nameAr: 'الشؤون الإدارية والموارد البشرية',
    nameEn: 'HR & Administrative Affairs',
    count: 20,
    pct: 12.05,
    icon: '👥',
    color: '#8b5cf6',
    subtextAr: '12 شؤون إدارية + 8 موارد بشرية وعلاقات حكومية',
    subtextEn: '12 Admin Affairs + 8 HR & PRO GRO',
  },
  {
    id: 'finance',
    nameAr: 'الإدارة المالية والمحاسبة',
    nameEn: 'Finance & Accounting Department',
    count: 16,
    pct: 9.64,
    icon: '💰',
    color: '#f59e0b',
    subtextAr: 'مراقبة التكاليف، التدقيق، مسير WPS، والعهد',
    subtextEn: 'Cost control, audit, WPS payroll & custody',
  },
  {
    id: 'supply_chain_fleet',
    nameAr: 'وحدة المستودعات وسلسلة الإمداد والأسطول',
    nameEn: 'Warehouses, Supply Chain & Fleet Unit',
    count: 15,
    pct: 9.04,
    icon: '🚚',
    color: '#06b6d4',
    subtextAr: 'إدارة المخازن، التوريدات، وسائقو الشحن',
    subtextEn: 'Central store, inventory & delivery drivers',
  },
  {
    id: 'call_center',
    nameAr: 'وحدة مركز الاتصال وخدمة العملاء',
    nameEn: 'Call Center & Customer Service Unit',
    count: 10,
    pct: 6.02,
    icon: '🎧',
    color: '#ec4899',
    subtextAr: 'استقبال الطلبات المباشرة وخدمة المنصات',
    subtextEn: 'Order intake & aggregator support',
  },
]

export const TOTAL_OFFICIAL_WORKFORCE = 166

// ------------------------------------------------------------------------------
// 2. LEADERSHIP & KEY ROLES SALARY BENCHMARKS (ODOO HR DASHBOARD)
// ------------------------------------------------------------------------------
export const ODOO_LEADERSHIP_SALARY_BENCHMARKS: OdooSalaryBenchmark[] = [
  {
    rank: 1,
    roleAr: 'مدير العمليات',
    roleEn: 'Operations Director',
    salaryKwd: 1600.000,
    categoryAr: 'الإدارة العليا والتشغيل',
    categoryEn: 'Executive Operations',
    levelAr: 'درجة أولى — قيادي تنفيذي',
    levelEn: 'Tier 1 — Executive C-Level',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 2,
    roleAr: 'مدير قطاع العمليات',
    roleEn: 'Operations Division Manager',
    salaryKwd: 1300.000,
    categoryAr: 'الإدارة العليا والتشغيل',
    categoryEn: 'Executive Operations',
    levelAr: 'درجة أولى — إدارة مناطق',
    levelEn: 'Tier 1 — Area Operations',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 3,
    roleAr: 'مساعد مدير العمليات',
    roleEn: 'Assistant Operations Manager',
    salaryKwd: 850.000,
    categoryAr: 'إدارة الفروع والميدان',
    categoryEn: 'Field Operations Lead',
    levelAr: 'درجة ثانية — إشراف عام',
    levelEn: 'Tier 2 — General Supervision',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 4,
    roleAr: 'المدير المالي',
    roleEn: 'Chief Financial Officer (CFO)',
    salaryKwd: 850.000,
    categoryAr: 'الإدارة المالية والحسابات',
    categoryEn: 'Finance & Accounting',
    levelAr: 'درجة ثانية — قيادي مالي',
    levelEn: 'Tier 2 — Financial Head',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 5,
    roleAr: 'الشيف التنفيذي',
    roleEn: 'Group Executive Chef',
    salaryKwd: 850.000,
    categoryAr: 'فنون الطهي والمطبخ المركزي',
    categoryEn: 'Culinary Arts & Kitchen',
    levelAr: 'درجة ثانية — هندسة قوائم ومطابخ',
    levelEn: 'Tier 2 — Culinary R&D',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 6,
    roleAr: 'مدير الموارد البشرية والشؤون الإدارية',
    roleEn: 'HR & Administrative Manager',
    salaryKwd: 600.000,
    categoryAr: 'الموارد البشرية والإدارة',
    categoryEn: 'HR & Corporate Admin',
    levelAr: 'درجة ثالثة — شؤون موظفين',
    levelEn: 'Tier 3 — People Operations',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 7,
    roleAr: 'مسؤول التسويق التنفيذي',
    roleEn: 'Executive Marketing Coordinator',
    salaryKwd: 600.000,
    categoryAr: 'التسويق وتطوير الأعمال',
    categoryEn: 'Marketing & Brand Growth',
    levelAr: 'درجة ثالثة — تسويق وعلامات',
    levelEn: 'Tier 3 — Brand Marketing',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 8,
    roleAr: 'مدير منطقة (عقدان)',
    roleEn: 'Area Manager (2 Contracts)',
    salaryKwd: 562.500,
    categoryAr: 'إدارة الفروع والميدان',
    categoryEn: 'Store & Cluster Leadership',
    levelAr: 'درجة ثالثة — إدارة فروع متعددة',
    levelEn: 'Tier 3 — Multi-Store Lead',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 9,
    roleAr: 'محاسب',
    roleEn: 'Accountant',
    salaryKwd: 450.000,
    categoryAr: 'الإدارة المالية والحسابات',
    categoryEn: 'Finance & Accounting',
    levelAr: 'درجة رابعة — أستاذ عام وتسويات',
    levelEn: 'Tier 4 — GL & Reconciliations',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
  {
    rank: 10,
    roleAr: 'مسؤول العلاقات الحكومية (مندوب الشؤون)',
    roleEn: 'Government Relations Officer / GRO',
    salaryKwd: 450.000,
    categoryAr: 'الشؤون الإدارية والتعقيب',
    categoryEn: 'PRO & Ministerial Liaison',
    levelAr: 'درجة رابعة — تراخيص وإقامات',
    levelEn: 'Tier 4 — PAM, MOI & Baladiya',
    statusAr: 'معتمد ومُدرج بمسير WPS',
    statusEn: 'Audited & WPS Approved',
  },
]

// ------------------------------------------------------------------------------
// 3. WEEKLY PLANNING GANTT (SHIFTS & DAYS OF THE WEEK FROM ODOO PLANNING)
// ------------------------------------------------------------------------------
export const GANTT_DAYS_CONFIG = [
  { key: 'sat' as const, nameAr: 'السبت', nameEn: 'Saturday' },
  { key: 'sun' as const, nameAr: 'الأحد', nameEn: 'Sunday' },
  { key: 'mon' as const, nameAr: 'الإثنين', nameEn: 'Monday' },
  { key: 'tue' as const, nameAr: 'الثلاثاء', nameEn: 'Tuesday' },
  { key: 'wed' as const, nameAr: 'الأربعاء', nameEn: 'Wednesday' },
  { key: 'thu' as const, nameAr: 'الخميس (ذروة)', nameEn: 'Thursday (Peak)' },
  { key: 'fri' as const, nameAr: 'الجمعة (ذروة)', nameEn: 'Friday (Peak)' },
]

export const GANTT_SHIFT_LEGEND = [
  {
    type: 'morning' as const,
    labelAr: 'شفت صباحي (8:00 ص - 4:00 م)',
    labelEn: 'Morning Shift (8:00 AM - 4:00 PM)',
    colorBg: 'bg-sky-500/20',
    colorBorder: 'border-sky-500/50',
    colorText: 'text-sky-300',
    badgeColor: 'bg-sky-500',
  },
  {
    type: 'evening_peak' as const,
    labelAr: 'شفت مسائي ذروة (4:00 م - 12:00 ص)',
    labelEn: 'Evening Peak Shift (4:00 PM - 12:00 AM)',
    colorBg: 'bg-amber-500/20',
    colorBorder: 'border-amber-500/50',
    colorText: 'text-amber-300',
    badgeColor: 'bg-amber-500',
  },
  {
    type: 'event_support' as const,
    labelAr: 'شفت إسناد معارض وفعاليات (كشتة / سفير)',
    labelEn: 'Events Support Shift (Kashta / Safir)',
    colorBg: 'bg-emerald-500/20',
    colorBorder: 'border-emerald-500/50',
    colorText: 'text-emerald-300',
    badgeColor: 'bg-emerald-500',
  },
  {
    type: 'day_off' as const,
    labelAr: 'إجازة أسبوعية',
    labelEn: 'Weekly Day Off',
    colorBg: 'bg-slate-800/40',
    colorBorder: 'border-slate-700/50',
    colorText: 'text-slate-400',
    badgeColor: 'bg-slate-600',
  },
]

export const ODOO_GANTT_SCHEDULE_ROWS: OdooEmployeeShiftSchedule[] = [
  {
    empCode: '2093',
    empNameAr: 'علاء محسن قبول',
    empNameEn: 'Alaa Mohsen Kaboul',
    jobTitleAr: 'الشيف التنفيذي العام',
    jobTitleEn: 'Executive Chef',
    branchAr: 'المطبخ المركزي - القرين',
    branchEn: 'Central Kitchen - Qurain',
    brandAr: 'تشاينا جاردن وفارم براون',
    brandEn: 'China Garden & Farm Brown',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'event_support', timeRangeAr: '10:00 ص - 6:00 م', timeRangeEn: '10:00 AM - 6:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
  {
    empCode: '2111',
    empNameAr: 'زكريا إسكندر',
    empNameEn: 'Zakaria Iskandar',
    jobTitleAr: 'مدير العمليات المركزية',
    jobTitleEn: 'Operations Director',
    branchAr: 'المقر الرئيسي والميدان',
    branchEn: 'Head Office & Field Operations',
    brandAr: 'كافة البراندات الـ 6',
    brandEn: 'All 6 Brands',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'event_support', timeRangeAr: '2:00 م - 10:00 م', timeRangeEn: '2:00 PM - 10:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
  {
    empCode: '2091',
    empNameAr: 'ربيع أنيس يحيى',
    empNameEn: 'Rabih Yehia',
    jobTitleAr: 'مساعد مدير العمليات',
    jobTitleEn: 'Assistant Operations Manager',
    branchAr: 'الأفنيوز ومجمع الكوت',
    branchEn: 'The Avenues & Al Kout',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
    ],
  },
  {
    empCode: '2112',
    empNameAr: 'شيام',
    empNameEn: 'Shyam',
    jobTitleAr: 'مسؤول الموارد البشرية والشؤون الإدارية',
    jobTitleEn: 'HR & Admin Officer',
    branchAr: 'المقر الرئيسي - الشرق',
    branchEn: 'Head Office - Sharq',
    brandAr: 'فنتشر فودز المركزية',
    brandEn: 'Venture Foods HQ',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
  {
    empCode: '1715',
    empNameAr: 'أمجد سمير جرجس ميخائيل',
    empNameEn: 'Amgad Samir Girgis Mikhaeel',
    jobTitleAr: 'مسؤول العلاقات الحكومية (مندوب الشؤون والجوازات)',
    jobTitleEn: 'Government Relations Officer / GRO',
    branchAr: 'مجمعات الوزارات والمرور والشؤون',
    branchEn: 'Ministries Complex & Gov Depts',
    brandAr: 'فنتشر فودز المركزية',
    brandEn: 'Venture Foods HQ',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '7:30 ص - 3:30 م', timeRangeEn: '7:30 AM - 3:30 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '7:30 ص - 3:30 م', timeRangeEn: '7:30 AM - 3:30 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '7:30 ص - 3:30 م', timeRangeEn: '7:30 AM - 3:30 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '7:30 ص - 3:30 م', timeRangeEn: '7:30 AM - 3:30 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'morning', timeRangeAr: '7:30 ص - 3:30 م', timeRangeEn: '7:30 AM - 3:30 PM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
  {
    empCode: '2049',
    empNameAr: 'عبد الله عبد الغفار جمعة عويره',
    empNameEn: 'Abdullah Abdulghafar Awirah',
    jobTitleAr: 'سكرتير تنفيذي ومسؤول إداري',
    jobTitleEn: 'Executive Secretary',
    branchAr: 'المقر الرئيسي - الشرق',
    branchEn: 'Head Office - Sharq',
    brandAr: 'فنتشر فودز المركزية',
    brandEn: 'Venture Foods HQ',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
  {
    empCode: '1806',
    empNameAr: 'سامي صبري',
    empNameEn: 'Samy Sabry',
    jobTitleAr: 'محاسب أول',
    jobTitleEn: 'Senior Accountant',
    branchAr: 'الإدارة المالية - الشرق',
    branchEn: 'Finance HQ - Sharq',
    brandAr: 'فنتشر فودز المركزية',
    brandEn: 'Venture Foods HQ',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
  {
    empCode: '1832',
    empNameAr: 'نادر نزهي',
    empNameEn: 'Nader Nozhy',
    jobTitleAr: 'مشرف المشتريات والتوريدات',
    jobTitleEn: 'Purchasing & Supplies Supervisor',
    branchAr: 'مستودع القرين المركزي والأسطول',
    branchEn: 'Qurain Central Warehouse',
    brandAr: 'سلسلة الإمداد المركزية',
    brandEn: 'Central Supply Chain',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'event_support', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
  {
    empCode: '2001',
    empNameAr: 'أكريتي راوت',
    empNameEn: 'Akriti Raut',
    jobTitleAr: 'مشرفة صالة وخدمة عملاء',
    jobTitleEn: 'FOH Floor Supervisor',
    branchAr: 'فرع الأفنيوز مول',
    branchEn: 'The Avenues Mall',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '8:00 ص - 4:00 م', timeRangeEn: '8:00 AM - 4:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
    ],
  },
  {
    empCode: '2066',
    empNameAr: 'أمين إس كيه',
    empNameEn: 'Amin SK',
    jobTitleAr: 'مساعد شيف ووك وساخن',
    jobTitleEn: 'Wok Line Cook',
    branchAr: 'فرع السالمية',
    branchEn: 'Salmiya Branch',
    brandAr: 'تشاينا جاردن',
    brandEn: 'China Garden',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'evening_peak', timeRangeAr: '4:00 م - 12:00 ص', timeRangeEn: '4:00 PM - 12:00 AM', hours: 8 },
    ],
  },
  {
    empCode: '2104',
    empNameAr: 'أنكيت تشودري',
    empNameEn: 'Ankit Chaudhary',
    jobTitleAr: 'مساعد مطبخ وإسناد فعاليات',
    jobTitleEn: 'Kitchen Assistant & Events Support',
    branchAr: 'كشتة المارينا (فعالية معتمدة)',
    branchEn: 'Marina Kashta (Event)',
    brandAr: 'تشاينا جاردن إكسبرس',
    brandEn: 'China Garden Express',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'event_support', timeRangeAr: '2:00 م - 10:00 م', timeRangeEn: '2:00 PM - 10:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'event_support', timeRangeAr: '2:00 م - 10:00 م', timeRangeEn: '2:00 PM - 10:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'event_support', timeRangeAr: '2:00 م - 10:00 م', timeRangeEn: '2:00 PM - 10:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'event_support', timeRangeAr: '2:00 م - 10:00 م', timeRangeEn: '2:00 PM - 10:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'event_support', timeRangeAr: '3:00 م - 11:00 م', timeRangeEn: '3:00 PM - 11:00 PM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'event_support', timeRangeAr: '3:00 م - 11:00 م', timeRangeEn: '3:00 PM - 11:00 PM', hours: 8 },
    ],
  },
  {
    empCode: '1970',
    empNameAr: 'عصمت علي',
    empNameEn: 'Asmat Ali',
    jobTitleAr: 'سائق شاحنة نقل ثقيل ومبرد',
    jobTitleEn: 'Heavy Refrigerated Truck Driver',
    branchAr: 'مستودع القرين وخطوط التوريد',
    branchEn: 'Fleet & Cold Supply Chain',
    brandAr: 'سلسلة الإمداد والأسطول',
    brandEn: 'Logistics & Fleet',
    weeklyHours: 48,
    days: [
      { dayKey: 'sat', dayNameAr: 'السبت', dayNameEn: 'Saturday', type: 'morning', timeRangeAr: '6:00 ص - 2:00 م', timeRangeEn: '6:00 AM - 2:00 PM', hours: 8 },
      { dayKey: 'sun', dayNameAr: 'الأحد', dayNameEn: 'Sunday', type: 'morning', timeRangeAr: '6:00 ص - 2:00 م', timeRangeEn: '6:00 AM - 2:00 PM', hours: 8 },
      { dayKey: 'mon', dayNameAr: 'الإثنين', dayNameEn: 'Monday', type: 'morning', timeRangeAr: '6:00 ص - 2:00 م', timeRangeEn: '6:00 AM - 2:00 PM', hours: 8 },
      { dayKey: 'tue', dayNameAr: 'الثلاثاء', dayNameEn: 'Tuesday', type: 'morning', timeRangeAr: '6:00 ص - 2:00 م', timeRangeEn: '6:00 AM - 2:00 PM', hours: 8 },
      { dayKey: 'wed', dayNameAr: 'الأربعاء', dayNameEn: 'Wednesday', type: 'morning', timeRangeAr: '6:00 ص - 2:00 م', timeRangeEn: '6:00 AM - 2:00 PM', hours: 8 },
      { dayKey: 'thu', dayNameAr: 'الخميس', dayNameEn: 'Thursday', type: 'morning', timeRangeAr: '6:00 ص - 2:00 م', timeRangeEn: '6:00 AM - 2:00 PM', hours: 8 },
      { dayKey: 'fri', dayNameAr: 'الجمعة', dayNameEn: 'Friday', type: 'day_off', timeRangeAr: 'إجازة أسبوعية', timeRangeEn: 'Day Off', hours: 0 },
    ],
  },
]
