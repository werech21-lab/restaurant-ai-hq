/**
 * odoo-hr-dashboard-data.ts
 * ==============================================================================
 * Typed HR schedule & workforce interfaces (zero static workforce counts,
 * zero hardcoded salary benchmarks, zero invented shift rows).
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

export const ODOO_WORKFORCE_UNITS_6: OdooWorkforceUnit[] = []
export const TOTAL_OFFICIAL_WORKFORCE = 0
export const ODOO_LEADERSHIP_SALARY_BENCHMARKS: OdooSalaryBenchmark[] = []

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
    labelAr: 'شفت إسناد معارض وفعاليات',
    labelEn: 'Events Support Shift',
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

export const ODOO_GANTT_SCHEDULE_ROWS: OdooEmployeeShiftSchedule[] = []
