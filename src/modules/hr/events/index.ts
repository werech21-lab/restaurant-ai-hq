import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = { name: N; version: 1; occurredAt: string; tenantId: string; payload: P }

export type HrPayrollPosted = EventBase<'hr.payroll.posted', { runId: string; period: string; netMinor: number; journalEntryId: string; postedBy: string }>
export type HrLeaveDecided = EventBase<'hr.leave.decided', { leaveId: string; decision: 'approved' | 'rejected'; decidedBy: string }>
export type HrExpenseDecided = EventBase<'hr.expense.decided', { expenseId: string; decision: 'approved' | 'rejected'; amountMinor: number; journalEntryId: string | null; decidedBy: string }>
export type HrEvent = HrPayrollPosted | HrLeaveDecided | HrExpenseDecided

export async function publishHrEvents(events: readonly HrEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}
