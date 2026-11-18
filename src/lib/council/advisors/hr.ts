/**
 * HR advisor — hr.attendance shifts vs order load.
 *
 * Works on attendance rows (employee id, department, check-in / check-out in Odoo UTC). Employee
 * names never enter this module or its report. Staffed hours vs order load per hour per branch
 * needs the employee's branch (work location) — when Odoo does not carry it the advisor says so
 * and lists exactly what must be recorded.
 */
import { clamp01, estimate, evidence, r1 } from '../helpers'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export interface AttendanceRow {
  employeeId: number
  /** Full Odoo department path (e.g. `Rest. Operations Department / Restaurant Unit / BOH Section`). */
  department: string | null
  /** Odoo UTC timestamps `YYYY-MM-DD HH:MM:SS`. */
  checkIn: string
  checkOut: string | null
  /** Branch id when Odoo carries a work location; null when not recorded. */
  branchId?: string | null
}

export interface HrInput {
  attendance: {
    rows: AttendanceRow[]
    period: { from: string; to: string }
    syncAt: string | null
    /** True when the read hit its row limit (the sample is not the whole period). */
    capped: boolean
    rowLimit: number | null
  } | null
  /** Standard shift length in hours (owner context). */
  standardShiftHours?: number
}

const ODOO_TS = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`)

export function sectionOf(department: string | null): string {
  if (!department) return 'Unassigned'
  const parts = department.split('/').map((p) => p.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? department
}

export function shiftStats(rows: readonly AttendanceRow[], standard: number) {
  const closed = rows
    .filter((r) => r.checkOut)
    .map((r) => ({ ...r, hours: (ODOO_TS(r.checkOut!) - ODOO_TS(r.checkIn)) / 3_600_000 }))
    .filter((r) => Number.isFinite(r.hours) && r.hours >= 0)
  const over10 = closed.filter((r) => r.hours > 10)
  const over12 = closed.filter((r) => r.hours > 12)
  // Overtime above the standard shift, counting only plausible shifts (≤ 12 h; longer ones are
  // most likely missed check-outs and are reported separately).
  const overtimeHours = closed.filter((r) => r.hours <= 12).reduce((s, r) => s + Math.max(0, r.hours - standard), 0)
  const sorted = closed.map((r) => r.hours).sort((a, b) => a - b)
  const medianHours = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0
  const bySection = new Map<string, { shifts: number; over10: number; over12: number }>()
  for (const r of closed) {
    const k = sectionOf(r.department)
    const s = bySection.get(k) ?? { shifts: 0, over10: 0, over12: 0 }
    s.shifts++
    if (r.hours > 10) s.over10++
    if (r.hours > 12) s.over12++
    bySection.set(k, s)
  }
  return { closed: closed.length, open: rows.length - closed.length, over10: over10.length, over12: over12.length, overtimeHours, medianHours, bySection }
}

export const hrAdvisor: Advisor<HrInput> = {
  id: 'hr',
  domainAr: 'الموارد البشرية والعمل الإضافي',
  domainEn: 'HR & overtime',
  run(input: HrInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const standard = input.standardShiftHours ?? 9
    const att = input.attendance
    if (!att || att.rows.length === 0) {
      gaps.push({ odooModel: 'hr.attendance', missingAr: 'لا توجد سجلات حضور (check-in / check-out) في Odoo لهذه الفترة.', missingEn: 'No attendance records (check-in / check-out) in Odoo for this period.', recordAr: 'تسجيل الحضور والانصراف لكل موظف يومياً في hr.attendance (جهاز البصمة أو تطبيق الحضور).', recordEn: 'Record each employee’s daily check-in and check-out in hr.attendance (fingerprint device or the attendance app).' })
      return { advisorId: 'hr', domainAr: this.domainAr, domainEn: this.domainEn, period: null, generatedAt: null, status: 'unavailable', findings, dataGaps: gaps }
    }
    const s = shiftStats(att.rows, standard)
    const period = att.period
    const sample = att.capped ? { ar: ` (عينة محدودة بـ${att.rowLimit} سجل)`, en: ` (sample capped at ${att.rowLimit} rows)` } : { ar: '', en: '' }
    const days = Math.max(1, (Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000 + 1)
    if (s.closed > 0 && s.over12 > 0) {
      const share = r1((s.over12 / s.closed) * 100)
      const worst = [...s.bySection].filter(([, v]) => v.shifts >= 20).sort((a, b) => b[1].over12 / b[1].shifts - a[1].over12 / a[1].shifts)[0]
      findings.push({
        fingerprint: 'hr:missed-checkout',
        advisorId: 'hr',
        kind: 'missed-checkout',
        entities: {},
        titleAr: `${s.over12} من ${s.closed} وردية مغلقة تجاوزت 12 ساعة (${share.toFixed(1)}%)${sample.ar}`,
        titleEn: `${s.over12} of ${s.closed} closed shifts ran over 12 hours (${share.toFixed(1)}%)${sample.en}`,
        evidence: [
          evidence({ odooModel: 'hr.attendance', domain: 'check_out set, duration > 12 h', period, value: s.over12, unit: 'count', syncAt: att.syncAt, labelAr: 'ورديات أطول من 12 ساعة', labelEn: 'Shifts longer than 12 hours' }),
          evidence({ odooModel: 'hr.attendance', domain: 'check_out set', period, value: s.closed, unit: 'count', syncAt: att.syncAt, labelAr: 'الورديات المغلقة', labelEn: 'Closed shifts' }),
          evidence({ odooModel: 'hr.attendance', domain: 'share of closed shifts > 12 h', period, value: share, unit: 'pct', syncAt: att.syncAt, labelAr: 'النسبة من الورديات المغلقة', labelEn: 'Share of closed shifts' }),
          ...(worst ? [evidence({ odooModel: 'hr.attendance', domain: `department section=${worst[0]}`, period, value: worst[1].over12, unit: 'count' as const, syncAt: att.syncAt, labelAr: `أطول من 12 ساعة في ${worst[0]}`, labelEn: `Over 12 hours in ${worst[0]}` })] : []),
        ],
        thresholds: { longShiftHours: 12, rowLimit: att.rowLimit ?? 0 },
        rootCause: {
          ar: 'ورديات تتجاوز 12 ساعة غالباً انصراف غير مسجل، فتُحسب ساعات إضافية لم تُعمل — أو ورديات مزدوجة حقيقية تحتاج قراراً.',
          en: 'Shifts over 12 hours are mostly missed check-outs, so overtime is counted for hours not worked — or real double shifts that need a decision.',
        },
        severity: share >= 10 ? 'high' : 'medium',
        novelty: clamp01(share / 25),
        weeklyImpact: null,
        proposals: [
          {
            who: { ar: 'مدير الموارد البشرية', en: 'HR manager' },
            what: { ar: 'تفعيل الانصراف التلقائي بعد نهاية الوردية + مراجعة يومية من المشرف لكل حضور مفتوح قبل اعتماد العمل الإضافي', en: 'enable auto check-out at shift end + a daily supervisor review of every open attendance before overtime is approved' },
            when: { ar: 'من الأسبوع القادم', en: 'from next week' },
            expectedImpact: null,
          },
          {
            who: { ar: `مشرف ${worst ? worst[0] : 'القسم'}`, en: `${worst ? worst[0] : 'Section'} supervisor` },
            what: { ar: 'قاعدة واضحة: لا يُعتمد أي إضافي فوق الوردية المعيارية إلا بموافقة مكتوبة قبل بدايته، مع سبب (ذروة، غياب، تجهيز)', en: 'a clear rule: no overtime beyond the standard shift without written approval before it starts, with a reason (peak, absence, prep)' },
            when: { ar: 'من الأسبوع القادم', en: 'from next week' },
            expectedImpact: null,
          },
        ],
      })
    }
    if (s.closed > 0 && s.overtimeHours > 0) {
      const perWeek = (s.overtimeHours * 7) / days
      const worst = [...s.bySection].filter(([, v]) => v.shifts >= 20).sort((a, b) => b[1].over10 / b[1].shifts - a[1].over10 / a[1].shifts)[0]
      findings.push({
        fingerprint: `hr:overtime${worst ? `:${worst[0]}` : ''}`,
        advisorId: 'hr',
        kind: 'overtime',
        entities: {},
        titleAr: `${s.over10} وردية فوق 10 ساعات؛ الوسيط ${r1(s.medianHours).toFixed(1)} ساعة مقابل وردية معيارية ${standard} ساعات${worst ? ` — الأعلى في ${worst[0]}` : ''}`,
        titleEn: `${s.over10} shifts over 10 hours; median ${r1(s.medianHours).toFixed(1)} h against a ${standard}-hour standard shift${worst ? ` — highest in ${worst[0]}` : ''}`,
        evidence: [
          evidence({ odooModel: 'hr.attendance', domain: 'check_out set, duration > 10 h', period, value: s.over10, unit: 'count', syncAt: att.syncAt, labelAr: 'ورديات فوق 10 ساعات', labelEn: 'Shifts over 10 hours' }),
          evidence({ odooModel: 'hr.attendance', domain: 'check_out set', period, value: r1(s.medianHours), unit: 'hours', syncAt: att.syncAt, labelAr: 'وسيط طول الوردية', labelEn: 'Median shift length' }),
          ...(worst ? [evidence({ odooModel: 'hr.attendance', domain: `department section=${worst[0]}`, period, value: worst[1].over10, unit: 'count' as const, syncAt: att.syncAt, labelAr: `فوق 10 ساعات في ${worst[0]}`, labelEn: `Over 10 hours in ${worst[0]}` })] : []),
        ],
        thresholds: { longShiftHours: 10, standardShiftHours: standard },
        rootCause: { ar: 'طول الوردية الفعلي أعلى من المعيار بشكل منتظم: جدول لا يطابق ساعات الضغط، أو نقص عدد في الذروة يُعوَّض بالتمديد.', en: 'Actual shifts are consistently longer than the standard: a roster that does not match the busy hours, or a peak shortage covered by extending shifts.' },
        severity: 'medium',
        novelty: clamp01(s.over10 / Math.max(1, s.closed)),
        weeklyImpact: estimate(perWeek, 'hours', `Σ max(0, shift hours − ${standard}) over shifts ≤ 12 h × 7 ÷ days`, { overtimeHours: r1(s.overtimeHours), days, standardShiftHours: standard }),
        proposals: [
          {
            who: { ar: 'مدير العمليات مع الموارد البشرية', en: 'Operations manager with HR' },
            what: { ar: `إعادة بناء جدول ${worst ? worst[0] : 'الأقسام'} على ساعات الذروة الفعلية من نقاط البيع بدلاً من ورديات ثابتة طويلة`, en: `rebuild the ${worst ? worst[0] : 'section'} roster around the real POS peak hours instead of long fixed shifts` },
            when: { ar: 'قبل جدول الشهر القادم', en: 'before next month’s roster' },
            expectedImpact: estimate(perWeek * 0.3, 'hours', '30% × weekly overtime hours', { weeklyOvertimeHours: r1(perWeek), reductionShare: 0.3 }),
          },
        ],
      })
    }
    if (s.open > 0) {
      findings.push({
        fingerprint: 'hr:open-checkins',
        advisorId: 'hr',
        kind: 'open-checkins',
        entities: {},
        titleAr: `${s.open} حضور مفتوح بلا انصراف${sample.ar}`,
        titleEn: `${s.open} open attendances with no check-out${sample.en}`,
        evidence: [evidence({ odooModel: 'hr.attendance', domain: 'check_out = false', period, value: s.open, unit: 'count', syncAt: att.syncAt, labelAr: 'حضور بلا انصراف', labelEn: 'Attendance without check-out' })],
        thresholds: { rowLimit: att.rowLimit ?? 0 },
        rootCause: { ar: 'سجلات مفتوحة تجعل حساب الساعات والإضافي غير دقيق.', en: 'Open records make hours and overtime inaccurate.' },
        severity: 'low',
        novelty: clamp01(s.open / Math.max(1, att.rows.length)),
        weeklyImpact: null,
        proposals: [{ who: { ar: 'مشرفو الورديات', en: 'Shift supervisors' }, what: { ar: 'إغلاق كل حضور مفتوح قبل نهاية اليوم', en: 'close every open attendance before the end of the day' }, when: { ar: 'يومياً', en: 'daily' }, expectedImpact: null }],
      })
    }
    if (!att.rows.some((r) => r.branchId)) {
      gaps.push({ odooModel: 'hr.employee (work_location_id)', missingAr: 'الحضور غير مربوط بالفرع، فلا يمكن مقارنة ساعات الطاقم بحمل الطلبات لكل ساعة في كل فرع.', missingEn: 'Attendance is not linked to a branch, so staffed hours cannot be compared with order load per hour per branch.', recordAr: 'تعيين موقع العمل (work_location_id) أو الفرع لكل موظف في hr.employee، أو جهاز بصمة منفصل لكل فرع.', recordEn: 'Set a work location (work_location_id) or branch on every employee in hr.employee, or a separate attendance device per branch.' })
    }
    if (att.capped) {
      gaps.push({ odooModel: 'hr.attendance', missingAr: `العينة محدودة بـ${att.rowLimit} سجل، وليست كل الفترة.`, missingEn: `The sample is capped at ${att.rowLimit} rows, not the whole period.`, recordAr: 'قراءة حية كاملة للفترة (للقراءة فقط).', recordEn: 'A full live read of the period (read-only).' })
    }
    gaps.push({ odooModel: 'hr.attendance.overtime / resource.calendar', missingAr: 'لم يُتحقق حياً من وجود سجل العمل الإضافي المعتمد وجداول الورديات المخططة.', missingEn: 'The approved-overtime records and the planned shift calendars were not verified live.', recordAr: 'تشغيل فحص النماذج (للقراءة فقط) على Odoo.', recordEn: 'Run the read-only model probe against Odoo.' })
    return { advisorId: 'hr', domainAr: this.domainAr, domainEn: this.domainEn, period, generatedAt: att.syncAt, status: 'partial', findings, dataGaps: gaps }
  },
}
