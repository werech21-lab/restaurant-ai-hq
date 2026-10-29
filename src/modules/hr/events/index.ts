import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = { name: N; version: 1; occurredAt: string; tenantId: string; payload: P }

export type HrPayrollPosted = EventBase<'hr.payroll.posted', { runId: string; period: string; netMinor: number; journalEntryId: string; postedBy: string }>
export type HrLeaveDecided = EventBase<'hr.leave.decided', { leaveId: string; decision: 'approved' | 'rejected'; decidedBy: string }>
export type HrExpenseDecided = EventBase<'hr.expense.decided', { expenseId: string; decision: 'approved' | 'rejected'; amountMinor: number; journalEntryId: string | null; decidedBy: string }>
export type HrAppointmentBooked = EventBase<'hr.appointment.booked', { appointmentId: string; requestCode: string; bookedBy: string }>
export type HrAppointmentCompleted = EventBase<'hr.appointment.completed', { appointmentId: string; requestCode: string; completedBy: string }>
export type HrEvent = HrPayrollPosted | HrLeaveDecided | HrExpenseDecided | HrAppointmentBooked | HrAppointmentCompleted

export async function publishHrEvents(events: readonly HrEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}
