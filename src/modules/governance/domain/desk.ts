import { DomainError } from '@/lib/domain-error'

export const CLOSE_BLOCKED_MESSAGE = 'لا يُغلق المحضر قبل تقديم إفادة الموظف ورفع إثبات الإنهاء الرسمي.'

export const authorities = ['بلدية الكويت', 'القوى العاملة', 'التجارة', 'المرور', 'الإطفاء'] as const
export const violationStages = ['assigned', 'statement_submitted', 'in_remediation', 'proof_uploaded', 'closed_verified', 'escalated_neglect'] as const
export const monitorCategories = ['uniform_violation', 'hygiene_gloves_mask', 'unauthorized_phone_use', 'workstation_abandonment', 'biometric_mismatch'] as const
export const inquirySources = ['gov_violation', 'ai_camera_violation', 'manager_referral', 'financial_discrepancy'] as const
export const disciplinaryActions = ['لفت نظر', 'إنذار كتابي', 'خصم راتب', 'إحالة للشؤون القانونية'] as const
export const alertCategories = ['employee_neglect', 'repeated_violation', 'operational_error', 'sla_breach'] as const
export const taskStages = ['alert_pending', 'task_dispatched', 'in_progress', 'completed_verified'] as const

export type ViolationStage = (typeof violationStages)[number]
export type MonitorCategory = (typeof monitorCategories)[number]
export type AlertCategory = (typeof alertCategories)[number]
export type ViolationAction = 'statement' | 'remediate' | 'proof' | 'close'
export type InquiryAction = 'statement' | 'finding' | 'ruling'
export type TaskAction = 'dispatch' | 'progress' | 'complete'

const monitorLabels: Record<MonitorCategory, string> = {
  uniform_violation: 'مخالفة الزي الرسمي',
  hygiene_gloves_mask: 'سلامة الغذاء والقفازات',
  unauthorized_phone_use: 'استخدام الهاتف أثناء العمل',
  workstation_abandonment: 'ترك موقع العمل',
  biometric_mismatch: 'تلاعب بالبصمة',
}

export function monitorLabel(category: MonitorCategory): string {
  return monitorLabels[category]
}

export function closeBlocked(statement: string | null, proof: string | null): boolean {
  return statement === null || statement.trim() === '' || proof === null || proof.trim() === ''
}

export function showsNeglect(stage: string, flag: boolean, slaDeadline: string, nowMs: number): boolean {
  if (stage === 'closed_verified') return false
  if (flag) return true
  const deadline = Date.parse(`${slaDeadline}T23:59:59.999Z`)
  return Number.isFinite(deadline) && deadline < nowMs
}

export function alertRecommendation(category: AlertCategory): string {
  switch (category) {
    case 'employee_neglect':
      return 'كلّف المشرف بإنهاء المحضر ورفع الإثبات قبل نهاية المهلة، ثم أغلق التنبيه بعد التحقق.'
    case 'repeated_violation':
      return 'افتح محضر تقصي وقارن التكرار خلال 90 يوماً قبل أي خصم.'
    case 'operational_error':
      return 'وثّق الخطأ التشغيلي وأسند التصحيح لموظف محدد بتاريخ استحقاق.'
    case 'sla_breach':
      return 'ارفع المخالفة المتجاوزة للمدير العام مع بيان سبب التأخير.'
  }
}

export function inquiryFromMonitor(category: MonitorCategory, employeeName: string): string {
  return `ملاحظة انضباط مسجّلة: ${monitorLabel(category)} — ${employeeName}. المحضر يفتح للمراجعة البشرية دون بث مباشر.`
}

export function violationTransition(stage: ViolationStage, action: ViolationAction, statement: string | null, proof: string | null): ViolationStage {
  if (action === 'close' && closeBlocked(statement, proof)) throw new DomainError('violation_incomplete', CLOSE_BLOCKED_MESSAGE)
  if (action === 'statement' && (stage === 'assigned' || stage === 'escalated_neglect')) return 'statement_submitted'
  if (action === 'remediate' && stage === 'statement_submitted' && statement !== null && statement.trim() !== '') return 'in_remediation'
  if (action === 'proof' && stage === 'in_remediation') return 'proof_uploaded'
  if (action === 'close' && stage === 'proof_uploaded') return 'closed_verified'
  throw new DomainError('invalid_transition', 'هذا الانتقال غير مسموح في محضر المخالفة.')
}

export function inquiryTransition(stage: string, action: InquiryAction, questionCount: number): string {
  if (action === 'statement' && (stage === 'open_summons' || stage === 'hearing_in_progress')) return 'hearing_in_progress'
  if (action === 'finding' && stage === 'hearing_in_progress' && questionCount > 0) return 'awaiting_manager_ruling'
  if (action === 'ruling' && stage === 'awaiting_manager_ruling') return 'closed_enforced'
  throw new DomainError('invalid_transition', 'هذا الانتقال غير مسموح في محضر التحقيق.')
}

export function taskTransition(stage: string, action: TaskAction): string {
  if (action === 'dispatch' && stage === 'alert_pending') return 'task_dispatched'
  if (action === 'progress' && stage === 'task_dispatched') return 'in_progress'
  if (action === 'complete' && stage === 'in_progress') return 'completed_verified'
  throw new DomainError('invalid_transition', 'هذا الانتقال غير مسموح في التكليف.')
}
